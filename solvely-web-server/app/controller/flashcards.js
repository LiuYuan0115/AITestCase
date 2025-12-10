const { Controller } = require('egg');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class FlashcardsController extends Controller {
  /**
   * @description 批量获取 S3 预签名上传 URL（与 flashcards-server 逻辑保持一致）
   * 请求体: { files: [{ fileName: string, fileType: string, prefix?: string }] }
   * 响应体: { code: 0, data: { urls: [{ fileName, uploadUrl, fileUrl }] } }
   */
  async batchPresignedUrl() {
    const { ctx, app } = this;
    try {
      const { files } = ctx.request.body || {};
      if (!Array.isArray(files) || files.length === 0) {
        ctx.body = { code: -1, msg: 'files must be a non-empty array' };
        return;
      }

      const allowedTypes = new Set([
        'doc',
        'docx',
        'pdf',
        'xls',
        'xlsx',
        'ppt',
        'pptx',
        'txt',
        'jpg',
        'jpeg',
        'png',
        'webp',
        'gif',
      ]);

      const region = app.config?.aws?.s3?.region || 'ap-northeast-1';
      const bucket = app.config?.aws?.s3?.flashcardsBucket || 'solvely-test';
      const expires = parseInt('300', 10);
      const s3Client = app.context.s3Client;

      const getContentType = (fileType) => {
        const map = {
          doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          pdf: 'application/pdf',
          xls: 'application/vnd.ms-excel',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ppt: 'application/vnd.ms-powerpoint',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          txt: 'text/plain',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
        };
        return map[(fileType || '').toLowerCase()] || 'application/octet-stream';
      };

      const buildFileKey = (fileName, fileType, prefix) => {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const sanitized = String(fileName)
          .replace(/\s+/g, '-')
          .replace(/[^\w\d.-]/g, '');
        const basePath = prefix ? `${String(prefix).replace(/^\/|\/$/g, '')}/` : '';
        return `${basePath}${timestamp}-${randomStr}-${sanitized}`;
      };

      const urls = await Promise.all(
        files.map(async (item) => {
          const fileName = item && item.fileName;
          const fileType = item && item.fileType;
          const incomingPrefix = item && item.prefix;

          if (!fileName || !fileType || !allowedTypes.has(String(fileType))) {
            throw new Error('invalid file item: fileName and valid fileType are required');
          }

          const dir = app.config?.aws?.s3?.flashcardsDir || 'resource';
          const prefixBase = incomingPrefix ? `${dir}/${incomingPrefix}` : dir;

          const key = buildFileKey(fileName, fileType, prefixBase);
          const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: getContentType(fileType),
          });
          const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expires });
          const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

          return { fileName, uploadUrl, fileUrl };
        }),
      );

      ctx.body = {
        code: 0,
        data: { urls },
      };
    } catch (error) {
      ctx.logger.error(
        '[flashcards.batchPresignedUrl] error: %s',
        error && (error.stack || error.message || String(error)),
      );
      ctx.body = { code: -1, msg: 'Failed to build presigned urls' };
    }
  }
}

module.exports = FlashcardsController;
