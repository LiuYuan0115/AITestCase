const Service = require('egg').Service;
const crypto = require('crypto');

class AbTestService extends Service {
  constructor(ctx) {
    super(ctx);
    this.COOKIE_NAME = 's_bucket';
    this.COOKIE_OPTIONS = {
      signed: false,
      httpOnly: false,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30天有效期
      sameSite: 'Strict',
      path: '/',
    };
  }

  /**
   * 获取用户的 bucket
   * @param {string} deviceId - 设备ID
   * @return {Promise<string>} bucketId
   */
  async getUserBucket(deviceId) {
    const { ctx } = this;

    // 1. 从 cookie 获取
    const bucketFromCookie = ctx.cookies.get(this.COOKIE_NAME, { signed: false });
    if (bucketFromCookie) {
      return bucketFromCookie;
    }

    // 2. 从数据库查询
    const userExtendInfo = await ctx.model.UserExtendInfo.findOne({
      where: { deviceId },
      attributes: ['bucketId'],
      raw: true,
    });

    if (userExtendInfo?.bucketId) {
      this._setBucketCookie(userExtendInfo.bucketId);
      return userExtendInfo.bucketId;
    }

    // 3. 计算新的 bucket 分配
    const assignedBucketId = this._calculateBucketId(deviceId);

    // 4. 保存分配结果
    await this._saveBucketAllocation(deviceId, assignedBucketId);

    return assignedBucketId;
  }

  /**
   * 计算用户的 bucket 分配
   * @private
   * @param {string} deviceId - 设备ID
   * @return {string} bucketId - 分配的实验桶ID
   */
  _calculateBucketId(deviceId) {
    const { ctx } = this;
    // 从实验配置中获取桶的分布比例
    const { bucketDistribution } = ctx.experimentConfig.data;

    // 获取设备ID的归一化哈希值(0-1之间)
    const normalizedHash = this._getNormalizedHash(deviceId);
    // 累计概率,用于按比例分配
    let accumulatedRatio = 0;

    // 遍历所有实验桶配置
    for (const [bucketId, config] of Object.entries(bucketDistribution)) {
      // 累加每个桶的比例
      accumulatedRatio += config.ratio;
      // 如果归一化哈希值小于等于累计概率,则分配到当前桶
      if (normalizedHash <= accumulatedRatio) {
        return bucketId;
      }
    }

    // 如果都没有命中,则默认分配到对照组
    return 'control'; // 默认分配到对照组
  }

  /**
   * 保存 bucket 分配结果
   * @private
   * @param {string} deviceId - 设备ID
   * @param {string} bucketId - bucket ID
   */
  async _saveBucketAllocation(deviceId, bucketId) {
    const { ctx } = this;
    const config = ctx.experimentConfig.data;

    try {
      await ctx.model.UserExtendInfo.upsert(
        { deviceId, bucketId },
        { fields: ['bucketId'], where: { deviceId } },
      );
      ctx.service.point.firebasePoint(deviceId, config.bucketDistribution[bucketId].name);
      this._setBucketCookie(bucketId);
    } catch (error) {
      ctx.logger.error('保存用户 bucket 失败:', error);
      this._setBucketCookie(bucketId);
    }
  }

  /**
   * 设置 bucket cookie
   * @private
   * @param {string} bucketId - bucket ID
   */
  _setBucketCookie(bucketId) {
    this.ctx.cookies.set(this.COOKIE_NAME, bucketId, this.COOKIE_OPTIONS);
  }

  /**
   * 获取用户的实验信息
   * @param {string} deviceId - 设备ID
   * @return {Promise<string[]>} 实验信息
   */
  async getUserExperiments(deviceId) {
    // 从数据库获取
    const dbTestInfo = await this._getExperimentsFromDB(deviceId);
    if (dbTestInfo.length) {
      return dbTestInfo;
    }
    return [];
  }

  /**
   * 从数据库获取实验信息
   * @private
   * @param {string} deviceId - 设备ID
   * @return {Promise<string[]>} 实验信息
   */
  async _getExperimentsFromDB(deviceId) {
    const { ctx } = this;
    const userExtendInfo = await ctx.model.UserExtendInfo.findOne({
      where: { deviceId },
      attributes: ['abTestTags', 'abTestAssignments'],
      raw: true,
    });

    if (!userExtendInfo?.abTestTags && !userExtendInfo?.abTestAssignments) {
      return [];
    }

    const tagList = userExtendInfo?.abTestTags
      ? userExtendInfo.abTestTags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const assignmentList = userExtendInfo?.abTestAssignments
      ? userExtendInfo.abTestAssignments
          .split(',')
          .map((s) => s.trim().replace(/:/g, '_'))
          .filter(Boolean)
      : [];

    return [...new Set([...tagList, ...assignmentList])];
  }

