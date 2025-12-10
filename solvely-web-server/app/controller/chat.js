const { Controller } = require('egg');
const _ = require('lodash');
const { getLanguageName } = require('../common/i18n');

class ChatController extends Controller {
  async pdfUpload() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/plugin/pdf/chat/upload', {
      deviceId: this.ctx.user.uid,
    });
  }

  async pdfAsk() {
    const { ctx } = this;
    const { pdfUrl, platform, sessionId, documentId, text } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const subscription = ctx.service.subscription.findActiveSubscription();
    // 执行次数检查但是不扣减
    if (_.isEmpty(subscription)) {
      // 插件用户：解题和追问统一为一个次数
      // 余额检查
      const { approved, consumptionType } = await ctx.service.balance.checkBalance(
        deviceId,
        'plugin',
      );
      if (!approved) {
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30001,
            msg: '余额不足',
            command: 'server-stop',
          },
          { isEnd: true },
        );
        return;
      }
      const deductAmount = consumptionType === 'balance' ? -10 : -1;
      await ctx.service.balance.updateDiamond(deviceId, {
        [consumptionType]: deductAmount,
      });
    }

    await ctx.service.common.commonStreamRequest('/solvelyPubServer/v1/plugin/pdf/chat/ask', {
      deviceId: ctx.user.uid,
      platform,
      pdfUrl,
      sessionId,
      documentId,
      text,
    });
  }

  async pdfAskAndAnswer() {
    const { ctx } = this;
    const { pdfUrl, platform, sessionId, text } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const subscription = ctx.service.subscription.findActiveSubscription();
    // 执行次数检查但是不扣减
    if (_.isEmpty(subscription)) {
      // 插件用户：解题和追问统一为一个次数
      // 余额检查
      const { approved, consumptionType } = await ctx.service.balance.checkBalance(
        deviceId,
        'plugin',
      );
      if (!approved) {
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30001,
            msg: '余额不足',
            command: 'server-stop',
          },
          { isEnd: true },
        );
        return;
      }
      const deductAmount = consumptionType === 'balance' ? -10 : -1;
      await ctx.service.balance.updateDiamond(deviceId, {
        [consumptionType]: deductAmount,
      });
    }

    await ctx.service.common.commonStreamRequest(
      '/solvelyPubServer/v1/plugin/pdf/chat/askAndAnswer',
      {
        deviceId: ctx.user.uid,
        platform,
        pdfUrl,
        sessionId,
        text,
      },
    );
  }

  async pdfContextCache() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/plugin/pdf/chat/context/cache', {
      deviceId: this.ctx.user.uid,
    });
  }

  async pdfAskContext() {
    const { ctx } = this;
    const { platform, sessionId, text } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const subscription = ctx.service.subscription.findActiveSubscription();
    // 执行次数检查但是不扣减
    if (_.isEmpty(subscription)) {
      // 插件用户：解题和追问统一为一个次数
      // 余额检查
      const { approved, consumptionType } = await ctx.service.balance.checkBalance(
        deviceId,
        'plugin',
      );
      if (!approved) {
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30001,
            msg: '余额不足',
            command: 'server-stop',
          },
          { isEnd: true },
        );
        return;
      }
      const deductAmount = consumptionType === 'balance' ? -10 : -1;
      await ctx.service.balance.updateDiamond(deviceId, {
        [consumptionType]: deductAmount,
      });
    }

    await ctx.service.common.commonStreamRequest(
      '/solvelyPubServer/v1/plugin/pdf/chat/ask/context',
      {
        deviceId: ctx.user.uid,
        platform,
        sessionId,
        text,
      },
    );
  }

  async pageAsk() {
    const { ctx } = this;
    const { platform, sessionId, text } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const subscription = ctx.service.subscription.findActiveSubscription();
    // 执行次数检查但是不扣减
    if (_.isEmpty(subscription)) {
      // 插件用户：解题和追问统一为一个次数
      // 余额检查
      const { approved, consumptionType } = await ctx.service.balance.checkBalance(
        deviceId,
        'plugin',
      );
      if (!approved) {
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30001,
            msg: '余额不足',
            command: 'server-stop',
          },
          { isEnd: true },
        );
        return;
      }
      const deductAmount = consumptionType === 'balance' ? -10 : -1;
      await ctx.service.balance.updateDiamond(deviceId, {
        [consumptionType]: deductAmount,
      });
    }

    await ctx.service.common.commonStreamRequest('/solvelyPubServer/v1/plugin/web/chat/ask', {
      deviceId,
      platform,
      sessionId,
      text,
    });
  }

  async contentChat() {
    const { ctx } = this;
    const { platform, sessionId, code, type, params } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const subscription = ctx.service.subscription.findActiveSubscription();
    // 执行次数检查但是不扣减
    if (_.isEmpty(subscription)) {
      // 插件用户：解题和追问统一为一个次数
      // 余额检查
      const { approved, consumptionType } = await ctx.service.balance.checkBalance(
        deviceId,
        'plugin',
      );
      if (!approved) {
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30001,
            msg: '余额不足',
            command: 'server-stop',
          },
          { isEnd: true },
        );
        return;
      }
      const deductAmount = consumptionType === 'balance' ? -10 : -1;
      await ctx.service.balance.updateDiamond(deviceId, {
        [consumptionType]: deductAmount,
      });
    }

    // 从 params 中获取 language，映射为语言全称，然后放回 params
    const language = params?.language;
    const languageName = getLanguageName(language);
    const updatedParams = {
      ...params,
      language: languageName,
    };

    await ctx.service.common.commonStreamRequest('/solvelyPubServer/v1/plugin/context/ask', {
      deviceId,
      platform,
      sessionId,
      code,
      type,
      params: updatedParams,
    });
  }

  async contentChatFollowUp() {
    const { ctx } = this;
    const { platform, sessionId, type, text } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const subscription = ctx.service.subscription.findActiveSubscription();
    // 执行次数检查但是不扣减
    if (_.isEmpty(subscription)) {
      // 插件用户：解题和追问统一为一个次数
      // 余额检查
      const { approved, consumptionType } = await ctx.service.balance.checkBalance(
        deviceId,
        'plugin',
      );
      if (!approved) {
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30001,
            msg: '余额不足',
            command: 'server-stop',
          },
          { isEnd: true },
        );
        return;
      }
      const deductAmount = consumptionType === 'balance' ? -10 : -1;
      await ctx.service.balance.updateDiamond(deviceId, {
        [consumptionType]: deductAmount,
      });
    }

    await ctx.service.common.commonStreamRequest('/solvelyPubServer/v1/plugin/context/chat', {
      deviceId,
      platform,
      sessionId,
      type,
      text,
    });
  }

  /**
   * 上下文提问重试接口
   * 不扣余额，只传 sessionId，PubServer 会根据 sessionId 获取已存储的参数并重新生成
   */
  async contentChatRetry() {
    const { ctx } = this;
    const { sessionId, platform, code } = ctx.request.body;
    const deviceId = ctx.user.uid;

    // 参数检查
    if (!sessionId) {
      ctx.body = {
        code: -1,
        msg: '参数错误：缺少 sessionId',
      };
      return;
    }

    // 组装转发给 PubServer 的参数
    const params = {
      sessionId,
      deviceId,
      platform,
      code,
    };

    try {
      // 不进行余额检查和扣减，直接转发给 PubServer
      // PubServer 会根据 sessionId 获取已存储的参数，code 作为辅助信息
      await ctx.service.common.commonStreamRequest(
        '/solvelyPubServer/v1/plugin/context/ask',
        params,
      );
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ChatController;
