/**
 * 主要是针对 module 的执行、封装
 *
 * 🚀 flowConf 的结构如下：
 * 执行顺序是如下，注意 1、2、3 为独立的 stage，stage 之间只能串行, 且为必备阶段，不可省略
 * 每个 stage 下的 module 根据业务要求来约定是并行还是串行
 * 比如：ios 约定即使用户权益失败也需要执行完成 ocr 这里需要强制 parallel = true
 *
 * 1. ['question_check', 'ocr', 'entitlement']: 并行：[题目检查 -> OCR] & [用户权益]
 * 2. pub_question_solving: 串行：[pub 解题]
 * 3. jpush: 串行：[JPush]
 *
 * flows 会按照上面的约定和顺序配置
 * ⚠️ 注意，section 应该是表示具有相同功能的 module 分组集合，stage 只是当前业务要求，不一定在别的业务上一致
 *
 * demo 配置
 * */

const { Service } = require('egg');
const _ = require('lodash');

class DispatcherService extends Service {
  /**
   * stage 下的 module 编排
   * @param _stageConf
   */
  async _stageDespatcher(_stageConf) {
    const { ctx } = this;
    if (_.isEmpty(_stageConf)) {
      throw new Error('[stageDespatcher] stageConf is empty');
    }

    const stageConf = _.cloneDeep(_stageConf);
    const { sections, stageCode } = stageConf;
    const logPrefix = `[orchestrateStageModules][${stageCode}]`;
    const startTime = Date.now();

    const modules = []; // 记录实例
    const moduleNames = []; // 只记录名字
    const skippedModules = [];

    try {
      ctx.__logger__.info(`${logPrefix} start`);

      /**
       * 处理 stage 下的 module 逻辑
       * 1. 动态拼接 sections 的模块下的 module
       * 1. module.canActivate() 返回结果为 true
       * 2. 如果存在多个 module，则返回 level 最大的
       */
      for (const section of sections) {
        const { module, skipped } = await ctx.service.dispatcher.section.despatcher(section);
        if (module) {
          modules.push(module);
          moduleNames.push(module.MODULE_CONFIG.name);
        }
        skippedModules.push(...(skipped || []));
      }

      // ⚠️ 这里的 modules 直接返回的就是 module 实例
      return { modules, moduleNames, skippedModules };
    } catch (error) {
      ctx.__logger__.error(`${logPrefix} error: ${error}`);
      throw error;
    } finally {
      ctx.__logger__.info(`${logPrefix} duration:${Date.now() - startTime}ms`);
    }
  }

  /**
   * 返回 hooks service
   * @param {String | Egg.Service} hooks
   * @return {Egg.Service | undefined}
   */
  async _getHooksService(hooks) {
    if (_.isEmpty(hooks)) {
      return;
    }

    const { ctx } = this;
    let hookService = hooks;
    if (typeof hooks === 'string') {
      const execPath = hooks.split('.');
      hookService = execPath.reduce((acc, curr) => acc[curr], ctx);
    }
    if (!hookService?.before && !hookService?.after) {
      throw new Error(`[getHooksService] hook ${hooks} is not a hook Service`);
    }
    return hookService;
  }

