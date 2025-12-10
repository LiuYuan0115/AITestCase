const { Service } = require('egg');
const _ = require('lodash');
const moment = require('moment');

class TeachService extends Service {
  /**
   * @param {string} imageUrl 处理过后的图片 - 压缩、裁剪
   * @param {string} originImageUrl 未处理过的图片 - 未裁剪过，但压缩过，这张图片是打点用的，本身在业务上没用到
   * @return {object} 图片处理完的结果
   * @description 处理图片，包含两步：
   *              1. ocr
   *              2. 判断是否是图片解题
   */
  async resolveImage(imageUrl, originImageUrl) {
    const { ctx } = this;
    // ocr识别图片
    const result = await ctx.service.question.ocr(imageUrl);
    if (!result || _.isEmpty(result.data)) {
      const pointData = {
        url: imageUrl,
      };
      if (originImageUrl) {
        pointData.originUrl = originImageUrl;
      }
      ctx.service.point.firebasePoint(ctx.user.uid, 'Web_OCR_Fail', pointData);
      ctx.throw(new Error('图片识别异常'));
    }
    const { request_id: questionId, text: questionText, line_data = [] } = result.data || {};

    return { questionId, questionText, isImageSolve: ctx.helper.isImageQuestion(line_data) };
  }

  /**
   * @param {object} questionInfo
   * @description 把传入的信息插入到question表中
   */
  async insertQuesionTable(questionInfo) {
    const { ctx } = this;
    const { uid: deviceId } = ctx.user;
    const {
      questionId,
      questionText,
      solveMode,
      language,
      platform,
      modelName,
      pictureKey,
      costType,
      subject = 'math',
    } = questionInfo;
    const { pushToken } = await ctx.service.user.find();
    const solvelyTime = moment().valueOf();
    const model = await ctx.helper._getModelByDeviceId(deviceId);

    return await model.create({
      deviceId,
      language,
      questionId,
      questionText,
      pictureKey,
      solvelyTime,
      pushToken,
      lastSolveMode: solveMode, // 最后一次解题的模式
      platform,
      modelName,
      costType,
      // solveCount, // teach模式不用处理，永远为1，默认值就是1，此字段用来表示这道题被解了几次，绝大多数情况下，此值为1，当有重试的情况下，此值自增
      // taskType, // 不用写，默认null，现在业务server没用到，public那边会用到，把算法名字写进去
      subject, // 必须要写，调用老的解题流程（即fast解题或者teach切fast），学科的值必须传，否则算法那边会解题失败！虽然多学科，但是默认使用math兜底！
      answerStatus: 0, // 插入question表，teach模式默认为解题成功，因为它没有具体结束的时机，只要成功创建了questionId，就标记为成功状态
      questionTag: 0,
      answer: '',
    });
  }

  /**
   * @param {object} questionInfo
   * @example https://console-docs.apipost.cn/preview/ca4234a65a6bce09/8aba7da8cf888bd8?target_id=6c8a09f7-f1c6-48c0-baa0-ccd48da15838
   */
  async pushQuestionInfoToPublic(questionInfo) {
    const { ctx, app } = this;
    const { uid: deviceId } = ctx.user;
    const {
      questionId,
      questionText,
      solveMode,
      isImageSolve,
      language,
      platform,
      modelName,
      pictureKey,
      originPictureKey: uncroppedImgUrl,
    } = questionInfo;
    const data = {
      questionId,
      updateObj: {
        deviceId,
        questionText,
        platform,
        modelName,
        language,
        pictureKey,
        uncroppedImgUrl,
        solveMode,
        isImageSolve,
      },
    };
    const result = await ctx.curl(
      `${app.config.commonServiceConfig.host}/solvelyPubServer/questionInfo/v1`,
      {
        method: 'POST',
        contentType: 'json',
        dataType: 'json',
        data,
      },
    );
    return result.data;
  }
  /**
   * @param {string} mode fast | teach
   * @param {string} deviceId
   * @return {object} 次数是否超限，是否是unlimited
   * @description 目前还没有扣减钻石的逻辑，只有扣次数
   */
  async checkSubscriptionByMode(mode, deviceId) {
    const { ctx } = this;
    deviceId = deviceId || ctx.user.uid;
    const subscription = await ctx.service.subscription.findActiveSubscription(deviceId);
    const unlimitedSubscriptions = subscription.filter(
      (item) => item.subscribePlan === 'unlimited',
    );
    const isUnlimited = !_.isEmpty(unlimitedSubscriptions);
    const ret = { isUnlimited, exceedLimit: false };
    // 没有订阅，查询剩余次数
    if (!isUnlimited) {
      const res = await ctx.service.balance.getDiamond(deviceId);
      // 取出这个模式下的解题次数
      const count = res[mode];
      // 次数超限
      if (count <= 0) {
        ret.exceedLimit = true;
      } else {
        // 还有解题次数，则扣减这个模式下的解题次数
        ctx.service.balance.updateDiamond(deviceId, { [mode]: -1 });
      }
    }
    return ret;
  }
}

module.exports = TeachService;
