const _ = require('lodash');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const uuid = require('uuid');
const moment = require('moment');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const TimeUtils = require('./utils/time');
const JsonUtils = require('./utils/json');
const ImageUtils = require('./utils/image');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises'); // 使用 stream/promises API
const path = require('path');

// handleStreamRequest的options默认参数，写在这儿是因为要保证可读性
const handleStreamRequestDefaultOptions = {
  method: 'POST',
  // front to back timeout，即前端到业务后端的超时时间，默认5分钟
  f2bTimeout: 5 * 60 * 1000,
  headers: {
    'Content-Type': 'application/json',
    platform: 'web',
  },
  // 业务后端到远程调用的超时时间
  timeout: 5000,
};

module.exports = {
  TimeUtils,
  JsonUtils,
  ImageUtils,

  /**
   * @param {string} url 被代理的远程URL
   * @param {object} extData 请求参数
   * @param {object} options 代理请求的配置，例如超时时间 @see https://www.eggjs.org/core/httpclient/
   * @example 方法会根据配置的`commonServiceConfig.host`把这个参数拼接为一个合法URL，如果直接传一个合法url，则不会做拼接
   *  1. 合法url  -- http://54.250.57.140/solvelyPubServer/v1/tutor/message/feedback
   *  2. 绝对路径  -- /solvelyPubServer/v1/tutor/message/feedback
   *  3. 相对路径  -- solvelyPubServer/question/message/feedback/v1
   * @description 纯做中间层，对于请求和响应不做任何理解和处理，
   *  1. 前端怎么样传的，就怎么样转发给RPC服务
   *  2. RPC服务怎么响应的，就怎么响应给前端
   */
  async proxy(url, extData = {}, options = {}) {
    const { ctx } = this;
    const commonUrl = ctx.app.config.commonServiceConfig.host;
    // 说明是非法URL，即参数是一个`绝对路径`或者`相对路径`，此时需要根据配置做拼接，以形成一个合法URL
    if (!url.startsWith('http')) {
      url = url.startsWith('/') ? `${commonUrl}${url}` : `${commonUrl}/${url}`;
    }

    const { method, headers, body: data = {}, query = {} } = ctx.request;
    // eslint-disable-next-line no-unused-vars
    const { host, ...headersWithoutHost } = headers;
    const proxyOptions = {
      method,
      headers: { ...headersWithoutHost, platform: 'web' },
      data: method === 'GET' ? query : Object.assign(data, extData), // 如果是GET请求，使用query参数
      ...options,
    };
    const MITE_TYPE_JSON = 'application/json';
    /**
     * 根据Accept请求头决定是否设置dataType，如果不设置的话，那么
     * 在控制台打印响应体的话是buffer，可读性不好，虽然绝大多数情况下代理的接口返回的都是
     * `application/json`类型，但是也有特殊情况，比如返回的是一个`html`文档
     * 所以需要根据请求头来决定是否设置dataType，不设置dataType的话，对于所有
     * 的响应体都没有问题，会更加灵活，但是可读性不好，所以只针对请求头
     * accept为`application/json`的情况设置dataType，其他就不设置了，
     * 具备更好的灵活性
     */
    if (headers.accept?.includes(MITE_TYPE_JSON)) {
      proxyOptions.dataType = 'json';
    }

    const response = await ctx.curl(url, proxyOptions);
    ctx.status = response.status;
    ctx.set(response.headers);
    // 根据响应的Content-Type来决定如何处理响应数据
    const contentType = response.headers['content-type'];
    if (contentType && contentType.includes(MITE_TYPE_JSON)) {
      ctx.body = response.data;
    } else {
      // 对于非JSON响应（如HTML），直接返回原始数据
      ctx.body = response.data?.toString();
    }
  },
  /**
   * @description 生成questionId
   * @return {string} questionId，形如：2024_09_09_7f6e655f-ec80-4a9e-b8aa-64560e0f5968
   */
  generateQuestionId() {
    return `${moment().format('YYYY_MM_DD')}_${uuid.v4()}`;
  },
  /**
   *
   * @param {string} url
   * @param {object} options
   * @description
   *     处理「前端 -> 业务后端 -> 远程调用」请求；
   *     从反方向，即「前端 <- 业务后端 <- 远程调用」响应流式数据，如果业务后端需要处理远程调用返回的流式数据，
   *     需要在options中传递RPC调用的响应处理函数`hanldeRpcResponse`，在此方法中写处理逻辑
   */
  handleStreamRequest(url, options = handleStreamRequestDefaultOptions) {
    const { ctx } = this;
    // 处理入参，使用传入的options（优先级更高），覆盖默认的，并统一合并到一个新对象上，防止影响handleStreamRequestDefaultOptions的值
    options = Object.assign(Object.create(null), handleStreamRequestDefaultOptions, options);

    const { f2bTimeout, data, hanldeRpcResponse } = options;
    // 删除与调用public服务不相干的属性，防止publish那边参数校验不通过，同时降低网络发送量
    Reflect.deleteProperty(options, 'f2bTimeout');
    Reflect.deleteProperty(options, 'data');
    Reflect.deleteProperty(options, 'hanldeRpcResponse');
    // 设置超时时间，默认为5分钟
    ctx.req.setTimeout(f2bTimeout);
    ctx.res.setTimeout(f2bTimeout);
    ctx.status = 200;
    // 从 Egg.js 响应中获取原生 Node.js 可写流对象
    const stream = ctx.res;
    // 确保不会自动关闭响应
    ctx.respond = false;

    // 设置响应头，表明这是一个事件流响应
    ctx.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // 创建连接到外部API的请求，并使用外部传入的hanldeRpcResponse来处理
    const rpcRequest = http.request(url, options, (res) => {
      /**
       * 此回调只执行一次！https://nodejs.org/docs/v20.17.0/api/http.html#event-response
       * res的headers:
       * {
       *  server: 'nginx/1.18.0 (Ubuntu)',
       *  date: 'Tue, 10 Sep 2024 06:02:59 GMT',
       *  'content-type': 'application/json',
       *  'transfer-encoding': 'chunked'
       *  connection: 'keep-alive'
       * }
       */
      hanldeRpcResponse(res, stream);
    });

    // 给public接口发送数据
    rpcRequest.write(JSON.stringify(data));
    // 监听错误事件，包括：DNS解析错误、TCP级别错误、HTTP解析错误等等都会触发error事件，此时应关闭「前端 -> 业务server」的连接
    rpcRequest.on('error', () => stream.end());
    // 前端到业务后端的连接关闭时，关闭业务后端到外部API的连接
    stream.on('close', () => rpcRequest.destroy());
    // 发送数据
    rpcRequest.end();
  },
  /**
   * md5 加密
   * @param {String} content 明文
   */
  _md5(content) {
    const md5 = crypto.createHash('md5');
    return md5.update(content).digest('hex');
  },
  /**
   * 根据deviceId拿到question表
   * @param {string} deviceId 设备id
   */
  async _getModelByDeviceId(deviceId) {
    const { app } = this;
    const upDeviceId = _.upperCase(deviceId);
    const hex = this._md5(upDeviceId)[0];
    const model = await app.questionTable(hex);
    return model;
  },
  /**
   * 根据deviceId拿到question表
   * @param {string} deviceId 设备id
   */
  async _getAnswerMoreModel(deviceId) {
    const { app } = this;
    const upDeviceId = _.upperCase(deviceId);
    const hex = this._md5(upDeviceId)[0];
    const model = await app.answerMoreTable(hex);
    return model;
  },
  /**
   * 检查firebase uid是否存在
   * @param {string} uid firebase uid
   */
  async checkFirebaseUid(uid) {
    if (!uid) {
      return false;
    }
    try {
      const { ctx } = this;
      await ctx.firebaseAdmin.auth().getUser(uid);
      return true;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return false;
      }
      throw error;
    }
  },
  /**
   * 修改firebase用户userName
   * @param {string} uid firebase uid
   * @param {string} userName 用户名
   */
  async updateFirebaseUserName(uid, userName) {
    try {
      const { ctx } = this;
      await ctx.firebaseAdmin.auth().updateUser(uid, {
        displayName: userName,
      });
    } catch (error) {
      throw error;
    }
  },
  /**
   * 上传图片到S3
   * @param {*} file 文件
   * @param {string} key 文件名
   * @param {string} bucket 存储桶名
   */
  async uploadPictureS3(file, key = '', bucket = 'questionImage') {
    const { ctx } = this;
    const stream = fs.createReadStream(file.filepath); // 创建文件读取流
    let pictureKey = '';
    if (key === '') {
      pictureKey = uuid.v4();
    } else {
      pictureKey = key;
    }
    const params = {
      Bucket: 'solve-now',
      Key: `${bucket}/${pictureKey}.webp`, // 设置上传到S3的文件名
      Body: stream,
      ContentType: file.mime, // 设置文件MIME类型
      ACL: 'public-read', // 设置文件访问权限
    };
    try {
      await ctx.s3Client.send(new PutObjectCommand(params)); // 上传文件至S3
      const baseUrl = `https://solve-now.s3.us-west-2.amazonaws.com/${bucket}/${pictureKey}.webp`;
      // 返回上传成功的结果和文件URL
      return baseUrl;
    } catch (error) {
      ctx.throw(new Error(`上传图片到S3失败: ${error}`));
    }
  },
  /**
   * @description 处理图片路径 OSS地址 -> CDN地址
   * @param {string} url 图片路径
   * @param {number} timestamp 时间戳
   */
  handlePictureUrl(url, timestamp = 0) {
    if (url === '') {
      return url;
    }
    const originHost = 'https://solve-now.s3.us-west-2.amazonaws.com'; // S3源地址
    const cdnHost = 'https://static.justsolvely.com'; // CDN地址
    const thumbnailHost = 'https://thumbnail.justsolvely.com'; // 压缩文件的地址
    url.startsWith('/') && (url = cdnHost + url);
    let newUrl = url.replace(originHost, cdnHost);
    if (timestamp > 1710259200000) {
      newUrl = newUrl.replace(cdnHost, thumbnailHost).replace('.webp', '_thumb.webp');
    }
    return newUrl;
  },
  /**
   * - 生成更新表达式和表达式属性值
   * @param {Object} params - 需要更新的键值对
   * return - 返回更新表达式和表达式属性值
   */
  generateUpdateExpression(params) {
    let updateExpression = 'set';
    const expressionAttributeValues = {};

    const expressions = _.map(params, (value, key) => {
      expressionAttributeValues[`:${key}`] = value;
      return `${key} = :${key}`;
    }).join(', ');

    updateExpression += ` ${expressions}`;

    return { updateExpression, expressionAttributeValues };
  },
  /**
   * - 返回字符串长度, 不包含空格
   * @param {String} str - 字符串
   * return - 返回字符串长度
   */
  countStrLength(str) {
    return str.replace(/\s/g, '').length;
  },
  // 获取str前n个字符，不包括空格
  getStrPrefix(str, n) {
    let count = 0;
    let i = 0;
    while (count < n && i < str.length) {
      if (str[i] !== ' ') {
        count++;
      }
      i++;
    }
    return str.substring(0, i);
  },
  // 是否是图片题
  isImageQuestion(line_data = []) {
    const lineDataTypes = line_data.map((item) => item.type);
    const detectionList = ['diagram', 'chart'];
    const hasDetections = lineDataTypes.some((element) => detectionList.includes(element));
    if (hasDetections) {
      return true;
    }
    return false;
  },
  // 获取真实ip
  getRealIp() {
    const { ctx } = this;
    try {
      const ips = ctx.get('X-Forwarded-For');
      const ip = ips.split(',')[0];
      return ip;
    } catch (e) {
      return '';
    }
  },
  // 生成订单id
  generateOrderId() {
    const { app } = this;
    const env = app.config.env;
    const uniqueId = uuid.v4();
    const orderId = Buffer.from(uniqueId).toString('base64');
    // 添加根据时间戳随机生成的字符串
    const timestamp = new Date().getTime();
    return `cs_${env}_${orderId}_${timestamp}`;
  },
  /**
   * 给前端发送流式响应
   * @param {Object} ctx - Egg.js 的上下文对象
   * @param {Object} data - 要发送的数据
   * @param {Object} [options] - 可选配置项
   * @param {boolean} [options.isEnd=false] - 是否结束响应流
   */
  streamResponse(ctx, data, options = {}) {
    const { res } = ctx;
    ctx.status = 200;
    ctx.respond = false;
    ctx.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (options.isEnd) {
      res.end();
    }
  },
  /**
   * 生成intercom的user_hash
   * @param {string} deviceId 用户id
   * @return {string} user_hash
   */
  generateIntercomUserHash(deviceId) {
    const secret = this.app.config.intercomSecret;
    return crypto.createHmac('sha256', secret).update(deviceId).digest('hex');
  },
  /**
   * 获取前端生成的_ga cookie，拿到user_pseudo_id
   * @description 获取用户_ga cookie，形如：GA1.1.1158169022.1724669265
   * @return {string} 处理后的user_pseudo_id，形如:1158169022.1724669265
   */
  getGaId() {
    const { ctx } = this;
    try {
      const _ga = ctx.cookies.get('_ga', { signed: false });
      return _ga.split('.').splice(2).join('.');
    } catch (e) {
      return '';
    }
  },

  /**
   * 下载S3文件
   * @param {*} url
   * @return {string} 下载后的本地地址
   */
  async downloadS3FileForS3Client(url) {
    const { ctx } = this;

    url = url.startsWith('http') ? new URL(url).pathname : url;
    url = url.startsWith('/') ? url.slice(1) : url;

    const localFilePath = `/tmp/${path.basename(url)}`;

    const command = new GetObjectCommand({
      Bucket: 'solve-now',
      Key: url,
    });

    try {
      const data = await ctx.s3Client.send(command);
      await pipeline(data.Body, createWriteStream(localFilePath));
      return { filepath: localFilePath, mime: 'image/webp' };
    } catch (error) {
      throw error;
    }
  },
};
