/**
 * JPush 极光推送相关
 */
'use strict';

const _ = require('lodash');
const path = require('path');
const fs = require('fs');

const BaseModuleService = require('./baseModule');
const { MODULE_SECTION } = require('../../common/module');

// TModule 配置常量
const MODULE_CONFIG = {
  name: _.camelCase(path.basename(__filename, '.js')),
  section: MODULE_SECTION.OCR,
  stream: false,
  level: 1,
  hooks: 'service.modules.hooks.ocr',
};

class OcrModuleService extends BaseModuleService {
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
    return { success: true };
  }

  /**
   * 执行主流程
   */
  async execute() {
    const { ctx } = this;
    const startTime = Date.now();
    const { name, section } = this.MODULE_CONFIG;
    const logPrefix = `[ocrModule:${name}:execute]`;

    try {
      /**
       * ocrRequest 打点, 全局第一次
       */
      ctx.__trackServerEvent({ eventName: 'ocrRequest' });

      // 执行 OCR 识别相关逻辑
      const { result: ocrResult } = await this._processOCR();

      /** 到这里只能是 true， 否则直接 throw error 了 */

      // 判断是否是画图题
      const {
        text,
        line_data,
        auto_rotate_degrees,
        confidence,
        confidence_rate,
        imageUrl,
        rotateFiles = [],
        real_rotate_degrees = 0,
        cropFileUrls = [],
      } = ocrResult;
      const lineDataTypes = [...new Set(line_data.map((data) => data.type))];
      const isImageSolve = this._judgementIsImgProblem(lineDataTypes);
      const isTableSolve = this._judgementIsTableProblem(lineDataTypes);

      // 保存埋点信息
      const result = {
        questionText: text,
        isImageSolve,
        isTableSolve,
        imageUrl,
        rotateFiles,
        cropFileUrls,
      };
      ctx.__trackServerEvent({
        eventName: 'ocrResult',
        duration: ((Date.now() - startTime) / 1000).toFixed(2),
        finalAnswer: JSON.stringify(result),
      });

      return {
        success: true,
        result,
        afterResult: {
          confidence,
          confidence_rate,
          imageLineData: line_data,
          rotationDegrees: auto_rotate_degrees,
          realRotateDegrees: real_rotate_degrees,
          isTableSolve,
        },
      };
    } catch (error) {
      ctx.__logger__.error(`${logPrefix} error:${error}`);
      return { success: false, error: `${section} error` };
    } finally {
      ctx.__trackServerEvent({
        eventName: 'ocrRequestEnd',
        duration: ((Date.now() - startTime) / 1000).toFixed(2),
      });
      ctx.__logger__.info(`${logPrefix} end, duration:${Date.now() - startTime}ms`);
    }
  }

  /**
   * 判断是否是图片题
   *
   * @param {string[]} lineDataTypes 行数据类型
   * @return {boolean} 是否是图片题
   */
  _judgementIsImgProblem(lineDataTypes) {
    // 不包含diagram和chart的前提下，只要包含table就算纯表格题归类非图片题
    const detectionList = ['diagram', 'chart', 'table'];
    return lineDataTypes.some((element) => detectionList.includes(element));
  }

  /**
   * 判断是否是表格题
   *
   * @param {string[]} lineDataTypes 行数据类型
   * @return {boolean} 是否是表格题
   */
  _judgementIsTableProblem(lineDataTypes) {
    const detectionList = ['table'];
    return lineDataTypes.some((element) => detectionList.includes(element));
  }

  /**
   * 执行 OCR 识别
   *
   * @return {Promise} OCR 识别结果
   */
  async _processOCR() {
    const { ctx } = this;
    const { files = [], pictureKey, questionText } = ctx.__question_info__;
    const file = files[0];
    const startTime = Date.now();
    const { name } = this.MODULE_CONFIG;
    const logPrefix = `[ocrModule:${name}:processOCR]`;

    let rotateFile;
    try {
      // 判断是否是纯文字题
      if (_.isEmpty(pictureKey) && !_.isEmpty(questionText)) {
        ctx.__logger__.info(`${logPrefix} questionText is exist, skip ocr`);
        return {
          success: true,
          result: {
            text: questionText,
            confidence: 0,
            confidence_rate: 0,
            line_data: [],
            auto_rotate_degrees: 0,
          },
        };
      }

      // 1. 使用原图片直接进行 mathpix 识别
      const ocrResult = await ctx.service.modules.utils.mathpix.processMathpix(file, pictureKey);

      // 如果识别内容包含 image_max_size 错误，那么直接算作识别失败，需要将旋转后的图片交给大模型
      const hasImageMaxSizeError =
        ocrResult?.result?.line_data?.filter((data) => data.error_id === 'image_max_size').length >
        0;

      // 触发 image max size 错误，直接失败，使用 41-mini 进行兜底
      if (hasImageMaxSizeError) {
        ctx.__trackServerEvent({
          eventName: 'ocrImageMaxSize',
          output: ctx.helper.JsonUtils.safeStringifyJson(ocrResult),
          imageUrls: pictureKey,
          title: pictureKey,
        });
        throw new Error('ocr 识别失败，触发 image_max_size 使用 41-mini 进行兜底');
      }

      if (!ocrResult?.success) {
        throw new Error('ocr 识别失败， 使用 41-mini 进行兜底');
      }

      const { text, confidence, confidence_rate, line_data, auto_rotate_degrees } =
        ocrResult.result;

      // 对最终的图片做图片切割
      ctx.__logger__.info(`${logPrefix} process crop`);
      const cropResult = (await this._processCrop({}, line_data)) || {};

      return {
        success: true,
        result: {
          text,
          imageUrl: pictureKey || '',
          rotateFiles: [],
          cropFileUrls: cropResult.result?.cropFileUrls || [], // 剪切之后的图片
          //
          confidence,
          confidence_rate,
          line_data,
          /**
           * ⚠️ 这里的是给前端的旋转角度，而不是实际的角度
           */
          auto_rotate_degrees,
          /**
           * 实际的旋转角度
           * 确定需要保存的旋转角度，文件可以仍以 rotateFile 为主
           */
          real_rotate_degrees: auto_rotate_degrees || 0,
        },
      };
    } catch (error) {
      ctx.__logger__.warn(`${logPrefix} error:${error}`);

      // 需要 gpt 验证的文件
      const file = await ctx.helper.downloadS3FileForS3Client(pictureKey);
      const gptFile = rotateFile || file;
      const { questionId } = ctx.__question_info__;
      const [{ success: gptSuccess, result: gptResult }, imageUrl] = await Promise.all([
        this.useGpt41MiniOCR(gptFile, questionId),
        ctx.service.modules.utils.s3.uploadPictureS3(gptFile),
      ]);
      if (!gptSuccess) {
        throw new Error('OCR 识别失败');
      }
      const { text, confidence, confidence_rate, line_data, auto_rotate_degrees } = gptResult;
      return {
        success: true,
        result: {
          text,
          imageUrl,
          //
          confidence,
          confidence_rate,
          line_data,
          auto_rotate_degrees,
          real_rotate_degrees: 0,
        },
      };
    } finally {
      ctx.__logger__.info(`${logPrefix} end, duration:${Date.now() - startTime}ms`);
    }
  }

  async _processCrop(file, line_data = []) {
    const { ctx } = this;
    const logger = ctx.__logger__;
    const { name } = this.MODULE_CONFIG;
    const logPrefix = `[ocrModule:${name}:processCrop]`;
    const startTime = Date.now();
    const filteredTypes = ['diagram', 'chart', 'table'];

    const processInfo = {
      isSkip: false,
      skipReason: '',
      isSuccess: false,
      cropFiles: [],
      cropFileUrls: [],
      line_data,
      error: null,
    };
    try {
      ctx.__trackServerEvent({ eventName: 'cropRequest' });

      const filteredLineData = line_data?.filter((data) => filteredTypes.includes(data.type)) || [];
      if (!filteredLineData.length) {
        processInfo.isSkip = true;
        processInfo.isSuccess = true;
        processInfo.skipReason = 'no diagram or chart';
        return { success: true, result: processInfo };
      }
      if (filteredLineData.length > 2) {
        // 和算法结论保持相同
        processInfo.isSkip = true;
        processInfo.isSuccess = true;
        processInfo.skipReason = `more than 2 diagram or chart, length: ${filteredLineData.length}`;
        return { success: true, result: processInfo };
      }

      // 下载远程文件到本地
      const { pictureKey } = ctx.__question_info__;
      const file = await ctx.helper.downloadS3FileForS3Client(pictureKey);

      const croppedFiles = await ctx.helper.ImageUtils.cropImageFromMathpix(file, filteredLineData);
      logger.info(`${logPrefix} crop files:${croppedFiles.length}`);
      processInfo.cropFiles = croppedFiles;

      // 上传到 s3
      const cropFilesUrls = [];
      if (croppedFiles.length) {
        const _cropFilesUrls = await Promise.all(
          croppedFiles.map((file) => ctx.service.modules.utils.s3.uploadPictureS3(file)),
        );
        logger.info(
          `${logPrefix} crop files urls:${ctx.helper.JsonUtils.safeStringifyJson(_cropFilesUrls)}`,
        );
        cropFilesUrls.push(..._cropFilesUrls);
      }

      processInfo.isSkip = false;
      processInfo.isSuccess = true;
      processInfo.cropFileUrls = cropFilesUrls;
      return { success: true, result: processInfo };
    } catch (error) {
      logger.warn(`${logPrefix} error:${error}`);
      return { success: false, result: processInfo };
    } finally {
      ctx.__trackServerEvent({
        eventName: 'cropRequestEnd',
        duration: ((Date.now() - startTime) / 1000).toFixed(2),
        finalAnswer: ctx.helper.JsonUtils.safeStringifyJson(processInfo),
        hint: ctx.helper.JsonUtils.safeStringifyJson(processInfo.cropFileUrls),
      });
      logger.info(`${logPrefix} end, duration:${Date.now() - startTime}ms`);

      // 删除剪切之后的图片
      if (processInfo.cropFiles?.length) {
        for (const file of processInfo.cropFiles) {
          try {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          } catch (deleteError) {
            logger.warn(`${logPrefix} failed to delete crop file: ${file}, error: ${deleteError}`);
          }
        }
      }
    }
  }

  /**
   * 用于使用 41mini 来识别 ocr 内容
   *
   * @param {object} file 文件
   * @param {string} questionId 题目id
   * @param {string} imageUrl 图片url
   * @return {Promise} 识别结果
   *
   */
  async useGpt41MiniOCR(file, questionId, imageUrl = '') {
    const { ctx, app } = this;
    const logger = ctx.__logger__ || app.getLogger('taskLogger');
    try {
      const url = '/solvelyPubServer/recognition/Gpt41MiniOCR/v1';
      const headers = { 'Content-type': 'multipart/form-data', platform: 'ios' };
      const result = await this.publicServerPostRequest(url, { questionId, imageUrl }, headers, [
        file.filepath,
      ]);
      return {
        success: !_.isEmpty(result?.data) && result.statusCode === 200,
        result: result?.data || {},
      };
    } catch (error) {
      logger.error(`useGpt41MiniOCR:Error:${error}`);
      return { success: false, result: {} };
    }
  }
}

module.exports = OcrModuleService;
