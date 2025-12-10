/**
 * 将用户上传的图片保存到 S3
 */
'use strict';

const _ = require('lodash');
const BaseModuleService = require('./baseModule');
const { MODULE_SECTION } = require('../../common/module');

// TModule 配置常量
const MODULE_CONFIG = {
  /**
   * 这里的 name 需要和文件名字保持一致，因为后续会通过文件名来获取 egg.service 实例
   */
  name: 'uploadSolveImage',
  section: MODULE_SECTION.UPLOAD_SOLVE_IMAGE,
  /**
   * 对外使用，其实输出由内部决定
   */
  stream: false,
  level: 1,
};

class EntitlementModuleService extends BaseModuleService {
  constructor(ctx) {
    super(ctx);
    this.MODULE_CONFIG = MODULE_CONFIG;
  }

  /**
   * 模块激活条件检查
   */
  canActivate() {
    const { files = [] } = this.ctx.__question_info__;
    const hasImageFile = _.some(files, (file) => file.mime.startsWith('image/'));
    if (!hasImageFile) {
      return { success: false, error: 'Missing image files' };
    }
    return { success: true };
  }

  /**
   * 验证输入数据
   */
  validate() {
    return { success: true };
  }

  /**
   * 执行主流程
   */
  async execute() {
    const { ctx } = this;
    const startTime = Date.now();
    const { files = [] } = ctx.__question_info__;
    const imageFiles = _.filter(files, (file) => file.mime.startsWith('image/'));
    ctx.__logger__.info(`[uploadImage] start, imageFiles:${imageFiles.length}`);

    try {
      const promises = _.map(imageFiles, (file) =>
        ctx.service.modules.utils.s3.uploadPictureS3(file),
      );
      const uploadImages = await Promise.all(promises);
      //
      ctx.__updateQuestionInfo({ uploadImages });
      return { success: true, result: uploadImages };
    } catch (error) {
      ctx.__logger__.error(`[uploadImage] error:${error}`);
      throw error;
    } finally {
      ctx.__logger__.info(`[uploadImage] duration:${Date.now() - startTime}ms`);
    }
  }
}

module.exports = EntitlementModuleService;
