'use strict';

const { Service } = require('egg');
const _ = require('lodash');
const { QuestionErrorCodeEnum } = require('../../../common/question');

/**
 * 流式 HTTP 客户端
 * 专注于处理流式响应，设计原则：简洁、健壮、高性能
 */
class StreamHttpUtils extends Service {
  /**
   * 发起流式请求并处理响应
   * @param {string} url - 请求 URL
   * @param {Object} params - 请求参数
   * @param {Object} streamOptions - 流式响应内容选项
   * @param {Object} requestOptions - 请求配置选项
   * @return {Promise<Object>} { answerData, isOverReqLimit }
   */
  async streamRequest(url, params, streamOptions, requestOptions = {}) {
    const { ctx } = this;
    const { __logger__: logger } = ctx;
    const { writeStream, separator } = streamOptions;
    // 参数验证
    if (!url) {
      throw new Error('URL is required');
    }

    try {
      // 发起流式请求
      const requestConfig = this._buildRequestConfig(params, requestOptions);
      const result = await ctx.curl(url, requestConfig);

      // HTTP 状态码检查
      if (result.status !== 200) {
        throw new Error(`HTTP ${result.status}: ${url}`);
      }

      // 处理流式响应
      const { content, isOverReqLimit, isDone } = await this._handleStreamResponse(
        result.res,
        writeStream,
        separator,
      );
      return { answerData: content, isOverReqLimit, isDone };
    } catch (error) {
      logger.error(`[streamRequest] error: ${error}`);
      if (writeStream && !writeStream.writableEnded) {
        const errorMessage = JSON.stringify({
          statusCode: 510,
          data: { content: 'streamRequest error', command: 'error' },
          message: '请求失败',
        });
        // 使用标准 SSE 格式
        writeStream.write(`data: ${errorMessage}\r\n\r\n`);
      }
      throw error;
    }
  }

  _buildRequestConfig(params, options) {
    const { headers = {}, timeout = 300000, files = [] } = options;
    const commonConfig = {
      method: 'POST',
      headers,
      streaming: true,
      timeout,
      keepAlive: true,
    };

    if (_.isEmpty(files)) {
      return {
        ...commonConfig,
        contentType: 'json',
        data: params,
      };
    }

    // 当为 form 类型时，确保所有 data 字段的值都是字符串
    const formData = _.mapValues(params, (value) => {
      if (_.isObject(value)) {
        return JSON.stringify(value);
      }
      return String(value);
    });
    const filePaths = _.map(files, (file) => {
      if (_.isObject(file) && file.filepath) {
        return file.filepath;
      }
      return file;
    });

    return {
      ...commonConfig,
      contentType: 'form',
      data: formData,
      files: filePaths,
    };
  }

