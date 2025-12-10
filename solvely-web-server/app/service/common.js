const { Service } = require('egg');
const http = require('http');
const { answerMoreDetails, questionInsertPrompt } = require('../common/prompts');
const languageMap = require('../common/languageMap');
const _ = require('lodash');
const moment = require('moment-timezone');

const commandMap = {
  Elaborate: 'Please elaborate on {FOLLOW-UP}.',
  Explain: 'Please elaborate on {FOLLOW-UP}.',
  Erläutern: 'Please elaborate on {FOLLOW-UP}.',
  Shorten: 'Please explain {FOLLOW-UP} with less words.',
  Simplify: 'Please explain {FOLLOW-UP} with less words.',
  Kürzen: 'Please explain {FOLLOW-UP} with less words.',
  'Wrong step': 'Please double check whether {FOLLOW-UP} is correct.',
  'Fix mistakes': 'Please double check whether {FOLLOW-UP} is correct.',
  'Falscher Schritt': 'Please double check whether {FOLLOW-UP} is correct.',
};

class CommonService extends Service {
  constructor(ctx) {
    super(ctx);
    this.commonUrl = ctx.app.config.commonServiceConfig.host;
  }
  // 获取汇率
  async getRate(currency) {
    const { ctx } = this;
    const rate = await ctx.model.UsdRate.findOne({
      raw: true,
      where: {
        currency,
      },
    });
    return rate.rate;
  }
  /**
   * 获取转完美金后的金额
   * @param {String} currency 币种
   * @param {Number} amount 金额
   * @return {Number} 转完美元后的金额
   */
  async getUsdAmount(currency, amount) {
    if (currency === 'usd') {
      return +(amount / 100).toFixed(2);
    }
    const rate = await this.getRate(currency);
    return +((amount * rate) / 100).toFixed(2);
  }
  // 更新汇率
  async updateUsdRate() {
    const { ctx, app } = this;
    const { token } = ctx.request.query;

    if (token !== app.config.adminToken) {
      return;
    }
    const exchangeRateKey = app.config.exchangeRateKey;
    const result = await ctx.curl(
      `https://v6.exchangerate-api.com/v6/${exchangeRateKey}/latest/usd`,
      {
        dataType: 'json',
      },
    );
    const commonServerLogger = app.getLogger('commonServerLogger');
    if (result.status === 200) {
      const { conversion_rates, result: apiResult } = result.data;
      if (apiResult === 'success') {
        const transaction = await ctx.model.transaction(); // 开启一个事务
        try {
          const rates = Object.entries(conversion_rates).map(([currency, rate]) => ({
            currency,
            rate,
          }));
          for (const rate of rates) {
            // 使用 upsert 方法更新或新建记录
            await ctx.model.UsdRate.upsert(rate, { transaction });
          }
          await transaction.commit(); // 提交事务
          commonServerLogger.info('更新汇率成功');
        } catch (error) {
          await transaction.rollback(); // 如果出错则回滚事务
          commonServerLogger.error('更新汇率失败');
        }
      }
    }
  }
  /**
   * @param {string} deviceId   用户id
   * @param {array} questionIds 问题id列表
   * @description 查询解题状态，获取是否可以开始解题，0 未开始解题，1 开始解题
   */
  async getIsStartAnswerQuestions(deviceId, questionIds) {
    const { ctx } = this;
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/questionStreamStatus/v1`, {
        method: 'POST',
        data: {
          deviceId,
          questionIds,
        },
        contentType: 'json',
        dataType: 'json',
      });
      return {
        code: 0,
        data: result.data.data || {},
      };
    } catch (e) {
      return {
        code: -1,
      };
    }
  }

  async commonAskTutorStream(data) {
    const { app, ctx, commonUrl } = this;
    data.callbackUrl = app.config.questionWebhookURL;

    const options = {
      data,
      /*
       * @param {Response} rpcRes 「业务后端 <- 远程调用」的响应对象
       * @param {Response} stream 「前端 <- 业务后端」的响应对象
       * @description 把处理响应的方法暴露出来，方便其他地方处理数据和写流
       *
       */
      hanldeRpcResponse(rpcRes, stream) {
        let buffer = '';
        rpcRes.on('data', (data) => {
          // data = {"statusCode":200,"data":{"content":"### Step 1:","command":"pending"}}, ..., chunk {"statusCode":200,"data":{"content":"","command":"done"}}
          // buffer和data绝大多数情况下是相等的（目前还没见过不相等的情况），因为data的数据量很小，所以ondata事件执行一次就能拿到所有的数据
          buffer += data.toString();
          let boundary = buffer.indexOf('\r\n');
          while (boundary !== -1) {
            const message = buffer.substring(0, boundary);
            buffer = buffer.substring(boundary + 2);
            try {
              JSON.parse(message);
              stream.write(`data: ${message}\r\n\r\n`);
            } catch (e) {
              buffer = message + '\r\n' + buffer;
              break;
            }
            boundary = buffer.indexOf('\r\n');
          }
        });
        /**
         * - 当public的响应明确结束，也应该结束掉对前端的响应
         * - 原因：现在前端使用fetch发送post请求来获得流式返回，使用fetch时，服务端要显式告诉浏览器所有请求内容都已发送完毕
         *        否则，fetch不会resolve
         */
        rpcRes.on('end', () => {
          stream.end();
        });
      },
    };
    ctx.helper.handleStreamRequest(`${commonUrl}/solvelyPubServer/v1/tutor/ask`, options);
  }
  // 通用流式请求
  async commonStreamRequest(url, data, commandListener) {
    const { ctx } = this;
    const options = {
      data,
      hanldeRpcResponse(rpcRes, stream) {
        let buffer = '';
        let cachedData = '';
        rpcRes.on('data', (dataBuffer) => {
          const bufferString = dataBuffer.toString('utf-8');
          const streamContentList = bufferString.split('solvelyPublicServer: ');
          for (let response of streamContentList) {
            if (response === '') {
              continue;
            }
            if (buffer !== '') {
              response = buffer + response;
              buffer = '';
            }
            try {
              const dataParse = JSON.parse(response);
              // O1自检+重解需求，pub在流的返回数据结构中添加了其他的一些字段，使用rest取出，并透传给前端
              let { content, command, ...rest } = dataParse.data;
              cachedData += content;
              if (command === 'done' && !content) {
                content = cachedData;
              }
              // 如果有命令监听器，则把command作为事件名，触发这个事件
              commandListener?.emit(command, { content, ...rest });
              stream.write(`data: ${JSON.stringify({ content, command, ...rest })}\r\n\r\n`);
            } catch (e) {
              buffer = response;
              break;
            }
          }
        });
        // 当响应体的所有数据都已接收时触发
        rpcRes.on('end', () => {
          commandListener?.removeAllListeners();
          stream.end();
        });
        // 当发生错误时触发。可以用于处理网络错误或其他问题。
        rpcRes.on('error', () => {
          commandListener?.removeAllListeners();
        });
      },
    };
    ctx.helper.handleStreamRequest(`${this.commonUrl}${url}`, options);
  }
  /**
   * @param {string} deviceId,   形如：2yNmGXxZ2bf9IhU9jxxP6mT0eTA2
   * @param {string} questionId, 形如：2024_09_02_b29f7f18a1a46f22967bg
   * @param deviceId
   * @param questionId
   * @description 调用public的流式解题，并流式返回给前端
   */
  async commonAnswerQuestionStream(deviceId, questionId) {
    const { app, ctx, commonUrl } = this;
    const options = {
      data: {
        deviceId,
        questionId,
        callbackUrl: app.config.questionWebhookURL,
      },
      /*
       * @param {Response} rpcRes 「业务后端 <- 远程调用」的响应对象
       * @param {Response} stream 「前端 <- 业务后端」的响应对象
       * @description 把处理响应的方法暴露出来，方便其他地方处理数据和写流
       *
       */
      hanldeRpcResponse(rpcRes, stream) {
        let buffer = '';
        rpcRes.on('data', (data) => {
          // data = {"statusCode":200,"data":{"content":"### Step 1:","command":"pending"}}, ..., chunk {"statusCode":200,"data":{"content":"","command":"done"}}
          // buffer和data绝大多数情况下是相等的（目前还没见过不相等的情况），因为data的数据量很小，所以ondata事件执行一次就能拿到所有的数据
          buffer += data.toString();
          let boundary = buffer.indexOf('\r\n');
          while (boundary !== -1) {
            const message = buffer.substring(0, boundary);
            buffer = buffer.substring(boundary + 2);

            try {
              JSON.parse(message);
              stream.write(`data: ${message}\r\n\r\n`);
            } catch (e) {
              buffer = message + '\r\n' + buffer;
              break;
            }
            boundary = buffer.indexOf('\r\n');
          }
        });
      },
    };
    ctx.helper.handleStreamRequest(`${commonUrl}/solvelyPubServer/solveQuestion/v2`, options);
  }

  // 调用流式追问
  async commonFollowQuestionStream(deviceId, questionId, sessionId, platform, useNewApi) {
    const { ctx, app } = this;
    const url = useNewApi
      ? `${this.commonUrl}/solvelyPubServer/v1/plugin/question/chat/ask`
      : `${this.commonUrl}/solvelyPubServer/chatgptStream/v2`;
    // 超时时间为5min
    ctx.req.setTimeout(5 * 60 * 1000);
    ctx.res.setTimeout(5 * 60 * 1000);

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
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        platform: 'web',
      },
      timeout: 5000,
    };

    const followList = await ctx.service.follow.getFollow(questionId, deviceId, sessionId);
    const lastFollow = followList.pop();
    const commonTemplate = answerMoreDetails.common;
    // followList去掉最后一个给gpt回答留的一个位置
    const currentFollow = followList[followList.length - 1];
    if (!currentFollow || !lastFollow) {
      // 关闭前端stream链接
      stream.end();
      ctx.service.point.firebasePoint(deviceId, 'web_follow_error', {
        questionId,
        sessionId,
      });
      throw new Error('Invalid follow list');
    }
    let questionText = '';
    const questionResult = await ctx.service.question.detail({ deviceId, questionId });
    questionText = questionResult.questionText;
    let answer = '';
    // 语言简称
    let languageShorten = '';
    // 语言全称
    let language = '';
    if (sessionId) {
      const result = await this.getAnswerDetail({ deviceId, questionId, answerId: sessionId });
      answer = result.answer;
      // 使用`answer`中的语言
      languageShorten = result.language;
    } else {
      answer = questionResult.answer;
      // 使用`questionResult`中的语言
      languageShorten = questionResult.language;
    }
    /**
     * @description 根据mapping把`语言简称`转换为`语言全称`
     * @reason 根据算法的反馈，使用语言全程，AI会更容易遵循语言的设定，如果语言简称不存在，则使用英语进行兜底
     */
    language = languageMap[languageShorten] || languageMap['en-us'];

    /**
     * @param prompt
     * @description 如果题目有instructions，则把instructions插入到commonTemplate中
     * ```
     * Important Instructions:
     * <text>
     * 题目instructions
     * </text>
     * ```
     * 否则清除`{INSTRUCTIONS}`占位符
     * @reason 保证追问接口也能受到instructions的影响，更好地执行用户的指令和意图
     */
    const replacePromptInstructionsPlaceholder = (prompt) => {
      return prompt.replace(
        '{INSTRUCTIONS}',
        questionResult.instructions ? `**High priority: ${questionResult.instructions}**` : '',
      );
    };

    const session = [];
    for (let i = 0; i < followList.length; i++) {
      // `contentFromUser`为`commandMap`的key之一（例如`Explain`）或者用户输出的内容
      const contentFromUser = followList[i].content;
      const quickActionPrompt = commandMap[contentFromUser];
      if (i === 0) {
        let content = replacePromptInstructionsPlaceholder(commonTemplate)
          .replace('{QUESTION}', questionText)
          .replace('{SOLUTION}', answer)
          // 使用语言全称`language`替换`{LANGUAGE}`
          .replaceAll('{LANGUAGE}', language);
        if (quickActionPrompt) {
          content = content.replace(
            '{FOLLOW-UP}',
            quickActionPrompt.replace(
              '{FOLLOW-UP}',
              // dsl解题的文科题，没有step，所以使用answer兜底
              followList[i].step ? followList[i].step.replace('### ', '') : answer,
            ),
          );
        } else {
          content = content.replace(
            '{FOLLOW-UP}',
            followList[i].step
              ? `For ${followList[i].step.replace('### ', '')}:${contentFromUser}`
              : contentFromUser,
          );
        }
        session.push({
          role: 'user',
          content,
        });
      } else {
        const params = {
          role: followList[i].role === 1 ? 'user' : 'assistant',
          content: quickActionPrompt
            ? quickActionPrompt.replace(
                '{FOLLOW-UP}',
                followList[i].step ? followList[i].step.replace('### ', '') : answer,
              )
            : contentFromUser,
        };
        if (i % 6 === 0) {
          // 每6个追问，插入一次提示
          params.content = `${params.content}\n${replacePromptInstructionsPlaceholder(questionInsertPrompt.normal).replace('{PROBLEM}', questionText)}`;
        }
        session.push(params);
      }
    }

    // 创建连接到外部API的请求
    const req = http.request(url, options, (res) => {
      // 先把messageId返回给前端
      if (!useNewApi) {
        stream.write(
          `data: {"statusCode":200,"data":{"content":"","command":"pending","messageId":"${lastFollow.messageId}"}}\n\n`,
        );
      }
      let buffer = '';
      res.on('data', (data) => {
        // console.log(data.toString(), 'data--------');
        buffer += data.toString();
        // 一个完整的json数据结束标志为\r\n，例如：{"statusCode":200,"data":{"content":"◇","command":"pending"}}\r\n"
        const endIndex = buffer.indexOf('\r\n');
        // 检查数据完整性：如果没有找到结束标记，说明数据还不完整，直接返回，不进行后续处理。
        if (endIndex === -1) {
          return;
        }
        buffer?.split('solvelyPublicServer: ')?.forEach((item) => {
          if (item) {
            stream.write(`data: ${item}\r\n`);
          }
        });
        buffer = '';
      });
    });

    const data = {
      deviceId,
      questionId,
      callbackUrl: app.config.followWebhookURL,
      conversationId: currentFollow.conversationId,
      sessionId: currentFollow.sessionId,
      messageId: lastFollow.messageId,
      session,
      language: currentFollow.language || 'en',
    };

    if (platform) {
      data.platform = platform;
    }

    // 发送数据
    req.write(JSON.stringify(data));

    // 监听错误事件
    req.on('error', (err) => {
      console.log(err, 'err');
      stream.end();
    });

    // `前端`到`web server`的连接关闭时，关闭`web server`到`pub server`的连接
    stream.on('close', () => {
      req.destroy();
    });

    req.end(); // 发送请求
  }
  // 查询国家信息
  async getCountryInfo() {
    const { ctx, app } = this;
    try {
      const ipSearchApiKey = app.config.ipSearchApiKey;
      const ip = ctx.helper.getRealIp();

      if (!ip) {
        return null;
      }
      const result = await ctx.curl(`https://pro.ip-api.com/json/${ip}?key=${ipSearchApiKey}`, {
        dataType: 'json',
      });
      if (result.data?.status === 'success') {
        return result.data.countryCode;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  /**
   * 获取用户是否免费试用过
   * @param {String} deviceId 用户id
   */
  async hasUserTriedProduct(deviceId) {
    const { ctx } = this;
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/queryTrialInfoExists/v1`, {
        method: 'GET',
        data: {
          deviceId,
        },
        contentType: 'json',
        dataType: 'json',
      });
      return result.data.data;
    } catch (e) {
      return false;
    }
  }
  // 保存用户试用信息
  async saveUserTrialInfo(params) {
    const { ctx } = this;
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/saveTrial/v1`, {
        method: 'POST',
        data: {
          ...params,
        },
        contentType: 'json',
        dataType: 'json',
      });
      return result.data.data;
    } catch (e) {
      return false;
    }
  }
  // 试用期间取消订阅
  async cancelTrialSubscription(params) {
    const { ctx } = this;
    try {
      const subscription = await ctx.service.subscription.find({
        deviceId: params.deviceId,
      });
      // 如果没有订阅记录或者不是试用期间，不调用
      if (_.isEmpty(subscription) || subscription.isTrialPeriod === 0) {
        return false;
      }
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/cancelTrial/v1`, {
        method: 'POST',
        data: {
          ...params,
        },
        contentType: 'json',
        dataType: 'json',
      });
      return result.data.data;
    } catch (e) {
      return false;
    }
  }
  // 获取反馈弹窗配置
  async getPopupFeedbackConfig() {
    const { ctx } = this;
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/generalFeedbackConf/v1`, {
        method: 'GET',
        data: {
          platform: 'web',
          isOpen: 1,
        },
        contentType: 'json',
        dataType: 'json',
      });
      return result.data.data;
    } catch (e) {
      return {};
    }
  }
  // 保存用户反馈
  async savePopupFeedback(params) {
    const { ctx } = this;
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/userGeneralFeedback/v1`, {
        method: 'POST',
        data: {
          ...params,
        },
        contentType: 'json',
        dataType: 'json',
      });
      return result.data || {};
    } catch (e) {
      return false;
    }
  }
  // 生成二维码
  async generateQrCode(data) {
    const { ctx } = this;
    const link = 'https://solvely.go.link/scan-to-login?qrcode_id={qrcodeid}';
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/login/qrProduce/v1`, {
        method: 'POST',
        data,
        contentType: 'json',
        dataType: 'json',
      });
      if (result.data.statusCode !== 200) {
        return {
          code: -1,
        };
      }
      const { qrCodeId, expiresTime } = result.data.data || {};
      return {
        code: 0,
        data: {
          link: link.replace('{qrcodeid}', qrCodeId),
          qrCodeId,
          expiresTime,
        },
      };
    } catch (e) {
      return {
        code: -1,
      };
    }
  }
  // 校验二维码
  async checkQrCode(qrCodeId) {
    const { ctx } = this;
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/login/validateQr/v2`, {
        method: 'POST',
        data: {
          qrCodeId,
          platform: 'web',
        },
        contentType: 'json',
        dataType: 'json',
      });
      return {
        code: result.data.statusCode,
        data: result.data.data,
      };
    } catch (e) {
      return {
        code: -1,
        data: {},
      };
    }
  }
  // 注销二维码
  async logoutQrCode(qrCodeId) {
    const { ctx } = this;
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/logout/qr/v1`, {
        method: 'POST',
        data: {
          qrCodeId,
        },
        contentType: 'json',
        dataType: 'json',
      });
      return result.data.data || {};
    } catch (e) {
      return {};
    }
  }
  // 查询订阅暂停记录
  async getPauseSubscriptionRecord(subscriptionId, type = 1, status = '') {
    const { ctx } = this;
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/subPauseInfo/v1`, {
        method: 'GET',
        data: {
          transactionId: subscriptionId,
          type,
          status,
        },
        contentType: 'json',
        dataType: 'json',
      });
      return result.data.data || [];
    } catch (e) {
      return [];
    }
  }
  // 记录订阅暂停/恢复
  async recordPauseSubscription(params, type) {
    const { ctx } = this;
    try {
      const method = type === 'create' ? 'POST' : 'PUT';
      await ctx.curl(`${this.commonUrl}/solvelyPubServer/subPauseInfo/v1`, {
        method,
        data: {
          ...params,
        },
        contentType: 'json',
        dataType: 'json',
      });
    } catch (e) {
      ctx.throw(500, '记录订阅暂停/恢复失败');
    }
  }
  // 查询用户订阅记录
  async getSubscription(deviceId) {
    const { ctx } = this;
    const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/subscriptionInfo/v1`, {
      data: {
        deviceId,
      },
      contentType: 'json',
      dataType: 'json',
    });
    if (result.data.statusCode !== 200) {
      return [];
    }
    return result.data.data || [];
  }
  // 保存题目埋点到bq
  async saveQuestionInfoToBq(
    pointData = {},
    datasetId = 'solvely_mysql_migration',
    tableId = 'solvely_questions_v3',
  ) {
    const { ctx } = this;
    try {
      const now = moment().tz('Asia/Shanghai');
      const nowTime = now.format('YYYY-MM-DD HH:mm:ss');
      await ctx.curl(`${this.commonUrl}/solvelyPubServer/recordQuestion/v1`, {
        method: 'POST',
        data: {
          datasetId,
          tableId,
          questionInfos: [
            {
              ...pointData,
              createTime: nowTime,
            },
          ],
        },
        contentType: 'json',
        dataType: 'json',
      });
    } catch (e) {
      ctx.logger.error('saveQuestionInfoToBq error', e);
    }
  }
  // 实验组用户发放钻石
  async grantDiamond(params) {
    const { ctx } = this;
    try {
      const result = await ctx.curl(
        `${this.commonUrl}/solvelyPubServer/user/receivingCurrency/v1`,
        {
          method: 'POST',
          data: {
            ...params,
          },
          contentType: 'json',
          dataType: 'json',
        },
      );
      return (
        result.data || {
          statusCode: 508,
          data: {},
        }
      );
    } catch (e) {
      return {
        statusCode: 508,
        data: {},
      };
    }
  }
  // 查询解题详情
  async getQuestionDetail(deviceId, questionId) {
    const { ctx } = this;
    try {
      const result = await ctx.curl(`${this.commonUrl}/solvelyPubServer/v2/queryQuestionInfo`, {
        method: 'POST',
        data: {
          deviceId,
          questionId,
          queryOptions: {
            // * || [], * 表示所有，但是会默认返回 _id
            fastExcludes: ['answers.answerJson'], // 不返回answerJson
            // teachExcludes: [], // * || []
          },
        },
        contentType: 'json',
        dataType: 'json',
      });
      return result.data.data || {};
    } catch (e) {
      return {};
    }
  }
  // 查询答案详情
  /**
   * @param {Object} data - 参数
   * @param {String} data.deviceId - 用户id
   * @param {String} data.questionId - 问题id
   * @param {String} data.answerId - 答案id
   * @return {Object} 答案详情
   */
  async getAnswerDetail(data) {
    const { ctx } = this;
    try {
      const result = await ctx.curl(
        `${this.commonUrl}/solvelyPubServer/v1/question/fast/answer/info`,
        {
          method: 'GET',
          data,
          contentType: 'json',
          dataType: 'json',
        },
      );
      return result.data.data || {};
    } catch (e) {
      return {};
    }
  }
  // 检查题意
  async checkQuestion(data) {
    const { ctx } = this;
    const startTime = moment().valueOf();
    try {
      const checkUrl = '/solvelyPubServer/checkQuestionTypes/allInOne/v1';
      const { data: responseData } = await ctx.curl(`${this.commonUrl}${checkUrl}`, {
        method: 'POST',
        data,
        contentType: 'json',
        dataType: 'json',
      });

      const costTime = moment().valueOf() - startTime;
      ctx.service.point.firebasePoint('', 'Web_QuestionCheckout_CostTime', { costTime, ...data });

      const {
        subType = [],
        questionText,
        subject,
        realSubject,
        questionCategory,
      } = responseData?.data || {};
      return {
        checkQuestion: subType.includes('completeness'),
        questionText,
        subject,
        realSubject,
        questionCategory,
      };
    } catch (e) {
      ctx.service.point.firebasePoint('', 'Web_QuestionCheckout_Fail', { msg: e.message, ...data });
      return {
        checkQuestion: true,
        questionText: '',
      };
    }
  }
  // answerId 点赞/踩
  likeAnswer(data) {
    this.ctx.curl(`${this.commonUrl}/solvelyPubServer/v1/question/fast/answer/feedback`, {
      method: 'POST',
      data,
      contentType: 'json',
      dataType: 'json',
    });
  }
  // 新增追问
  publicAddFollow(data) {
    const { answerId } = data;
    // 如果answerId中没有#，不是自定义答案的追问，不需要同步给public
    // 非自定义答案的追问answerId格式为 -> session_xxx

    // 如果answerId中没有#，不是自定义答案的追问，不需要同步给public
    // 非自定义答案的追问answerId格式为 -> session_xxx
    if (!answerId?.includes('#')) {
      return;
    }
    this.ctx.curl(`${this.commonUrl}/solvelyPubServer/v1/question/fast/askMore/add`, {
      method: 'POST',
      data,
      contentType: 'json',
      dataType: 'json',
    });
  }
  // 更新追问
  publicUpdateFollow(data) {
    const { answerId } = data;

    if (!answerId?.includes('#')) {
      return;
    }
    this.ctx.curl(`${this.commonUrl}/solvelyPubServer/v1/question/fast/askMore/custom/update`, {
      method: 'POST',
      data,
      contentType: 'json',
      dataType: 'json',
    });
  }

  // 更新追问
  uploadUserRengageInfo(deviceId, userInfo) {
    this.ctx.curl(`${this.commonUrl}/solvelyPubServer/rengage/update/userInfo/v1`, {
      method: 'POST',
      data: {
        deviceId,
        userInfo,
      },
      contentType: 'json',
      dataType: 'json',
    });
  }
}

module.exports = CommonService;