  /**
   * 执行单个 module 对象
   * @param module
   */
  async _processModule(module) {
    if (!module?.MODULE_CONFIG?.name) {
      throw new Error('[processModule] Input module is not a valid module');
    }
    const { ctx } = this;
    const { name, section, level, hooks } = module.MODULE_CONFIG;
    const startTime = Date.now();
    const logPrefix = `[processModule][${name}]`;
    const moduleResult = {
      name,
      section,
      level,
      isSkip: false,
      //
      success: false,
      error: '',
      result: {},
      hooksResult: {},
    };
    const hookService = await this._getHooksService(hooks);

    try {
      // 阶段：执行 hooks-before
      if (hookService?.before) {
        const { isSkip, result: beforeResult } = await hookService.before(moduleResult);
        moduleResult.hooksResult.before = beforeResult;
        moduleResult.isSkip = isSkip;
        if (isSkip) {
          ctx.__logger__.info(`${logPrefix} skip by before hook`);
          moduleResult.success = true;
          moduleResult.result = beforeResult;
          return moduleResult;
        }
      }

      // 阶段: 验证
      ctx.__logger__.info(`${logPrefix} start`);
      const validateResult = await module.validate();
      if (!validateResult.success) {
        const { error } = validateResult;
        moduleResult.error = error;
        return moduleResult;
      }
      ctx.__logger__.info(`${logPrefix} validate success`);

      /**
       * 阶段：执行
       * 1. 只要是不报错就是成功
       */
      ctx.__logger__.info(`${logPrefix} execute start`);
      const { success, result, afterResult, error } = await module.execute();
      moduleResult.result = result || {};
      moduleResult.afterResult = afterResult || {};
      if (!success) {
        moduleResult.error = error;
        return moduleResult;
      }
      ctx.__logger__.info(`${logPrefix} execute success`);

      // 明确返回一个成功结果
      moduleResult.success = true;
      return moduleResult;
    } catch (e) {
      ctx.__logger__.error(`${logPrefix} error: ${e}`);
      moduleResult.error = e.message;
      return moduleResult;
    } finally {
      // 阶段：执行 hooks-after
      await hookService?.after(moduleResult);

      /**
       * 将该 module 的结果保存在 ctx 中
       *  毕竟每个 module 直接使用的 ctx.__question_info__, 需要分散处理吗？
       */
      ctx.__updateProcessInfo({ modules: { [name]: moduleResult } });
      ctx.__logger__.info(`${logPrefix} duration:${Date.now() - startTime}ms`);
    }
  }

  /**
   * 【核心】DSL驱动的工作流执行引擎
   * @param _flowConf
   */
  async run(_flowConf) {
    const { ctx } = this;
    const logPrefix = '[run]';
    if (_.isEmpty(_flowConf)) {
      throw new Error(`${logPrefix} flowConf is empty`);
    }

    const flowConf = _.cloneDeep(_flowConf);
    const runResult = {
      success: true,
      failedModules: [],
    };
    ctx.__logger__.info(`${logPrefix} flowConf: ${JSON.stringify(flowConf)}`);

    let runSuccess = true;

    // 串行执行工作流的每一个 stage 阶段
    const lastStageKey = Object.keys(flowConf).pop();
    for (const [key, stage] of Object.entries(flowConf)) {
      // 获取每个 stage 下需要执行的 modules
      const { modules, moduleNames, skippedModules } = await this._stageDespatcher(stage);
      if (_.isEmpty(modules)) {
        // 表示没有需要执行的 modules
        if (key === lastStageKey) {
          // 最后一个 stage 没有需要执行的 modules，给出 warning
          ctx.__logger__.warn(`${logPrefix} last stage ${key} has no modules to execute`);
        }
        continue;
      }
      ctx.__updateProcessInfo({
        flowConf: { [key]: { ...stage, modules: moduleNames, skippedModules } },
      });

      // 2. 根据 parallel 标志，决定阶段内模块的执行方式
      try {
        if (stage.parallel) {
          /**
           * 并行执行
           * _processModule 已经保证了永远不会 throw，所以使用 Promise.all 即可
           */
          const promises = modules.map((m) => this._processModule(m));
          const results = await Promise.all(promises);

          // 找到失败的模块
          const failedModules = results.filter((result) => !result.success);
          if (failedModules.length) {
            for (const { name } of failedModules) {
              const m = modules.find((m) => m.MODULE_CONFIG.name === name);
              await m?.stageError?.();
            }

            runResult.success = false;
            runResult.failedModules.push(...failedModules);
            //
            runSuccess = false;
            break;
          }
        } else {
          /**
           * 串行执行
           * 如果一个模块执行不成功，则中断该阶段
           */
          for (const m of modules) {
            const result = await this._processModule(m);
            if (!result.success) {
              runResult.success = false;
              runResult.failedModules.push(result);
              //
              runSuccess = false;
              return { success: runSuccess, runResult, process: ctx.__process_info__ };
            }
          }
        }
      } catch (error) {
        ctx.__logger__.error(`${logPrefix} stage ${key} error: ${error}`);
        runResult.success = false;
        runResult.error = error.message;
        runResult.failedModules.push({
          stage: key,
          error,
        });
        runSuccess = false;
        return { success: runSuccess, runResult, process: ctx.__process_info__ };
      }
    }

    //
    return { success: runSuccess, runResult, process: ctx.__process_info__ };
  }
}

module.exports = DispatcherService;
