const { Controller } = require('egg');
const moment = require('moment');
const momentTz = require('moment-timezone');
const _ = require('lodash');

// const CODE_MAP = {
//   30001: '余额不足',
//   30004: '题意不清晰',
// };

class QuestionController extends Controller {
  /**
   * 图片解题
   */
  async photo() {
    const { ctx } = this;
    // 前置参数校验
    ctx.validate({
      mode: ctx.app.config.SOLVE_MODES.LIST,
      subject: 'string',
      language: 'string',
      time: 'int',
    });
    // 文件校验：单独校验files属性，因为要改变校验不通过的响应体
    try {
      ctx.validate({
        files: {
          type: 'array',
          min: 1,
          itemType: 'object',
          rule: {
            processed: 'url',
            origin: 'url?', // required: false
          },
        },
      });
    } catch (err) {
      ctx.body = {
        code: 30002,
        msg: '图片为空或格式不正确',
      };
      return;
    }

    const { subject, language, time, instructions = '', mode } = ctx.request.body;

    // 余额是否充足
    const { consumptionType, approved } = await ctx.service.balance.checkBalance(
      ctx.user.uid,
      mode,
    );
    if (!approved) {
      ctx.body = {
        code: 30001,
        msg: '余额不足',
      };
      return;
    }

    const questionInfo = {
      subject,
      language,
      time,
      instructions,
    };
    const result = await ctx.service.question.answer(
      'photo',
      mode,
      questionInfo,
      false,
      consumptionType,
    );
    if (result) {
      ctx.body = result;
    } else {
      ctx.body = null;
    }
  }
  /**
   * 文本解题
   */
  async text() {
    const { ctx } = this;

    ctx.validate({
      mode: ctx.app.config.SOLVE_MODES.LIST,
      questionText: 'string',
      subject: 'string',
      language: 'string',
      time: 'number',
      isForce: 'boolean?', // 是否强制解题，默认为false，当题意检查不通过，第二次解题时，值为true
      url: 'url?', // 检查题意不通过，第二次解题时，会传入这个参数，这是图片地址
      isImageSolve: 'boolean?', // 题意检查不通过，第二次解题时传入，在上一步已经确定是否是图片解题了
      questionId: 'string?', // 图片题题意不全需要把questionId带过来
    });

    const {
      questionText,
      subject,
      language,
      time,
      isImageSolve = false,
      mode,
      isForce,
      questionId,
      instructions = '',
    } = ctx.request.body;

    // 余额是否充足
    const { consumptionType, approved } = await ctx.service.balance.checkBalance(
      ctx.user.uid,
      mode,
    );
    if (!approved) {
      ctx.body = {
        code: 30001,
        msg: '余额不足',
      };
      return;
    }

    const questionInfo = {
      questionId: questionId || ctx.helper.generateQuestionId(),
      questionText,
      subject,
      language,
      time,
      isImageSolve,
      instructions,
    };
    // 开始解答
    const result = await ctx.service.question.answer(
      'text',
      mode,
      questionInfo,
      false,
      consumptionType,
      0,
      isForce,
    );
    if (result) {
      ctx.body = result;
    } else {
      ctx.body = null;
    }
  }
  /**
   * 解题统计
   */
  async statistics() {
    const { ctx } = this;
    const result = await ctx.service.question.statistics();
    ctx.body = result;
  }
  /**
   * 追问
   */
  async follow() {
    const { ctx } = this;
    ctx.validate({
      questionText: 'string',
      answer: 'string',
      questionMore: 'string',
      language: 'string',
      questionId: 'string',
    });
    await ctx.service.question.follow();
  }
  /**
   * 解题历史
   */
  async history() {
    const { ctx } = this;
    const result = await ctx.service.question.history();
    ctx.body = result;
  }
  /**
   * 解题详情
   */
  async detail() {
    const { ctx } = this;
    const { questionId } = ctx.params;
    const deviceId = ctx.user.uid;
    const result = await ctx.service.question.detail({ deviceId, questionId });
    ctx.body = result;
  }
  /**
   * 赞/踩
   */
  async like() {
    const { ctx } = this;
    ctx.validate({
      like: 'number',
      answerId: 'string?',
    });
    ctx.service.question.like();
    ctx.body = null;
  }
  /**
   * 踩完feedback
   */
  async feedback() {
    const { ctx } = this;
    ctx.validate({
      questionId: 'string',
      answerId: 'string?',
      title: 'string',
      content: 'string',
    });
    const result = await ctx.service.question.feedback();
    ctx.body = result;
  }
  /**
   * 重试解题
   */
  async retry() {
    const { ctx } = this;
    ctx.validate({ mode: ctx.app.config.SOLVE_MODES.LIST });
    await ctx.service.question.retry();
    ctx.body = null;
  }
  /**
   * 微服务解题后回调，仅限fast模式
   */
  async webhook() {
    const { ctx } = this;
    const { deviceId, questionId, answerStatus = 0, mateData = {} } = ctx.request.body;
    const questionInfo = await ctx.service.question.info({ deviceId, questionId });
    if (answerStatus === 3 && questionInfo.costType === 'gems' && questionInfo.solveCount === 2) {
      // 退钻
      await ctx.service.balance.refundDiamond(deviceId, questionId);
      ctx.service.point.firebasePoint(deviceId, 'Web_Retry_Fail', { questionId });
    }
    // fast模式解题重试失败，返还fast次数
    if (
      answerStatus === 3 &&
      questionInfo.costType.includes('fastFreeCount') &&
      questionInfo.solveCount === 2
    ) {
      await ctx.service.balance.updateDiamond(deviceId, { fast: 1 });
      ctx.service.point.firebasePoint(deviceId, 'Web_Fast_Retry_Fail', { questionId });
    }
    // 查询deviceId对应用户的pushToken，调用fcm推送服务
    const user = await ctx.service.user.findUser(deviceId);
    // 推送消息
    await ctx.service.fcm.push(deviceId, questionId, user.webPushToken, answerStatus);

    if (mateData.completedRetry) {
      ctx.service.question.saveQuestionToRetry(deviceId, questionId);
    }
    ctx.service.point.firebasePoint(deviceId, 'Web_Response_Time_Solve', {
      questionId,
      result: answerStatus === 0 ? 'success' : 'fail',
      duration: moment().diff(moment(+questionInfo.solvelyTime)),
    });
    const now = momentTz().tz('Asia/Shanghai');
    const nowTime = now.format('YYYY-MM-DD HH:mm:ss');
    ctx.service.common.saveQuestionInfoToBq({
      deviceId,
      questionId,
      questionText: questionInfo.questionText,
      pictureKey: questionInfo.pictureKey,
      answer: questionInfo.answer,
      feedBack: questionInfo.feedBack,
      language: questionInfo.language || 'en',
      subject: questionInfo.subject || 'Math',
      promptToken: questionInfo.promptToken || 0,
      completionToken: questionInfo.completionToken || 0,
      answerStatus: questionInfo.answerStatus,
      solvelyTime: questionInfo.solvelyTime,
      taskType: questionInfo.taskType || '',
      modelName: questionInfo.modelName || '',
      solveCount: questionInfo.solveCount,
      costType: questionInfo.costType,
      platform: questionInfo.platform,
      createTime: nowTime,
      updateTime: nowTime,
    });
    ctx.status = 200;
    ctx.body = {};
  }
  /**
   * 获取微服务流式解题状态
   */
  async getIsStartAnswerQuestions() {
    const { ctx } = this;
    const deviceId = ctx.user.uid;
    const questionIds = ctx.query.questionIds.split(',');
    // 循环查询每个问题的解题状态
    const list = [];
    for (const questionId of questionIds) {
      const result = await ctx.service.question.detail({ deviceId, questionId });
      // 不在解题中
      if (result.answerStatus !== 1) {
        list.push(questionId);
      }
    }

    // 如果有问题不在解题中状态，则返回不在解题中的问题id
    if (list.length > 0) {
      ctx.body = {
        code: 30006,
        data: list,
      };
      return;
    }
    // 有在等待解题中的题目
    const result = await ctx.service.common.getIsStartAnswerQuestions(deviceId, questionIds);
    ctx.body = result;
  }
  async answerQuestionStream() {
    const { ctx } = this;
    const deviceId = ctx.params.deviceId;
    const questionId = ctx.params.questionId;
    // 校验该deviceId下的questionId是否匹配，并且是否在解题中
    const result = await ctx.service.question.detail({ deviceId, questionId });
    if (_.isEmpty(result)) {
      ctx.body = {
        code: 30002,
        msg: '该问题不存在',
      };
      return;
    } else if (result.answerStatus !== 1) {
      /**
       * 问题不在解题中，
       *  1. `解题失败`
       *  2. `已经解完题`，例如一些简单数学题`1+1=?`，瞬间就能解题完毕，此时前端调用流式解题接口，便会返回下方的结构体
       */
      ctx.body = {
        code: 30003,
        msg: '该问题不在解题中',
      };
      return;
    }
    await ctx.service.common.commonAnswerQuestionStream(deviceId, questionId);
  }
  /**
   * 提交解题
   */
  async fastAdd() {
    const { ctx } = this;
    ctx.validate({
      type: 'string?',
      mode: { type: 'enum', values: ctx.app.config.SOLVE_MODES.LIST, required: false },
      questionText: 'string?',
      subject: 'string?',
      language: 'string?',
      time: 'number?',
      isForce: 'boolean?',
      url: 'url?',
      isImageSolve: 'boolean?',
      isRetry: 'boolean?',
      isReAnswer: 'boolean?',
      questionId: 'string?',
      instructions: 'string?',
      userName: 'string?',
      // O1自动校验流程是否打开，true 开启, false 关闭
      verifySwitch: 'boolean?',
      // O1自检模型阈值, 阈值越高，越严格，需要重解的比例越大，目前支持的阈值[0, 0.5, 0.6, 0.7]
      verifyThreshold: { type: 'number?', required: false, min: 0, max: 1.01 },
      // O1方案二流程是否打开，true 开启, false 关闭
      chooseModelSwitch: 'boolean?',
      // O1方案二模型选择，目前支持[AI-Flash, AI-Sage] 直接透传给算法， AI-Flash 为当前默认解题流程
      chooseModel: 'string?',
      // debug参数，0,正常模式; 1,verified; 2,resolvingFailed; 3,resolvingVerified; 4,resolvingDiff
      debugO1VerifyResult: 'number?',
      // 推荐问题类型，目前支持:html
      ilType: 'string?',
      // dsl相关参数
      // 解题风格
      renderStyle: 'string?',
      // 实验参数
      experimental: 'string?',
      // 是否返回完整解题结果
      returnFullWhenDone: 'boolean?',
      // 区分不同平台
      platform: 'string?',
      // 标识是否使用新API
      useNewApi: 'boolean?',
    });

    if (ctx.request.body.type === 'photo') {
      try {
        ctx.validate({
          files: {
            type: 'array',
            min: 1,
            itemType: 'object',
            rule: {
              processed: 'url',
              origin: 'url?', // required: false
            },
          },
        });
      } catch (err) {
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30002,
            msg: '图片为空或格式不正确',
            command: 'server-stop',
          },
          { isEnd: true },
        );
        return;
      }
    }

    const {
      type,
      questionText,
      subject,
      language,
      time,
      isForce = false,
      url,
      isImageSolve = false,
      isRetry,
      isReAnswer,
      isReload = false,
      questionId = '',
      answerId = '',
      instructions = '',
      solveMode = 'fast',
      answerStyle,
      answerLanguage,
      answerType = 'generation',
      files = [],
      userName = '',
      regenerateReason = '',
      regenerateTag,
      regeneratePictureKeys,
      fromAnswerId,
      // 推荐问题类型，目前支持:html
      ilType,
      // dsl相关参数
      renderStyle,
      experimental,
      returnFullWhenDone = true,
      platform,
      // 标识是否使用新API
      useNewApi = false,
    } = ctx.request.body;

    // 检查余额，consumptionType为消耗类型(unlimited, teach, fast, balance)，approved为是否通过
    const { consumptionType, approved } = await ctx.service.balance.checkBalance(
      ctx.user.uid,
      ctx.request.body.mode,
    );
    if (!isRetry && !isReload && !approved) {
      ctx.helper.streamResponse(
        ctx,
        {
          code: 30001,
          msg: '余额不足',
          command: 'server-stop',
        },
        { isEnd: true },
      );
      return;
    }

    const questionInfo = {
      type,
      questionId,
      answerId,
      questionText,
      subject,
      language,
      time,
      isForce,
      url,
      isImageSolve,
      isRetry,
      isReAnswer,
      instructions,
      solveMode,
      answerStyle,
      answerLanguage,
      answerType,
      mode: 'fast',
      userName,
      // 推荐问题类型，目前支持:html
      ilType,
      // dsl相关参数
      renderStyle,
      experimental,
      returnFullWhenDone,
      platform,
    };
    // 答案重新生成需要传入regenerateReason和fromAnswerId
    if (answerType === 'regeneration') {
      questionInfo.regenerateReason = regenerateReason;
      questionInfo.fromAnswerId = fromAnswerId;
      if (regenerateTag) {
        questionInfo.regenerateTag = regenerateTag;
      }
      if (regeneratePictureKeys) {
        questionInfo.regeneratePictureKeys = regeneratePictureKeys;
      }
    }

    if (type === 'photo') {
      const { processed, origin } = files[0];
      questionInfo.pictureKey = processed;
      questionInfo.uncroppedImgUrl = origin;
    } else if (url) {
      questionInfo.pictureKey = url;
    }

    // 如果传了mode，则使用传入的mode
    if (ctx.request.body.mode) {
      questionInfo.mode = ctx.request.body.mode;
    }

    // 开始解题
    await ctx.service.question.answerV2(ctx.user.uid, {
      questionInfo,
      consumptionType,
      isReload,
      useNewApi,
    });
  }
  /**
   * 匿名用户提交解题
   */
  async guestFastAdd() {
    const { ctx } = this;
    // 校验公共字段
    ctx.validate({
      deviceId: 'string',
      type: { type: 'enum', values: ['photo', 'text'] },
      mode: { type: 'enum', values: ctx.app.config.SOLVE_MODES.LIST },
      questionText: 'string?',
      subject: 'string?',
      language: 'string?',
      time: 'number?',
      url: 'url?',
      isImageSolve: 'boolean?',
      questionId: 'string?',
      instructions: 'string?',
      answerStyle: 'string?',
      answerLanguage: 'string?',
      answerType: 'string?',
      renderStyle: 'string?',
    });
    // 如果是图片，单独校验 files
    if (ctx.request.body.type === 'photo') {
      try {
        ctx.validate({
          files: {
            type: 'array',
            min: 1,
            itemType: 'object',
            rule: {
              processed: 'url',
              origin: 'url?',
            },
          },
        });
      } catch (err) {
        ctx.helper.streamResponse(
          ctx,
          { code: 30002, msg: 'Image is empty or invalid format', command: 'server-stop' },
          { isEnd: true },
        );
        return;
      }
    }

    const {
      deviceId,
      type,
      questionText,
      subject,
      language,
      time,
      url,
      isImageSolve,
      questionId: qid,
      instructions = '',
      answerStyle,
      answerLanguage,
      answerType = 'generation',
      answerId = '',
      experimental = '',
      files = [],
      renderStyle,
    } = ctx.request.body;

    // 校验匿名 deviceId 前缀
    const ANON_PREFIX = 'ANON_';
    if (!deviceId || typeof deviceId !== 'string' || !deviceId.startsWith(ANON_PREFIX)) {
      ctx.helper.streamResponse(
        ctx,
        { code: 30002, msg: 'Invalid anonymous deviceId', command: 'server-stop' },
        { isEnd: true },
      );
      return;
    }

    // 配额检查
    const quota = await ctx.service.question.checkAnonQuota(deviceId);
    if (!quota.approved) {
      ctx.helper.streamResponse(
        ctx,
        {
          code: quota.code || 30005,
          msg: quota.msg || 'Solve quota exhausted',
          command: 'server-stop',
        },
        { isEnd: true },
      );
      return;
    }

    // 构造 questionInfo（简化版）
    const solvelyTime = moment().valueOf();
    const questionId = qid || ctx.helper.generateQuestionId();
    const questionInfo = {
      type,
      questionId,
      questionText,
      subject,
      language,
      time,
      url,
      isImageSolve,
      instructions,
      answerStyle,
      answerLanguage,
      answerType,
      answerId,
      experimental,
      renderStyle,
      mode: 'fast',
      solveMode: 'fast',
    };
    // 处理图片 & OCR
    let lineDataTypes = [];
    if (type === 'photo') {
      const { processed, origin } = files[0];
      questionInfo.pictureKey = processed;
      questionInfo.uncroppedImgUrl = origin;
      const ocrResult = await ctx.service.question.ocr(
        questionInfo.pictureKey,
        questionInfo.questionId,
      );
      if (!ocrResult || _.isEmpty(ocrResult.data)) {
        ctx.service.point?.firebasePoint?.(deviceId, 'Web_OCR_Fail', {
          url: questionInfo.pictureKey,
        });
        ctx.helper.streamResponse(
          ctx,
          { code: 30002, msg: 'Image is empty or invalid format', command: 'server-stop' },
          { isEnd: true },
        );
        return;
      }
      const { line_data = [], text } = ocrResult.data || {};
      lineDataTypes = [...new Set(line_data.map((d) => d.type))];
      questionInfo.questionText = text;
      questionInfo.isImageSolve = ctx.helper.isImageQuestion(line_data);
    } else if (url) {
      questionInfo.pictureKey = url;
    }

    // 题意检查（必走）
    const checkQuestionResult = await ctx.service.common.checkQuestion({
      deviceId,
      questionId: questionInfo.questionId,
      questionText: questionInfo.questionText || '',
      imageUrl: questionInfo.pictureKey || '',
      lineDataTypes,
      instructions: questionInfo.instructions || '',
      platform: questionInfo.platform || 'web',
    });
    const { subject: checkedSubject, realSubject, questionCategory } = checkQuestionResult || {};
    questionInfo.subject = checkedSubject;
    questionInfo.realSubject = realSubject;

    // 分表模型
    const model = await ctx.helper._getModelByDeviceId(deviceId);
    // 入库（首次创建）
    await model.create({
      deviceId,
      questionId: questionInfo.questionId,
      questionText: questionInfo.questionText,
      pictureKey: questionInfo.pictureKey || '',
      language: questionInfo.language,
      subject: questionInfo.subject,
      modelName: 'gpt-4-stream',
      answerStatus: 1,
      solvelyTime,
      costType: 'unlimited',
      platform: 'web',
      renderStyle: questionInfo.renderStyle,
      solveCount: 1,
      lastSolveMode: ctx.app.config.SOLVE_MODES.FAST,
    });

    // 更新匿名计数
    await ctx.service.question.increaseAnonCounters(deviceId);

    // 调用微服务（v7 / v8）
    const shouldUseV8 = ctx.service.question.shouldUseV8Api(
      questionInfo.realSubject,
      questionCategory,
    );
    const requestUrl = `/solvelyPubServer/${shouldUseV8 ? 'v8' : 'v7'}/solveQuestion`;
    const params = {
      deviceId,
      questionId: questionInfo.questionId,
      questionText: questionInfo.questionText,
      platform: 'web',
      modelName: 'gpt-4-stream',
      subject: questionInfo.subject,
      language: questionInfo.language,
      isImageSolve: questionInfo.isImageSolve,
      pictureKey: questionInfo.pictureKey || '',
      uncroppedImgUrl: questionInfo.uncroppedImgUrl || '',
      instructions: questionInfo.instructions || '',
      answerId: questionInfo.answerId || '',
      answerStyle: questionInfo.answerStyle || '',
      answerLanguage: questionInfo.answerLanguage || '',
      answerType: questionInfo.answerType || 'generation',
      experimental: questionInfo.experimental || '',
      mode: 'fast',
      solveMode: 'fast',
      isFirstSolve: false,
      costType: 'unlimited',
      solveCount: 1,
      callbackUrl: this.app.config.questionWebhookURL,
      renderStyle: questionInfo.renderStyle,
    };
    if (!shouldUseV8) {
      params.experimental =
        (params.experimental ? params.experimental + ',' : '') +
        'TEST_Solver_iOSanswerMany_On,TEST_S_Humanities_social_sciences_MC_New,TEST_S_Sciences_Final_Answer_New';
    }
    await ctx.service.common.commonStreamRequest(requestUrl, params);
  }
  /**
   * 答案卡片隐藏
   */
  async hide() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/fast/answer/hide');
  }
  /**
   * 答案风格改写
   */
  async style() {
    const { ctx } = this;
    const { questionId, answerId, fromAnswerId, toStyle, renderStyle = '' } = ctx.request.body;
    const data = {
      deviceId: ctx.user.uid,
      questionId,
      answerId,
      fromAnswerId,
      toStyle,
    };
    // dsl走v6，其他走v1
    const urlVersion = renderStyle === 'single-dsl' ? 'v6' : 'v1';
    await ctx.service.common.commonStreamRequest(
      `/solvelyPubServer/${urlVersion}/question/fast/answer/convert`,
      data,
    );
  }
  /**
   * 答案语言改写
   */
  async language() {
    const { ctx } = this;
    const { questionId, answerId, fromAnswerId, toLanguage, renderStyle = '' } = ctx.request.body;
    const data = {
      deviceId: ctx.user.uid,
      questionId,
      answerId,
      fromAnswerId,
      toLanguage,
    };
    // dsl走v6，其他走v1
    const urlVersion = renderStyle === 'single-dsl' ? 'v6' : 'v1';
    await ctx.service.common.commonStreamRequest(
      `/solvelyPubServer/${urlVersion}/question/fast/answer/translate`,
      data,
    );
  }
  /**
   * 获取instruction列表
   */
  async instructionList() {
    const { size = 10 } = this.ctx.request.body;
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/instruction/query', {
      deviceId: this.ctx.user.uid,
      size,
    });
  }
  /**
   * 新增instruction
   */
  async instructionAdd() {
    const body = this.ctx.request.body;
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/instruction/add', {
      deviceId: this.ctx.user.uid,
      ...body,
    });
  }
  /**
   * 删除instruction
   */
  async instructionDelete() {
    const body = this.ctx.request.body;
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/instruction/del', {
      deviceId: this.ctx.user.uid,
      ...body,
    });
  }
  async startTask() {
    // ctx.service.fcm.push();
    // await ctx.service.question.startTask();
    const { ctx } = this;
    // const { uid } = ctx.query;
    // const token = this.app.jwt.sign(uid, this.app.config.jwt.secret);
    // const model = await ctx.helper._getModelByDeviceId(ctx.user.uid);

    // await model.update({ answerStatus: 2, isRetry: 1 }, {
    //   where: {
    //     deviceId: ctx.user.uid,
    //     questionId: '2024_01_06_5bae49ad-809c-4571-a625-e0b46a675333',
    //   },
    // });
    // const time = moment()
    //   .add(1, 'months')
    //   .startOf('days')
    //   .add(1, 'days')
    //   .valueOf();
    // console.log(time);

    // await ctx.service.point.firebasePoint(ctx.user.uid, 'xxx');
    // await ctx.service.point.firebasePoint(ctx.user.uid, 'Web_Solve_Success');
    // 解题成功
    // await ctx.service.point.adjustPoint(ctx.user.uid, 'kknp8z');
    // 充值
    // await ctx.service.point.adjustPoint(ctx.user.uid, 'l4gik0', { revenue: 0.99, currency: 'USD' });
    // await ctx.helper._getModelByDeviceId(ctx.query.id);
    ctx.body = 123;
  }
  async getKeywordsAndExplain() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/fast/keywords', {
      deviceId: this.ctx.user.uid,
    });
  }
  async keywordsFeedback() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/fast/keyword/feedback', {
      deviceId: this.ctx.user.uid,
    });
  }
  async totalCount() {
    const { ctx, app } = this;
    const commonHost = app.config.commonServiceConfig.host;
    try {
      const result = await ctx.curl(`${commonHost}/solvelyPubServer/v1/question/count`, {
        method: 'POST',
        data: {
          deviceId: ctx.user.uid,
        },
        contentType: 'json',
        dataType: 'json',
      });
      ctx.body = result.data;
    } catch (error) {
      ctx.body = {
        msg: '获取解题总数失败',
        data: {
          questionCount: 0,
        },
      };
    }
  }
}

module.exports = QuestionController;
