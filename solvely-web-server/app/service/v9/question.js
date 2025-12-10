'use strict';

const BaseService = require('./BaseService');
const { MODULE_SECTION } = require('../../common/module');
const { StreamCommandEnum } = require('../../common/question');

const commonContentStreamObj = Object.freeze({
  command: 'pending',
  type: 'chunk',
  contentType: undefined,
  content: undefined,
});

/**
 * 执行顺序是如下，注意 1、2、3 为独立的 stage，stage 之间只能串行, 且为必备阶段，不可省略
 * 每个 stage 下的 module 根据业务要求来约定是并行还是串行
 * 比如：ios 约定即使用户权益失败也需要执行完成 ocr 这里需要强制 parallel = true
 *
 * 1. ['question_check', 'ocr', 'entitlement']: 并行：[题目检查 -> OCR] & [用户权益]
 * 2. pub_question_solving: 串行：[pub 解题]
 * 3. jpush: 串行：[JPush]
 *
 * flows 会按照上面的约定和顺序配置
 * ⚠️ 注意，section 应该是表示具有相同功能的 module 分组集合，stage 只是当前业务要求，不一定在别的业务上一致
 */
const solveConf = {
  STAGE_1: {
    stageCode: 'question_check_ocr_entitlement',
    description: '判断题目是否存在检查、OCR识别、用户权益',

    // 实际 modules 层级使用的内容
    parallel: true,
    sections: [MODULE_SECTION.OCR, MODULE_SECTION.ENTITLEMENT],
  },
  STAGE_2: {
    stageCode: 'question_check_init',
    description: '问题检查和初始化',

    // 实际 modules 层级使用的内容
    parallel: false,
    sections: [MODULE_SECTION.QUESTION_INIT],
  },
  STAGE_3: {
    stageCode: 'pub_question_solving',
    description: '调用 pub 进行解题',

    // 实际 modules 层级使用的内容
    parallel: false,
    sections: [MODULE_SECTION.PUB_SOLVING],
  },
};
const reSolveConf = {
  STAGE_1: {
    stageCode: 'question_check_entitlement',
    description: '判断题目是否存在检查、用户权益',

    // 实际 modules 层级使用的内容
    parallel: false,
    sections: [MODULE_SECTION.ENTITLEMENT],
  },
  STAGE_2: {
    stageCode: 'question_check_init',
    description: '问题检查和初始化',

    // 实际 modules 层级使用的内容
    parallel: false,
    sections: [MODULE_SECTION.QUESTION_INIT],
  },
  STAGE_3: {
    stageCode: 'pub_question_solving',
    description: '调用 pub 进行解题',

    // 实际 modules 层级使用的内容
    parallel: false,
    sections: [MODULE_SECTION.PUB_SOLVING],
  },
};

const modelSolveConf = {
  STAGE_1: {
    stageCode: 'question_check_entitlement',
    description: '判断题目是否存在检查、用户权益',

    // 实际 modules 层级使用的内容
    parallel: false,
    sections: [MODULE_SECTION.ENTITLEMENT],
  },
  STAGE_2: {
    stageCode: 'question_check_init',
    description: '问题检查和初始化',

    // 实际 modules 层级使用的内容
    parallel: false,
    sections: [MODULE_SECTION.QUESTION_INIT],
  },
  STAGE_3: {
    stageCode: 'pub_question_solving',
    description: '调用 pub 进行解题',

    // 实际 modules 层级使用的内容
    parallel: false,
    sections: [MODULE_SECTION.PUB_SOLVING],
  },
};

class QuestionV9Service extends BaseService {
  /**
   * 处理任意情况导致的解题失败
   */
  async questionSolveError() {
    // empty
  }

