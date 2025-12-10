const { Service } = require('egg');
const http = require('http');
const _ = require('lodash');

const moment = require('moment-timezone');

class BaseService extends Service {
  throwError(message, error) {
    this.ctx.throw(error ? `${message}, ${error}` : `${message}`);
  }
  /**
   * 三方服务调用
   * @param {string} pathUrl 调用地址
   * @param {string} method 调用方法
   * @param {object} message 发送消息
   * @param {object} headers 请求头
   * @param {string} serverName 服务名
   * @param {array} files 文件
   */
  async requestMessage(
    pathUrl,
    method = 'POST',
    message = {},
    headers = {},
    serverName = '',
    files = [],
  ) {
    const { ctx, app } = this;
    const baseUrl = app.config.commonServiceConfig.host;
    const taskLogger = app.getLogger('taskLogger');
    const url = `${baseUrl}${pathUrl}`;
    try {
      const option = {
        method,
        data: message,
        timeout: 60000,
        headers: { platform: 'ios', 'Content-Type': 'application/json', ...headers },
        dataType: 'json',
      };
      if (files.length > 0) {
        option.files = files;
      }
      const result = await ctx.curl(url, option);
      if (result.status !== 200) {
        taskLogger.error(
          `调用第三方服务失败, ${serverName} result:${ctx.helper.JsonUtils.safeStringifyJson(result, '')}`,
        );
        return this.throwError(`调用第三方服务失败`);
      }
      return result.data;
    } catch (error) {
      taskLogger.error(`调用第三方服务失败, error:${error}`);
      this.throwError(`调用第三方服务失败`);
    }
  }
  /**
   * public 服务调用
   * todo 需要将 pathUrl & method 做成枚举
   * @param {string} pathUrl 调用地址
   * @param {"POST" | "GET"} method 调用方法
   * @param {object} message 发送消息
   * @param {object} headers 请求头
   * @param {array} files 文件
   */
  publicServerRequest(pathUrl, method = 'POST', message = {}, headers = {}, files = []) {
    return this.requestMessage(pathUrl, method, message, headers, 'solvelyPubServerUrl', files);
  }

  /**
   * public 服务 POST 调用
   * @param {string} pathUrl 调用地址
   * @param {object} message 发送消息
   * @param {object} headers 请求头
   * @param {array} files 文件
   */
  publicServerPostRequest(pathUrl, message = {}, headers = {}, files = []) {
    return this.requestMessage(pathUrl, 'POST', message, headers, 'solvelyPubServerUrl', files);
  }

  /**
   * public 服务 POST 调用
   * @param {string} pathUrl 调用地址
   * @param {object} message 发送消息
   * @param {object} headers 请求头
   * @param {array} files 文件
   */
  publicReadServerPostRequest(pathUrl, message = {}, headers = {}, files = []) {
    return this.requestMessage(
      pathUrl,
      'POST',
      message,
      headers,
      'solvelyPubServerNewRdsUrl',
      files,
    );
  }

  /**
   * public 服务 GET 调用
   * @param {string} _pathUrl 调用地址
   * @param {object} message 发送消息
   * @param {object} headers 请求头
   */
  publicServerGetRequest(_pathUrl, message = {}, headers = {}) {
    const pathUrl = `${_pathUrl}?${Object.keys(message)
      .filter((key) => message[key] !== null && message[key] !== undefined && message[key] !== '')
      .map((key) => `${key}=${encodeURIComponent(message[key])}`)
      .join('&')}`;
    return this.requestMessage(pathUrl, 'GET', {}, headers, 'solvelyPubServerUrl');
  }