  /**
   * 处理流式响应数据
   * @param {Response} responseStream 响应流
   * @param {Response} writeStream 写流
   * @param {string} separator 分隔符
   * @return {Promise} 响应结果
   */
  async _handleStreamResponse(responseStream, writeStream, separator = '\n') {
    const { ctx } = this;

    // 1. 异步生成器：将字节流转换为健壮的消息对象流。
    // 核心职责：处理网络分片（末尾消息不完整）和数据污染（中间消息格式错误）。
    async function* messageGenerator() {
      let buffer = '';
      for await (const chunk of responseStream) {
        if (_.isEmpty(chunk)) {
          continue;
        }
        buffer += chunk.toString('utf-8');

        // 如果连一个分隔符都没有，说明肯定不是一个完整的消息，直接等待下一个 chunk
        if (!buffer.includes(separator)) {
          continue;
        }

        const potentialMessages = buffer.split(separator);
        // 最后一个元素是特殊情况：它可能是网络分片，需要先取出单独处理。
        const lastPotentialMessage = potentialMessages.pop() || '';

        // --- 处理确定是完整的消息段 ---
        // 循环处理所有中间的消息。此处能容忍数据源发送的格式错误（脏数据）。
        for (const msg of potentialMessages) {
          const trimmedMsg = msg.trim();
          // 跳过由 separator 开头而产生的空字符串
          if (_.isEmpty(trimmedMsg)) {
            continue;
          }
          try {
            yield JSON.parse(trimmedMsg);
          } catch (e) {
            // 将中间的解析失败视为脏数据，记录并跳过，以保证流的健壮性。
            ctx.__logger__.warn(
              `[StreamHttpUtils] Skipping malformed JSON message: "${trimmedMsg}"`,
            );
          }
        }

        // --- 单独、精确地验证最后一个可能不完整的消息 ---
        // 这是整个健壮性设计的核心：区分“脏数据”和“网络分片”。
        const trimmedLast = lastPotentialMessage.trim();
        if (_.isEmpty(trimmedLast)) {
          // 如果为空，说明数据块恰好以分隔符结尾，缓冲区已处理完毕。
          buffer = '';
          continue;
        }

        try {
          // 尝试解析，成功则为完整 JSON，可以发送。
          yield JSON.parse(trimmedLast);
          // 消息是完整的，缓冲区已处理完毕。
          buffer = '';
        } catch (e) {
          // 解析失败，则唯一合理的假设是它是一个不完整的网络分片。
          // 将其与 separator 一起放回缓冲区，等待下一个 chunk。
          buffer = separator + lastPotentialMessage;
        }
      }

      // --- 处理流末尾的残留数据 ---
      // 当整个数据流结束后，缓冲区中可能残留最后一部分数据。
      if (!_.isEmpty(buffer)) {
        const finalMessage = buffer.startsWith(separator)
          ? buffer.substring(separator.length)
          : buffer;
        const trimmedFinal = finalMessage.trim();
        if (!_.isEmpty(trimmedFinal)) {
          try {
            // 只在最后残留的数据是完整 JSON 的情况下，才发送它。
            yield JSON.parse(trimmedFinal);
          } catch (e) {
            // 如果最后剩下的不是完整的 JSON，则静默丢弃，不发送错误片段。
            ctx.__logger__.warn(
              `[StreamHttpUtils] Discarding incomplete final message fragment: "${trimmedFinal}"`,
            );
          }
        }
      }
    }

    let cachedContent = '';
    let isOverReqLimit = false;

    try {
      // 2. 主逻辑：在一个循环内处理所有消息，无任何重复
      for await (const parsed of messageGenerator()) {
        // 使用标准 SSE 格式：data: <JSON>\r\n\r\n
        const message = `data: ${JSON.stringify(parsed)}\r\n\r\n`;
        // 验证响应格式
        if (parsed.statusCode !== 200) {
          const errorCode = parsed.data?.errorCode;
          if (errorCode) {
            // 如果存在错误码，需要输出这个错误
            writeStream.write(message);

            if (
              [
                QuestionErrorCodeEnum.QUESTION_TYPE_FUZZY,
                QuestionErrorCodeEnum.QUESTION_TYPE_INCOMPLETE,
              ].includes(errorCode)
            ) {
              ctx.__updateQuestionInfo({ isIncompleteTypeError: true });
              ctx.__logger__.warn(
                `[StreamHttpClient][errorCode:${errorCode}], 跳过 JPUSH 和后续流程`,
              );
            }
          }

          throw new Error(`Stream error: ${message}`);
        }

        const { content, command } = parsed.data;

        // 错误命令处理
        if (command === 'error') {
          throw new Error('Stream processing failed');
        }

        writeStream.write(message);

        // 命令处理
        switch (command) {
          case 'all':
            ctx.__logger__.info('[StreamHttpClient][command = all]');
            cachedContent = content;
            return { content: cachedContent, isOverReqLimit };
          case 'done':
            ctx.__logger__.info('[StreamHttpClient][command = done]');
            cachedContent = content;
            return { content: cachedContent, isOverReqLimit, isDone: true };
          case 'overReqLimit':
            ctx.__logger__.info('[StreamHttpClient][command = overReqLimit]');
            isOverReqLimit = true;
            break;
          default:
            cachedContent = content;
        }
      }

      // 当流正常结束（没有 all 或 done 命令）时返回最终状态
      return { content: cachedContent, isOverReqLimit };
    } catch (error) {
      // 输出错误，使用标准 SSE 格式
      const errorMessage = JSON.stringify({
        statusCode: 510,
        data: { content: 'streamRequest error', command: 'error' },
      });
      writeStream.write(`data: ${errorMessage}\r\n\r\n`);
      // 捕获到错误时，确保销毁流，防止资源泄漏
      responseStream.destroy();
      if (writeStream && !writeStream.destroyed) {
        writeStream.end();
      }
      if (ctx.__question_info__?.isIncompleteTypeError) {
        // 已知业务场景，直接返回
        ctx.__logger__.warn(`[StreamHttpClient] Stream processing exit via: ${error.message}`);
        return { isDone: true, content: 'skip via isIncompleteTypeError' };
      }
      ctx.__logger__.error(`[StreamHttpClient] Stream processing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Public Server 流式请求（公共 API）
   * @param {string} path - API 路径
   * @param {Object} params - 请求参数
   * @param {Object} files - 文件列表
   * @return {Promise<Object>} 响应结果
   */
  async publicServerStreamRequest(path, params, files = []) {
    const { ctx, app } = this;
    const { __question_info__ } = ctx;
    const customHeaders = __question_info__?.__headers__ || {};

    // 设置标准 SSE 响应头
    if (!ctx.response.headerSent) {
      ctx.set('Content-Type', 'text/event-stream');
      ctx.set('Cache-Control', 'no-cache');
      ctx.set('Connection', 'keep-alive');
      ctx.status = 200;
      ctx.respond = false;
    }

    const baseUrl = app.config.commonServiceConfig.host;
    const url = `${baseUrl}${path}`;

    return this.streamRequest(
      url,
      params,
      { separator: 'solvelyPublicServer: ', writeStream: ctx.writeStream || ctx.res },
      { headers: { platform: 'web', ...customHeaders }, timeout: 300000, files },
    );
  }
}

module.exports = StreamHttpUtils;
