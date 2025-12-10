/**
 * module 相关的枚举
 */
module.exports = {
  MODULE_STEP: {
    ACTIVATE: 'activate',
    VALIDATE: 'validate',
    EXECUTE: 'execute',
    /**
     * 意外失败，主要是触发 catch 的时候
     */
    UNEXPECTED_ERROR: 'unexpected_error',
  },
  MODULE_SECTION: {
    /**
     * 上传解题图片
     */
    UPLOAD_SOLVE_IMAGE: 'uploadSolveImage',
    /**
     * OCR
     */
    OCR: 'ocr',
    /**
     * 用户权益
     */
    ENTITLEMENT: 'entitlement',
    /**
     * 问题初始化
     */
    QUESTION_INIT: 'question_check',
    /**
     * 解题
     */
    PUB_SOLVING: 'pub_solving',
    /**
     * 推送
     */
    JPUSH: 'jpush',
  },
};
