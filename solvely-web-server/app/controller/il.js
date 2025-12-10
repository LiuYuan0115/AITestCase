const BaseController = require('../core/base');

class ILController extends BaseController {
  /**
   * @description {POST} /question/fast/il/recommend 获取推荐的 IL - 代理
   * @example https://pf6xrzskv9.feishu.cn/wiki/CkDqwI486iZbdDkixedcJyOgnOc#share-Vc7hdy6ywoMYgVxdGcpcwB91nfb
   */
  async recommendFast() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/fast/il/recommend', {
      deviceId: this.ctx.user.uid,
    });
  }
  /**
   * @description {POST} /solvelyPubServer/v1/question/il/html/judgement - 代理
   * @example https://pf6xrzskv9.feishu.cn/wiki/CkDqwI486iZbdDkixedcJyOgnOc#share-HbaidbCMno8ijOxGJi7coH3Mnbe
   */
  async htmlJudgement() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/il/html/judgement', {
      deviceId: this.ctx.user.uid,
    });
  }
  /**
   * @description {GET} /solvelyPubServer/v1/question/il/html/content - 代理
   * @example https://pf6xrzskv9.feishu.cn/wiki/CkDqwI486iZbdDkixedcJyOgnOc#share-OjsudtAmQoqL2rx3mrlcfkx1nYg
   */
  async htmlContent() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/il/html/content');
  }
  /**
   * IL三期接口
   * @description {POST} /solvelyPubServer/v2/question/il/html/judgement - 代理
   * @example https://pf6xrzskv9.feishu.cn/wiki/B8L7wO7OfiN7jRkqgEucpCT4nAv#share-KXc5dF4gNouL8IxDx3EcmlTHnrb
   */
  async htmlJudgementV2() {
    await this.ctx.helper.proxy('/solvelyPubServer/v2/question/il/html/judgement', {
      deviceId: this.ctx.user.uid,
    });
  }
  /**
   * IL三期接口
   * @description {GET} /solvelyPubServer/v2/question/il/html/content - 代理
   * @example https://pf6xrzskv9.feishu.cn/wiki/B8L7wO7OfiN7jRkqgEucpCT4nAv#share-DhgadEDhCoyznexdCDfcSCeRnDc
   */
  async htmlContentV2() {
    await this.ctx.service.common.commonStreamRequest(
      '/solvelyPubServer/v2/question/il/html/content',
      this.ctx.request.body,
    );
  }
  /**
   * IL三期接口
   * @description {GET} /solvelyPubServer/v1/question/il/html/feedback - 代理
   * @example https://pf6xrzskv9.feishu.cn/sync/Nqtsd7uE7s21yUbUknPcDajunkg?from=from_copylink
   */
  async feedback() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/question/il/html/feedback');
  }
}

module.exports = ILController;
