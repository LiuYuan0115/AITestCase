const { Controller } = require('egg');

class CanvasController extends Controller {
  /**
   * 为 Canvas 抓取生成 S3 预签名上传 URL
   * 请求体: { domain, fileName, fileType }
   * 响应体: { code: 0, data: { uploadUrl, fileUrl } }
   *
   * 注意：userId 从 ctx.user.uid 获取，不在请求体中传递
   */
  async getUploadUrl() {
    const { ctx } = this;
    try {
      const { domain, fileName, fileType } = ctx.request.body || {};

      // 从 ctx 获取 userId（登录用户）
      const userId = ctx.user?.uid;

      if (!userId) {
        ctx.body = { code: -1, msg: 'User not authenticated' };
        return;
      }

      if (!domain || !fileName) {
        ctx.body = { code: -1, msg: 'domain and fileName are required' };
        return;
      }

      // 🎯 使用 service 层
      const userIdHash = ctx.service.s3Upload.hashUserId(userId);
      const key = `canvas-captures/${domain}/${userIdHash}/${fileName}`;

      const result = await ctx.service.s3Upload.generatePresignedUploadUrl({
        key,
        fileName,
        fileType,
        expires: 300,
      });

      ctx.body = { code: 0, data: result };
    } catch (error) {
      ctx.logger.error('[canvas.getUploadUrl] error: %s', error?.stack || error);
      ctx.body = { code: -1, msg: 'Failed to build presigned url' };
    }
  }
}

module.exports = CanvasController;
