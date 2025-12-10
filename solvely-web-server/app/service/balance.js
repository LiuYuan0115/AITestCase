const { Service } = require('egg');
const _ = require('lodash');
const moment = require('moment');

class BalanceService extends Service {
  /**
   * 解析实验标签字符串为 Map
   * @param {string} str 实验标签字符串
   * @return {Map} 实验名 -> 组名的映射
   */
  parseAssignmentsString(str) {
    const map = new Map();
    const ASSIGNMENT_ITEM_RE = /^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/;

    if (!str || typeof str !== 'string') {
      return map;
    }

    str
      .split(',')
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .forEach((item) => {
        if (!ASSIGNMENT_ITEM_RE.test(item)) {
          return;
        }
        const idx = item.indexOf(':');
        const experiment = item.slice(0, idx);
        const group = item.slice(idx + 1);
        if (!map.has(experiment)) {
          map.set(experiment, group);
        }
      });
    return map;
  }

  /**
   * 获取用户的实验组
   * @param {string} deviceId 用户设备ID
   * @param {string} experimentName 实验名称
   * @return {Promise<string|null>} 实验组名称，如果不存在则返回 null
   */
  async getUserExperimentGroup(deviceId, experimentName) {
    const { ctx } = this;
    try {
      const record = await ctx.model.UserExtendInfo.findOne({
        raw: true,
        attributes: ['abTestAssignments'],
        where: { deviceId },
      });

      if (!record || !record.abTestAssignments) {
        return null;
      }

      const assignmentsMap = this.parseAssignmentsString(record.abTestAssignments);
      return assignmentsMap.get(experimentName) || null;
    } catch (error) {
      this.app.getLogger('balanceLogger').error(`获取用户${deviceId}实验组失败:${error}`);
      return null;
    }
  }

  /**
   * 获取用户每日免费插件次数
   * @param {string} deviceId 用户设备ID
   * @return {Promise<number>} 每日免费次数，默认为 5 次
   */
  async getDailyFreePluginCount(deviceId) {
    try {
      const experimentGroup = await this.getUserExperimentGroup(deviceId, 'TEST_Plugin_2Solves');

      // 如果在 TEST_Plugin_2Solves:Test 实验组中，返回 2 次
      if (experimentGroup === 'Test') {
        return 2;
      }

      // 默认返回 5 次
      return 5;
    } catch (error) {
      this.app.getLogger('balanceLogger').error(`获取用户${deviceId}每日免费次数失败:${error}`);
      return 5; // 错误时返回默认值
    }
  }

  /**
   * 判断是否需要重置每日免费次数（基于美国西海岸时间UTC-7）
   * @param {Date|string|number} updateTime 用户上次更新时间
   * @return {boolean} 是否需要重置
   */
  shouldResetDailyPluginSimple(updateTime) {
    try {
      // 如果 updateTime 为空，说明从未更新过，需要重置
      if (!updateTime) {
        return true;
      }

      const now = new Date();
      const lastUpdate = new Date(updateTime);

      // 计算当前UTC时间减去7小时后的日期（美国西海岸时间）
      const pacificNow = new Date(now.getTime() - 7 * 60 * 60 * 1000);
      const pacificToday = new Date(
        Date.UTC(pacificNow.getUTCFullYear(), pacificNow.getUTCMonth(), pacificNow.getUTCDate()),
      );

      // 计算上次更新时间减去7小时后的日期（美国西海岸时间）
      const lastUpdatePacific = new Date(lastUpdate.getTime() - 7 * 60 * 60 * 1000);
      const lastUpdateDate = new Date(
        Date.UTC(
          lastUpdatePacific.getUTCFullYear(),
          lastUpdatePacific.getUTCMonth(),
          lastUpdatePacific.getUTCDate(),
        ),
      );

      // 比较日期是否相同，不同则需要重置
      const needReset = pacificToday.getTime() !== lastUpdateDate.getTime();

      return needReset;
    } catch (error) {
      return false; // 错误时保守处理，不重置
    }
  }

