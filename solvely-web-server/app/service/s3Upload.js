const { Service } = require('egg');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

/**
 * S3 上传服务 - 提供通用的预签名 URL 生成能力
 */
class S3UploadService extends Service {
  /**
   * 生成 S3 预签名上传 URL（通用方法）
   * @param {Object} options - 上传选项
   * @param {string} options.key - S3 对象的完整路径（如：canvas-captures/domain/userHash/file.json）
   * @param {string} [options.fileName] - 文件名（如果提供，会自动清理特殊字符）
   * @param {string} [options.fileType] - 文件类型（用于设置 Content-Type）
   * @param {number} [options.expires=300] - 过期时间（秒），默认 5 分钟
   * @param {string} [options.bucket] - 指定桶，默认使用配置的 pluginBucket
   * @return {Promise<{uploadUrl: string, fileUrl: string, key: string}>}
   */
  async generatePresignedUploadUrl(options) {
    const { app } = this;
    const {
      key,
      fileName,
      fileType,
      expires = 300,
      bucket = app.config?.aws?.s3?.pluginBucket || 'solvely-test',
    } = options;

    const region = app.config?.aws?.s3?.region || 'ap-northeast-1';
    const s3Client = app.context.s3Client;

    // 如果提供了 fileName，进行清理并替换 key 的文件名部分
    let finalKey = key;
    if (fileName) {
      const sanitizedFileName = this.sanitizeFileName(fileName);
      // 替换 key 中最后一个 / 之后的部分（即文件名）
      finalKey = key.replace(/[^/]+$/, sanitizedFileName);
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: finalKey,
      ContentType: this.getContentType(fileType || ''),
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expires });
    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${finalKey}`;

    return { uploadUrl, fileUrl, key: finalKey };
  }

  /**
   * Hash userId 以保护隐私
   * 使用 SHA-256，确保同一 userId 总是生成相同的 hash
   * 取前 16 字符以缩短路径长度
   * @param {string} userId - 用户 ID
   * @return {string} - Hash 后的用户 ID（前 16 字符）
   */
  hashUserId(userId) {
    return crypto.createHash('sha256').update(String(userId)).digest('hex').substring(0, 16);
  }

  /**
   * 清理文件名 - 移除空格和特殊字符
   * @param {string} fileName - 原始文件名
   * @return {string} - 清理后的文件名
   */
  sanitizeFileName(fileName) {
    return String(fileName)
      .replace(/\s+/g, '-') // 空格替换为连字符
      .replace(/[^\w\d.-]/g, ''); // 只保留字母、数字、点、连字符
  }

  /**
   * 根据文件类型获取对应的 MIME Content-Type
   * @param {string} fileType - 文件类型/扩展名
   * @return {string} - MIME type
   */
  getContentType(fileType) {
    const map = {
      // 文档类型
      json: 'application/json',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      // 图片类型
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      // 音频类型
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      // 视频类型
      mp4: 'video/mp4',
      webm: 'video/webm',
    };
    return map[(fileType || '').toLowerCase()] || 'application/octet-stream';
  }
}

module.exports = S3UploadService;
