const { Service } = require('egg');
const moment = require('moment');
const _ = require('lodash');
const uuid = require('uuid');
const { Op } = require('sequelize');

class FollowService extends Service {
  /**
   * 查询追问数据
   * @param {String} deviceId 设备id
   * @param {Object} where 查询条件
   * @return {Object} 查询结果
   */
  async find(deviceId, where = {}) {
    if (!deviceId || _.isEmpty(where)) {
      return {};
    }
    const { ctx } = this;
    const model = await ctx.helper._getAnswerMoreModel(deviceId);
    return await model.findOne({
      raw: true,
      where,
    });
  }
  /**
   * 对追问记录进行组装
   * @param {Array} list - 追问记录
   */
  async formatFollowHistory(list) {
    const groupList = _.groupBy(list, 'conversationId');
    const newGroupList = _.values(groupList);
    const result = [];
    for (const item of newGroupList) {
      if (item[0].step) {
        result.push({
          type: 2,
          content: item[0].step,
        });
      }
      for (const i of item) {
        result.push({
          type: 1,
          role: i.role,
          content: i.content,
          feedback: i.feedback,
          loadingStatus: 0,
          messageId: i.messageId,
          step: i.role === 1 ? i.step : '',
        });
      }
    }
    return result;
  }
  /**
   * 获取追问记录，组装数据
   * @param {String} questionId - 问题id
   * @param {String} deviceId - 设备id
   * @param {String} sessionId - 答案id
   */
  async getFollowHistory(questionId, deviceId, sessionId) {
    const result = await this.getFollow(questionId, deviceId, sessionId);
    return await this.formatFollowHistory(result);
  }
  /**
   * 获取追问记录
   * @param {String} questionId - 问题id
   * @param {String} deviceId - 设备id
   * @param {String} sessionId - 答案id
   */
  async getFollow(questionId, deviceId, sessionId) {
    const { ctx } = this;
    try {
      const model = await ctx.helper._getAnswerMoreModel(deviceId);
      const where = {
        deviceId,
        questionId,
      };
      if (sessionId) {
        where.sessionId = sessionId;
      }
      const result = await model.findAll({
        raw: true,
        attributes: [
          'deviceId',
          'questionId',
          'sessionId',
          'conversationId',
          'messageId',
          'role',
          'content',
          'feedback',
          'step',
          'language',
        ],
        where,
        order: [['createTime', 'ASC']],
      });
      return result;
    } catch (e) {
      return [];
    }
  }
  /**
   * 获取gems|coins追问记录数
   * @param {String} deviceId - 设备id
   */
  async getGemsFollow(deviceId) {
    const { ctx } = this;
    try {
      const model = await ctx.helper._getAnswerMoreModel(deviceId);
      const result = await model.count({
        where: {
          deviceId,
          costType: {
            [Op.in]: ['gems', 'coins'],
          },
          role: 1,
        },
      });
      return result;
    } catch (e) {
      return 0;
    }
  }
  /**
   * 追问
   * @param {String} questionId - 问题id
   * @param {Object} body - 请求体
   */
  async postFollow(questionId, body = {}) {
    const { ctx } = this;
    const t = await ctx.model.transaction();
    const deviceId = ctx.user.uid;
    try {
      const {
        command,
        step = '',
        content,
        language = 'en',
        answerId: sessionId,
        platform,
        isHomeV2,
      } = body;
      // 查询是否追问过
      const followHistory = await this.getFollow(questionId, deviceId, sessionId);
      const model = await ctx.helper._getAnswerMoreModel(deviceId);
      const data = {
        deviceId,
        questionId,
        language,
        platform: platform || 'web',
        step,
        costType: 'unlimited',
      };
      if (sessionId) {
        data.sessionId = sessionId;
      }
      // 非订阅用户只能追问3次
      const subscription = await ctx.service.subscription.findActiveSubscription();
      if (_.isEmpty(subscription)) {
        // 插件用户：解题和追问统一为一个次数
        if (platform === 'plugin' || isHomeV2) {
          // 余额检查
          const { consumptionType, approved } = await ctx.service.balance.checkBalance(
            deviceId,
            platform === 'plugin' ? 'plugin' : 'fast',
          );
          if (!approved) {
            await t.rollback();
            await ctx.service.point.firebasePoint(ctx.user.uid, 'plugin_followup_up', {
              questionId,
            });
            return {
              code: 30001,
              message: '余额不足',
            };
          }
          // 扣除钻石/次数
          const deductAmount = consumptionType === 'balance' ? -10 : -1;
          await ctx.service.balance.updateDiamond(deviceId, {
            [consumptionType]: deductAmount,
          });
          data.costType = consumptionType;
        } else {
          // 非插件用户保留原有逻辑
          data.costType = 'gems';
          const total = await this.getGemsFollow(deviceId);
          if (total >= 3) {
            await t.rollback();
            await ctx.service.point.firebasePoint(ctx.user.uid, 'Web_Followup_Limit', {
              questionId,
            });
            return {
              code: -1,
              data: {
                total,
              },
              message: '追问次数已达上限',
            };
          }
        }
      }
      // 获取最后一条记录
      const lastItem = followHistory?.[followHistory.length - 1];

      // 判断是否为新步骤:
      // 1. 无历史记录
      // 2. 有历史记录且step不同
      const isNewStep = !lastItem || (lastItem.step && lastItem.step !== step);

      // 设置会话相关ID
      const conversationId = isNewStep
        ? this.randomString('conversation')
        : lastItem.conversationId;

      const newSessionId = isNewStep ? this.randomString('session') : lastItem.sessionId;

      // 优先使用传入的sessionId,否则使用新生成或历史的sessionId
      Object.assign(data, {
        conversationId,
        sessionId: sessionId || newSessionId,
      });
      const associationId = uuid.v4();
      // model添加两条数据
      const userData = {
        ...data,
        messageId: this.randomString('message'),
        role: 1,
        content: command ? `command:${command}` : content,
        associationId,
      };
      const gptData = {
        ...data,
        messageId: this.randomString('message'),
        role: 2,
        content: '',
        associationId,
      };
      await model.create(userData, {
        transaction: t,
      });
      await model.create(gptData, {
        transaction: t,
      });
      await t.commit();
      // 同步给public
      ctx.service.common.publicAddFollow({
        deviceId,
        questionId,
        answerId: data.sessionId,
        askMoreData: [userData, gptData].map((item) => ({
          sessionId: item.sessionId,
          conversationId: item.conversationId,
          messageId: item.messageId,
          role: item.role,
          content: item.content,
          language: item.language,
          platform: platform || 'web',
          costType: item.costType,
          associationId: item.associationId,
          gptModel: '',
          completionToken: 0,
          promptToken: 0,
          step: item.step,
        })),
      });
      return {
        code: 0,
        message: '追问成功',
      };
    } catch (e) {
      await t.rollback();
      ctx.throw(new Error(`追问失败: deviceId:${deviceId} questionId:${questionId} ${e}`));
    } finally {
      if (!t.finished) {
        await t.rollback();
        ctx.throw(new Error(`追问事务回滚: deviceId:${deviceId} questionId:${questionId}`));
      }
    }
  }
  /**
   * 匿名追问（不做订阅/余额/扣费检查）
   * @param {String} questionId - 问题id
   * @param {Object} body - 请求体，需包含 deviceId
   */
  async postFollowGuest(questionId, body = {}) {
    const { ctx } = this;
    const t = await ctx.model.transaction();
    const {
      deviceId,
      command,
      step = '',
      content,
      language = 'en',
      answerId: sessionId,
      platform,
    } = body;
    try {
      // 获取历史追问列表（按 sessionId 聚合）
      const followHistory = await this.getFollow(questionId, deviceId, sessionId);
      const model = await ctx.helper._getAnswerMoreModel(deviceId);
      const data = {
        deviceId,
        questionId,
        language,
        platform: platform || 'web',
        step,
        costType: 'unlimited',
      };

      if (sessionId) {
        data.sessionId = sessionId;
      }

      const lastItem = followHistory?.[followHistory.length - 1];
      const isNewStep = !lastItem || (lastItem.step && lastItem.step !== step);
      const conversationId = isNewStep
        ? this.randomString('conversation')
        : lastItem.conversationId;
      const newSessionId = isNewStep ? this.randomString('session') : lastItem.sessionId;
      Object.assign(data, {
        conversationId,
        sessionId: sessionId || newSessionId,
      });
      const associationId = uuid.v4();
      const userData = {
        ...data,
        messageId: this.randomString('message'),
        role: 1,
        content: command ? `command:${command}` : content,
        associationId,
      };
      const gptData = {
        ...data,
        messageId: this.randomString('message'),
        role: 2,
        content: '',
        associationId,
      };
      await model.create(userData, { transaction: t });
      await model.create(gptData, { transaction: t });
      await t.commit();

      // 同步给public（仅自定义答案包含 # 的情况）
      ctx.service.common.publicAddFollow({
        deviceId,
        questionId,
        answerId: data.sessionId,
        askMoreData: [userData, gptData].map((item) => ({
          sessionId: item.sessionId,
          conversationId: item.conversationId,
          messageId: item.messageId,
          role: item.role,
          content: item.content,
          language: item.language,
          platform: platform || 'web',
          costType: item.costType,
          associationId: item.associationId,
          gptModel: '',
          completionToken: 0,
          promptToken: 0,
          step: item.step,
        })),
      });
      return { code: 0, message: '追问成功' };
    } catch (e) {
      await t.rollback();
      ctx.throw(
        new Error(`匿名追问失败: deviceId:${body?.deviceId} questionId:${questionId} ${e}`),
      );
    } finally {
      if (!t.finished) {
        await t.rollback();
        ctx.throw(
          new Error(`匿名追问事务回滚: deviceId:${body?.deviceId} questionId:${questionId}`),
        );
      }
    }
  }
  /**
   * 重试追问
   * @param {String} questionId - 问题id
   * @param {String} messageId - 消息id
   * @param {String} sessionId - 答案id
   */
  async retryFollow(questionId, messageId, sessionId) {
    const { ctx } = this;
    try {
      // 没有messageId，则通过sessionId来查询最后一条追问记录的messageId
      if (!messageId) {
        const followHistory = await this.getFollow(questionId, ctx.user.uid, sessionId);
        if (followHistory && followHistory.length > 0) {
          messageId = followHistory[followHistory.length - 1].messageId;
        } else {
          return {
            code: -1,
            message: '未找到追问记录',
          };
        }
      }
      const model = await ctx.helper._getAnswerMoreModel(ctx.user.uid);
      await model.update(
        {
          feedback: -1,
          content: '',
        },
        {
          where: {
            deviceId: ctx.user.uid,
            questionId,
            messageId,
          },
        },
      );
      // 同步给public
      ctx.service.common.publicUpdateFollow({
        deviceId: ctx.user.uid,
        questionId,
        answerId: sessionId,
        askMoreData: {
          messageId,
          content: '',
          feedback: -1,
        },
      });
      return {
        code: 0,
      };
    } catch (e) {
      return {
        code: -1,
      };
    }
  }
  /**
   * 追问点赞/踩
   */
  async likeFollow() {
    const { ctx } = this;
    const { questionId } = ctx.params;
    const { followFeedBack, messageId, sessionId } = ctx.request.body;
    try {
      const model = await ctx.helper._getAnswerMoreModel(ctx.user.uid);
      await model.update(
        {
          feedback: followFeedBack,
        },
        {
          where: {
            deviceId: ctx.user.uid,
            questionId,
            messageId,
          },
        },
      );
      // 同步给public
      ctx.service.common.publicUpdateFollow({
        deviceId: ctx.user.uid,
        questionId,
        answerId: sessionId,
        askMoreData: {
          messageId,
          feedback: followFeedBack,
        },
      });
      return {
        code: 0,
        message: '操作成功',
      };
    } catch (e) {
      console.log(e);
      return {
        code: -1,
        message: '操作失败',
      };
    }
  }
  /**
   * 生成n个随机字符串
   * @param {String} str - 字符串
   * @param {Number} len - 长度
   */
  randomString(str, len = 9) {
    const $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    const maxPos = $chars.length;
    let pwd = '';
    for (let i = 0; i < len; i++) {
      pwd = pwd + $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return `${str}_${moment().format('YYYY_MM_DD')}_${pwd}`;
  }
  /**
   * 追问结束流式回答的webhook
   * 追问结束时，public会调用这个接口，来更新追问记录
   */
  async webhook() {
    const { ctx } = this;
    try {
      const { deviceId, questionInfo } = ctx.request.body;
      const {
        questionId,
        conversationId,
        messageId,
        content,
        promptToken = 0,
        completionToken = 0,
        modelName = '',
        sessionId,
      } = questionInfo || {};
      const model = await ctx.helper._getAnswerMoreModel(deviceId);
      await model.update(
        {
          content,
          promptToken,
          completionToken,
          modelName,
        },
        {
          where: {
            deviceId,
            questionId,
            conversationId,
            messageId,
          },
        },
      );
      // 同步给public
      ctx.service.common.publicUpdateFollow({
        deviceId,
        questionId,
        answerId: sessionId,
        askMoreData: {
          messageId,
          content,
          promptToken,
          completionToken,
          modelName,
        },
      });
      const followInfo = await this.find(deviceId, {
        deviceId,
        questionId,
        conversationId,
        messageId,
      });
      ctx.service.point.firebasePoint(deviceId, 'Web_Response_Time_Followup', {
        questionId,
        conversationId,
        messageId,
        duration: moment().diff(moment(followInfo.createTime)),
      });
      ctx.service.point.firebasePoint(deviceId, 'Web_Followup_Success', {
        questionId,
        conversationId,
        messageId,
      });
    } catch (e) {
      ctx.throw(new Error(`追问结束流式回答的webhook失败:${e}`));
    }
  }
}

module.exports = FollowService;
