const { Service } = require('egg');
const _ = require('lodash');
const moment = require('moment');
const momentTz = require('moment-timezone');
const Op = require('sequelize').Op;

// 题目解题状态
const QUESTION_STATUS = Object.freeze({
  // 目前只有这三种状态
  success: 0, // 解题成功
  analyzing: 1, // 解题中
  // recognizeFail: 2, // OCR失败，目前还没有用到这个状态，因为解题失败的时候，会直接告诉前端
  gptFail: 3, // 解题失败，包括gpt解题失败
});

const MAX_QUESTION_COUNT = 15000;

const QUESTION_TIMEOUT = 7 * 60 * 1000;

const COST_TYPE_MAP = {
  unlimited: 'unlimited',
  balance: 'gems',
  fast: 'fastFreeCount',
  teach: 'gems',
  plugin: 'plugin',
};

class QuestionService extends Service {
  /**
   * 匿名用户解题配额检查
   * - 全站每日上限 10000（deviceId = 'GLOBAL'）
   * - 单设备每周累计上限 2
   * @param {string} deviceId 匿名设备ID
   * @param options
   * @return {Promise<{approved: boolean, code?: number, msg?: string}>}
   */
  async checkAnonQuota(deviceId, options = {}) {
    const { ctx } = this;
    const kind = options.kind || 'solve';
    try {
      const today = momentTz().tz('Asia/Shanghai').format('YYYY-MM-DD');

      if (kind === 'upload') {
        // 匿名上传：全站当日 + 设备当日 限制（固定每次调用记 1 次）
        const globalRow = await ctx.model.AnonSolveCounter.findOne({
          raw: true,
          attributes: ['uploadCnt'],
          where: { deviceId: 'GLOBAL', day: today },
        });
        const globalUploadCnt = globalRow?.uploadCnt || 0;
        const globalDailyUploadLimit = 10000;
        if (globalUploadCnt >= globalDailyUploadLimit) {
          return { approved: false, code: 30005, msg: 'Upload quota exhausted' };
        }

        const deviceRow = await ctx.model.AnonSolveCounter.findOne({
          raw: true,
          attributes: ['uploadCnt'],
          where: { deviceId, day: today },
        });
        const deviceUploadCnt = deviceRow?.uploadCnt || 0;
        const perDeviceDailyUploadLimit = _.get(
          ctx.app.config,
          'anonQuota.perDeviceDailyUploadLimit',
          2,
        );
        if (deviceUploadCnt >= perDeviceDailyUploadLimit) {
          return { approved: false, code: 30005, msg: 'Upload quota exhausted' };
        }
        return { approved: true };
      }

      // kind === 'solve'：保持原有逻辑不变
      // 全站每日上限
      const globalCountRow = await ctx.model.AnonSolveCounter.findOne({
        raw: true,
        attributes: ['cnt'],
        where: { deviceId: 'GLOBAL', day: today },
      });
      const globalCnt = globalCountRow?.cnt || 0;
      const globalDailySolveLimit = 10000;
      if (globalCnt >= globalDailySolveLimit) {
        return { approved: false, code: 30005, msg: 'Solve quota exhausted' };
      }

      // 设备本周累计 < 配置阈值（默认 2）
      const shanghaiNow = momentTz().tz('Asia/Shanghai');
      const weekStart = shanghaiNow.clone().startOf('isoWeek').format('YYYY-MM-DD');
      const weekEnd = shanghaiNow.clone().endOf('isoWeek').format('YYYY-MM-DD');
      const Op = ctx.app.Sequelize.Op;
      const weeklyTotal =
        (await ctx.model.AnonSolveCounter.sum('cnt', {
          where: {
            deviceId,
            day: { [Op.between]: [weekStart, weekEnd] },
          },
        })) || 0;
      const perDeviceWeeklySolveLimit = _.get(
        ctx.app.config,
        'anonQuota.perDeviceWeeklySolveLimit',
        2,
      );
      if (weeklyTotal >= perDeviceWeeklySolveLimit) {
        return { approved: false, code: 30005, msg: 'Solve quota exhausted' };
      }
      return { approved: true };
    } catch (e) {
      return { approved: false, code: 30005, msg: 'Solve quota exhausted' };
    }
  }

