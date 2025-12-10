const { Controller } = require('egg');

/**
 * 插件 Feedback 控制器
 * 处理插件反馈相关的文件上传（截图、附件等）
 */
class PluginFeedbackController extends Controller {
  /**
   * 为插件 Feedback 生成 S3 预签名上传 URL
   *
   * 请求体: {
   *   fileName: string,     // 文件名，如：screenshot.png
   *   fileType: string,     // 文件类型，如：png, jpg, pdf
   *   feedbackType?: string // 可选：反馈类型，如：bug, feature, general（用于子目录分类）
   * }
   *
   * 响应体: {
   *   code: 0,
   *   data: {
   *     uploadUrl: string,  // 预签名上传 URL
   *     fileUrl: string,    // 上传后的访问 URL
   *     key: string         // S3 中的完整路径
   *   }
   * }
   *
   * S3 路径规则：plugin-feedbacks/{userIdHash}/{feedbackType}/{timestamp}-{fileName}
   * 例如：plugin-feedbacks/a1b2c3d4e5f6g7h8/bug/1700123456789-screenshot.png
   */
  async getUploadUrl() {
    const { ctx } = this;
    try {
      const { fileName, fileType } = ctx.request.body || {};

      // 从 ctx 获取 userId（登录用户）
      const userId = ctx.user?.uid;

      if (!userId) {
        ctx.body = { code: -1, msg: 'User not authenticated' };
        return;
      }

      if (!fileName) {
        ctx.body = { code: -1, msg: 'fileName is required' };
        return;
      }

      // 验证 feedbackType（可选，防止路径注入）

      // 🎯 构建 S3 路径
      const userIdHash = ctx.service.s3Upload.hashUserId(userId);
      const timestamp = Date.now();
      const key = `feedbacks/${userIdHash}/page/${timestamp}-${fileName}`;

      // 🎯 生成预签名 URL（给 10 分钟上传时间）
      const result = await ctx.service.s3Upload.generatePresignedUploadUrl({
        key,
        fileName,
        fileType,
        expires: 600, // 10 分钟
      });

      ctx.body = { code: 0, data: result };

      // 📊 可选：记录上传请求日志
      ctx.logger.info('[pluginFeedback.getUploadUrl] success', {
        userId,
        fileName,
        fileType,
        key: result.key,
      });
    } catch (error) {
      ctx.logger.error('[pluginFeedback.getUploadUrl] error: %s', error?.stack || error);
      ctx.body = { code: -1, msg: 'Failed to build presigned url' };
    }
  }
}

module.exports = PluginFeedbackController;
