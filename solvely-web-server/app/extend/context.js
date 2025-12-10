/**
 * 添加自定义属性，在 V9 之后使用
 */
const _ = require('lodash');
const { produce } = require('immer');
const { getTimeDiffCurry } = require('./utils/time');

// 使用 Symbol 创建一个唯一的、私有的 key，防止外部意外访问和冲突
const SYMBOL_QUESTION_INFO = Symbol('Context#__question_info__');
const SYMBOL_LOGGER = Symbol('Context#___logger__');
const SYMBOL_PROCESS_INFO = Symbol('Context#__process_info__');

module.exports = {
  /** ************************************ 解题信息相关 **************************************/

  /**
   * 使用 _.merge 深度合并数据到 __question_info__
   * @param {object} info
   */
  __updateQuestionInfo(info) {
    if (!_.isObject(info) || _.isArray(info)) {
      this.app.logger.warn(
        '[updateQuestionInfo] The provided data is not an object(exclude array), update skipped.',
      );
      return;
    }

    // 这里的 produce 在任何环境下都会返回一个冻结的对象
    this[SYMBOL_QUESTION_INFO] = produce(this[SYMBOL_QUESTION_INFO] || {}, (draftState) => {
      _.merge(draftState, info);
    });
  },

  /**
   * 返回一个冻结的对象
   * 直接返回即可，因为 produce 的结果已经被自动冻结了
   */
  get __question_info__() {
    /**
     * 直接返回即可，因为 produce 的结果已经被自动冻结了
     */
    return this[SYMBOL_QUESTION_INFO] || produce({}, () => {}); // 返回一个冻结的空对象
  },

  /** ************************************ logger 相关 **************************************/

  /**
   * 这里之所以显示声明 header 是为了约定 logger 的内容应该来自公共部分
   * ! 尝试从 body 和 query 中获取 questionId & answerId
   * @param {Object} header 头部信息对象
   * @return {void}
   */
  __initLogger(header) {
    if (_.isEmpty(header) || !_.isObject(header)) {
      throw new Error('could not init logger due to empty or un-object header');
    }
    const logger = this.logger;

    /**
     * 尝试获取 body 和 query 中的 questionId & answerId
     * 优先级，header > body > query
     */
    const data = _.assign(
      {},
      _.pick(this.request.query, ['questionId', 'answerId']),
      _.pick(this.request.body, ['questionId', 'answerId']),
      header,
    );
    const logPrefix = `[${JSON.stringify(data)}]`;
    const startTime = data.serverTime || Date.now();
    const timeDiff = getTimeDiffCurry(startTime);

    const messages = [];
    const error = (message) => {
      logger.error(`${logPrefix},[duration:${timeDiff()}],${message}`);
    };
    const info = (message) => {
      logger.info(`${logPrefix},[duration:${timeDiff()}],${message}`);
    };
    const warn = (message) => {
      logger.warn(`${logPrefix},[duration:${timeDiff()}],${message}`);
    };
    const store = (message) => {
      messages.push(message);
    };
    const output = () => {
      info(`[total steam output]: ${messages.join('')}`);
    };
    const destroy = () => {
      info(`[__logger__] destroy`);
      messages.length = 0;
      this[SYMBOL_LOGGER] = null;
    };
    info('__logger__ init success');
    this[SYMBOL_LOGGER] = { error, info, warn, store, output, destroy };
  },

  /**
   * 获取当前上下文的 logger 实例
   * @return {{
   *   error: (message: string) => void,
   *   info: (message: string) => void,
   *   warn: (message: string) => void,
   *   store: (message: string) => void,
   *   output: () => void,
   *   store: (message: string) => void, // 存储消息，用于后续输出
   *   destroy: () => void,
   * }} logger 实例
   */
  get __logger__() {
    return this[SYMBOL_LOGGER]; // 注意这里为了区分是否是开启 __logger__, 没有默认值
  },

  /** ******************************* process module 执行相关 *********************************/

  /**
   * 更新 module 执行过程的细节
   * @param {Object} info
   * @param {string} info.name module 的名称
   * @param {Object} info.result module 的执行结果
   * @return {void}
   */
  __updateProcessInfo(info) {
    this[SYMBOL_PROCESS_INFO] = produce(this[SYMBOL_PROCESS_INFO] || {}, (draftState) => {
      _.merge(draftState, info);
    });
  },

  /**
   * 获取 module 执行过程的细节
   * @return {Record<string, {
   *   name: string,
   *   result: {
   *     success: boolean,
   *     stage: string,
   *     error: string,
   *     result: any
   *     [key: string]: any
   *   }
   * }>}
   */
  get __process_info__() {
    return this[SYMBOL_PROCESS_INFO] || produce({}, () => {});
  },

  /** ************************************ BQ 打点 **************************************/

  /**
   * 通用事件上报
   *
   * @param {object} eventInfo 事件信息
   */
  __trackServerEvent(eventInfo) {
    // 基础属性来自 header，必带
    const {
      requestId,
      requestTime,
      appVersion,
      language,
      platform,
      deviceId,
      userGroupLabel,
      serverTime,
      pictureKey,
      solveCount = -1,
      experimental,
    } = this.__question_info__;
    eventInfo.requestId = requestId;
    eventInfo.requestTime = requestTime;
    eventInfo.appVersion = appVersion;
    eventInfo.language = language;
    eventInfo.platform = platform || 'web';
    eventInfo.deviceId = deviceId;
    eventInfo.userGroupLabel = userGroupLabel;
    eventInfo.requestDuration = ((Date.now() - requestTime) / 1000).toFixed(2);
    eventInfo.serverTime = serverTime;
    eventInfo.serverDuration = ((Date.now() - serverTime) / 1000).toFixed(2);
    eventInfo.apiVersion = 'v9/web';
    eventInfo.requestTimespan = eventInfo?.requestTimespan || Date.now();

    // 其他可能存在的属性, 以 evenInfo 为主
    const { questionId, answerId, answerType } = this.__question_info__;
    eventInfo.questionId = eventInfo.questionId || questionId;
    eventInfo.answerId = eventInfo.answerId || answerId;
    eventInfo.answerType = eventInfo.answerType || answerType;
    eventInfo.imageUrls = eventInfo.imageUrls || pictureKey;
    eventInfo.solveCount = eventInfo.solveCount || solveCount;
    eventInfo.experimental = eventInfo.experimental || experimental;

    this.__logger__.info(`[trackServerEvent] ${JSON.stringify(eventInfo)}`);
    this.service.common.saveQuestionInfoToBq(eventInfo, 'Solvely', 'ServerEventTracking');
  },
};