  /**
   * 匿名用户解题计数 +1（GLOBAL 与 deviceId 当天计数）
   * @param {string} deviceId 匿名设备ID
   * @param options
   */
  async increaseAnonCounters(deviceId, options = {}) {
    const { ctx } = this;
    const field = options.field || 'cnt';
    try {
      const today = momentTz().tz('Asia/Shanghai').format('YYYY-MM-DD');
      // GLOBAL
      await ctx.model.AnonSolveCounter.findOrCreate({
        where: { deviceId: 'GLOBAL', day: today },
        defaults: { deviceId: 'GLOBAL', day: today, cnt: 0, uploadCnt: 0 },
      });
      await ctx.model.AnonSolveCounter.increment(field, {
        by: 1,
        where: { deviceId: 'GLOBAL', day: today },
      });
      // deviceId
      await ctx.model.AnonSolveCounter.findOrCreate({
        where: { deviceId, day: today },
        defaults: { deviceId, day: today, cnt: 0, uploadCnt: 0 },
      });
      await ctx.model.AnonSolveCounter.increment(field, {
        by: 1,
        where: { deviceId, day: today },
      });
    } catch (e) {
      // 忽略计数失败，不影响主流程
    }
  }
  /**
   * 解题统计
   */
  async statistics() {
    const { ctx } = this;
    try {
      const model = await ctx.helper._getModelByDeviceId(ctx.user.uid);
      const total = await model.count({
        where: {
          deviceId: ctx.user.uid,
        },
      });
      const success = await model.count({
        where: {
          deviceId: ctx.user.uid,
          answerStatus: 0,
        },
      });
      const analyzing = await model.count({
        where: {
          deviceId: ctx.user.uid,
          answerStatus: 1,
        },
      });
      const fail = await model.count({
        where: {
          deviceId: ctx.user.uid,
          answerStatus: {
            [Op.not]: [0, 1],
          },
        },
      });
      return {
        total,
        analyzing,
        success,
        fail,
      };
    } catch (e) {
      return {
        total: 0,
        analyzing: 0,
        success: 0,
        fail: 0,
      };
    }
  }
  /**
   * 获取解题历史
   * @return {Object} 历史记录
   */
  async history() {
    const { ctx } = this;
    try {
      const { page = 1, pageSize = 20, answerStatus, more = 0 } = ctx.query;
      const offset = (page - 1) * pageSize;
      const model = await ctx.helper._getModelByDeviceId(ctx.user.uid);
      const where = {
        deviceId: ctx.user.uid,
        questionId: {
          [Op.ne]: null,
        },
      };
      if (answerStatus) {
        switch (answerStatus) {
          case 'completed':
            where.answerStatus = 0;
            break;
          case 'inprogress':
            where.answerStatus = 1;
            break;
          case 'unsolved':
            where[Op.and] = [
              {
                [Op.not]: {
                  answerStatus: [0, 1],
                },
              },
              {
                [Op.or]: [
                  {
                    [Op.and]: [
                      {
                        costType: {
                          [Op.or]: [{ [Op.like]: '%gems%' }, { [Op.like]: '%fastFreeCount%' }],
                        },
                      },
                      {
                        solveCount: 1,
                      },
                    ],
                  },
                  {
                    costType: 'unlimited',
                  },
                ],
              },
            ];
            break;
          case 'refunded':
            // teach不会返还次数（因为可以一直问，只要提交就消耗了），失败就失败了，只有fast返还
            where[Op.and] = [
              {
                [Op.not]: {
                  answerStatus: [0, 1],
                },
              },
              {
                [Op.and]: [
                  {
                    costType: {
                      [Op.or]: [{ [Op.like]: '%gems%' }, { [Op.like]: '%fastFreeCount%' }],
                    },
                  },
                  {
                    solveCount: {
                      [Op.gte]: 2,
                    },
                  },
                ],
              },
            ];
            break;
          default:
            break;
        }
      }
      const questionHistory = await model.findAll({
        // raw: true,
        attributes: [
          'questionId',
          'questionText',
          'pictureKey',
          'createTime',
          'updateTime',
          'answerStatus',
          'solveCount',
          'costType',
          'lastSolveMode',
        ],
        order: [['createTime', 'DESC']],
        offset,
        limit: parseInt(pageSize),
        where,
      });
      // 对比updateTime和当前时间的时间戳，如果大于7分钟，改变状态为失败
      const now = moment().valueOf();
      questionHistory.forEach((item) => {
        const { updateTime, answerStatus } = item;
        const timestamp = moment(updateTime).valueOf();
        if (now - timestamp > QUESTION_TIMEOUT && answerStatus === QUESTION_STATUS.analyzing) {
          item.answerStatus = QUESTION_STATUS.gptFail;
          // 数据库更新该数据
          model.update(
            { answerStatus: QUESTION_STATUS.gptFail },
            {
              where: {
                deviceId: ctx.user.uid,
                questionId: item.questionId,
              },
            },
          );
        }
      });
      // 是否需要同时查询追问
      let questionAskMoreList;
      if (more) {
        const askModel = await ctx.helper._getAnswerMoreModel(ctx.user.uid);
        questionAskMoreList = await askModel.findAll({
          raw: true,
          attributes: ['questionId', 'content'],
          where: {
            deviceId: ctx.user.uid,
            questionId: {
              [Op.in]: questionHistory.map((item) => item.questionId),
            },
            role: 2,
          },
        });
      }

      // 根据时间聚合，每天的数据放在一个数组里，key为时间戳
      const result = {};
      questionHistory.forEach((item) => {
        const date = moment(item.createTime).format('YYYY-MM-DD');
        const timestamp = moment(date).valueOf();
        if (!result[timestamp]) {
          result[timestamp] = [];
        }
        // 如果有追问，追问数据放在一个数组里
        if (more) {
          const askMore = questionAskMoreList.find(
            (ask) => ask.questionId === item.questionId && ask.content,
          );
          item.askMore = askMore && askMore.content;
        }
        if (item.pictureKey) {
          item.pictureKey = ctx.helper.handlePictureUrl(item.pictureKey, timestamp);
        }
        result[timestamp].push(item);
      });
      return result;
    } catch (error) {
      return [];
    }
  }
  /**
   * 获取解题详情
   * @param {Object} params 参数
   * @return {Object} 问题详情
   */
  async detail(params = {}) {
    const { ctx } = this;
    const { deviceId, questionId } = params;
    try {
      const question = await ctx.service.common.getQuestionDetail(deviceId, questionId);
      if (_.isEmpty(question)) {
        return {};
      }
      question.updateTime = moment(question.updateTime).valueOf();
      const now = moment().valueOf();
      if (
        question.answerStatus === QUESTION_STATUS.analyzing &&
        now - question.updateTime > QUESTION_TIMEOUT
      ) {
        question.answerStatus = QUESTION_STATUS.gptFail;
      }
      if (question.solveCount > 2) {
        const feedbackAnswerCount = await ctx.model.QuestionFeedbackRetry.count({
          where: {
            deviceId,
            questionId,
          },
        });
        question.feedbackAnswerCount = feedbackAnswerCount || 0;
      }
      // 统一处理图片url路径
      if (question.pictureKey) {
        const timestamp = moment(question.createTime).valueOf();
        question.pictureKey = ctx.helper.handlePictureUrl(question.pictureKey, timestamp);
      }
      return question;
    } catch (error) {
      return {};
    }
  }
  /**
   * @param {object} params 要更新的字段和值
   * @param {object} whereClause where子句，为更新指定条件
   *   1. 可以直接不带`where`传 { deviceId, questionId }
   *   2. 可以带`where`传 { where: { ... } }
   */
  async updateInfo(params = {}, whereClause) {
    const { ctx } = this;
    const hasWhere = _.has(whereClause, 'where');
    const deviceId = hasWhere ? whereClause.where.deviceId : whereClause.deviceId;
    // 查询model，如果没有传deviceId，使用ctx.user.uid兜底
    const model = await ctx.helper._getModelByDeviceId(deviceId || ctx.user.uid);
    return await model.update(params, hasWhere ? whereClause : { where: whereClause });
  }
  /**
   * 获取解题详情
   * @param {Object} params 参数
   * @return {Object} 问题详情
   */
  async info(params = {}) {
    const { ctx } = this;
    const { deviceId, questionId } = params;
    try {
      const model = await ctx.helper._getModelByDeviceId(deviceId);
      const question = await model.findOne({
        // raw: true,
        where: {
          questionId,
          deviceId,
        },
      });
      return question || {};
    } catch (error) {
      return {};
    }
  }
  /**
   * 赞/踩
   */
  async like() {
    const { ctx } = this;
    try {
      const { questionId } = ctx.params;
      const { like, answerId } = ctx.request.body;
      const deviceId = ctx.user.uid;
      const model = await ctx.helper._getModelByDeviceId(deviceId);
      if (answerId) {
        ctx.service.common.likeAnswer({
          deviceId,
          questionId,
          answerId,
          feedback: like,
        });
      } else {
        model.update(
          { feedBack: like },
          {
            where: {
              deviceId,
              questionId,
            },
          },
        );
      }
      ctx.service.common.saveQuestionInfoToBq(
        {
          eventName: 'feedback',
          platform: 'web',
          questionId,
          deviceId,
          answerId,
          feedback: +like,
        },
        'Solvely',
        'ServerEventTracking',
      );
    } catch (e) {
      ctx.throw(new Error(`赞/踩失败: ${e}`));
    }
  }
  /**
   * 踩完feedback
   */
  async feedback() {
    const { ctx } = this;
    try {
      const { questionId, answerId, title, content } = ctx.request.body;
      const deviceId = ctx.user.uid;
      // 如果有图片，校验图片格式为jpg或png
      if (ctx.request.files.length > 0) {
        const files = ctx.request.files;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const { mimeType } = file;
          if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
            return {
              code: 30002,
              msg: '图片格式错误',
            };
          }
        }
      }
      const model = await ctx.helper._getModelByDeviceId(deviceId);
      if (answerId) {
        ctx.service.common.likeAnswer({
          deviceId,
          questionId,
          answerId,
          feedback: 2,
        });
      } else {
        await model.update(
          { feedBack: 2 },
          {
            where: {
              deviceId,
              questionId,
            },
          },
        );
      }
      // ctx.request.files的所有图片图片上传到s3
      const files = ctx.request.files;
      const pictureKeys = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const pictureKey = await ctx.service.question.uploadPictureToS3('', file);
        pictureKeys.push(pictureKey);
      }
      // 保存反馈信息
      await ctx.model.UserFeedback.create({
        deviceId,
        questionId,
        title,
        description: content,
        appVersion: ctx.app.config.version,
        system: 'web',
        imageUrls: JSON.stringify(pictureKeys),
      });
      ctx.service.common.saveQuestionInfoToBq(
        {
          eventName: 'feedbackDetail',
          platform: 'web',
          questionId,
          answerId,
          imageUrls: JSON.stringify(pictureKeys),
          deviceId,
          title,
          description: content,
          feedback: 2,
        },
        'Solvely',
        'ServerEventTracking',
      );
      return {
        code: 0,
      };
    } catch (e) {
      ctx.throw(new Error(`反馈失败: ${e}`));
      return {
        code: -1,
        msg: '反馈失败',
      };
    }
  }
  /**
   * 开始解题
   * @param {string} type 解题类型: photo, text, ''  为空时为重试
   * @param {string} mode 解题模式: teach - 问答模式（ask tutor）, fast - 直接给答案模式（instant solution）
   * @param {object} questionInfo 问题信息
   * @param {boolean} isRetry 是否是重试解题
   * @param {string} consumptionType 消耗类型 unlimited/balance/fast/teach
   * @param {number} completedRetry 是否为负反馈解题 1: 是 0: 否
   * @param {boolean} isForce 是否强制解题。第一次提交解题，题意不全，再次提交为true
   */
  async answer(
    type,
    mode,
    questionInfo,
    isRetry = false,
    consumptionType = '',
    completedRetry = 0,
    isForce = false,
  ) {
    const { ctx } = this;
    const solvelyTime = moment().valueOf();
    questionInfo.modelName = 'gpt-4-stream';
    questionInfo.platform = 'web';
    const user = await ctx.service.user.find();
    questionInfo.pushToken = user.webPushToken;
    let isFirstSolveQuestion = false; // 是否首次解题
    const model = await ctx.helper._getModelByDeviceId(ctx.user.uid);
    let lineDataTypes = [];
    if (type === 'photo') {
      // 目前只允许传一张图片
      const { processed, origin } = ctx.request.body.files[0];
      questionInfo.pictureKey = processed;
      questionInfo.uncroppedImgUrl = origin;

      // ocr识别图片
      const result = await ctx.service.question.ocr(questionInfo.pictureKey);
      if (!result || _.isEmpty(result.data)) {
        // return {
        //   code: 30003,
        //   msg: '图片识别异常',
        // };
        const pointData = {
          url: questionInfo.pictureKey,
        };
        questionInfo.uncroppedImgUrl && (pointData.originUrl = questionInfo.uncroppedImgUrl);
        ctx.service.point.firebasePoint(ctx.user.uid, 'Web_OCR_Fail', pointData);
        ctx.throw(new Error('图片识别异常'));
      }
      const { request_id: id, text, line_data = [] } = result.data || {};
      questionInfo.questionId = id;
      questionInfo.questionText = text;
      questionInfo.isImageSolve = ctx.helper.isImageQuestion(line_data);
      lineDataTypes = [...new Set(line_data.map((data) => data.type))];
    } else {
      /**
       * 走到这里有两种情况：
       * 1. 正常文字解题（即正常/question/text调用)；
       * 2. 题意检查失败后，第二次解题会调用/question/text。
       */
      const { url, isImageSolve } = ctx.request.body;

      if (url) {
        questionInfo.pictureKey = url;
      }
      // 考虑到 `isImageSolve` 值可能为false，所以不能直接 if(isImageSolve) 判断
      if (isImageSolve !== undefined) {
        questionInfo.isImageSolve = isImageSolve;
      }
    }
    // 非重试&fast模式&非强制解题，检查题意是否清晰
    if (!isRetry && mode === 'fast' && !isForce) {
      // 检查题意
      const { checkQuestion } = await ctx.service.common.checkQuestion({
        deviceId: ctx.user.uid,
        questionId: questionInfo.questionId,
        questionText: questionInfo.questionText || '',
        imageUrl: questionInfo.pictureKey || '',
        lineDataTypes,
        instructions: questionInfo.instructions || '',
      });
      if (!checkQuestion) {
        return {
          code: 30004,
          msg: '题意不清晰',
          data: {
            questionId: questionInfo.questionId,
            questionText: questionInfo.questionText,
            url: questionInfo.pictureKey,
            isImageSolve: questionInfo.isImageSolve,
            instructions: questionInfo.instructions || '',
          },
        };
      }
    }

    const costType = COST_TYPE_MAP[consumptionType] || '';
    if (consumptionType === 'unlimited') {
      // unlimited订阅计次
      const questionCount = await ctx.service.question.addCount();
      if (!questionCount) {
        return {
          code: 30005,
          msg: '解题次数已用完',
        };
      }
    }
    // 检查是否需要消耗钻石/次数
    if (!isRetry && consumptionType !== 'unlimited') {
      await ctx.service.balance.updateDiamond(ctx.user.uid, {
        [consumptionType]: consumptionType === 'balance' ? -10 : -1,
      });
    }

    const {
      subject,
      language,
      questionId,
      questionText,
      pushToken,
      modelName,
      pictureKey = '',
    } = questionInfo;

    if (isRetry) {
      const question = await model.findOne({
        raw: true,
        where: {
          deviceId: ctx.user.uid,
          questionId,
        },
      });
      // 更新解题状态
      const updateData = {
        answerStatus: QUESTION_STATUS.analyzing,
        solveCount: +question.solveCount + 1,
        solvelyTime,
      };
      if (completedRetry === 1) {
        updateData.feedBack = -1;
      }
      await model.update(updateData, {
        where: {
          deviceId: ctx.user.uid,
          questionId,
        },
      });
      questionInfo = {
        ...question,
        ...updateData,
      };
      if (questionInfo.pictureKey) {
        // 有图片，重试的时候重新ocr判断是否图片题
        const result = await ctx.service.question.ocr(questionInfo.pictureKey);
        const { line_data = [] } = result.data || {};
        questionInfo.isImageSolve = ctx.helper.isImageQuestion(line_data);
      }
    } else {
      isFirstSolveQuestion = await this.isFirstSolveQuestion(ctx.user.uid);
      // 创建题目 注意：mode属性并没有插入`question`表，而是传给public，public把mode存入mongo
      await model.create({
        deviceId: ctx.user.uid,
        subject,
        answer: '',
        language,
        solvelyTime,
        questionId,
        questionText,
        answerStatus: QUESTION_STATUS.analyzing,
        pushToken,
        questionTag: 0,
        modelName,
        pictureKey,
        costType,
        platform: 'web',
      });
    }
    questionInfo.isFirstSolve = isFirstSolveQuestion;
    // 是否首次解题埋点
    if (isFirstSolveQuestion) {
      ctx.service.point.firebasePoint(ctx.user.uid, 'Web_First_Solve_Question', {
        questionId: questionInfo.questionId,
      });
    }
    // 把题目发送给public，由public回答问题 把mode透传
    await ctx.service.question.answerQuestion(
      questionInfo,
      mode,
      isRetry,
      costType,
      completedRetry,
    );
    // 不管public的返回，直接把生成的questionId发返回给前端，由前端拿着questionId每3秒轮询查/question/status接口，当返回的状态为解题中时
    // 前端在去请求流式解题接口/question/tutor/:deviceId/:questionId/stream
    return {
      code: 0,
      data: {
        questionId,
      },
    };
  }

  /**
   * 非黑5unlimited增加解题次数
   */
  async addCount() {
    const { ctx } = this;
    try {
      const userSolveCount = await ctx.model.SolveQuestionReqCount.findOne({
        raw: true,
        where: {
          deviceId: ctx.user.uid,
        },
      });
      if (_.isEmpty(userSolveCount)) {
        await ctx.model.SolveQuestionReqCount.create({
          deviceId: ctx.user.uid,
          frequency: 1,
        });
      } else {
        // 此用户当前订阅周期内所有的unlimited解题次数
        // 此次数等于用户所有在question表中的solveCount之和
        if (userSolveCount.frequency >= MAX_QUESTION_COUNT) {
          return false;
        }
        await ctx.model.SolveQuestionReqCount.update(
          { frequency: userSolveCount.frequency + 1 },
          {
            where: {
              deviceId: ctx.user.uid,
            },
          },
        );
      }
      return true;
    } catch (e) {
      ctx.throw(new Error(`增加解题次数失败: ${e}`));
    }
  }
  /**
   * 重试解题，仅限fast模式
   */
  async retry() {
    const { ctx } = this;
    const { questionId } = ctx.params;
    const { completedRetry = 0, mode } = ctx.request.body || {};
    const questionInfo = {
      questionId,
    };
    await ctx.service.question.answer('', mode, questionInfo, true, '', completedRetry);
    if (completedRetry === 1) {
      const questionFeedbackRetryCount = await ctx.model.QuestionFeedbackRetry.count({
        where: {
          deviceId: ctx.user.uid,
          questionId,
        },
      });
      if (!questionFeedbackRetryCount) {
        ctx.service.question.saveQuestionToRetry(ctx.user.uid, questionId);
      }
    }
    // 删除questionAskMore表中的追问
    const askModel = await ctx.helper._getAnswerMoreModel(ctx.user.uid);
    askModel.destroy({
      where: {
        deviceId: ctx.user.uid,
        questionId,
      },
    });
  }
  /**
   * 上传图片到s3
   * @param {String} key key
   * @param {File} f 图片文件
   * @return {String} 图片url
   */
  async uploadPictureToS3(key = '', f) {
    const { ctx } = this;
    const file = f || ctx.request.files[0];
    const url = await ctx.helper.uploadPictureS3(file, key);
    return url;
  }
  /**
   * 调用微服务获取ocr结果
   * @param {String} imageSrc 图片url
   * @param {String} questionId 题目id
   */
  async ocr(imageSrc = '', questionId = '') {
    const { ctx, app } = this;
    try {
      const options = {
        dataType: 'json',
        method: 'POST',
      };
      options.headers = {
        'Content-Type': 'application/json',
      };
      options.data = {
        imageSrc,
        questionId,
      };
      const commonHost = app.config.commonServiceConfig.host;
      const result = await ctx.curl(`${commonHost}/solvelyPubServer/recognition/v1`, options);
      return result.data || false;
    } catch (e) {
      return false;
    }
  }
  /**
   * @description 把题目信息推送给public，开始解答问题
   * @param {object} questionInfo 问题信息
   * @param {string} mode 解题模式: teach - 问答模式（ask tutor）, fast - 直接给答案模式（instant solution），透传给public
   * @param {boolean} isRetry 是否是重试
   * @param {string} costType 消耗类型
   * @param {Number} completedRetry 是否为负反馈解题 1: 是 0: 否
   */
  async answerQuestion(questionInfo, mode, isRetry = false, costType = 'gems', completedRetry = 0) {
    const { ctx, app } = this;
    try {
      const commonHost = app.config.commonServiceConfig.host;
      const questionWebhookURL = app.config.questionWebhookURL;
      const cid = ctx.helper.getGaId();
      let nickName = '';
      try {
        const userInfo = await ctx.service.user.findUser(ctx.user.uid);
        nickName = userInfo.userName;
      } catch (e) {
        // 获取userName失败
      }
      const data = {
        deviceId: ctx.user.uid,
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
        isFirstSolve: questionInfo.isFirstSolve,
        nickName,
        mode, // 透传给public，由那边存入mongo
        callbackUrl: questionWebhookURL,
        // public那边判断有meteData的话，则是首次解题；没有，就是获取流式答题。
        mateData: {
          isRetry,
          costType,
          cid,
          completedRetry,
          startTime: moment().valueOf(),
        },
      };
      await ctx.curl(`${commonHost}/solvelyPubServer/solveQuestion/v2`, {
        method: 'POST',
        contentType: 'json',
        headers: {
          platform: 'web',
        },
        data,
      });
    } catch (e) {
      ctx.throw(new Error(`微服务解题失败: ${e}`));
    }
  }
  /**
   * @param {String} deviceId 用户id
   * @param {String} questionId 题目id
   * @description 获取当前题目转存到questionFeedbackRetry表中，没有特殊的业务用处，只是记录下重试题目的信息而已，以供产品/运营/技术分析使用
   */
  async saveQuestionToRetry(deviceId, questionId) {
    const { ctx } = this;
    const model = await this.ctx.helper._getModelByDeviceId(deviceId);
    const questionInfo = await model.findOne({
      raw: true,
      where: {
        deviceId,
        questionId,
      },
    });
    await ctx.model.QuestionFeedbackRetry.create({
      deviceId,
      questionId,
      questionText: questionInfo.questionText,
      pictureKey: questionInfo.pictureKey,
      answer: questionInfo.answer,
      feedBack: questionInfo.feedBack,
      language: questionInfo.language,
      subject: questionInfo.subject,
      promptToken: questionInfo.promptToken,
      completionToken: questionInfo.completionToken,
      answerStatus: questionInfo.answerStatus,
      solvelyTime: questionInfo.solvelyTime,
      taskType: questionInfo.taskType,
      pushToken: questionInfo.pushToken,
      questionTag: questionInfo.questionTag,
      modelName: questionInfo.modelName,
      solveCount: questionInfo.solveCount,
      costType: questionInfo.costType,
      platform: questionInfo.platform,
    });
  }
  /**
   * 解题V2版本，提交解题后直接发起流式请求
   * @param {String} deviceId 用户id
   * @param {Object} params 解题参数
   * @param {Object} params.questionInfo 问题信息
   * @param {String} params.consumptionType 消耗类型
   * @param params.isReload
   * @param params.useNewApi
   */
  async answerV2(deviceId, { questionInfo, consumptionType, isReload, useNewApi }) {
    const { ctx } = this;
    const solvelyTime = moment().valueOf();
    questionInfo.modelName = 'gpt-4-stream';
    let isFirstSolveQuestion = false; // 是否首次解题
    if (!questionInfo.platform) {
      questionInfo.platform = 'web';
    }
    const user = await ctx.service.user.find();
    // TODO: 待优化，前端传过来，从userStroe中取出来
    questionInfo.pushToken = user.webPushToken;
    const model = await ctx.helper._getModelByDeviceId(deviceId);
    let lineDataTypes = [];
    let checkQuestionResult = null;
    if (questionInfo.type === 'photo') {
      const ocrResult = await this.ocr(questionInfo.pictureKey, questionInfo.questionId);
      if (!ocrResult || _.isEmpty(ocrResult.data)) {
        const pointData = {
          url: questionInfo.pictureKey,
          questionId: questionInfo.questionId,
          mode: questionInfo.mode,
        };
        questionInfo.uncroppedImgUrl && (pointData.originUrl = questionInfo.uncroppedImgUrl);
        ctx.service.point.firebasePoint(deviceId, 'Web_OCR_Fail', pointData);
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
      const { line_data = [], text, request_id: id } = ocrResult.data || {};
      lineDataTypes = [...new Set(line_data.map((data) => data.type))];
      // questionInfo.questionId = id;
      questionInfo.questionText = text;
      questionInfo.isImageSolve = ctx.helper.isImageQuestion(line_data);
      ctx.service.point.firebasePoint(deviceId, 'Web_OCR_Success', {
        url: questionInfo.pictureKey,
        questionId: questionInfo.questionId,
        id,
        lineDataTypes,
        originUrl: questionInfo.uncroppedImgUrl,
        mode: questionInfo.mode,
      });
    }

    if (
      !questionInfo.isRetry &&
      ['fast', 'plugin'].includes(questionInfo.mode) &&
      !questionInfo.isForce
    ) {
      const isPluginSolve = questionInfo.mode === 'plugin';
      // 检查题意
      checkQuestionResult = await ctx.service.common.checkQuestion({
        deviceId,
        questionId: questionInfo.questionId,
        questionText: questionInfo.questionText || '',
        imageUrl: questionInfo.pictureKey || '',
        lineDataTypes,
        instructions: questionInfo.instructions || '',
        platform: questionInfo.platform,
        experimental: 'TEST_P_Algo_AIOJ_0609',
      });

      const { checkQuestion, subject, realSubject } = checkQuestionResult;

      if (!isPluginSolve && !checkQuestion && !useNewApi) {
        /**
         * 非插件解题，题意不清晰，返回错误
         */
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30004,
            msg: '题意不清晰',
            command: 'server-stop',
            data: {
              questionId: questionInfo.questionId,
              questionText: questionInfo.questionText,
              url: questionInfo.pictureKey,
              isImageSolve: questionInfo.isImageSolve,
              instructions: questionInfo.instructions || '',
            },
          },
          { isEnd: true },
        );
        return;
      }

      questionInfo.subject = subject;
      questionInfo.realSubject = realSubject;
    }

    const hasQuestion = await model.findOne({
      where: {
        deviceId,
        questionId: questionInfo.questionId,
      },
    });

    /**
     * 如果题目不存在，且不是打断重试，且不是打断重试，则扣钻
     */
    if ((!hasQuestion && !questionInfo.isRetry && !isReload) || questionInfo.isReAnswer) {
      // 设置消费类型
      questionInfo.costType = COST_TYPE_MAP[consumptionType] || '';

      // 处理不同的消费方式
      if (consumptionType === 'unlimited') {
        // unlimited订阅用户检查剩余次数
        const hasRemainingCount = await ctx.service.question.addCount();
        if (!hasRemainingCount) {
          ctx.helper.streamResponse(
            ctx,
            {
              code: 30005,
              msg: '解题次数已用完',
              command: 'server-stop',
            },
            { isEnd: true },
          );
          return;
        }
      } else {
        // 非订阅用户扣除钻石/次数
        const deductAmount = consumptionType === 'balance' ? -10 : -1;
        await ctx.service.balance.updateDiamond(deviceId, {
          [consumptionType]: deductAmount,
        });
      }

      if (!questionInfo.isReAnswer) {
        // 是否首次解题
        isFirstSolveQuestion = await this.isFirstSolveQuestion(deviceId);
        questionInfo.isFirstSolve = isFirstSolveQuestion;
        // 是否首次解题埋点
        if (isFirstSolveQuestion) {
          ctx.service.point.firebasePoint(ctx.user.uid, 'Web_First_Solve_Question', {
            questionId: questionInfo.questionId,
            mode: questionInfo.mode,
          });
        }

        // 创建新题目记录
        await model.create({
          ...questionInfo,
          deviceId,
          answerStatus: 1,
          solvelyTime,
        });
      }
    }

    // 解题次数
    let solveCount = 1;

    // 如果是重试，+1，且更新
    if (hasQuestion) {
      solveCount += 1;
      // mysql解题次数+1
      model.update(
        {
          solveCount,
          solvelyTime,
        },
        {
          where: {
            deviceId,
            questionId: questionInfo.questionId,
          },
        },
      );
    }
    const params = {
      ...questionInfo,
      costType: COST_TYPE_MAP[consumptionType],
      solveCount,
      deviceId,
      callbackUrl: this.app.config.questionWebhookURL,
    };
    let requestUrl = `/solvelyPubServer/v${params.renderStyle?.includes('dsl') ? 6 : 3}/solveQuestion`;
    if (useNewApi) {
      const isV8 = this.shouldUseV8Api(
        checkQuestionResult?.realSubject,
        checkQuestionResult?.questionCategory,
      );
      if (!isV8) {
        params.experimental =
          (params.experimental ? params.experimental + ',' : '') +
          'TEST_Solver_iOSanswerMany_On,TEST_S_Humanities_social_sciences_MC_New,TEST_S_Sciences_Final_Answer_New';
      }

      // 过滤掉 TEST_S_Web_PluginSpeed_On
      if (params.experimental) {
        const experimentalArray = params.experimental
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item && item !== 'TEST_S_Web_PluginSpeed_On');
        params.experimental = experimentalArray.length > 0 ? experimentalArray.join(',') : '';
      }

      requestUrl = `/solvelyPubServer/${isV8 ? 'v8' : 'v7'}/solveQuestion`;
    }
    await ctx.service.common.commonStreamRequest(requestUrl, params);
  }
  /**
   * 判断是否使用 v8 API
   * @param {string} realSubject 真实学科分类
   * @param {string} questionCategory 题目类型分类
   * @return {boolean} 是否使用 v8 API
   */
  shouldUseV8Api(realSubject, questionCategory) {
    // 文科选择题判断条件
    // https://pf6xrzskv9.feishu.cn/wiki/C1hYw7pf6ipiryka9YAcfdYgnzg
    const validCategories = ['multiple_choice', 'true_false', 'multiple_selections'];
    return (
      realSubject === 'humanities & social sciences' && validCategories.includes(questionCategory)
    );
  }
  /**
   * 查询用户是否首次解题
   * @param {string} deviceId 用户id
   * @return {boolean} 是否首次解题
   */
  async isFirstSolveQuestion(deviceId) {
    const { ctx } = this;
    try {
      const model = await ctx.helper._getModelByDeviceId(deviceId);
      const result = await model.findOne({
        where: { deviceId },
        attributes: ['id'],
      });
      return !result;
    } catch (e) {
      return false;
    }
  }
}

module.exports = QuestionService;
