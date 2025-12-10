const { Service } = require('egg');
const _ = require('lodash');

//
const sectionMap = {};
class SectionDispatcherService extends Service {
  constructor(ctx) {
    super(ctx);
    // 启动时候创建

    this._initSectionMap();
  }

  _initSectionMap() {
    if (!_.isEmpty(sectionMap)) {
      return;
    }

    //
    const { ctx, app } = this;
    const moduleServiceNames = Object.keys(app.serviceClasses.modules); // app.serviceClasses 固定写法
    for (const key of moduleServiceNames) {
      const moduleConfig = ctx.service.modules[key]?.MODULE_CONFIG;
      if (_.isEmpty(moduleConfig)) {
        /**
         * 因为 ctx service 一般包含 _cache、_ctx 以及 baseModule
         * 所以这里，我们认定只有 service 带有有效 MODULE_CONFIG 的才是我们需要的 module 组件
         * 否则，跳过
         */
        continue;
      }
      const { section, name } = moduleConfig;
      if (!sectionMap[section]) {
        sectionMap[section] = [];
      }
      sectionMap[section].push(name);
    }

    ctx.__logger__.info(`[initSectionMap] sectionMap: ${JSON.stringify(sectionMap)}`);
  }

  /**
   * 通过 module 名字获取 module 实例
   * @param {*} name
   * @return {Egg.Service}
   */
  _getModuleByName(name) {
    const { ctx } = this;
    const module = ctx.service.modules[name];
    if (!module) {
      throw new Error(`[getModuleByName] module ${name} not found`);
    }
    return module;
  }

  /**
   * 公共级别的分发
   * ⚠️ 返回 module 的实例，而不是名字
   * @param section
   */
  async _despatcher(section) {
    // 相同的 section 可能有多个 module
    const skippedModules = [];
    const activateModules = [];

    for (const moduleName of sectionMap[section] || []) {
      const module = this._getModuleByName(moduleName);
      const canActivateResult = await module?.canActivate();
      if (canActivateResult?.success) {
        activateModules.push(module);
      } else {
        // 记录没有通过的原因
        skippedModules.push({ moduleName, canActivateResult });
      }
    }

    // 最终符合的只有一个
    const runModule = _.maxBy(activateModules, (m) => m.MODULE_CONFIG.level);
    /**
     * 阶段可能没有符合要求的 module，比如 ocr 遇到文字题
     */
    return { module: runModule, moduleName: runModule?.MODULE_CONFIG?.name, skippedModules };
  }

  /**
   * sections 级别分发
   * ⚠️ 返回 module 的实例，而不是名字
   * @param section
   * @return {Promise<{ module:Egg.Service, skipped:{moduleName:string, canActivateResult:any}[]}>}
   */
  async despatcher(section) {
    return await this._despatcher(section);
  }
}

module.exports = SectionDispatcherService;
