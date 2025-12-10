/**
 * JPush 极光推送相关
 */
'use strict';

const _ = require('lodash');
const path = require('path');
const BaseModuleService = require('./baseModule');
const { MODULE_SECTION } = require('../../common/module');

// TModule 配置常量
const MODULE_CONFIG = {
  name: _.camelCase(path.basename(__filename, '.js')),
  section: MODULE_SECTION.PUB_SOLVING,
  stream: true,
  level: 1,
};

class PubQuestionSolvingModuleService extends BaseModuleService {
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
    const { questionText, answerType } = ctx.__question_info__;
    // 解题模式验证前置是否存在
    if (answerType === 'generation' && _.isEmpty(questionText)) {
      return {
        success: false,
        error: '[pubSolving.validate] questionText or isImageSolve is empty',
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
    const { name, section } = this.MODULE_CONFIG;
    const logPrefix = `[${section}:${name}:execute]`;

    try {
      ctx.__logger__.info(`${logPrefix} start`);
      ctx.__trackServerEvent({ eventName: 'publicSolvingRequest' });
      //
      const { answerType, displayModelId } = ctx.__question_info__;
      if (answerType === 'generation') {
        await this._executeQuestionSolve();
      } else {
        if (_.isEmpty(displayModelId)) {
          await this._executeQuestionReSolve();
        } else {
          await this._executeQuestionModelSolve();
        }
      }
      return { success: true, result: {}, afterResult: {} };
    } catch (error) {
      ctx.__logger__.error(`${logPrefix} error:${error}`);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      ctx.__trackServerEvent({
        eventName: 'publicSolvingRequestEnd',
        duration: (duration / 1000).toFixed(2),
      });
      ctx.__logger__.info(`${logPrefix} end, duration:${duration}ms`);
    }
  }

  // 解题
  async _executeQuestionSolve() {
    const { ctx } = this;
    // 拼接请求参数
    const {
      questionId,
      answerId,
      answerLanguage,
      instructions,
      answerStyle,
      experimental,
      costType,
      // controller freeze
      answerType,
      // ocr 模块
      questionText,
      pictureKey,
      isImageSolve,
      // 来自 entitlement 模块
      solveCount,
      isFirstSolve,
      //
      rotateFiles = [],
      files = [],
      // 二次信息补全
      isResumingQuestion = false,
      displayModelId,
    } = ctx.__question_info__;
    const params = {
      // 基础信息
      questionId,
      answerId,
      // 题目信息
      questionText,
      instructions,
      pictureKey,
      // 答案配置
      answerLanguage,
      answerStyle,
      answerType,
      costType,
      solveCount,
      isFirstSolve,
      // 用户实验组
      experimental,
      // 二次信息补全
      isResumingQuestion,
      // 指定模型
      displayModelId,
    };
    const url = '/solvelyPubServer/v9/question/solve';

    /**
     * 特殊处理，因为现在 public 为了支持文件上传，validateMap 中 solveCount: number -> string, isFirstSolve:boolean -> string
     * 所以这里需要特殊处理
     */
    params.solveCount = String(params.solveCount);
    params.isFirstSolve = params.isFirstSolve ? 'true' : 'false';
    params.isResumingQuestion = String(params.isResumingQuestion);

    // 如果是图片题则需要上传文件
    const filesToUpload = isImageSolve ? (_.isEmpty(rotateFiles) ? files : rotateFiles) : [];

    const { answerData, isDone } =
      await ctx.service.modules.utils.streamHttp.publicServerStreamRequest(
        url,
        params,
        filesToUpload,
      );

    /**
     * 考虑存在 pub 只返回 done 的情况，比如重解
     * {"statusCode":200,"data":{"command":"pending","type":"init","renderStyle":"v9"}}
     * {"statusCode":200,"data":{"content":"","command":"done","clientAction":"queryAnswerInfo"}}
     */
    if (!isDone && _.isEmpty(answerData)) {
      throw Error(`stream解题失败, ${questionId} 算法返回结果为空 >>${answerData}<<`);
    }
    return {};
  }

  // 重解
  async _executeQuestionReSolve() {
    const { ctx } = this;
    // 拼接请求参数
    const {
      questionId,
      answerId,
      fromAnswerId,
      answerLanguage,
      answerStyle,
      //
      experimental,
      // 重解增强
      regenerateReason,
      regenerateTag,
      regeneratePictureKeys,
      // controller freeze
      answerType,
      // init section
      isFirstSolve,
      solveCount,
    } = ctx.__question_info__;
    const params = {
      questionId,
      answerId,
      fromAnswerId,
      answerLanguage,
      answerStyle,
      //
      experimental,
      // 重解增强
      regenerateReason,
      regenerateTag,
      regeneratePictureKeys,
      // controller freeze
      answerType,
      // init section
      isFirstSolve,
      solveCount,
    };
    const url = '/solvelyPubServer/v9/question/reSolve';
    const { answerData, isDone } =
      await ctx.service.modules.utils.streamHttp.publicServerStreamRequest(url, params);

    /**
     * 考虑存在 pub 只返回 done 的情况，比如重解
     * {"statusCode":200,"data":{"command":"pending","type":"init","renderStyle":"v9"}}
     * {"statusCode":200,"data":{"content":"","command":"done","clientAction":"queryAnswerInfo"}}
     */
    if (!isDone && _.isEmpty(answerData)) {
      throw Error(`stream解题失败, ${questionId} 算法返回结果为空 >>${answerData}<<`);
    }
    return {};
  }

  // 重解
  async _executeQuestionModelSolve() {
    const { ctx } = this;
    // 拼接请求参数
    const {
      questionId,
      answerId,
      answerLanguage,
      answerStyle,
      experimental,
      answerType,
      isFirstSolve,
      solveCount,
      displayModelId,
    } = ctx.__question_info__;
    const params = {
      questionId,
      answerId,
      answerLanguage,
      answerStyle,
      experimental,
      answerType,
      isFirstSolve,
      solveCount,
      displayModelId,
    };
    const url = '/solvelyPubServer/v9/question/model/solve';
    const { answerData, isDone } =
      await ctx.service.modules.utils.streamHttp.publicServerStreamRequest(url, params);

    /**
     * 考虑存在 pub 只返回 done 的情况，比如重解
     * {"statusCode":200,"data":{"command":"pending","type":"init","renderStyle":"v9"}}
     * {"statusCode":200,"data":{"content":"","command":"done","clientAction":"queryAnswerInfo"}}
     */
    if (!isDone && _.isEmpty(answerData)) {
      throw Error(`stream解题失败, ${questionId} 算法返回结果为空 >>${answerData}<<`);
    }
    return {};
  }
}

module.exports = PubQuestionSolvingModuleService;
