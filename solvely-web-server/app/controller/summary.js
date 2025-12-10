const { Controller } = require('egg');
const _ = require('lodash');
const { getLanguageName } = require('../common/i18n');

class SummaryController extends Controller {
  async pdf() {
    const { ctx } = this;
    const { pdfUrl, pictures, platform, sessionId, language } = ctx.request.body;
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

    // 映射语言代码为语言全称
    const languageName = getLanguageName(language);

    const params = {
      deviceId: ctx.user.uid,
      sessionId,
      platform,
      language: languageName,
    };

    if (pictures) {
      params.pictures = pictures;
    } else if (pdfUrl) {
      params.pdfUrl = pdfUrl;
    } else {
      throw new Error('Either pdfUrl or pictures must be provided');
    }

    await ctx.service.common.commonStreamRequest(
      '/solvelyPubServer/v1/plugin/pdf/summaryText',
      params,
    );
  }

  /**
   * PDF 总结重试接口
   * 不扣余额，只传 sessionId，PubServer 会根据 sessionId 获取已存储的参数并重新生成
   */
  async pdfRetry() {
    const { ctx } = this;
    const { sessionId, platform } = ctx.request.body;
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
    };

    try {
      // 不进行余额检查和扣减，直接转发给 PubServer
      // PubServer 会根据 sessionId 获取已存储的参数
      await ctx.service.common.commonStreamRequest(
        '/solvelyPubServer/v1/plugin/pdf/summaryText',
        params,
      );
    } catch (error) {
      throw error;
    }
  }
}

module.exports = SummaryController;
