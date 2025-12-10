/**
 * JPush 极光推送相关
 */
'use strict';

const _ = require('lodash');
const path = require('path');

const BaseModuleService = require('./baseModule');
const { MODULE_SECTION } = require('../../common/module');

// TModule 配置常量
const MODULE_CONFIG = {
  name: _.camelCase(path.basename(__filename, '.js')),
  section: MODULE_SECTION.JPUSH,
  stream: false,
  level: 1,
  hooks: 'service.modules.hooks.jpush',
};

class JPushModuleService extends BaseModuleService {
  constructor(ctx) {
    super(ctx);
    this.MODULE_CONFIG = MODULE_CONFIG;
  }

  /**
   * 模块激活条件检查
   */
  canActivate() {
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
    return { success: true };
  }
}

module.exports = JPushModuleService;
