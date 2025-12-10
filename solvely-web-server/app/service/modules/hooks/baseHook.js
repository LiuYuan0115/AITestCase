const BaseModuleService = require('../baseModule');

class BaseHookService extends BaseModuleService {
  async before() {
    throw new Error('[BaseHookService.before] not implemented');
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * 处理后续逻辑，比如更新数据库、ctx.__question_info__ 等
   *
   * @param {object} moduleResult 模块结果
   * @return {Promise<void>}
   */
  after(moduleResult) {
    throw new Error('[BaseHookService.after] not implemented' + JSON.stringify(moduleResult));
  }
}

module.exports = BaseHookService;