  /**
   * 分配新的实验
   * @param {string} deviceId - 设备ID
   * @param {string|string[]} targetExperimentIds - 指定要分配的实验ID（单个或数组）
   * @param {string} bucketId - bucket ID，如果为空，则使用计算的bucketId
   * @return {Promise<string[]>} 实验信息
   */
  async allocateNewExperiments(deviceId, targetExperimentIds, bucketId) {
    const { ctx } = this;
    const config = ctx.experimentConfig.data;
    if (!bucketId) {
      bucketId = this._calculateBucketId(deviceId);
    }
    const newExperimentGroups = [];

    // 如果没有指定实验ID，直接返回空数组
    if (!targetExperimentIds) {
      return [];
    }

    // 将单个实验ID转换为数组形式
    const experimentIds = Array.isArray(targetExperimentIds)
      ? targetExperimentIds
      : [targetExperimentIds];

    // 获取当前bucket的配置
    const bucketConfig = config.buckets[bucketId];
    if (!bucketConfig?.experiments) {
      return [];
    }

    // 遍历每个目标实验进行分配
    for (const experimentId of experimentIds) {
      // 查找目标实验
      const experiment = bucketConfig.experiments[experimentId];
      if (!experiment || experiment.status !== 'active') {
        continue;
      }

      // 根据比例分配实验组
      const normalizedHash = this._getNormalizedHash(`${deviceId}:${experimentId}`);
      let accumulatedRatio = 0;

      for (const group of experiment.groups) {
        accumulatedRatio += group.ratio;
        if (normalizedHash <= accumulatedRatio) {
          newExperimentGroups.push(group.name);
          break;
        }
      }
    }

    if (newExperimentGroups.length) {
      await this._saveExperiments(deviceId, newExperimentGroups);
      this._reportNewExperiments(deviceId, newExperimentGroups);
    }

    return newExperimentGroups;
  }

  /**
   * 基于已有实验标签，分配实验，若已经存在，则不分配
   * 直接更新传入的existingTags
   * @param {string} deviceId - 设备ID
   * @param {string|string[]} targetExperimentIds - 指定要分配的实验ID（单个或数组）
   * @param {string[]} existingTags - 已有的实验标签
   * @param {string} bucketId - bucket ID
   * @return {Promise<string[]>} 实验信息
   */
  async allocateNewExperimentsByTags(deviceId, targetExperimentIds, existingTags = [], bucketId) {
    // 确保 targetExperimentIds 是数组
    const experimentIds = Array.isArray(targetExperimentIds)
      ? targetExperimentIds
      : [targetExperimentIds];

    // 过滤出需要分配的实验ID
    const needAllocation = experimentIds.filter((experimentId) => {
      // 检查是否已存在相同前缀的实验标签
      return !existingTags.some((tag) => tag.startsWith(experimentId));
    });

    // 如果有需要分配的实验，则进行分配
    if (needAllocation.length > 0) {
      try {
        const newExperimentGroups = await this.allocateNewExperiments(
          deviceId,
          needAllocation,
          bucketId,
        );
        // 合并新旧实验标签并去重
        existingTags.push(...newExperimentGroups);
        existingTags = [...new Set(existingTags)];
      } catch (error) {
        this.ctx.logger.error('分配新实验失败:', error);
      }
    }
    return existingTags;
  }

  /**
   * 保存实验信息
   * @private
   * @param {string} deviceId - 设备ID
   * @param {string[]} experiments - 实验信息
   */
  async _saveExperiments(deviceId, experiments) {
    const { ctx } = this;
    try {
      const userExtendInfo = await ctx.model.UserExtendInfo.findOne({
        where: { deviceId },
        attributes: ['abTestTags'],
        raw: true,
      });

      // 合并现有的实验标签和新的实验标签
      const existingTags = userExtendInfo?.abTestTags ? userExtendInfo.abTestTags.split(',') : [];
      const mergedTags = [...new Set([...existingTags, ...experiments])];
      const abTestTags = mergedTags.join(',');

      // 更新或创建记录
      await ctx.model.UserExtendInfo.upsert(
        { deviceId, abTestTags },
        { fields: ['abTestTags'], where: { deviceId } },
      );
    } catch (error) {
      ctx.logger.error('保存实验分配失败:', error);
    }
  }

  /**
   * 上报新实验
   * @private
   * @param {string} deviceId - 设备ID
   * @param {string[]} experiments - 实验信息
   */
  _reportNewExperiments(deviceId, experiments) {
    for (const experiment of experiments) {
      this.ctx.service.point.firebasePoint(deviceId, experiment);
    }
  }

