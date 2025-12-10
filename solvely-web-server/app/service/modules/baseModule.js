const BaseService = require('../v9/BaseService');

class BaseModuleService extends BaseService {
  constructor(ctx) {
    super(ctx);
    this.MODULE_CONFIG = {};
  }

  canActivate() {
    throw new Error('[BaseModuleService] canActivate is not implemented');
  }

  validate() {
    throw new Error('[BaseModuleService] validate is not implemented');
  }

  execute() {
    throw new Error('[BaseModuleService] execute is not implemented');
  }
}

module.exports = BaseModuleService;
