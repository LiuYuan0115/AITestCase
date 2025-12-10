const { Service } = require('egg');
const uuid = require('uuid');

class S3Utils extends Service {
  /**
   * 上传到 S3 的工具函数
   * @param {Object} file 文件对象
   * @param {string} fileName 文件名
   * @param {string} bucket 桶名
   */
  async uploadPictureS3(file, fileName = '', bucket = 'questionImage') {
    const { ctx } = this;
    const pictureKey = fileName || uuid.v4();
    return await ctx.helper.uploadPictureS3(file, pictureKey, bucket);
  }
}

module.exports = S3Utils;
