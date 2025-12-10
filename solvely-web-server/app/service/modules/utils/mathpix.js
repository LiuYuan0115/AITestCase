const { Service } = require('egg');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

class MathpixUtils extends Service {
  /**
   * 纯请求 mathpix，这里使用入参，兼容后续多文件的情况
   * @param {object} file 文件
   * @param {string} pictureKey 图片key
   * @return {Promise} 请求结果
   */
  async _requestMathpix(file, pictureKey = '') {
    const { ctx, app } = this;
    // const { appId, appKey } = ctx.app.config.Mathpix;
    const appId = app.config.mathpix.appId;
    const appKey = app.config.mathpix.appKey;
    const url = 'https://api.mathpix.com/v3/text';
    const mathpixOptions = {
      math_inline_delimiters: ['$', '$'],
      rm_spaces: true,
      include_line_data: true,
      formats: ['text', 'data'],
      data_options: {
        include_asciimath: true,
      },
    };

    const requestOptions = file
      ? this._buildMathpixFileOptions(file, mathpixOptions)
      : this._buildMathpixUrlOptions(pictureKey, mathpixOptions);
    _.assign(requestOptions.headers, { app_id: appId, app_key: appKey });

    let result;
    const max_retry = 3;
    for (let i = 0; i < max_retry; i++) {
      try {
        result = await ctx.curl(url, requestOptions);
        break;
      } catch (error) {
        const err_x_amz_cf_id = error.headers['x-amz-cf-id'];
        const res_x_amz_cf_id = result.headers['x-amz-cf-id'];
        ctx.__logger__.warn(
          `ocr识别失败，重试#${i + 1}:${error},err_x_amz_cf_id:${err_x_amz_cf_id},res_x_amz_cf_id:${res_x_amz_cf_id}`,
        );
      }
    }
    return result;
  }

  /**
   * 请求 mathpix, 上传文件方式
   * @param {object} file 文件
   * @param {object} options 请求选项
   * @return {object} 请求选项
   */
  _buildMathpixFileOptions(file, options) {
    // 使用 Buffer 避免文件读流在异步阶段与外部 unlink 发生竞态
    const fileBuffer = fs.readFileSync(file.filepath);
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: path.basename(file.filepath),
      contentType: file.mime,
    });
    formData.append('options_json', JSON.stringify(options));
    return {
      method: 'POST',
      stream: formData,
      timeout: 60000,
      headers: {
        'content-type': `multipart/form-data; boundary=${formData.getBoundary()}`,
        // app_id: "",
        // app_key: "",
      },
      dataType: 'json',
    };
  }

  /**
   * 请求 mathpix, URL 地址方式
   * @param {string} pictureKey 图片key
   * @param {object} options 请求选项
   * @return {object} 请求选项
   */
  _buildMathpixUrlOptions(pictureKey, options) {
    const data = {
      ...options,
      src: pictureKey,
    };
    return {
      method: 'POST',
      data,
      timeout: 60000,
      headers: {
        'Content-type': 'application/json',
        // app_id: "",
        // app_key: "",
      },
      dataType: 'json',
    };
  }

  /**
   * 请求 mathpix 并记录识别错误的图片
   * @param {object} file 文件
   * @param {string} pictureKey 图片key
   * @return {Promise} 请求结果
   */
  async processMathpix(file, pictureKey) {
    const { ctx } = this;
    const startTime = Date.now();
    const logPrefix = `[processMathpix]`;
    const s3Utils = ctx.service.modules.utils.s3;

    try {
      ctx.__logger__.info(`${logPrefix} start`);
      // 请求 mathpix
      const mathpixResult = await this._requestMathpix(file, pictureKey);
      const success =
        mathpixResult?.data?.text && mathpixResult?.status === 200 && !mathpixResult?.data.error;

      if (!success) {
        // 如果失败需要额外将该文件上传到 “ocr_fail” bucket
        s3Utils
          .uploadPictureS3(file, `mathpix_OcrFail-${Date.now()}`, 'ocr_fail')
          .then((cndUrl) => {
            ctx.__trackServerEvent({ eventName: 'mathpix_ocrFail', output: `imageUrl:${cndUrl}` });
          });
        ctx.__logger__.info(
          `${logPrefix} mathpix ocr识别失败, errorDetail:${ctx.helper.JsonUtils.safeStringifyJson(mathpixResult)}`,
        );
        return { success: false, result: {} };
      }

      return { success, result: mathpixResult.data };
    } catch (error) {
      ctx.__logger__.error(`${logPrefix} error:${error}`);
      return { success: false, result: {} };
    } finally {
      ctx.__logger__.info(`${logPrefix} end, duration:${Date.now() - startTime}ms`);
    }
  }
}

module.exports = MathpixUtils;
