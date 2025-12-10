const { Controller } = require('egg');

class CommonController extends Controller {
  /**
   * @description 获取预签名url,
   * 前端拿这个URL把文件上传S3
   * 纯做转发，不做任何请求和响应的判断和理解
   * @example https://console-docs.apipost.cn/preview/5c2c0540e85b32f2/0a28005718ae2c1d?target_id=40cdb36b-f549-4d78-a750-c63c67fe50fb
   */
  async buildPreUploadUrl() {
    await this.ctx.helper.proxy('/solvelyPubServer/common/buildPreUploadUrl/v1.0');
  }
  async buildGuestPreUploadUrl() {
    const { ctx } = this;
    try {
      const { deviceId } = ctx.request.body || {};
      // 校验匿名 deviceId
      const ANON_PREFIX = 'ANON_';
      if (!deviceId || typeof deviceId !== 'string' || !deviceId.startsWith(ANON_PREFIX)) {
        ctx.body = { code: 30002, msg: 'Invalid anonymous deviceId' };
        return;
      }
      // 配额检查（上传场景）
      const quota = await ctx.service.question.checkAnonQuota(deviceId, { kind: 'upload' });
      if (!quota.approved) {
        ctx.body = { code: quota.code || 30005, msg: quota.msg || 'Upload quota exhausted' };
        return;
      }
      // 计数 +1（按调用计次）
      await ctx.service.question.increaseAnonCounters(deviceId, { field: 'uploadCnt' });
      // 通过后代理
      await ctx.helper.proxy('/solvelyPubServer/common/buildPreUploadUrl/v1.0');
    } catch (e) {
      // 失败时保持与公共接口一致返回
      ctx.body = { code: -1, msg: 'Build pre-upload url failed' };
    }
  }
  // 新的桶，目前用于插件上传 PDF
  async buildPreUploadFileUrl() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/plugin/pdf/buildPreUploadUrl', {
      deviceId: this.ctx.user.uid,
    });
  }
  // 获取所有可用弹窗
  async getPopupFeedbackConfig() {
    const { ctx } = this;
    const result = await ctx.service.common.getPopupFeedbackConfig();
    ctx.body = result;
  }
  // 保存弹窗反馈
  async savePopupFeedback() {
    const { ctx } = this;
    const deviceId = ctx.user.uid;
    ctx.validate({
      generalFeedbackConfId: { type: 'number', required: true },
      satisfaction: { type: 'number', required: true },
    });
    const { generalFeedbackConfId, satisfaction, caseFeedback, caseTitle, id, caseNote } =
      ctx.request.body;
    const { statusCode, data } = await ctx.service.common.savePopupFeedback({
      deviceId,
      id,
      generalFeedbackConfId,
      satisfaction,
      caseFeedback,
      caseTitle,
      caseNote,
    });
    if (statusCode !== 200) {
      ctx.body = {
        code: -1,
        data,
      };
      return;
    }
    ctx.body = {
      code: 0,
      data,
    };
  }
}

module.exports = CommonController;