  /**
   * 调用三方流式接口
   * @param {object} params 传参
   * @param {object} ctx 上下文
   * @param {string} path 接口地址
   * @param {boolean} waitHttpClose 是否等待http关闭
   * @param {object} _interceptor 拦截中断器, 这里是一次性停止，不会类似流式的 stream 和 event 的方式
   */
  async streamingSolveQuestionByPublicServer(
    params,
    ctx,
    path,
    waitHttpClose = false,
    _interceptor = null,
  ) {
    const writeStream = ctx.res;
    // 设置响应头为流式JSON
    ctx.set('Content-Type', 'application/json');
    ctx.status = 200;
    // 确保不会自动关闭响应
    ctx.respond = false;
    try {
      let cachedData = '';
      let isOverReqLimit = false;
      let truncatedData = ''; // 缓存被截断的数据

      let requestFunction = this.sendRequestAndGetDataStreaming;
      if (waitHttpClose) {
        requestFunction = this.sendRequestAndGetDataStreamingWaitHttpClose;
      }
      const interceptor = typeof _interceptor === 'function' ? _interceptor : null;

      await requestFunction(
        {
          hostname: ctx.app.config.serverUrls.solvelyPubServerUrl.baseHttpUrl,
          port: 80, // HTTP默认端口号
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            platform: 'ios',
          },
          timeout: 300000, // 超时时间为 5分钟
        },
        JSON.stringify(params),
        (dataBuffer) => {
          if (!dataBuffer || !dataBuffer.length) {
            return false;
          }
          const bufferString = dataBuffer.toString('utf-8');
          const streamContentList = bufferString.split('solvelyPublicServer: ');
          for (let response of streamContentList) {
            if (response === '') {
              continue;
            }
            if (truncatedData !== '') {
              response = truncatedData + response;
              truncatedData = '';
            }
            let dataParse;
            try {
              dataParse = JSON.parse(response);
            } catch (e) {
              truncatedData = response;
              break;
            }
            if (dataParse.statusCode !== 200) {
              throw new Error(
                `interface of public server error, path:${path} statusCode:${dataParse.statusCode}`,
              );
            }
            const { content, command } = dataParse.data;
            if (command === 'error') {
              throw new Error(`questionId: ${params.questionId} push error`);
            }

            // 拦截器处理
            const interceptorResult = interceptor?.(content);
            if (interceptorResult?.pass) {
              /**
               * ! 注意这里是一次性拦截器而不是流式替换
               * formatContent 二次处理是考虑到我们针对落库数据也需要做格式化
               * formatText 是格式化后的内容，需要给 APP 显示
               */
              const { formatText, formatContent } = interceptorResult;
              cachedData = formatContent; // cachedData 是原始内容，用于保存到数据库中，让 web 正常渲染
              writeStream.write(formatText);
              return true; // 终止后续处理
            }

            writeStream.write(response);
            cachedData += content;
            if (command === 'done') {
              return true;
            } else if (command === 'all') {
              cachedData = content;
              return true;
            } else if (command === 'overReqLimit') {
              isOverReqLimit = true;
            }
          }
          return false;
        },
      );
      return { answerData: cachedData, isOverReqLimit };
    } catch (e) {
      writeStream.write(
        JSON.stringify({
          statusCode: 510,
          data: { content: '', command: 'error' },
          message: '解题失败',
        }),
      );
      throw e;
    } finally {
      writeStream.end();
    }
  }
  /**
   * 发送请求,然后流式的接收数据
   * @param {string} requestOptions https请求参数
   * @param {object} dataSend 向服务器发送的数据
   * @param {Function} handleWhenData 当数据流返回时触发 df => {console.log(df)};
   */
  sendRequestAndGetDataStreaming(requestOptions, dataSend, handleWhenData) {
    return new Promise((resolve, reject) => {
      if (!requestOptions || !handleWhenData) {
        return reject(new Error('params error'));
      }
      let sendDataDone = false;
      const req = http.request(requestOptions, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error('statusCode error:' + res.statusCode));
        }
        res.on('data', (df) => {
          try {
            sendDataDone = handleWhenData(df);
            if (!sendDataDone) {
              return;
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        res.on('end', () => {
          sendDataDone ? resolve() : reject(new Error('sendData not done'));
        });
      });
      // 将请求内容写入请求中
      req.write(dataSend);
      // 发送一次请求
      req.end();
      // 监听请求错误事件
      req.on('error', (err) => {
        reject(err);
      });
      // 超时监听
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('request timeout'));
      });
    });
  }

  /**
   * 发送请求,然后流式的接收数据,在收到done时，不终止，等到http关闭时再终止
   * @param {string} requestOptions https请求参数
   * @param {object} dataSend 向服务器发送的数据
   * @param {Function} handleWhenData 当数据流返回时触发 df => {console.log(df)};
   */
  sendRequestAndGetDataStreamingWaitHttpClose(requestOptions, dataSend, handleWhenData) {
    return new Promise((resolve, reject) => {
      if (!requestOptions || !handleWhenData) {
        return reject(new Error('params error'));
      }
      let sendDataDone = false;
      const req = http.request(requestOptions, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error('statusCode error:' + res.statusCode));
        }
        res.on('data', (df) => {
          try {
            sendDataDone = handleWhenData(df);
            if (!sendDataDone) {
              return;
            }
            // 因为会提前结束流程，而第三方没有完全处理完信息，所以，收到done命令后，不立即结束，而需要处理完所有数据后结束
            // resolve();
          } catch (e) {
            reject(e);
          }
        });
        res.on('end', () => {
          sendDataDone ? resolve() : reject(new Error('sendData not done'));
        });
      });
      // 将请求内容写入请求中
      req.write(dataSend);
      // 发送一次请求
      req.end();
      // 监听请求错误事件
      req.on('error', (err) => {
        reject(err);
      });
      // 超时监听
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('request timeout'));
      });
    });
  }

  /**
   * 保存题目埋点到bq
   * @param {object} pointData 题目信息
   * @property {string} eventName 事件名
   * @property {string} platform 平台
   * @property {string} accountType 账号类型
   * @property {string} [account] 账号 (可为空)
   * @property {Date} executionTime 执行时间
   * @property {number} promptToken
   * @property {number} [completionToken] (可为空)
   * @property {string} [modelName] (可为空)
   * @property {Date} [createTime] (可为空)
   * @property {string} [questionId] (可为空)
   * @property {string} [deviceId] (可为空)
   * @property {number} [feedback] (可为空)
   * @property {string} [errorDetail] (可为空)
   */
  async saveServerEventToBq(pointData) {
    const now = moment().tz('Asia/Shanghai');
    const nowTime = now.format('YYYY-MM-DD HH:mm:ss');
    try {
      const data = {
        datasetId: 'Solvely',
        tableId: 'ServerEventTracking',
        questionInfos: [
          {
            ...pointData,
            createTime: nowTime,
          },
        ],
      };
      const url = `/solvelyPubServer/recordQuestion/v1`;
      return await this.publicServerRequest(url, 'POST', data, {
        'content-type': 'application/json',
      });
    } catch (error) {
      this.ctx.logger.error('saveQuestionInfoToBq, error:' + error);
      return true;
    }
  }
  safeParseJson(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }
  safeStringifyJson(obj) {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      return obj;
    }
  }

  /**
   * 写入流数据方法，碰到done 或者error 会关闭流
   * @param {Object} streamObj
   * @param {Object} options
   * @param {String} options.serverPrefix
   * @param {String} options.statusCode
   */
  ctxWriteStream(streamObj, options = {}) {
    const { ctx, app } = this;
    const { command } = streamObj;
    const { serverPrefix = '', statusCode = '' } = options || {};

    // Don't write if the response has already ended
    if (ctx.res.writableEnded) {
      return;
    }

    // 检查响应头是否已经发送, 防止重复设置导致的错误
    if (!ctx.response.headerSent) {
      // 设置响应头为标准 SSE 格式
      ctx.set('Content-Type', 'text/event-stream');
      ctx.set('Cache-Control', 'no-cache');
      ctx.set('Connection', 'keep-alive');
      ctx.status = 200;

      // 确保不会自动关闭响应
      ctx.respond = false;
    }

    const defaultResponse = {
      statusCode: statusCode || (['error'].includes(command) ? 400 : 200),
      data: { content: '', command: 'pending' },
    };
    _.assign(defaultResponse.data, streamObj);

    // 使用标准 SSE 格式：data: <JSON>\r\n\r\n
    const streamMsg = `${serverPrefix}data: ${JSON.stringify(defaultResponse)}\r\n\r\n`;
    if ((ctx.__logger__ && app.config.env !== 'prod') || ctx.__logger_forceStore__) {
      ctx.__logger__?.store(streamMsg);
    }
    ctx.res.write(streamMsg);

    // 增加判断命令，决定是否关闭流
    if ((command === 'done' || command === 'error') && !ctx.res.writableEnded) {
      ctx.res.end();
    }
  }
}

module.exports = BaseService;
