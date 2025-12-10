const { Service } = require('egg');
const _ = require('lodash');

class UserService extends Service {
  /**
   * 查询用户信息
   * @return {Object|null} 用户信息
   */
  async find() {
    const { ctx } = this;
    const { uid: deviceId } = ctx.user;
    try {
      // 阶段1: 获取用户信息
      const [userInfo, balance] = await Promise.all([
        ctx.model.UserInfo.findOne({
          raw: true,
          attributes: [
            'deviceId',
            'isSigned',
            'role',
            'userName',
            'email',
            'webAdjustUserId',
            'country',
            'userPicture',
            'grade',
            'createTime',
            'source',
          ],
          where: { deviceId },
        }),
        ctx.service.balance.getDiamond(),
      ]);
      if (_.isEmpty(userInfo)) {
        return null;
      }
      const data = {
        ...userInfo,
        ...balance,
      };

      // 阶段2: 处理国家信息
      if (!data.country) {
        data.country = await this.handleMissingCountry(deviceId);
      }
      return data;
    } catch (e) {
      ctx.logger.error('查询用户信息失败', e);
      return null;
    }
  }

  async handleMissingCountry(deviceId) {
    const { ctx } = this;
    const country = await ctx.service.common.getCountryInfo();
    if (country) {
      await ctx.model.UserInfo.update(
        { country },
        {
          where: { deviceId },
        },
      );
    }
    return country;
  }

