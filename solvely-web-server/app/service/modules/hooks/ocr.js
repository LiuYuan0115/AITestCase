const _ = require('lodash');
const BaseHookService = require('./baseHook');
const { MODULE_SECTION } = require('../../../common/module');

class OcrHook extends BaseHookService {
  async before() {
    /**
     * 如果是 thinking 已经在数据库存在则直接返回
     */
    const { ctx } = this;
    const { deviceId, questionId } = ctx.__question_info__;
    const questionBaseInfo = await ctx.service.v9.public.queryQuestionPureInfo(
      deviceId,
      questionId,
    );
    if (questionBaseInfo?.questionText) {
      const { isImageSolve, pictureKey, questionText } = questionBaseInfo;
      return {
        isSkip: true,
        result: { questionText, isImageSolve, imageUrl: pictureKey },
        afterResult: {},
      };
    }
    return { isSkip: false, result: {} };
  }

  /**
   * 保存 thinking 结果，只保留 thinking 字段,
   * ⚠️ 在 V9 版本中只要是走了 thinking 则认定必须要 format
   * 同时会将 thinking 的内容作用到 ctx._question_info__ 中
   * @param {object} moduleResult
   */
  async after(moduleResult) {
    const { ctx } = this;
    const { deviceId, questionId, renderStyle } = ctx.__question_info__;
    const { success, error, result, afterResult, isSkip } = moduleResult || {};
    const {
      questionText,
      isImageSolve,
      imageUrl,
      rotateFiles = [],
      cropFileUrls = [],
      isTableSolve,
      platform,
    } = result || {};

    if (!success || _.isEmpty(questionText)) {
      this.ctxWriteStream({
        content: `ocr failed: ${error}`,
        contentSectionType: 'text',
        contentSection: MODULE_SECTION.OCR,
        command: 'error',
        errorCode: 2002,
      });
      return { isSkip: true, result: {} };
    }

    if (!isSkip) {
      // 如果没有跳过则更新 question 表
      await ctx.service.v9.public.updatePureQuestionSchema(deviceId, questionId, {
        questionText,
        pictureKey: imageUrl,
        isImageSolve,
        solveMode: 'fast', // 固定为 fast 模式
        renderStyle,
        cropFileUrls,
        isTableSolve,
        platform,
      });
    }

    const {
      // 保存到 bq ocrConfidence
      confidence,
      confidence_rate,
      // 需要保存到 mongo 数据库中
      imageLineData,
      rotationDegrees = 0,
      realRotateDegrees = 0,
    } = afterResult || {};
    // 流式内容输出
    this.ctxWriteStream({
      content: ctx.helper.JsonUtils.safeStringifyJson({
        questionText,
        isImageSolve,
        imageUrl,
        auto_rotate_degrees: rotationDegrees, // 注意这里和后需保存字段不同
      }),
      contentSectionType: 'json',
      contentSection: MODULE_SECTION.OCR,
    });

    // BQ 打点
    if (confidence && confidence_rate) {
      // 如果是 before 跳过，不需要打点
      ctx.__trackServerEvent({
        eventName: 'ocrConfidence',
        output: `confidence:${confidence}, confidence_rate:${confidence_rate}`,
      });
    }

    // 非主流成异步数据更新
    if (imageLineData) {
      ctx.service.v9.public.updateQuestionAddInfo(questionId, {
        imageLineData, // 原图片信息
        rotationDegrees: realRotateDegrees, // 旋转之后的角度，如果旋转之后则为 0
      });
    }
    ctx.__updateQuestionInfo({ isImageSolve, questionText, pictureKey: imageUrl, rotationDegrees });
    ctx.__updateQuestionInfo({ rotateFiles });
    return { isSkip: false, result: {} };
  }
}

module.exports = OcrHook;
