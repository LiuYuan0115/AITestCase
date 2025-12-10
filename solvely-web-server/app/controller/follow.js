const { Controller } = require('egg');

class FollowController extends Controller {
  /**
   * {get} /question/follow/:questionId 获取追问记录
   */
  async getFollow() {
    const { ctx } = this;
    const deviceId = ctx.user.uid;
    // sessionId 用来当作答案id
    const { answerId: sessionId } = ctx.query;
    const result = await ctx.service.follow.getFollowHistory(
      ctx.params.questionId,
      deviceId,
      sessionId,
    );
    ctx.body = result;
  }
  /**
   * {post} /question/follow/:questionId 追问
   */
  async postFollow() {
    const { ctx } = this;
    const result = await ctx.service.follow.postFollow(ctx.params.questionId, ctx.request.body);
    ctx.body = result;
  }
  /**
   * {post} /question/follow/:questionId/retry 重试追问
   */
  async retryFollow() {
    const { ctx } = this;
    ctx.validate({
      messageId: 'string?',
    });
    const { questionId } = ctx.params;
    const { messageId, sessionId } = ctx.request.body;
    const result = await ctx.service.follow.retryFollow(questionId, messageId, sessionId);
    ctx.body = result;
  }
  /**
   * {post} /question/follow/:questionId/like 追问点赞/踩
   */
  async likeFollow() {
    const { ctx } = this;
    const result = await ctx.service.follow.likeFollow();
    ctx.body = result;
  }
  /**
   * {post} /question/guest/follow/:questionId 匿名追问
   */
  async guestPostFollow() {
    const { ctx } = this;
    // 校验公共字段
    ctx.validate({
      deviceId: 'string',
      command: 'string?',
      content: 'string?',
      step: 'string?',
      language: 'string?',
      answerId: 'string?',
      platform: 'string?',
    });
    const { deviceId } = ctx.request.body || {};
    // 匿名 deviceId 校验
    const ANON_PREFIX = 'ANON_';
    if (!deviceId || typeof deviceId !== 'string' || !deviceId.startsWith(ANON_PREFIX)) {
      ctx.body = { code: 30002, msg: 'Invalid anonymous deviceId' };
      return;
    }
    // 核心追问逻辑（匿名版）
    const result = await ctx.service.follow.postFollowGuest(
      ctx.params.questionId,
      ctx.request.body,
    );
    ctx.body = result;
  }
  /**
   * {get} /question/guest/follow/:deviceId/:questionId/stream 匿名追问流式回答
   */
  async guestFollowQuestionStream() {
    const { ctx } = this;
    const { deviceId, questionId } = ctx.params;
    const { answerIdTime, useNewApi, platform } = ctx.query;
    // 匿名 deviceId 校验
    const ANON_PREFIX = 'ANON_';
    if (!deviceId || typeof deviceId !== 'string' || !deviceId.startsWith(ANON_PREFIX)) {
      // 直接以简单体裁返回错误并结束
      ctx.status = 400;
      ctx.body = { code: 30002, msg: 'Invalid anonymous deviceId' };
      return;
    }
    let sessionId;
    if (answerIdTime) {
      sessionId = `${questionId}#${answerIdTime}`;
    }
    await ctx.service.common.commonFollowQuestionStream(
      deviceId,
      questionId,
      sessionId,
      platform,
      useNewApi,
    );
  }
  /**
   * {get} /question/follow/:deviceId/:questionId/stream 获取追问流式回答
   */
  async followQuestionStream() {
    const { ctx } = this;
    const { deviceId, questionId } = ctx.params;
    const { answerIdTime, useNewApi, platform } = ctx.query;
    let sessionId;
    if (answerIdTime) {
      sessionId = `${questionId}#${answerIdTime}`;
    }
    await ctx.service.common.commonFollowQuestionStream(
      deviceId,
      questionId,
      sessionId,
      platform,
      useNewApi,
    );
  }
  /**
   * {post} /question/fast/askmore/questions/recommends 获取followup推荐问题接口 - 代理
   * fastInfo.answers.
   */
  async getFollowupQuestionRecommend() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/fast/askMore/questions/recommend', {
      deviceId: this.ctx.user.uid,
      platform: 'web',
    });
  }
  /**
   * {post} /question/fast/askmore/questions/recommends 获取followup推荐问题接口 - 代理
   * fastInfo.answers.
   */
  async reportSelectedRecommend() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/fast/askMore/question/choose', {
      deviceId: this.ctx.user.uid,
      platform: 'web',
    });
  }
  /**
   * {post} /question/follow/webhook 追问webhook
   */
  async webhook() {
    const { ctx } = this;
    await ctx.service.follow.webhook();
    ctx.status = 200;
    ctx.body = {};
  }
}

module.exports = FollowController;