  /**
   * 查询用户信息
   * @param {String} deviceId 用户id
   * @return {Object|null} userInfo
   */
  async findUser(deviceId) {
    const { ctx } = this;
    try {
      const userInfo = await ctx.model.UserInfo.findOne({
        raw: true,
        attributes: ['webPushToken', 'country', 'userName', 'email'],
        where: {
          deviceId,
        },
      });
      return userInfo;
    } catch (e) {
      ctx.logger.error('查询用户信息失败', e);
      return null;
    }
  }
  /**
   * feedback
   */
  async feedback() {
    const { ctx } = this;
    try {
      const { title, description, time: solvelyTime, imageUrls = [] } = ctx.request.body;
      const data = {
        deviceId: ctx.user.uid,
        appVersion: ctx.app.config.version,
        system: 'web',
        title,
        description,
        solvelyTime,
      };
      if (imageUrls) {
        data.imageUrls = JSON.stringify(imageUrls);
      }
      await ctx.model.Feedback.create(data);
    } catch (e) {
      ctx.logger.error('feedback失败', e);
    }
  }
  /**
   * 生成4个随机字符串
   */
  randomString() {
    const len = 4;
    const $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    const maxPos = $chars.length;
    let pwd = '';
    for (let i = 0; i < len; i++) {
      pwd = pwd + $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
  }

  /**
   * 上报用户信息专用
   * @param {Object} data 用户信息
   */
  async updateUserInfo(data) {
    const { ctx } = this;
    try {
      const deviceId = ctx.user.uid;
      const [user, countryInfo] = await Promise.all([
        ctx.model.UserInfo.findOne({
          raw: true,
          where: { deviceId },
        }),
        ctx.service.common.getCountryInfo(),
      ]);

      const {
        userName = '',
        email = '',
        userPicture = '',
        role = 1,
        loginType = '',
        webVersion = '3.0.0',
        marketingType = null,
        source = '',
        grade,
        assignments = {},
        userPseudoId = '',
      } = data || {};

      const userinfo = {
        deviceId,
        userName,
        email,
        userPicture,
        role,
        loginType,
        webVersion,
        country: countryInfo || null,
        marketingType,
        isSigned: 1,
        system: 'web',
        isReceive: 1,
        source,
      };

      if (grade) {
        userinfo.grade = grade;
      }

      if (userPseudoId) {
        userinfo.userPseudoId = userPseudoId;
      }

      if (_.isEmpty(user)) {
        try {
          if (!userinfo.userName) {
            userinfo.userName = `User_${this.randomString()}`;
            // 异步执行,不阻塞主流程
            ctx.helper.updateFirebaseUserName(deviceId, userName);
          }

          // const [, experiments] = await Promise.all([
          await Promise.all([
            ctx.model.UserInfo.create(userinfo),
            ctx.service.abtest.allocateNewExperiments(deviceId, [
              'TEST_S_QuaterPackage',
              'TEST_C_AIO_PW',
              'TEST_S_AIO_PW',
              'TEST_P_AIO_PW',
              'TEST_M_AIO_PW',
              'TEST_C_AIO_MAP',
              'TEST_S_AIO_MAP',
              'TEST_P_AIO_MAP',
              'TEST_M_AIO_MAP',
              'TEST_C_WebSummary',
              'TEST_S_WebSummary',
              'TEST_P_WebSummary',
              'TEST_M_WebSummary',
              'TEST_Web_M_MutiModel',
              'TEST_S_Web_Language',
              'TEST_P_Web_MultiFiles',
            ]),
          ]);
          // 根据实验组确定初始钻石数量
          const initialBalance = 20; // 默认值为20
          // 根据实验组确定插件初始解题次数
          let initialPlugin = 5; // 默认值为5

          if (assignments?.TEST_Plugin_2Solves === 'Test') {
            initialPlugin = 2;
          }

          await ctx.service.balance.updateDiamond(deviceId, {
            balance: initialBalance,
            plugin: initialPlugin,
            pluginTotal: initialPlugin,
          });
          ctx.service.point.createTrack(deviceId, 'adjust', 'fwtwe0');

          if (source === 'plugin_sem' || source === 'plugin') {
            ctx.service.point.firebasePoint(deviceId, 'Plugin_User_Channel', {
              from: source === 'plugin_sem' ? 'SEM' : 'organic',
            });
          }

          return {
            code: 0,
            data: {},
            msg: '用户信息更新成功',
          };
        } catch (e) {
          ctx.logger.error('insertUserInfo失败', e);
          await ctx.model.UserInfo.update(userinfo, {
            where: { deviceId },
          });
          return {
            code: -1,
            data: {},
            msg: '用户信息更新失败',
          };
        }
      }

      return {
        code: -1,
        data: {},
        msg: '用户信息已存在',
      };
    } catch (e) {
      ctx.logger.error('updateUserInfo失败', e);
      return {
        code: -1,
        data: {},
        msg: '用户信息更新失败',
      };
    }
  }

  // 动态设置实验
  async setExperimentsDynamic(tag) {
    const { ctx } = this;
    const deviceId = ctx.user.uid;
    // 查询用户扩展信息
    const userExtendInfo = await ctx.model.UserExtendInfo.findOne({
      raw: true,
      attributes: ['bucketId', 'abTestTags'],
      where: { deviceId },
    });

    if (!userExtendInfo) {
      return {
        code: -1,
        msg: '无扩展信息',
      };
    }
    const insertExps = [];
    if (tag === 'Plugin_Download_687') {
      insertExps.push('TEST_S_Web_Forced_Download');
    }
    if (tag === 'Show_Quater_Package') {
      insertExps.push('TEST_S_QuaterPackage');
    }
    if (insertExps.length === 0) {
      return {
        code: -1,
        msg: '实验未匹配',
      };
    }
    if (userExtendInfo.abTestTags.toLowerCase().includes(insertExps[0].toLowerCase())) {
      return {
        code: 1,
        msg: '实验已分配',
      };
    }
    // 给用户分配实验
    try {
      const experiments = await ctx.service.abtest.allocateNewExperiments(
        deviceId,
        insertExps,
        userExtendInfo.bucketId,
      );
      if (experiments.some((item) => item === 'Test_S_Web_Forced_Download_T')) {
        await ctx.model.Balance.update({ balance: 0 }, { where: { deviceId } });
      }
      return {
        code: 0,
        msg: '实验分配成功',
        experiments,
      };
    } catch (e) {
      ctx.logger.error('setExperimentsDynamic失败', e);
      return {
        code: -1,
        msg: '实验设置失败',
      };
    }
  }

  /**
   * 修改用户信息
   * @param {String} deviceId 用户id
   * @param {Object} data 用户信息
   */
  async updateUserInfoItem(deviceId, data = {}) {
    const { ctx } = this;
    try {
      const user = await ctx.model.UserInfo.findOne({
        raw: true,
        where: {
          deviceId,
        },
      });
      if (_.isEmpty(user)) {
        return {
          code: -1,
          msg: '用户信息不存在',
        };
      }

      // 当用户主动取消登录营销邮件时，需要上报到邮件平台
      if (user.marketingType !== 0 && (data?.marketingType === 0 || data?.marketingType === '0')) {
        this.cancelMarketingEmail(deviceId);
      }

      await ctx.model.UserInfo.update(
        { ...data },
        {
          where: {
            deviceId,
          },
        },
      );
      if (data.userName && data.userName !== user.userName) {
        await ctx.helper.updateFirebaseUserName(ctx.user.uid, data.userName);
      }
      return {
        code: 0,
        msg: '用户信息修改成功',
      };
    } catch (e) {
      ctx.logger.error('updateUserInfoItem失败', e);
      return {
        code: -1,
        msg: '用户信息修改失败',
      };
    }
  }
  // 检查邮箱是否已注册
  async checkEmail(email) {
    const { ctx } = this;
    let hasUser = false;
    try {
      try {
        const user = await ctx.firebaseAdmin.auth().getUserByEmail(email);
        if (user) {
          hasUser = true;
        }
      } catch (e) {
        // cache中为未注册，找不到邮箱
      }
      if (hasUser) {
        return {
          code: -1,
          msg: '邮箱已注册',
        };
      }
      return {
        code: 0,
        msg: '邮箱未注册',
      };
    } catch (e) {
      ctx.logger.error('checkEmail失败', e);
      return {
        code: 0,
        msg: '邮箱校验失败',
      };
    }
  }
  /**
   * 获取用户扩展信息,包含答案样式、语言偏好和Intercom用户哈希等
   * @param {String} deviceId - 用户设备ID
   * @return {Object} 用户扩展信息对象
   */
  async getExtendInfo(deviceId) {
    const { ctx } = this;
    // 默认的扩展信息
    const defaultExtendInfo = {
      defaultAnswerStyle: '',
      defaultAnswerLanguage: '',
      intercomUserHash: '',
      bucketId: '',
      abTestTags: '',
    };

    try {
      // 查询用户扩展信息
      const userExtendInfo = await ctx.model.UserExtendInfo.findOne({
        raw: true,
        attributes: [
          'defaultAnswerStyle',
          'defaultAnswerLanguage',
          'intercomUserHash',
          'bucketId',
          'abTestTags',
          'abTestAssignments',
        ],
        where: { deviceId },
      });

      // 如果没有找到用户扩展信息，使用默认值
      const extendInfo = userExtendInfo || defaultExtendInfo;

      // 如果没有bucketId，获取用户分桶
      if (!extendInfo.bucketId) {
        extendInfo.bucketId = await this.service.abtest.getUserBucket(deviceId);
      } else {
        // 如果bucketId存在，则设置bucketId
        this.service.abtest._setBucketCookie(extendInfo.bucketId);
      }

      // 处理intercomUserHash
      this.ensureIntercomUserHash(extendInfo, deviceId);

      // 处理abTestTags,将字符串转为数组
      extendInfo.abTestTags = extendInfo.abTestTags ? extendInfo.abTestTags.split(',') : [];

      // 给所有用户分配实验，如果用户已经分配了实验，则不分配
      // await ctx.service.abtest.allocateNewExperimentsByTags(
      //   deviceId,
      //   ['TEST_M_web_plugin_3package'],
      //   extendInfo.abTestTags,
      //   extendInfo.bucketId,
      // );
      return extendInfo;
    } catch (e) {
      ctx.logger.error('获取用户扩展信息失败', e);
      return defaultExtendInfo;
    }
  }

  /**
   * 更新用户扩展信息
   * @param {String} deviceId 用户id
   * @param {Object} data 用户扩展信息
   */
  async updateExtendInfo(deviceId, data) {
    const { ctx } = this;
    try {
      // 更新的时候，如果更新失败，则创建
      const [result] = await ctx.model.UserExtendInfo.update(data, { where: { deviceId } });
      if (result === 0) {
        await ctx.model.UserExtendInfo.create({ ...data, deviceId });
      }
      return {
        code: 0,
        msg: '用户扩展信息更新成功',
      };
    } catch (e) {
      ctx.logger.error('updateExtendInfo失败', e);
      return {
        code: -1,
        msg: '用户扩展信息更新失败',
      };
    }
  }
  /**
   * 确保用户扩展信息中包含Intercom用户哈希
   * @param {Object} userExtendInfo - 用户扩展信息对象
   * @param {String} deviceId - 用户设备ID
   */
  ensureIntercomUserHash(userExtendInfo, deviceId) {
    if (!userExtendInfo.intercomUserHash) {
      const intercomUserHash = this.ctx.helper.generateIntercomUserHash(deviceId);
      this.updateExtendInfo(deviceId, { intercomUserHash });
      userExtendInfo.intercomUserHash = intercomUserHash;
    }
  }

  /**
   * 取消营销邮件
   *
   * @param {String} deviceId 用户id
   */
  async cancelMarketingEmail(deviceId) {
    const { ctx } = this;
    try {
      const { app } = this;
      const reportUserResult = await ctx.curl(
        `${app.config.commonServiceConfig.host}/solvelyPubServer/v1/customerIO/push/user`,
        {
          method: 'POST',
          data: { deviceId, userInfo: { marketingType: 0 } },
          contentType: 'json',
          dataType: 'json',
        },
      );
      ctx.logger.info(
        `[cancelMarketingEmail] 上报用户信息到邮件平台成功: ${deviceId} ${JSON.stringify(reportUserResult?.data)}`,
      );
    } catch (error) {
      ctx.logger.error(`[cancelMarketingEmail] 失败: ${deviceId} ${error}`);
    }
  }
}

module.exports = UserService;