  /**
   * 解题入口
   */
  async questionSolve() {
    const { ctx } = this;
    const { __logger__: logger } = ctx;
    const startTime = Date.now();
    const logPrefix = `[QuestionV9Service.questionSolve]`;
    let isSolveSuccess = false;
    try {
      logger.info(`${logPrefix} start`);
      ctx.__trackServerEvent({ eventName: 'questionSolveStart' });
      //
      const { renderStyle } = ctx.__question_info__;
      this.ctxWriteStream({ ...commonContentStreamObj, type: 'init', renderStyle });
      //
      const dispatcher = ctx.service.dispatcher.index;
      const result = await dispatcher.run(solveConf);
      if (!result.success) {
        logger.warn(`${logPrefix} flow run error:${JSON.stringify(result)}`);
        this.ctxWriteStream({ command: StreamCommandEnum.Error });
        await this.questionSolveError();
      }
      isSolveSuccess = result.success;
      logger.info(`${logPrefix}[dispatcherResult]:${JSON.stringify(result)}`);
    } catch (error) {
      logger.error(`${logPrefix} error:${error}`);
      this.ctxWriteStream({ command: StreamCommandEnum.Error });
      isSolveSuccess = false;

      await this.questionSolveError();
    } finally {
      const duration = Date.now() - startTime;
      ctx.__trackServerEvent({
        eventName: 'questionSolveEnd',
        duration: (duration / 1000).toFixed(2),
        hint: String(isSolveSuccess),
      });
      logger.info(`${logPrefix} end, duration:${duration}ms`);
    }
  }

  /**
   * 重解解题入口
   */
  async questionReSolve() {
    const { ctx } = this;
    const { __logger__: logger } = ctx;

    const startTime = Date.now();
    const logPrefix = `[QuestionV9Service.questionReSolve]`;
    let isSolveSuccess = false;
    try {
      logger.info(`${logPrefix} start`);
      ctx.__trackServerEvent({ eventName: 'questionReSolve' });
      //
      const { renderStyle } = ctx.__question_info__;
      this.ctxWriteStream({ ...commonContentStreamObj, type: 'init', renderStyle });
      //
      const dispatcher = ctx.service.dispatcher.index;
      const result = await dispatcher.run(reSolveConf);
      if (!result.success) {
        logger.warn(`${logPrefix} flow run error:${JSON.stringify(result)}`);
        this.ctxWriteStream({ command: StreamCommandEnum.Error });
      }
      isSolveSuccess = result.success;
      logger.info(`${logPrefix}[dispatcherResult]:${JSON.stringify(result)}`);
    } catch (error) {
      logger.error(`${logPrefix} error:${error}`);
      this.ctxWriteStream({ command: StreamCommandEnum.Error });
      isSolveSuccess = false;
    } finally {
      const { solveCount = -1 } = ctx.__question_info__;
      const duration = Date.now() - startTime;
      ctx.__trackServerEvent({
        eventName: 'questionReSolveEnd',
        duration: (duration / 1000).toFixed(2),
        hint: String(isSolveSuccess),
        solveCount,
      });
      logger.info(`${logPrefix} end, duration:${duration}ms`);
    }
  }

  /**
   * 指定模型解题入口
   */
  async questionModelSolve() {
    const { ctx } = this;
    const { __logger__: logger } = ctx;

    const startTime = Date.now();
    const logPrefix = `[QuestionV9Service.questionModelSolve]`;
    let isSolveSuccess = false;
    try {
      logger.info(`${logPrefix} start`);
      //
      const { renderStyle } = ctx.__question_info__;
      this.ctxWriteStream({ ...commonContentStreamObj, type: 'init', renderStyle });
      //
      const dispatcher = ctx.service.dispatcher.index;
      const result = await dispatcher.run(modelSolveConf);
      if (!result.success) {
        logger.warn(`${logPrefix} flow run error:${JSON.stringify(result)}`);
        this.ctxWriteStream({ command: StreamCommandEnum.Error });
      }
      isSolveSuccess = result.success;
      logger.info(`${logPrefix}[dispatcherResult]:${JSON.stringify(result)}`);
    } catch (error) {
      logger.error(`${logPrefix} error:${error}`);
      this.ctxWriteStream({ command: StreamCommandEnum.Error });
      isSolveSuccess = false;
    } finally {
      const duration = Date.now() - startTime;
      logger.info(`${logPrefix} end, duration:${duration}ms,isSolveSuccess:${isSolveSuccess}`);
    }
  }
}

module.exports = QuestionV9Service;
