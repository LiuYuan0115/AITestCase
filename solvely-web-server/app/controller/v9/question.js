'use strict';

const _ = require('lodash');

const { languageMapKeys } = require('../../common/i18n');
const BaseController = require('./BaseController');

class questionController extends BaseController {
  /**
   * 解题入口
   */
  async questionSolve() {
    const { ctx } = this;
    const validateMap = {
      // 基础信息
      questionId: 'string',
      answerId: 'string',
      // 题目信息
      questionText: 'string?',
      instructions: 'string?',
      pictureKey: 'string?',
      // 答案配置
      answerLanguage: { type: 'enum', required: true, values: languageMapKeys },
      answerStyle: 'string',
      // 用户实验组
      experimental: 'string?',
      // 判断是否是因为内容不完整的二次请求
      isResumingQuestion: 'string?',
      displayModelId: 'string?',
    };

    const deviceId = ctx.user.uid;
    const platform = ctx.header['x-solvely-platform'];
    const { consumptionType, approved } = await ctx.service.balance.checkBalance(
      deviceId,
      platform,
    );
    if (!approved) {
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

    try {
      ctx.validate(validateMap, ctx.request.body);

      // 验证题目信息不能为空
      const bodyParams = _.pick(ctx.request.body, Object.keys(validateMap));
      bodyParams.isResumingQuestion = bodyParams.isResumingQuestion === 'true';

      // 二次业务验证
      const { questionText, isResumingQuestion, pictureKey } = bodyParams;
      if (_.isEmpty(pictureKey) && _.isEmpty(questionText)) {
        throw new Error('题目信息不能为空');
      }
      if (pictureKey && !_.isEmpty(questionText)) {
        throw new Error('题目信息和文件不能同时存在');
      }
      if (isResumingQuestion && _.isEmpty(questionText)) {
        throw new Error('继续解题，题目信息不能为空');
      }
      if (isResumingQuestion && pictureKey) {
        throw new Error('继续解题，文件不能存在');
      }

      //
      ctx.__logger__.info('[controller] questionSolve start');
      const questionInfo = {
        ...bodyParams,
        answerType: 'generation',
        renderStyle: 'v9',
        /**
         * v9 之后，为了避免和 solveMode 混淆，使用 costType 来表示具体使用货币
         * public 一直使用的都是 costType
         */
        costType: consumptionType === 'unlimited' ? 'unlimited' : 'gems',
      };
      ctx.__updateQuestionInfo(questionInfo);
      ctx.__trackServerEvent({
        eventName: 'questionSolveInit',
        finalAnswer: ctx.helper.JsonUtils.safeStringifyJson({
          header: ctx.header,
          body: ctx.request.body,
          bodyParams,
          questionInfo,
        }),
      });
    } catch (error) {
      return this.errorV2(error, 400);
    }

    // 执行解题
    try {
      // 非订阅用户扣除钻石/次数
      if (consumptionType !== 'unlimited') {
        const deductAmount = consumptionType === 'balance' ? -10 : -1;
        await ctx.service.balance.updateDiamond(deviceId, {
          [consumptionType]: deductAmount,
        });
      }
      await ctx.service.v9.question.questionSolve();
    } catch (error) {
      this.errorV2(error, 400);
    } finally {
      ctx.__logger__.info('[controller] questionSolve end');
      if (!ctx.res.writableEnded) {
        ctx.res.end();
      }

      const { rotateFiles = [] } = ctx.__question_info__;
      this.deleteFiles(rotateFiles);
    }
  }

  /**
   * 重解入口
   */
  async questionReSolve() {
    const { ctx } = this;
    //
    const validateMap = {
      questionId: 'string',
      answerId: 'string',
      fromAnswerId: 'string',
      answerLanguage: 'string',
      answerStyle: 'string',
      experimental: 'string?',
      solveModel: { type: 'enum', required: true, values: ['gems', 'unlimited'] },
      // 重解增强
      regenerateReason: 'string?',
      regenerateTag: 'string?',
      regeneratePictureKeys: {
        type: 'array',
        required: false,
        allowEmpty: true,
        itemType: 'string',
      },
    };
    try {
      ctx.validate(validateMap, ctx.request.body);
    } catch (error) {
      return this.errorV2(error, 400);
    }

    try {
      ctx.__logger__.info('[controller] questionReSolve start');
      const bodyParams = _.pick(ctx.request.body, Object.keys(validateMap));

      //
      const questionInfo = {
        ...bodyParams,
        answerType: 'regeneration',
        renderStyle: 'v9',
        /**
         * v9 之后，为了避免和 solveMode 混淆，使用 costType 来表示具体使用货币
         * public 一直使用的都是 costType
         */
        costType: bodyParams.solveModel,
      };
      ctx.__updateQuestionInfo(questionInfo);
      ctx.__trackServerEvent({
        eventName: 'questionReSolveInit',
        finalAnswer: ctx.helper.JsonUtils.safeStringifyJson({
          header: ctx.header,
          body: ctx.request.body,
          bodyParams,
          questionInfo,
        }),
      });

      await ctx.service.v9.question.questionReSolve();
    } catch (error) {
      this.errorV2(error, 400);
    } finally {
      ctx.__logger__.info('[controller] questionReSolve end');
      if (!ctx.res.writableEnded) {
        ctx.res.end();
      }
    }
  }

  /**
   * 指定模型解题入口
   */
  async questionModelSolve() {
    const { ctx } = this;
    //
    const validateMap = {
      questionId: 'string',
      answerId: 'string',
      answerLanguage: 'string',
      answerStyle: 'string',
      experimental: 'string?',
      // 指定模型增强
      displayModelId: 'string',
    };
    try {
      ctx.validate(validateMap, ctx.request.body);
    } catch (error) {
      return this.errorV2(error, 400);
    }

    try {
      ctx.__logger__.info('[controller] questionModelSolve start');
      const bodyParams = _.pick(ctx.request.body, Object.keys(validateMap));
      const platform = ctx.header['x-solvely-platform'];

      const { consumptionType } = await ctx.service.balance.checkBalance(ctx.user.uid, platform);

      const questionInfo = {
        ...bodyParams,
        answerType: 'regeneration',
        renderStyle: 'v9',
        /**
         * v9 之后，为了避免和 solveMode 混淆，使用 costType 来表示具体使用货币
         * public 一直使用的都是 costType
         */
        costType: consumptionType === 'unlimited' ? 'unlimited' : 'gems',
      };
      ctx.__updateQuestionInfo(questionInfo);
      await ctx.service.v9.question.questionModelSolve();
    } catch (error) {
      this.errorV2(error, 400);
    } finally {
      ctx.__logger__.info('[controller] questionModelSolve end');
      if (!ctx.res.writableEnded) {
        ctx.res.end();
      }
    }
  }

  /**
   * 匿名用户解题入口
   * 说明：使用 headerValidation middleware，deviceId 从 header 的 x-solvely-device-id 获取
   *      其他系统信息也从 header 获取，保持与原接口约定一致
   */
  async guestQuestionSolve() {
    const { ctx } = this;
    const validateMap = {
      // 基础信息
      questionId: 'string',
      answerId: 'string',
      // 题目信息
      questionText: 'string?',
      instructions: 'string?',
      pictureKey: 'string?',
      // 答案配置
      answerLanguage: { type: 'enum', required: true, values: languageMapKeys },
      answerStyle: 'string',
      // 用户实验组
      experimental: 'string?',
      // 判断是否是因为内容不完整的二次请求
      isResumingQuestion: 'string?',
      displayModelId: 'string?',
    };

    // 从 ctx.__question_info__ 获取 deviceId（由 headerValidation middleware 设置）
    const deviceId = ctx.__question_info__.deviceId;

    try {
      // 验证 deviceId 前缀
      const ANON_PREFIX = 'ANON_';
      if (!deviceId || typeof deviceId !== 'string' || !deviceId.startsWith(ANON_PREFIX)) {
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30002,
            msg: 'Invalid anonymous deviceId',
            command: 'server-stop',
          },
          { isEnd: true },
        );
        return;
      }

      // 设置 ctx.user.uid，使后续流程（如 addCount）能正常工作
      ctx.user = ctx.user || {};
      ctx.user.uid = deviceId;

      // 配额检查（替代 checkBalance）
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

      ctx.validate(validateMap, ctx.request.body);

      // 验证题目信息不能为空
      const bodyParams = _.pick(ctx.request.body, Object.keys(validateMap));
      bodyParams.isResumingQuestion = bodyParams.isResumingQuestion === 'true';

      // 二次业务验证
      const { questionText, isResumingQuestion, pictureKey } = bodyParams;
      if (_.isEmpty(pictureKey) && _.isEmpty(questionText)) {
        throw new Error('题目信息不能为空');
      }
      if (pictureKey && !_.isEmpty(questionText)) {
        throw new Error('题目信息和文件不能同时存在');
      }
      if (isResumingQuestion && _.isEmpty(questionText)) {
        throw new Error('继续解题，题目信息不能为空');
      }
      if (isResumingQuestion && pictureKey) {
        throw new Error('继续解题，文件不能存在');
      }

      ctx.__logger__.info('[controller] guestQuestionSolve start');

      // 设置题目信息（deviceId 已由 headerValidation 设置）
      const questionInfo = {
        ...bodyParams,
        answerType: 'generation',
        renderStyle: 'v9',
        costType: 'unlimited', // 匿名用户固定使用 unlimited
      };

      ctx.__updateQuestionInfo(questionInfo);
      ctx.__trackServerEvent({
        eventName: 'guestQuestionSolveInit',
        finalAnswer: ctx.helper.JsonUtils.safeStringifyJson({
          header: ctx.header,
          body: ctx.request.body,
          bodyParams,
          questionInfo,
        }),
      });
    } catch (error) {
      return this.errorV2(error, 400);
    }