  /**
   * 确保每日免费plugin次数
   * @param {string} deviceId 设备ID
   * @param {Date|string|number} updateTime 上次更新时间
   * @param {number} dailyCount 每日免费次数，默认为 5
   * @return {Promise<boolean>} 是否进行了更新
   */
  async ensureDailyFreePlugin(deviceId, updateTime, dailyCount = 5) {
    const { ctx } = this;
    try {
      // 检查是否需要重置
      const needReset = this.shouldResetDailyPluginSimple(updateTime);

      if (needReset) {
        // 根据实验组设置不同的免费次数
        await ctx.model.Balance.update({ plugin: dailyCount }, { where: { deviceId } });
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取余额
   * @param {string} deviceId uid
   * @return {Number} 余额
   */
  async getDiamond(deviceId) {
    const { ctx } = this;
    deviceId = deviceId || ctx.user.uid;
    try {
      const result = await ctx.model.Balance.findOne({
        raw: true,
        attributes: [
          'balance',
          'teach',
          'teachTotal',
          'fast',
          'fastTotal',
          'plugin',
          'pluginTotal',
          'updateTime',
        ],
        where: {
          deviceId,
        },
      });

      if (_.isEmpty(result)) {
        return {
          balance: 0,
          teach: 0,
          teachTotal: 0,
          fast: 0,
          fastTotal: 0,
          plugin: 0,
          pluginTotal: 0,
        };
      }

      let { balance, teach, teachTotal, fast, fastTotal, plugin, pluginTotal, updateTime } = result;

      // 指定实验组的用户每天免费插件解题机会（根据实验标签动态调整）
      if (plugin < 5) {
        // 获取该用户的每日免费次数（根据实验组）
        const dailyFreeCount = await this.getDailyFreePluginCount(deviceId);

        // 如果 plugin 小于该用户应该有的免费次数，则执行重置
        if (plugin < dailyFreeCount) {
          // 执行每日免费次数检查
          const wasUpdated = await this.ensureDailyFreePlugin(deviceId, updateTime, dailyFreeCount);
          // 如果进行了更新，修改返回数据中的plugin值
          if (wasUpdated) {
            plugin = dailyFreeCount;
          }
        }
      }

      return {
        balance: +balance || 0,
        teach: teach || 0,
        teachTotal: teachTotal || 0,
        fast: fast || 0,
        fastTotal: fastTotal || 0,
        plugin: plugin || 0,
        pluginTotal: pluginTotal || 0,
      };
    } catch (e) {
      this.app.getLogger('balanceLogger').error(`用户${deviceId} 查询balance失败:${e}`);
      return {
        balance: 0,
        teach: 0,
        teachTotal: 0,
        fast: 0,
        fastTotal: 0,
        plugin: 0,
        pluginTotal: 0,
      };
    }
  }

  /**
   * 获取 pluginUuid 维度的余额
   * 只返回 plugin 字段（来自 PluginUserInfo 表），其他字段为 0
   *
   * @param {string} deviceId 用户ID
   * @param {string} pluginUuid 插件UUID
   * @return {Object} pluginUuid 维度的余额信息
   */
  async getPluginUuidBalance(deviceId, pluginUuid) {
    const { ctx } = this;

    try {
      // 查询 PluginUserInfo 表（只用 pluginUuid，因为它是唯一的）
      const result = await ctx.model.PluginUserInfo.findOne({
        raw: true,
        attributes: ['freeQuota', 'updateTime'],
        where: {
          pluginUuid,
        },
      });

      if (!result) {
        // 如果不存在记录，检查是否需要自动创建
        // 1. 查询该 deviceId 在 PluginUserInfo 表中的记录数量
        const count = await ctx.model.PluginUserInfo.count({
          where: { deviceId },
        });

        // 2. 如果记录数 < 3，则创建新记录
        if (count < 3) {
          // 2.1 从 Balance 表查询 plugin 值
          const balanceRecord = await ctx.model.Balance.findOne({
            raw: true,
            attributes: ['plugin'],
            where: { deviceId },
          });

          const pluginValue = balanceRecord?.plugin || 0;

          // 2.2 创建新记录
          await ctx.model.PluginUserInfo.create({
            deviceId,
            pluginUuid,
            freeQuota: pluginValue,
            isNewUser: 0,
          });

          console.log(
            `[PluginUserInfo] 自动创建成功 - deviceId: ${deviceId}, ` +
              `uuid: ${pluginUuid}, freeQuota: ${pluginValue}, count: ${count}`,
          );

          // 2.3 返回新创建的余额信息
          return {
            balance: 0,
            teach: 0,
            teachTotal: 0,
            fast: 0,
            fastTotal: 0,
            plugin: pluginValue,
            pluginTotal: 0,
          };
        }

        // 3. 如果记录数 > 3，返回全 0（原逻辑）
        return {
          balance: 0,
          teach: 0,
          teachTotal: 0,
          fast: 0,
          fastTotal: 0,
          plugin: 0,
          pluginTotal: 0,
        };
      }

      let { freeQuota, updateTime } = result;

      // 检查是否需要重置 pluginUuid 维度的每日免费次数
      const needReset = this.shouldResetDailyPluginSimple(updateTime);
      if (needReset) {
        const dailyFreeCount = 2;
        // 重置 pluginUuid 维度（只用 pluginUuid，因为它是唯一的）
        await ctx.model.PluginUserInfo.update(
          { freeQuota: dailyFreeCount },
          { where: { pluginUuid } },
        );
        freeQuota = dailyFreeCount;

        console.log(
          `[Balance API] pluginUuid维度每日重置 - deviceId: ${deviceId}, uuid: ${pluginUuid}, freeQuota: ${dailyFreeCount}`,
        );
      }

      // 只返回 plugin 字段（对外接口保持兼容），其他字段为 0
      return {
        balance: 0,
        teach: 0,
        teachTotal: 0,
        fast: 0,
        fastTotal: 0,
        plugin: freeQuota || 0,
        pluginTotal: 0,
      };
    } catch (e) {
      this.app
        .getLogger('balanceLogger')
        .error(`获取pluginUuid维度余额失败 deviceId:${deviceId} uuid:${pluginUuid} error:${e}`);
      return {
        balance: 0,
        teach: 0,
        teachTotal: 0,
        fast: 0,
        fastTotal: 0,
        plugin: 0,
        pluginTotal: 0,
      };
    }
  }

  /**
   * 更新余额
   * @param {String} deviceId user id
   * @param {Object} fields 要更新的字段 -> { balance: 10 } 为增加10个钻石，{ balance: -10 } 为减少10个钻石
   * @return {Object} 更新结果
   */
  async updateDiamond(deviceId, fields) {
    const { ctx } = this;
    if (!deviceId) {
      return {
        success: false,
        message: 'deviceId is required',
      };
    }
    if (!fields || Object.keys(fields).length === 0) {
      return {
        success: false,
        message: 'fields is required',
      };
    }
    // 检查是否存在该 deviceId 对应的数据
    const balance = await ctx.model.Balance.findOne({ where: { deviceId } });

    if (!balance) {
      // 如果数据不存在，创建新记录
      const newRecordData = { deviceId, ...fields };
      try {
        await ctx.model.Balance.create(newRecordData);

        // ========== 新增逻辑：pluginUuid 维度的同步扣除 ==========
        const pluginUuid = ctx.headers['x-plugin-uuid'];
        if (pluginUuid && this._shouldSyncPluginUuidDeduction(fields)) {
          await this._syncPluginUuidDeduction(deviceId, pluginUuid, fields);
        }

        return {
          success: true,
          message: 'New record created successfully',
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to create new record',
          error,
        };
      }
    }

    // 构建更新对象
    const updateData = {};
    for (const [field, value] of Object.entries(fields)) {
      updateData[field] = ctx.model.literal(`IFNULL(${field}, 0) + ${value}`);
    }

    try {
      // 更新指定字段
      await ctx.model.Balance.update(updateData, { where: { deviceId } });

      // ========== 新增逻辑：pluginUuid 维度的同步扣除 ==========
      const pluginUuid = ctx.headers['x-plugin-uuid'];
      if (pluginUuid && this._shouldSyncPluginUuidDeduction(fields)) {
        await this._syncPluginUuidDeduction(deviceId, pluginUuid, fields);
      }

      return {
        success: true,
        message: 'Fields updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Update failed',
        error,
      };
    }
  }

  /**
   * 判断是否需要同步 pluginUuid 维度扣除
   * @param {Object} fields 更新字段
   * @return {boolean}
   */
  _shouldSyncPluginUuidDeduction(fields) {
    // 只处理单字段操作
    const fieldNames = Object.keys(fields);
    if (fieldNames.length !== 1) {
      return false;
    }

    const field = fieldNames[0];
    const value = fields[field];

    // 只处理 plugin 或 balance 字段的扣除操作（负数）
    return (field === 'plugin' || field === 'balance') && value < 0;
  }

  /**
   * 同步 pluginUuid 维度的扣除
   * @param {string} deviceId 用户ID
   * @param {string} pluginUuid 插件UUID
   * @param {Object} fields 更新字段
   */
  async _syncPluginUuidDeduction(deviceId, pluginUuid, fields) {
    const { ctx } = this;
    const field = Object.keys(fields)[0];
    const value = fields[field];

    try {
      let deductCount = 0;

      if (field === 'plugin') {
        // plugin 字段：直接按次数扣除
        deductCount = Math.abs(value);
      } else if (field === 'balance') {
        // balance 字段：10 个 balance = 1 次
        deductCount = Math.abs(value) / 10;

        // 确保是整数
        if (deductCount % 1 !== 0) {
          this.app
            .getLogger('balanceLogger')
            .warn(
              `[UpdateDiamond] pluginUuid同步失败 - balance不是10的倍数: ` +
                `deviceId=${deviceId}, uuid=${pluginUuid}, balance=${value}`,
            );
          return;
        }
      }

      // 获取 pluginUuid 维度当前余额
      const pluginBalance = await this.getPluginUuidBalance(deviceId, pluginUuid);
      const availablePluginUuid = pluginBalance.plugin || 0;

      // 检查余额是否充足
      if (availablePluginUuid < deductCount) {
        this.app
          .getLogger('balanceLogger')
          .warn(
            `[UpdateDiamond] pluginUuid维度余额不足，跳过同步扣除 - ` +
              `deviceId=${deviceId}, uuid=${pluginUuid}, ` +
              `需要=${deductCount}, 可用=${availablePluginUuid}`,
          );
        return;
      }

      // 扣减 pluginUuid 维度（只扣 freeQuota）
      await ctx.model.PluginUserInfo.update(
        {
          freeQuota: ctx.model.literal(`GREATEST(freeQuota - ${deductCount}, 0)`),
        },
        { where: { pluginUuid } },
      );

      this.app
        .getLogger('balanceLogger')
        .info(
          `[UpdateDiamond] pluginUuid维度同步扣除成功 - ` +
            `deviceId=${deviceId}, uuid=${pluginUuid}, ` +
            `field=${field}, value=${value}, deductCount=${deductCount}`,
        );
    } catch (error) {
      this.app
        .getLogger('balanceLogger')
        .error(
          `[UpdateDiamond] pluginUuid维度同步扣除失败 - ` +
            `deviceId=${deviceId}, uuid=${pluginUuid}, error=${error}`,
        );
      // 不影响主流程，只记录错误
    }
  }

  /**
   * 退还钻石
   * @param {String} deviceId 设备id
   * @param {String} questionId 问题id
   */
  async refundDiamond(deviceId, questionId) {
    const { ctx, app } = this;
    const balanceLogger = app.getLogger('balanceLogger');
    try {
      // 查询questionId是否退过钻石
      const refundInfo = await ctx.model.QuestionRefund.findOne({
        raw: true,
        attributes: ['id'],
        where: {
          deviceId,
          questionId,
        },
      });
      // 未退还过钻石
      if (_.isEmpty(refundInfo)) {
        // 添加退还记录
        await ctx.model.QuestionRefund.create({
          deviceId,
          questionId,
          isRefund: 1,
          solvelyTime: moment().valueOf(),
        });
        // 退还钻石
        this.updateDiamond(deviceId, { balance: 10 });
        balanceLogger.info(`用户 ${deviceId} ${questionId} 退还 10 钻石`);
      }
    } catch (error) {
      balanceLogger.error(`用户${deviceId} ${questionId} 退还钻石失败:${error}`);
    }
  }

  /**
   * 校验余额/次数
   * @param {String} deviceId 设备id
   * @param {String} mode 解题模式
   * @return {Object} 校验结果
   */
  async checkBalance(deviceId, mode) {
    const { ctx } = this;
    const subscription = await ctx.service.subscription.findActiveSubscription();
    if (subscription.some((item) => item.subscribePlan === 'unlimited')) {
      return {
        consumptionType: 'unlimited',
        approved: true,
      };
    }

    // 🎯 新增：检查是否有 pluginUuid，优先使用 pluginUuid 维度
    const pluginUuid = ctx.headers['x-plugin-uuid'];
    if (pluginUuid) {
      const pluginBalance = await this.getPluginUuidBalance(deviceId, pluginUuid);
      return {
        consumptionType: 'plugin',
        approved: pluginBalance.plugin >= 1,
      };
    }

    const { balance, fast, teach, plugin } = await this.getDiamond();
    // 插件解题
    if (mode === 'plugin') {
      // 先检查次数是否充足
      const result = {
        consumptionType: 'plugin',
        approved: plugin >= 1,
      };
      // 如果次数充足，则返回
      if (result.approved) {
        return result;
      }
      // 如果次数不足，则检查钻石余额是否充足
      if (balance >= 10) {
        return {
          consumptionType: 'balance',
          approved: true,
        };
      }
      return result;
    }
    if (mode === 'teach') {
      return {
        consumptionType: 'teach',
        approved: teach >= 1,
      };
    }
    // fast | 查询该用户的实验组
    const isFastFreeQuestionUser = await ctx.service.abtest.isTutorOnExperiment(deviceId);
    if (isFastFreeQuestionUser) {
      return {
        consumptionType: 'fast',
        approved: fast >= 1,
      };
    }
    return {
      consumptionType: 'balance',
      approved: balance >= 10,
    };
  }

  /**
   * 扣减插件余额
   * 两种模式：
   * 1. 无 pluginUuid：只扣减用户余额（deviceId 维度）
   * 2. 有 pluginUuid：以 pluginUuid 为主维度，deviceId 为辅助维度同步扣减
   *
   * @param {string} deviceId 用户ID
   * @param {string} pluginUuid 插件UUID（可选）
   * @param {number} amount 扣减数量
   * @return {Object} 扣减结果
   */
  async deductPluginBalance(deviceId, pluginUuid, amount) {
    // 判断是否有 pluginUuid
    if (!pluginUuid) {
      // 模式1：无 pluginUuid，只扣减用户余额
      return await this._deductDeviceIdOnly(deviceId, amount);
    }
    // 模式2：有 pluginUuid，以 pluginUuid 为主，deviceId 为辅
    return await this._deductWithPluginUuid(deviceId, pluginUuid, amount);
  }

  /**
   * 模式1：只扣减 deviceId 维度的余额
   * 优先扣 plugin，不足时扣 balance
   *
   * @param {string} deviceId 用户ID
   * @param {number} amount 扣减数量
   * @return {Object} 扣减结果
   */
  async _deductDeviceIdOnly(deviceId, amount) {
    const { ctx } = this;

    // 获取用户余额
    const userBalance = await this.getDiamond(deviceId);
    const availablePlugin = userBalance.plugin || 0;
    const availableDiamond = Math.floor((userBalance.balance || 0) / 10);
    const totalAvailable = availablePlugin + availableDiamond;

    if (totalAvailable < amount) {
      return {
        success: false,
        deductedPlugin: 0,
        deductedBalance: 0,
        remaining: amount,
      };
    }

    // 计算扣减
    const deductPlugin = Math.min(amount, availablePlugin);
    const needFromBalance = amount - deductPlugin;
    const deductBalance = needFromBalance * 10;

    // 执行扣减
    await ctx.model.Balance.update(
      {
        plugin: ctx.model.literal(`GREATEST(IFNULL(plugin, 0) - ${deductPlugin}, 0)`),
        balance: ctx.model.literal(`GREATEST(IFNULL(balance, 0) - ${deductBalance}, 0)`),
      },
      { where: { deviceId } },
    );

    console.log(
      `[DeductPluginBalance] 仅deviceId模式 - deviceId: ${deviceId}, ` +
        `扣减: ${amount}, plugin: -${deductPlugin}, balance: -${deductBalance}`,
    );

    return {
      success: true,
      deductedPlugin: deductPlugin,
      deductedBalance: deductBalance,
      remaining: 0,
    };
  }

  /**
   * 模式2：以 pluginUuid 为主维度，deviceId 为辅助维度
   * pluginUuid 维度只有 plugin，没有 balance
   *
   * @param {string} deviceId 用户ID
   * @param {string} pluginUuid 插件UUID
   * @param {number} amount 扣减数量
   * @return {Object} 扣减结果
   */
  async _deductWithPluginUuid(deviceId, pluginUuid, amount) {
    const { ctx } = this;

    // 1. 获取 pluginUuid 维度的余额（主维度，决定是否可以扣减）
    const pluginBalance = await this.getPluginUuidBalance(deviceId, pluginUuid);
    const availablePluginUuid = pluginBalance.plugin || 0;

    // 2. 判断 pluginUuid 维度是否有足够余额
    if (availablePluginUuid < amount) {
      return {
        success: false,
        deductedPlugin: 0,
        deductedUserPlugin: 0,
        deductedBalance: 0,
        remaining: amount,
      };
    }

    // 3. pluginUuid 维度有足够余额，执行扣减

    // 3.1 扣减 pluginUuid 维度（只扣 freeQuota，只用 pluginUuid 因为它是唯一的）
    await ctx.model.PluginUserInfo.update(
      {
        freeQuota: ctx.model.literal(`GREATEST(freeQuota - ${amount}, 0)`),
      },
      { where: { pluginUuid } },
    );

    // 3.2 同时扣减 deviceId 维度（辅助维度）
    const userBalance = await this.getDiamond(deviceId);
    const availableUserPlugin = userBalance.plugin || 0;

    // 优先扣 plugin，不足时扣 balance
    const deductUserPlugin = Math.min(amount, availableUserPlugin);
    const needFromBalance = amount - deductUserPlugin;
    const deductBalance = needFromBalance * 10;

    await ctx.model.Balance.update(
      {
        plugin: ctx.model.literal(`GREATEST(IFNULL(plugin, 0) - ${deductUserPlugin}, 0)`),
        balance: ctx.model.literal(`GREATEST(IFNULL(balance, 0) - ${deductBalance}, 0)`),
      },
      { where: { deviceId } },
    );

    console.log(
      `[DeductPluginBalance] pluginUuid模式 - deviceId: ${deviceId}, uuid: ${pluginUuid}, ` +
        `扣减: ${amount}, pluginUuid.freeQuota: -${amount}, ` +
        `deviceId.plugin: -${deductUserPlugin}, deviceId.balance: -${deductBalance}`,
    );

    // 4. 返回 pluginUuid 维度的扣减结果
    return {
      success: true,
      deductedPlugin: amount, // pluginUuid 维度扣减的 plugin
      deductedUserPlugin: deductUserPlugin, // deviceId 维度扣减的 plugin（辅助信息）
      deductedBalance: deductBalance, // deviceId 维度扣减的 balance（辅助信息）
      remaining: 0,
    };
  }
}

module.exports = BalanceService;
