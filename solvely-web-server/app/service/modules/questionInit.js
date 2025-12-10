/**
 * JPush 极光推送相关
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
  section: MODULE_SECTION.QUESTION_INIT,
  /**
   * 对外使用，其实输出由内部决定
   */
  stream: false,
  level: 1,
};

class QuestionInitModuleService extends BaseModuleService {
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
        error: '[questionCheck.validate] Missing deviceId',
      };
    }
    return { success: true };
  }

  /**
   * 执行主流程
   */
  async execute() {
    const { ctx } = this;
    const startTime = Date.now();
    const { name } = this.MODULE_CONFIG;
    const logPrefix = `[questionInitModule:${name}:execute]`;

    try {
      const {
        deviceId,
        questionId,
        requestTime,
        questionText,
        language,
        pictureKey,
        appVersion,
        costType,
        // controller freeze
        renderStyle,
        // 来自用户权益检测
        isNewQuestion,
        platform,
      } = ctx.__question_info__;

      const promises = [];
      if (isNewQuestion) {
        // 获取数据库model
        const model = await ctx.helper._getModelByDeviceId(deviceId);
        // 首次解题
        promises.push(
          model.create({
            taskType: '',
            costType,
            appVersion,
            deviceId,
            questionId,
            questionText,
            pictureKey,
            language,
            subject: 'math',
            modelName: 'gpt-4-stream',
            answerStatus: QUESTION_STATUS.analyzing,
            solvelyTime: requestTime,
            platform,
            renderStyle,
            solveCount: 1,
            lastSolveMode: ctx.app.config.SOLVE_MODES.FAST,
          }),
        );
      }

      if (costType === 'unlimited') {
        promises.push(ctx.service.question.addCount());
      }

      // 判断是否是新题目和首解
      await Promise.all(promises);

      return { success: true };
    } catch (error) {
      ctx.__logger__.error(`${logPrefix} error:${error}`);
      throw error;
    } finally {
      ctx.__logger__.info(`${logPrefix} end, duration:${Date.now() - startTime}ms`);
    }
  }
}

module.exports = QuestionInitModuleService;