    // 执行解题
    try {
      // 配额更新（替代 updateDiamond）
      await ctx.service.question.increaseAnonCounters(deviceId);

      // 调用解题服务（复用现有逻辑）
      await ctx.service.v9.question.questionSolve();
    } catch (error) {
      this.errorV2(error, 400);
    } finally {
      ctx.__logger__.info('[controller] guestQuestionSolve end');
      if (!ctx.res.writableEnded) {
        ctx.res.end();
      }

      const { rotateFiles = [] } = ctx.__question_info__;
      this.deleteFiles(rotateFiles);
    }
  }

  /**
   * 匿名用户指定模型解题入口
   * 说明：使用 headerValidation middleware，deviceId 从 header 的 x-solvely-device-id 获取
   *      指定模型解题不扣余额，逻辑与 questionModelSolve 保持一致
   */
  async guestQuestionModelSolve() {
    const { ctx } = this;
    const validateMap = {
      questionId: 'string',
      answerId: 'string',
      answerLanguage: 'string',
      answerStyle: 'string',
      experimental: 'string?',
      // 指定模型增强
      displayModelId: 'string',
    };

    try {
      ctx.validate(validateMap, ctx.request.body);
    } catch (error) {
      return this.errorV2(error, 400);
    }

    try {
      ctx.__logger__.info('[controller] guestQuestionModelSolve start');
      const bodyParams = _.pick(ctx.request.body, Object.keys(validateMap));

      // 设置 ctx.user.uid，使后续流程能正常工作
      const deviceId = ctx.__question_info__.deviceId;
      ctx.user = ctx.user || {};
      ctx.user.uid = deviceId;

      const questionInfo = {
        ...bodyParams,
        answerType: 'regeneration',
        renderStyle: 'v9',
        costType: 'unlimited', // 匿名用户固定使用 unlimited
      };

      ctx.__updateQuestionInfo(questionInfo);
      await ctx.service.v9.question.questionModelSolve();
    } catch (error) {
      this.errorV2(error, 400);
    } finally {
      ctx.__logger__.info('[controller] guestQuestionModelSolve end');
      if (!ctx.res.writableEnded) {
        ctx.res.end();
      }
    }
  }
}

module.exports = questionController;
