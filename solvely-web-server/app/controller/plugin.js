'use strict';

const { Controller } = require('egg');
const _ = require('lodash');
const { getLanguageName } = require('../common/i18n');

class PluginController extends Controller {
  /**
   * 请求 Summary 总结的内容
   */
  async postSummary() {
    const { ctx } = this;
    const deviceId = ctx.user.uid;
    const { sessionId, content, instructions, pageUrl, language } = ctx.request.body;

    // 参数检查
    if (!deviceId || !content) {
      ctx.body = {
        code: -1,
        msg: '参数错误',
      };
      return;
    }

    const subscription = await ctx.service.subscription.findActiveSubscription();

    if (_.isEmpty(subscription)) {
      // 插件用户：解题和追问统一为一个次数
      // 余额检查
      const { consumptionType, approved } = await ctx.service.balance.checkBalance(
        deviceId,
        'plugin',
      );
      if (!approved) {
        await ctx.service.point.firebasePoint(ctx.user.uid, 'plugin_summarize_limit', { pageUrl });
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
      // 扣除钻石/次数
      const deductAmount = consumptionType === 'balance' ? -10 : -1;
      await ctx.service.balance.updateDiamond(deviceId, {
        [consumptionType]: deductAmount,
      });
    }

    // 映射语言代码为语言全称
    const languageName = getLanguageName(language);

    const params = {
      deviceId,
      text: content,
      platform: 'plugin',
      language: languageName,
    };
    if (sessionId) {
      params.sessionId = sessionId;
    }
    if (instructions) {
      params.originText = content;
      params.text = instructions;
    }
    // 如果用户传了提示词，先总结再追问，只将追问结果流式输出
    await ctx.service.common.commonStreamRequest(
      `${instructions ? '/solvelyPubServer/v1/plugin/web/chat/askAndAnswer' : '/solvelyPubServer/quiz/summaryText'}`,
      params,
    );
  }

  /**
   * 对摘要进行反馈（点赞/点踩）
   * 用户对每个摘要只能有一次反馈机会
   */
  async feedbackSummary() {
    const { ctx } = this;
    // const deviceId = ctx.user.uid;
    // const { summaryId, feedback } = ctx.request.body;

    ctx.body = {
      code: 0,
      msg: '反馈成功',
    };
  }

  /**
   * 摘要重试接口
   * 不扣余额，只传 sessionId，PubServer 会根据 sessionId 获取已存储的参数并重新生成
   */
  async retrySummary() {
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
      // PubServer 会根据 sessionId 获取已存储的参数并判断调用哪个接口
      await ctx.service.common.commonStreamRequest('/solvelyPubServer/quiz/summaryText', params);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 重新生成摘要
   */
  // async retrySummary() {
  //   const { ctx } = this;
  //   const deviceId = ctx.user.uid;
  //   const { messageId, content, pageUrl } = ctx.request.body;

  //   // 参数检查
  //   if (!deviceId || !messageId || !content) {
  //     ctx.body = {
  //       code: -1,
  //       msg: '参数错误',
  //     };
  //     return;
  //   }

  //   // 使用通用流式接口处理
  //   await ctx.service.common.commonStreamRequest('/solvelyPubServer/plugin/retry/v1', {
  //     deviceId,
  //     text: content,
  //     messageId,
  //     pageUrl,
  //     platform: 'web',
  //   });
  // }

  /**
   * 获取 YouTube 视频总结摘要
   */
  async getYouTubeSummaryOutline() {
    const { ctx } = this;
    const { subtitles, lang = 'en', videoId } = ctx.request.body;

    const deviceId = ctx.user.uid;

    // 参数检查
    if (!subtitles) {
      ctx.body = {
        code: -1,
        msg: '参数错误：缺少 subtitles',
      };
    }

    // 参数检查
    if (!deviceId) {
      ctx.body = {
        code: -1,
        msg: '参数错误：缺少用户信息, 用户未登录',
      };
    }

    try {
      const result = await ctx.service.plugin.youtube.getYouTubeSummaryOutline(
        deviceId,
        subtitles,
        videoId,
        lang,
      );
      ctx.body = {
        code: 0,
        msg: 'success',
        data: result,
      };
    } catch (err) {
      ctx.body = {
        code: -1,
        msg: err.message || '获取视频总结摘要失败',
      };
    }
  }

  async getYouTubeSummaryDetails() {
    const { ctx } = this;
    const { subtitles, lang = 'en', videoId } = ctx.request.body;
    const deviceId = ctx.user.uid;

    // 参数检查
    if (!subtitles) {
      ctx.body = {
        code: -1,
        msg: '参数错误：缺少 subtitles',
      };
    }

    // 参数检查
    if (!deviceId) {
      ctx.body = {
        code: -1,
        msg: '参数错误：缺少用户信息, 用户未登录',
      };
    }

    const result = await ctx.service.plugin.youtube.getYouTubeSummaryDetails(
      deviceId,
      subtitles,
      videoId,
      lang,
    );
    ctx.body = {
      code: 0,
      msg: 'success',
      data: result,
    };
  }
}

module.exports = PluginController;
