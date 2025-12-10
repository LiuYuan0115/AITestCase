const { Service } = require('egg');

class PointService extends Service {
  /**
   * adjust打点
   * @param {String} deviceId 用户id
   * @param {String} eventToken 事件token
   * @param {Object} params 一些参数
   * @param {String} productId 产品id
   */
  async adjustPoint(deviceId, eventToken, params = {}, productId = '') {
    const { ctx, app } = this;
    const pointLogger = app.getLogger('pointLogger');
    // 查询userInfo中的webAdjustUserId
    const userInfo = await ctx.model.UserInfo.findOne({
      raw: true,
      attributes: ['webAdjustUserId'],
      where: {
        deviceId,
      },
    });
    // if (_.isEmpty(userInfo) || !userInfo.webAdjustUserId) {
    //   // 未查询到用户信息或者用户信息中没有webAdjustUserId
    //   pointLogger.error(`adjustPoint: 未查询到用户或者用户信息无webAdjustUserId ${deviceId} ${eventToken} ${JSON.stringify(params)} ${productId}`);
    //   return;
    // }
    try {
      const commonHost = app.config.commonServiceConfig.host;
      const data = {
        appToken: 'asr8f8tiywao',
        eventToken,
        authBearer: 'edbfa493b7823ff83be17ac9e0001004',
        adjustUserInfo: {
          adjustUserId: userInfo?.webAdjustUserId || '',
          productId,
          deviceId,
        },
        platform: 'web',
        ...params,
      };
      await ctx.curl(`${commonHost}/solvelyPubServer/adjustPoint/v1`, {
        method: 'POST',
        contentType: 'json',
        data,
        dataType: 'json',
      });
      pointLogger.info(
        `adjustPoint: ${deviceId} ${eventToken} ${JSON.stringify(params)} ${productId}`,
      );
    } catch (e) {
      pointLogger.error(
        `adjustPoint: 调用打点服务失败 ${deviceId} ${eventToken} ${JSON.stringify(params)} ${productId} \n ${e}`,
      );
    }
  }
  /**
   * firebase打点
   * @param {String} userId id
   * @param {String} eventName 事件名
   * @param {Object} eventParams 事件参数
   * @param {String|null} cid ga的伪客户端id
   */
  async firebasePoint(userId, eventName, eventParams = {}, cid = '') {
    const { ctx, app } = this;
    const pointLogger = app.getLogger('pointLogger');
    try {
      if (userId) {
        const userInfo = await ctx.service.user.findUser(userId);
        if (userInfo?.country) {
          eventParams.country = userInfo.country;
        }
      }
      eventParams.env = app.config.env;
      if (app.config.env !== 'prod') {
        eventName = `${eventName}_Test`;
      }
      const queryParams = {
        v: '2',
        tid: 'G-7QW6YNRL1Z',
        en: eventName,
        ep: eventParams,
        cid: cid || ctx.helper.getGaId(),
        uid: userId,
      };
      const queryString = Object.keys(queryParams).reduce((acc, currVal) => {
        const curr = `${currVal}=${queryParams[currVal]}`;
        if (acc === '') {
          return curr;
        }
        if (currVal === 'ep') {
          const epQueryString = Object.keys(queryParams[currVal]).reduce((epAcc, epCurrVal) => {
            const epCurr = `ep.${epCurrVal}=${queryParams[currVal][epCurrVal]}`;
            if (epAcc === '') {
              return epCurr;
            }
            return `${epAcc}&${epCurr}`;
          }, '');
          return `${acc}&${epQueryString}`;
        }
        return `${acc}&${curr}`;
      }, '');
      const url = `https://www.google-analytics.com/g/collect?${queryString}`;
      const result = await ctx.curl(url, {
        method: 'POST',
      });
      pointLogger.info(
        `firebase ${result.status} ${userId} ${eventName} ${JSON.stringify(eventParams)}`,
      );
    } catch (e) {
      pointLogger.error(`firebase ${userId} ${eventName} ${JSON.stringify(eventParams)}`);
    }
  }
  /**
   * bigQuery打点
   * @param {Object} pointData 打点数据
   */
  async bqPoint(pointData) {
    const { ctx, app } = this;
    const pointLogger = app.getLogger('pointLogger');
    try {
      if (app.config.env === 'prod') {
        const commonHost = app.config.commonServiceConfig.host;
        const data = {
          secretKey: app.config.commonServiceConfig.bqSecretKey,
          data: pointData,
        };
        await ctx.curl(`${commonHost}/solvelyPubServer/point/v1`, {
          method: 'POST',
          contentType: 'json',
          data,
          dataType: 'json',
        });
      }
      pointLogger.info(`bigQueryPoint: ${JSON.stringify(pointData)}`);
    } catch (e) {
      pointLogger.error(`bigQueryPoint: 调用打点服务失败 ${JSON.stringify(pointData)}`);
    }
  }
  /**
   * posthog打点
   * @param {String} userId 用户id
   * @param {String} eventName 事件名
   * @param {Object} properties 事件属性
   */
  async posthogPoint(userId, eventName, properties = {}) {
    const { ctx, app } = this;
    const pointLogger = app.getLogger('pointLogger');
    try {
      const data = {
        api_key: app.config.commonServiceConfig.posthogKey,
        event: eventName,
        properties,
        timestamp: new Date().toISOString(),
      };

      if (userId) {
        data.distinct_id = userId;
      }

      await ctx.curl('https://us.i.posthog.com/i/v0/e/', {
        method: 'POST',
        contentType: 'json',
        data,
        dataType: 'json',
      });

      pointLogger.info(`posthogPoint: ${userId} ${eventName} ${JSON.stringify(properties)}`);
    } catch (e) {
      pointLogger.error(
        `posthogPoint: 调用打点服务失败 ${userId} ${eventName} ${JSON.stringify(properties)}`,
      );
    }
  }
  /**
   * 写入等待中的打点
   * @param {String} deviceId 用户id
   * @param {String} source 数据来源
   * @param {String} eventName 事件名
   * @param {Object} params 事件参数
   */
  async createTrack(deviceId, source, eventName, params = {}) {
    const { ctx } = this;
    try {
      await ctx.model.FrontendTrackingInfo.create({
        deviceId,
        source,
        eventName,
        params: JSON.stringify(params),
        platform: 'web',
      });
    } catch (e) {
      ctx.logger.error(`createTrack: ${deviceId} ${source} ${eventName} ${JSON.stringify(params)}`);
      // ignore
    }
  }
  /**
   * 更新等待中的打点
   * @param {String} deviceId 用户id
   * @param {Array} ids 打点id
   */
  async updateTrack(deviceId, ids = []) {
    const { ctx } = this;
    try {
      if (ids.length === 0) {
        return;
      }
      await ctx.model.FrontendTrackingInfo.update(
        {
          status: 0,
        },
        {
          where: {
            deviceId,
            id: ids,
          },
        },
      );
    } catch (e) {
      // ignore
    }
  }
  /**
   * 获取用户打点id
   * @param {String} deviceId 用户id
   */
  async getTrack(deviceId) {
    const { ctx } = this;
    try {
      const track = await ctx.model.FrontendTrackingInfo.findAll({
        raw: true,
        attributes: ['id', 'source', 'eventName', 'params'],
        where: {
          deviceId,
          status: 1,
          platform: 'web',
        },
      });
      const res = track || [];
      this.updateTrack(
        deviceId,
        res.map((item) => item.id),
      );
      return res;
    } catch (e) {
      return [];
    }
  }
  /**
   * 获取web server打点名称
   * @param {String} pointName 打点名称
   */
  webServerPointName(pointName) {
    const pointNameMap = {
      sub_success: 'Web_Server_Subscribe_Success',
      sub_fail: 'Web_Server_Subscribe_Fail',
      sub_checkout_expired: 'Web_Subscribe_Timeout',
    };
    return pointNameMap[pointName];
  }
  /**
   * 上传web server打点
   * @param {String} deviceId 用户id
   * @param {String} eventName 事件名
   * @param {Object} params 事件参数
   */
  async uploadServerPoint(deviceId, eventName, params = {}) {
    const { ctx, app } = this;
    const pointLogger = app.getLogger('pointLogger');
    try {
      const pointName = ctx.service.point.webServerPointName(eventName);
      this.firebasePoint(deviceId, pointName, params);
    } catch (e) {
      pointLogger.error(`uploadServerPoint: ${deviceId} ${eventName} ${JSON.stringify(params)}`);
    }
  }
}

module.exports = PointService;