  /**
   * 检查用户是否在特定实验中
   * @param {string} deviceId - 设备ID
   * @param {string} experimentId - 实验ID
   * @return {Promise<Object>} 实验状态信息
   */
  async isUserInExperiment(deviceId, experimentId) {
    // 1. 检查实验标签
    const tagResult = await this._checkExperimentTag(deviceId, experimentId);

    if (tagResult) {
      return tagResult;
    }

    // 2. 检查全局归档或bucket归档
    const globalResult = await this._checkGloballyArchivedExperiment(deviceId, experimentId);

    if (globalResult) {
      return globalResult;
    }

    // 3. 检查合并规则
    const mergeResult = await this._checkMergedExperiment(deviceId, experimentId);

    if (mergeResult) {
      return mergeResult;
    }

    return {
      inExperiment: false,
      status: 'not_found',
      bucketId: await this.getUserBucket(deviceId),
    };
  }

  /**
   * 检查实验标签
   * @private
   * @param {string} deviceId - 设备ID
   * @param {string} experimentId - 实验ID
   * @return {Promise<Object|null>} 实验状态信息
   */
  async _checkExperimentTag(deviceId, experimentId) {
    const userTestInfo = await this.getUserExperiments(deviceId);
    if (userTestInfo.includes(experimentId)) {
      return {
        inExperiment: true,
        status: 'active',
        source: 'tag',
      };
    }
    return null;
  }

  /**
   * 检查合并规则
   * @private
   * @param {string} deviceId - 设备ID
   * @param {string} experimentId - 实验ID
   * @return {Promise<Object|null>} 实验状态信息
   */
  async _checkMergedExperiment(deviceId, experimentId) {
    const { ctx } = this;
    const config = ctx.experimentConfig.data;
    const bucketId = await this.getUserBucket(deviceId);

    const isMerged = config.mergeRules.some(
      (rule) => rule.experiment === experimentId && rule.includesBuckets.includes(bucketId),
    );

    if (!isMerged) {
      return null;
    }

    return {
      inExperiment: true,
      status: 'merged',
    };
  }

  /**
   * 检查全局归档和特定bucket归档的实验状态
   * @private
   * @param {string} deviceId - 设备ID
   * @param {string} experimentId - 实验ID
   * @return {Promise<Object|null>} 实验状态信息,包含实验是否命中、状态和来源
   */
  async _checkGloballyArchivedExperiment(deviceId, experimentId) {
    const { ctx } = this;
    const config = ctx.experimentConfig.data;
    // 获取用户的bucket ID
    const bucketId = await this.getUserBucket(deviceId);

    // 检查实验组是否包含指定的实验ID
    const checkExperimentGroups = (experiment) => {
      return (
        // 检查实验组名称是否匹配
        experiment.groups?.some((group) => group.name === experimentId) ||
        // 检查归档信息中的组ID是否匹配
        experiment.archiveInfo?.groupId === experimentId
      );
    };

    // 获取当前用户所在的bucket
    const currentBucket = config.buckets[bucketId];
    if (currentBucket?.experiments) {
      // 在当前bucket中查找已归档的实验
      const archivedExperiment = Object.values(currentBucket.experiments).find(
        (exp) => exp?.status === 'archived' && checkExperimentGroups(exp),
      );

      // 如果找到已归档的实验,返回bucket级别的归档状态
      if (archivedExperiment) {
        return {
          inExperiment: true,
          status: 'archived',
          source: 'bucket',
        };
      }
    }

    // 遍历所有bucket,查找全局归档的实验
    for (const bucket of Object.values(config.buckets)) {
      const globallyArchivedExperiment = Object.values(bucket.experiments).find(
        (exp) => exp?.status === 'globally_archived' && checkExperimentGroups(exp),
      );

      // 如果找到全局归档的实验,返回全局归档状态
      if (globallyArchivedExperiment) {
        return {
          inExperiment: true,
          status: 'globally_archived',
          source: 'global',
        };
      }
    }

    // 未找到任何归档实验,返回null
    return null;
  }

  /**
   * 获取归一化的哈希值
   * @private
   * @param {string} input - 输入字符串
   * @return {number} 归一化的哈希值
   */
  _getNormalizedHash(input) {
    const hash = crypto.createHash('md5').update(input).digest('hex');
    const hashNum = parseInt(hash.substring(0, 8), 16);
    return hashNum / 0xffffffff;
  }

  /**
   * 是否有tutor on实验
   * @param {string} deviceId - 设备ID
   * @return {Promise<boolean>} 是否在实验中
   */
  async isTutorOnExperiment(deviceId) {
    const { ctx } = this;
    const userExtendInfo = await ctx.model.UserExtendInfo.findOne({
      where: { deviceId },
      attributes: ['abTestTags'],
      raw: true,
    });
    return userExtendInfo?.abTestTags?.includes('TEST_TutormodeNewUser_On');
  }
}

module.exports = AbTestService;
