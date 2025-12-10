/**
 * 权益相关
 * 1. 用户订阅
 * 2. 用户钻石
 */
'use strict';

const _ = require('lodash');
const path = require('path');

const BaseModuleService = require('./baseModule');
const { MODULE_SECTION } = require('../../common/module');
const { QUESTION_STATUS } = require('../../common/question');

// TModule 配置常量
const MODULE_CONFIG = {
  name: _.camelCase(path.basename(__filename, '.js')),
  section: MODULE_SECTION.ENTITLEMENT,
  stream: false,
  level: 1,
};

class EntitlementModuleService extends BaseModuleService {
  constructor(ctx) {
    super(ctx);
    this.MODULE_CONFIG = MODULE_CONFIG;
  }

  /**
   * 模块激活条件检查
   */
  canActivate() {
    return { success: true };
  }

  /**
   * 验证输入数据
   */
  validate() {
    const { ctx } = this;
    const { deviceId } = ctx.__question_info__;
    if (_.isEmpty(deviceId)) {
      return {
        success: false,
        error: '[entitlement.validate] Missing deviceId',
      };
    }
    return { success: true };
  }

  stageError() {}

  /**
   * 执行主流程
   */
  async execute() {
    const { ctx } = this;
    const startTime = Date.now();
    const { name, section } = this.MODULE_CONFIG;
    const logPrefix = `[${section}:${name}:execute]`;

    const checkResult = {};
    try {
      ctx.__logger__.info(`${logPrefix} start`);
      ctx.__trackServerEvent({ eventName: 'entitlementRequest' });
      const { answerType } = ctx.__question_info__;

      //
      const { success, result, error } =
        answerType === 'generation'
          ? await this._executeGenerationRequest()
          : await this._executeRegenerationRequest();
      const { isNewQuestion = true, isFirstSolve = false, solveCount = -1 } = result || {};

      // 解题用到
      ctx.__updateQuestionInfo({ isNewQuestion, isFirstSolve, solveCount });
      _.assign(checkResult, { success, error, result });

      if (!success) {
        ctx.__logger__.warn(`${logPrefix} error:${error}`);
        return { success: false, error };
      }
      if (isFirstSolve) {
        ctx.__trackServerEvent({
          eventName: 'first_solve',
          hint: String('true'),
        });
      }

      return { success: true, result: {}, afterResult: {} };
    } catch (error) {
      ctx.__logger__.error(`${logPrefix} error:${error}`);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      ctx.__trackServerEvent({
        eventName: 'entitlementRequestEnd',
        duration: (duration / 1000).toFixed(2),
        hint: String(checkResult.success),
        finalAnswer: ctx.helper.JsonUtils.safeStringifyJson(checkResult),
      });
      ctx.__logger__.info(`${logPrefix} end, duration:${duration}ms`);
    }
  }

  /**
   * 处理解题需要判断的用户权益
   * 1. 主要是扣钻石以及用户订阅信息判断
   * 2. 是否是首解等
   * 3. 获取 questionData 信息
   */
  async _executeGenerationRequest() {
    const { ctx } = this;
    const startTime = Date.now();
    const { name } = this.MODULE_CONFIG;
    const logPrefix = `[questionInitModule:${name}:execute]`;

    try {
      const { deviceId, questionId } = ctx.__question_info__;

      const [questionData = {}, hasSolvedQuestion = false] = await Promise.all([
        ctx.service.question.info({ deviceId, questionId }),
        ctx.service.question.isFirstSolveQuestion(deviceId),
      ]);

      // 表示是否是新题目
      const isNewQuestion = _.isEmpty(questionData);

      return {
        success: true,
        result: {
          isNewQuestion,
          isFirstSolve: hasSolvedQuestion,
          solveCount: (questionData?.solveCount || 0) + 1,
        },
      };
    } catch (error) {
      ctx.__logger__.error(`${logPrefix} error:${error}`);
      throw error;
    } finally {
      ctx.__logger__.info(`${logPrefix} end, duration:${Date.now() - startTime}ms`);
    }
  }

  /**
   * 处理重解需要判断的用户权益
   * 1. 只需要获取 solveCount
   */
  async _executeRegenerationRequest() {
    const { ctx } = this;
    const startTime = Date.now();
    const { name } = this.MODULE_CONFIG;
    const logPrefix = `[questionInitModule:${name}:execute]`;

    try {
      const { deviceId, questionId } = ctx.__question_info__;
      const questionData = await ctx.service.question.info({ deviceId, questionId });
      // 重解题目必须存在
      if (_.isEmpty(questionData)) {
        throw new Error('[entitlement.execute] questionData is empty');
      }

      if (questionData.answerStatus !== QUESTION_STATUS.success) {
        throw new Error('[entitlement.execute] questionData is not answered');
      }
      return {
        success: true,
        result: {
          isNewQuestion: false,
          isFirstSolve: false,
          solveCount: questionData.solveCount + 1,
        },
      };
    } catch (error) {
      ctx.__logger__.error(`${logPrefix} error:${error}`);
      throw error;
    } finally {
      ctx.__logger__.info(`${logPrefix} end, duration:${Date.now() - startTime}ms`);
    }
  }
}

module.exports = EntitlementModuleService;
