const { Service } = require('egg');
const moment = require('moment');
const _ = require('lodash');
const Decimal = require('decimal.js');
// const Op = require('sequelize').Op;

const PERIOD_MAP = {
  oneMonth: 1,
  threeMonth: 3,
  sixMonth: 6,
  oneYear: 12,
  oneWeek: 7,
};

class SubscriptionService extends Service {
  /**
   * 查询订阅记录
   * @param {object} where 查询条件
   * @return {object} 订阅记录
   */
  async find(where) {
    const { ctx } = this;
    try {
      if (_.isEmpty(where)) {
        return null;
      }
      const result = await ctx.model.Subscription.findOne({
        raw: true,
        where,
      });
      return result;
    } catch (error) {
      ctx.throw(new Error(`查询订阅记录失败: ${error}`));
    }
  }
  /**
   * 查询writer订阅记录
   * @param {object} where 查询条件
   * @return {object} 订阅记录
   */
  async findWriter(where) {
    const { ctx } = this;
    try {
      if (_.isEmpty(where)) {
        return null;
      }
      const result = await ctx.model.SubscriptionWriter.findOne({
        raw: true,
        where,
      });
      return result;
    } catch (error) {
      ctx.throw(new Error(`查询writer订阅记录失败: ${error}`));
    }
  }
  /**
   * 订阅成功，创建订阅记录
   * @param {object} order 订单信息
   * @param {object} payload stripe返回的订阅信息
   * @param {boolean} isRenew 是否是续订
   */
  async create(order, payload, isRenew = false) {
    const { ctx, app } = this;
    const env = app.config.env === 'prod' ? 'Production' : 'Sandbox';
    const subscriptionLogger = app.getLogger('subscriptionLogger');
    try {
      const orderData = await ctx.service.order.find({
        originalTransactionId: order.originalTransactionId,
      });
      const {
        created,
        data: {
          object: { id, subscription, period },
        },
      } = payload;
      const data = {
        deviceId: orderData.deviceId,
        originalTransactionId: id,
        transactionId: subscription,
        productId: orderData.productId,
        bundleId: 'stripe',
        refund: 0,
        regular: 1,
        expired: 0,
        isCancel: 0,
        hasUnredeemedGems: 0,
        grantGems: 0,
        nextGrantGemsTime: 0,
        redeemGems: 0,
        period: orderData.period,
        purchaseTimeStamp: created * 1000,
        environment: env,
      };
      if (isRenew) {
        // 续订
        data.expireTimeStamp = payload.expireTimeStamp;
        period && (data.period = period);
        try {
          await ctx.model.Subscription.update(data, {
            where: {
              deviceId: data.deviceId,
            },
          });
          subscriptionLogger.info(`更新订阅成功: ${JSON.stringify(data)}`);
        } catch (e) {
          subscriptionLogger.error(`更新订阅失败: ${e}`);
        }
      } else {
        data.expireTimeStamp = moment(created * 1000)
          .add(orderData.period, 'months')
          .valueOf();
        const subscription = await this.find({
          deviceId: data.deviceId,
        });
        try {
          if (_.isEmpty(subscription)) {
            // 首次订阅
            await ctx.model.Subscription.create(data);
          } else {
            // 以前有过订阅，可能过期或者取消
            await ctx.model.Subscription.update(data, {
              where: {
                deviceId: data.deviceId,
              },
            });
          }
          subscriptionLogger.info(`创建订阅记录成功: ${JSON.stringify(data)}`);
        } catch (e) {
          subscriptionLogger.error(`创建订阅记录失败: ${e}`);
        }
      }
      try {
        // 创建解题次数记录
        const userSolveCount = await ctx.model.SolveQuestionReqCount.findOne({
          raw: true,
          where: {
            deviceId: data.deviceId,
          },
        });
        const countData = {
          deviceId: data.deviceId,
          startTime: data.purchaseTimeStamp,
          endTime: data.expireTimeStamp,
          frequency: 0,
        };
        if (_.isEmpty(userSolveCount)) {
          await ctx.model.SolveQuestionReqCount.create(countData);
        } else {
          await ctx.model.SolveQuestionReqCount.update(countData, {
            where: {
              deviceId: data.deviceId,
            },
          });
        }
      } catch (e) {
        ctx.throw(new Error(`创建解题次数记录失败: ${e}`));
      }
    } catch (error) {
      ctx.throw(new Error(`创建订阅记录失败: ${error}`));
    }
  }

  /**
   * 续订成功，更新订阅记录
   * @param {Object} payload stripe返回的订阅信息
   * @param {Object} oldOrder 历史订单信息
   */
  async renew(payload, oldOrder) {
    const { ctx } = this;
    try {
      const { id: transactionId, current_period_end: endTime, plan = {} } = payload.data.object;
      const renewData = {
        transactionId,
        productId: oldOrder.productId,
        purchaseTimeStamp: moment().valueOf(),
        expireTimeStamp: endTime * 1000,
        transactionPayload: JSON.stringify(payload),
      };
      // 存储续订记录
      await ctx.model.SubscriptionRenew.create(renewData);
      // 更新订阅记录
      const payloadData = {
        created: renewData.purchaseTimeStamp / 1000,
        data: {
          object: {
            id: oldOrder.originalTransactionId,
            subscription: transactionId,
            period: plan.interval_count,
          },
        },
        expireTimeStamp: endTime * 1000,
      };
      await this.create(oldOrder, payloadData, true);
      await this.updateWebManage({ deviceId: oldOrder.deviceId });
    } catch (error) {
      ctx.throw(new Error(`续订失败: ${error}`));
    }
  }

  /**
   * 检查是否有未发放的钻石
   */
  async checkGrantDiamondRecord() {
    const { ctx, app } = this;
    const deviceId = ctx.user.uid;
    try {
      const commonHost = app.config.commonServiceConfig.host;
      const result = await ctx.curl(`${commonHost}/solvelyPubServer/rewardedGems/v1`, {
        dataType: 'json',
        data: {
          deviceId,
        },
      });
      return result.data;
    } catch (error) {
      ctx.throw(new Error(`检查是否有未发放的钻石失败: ${error}`));
    }
  }
  async checkPurchasedInfo() {
    const { ctx } = this;
    const result = { purchasedFreeTrial: false, isPurchased: false };
    const { uid: deviceId } = ctx.user;
    // 是否满足free-trial实验
    const orderInfo = await ctx.service.order.findAll({
      deviceId,
      status: 'complete',
      mode: 'subscription',
      subscriptionType: 1,
    });

    if (!_.isEmpty(orderInfo)) {
      result.purchasedFreeTrial = orderInfo.some((item) => item.isTrial === 1);
      result.isPurchased = true;
    }
    return result;
  }
  /**
   * 获取用户的订阅信息
   */
  async findSubscription() {
    const { ctx } = this;
    const deviceId = ctx.user.uid;
    try {
      const subscriptionList = await ctx.service.common.getSubscription(deviceId);
      // 查询subscriptionType为3的组合包订阅，把这条数据的subscriptionType改为1，并且复制一份数据给前端用，subscriptionType为2
      const bundleSubscription = subscriptionList.find((item) => item.subscriptionType === 3);
      const hasBundleSubscription = !_.isEmpty(bundleSubscription);
      if (hasBundleSubscription) {
        bundleSubscription.subscriptionType = 'solver';
        bundleSubscription.isBundle = true;
        subscriptionList.push({ ...bundleSubscription, subscriptionType: 'writer' });
      } else {
        // 无组合包订阅，查询writer订阅
        const writerSubscription = await this.findActiveWriterSubscription(deviceId);
        if (!_.isEmpty(writerSubscription)) {
          subscriptionList.push({
            subscriptionChannel: 'web',
            subscribePlan: 'unlimited',
            isExpired:
              writerSubscription.expired === 1 || writerSubscription.expireTimestamp < Date.now(),
            isCancelled: writerSubscription.isCancel === 1,
            period: writerSubscription.period,
            expireTimestamp: writerSubscription.expireTimestamp,
            productId: writerSubscription.productId,
            refund: writerSubscription.refund,
            isTrialPeriod: writerSubscription.isTrialPeriod,
            regular: writerSubscription.regular,
            subPauseInfo: null,
            transactionId: writerSubscription.transactionId,
            subscriptionType: 'writer',
            isBundle: false,
            isGrant: writerSubscription.isCancel === 1,
          });
        }
        // 如果每一项subscription没有subscriptionType字段，subscriptionType默认为solver
        subscriptionList.forEach((item) => {
          if (!item.subscriptionType || item.subscriptionType === 1) {
            item.subscriptionType = 'solver';
          }
          if (item.subscriptionType === 2) {
            item.subscriptionType = 'writer';
          }
        });
      }
      // 过滤掉已过期/已退款的订阅/已过期的订阅
      const currentTime = Date.now();
      const resultData = subscriptionList.filter((item) => {
        const { expireTimestamp, refund, regular, isTrialPeriod } = item;
        return expireTimestamp > currentTime && !refund && (regular === 1 || isTrialPeriod === 1);
        // todo: 后续账单付款失败要显示当前的订阅
        // const { expireTimestamp, refund } = item;
        // return expireTimestamp > currentTime && refund === 0;
      });
      for (const subscription of resultData) {
        const { transactionId, subscriptionType, subscriptionChannel, subPauseInfo } = subscription;
        if (subscriptionChannel === 'web' && transactionId && subscriptionType === 'solver') {
          if (!transactionId.startsWith('sub_')) {
            // 不是正常stripe订阅
            continue;
          }
          // web订阅计划切换信息
          subscription.nextPlan = null;
          const nextPlan = await this.findNextPendingPlan(deviceId);
          if (!_.isEmpty(nextPlan)) {
            subscription.nextPlan = {
              period: nextPlan.period,
              newTransactionExpireTime: +nextPlan.newTransactionExpireTime,
            };
          }
        }
        // 处理暂停信息
        subscription.pauseCollection = null;
        if (!_.isEmpty(subPauseInfo)) {
          const statusMap = {
            1001: 'active',
            1002: 'cancelled',
            1003: 'expired',
          };
          // 暂停中或者当前周期暂停已取消
          const currentPauseInfo = subPauseInfo.find(
            (item) =>
              item.status === 1001 ||
              (item.status === 1002 &&
                item.subStartTime < currentTime &&
                currentTime <= item.subEndTime),
          );
          if (!_.isEmpty(currentPauseInfo)) {
            const { status, subEndTime, subPauseEndTime } = currentPauseInfo;
            subscription.pauseCollection = {
              status: statusMap[status],
              start: +subEndTime,
              end: +subPauseEndTime,
            };
          }
        }
        delete subscription.subPauseInfo;
      }
      const result = await this.checkPurchasedInfo();
      result.resultData = resultData;
      return result;
    } catch (error) {
      ctx.throw(new Error(`获取订阅失败: ${error}`));
    }
  }
  /**
   *
   * @param {string} deviceId 因为stream相关的接口没有经过JWT校验，所以需要显示地传递deviceId，使用`ctx.user.uid`兜底
   * @return {array} 生效中的订阅
   * @description 获取生效中的订阅，依次判断是否要扣减钻石
   */
  async findActiveSubscription(deviceId) {
    const { ctx } = this;
    deviceId = deviceId || ctx.user.uid;
    try {
      const subscriptionList = await ctx.service.common.getSubscription(deviceId);
      // 过滤掉已过期/已退款的订阅
      const currentTime = Date.now();
      const resultData = subscriptionList.filter((item) => {
        const { expireTimestamp, refund, regular, isTrialPeriod } = item;
        // refund:0 未退款，1 已退款
        // regular:0 未付款，1 已付款
        // isTrialPeriod:0 不在试用期，1 在试用期
        return (
          expireTimestamp > currentTime && refund === 0 && (regular === 1 || isTrialPeriod === 1)
        );
      });

      // 判断是否有暂停计划
      const arr = [];
      for (const subscription of resultData) {
        // subPauseInfo 暂停详情，没有操作过暂停，此值为null
        const { subPauseInfo } = subscription;

        if (_.isEmpty(subPauseInfo)) {
          arr.push(subscription);
          continue;
        }

        // 不是暂停状态，则订阅有效
        // status: 1001 等待暂停中，即暂停还没有开始，1002 在暂停中，1003 目前还不清楚，待确定，subEndTime订阅结束时间
        const subPauseInfoItem = subPauseInfo.filter(
          (item) => item.status === 1001 && item.subEndTime < currentTime,
        );
        // 没有值，说明还在订阅状态，就把订阅信息添加进去
        if (subPauseInfoItem.length === 0) {
          arr.push(subscription);
        }
      }
      // 最后出去的一定是有生效中的订阅的
      return arr;
    } catch (error) {
      ctx.throw(new Error(`获取订阅失败: ${error}`));
    }
  }
  // 查询生效中的writer单独的订阅
  async findActiveWriterSubscription(deviceId) {
    const { ctx } = this;
    try {
      const activeWriterSubscription = await ctx.model.SubscriptionWriter.findOne({
        raw: true,
        where: {
          deviceId,
        },
      });

      if (_.isEmpty(activeWriterSubscription)) {
        return {};
      }
      const { refund, regular, expireTimeStamp, expired } = activeWriterSubscription;

      if (refund || !regular || expireTimeStamp < Date.now() || expired) {
        return {};
      }
      return { ...activeWriterSubscription, expireTimestamp: expireTimeStamp };
    } catch (error) {
      return {};
    }
  }
  /**
   * 更改自动续订是否开启
   * @param {String} transactionId  订阅id
   * @param {Boolean} isCancel 是否取消订阅
   */
  async cancel(transactionId, isCancel = false) {
    const { ctx } = this;
    const deviceId = ctx.user.uid;
    try {
      // 订阅表取消订阅
      await ctx.model.Subscription.update(
        {
          isCancel: +isCancel,
        },
        {
          where: {
            deviceId,
          },
        },
      );
      // 查询是否有下一个订阅
      const nextPlan = await this.findNextPendingPlan(deviceId);
      const orderVersion = await ctx.service.order.findOrderVersionBySubscription(transactionId);
      const stripe = orderVersion === 2 ? ctx.stripeV2 : ctx.stripe;
      const subscription = await stripe.subscriptions.retrieve(transactionId);
      const updateParams = {
        cancel_at_period_end: isCancel, // 订阅周期结束时取消订阅
      };
      let isTrialCancel = false;
      const { trial_end, plan } = subscription;
      const isTrial = trial_end && trial_end > Date.now() / 1000;
      if (isCancel) {
        if (!_.isEmpty(nextPlan)) {
          await ctx.model.SubscriptionWebManage.update(
            {
              status: 'cancelled',
            },
            {
              where: {
                deviceId,
                status: 'pending',
              },
            },
          );
        }
        if (isTrial) {
          isTrialCancel = true;
          await ctx.service.point.firebasePoint(deviceId, 'Web_Cancel_Free_Trial', {
            deviceId,
            transactionId,
            productId: plan.product,
            isTrial: 1,
          });
          await ctx.service.point.adjustPoint(deviceId, '33zwcp', {}, '');
        } else {
          // 入金后取消
          await ctx.service.point.firebasePoint(deviceId, 'Web_Subscription_Cancel', {
            deviceId,
            transactionId,
            productId: plan.product,
            isTrial: 0,
          });
          await ctx.service.point.adjustPoint(deviceId, 'vw2kgr', {}, '');
        }
      } else {
        // 重新开启
        if (isTrial) {
          await ctx.service.point.firebasePoint(deviceId, 'Web_Subscription_Reactivate', {
            deviceId,
            transactionId,
            productId: plan.product,
            isTrial: 1,
          });
        } else {
          // 查询是否有下一个订阅
          const nextPlan = await ctx.model.SubscriptionWebManage.findOne({
            raw: true,
            where: {
              deviceId,
              status: 'cancelled',
            },
          });
          if (!_.isEmpty(nextPlan)) {
            await ctx.model.SubscriptionWebManage.update(
              {
                status: 'pending',
              },
              {
                where: {
                  deviceId,
                  status: 'cancelled',
                },
              },
            );
            await stripe.subscriptions.update(transactionId, {
              cancel_at_period_end: true, // 订阅周期结束时取消订阅触发订阅过期才可以重新订阅
            });
          }
          await ctx.service.point.firebasePoint(deviceId, 'Web_Subscription_Reactivate', {
            deviceId,
            transactionId,
            productId: plan.product,
            isTrial: 0,
          });
        }
      }
      await stripe.subscriptions.update(transactionId, updateParams);
      // if (isTrialCancel) {
      //   // free-trail 之前，走不到这个逻辑，所以修改不会影响其他地方
      //   await stripe.subscriptions.cancel(transactionId, {
      //     // invoice_now: true, // 重置开单周期，马上取消
      //     cancel_at_period_end: true, // 订阅周期结束时取消订阅触发订阅过期才可以重新订阅
      //   });
      //   await this.updateSubscriptionV2({ isCancel: 1 }, { deviceId });
      // } else {
      //   await stripe.subscriptions.update(transactionId, updateParams);
      // }
      if (isTrialCancel) {
        return {
          isTrialCancel,
        };
      }
      return {};
    } catch (error) {
      ctx.throw(new Error(`更改自动续订失败: ${error}`));
    }
  }
  async createSurvey(params, type = 0) {
    // type 0: 取消订阅问卷调查 1: 暂停订阅问卷调查
    const { ctx } = this;
    const {
      deviceId,
      data: { text1, text2, text3 = '' },
    } = params;
    try {
      const result = await ctx.model.SubscriptionCancelSurvey.create({
        deviceId,
        text1,
        text2,
        text3,
        type,
      });
      return result;
    } catch (error) {
      ctx.throw(new Error(`取消订阅问卷调查失败: ${error}`));
    }
  }
  async updateSubscription(deviceId, updatedSubscription) {
    const { ctx } = this;
    try {
      const nextPlan = await this.findNextPendingPlan(deviceId);
      const data = {
        transactionId: updatedSubscription.id,
        status: 'pending',
        currency: updatedSubscription.plan.currency,
        productId: updatedSubscription.plan.product,
        period: updatedSubscription.plan.interval_count,
        amount: updatedSubscription.plan.amount,
        customer: updatedSubscription.customer,
        startTime: moment(updatedSubscription.trial_end * 1000).valueOf(),
        newTransactionExpireTime: moment(updatedSubscription.trial_end * 1000)
          .add(updatedSubscription.plan.interval_count, 'months')
          .valueOf(),
        newSubscription: JSON.stringify(updatedSubscription),
      };
      if (_.isEmpty(nextPlan)) {
        await ctx.model.SubscriptionWebManage.create({
          deviceId,
          ...data,
        });
      } else {
        await ctx.model.SubscriptionWebManage.update(data, {
          where: {
            deviceId,
            status: 'pending',
          },
        });
      }
    } catch (error) {
      ctx.throw(new Error(`更新订阅记录失败: ${error}`));
    }
  }
  async findNextPendingPlan(deviceId) {
    const { ctx } = this;
    try {
      const result = await ctx.model.SubscriptionWebManage.findOne({
        raw: true,
        where: {
          deviceId,
          status: 'pending',
        },
      });
      return result;
    } catch (error) {
      ctx.throw(new Error(`查询订阅记录失败: ${error}`));
    }
  }
  async updateWebManage(subscription) {
    // 更改status状态
    const { ctx } = this;
    try {
      const manageInfo = await ctx.model.SubscriptionWebManage.findOne({
        where: {
          deviceId: subscription.deviceId,
          status: ['pending', 'active'],
        },
      });
      if (!_.isEmpty(manageInfo)) {
        let status = 'active';
        if (manageInfo.status === 'pending') {
          status = 'active';
        } else {
          status = 'expired';
        }
        await ctx.model.SubscriptionWebManage.update(
          {
            status,
          },
          {
            where: {
              deviceId: subscription.deviceId,
            },
          },
        );
      }
    } catch (error) {
      ctx.throw(new Error(`更改status状态失败: ${error}`));
    }
  }
  // 更新订阅信息
  async updateSubscriptionV2(subscriptionData, where, stripe) {
    const { ctx, app } = this;
    const subscriptionLogger = app.getLogger('subscriptionLogger');

    const updateOrCreateSubscription = async (model, data, condition) => {
      const existingSubscription =
        model === 'SubscriptionWriter'
          ? await this.findWriter(condition)
          : await this.find(condition);
      if (!_.isEmpty(existingSubscription)) {
        await ctx.model[model].update(data, { where: condition });
      } else {
        if (!data.originalTransactionId) {
          subscriptionLogger.error(`更新 ${model} 订阅信息失败: ${JSON.stringify(data)}`);
          return false;
        }
        await ctx.model[model].create(data);
      }
      return true;
    };

    try {
      let isWriterSubscription = subscriptionData.subscriptionType === 2;

      if (!isWriterSubscription && stripe && subscriptionData.transactionId) {
        const orderInfo = await ctx.service.order.find({
          transactionId: subscriptionData.transactionId,
        });
        if (!_.isEmpty(orderInfo) && orderInfo.subscriptionType === 2) {
          isWriterSubscription = true;
        }
      }

      const model = isWriterSubscription ? 'SubscriptionWriter' : 'Subscription';
      const success = await updateOrCreateSubscription(model, subscriptionData, where);

      if (!success) {
        return;
      }
    } catch (error) {
      ctx.throw(new Error(`更新订阅信息失败: ${JSON.stringify(subscriptionData)} \n ${error}`));
    }
  }
  // 创建新订阅
  async createNewSubscription(customerId, newPlanId, version = 1) {
    const { ctx } = this;
    const stripe = version === 2 ? ctx.stripeV2 : ctx.stripe;
    const newSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ plan: newPlanId }],
      proration_behavior: 'none',
    });

    return newSubscription;
  }
  // 更新订阅管理变化
  async updateSubscriptionWebManage(subscription, where = {}) {
    const { ctx } = this;
    try {
      const manageInfo = await ctx.model.SubscriptionWebManage.findOne({
        where,
      });
      if (!_.isEmpty(manageInfo)) {
        await ctx.model.SubscriptionWebManage.update(subscription, {
          where,
        });
      } else {
        await ctx.model.SubscriptionWebManage.create(subscription);
      }
    } catch (error) {
      ctx.throw(new Error(`更新订阅管理变化失败: ${subscription} \n ${error}`));
    }
  }
  // 获取支付方式
  async getCustomerPaymentMethod(customerId, version = 1) {
    const { ctx } = this;
    const stripe = version === 2 ? ctx.stripeV2 : ctx.stripe;
    // 列出客户的所有支付方法
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      // type: 'card',
    });

    // 选择第一个支付方法作为默认支付方法
    try {
      if (paymentMethods.data.length > 0) {
        return paymentMethods.data[0].id;
      }
      ctx.throw(new Error(`没有找到该客户的支付方式 ${customerId}`));
    } catch (error) {
      ctx.throw(new Error(`没有找到该客户的支付方式 ${customerId}`));
    }
  }
  // 更新支付方式
  async attachPaymentMethodToCustomer(paymentMethodId, customerId, version = 1) {
    const { ctx } = this;
    try {
      const stripe = version === 2 ? ctx.stripeV2 : ctx.stripe;
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error) {
      ctx.throw(new Error(`更新支付方式失败 ${customerId} ${paymentMethodId}`));
    }
  }
  /**
   * 更改订阅，试用期切换订阅
   * @param {string} deviceId
   * @param {string} period
   * @param {object} sqlCurrentSubscription
   * @param promotionCode
   * @return
   */
  async changeSubscriptionV2WithTrial(deviceId, period, sqlCurrentSubscription, promotionCode) {
    const { ctx } = this;
    try {
      const { transactionId: subscriptionId } = sqlCurrentSubscription || {};
      // 获取stripe订阅信息
      const subscription = await ctx.stripeV2.subscriptions.retrieve(subscriptionId);
      // 获取实验价格
      const productInfo = await ctx.service.stripe.handleExperimentPrice(deviceId, period);

      const { priceId } = productInfo;
      // 校验促销码，获取 promotion_code id
      let promotionCodeId = null;
      if (promotionCode) {
        try {
          const validateResult = await this.validatePromoCode(promotionCode, [priceId], true);
          if (validateResult && validateResult.valid) {
            promotionCodeId = validateResult.promotionCodeId;
          }
        } catch (e) {
          // ignore invalid promo code in with-trial flow
        }
      }
      await ctx.stripeV2.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            deleted: true,
            quantity: 1,
          },
          {
            price: priceId,
            quantity: 1,
          },
        ],
        // cancel_at_period_end: true, // 不设置到期取消，试用直接结束，转入下一个新周期
        trial_end: 'now',
        off_session: true,
        enable_incomplete_payments: false,
        proration_behavior: 'none',
        // 切换订阅将需要升级的metadata数据修改，避免重新生成38.99的订阅
        metadata: {
          ...subscription.metadata,
          priceId,
          status: 'upgrade',
          upgradePriceId: priceId,
          ...(promotionCode ? { promotionCode } : {}),
        },
        ...(promotionCodeId ? { promotion_code: promotionCodeId } : {}),
      });
      const updatedSubscription = await ctx.stripeV2.subscriptions.retrieve(subscriptionId);
      return {
        start_date: updatedSubscription.current_period_end,
      };
    } catch (error) {
      ctx.throw(new Error(`更改订阅失败: ${deviceId} ${error}`));
    }
  }
  // 切换订阅
  // TODO: free-trail 如果是试用期走新的逻辑，isTrialPeriod判断是否在试用期，切换订阅的逻辑不用参考这个
  // 原因：stripe有更好的切换方法，且原来不支持试用期切换订阅
  // TODO:直接调用stripe的update接口，传入订阅id、价格id，看一下是否需要先删除价格，重置周期参数，看是否需要传入？
  async changeSubscriptionV2(deviceId, period, sqlCurrentSubscription, promotionCode) {
    const { ctx } = this;
    try {
      const { transactionId: subscriptionId } = sqlCurrentSubscription || {};

      const orderVersion = await ctx.service.order.findOrderVersionBySubscription(subscriptionId);
      const stripe = orderVersion === 2 ? ctx.stripeV2 : ctx.stripe;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const customerId = subscription.customer;

      const paymentMethodId = await this.getCustomerPaymentMethod(customerId, orderVersion);
      await this.attachPaymentMethodToCustomer(paymentMethodId, customerId, orderVersion);
      const productInfo = await ctx.service.stripe.handleExperimentPrice(deviceId, period);

      const { productId, priceId } = productInfo;

      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
        // 切换订阅将需要升级的metadata数据修改，避免重新生成38.99的订阅
        metadata: {
          ...subscription.metadata,
          priceId,
          status: 'upgrade',
          upgradePriceId: priceId,
          ...(promotionCode ? { promotionCode } : {}),
        },
      });
      try {
        // const productInfo = await ctx.service.product.productInfo({ productId });
        // 添加信息到webManage
        await ctx.service.subscription.updateSubscriptionWebManage(
          {
            deviceId,
            customer: customerId,
            startTime: subscription.current_period_end * 1000,
            productId,
            priceId,
            // period: productInfo.period,
            period,
            status: 'pending',
          },
          { deviceId, status: 'pending' },
        );
      } catch (error) {
        const nextPlan = await this.findNextPendingPlan(deviceId);
        let isCancel = false;
        if (!_.isEmpty(nextPlan)) {
          isCancel = true;
        }
        // 订阅周期结束后取消 https://docs.stripe.com/api/subscriptions/update
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: isCancel,
        });
        ctx.throw(new Error(`写入WebManage失败: ${error}`));
      }
      return {
        start_date: subscription.current_period_end,
      };
    } catch (error) {
      ctx.throw(new Error(`更改订阅失败: ${deviceId} ${error}`));
    }
  }
  // 切换订阅 V3 - 立即升级并扣费
  // 1. 按比例退款（proration_behavior: 'create_prorations'）
  // 2. 新周期立即开始（billing_cycle_anchor: 'now'）
  // 3. 支付失败时提示用户，不执行后续逻辑
  async changeSubscriptionV3(deviceId, period, sqlCurrentSubscription, promotionCode) {
    const { ctx, app } = this;
    const payLogger = app.getLogger('payLogger');

    try {
      const { transactionId: subscriptionId } = sqlCurrentSubscription || {};

      const orderVersion = await ctx.service.order.findOrderVersionBySubscription(subscriptionId);
      const stripe = orderVersion === 2 ? ctx.stripeV2 : ctx.stripe;

      // 从 stripe 中获取订阅
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      if (subscription.status !== 'active') {
        ctx.throw(new Error(`订阅状态不是 active，无法切换。当前状态: ${subscription.status}`));
      }

      const customerId = subscription.customer;

      // 确保有支付方式
      const paymentMethodId = await this.getCustomerPaymentMethod(customerId, orderVersion);
      await this.attachPaymentMethodToCustomer(paymentMethodId, customerId, orderVersion);

      // 获取新的价格信息（年包）
      const productInfo = await ctx.service.stripe.handleExperimentPrice(deviceId, period);
      const { productId, priceId } = productInfo;

      // 验证优惠码，获取 promotion_code id
      let promotionCodeId = null;
      if (promotionCode) {
        try {
          const validateResult = await this.validatePromoCode(promotionCode, [priceId], true);
          if (validateResult && validateResult.valid) {
            promotionCodeId = validateResult.promotionCodeId;
            payLogger.info(`优惠码验证成功: ${promotionCode} -> ${promotionCodeId}`);
          } else {
            payLogger.warn(`优惠码验证失败: ${promotionCode}`);
            ctx.throw(new Error(`优惠码无效或不适用: ${promotionCode}`));
          }
        } catch (e) {
          payLogger.error(`优惠码验证异常: ${promotionCode} ${e}`);
          ctx.throw(new Error(`优惠码验证失败: ${e.message}`));
        }
      }

      // 获取当前订阅的 item id
      const currentSubscriptionItem = subscription.items.data[0];
      if (!currentSubscriptionItem) {
        ctx.throw(new Error('当前订阅没有订阅项'));
      }

      // 构建更新参数
      const updateParams = {
        items: [
          {
            id: currentSubscriptionItem.id,
            price: priceId, // 切换到年包价格
          },
        ],
        // proration_behavior: 'create_prorations', // 按比例退款/收费
        proration_behavior: 'none', // 不进行按比例计费
        billing_cycle_anchor: 'now', // 立即开始新的计费周期
        payment_behavior: 'error_if_incomplete', // 如果支付失败则报错
        metadata: {
          ...subscription.metadata,
          priceId,
          status: 'active',
          upgradePriceId: '',
          promotionCode: '', // 用完即清
        },
      };

      // 如果有优惠码，应用到订阅
      if (promotionCodeId) {
        updateParams.promotion_code = promotionCodeId;
      }

      payLogger.info(
        `开始切换订阅: subscriptionId=${subscriptionId}, deviceId=${deviceId}, ` +
          `priceId=${priceId}, promotionCode=${promotionCode || 'none'}`,
      );

      // 立即执行订阅切换
      let updatedSubscription;
      try {
        updatedSubscription = await stripe.subscriptions.update(subscriptionId, updateParams);
        payLogger.info(`订阅切换成功: ${subscriptionId}`);
      } catch (stripeError) {
        // Stripe 支付失败
        payLogger.error(`Stripe 订阅切换失败: ${subscriptionId} ${stripeError.message}`);
        const result = {
          success: false,
          message: stripeError.message || 'switch subscription failed',
        };
        return result;
      }

      // 更新成功后，更新 webManage 数据
      try {
        await ctx.service.subscription.updateSubscriptionWebManage(
          {
            deviceId,
            customer: customerId,
            startTime: updatedSubscription.current_period_start * 1000,
            productId,
            priceId,
            period,
            status: 'active', // 立即生效
          },
          { deviceId, status: 'active' },
        );
        payLogger.info(`WebManage 更新成功: deviceId=${deviceId}`);
      } catch (error) {
        // WebManage 更新失败，记录日志但不影响主流程（因为 Stripe 已经扣费成功）
        payLogger.error(`WebManage 更新失败: ${error.message}`);
        // 不抛出错误，因为订阅已经成功切换
      }

      return {
        success: true,
        start_date: updatedSubscription.current_period_start,
        end_date: updatedSubscription.current_period_end,
        subscriptionId: updatedSubscription.id,
        message: '订阅切换成功，已立即扣费',
      };
    } catch (error) {
      payLogger.error(`切换订阅失败: deviceId=${deviceId} error=${error.message}`);
      ctx.throw(new Error(`更改订阅失败: ${error.message}`));
    }
  }

  // 暂停/恢复订阅
  async pause({ deviceId, subscriptionId, isPause, pauseEnd }, subscriptionPauseInfo = {}) {
    const { ctx } = this;
    try {
      const orderVersion = await ctx.service.order.findOrderVersionBySubscription(subscriptionId);
      const stripe = orderVersion === 2 ? ctx.stripeV2 : ctx.stripe;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (isPause && subscription.current_period_end * 1000 >= pauseEnd) {
        // 暂停订阅截止时间不能小于于当前订阅周期结束时间
        return {
          success: false,
        };
      }
      // 试用期不能暂停
      if (subscription.trial_end && subscription.trial_end * 1000 > Date.now()) {
        return {
          success: false,
        };
      }
      // 判断当前订阅是否是暂停收款状态
      if (subscription.pause_collection) {
        if (isPause) {
          return {
            success: false,
          };
        }
      } else if (!isPause) {
        return {
          success: false,
        };
      }
      const updateParams = {};
      if (isPause) {
        // 暂停订阅
        updateParams.pause_collection = {
          behavior: 'void',
          resumes_at: Math.floor(pauseEnd / 1000),
        };
        const subscriptionSql = await this.find({ deviceId });
        const params = {
          transactionId: subscriptionId,
          originalTransactionId: subscriptionSql.originalTransactionId,
          productId: subscriptionSql.productId,
          status: 1001,
          subStartTime: (subscription.current_period_start * 1000).toString(),
          subEndTime: (subscription.current_period_end * 1000).toString(),
          subPauseEndTime: pauseEnd.toString(),
          bundleId: 'stripe',
          type: 1,
        };
        await this.updateSubscriptionPauseInfo({ updateData: params, type: 'create' });
      } else {
        updateParams.pause_collection = null;
        // 恢复订阅，判断当前时间在暂停订阅周期结束时间之后，则立刻开单
        if (!_.isEmpty(subscriptionPauseInfo) && +subscriptionPauseInfo.subEndTime <= Date.now()) {
          updateParams.billing_cycle_anchor = 'now';
          updateParams.proration_behavior = 'none';
          if (!subscription.default_payment_method) {
            // 查询付款方式列表
            const paymentMethods = await stripe.paymentMethods.list({
              customer: subscription.customer,
            });
            if (paymentMethods.data.length > 0) {
              updateParams.default_payment_method = paymentMethods.data[0].id;
            }
          }
        }
        const params = {
          status: 1002,
        };
        await this.updateSubscriptionPauseInfo(
          { updateData: params, type: 'update' },
          { transactionId: subscriptionId, type: 1, preStatus: 1001 },
        );
      }
      const result = await stripe.subscriptions.update(subscriptionId, updateParams);

      const resultData = {
        success: true,
        subscription: {
          id: result.id,
          latest_invoice: result.latest_invoice,
        },
        currentPeriodEnd: null,
        pauseEnd: null,
      };
      if (isPause) {
        resultData.currentPeriodEnd = result.current_period_end * 1000;
        resultData.pauseEnd = pauseEnd;
      }
      return resultData;
    } catch (error) {
      ctx.throw(new Error(`暂停/恢复订阅失败: ${deviceId} ${subscriptionId} ${isPause} ${error}`));
    }
  }
  // 更新订阅暂停信息
  async updateSubscriptionPauseInfo({ updateData, type }, where = {}) {
    const { ctx } = this;
    try {
      await ctx.service.common.recordPauseSubscription({ ...updateData, ...where }, type);
    } catch (error) {
      ctx.throw(new Error(`更新订阅管理信息失败: ${updateData} \n ${error}`));
    }
  }
  // stripe elements 主动创建订阅（已经不用了）
  async createSubscription({ deviceId, month, email }) {
    const { ctx, app } = this;
    try {
      const env = app.config.env === 'prod' ? 'Production' : 'Sandbox';
      const stripe = ctx.stripeV2;
      const userProductInfo = await this.checkUserCommercializeExperiment({
        deviceId,
        period: month,
        checkOptions: [PERIOD_MAP.oneMonth, PERIOD_MAP.oneYear].includes(+month),
        queryOptions: {
          mode: 'subscription',
          period: month,
          subscriptionType: 1, // solver订阅
        },
      });
      const { priceId, period } = userProductInfo;
      // 通过priceId获取产品信息
      const price = await stripe.prices.retrieve(priceId);
      const product = await stripe.products.retrieve(price.product);

      const orderId = ctx.helper.generateOrderId();
      const orderData = {
        deviceId,
        originalTransactionId: orderId,
        purchaseChannel: 'stripe',
        currency: price.currency,
        mode: 'subscription',
        purchaseTimeStamp: Date.now(),
        productId: product.id,
        quantity: 1,
        period,
        amount: price.unit_amount,
        diamond: 0,
        status: 'open',
        createdRaw: JSON.stringify({ priceId, email }),
        environment: env,
        priceId,
        version: 2,
        subscriptionType: 1, // 默认1，这里创建的都为solver
      };
      ctx.service.order.create(orderData);

      const customer = await stripe.customers.create({
        email,
        metadata: {
          deviceId,
        },
      });
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          deviceId,
          createType: 'stripe_elements',
          orderId,
        },
      });

      // 创建订阅
      const subscriptionData = {
        deviceId,
        originalTransactionId: orderId,
        transactionId: subscription.id,
        productId: product.id,
        bundleId: 'stripe',
        refund: 0,
        regular: 0,
        expired: 0,
        isCancel: 0,
        period,
        isTrialPeriod: 0,
        grantGems: 0,
        nextGrantGemsTime: 0,
        hasUnredeemedGems: 0,
        redeemGems: 0,
        purchaseTimeStamp: Date.now(),
        expireTimeStamp: subscription.current_period_end * 1000,
        environment: env,
      };
      this.updateSubscriptionV2(subscriptionData, { deviceId });

      return {
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      };
    } catch (error) {
      ctx.throw(new Error(`主动创建订阅失败: ${error}`));
    }
  }
  // 获取订阅支付方式
  async getSubscriptionPaymentInfo(subscriptionId) {
    const { ctx } = this;
    try {
      // 尝试获取订阅信息
      const { stripe, subscription } = await this.getStripeAndSubscription(subscriptionId);

      if (!subscription) {
        return {};
      }

      // 构建基础返回结果

      // 构建基础返回结果
      const result = {};
      /**
       * 2024-11-13 把12个月的订阅价格从$77改为了$38.99，对于买过老价格的用户来讲，价格降太多了，很容易引起不满
       * 现在前端`/pricing`页面的展示试用的是`/product`接口的数据，如果买过老价格的用户，在「manage」管理订阅的时候
       * 会看到新的价格，所以需要做一个fake，即买过老价格的用户还展示老价格，未买过的用户展示新价格
       * 这个字段给前端用来做展示的，替换12个月订阅展示价格
       * 另外，考虑到用户切换订阅这种场景，现在前端`/pricing`页面，展示订阅的选中状态的逻辑是，选中下一个周期（nextplan）
       * 果没有下一个周期，则选中当前周期，所以这块儿也要处理下一个周期的情况，如果用户有下一个周期，则使用下一个周期的数据填充到
       * VO中，否则使用当前周期
       */
      const nextPlan = await this.findNextPendingPlan(ctx.user.uid);
      const subscriptionVO = {};

      if (_.isEmpty(nextPlan)) {
        // 使用当前订阅信息
        subscriptionVO.period = ctx.service.stripe.getSubscriptionPeriod(subscription);
        // 从paySuccessRecord表中获取实际支付价格，如果没有则使用订阅包原价
        const payRecord = await ctx.model.PaySuccessRecord.findOne({
          where: {
            subscriptionId: subscription.id,
            mode: 'subscription',
          },
          order: [['createTime', 'DESC']], // 获取最新的支付记录
        });

        if (payRecord && payRecord.amount) {
          subscriptionVO.price = Number(payRecord.amount).toFixed(2);
        } else {
          // 如果没有找到支付记录，则使用订阅包原价作为备选
          subscriptionVO.price = Number(
            (subscription.items.data[0].price.unit_amount / 100).toFixed(2),
          );
        }
      } else {
        // 使用下一个周期的订阅信息
        const { priceId, period } = nextPlan;
        const price = await stripe.prices.retrieve(priceId);
        if (!_.isEmpty(price)) {
          subscriptionVO.period = period;
          subscriptionVO.price = Number((price.unit_amount / 100).toFixed(2));
        }
      }

      result.subscriptionVO = subscriptionVO;
      // 获取支付方式信息
      const paymentMethod = await this.getPaymentMethodInfo(stripe, subscription);
      if (paymentMethod) {
        Object.assign(result, this.formatPaymentMethodInfo(paymentMethod));
      }

      return result;
    } catch (error) {
      return {};
    }
  }

  // 私有辅助方法
  async getStripeAndSubscription(subscriptionId) {
    const { ctx } = this;
    try {
      const stripe = ctx.stripeV2;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return { stripe, subscription };
    } catch (error) {
      // 尝试使用另一个版本的stripe
      const stripe = ctx.stripe;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return { stripe, subscription };
    }
  }

  async getPaymentMethodInfo(stripe, subscription) {
    if (subscription.default_payment_method) {
      return await stripe.paymentMethods.retrieve(subscription.default_payment_method);
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: subscription.customer,
    });
    return paymentMethods.data[0] || null;
  }

  formatPaymentMethodInfo(paymentMethod) {
    const payInfo = {
      type: paymentMethod.type,
    };

    if (paymentMethod.type === 'card') {
      payInfo.last4 = paymentMethod.card.last4;
      payInfo.network = paymentMethod.card.brand;
    }

    return payInfo;
  }
  /**
   * 检查促销码
   * @param {string} promotionCode 促销码
   * @param {string} combinationType 组合类型
   * @param {string} language 语言
   * @param {number} period 订阅周期
   */
  async checkPromoCode(promotionCode, combinationType, language = 'en', period) {
    const { ctx } = this;

    try {
      const { productInfo } = await this.getSubAndRefundPriceInfo(language, period);
      const priceIds = productInfo.map((item) => item.priceId);
      const validateResult = await this.validatePromoCode(promotionCode, priceIds, true);
      if (!validateResult.valid) {
        ctx.logger.error(`[checkPromoCode] 促销码无效: ${validateResult.message}`);
        return { valid: false };
      }
      const priceMap = _.keyBy(productInfo, 'price');
      // 计算商品价格金额
      const { priceAmount, discountOffer } = await this.calculateProductPrice(
        priceMap,
        validateResult.promotionCodeId,
      );
      priceAmount.forEach((item) => {
        item.discount = new Decimal(item.discount).dividedBy(100).toNumber();
        item.originalPrice = new Decimal(item.originalPrice).dividedBy(100).toNumber();
        item.discountPrice = new Decimal(item.discountPrice).dividedBy(100).toNumber();
      });
      return {
        valid: true,
        discounts: priceAmount,
        discountOffer,
      };
    } catch (err) {
      ctx.logger.error(`[checkPromoCode] 校验促销码失败: ${err}`);
      return { valid: false };
    }
  }
  /**
   * 检查促销码
   * @param {string} promotionCode 促销码
   * @param {array} priceIds 价格ID
   * @param {boolean} isReturnId 是否返回价格ID
   */
  async validatePromoCode(promotionCode, priceIds = [], isReturnId = false) {
    const { ctx } = this;
    const stripe = ctx.stripeV2;

    try {
      // 1. 先查找促销码
      const promotionCodes = await stripe.promotionCodes.list({
        code: promotionCode,
        active: true,
        limit: 1,
      });
      if (!promotionCodes.data.length) {
        return { valid: false, message: '无效的促销码' };
      }

      const promoCode = promotionCodes.data[0];
      const coupon = promoCode.coupon;

      // 2. 检查促销码特定限制
      if (promoCode.restrictions) {
        if (promoCode.restrictions.minimum_amount) {
          // 检查最低消费
        }
        if (promoCode.restrictions.first_time_transaction) {
          // 检查是否首次交易
        }
      }

      // 3. 检查优惠券的商品限制
      if (coupon.applies_to && coupon.applies_to.products) {
        const prices = await Promise.all(priceIds.map((id) => stripe.prices.retrieve(id)));
        const products = prices.map((price) => price.product);
        const isValidForAllProducts = products.every((product) =>
          coupon.applies_to.products.includes(product),
        );
        if (!isValidForAllProducts) {
          return { valid: false, message: '该促销码不适用于当前商品' };
        }
      }
      const result = {
        valid: true,
        promotionCodeId: isReturnId ? promoCode.id : null,
        discountInfo: {
          type: coupon.amount_off ? 'fixed' : 'percentage',
          value: coupon.amount_off ? coupon.amount_off : coupon.percent_off,
          duration: coupon.duration,
          duration_months: coupon.duration_in_months,
        },
      };
      return result;
    } catch (err) {
      ctx.logger.error(`validatePromoCode error: ${err}`);
      return { valid: false, message: '验证促销码时发生错误' };
    }
  }
  /**
   * 根据组合类型获取价格ID（废弃）
   * @param {string} combinationType 组合类型
   * @param {string} language 语言
   * @param {number} period 订阅周期
   */
  async getPriceInfoFromCombinationType(combinationType, language = 'en', period) {
    const { ctx } = this;

    const productClassMap = {
      sub_refund: this.getSubAndRefundPriceInfo.bind(this, language, period),
    };
    const handler = productClassMap[combinationType];
    if (!handler) {
      ctx.throw(new Error(`组合类型不存在: ${combinationType}`));
    }
    try {
      const priceInfo = await handler();
      return priceInfo;
    } catch (err) {
      ctx.throw(new Error(`error: ${err}`));
    }
  }
  /**
   * 获取订阅和提前扣款退款组合类型价格信息
   * @param {string} language 语言
   * @param {number} period 订阅周期
   * @param {string} source 来源
   * @return {array} 价格ID
   */
  async getSubAndRefundPriceInfo(language = 'en', period, source = 'web_home') {
    const { ctx } = this;
    const { uid } = ctx.user;

    // 基础查询条件
    const where = {
      productClass: 'unlimited_combined_annual',
      language,
      period,
      test: 'control',
    };

    if (source === 'plugin' && period === 12) {
      where.productClass = 'unlimited_plugin';
    }

    // 获取实验分组
    const experiments = await ctx.service.abtest.getUserExperiments(uid);

    // 处理年包不同的价格标签
    if (period === 12 && source === 'plugin') {
      if (experiments.some((item) => item.includes('TEST_Plugin_Raisepackage_Test'))) {
        where.test = 'TEST_Plugin_Price_7799'; // 7799
      }
    }

    // 查询商品信息
    const productInfo = await ctx.model.ProductWeb.findAll({
      raw: true,
      where,
    });

    return {
      productInfo,
      userTestTag: where.test,
    };
  }
  /**
   * 计算商品价格
   * @param {string} combinationType 组合类型
   * @param {object} priceIdMap 价格ID映射
   * @param {string} promotionCodeId 促销码ID
   * @return {number} 总金额
   */
  async calculateProductPrice(priceIdMap, promotionCodeId) {
    const { ctx } = this;
    try {
      const stripe = ctx.stripeV2;
      const prices = ['3899', '1299', '5999', '699', '5899', '5799'];
      const promises = [];
      for (const price of prices) {
        const priceId = priceIdMap[price]?.priceId;
        if (priceId) {
          promises.push(stripe.prices.retrieve(priceId));
        }
      }
      // 如果匹配不到价格
      if (_.isEmpty(promises)) {
        ctx.throw(new Error('[calculateProductPrice] 计算组合类型商品价格ID匹配失败'));
      }
      const pricesResult = await Promise.all(promises);
      const priceAmount = [];
      const meta = {};
      for (const price of pricesResult) {
        if (price.unit_amount) {
          priceAmount.push({
            originalPrice: price.unit_amount,
            discountPrice: 0,
            discount: 0,
          });
          meta[price.unit_amount] = price.id;
        }
      }
      let discountOffer = '';
      if (promotionCodeId) {
        const promoCodeDetails = await stripe.promotionCodes.retrieve(promotionCodeId);
        if (promoCodeDetails.coupon.percent_off) {
          discountOffer = `${promoCodeDetails.coupon.percent_off}%`;
          priceAmount.forEach((price) => {
            const originalPrice = new Decimal(price.originalPrice);
            const percentOff = new Decimal(promoCodeDetails.coupon.percent_off).dividedBy(100);

            const discountAmount = originalPrice.times(percentOff).toDecimalPlaces(0);
            const discountedPrice = originalPrice.minus(discountAmount).toDecimalPlaces(0);

            price.discountPrice = discountedPrice.toNumber();
            price.discount = discountAmount.toNumber();
          });
        } else if (promoCodeDetails.coupon.amount_off) {
          priceAmount.forEach((price) => {
            price.discountPrice = promoCodeDetails.coupon.amount_off;
          });
        }
      }
      return { priceAmount, meta, discountOffer };
    } catch (error) {
      ctx.throw(new Error(`[calculateProductPrice] error: ${error}`));
    }
  }
  /**
   * 创建组合订阅
   * @param {string} deviceId 设备ID
   * @param {string} combinationType 组合类型
   * @param {string} promotionCode 促销码
   * @param {string} language 语言
   * @param {string} email 邮箱
   * @param {number} period 订阅周期
   * @param {string} source 来源
   */
  async createCombinedSub(
    deviceId,
    combinationType,
    promotionCode,
    language = 'en',
    email,
    period,
    source,
  ) {
    const { ctx, app } = this;
    const subscriptionLogger = app.getLogger('subscriptionLogger');
    let recordPriceId = null;
    try {
      const stripe = ctx.stripeV2;
      if (combinationType !== 'sub_refund') {
        return {
          code: 400,
          message: '不支持的组合类型',
          data: {},
        };
      }
      // 首先校验一下用的订阅是否生效
      const isSubscription = await this.findActiveSubscription(deviceId);
      if (!_.isEmpty(isSubscription)) {
        subscriptionLogger.error(`[createCombinedSub] 已存在订阅: ${deviceId}`);
        return {
          code: 400,
          message: '已存在订阅',
          data: {},
        };
      }

      // 1. 创建客户
      const customer = await stripe.customers.create({
        email,
        metadata: {
          deviceId,
          source,
        },
      });

      // 获取价格信息和处理促销码
      const { productInfo } = await this.getSubAndRefundPriceInfo(language, period);
      const product = productInfo[0];
      if (!product) {
        return {
          code: 400,
          message: '获取产品价格信息失败',
          data: {},
        };
      }
      let promotionCodeId = null;
      // 校验促销码是否有效
      if (promotionCode) {
        const priceIds = productInfo.map((item) => item.priceId);
        const validateResult = await this.validatePromoCode(promotionCode, priceIds, true);
        if (!validateResult.valid) {
          subscriptionLogger.error(`[createCombinedSub] 促销码无效: ${validateResult.message}`);
          return {
            code: 400,
            message: '促销码无效',
            data: {},
          };
        }
        promotionCodeId = validateResult.promotionCodeId;
      }
      const priceMap = _.keyBy(productInfo, 'price');
      // 计算优惠码折扣的商品价格金额，并加入calculatedPrice字段
      const { priceAmount, meta } = await this.calculateProductPrice(priceMap, promotionCodeId);
      product.calculatedPrice = priceAmount[0] || {};
      // for (const priceData of priceAmount) {
      //   if (priceMap[priceData.originalPrice]) {
      //     priceMap[priceData.originalPrice].calculatedPrice = priceData;
      //   }
      // }
      // 获取商品价格并构建数据映射(V1的已经不用了)
      // const PRICE_CONFIGS = {
      //   oneTime: 99, // 预扣款 v1 扣款价格
      //   subscription: 3800, // 预扣款 v1 首次试用价格
      //   subscriptionUpgrade: 3899, // 预扣款 v1 首次试用后调整的价格
      //   subRefundSub: 3899, // 预扣款 v2 免费试用扣款价格
      //   subRefundSub2: 5999, // 预扣款 v2 年包5999扣款价格
      //   subRefundSubOneMonth: 1299, // 预扣款 v2 月包免费试用扣款价格
      //   subRefundSubOneWeek: 699, // 预扣款 v2 周包免费试用扣款价格
      // };
      _.assign(meta, {
        deviceId,
        email,
        promotionCodeId,
        subscriptionType: 'combined_payment_intent',
        source,
      });
      // 根据用户测试标签和订阅周期确定价格配置
      // const TEST_TAG_PRICE_MAP = {
      //   control: (period) => {
      //     switch (period) {
      //       case PERIOD_MAP.oneMonth:
      //         return PRICE_CONFIGS.subRefundSubOneMonth;
      //       case PERIOD_MAP.oneYear:
      //         return PRICE_CONFIGS.subRefundSub;
      //       case PERIOD_MAP.oneWeek:
      //         return PRICE_CONFIGS.subRefundSubOneWeek;
      //       default:
      //         throw new Error(`[createCombinedSub] 不支持的订阅周期: ${period}`);
      //     }
      //   },
      //   TEST_M_SV_Old_Price_B_on: () => 5999,
      // };
      // let userPriceData = null;
      // if (userTestTag && TEST_TAG_PRICE_MAP[userTestTag]) {
      //   userPriceData = TEST_TAG_PRICE_MAP[userTestTag](period);
      // }
      // 预先创建订阅记录， orderId 作为 transactionId
      const { orderId } = await this.preCreateSub(customer.id, meta, product);
      const customerId = customer.id;
      let priceData = null;
      // 如果是扣款组合类型，先扣用户 1 美元，扣款成功再创建订阅
      // if (combinationType === 'sub_refund') {
      _.assign(meta, {
        subOrderId: orderId,
        combinationType,
        upgradePriceId: product.priceId,
      });
      recordPriceId = product.priceId;
      // 获取1 美元退款价格
      const refundPaymentPrice = await ctx.model.ProductWeb.findOne({
        raw: true,
        attributes: ['price', 'priceId', 'productId'],
        where: {
          productClass: 'unlimited_combined_annual',
          test: 'refund_payment',
          language,
        },
      });
      priceData = {
        ...refundPaymentPrice,
        calculatedPrice: {
          originalPrice: refundPaymentPrice.price,
          discountPrice: refundPaymentPrice.price,
          discount: 0,
        },
      };
      // } else {
      //   _.assign(meta, {
      //     subOrderId: orderId,
      //     upgradePriceId: JSON.stringify([
      //       priceMap[PRICE_CONFIGS.subscription].priceId,
      //       priceMap[PRICE_CONFIGS.subscriptionUpgrade].priceId,
      //     ]),
      //   });
      //   priceData = priceMap[PRICE_CONFIGS.oneTime];
      // }

      const { clientSecret, paymentIntentId } = await this.createPaymentIntent(
        customerId,
        meta,
        priceData,
      );

      return {
        code: 0,
        message: '创建订阅成功',
        data: {
          clientSecret,
          paymentIntentId,
          orderId,
        },
      };
    } catch (error) {
      ctx.logger.error(`[createCombinedSub] 创建组合订阅支付失败: ${error}`);
      ctx.service.point.uploadServerPoint(deviceId, 'sub_fail', {
        period,
        deviceId,
        freetrial: 'refund',
        price: recordPriceId,
        errorCode: 500,
        errorMsg: `[createCombinedSub] 创建组合订阅支付失败: ${error.message}`,
      });
      return {
        code: 400,
        message: error.message,
        data: {},
      };
    }
  }
  /**
   * 根据回调创建订阅(一美元成功回调)
   * @param {object} invoice 发票
   */
  async createSubByWebhook(invoice) {
    const { ctx, app } = this;
    const subscriptionLogger = app.getLogger('subscriptionLogger');
    try {
      const env = app.config.env === 'prod' ? 'Production' : 'Sandbox';
      const stripe = ctx.stripeV2;
      const { customer } = invoice;
      let {
        createType,
        deviceId,
        promotionCodeId,
        subOrderId,
        orderId,
        subscriptionType,
        email,
        priceId,
        upgradePriceId,
        combinationType,
        source,
      } = invoice.metadata;
      const metadata = {
        orderId: subOrderId,
        deviceId,
        email,
        priceId,
        createType,
        subscriptionType,
        source,
      };
      if (combinationType === 'sub_refund') {
        priceId = upgradePriceId;
        const metadata = {
          deviceId,
          orderId,
          reason: 'subscription_upgrade',
          combinationType: 'sub_refund',
        };
        // 退款
        ctx.service.stripe.paymentRefund(invoice, metadata, orderId);
      } else {
        // 预扣款 v1 099_38_3899
        // 格式化upgradePriceId，并将第一个元素取出来
        const priceIds = JSON.parse(upgradePriceId);
        priceId = priceIds.shift();
        _.assign(metadata, {
          upgradePriceId: JSON.stringify(priceIds), // 下一个需要升级的套餐
          status: 'start_free_trail',
          promotionCodeId: promotionCodeId || '',
          priceId,
        });
      }
      const subscriptionParams = {
        customer,
        items: [
          {
            price: priceId,
          },
        ],
        payment_behavior: 'allow_incomplete',
        metadata,
        trial_period_days: 3, // 设置3天试用期
        expand: ['latest_invoice.payment_intent'],
        off_session: true, // 添加此参数表示这是后台扣款
      };
      if (promotionCodeId) {
        // 添加促销码
        subscriptionParams.promotion_code = promotionCodeId;
      }
      // 获取客户详情，包括默认支付方式
      const paymentMethods = await stripe.paymentMethods.list({ customer });
      let subscription = null;
      if (_.isEmpty(paymentMethods.data)) {
        subscriptionLogger.error(
          `[createSubByWebhook] 用户没有支付方式, metadata: ${JSON.stringify(invoice.metadata)}`,
        );
        subscription = await stripe.subscriptions.create({ ...subscriptionParams });
      } else {
        // 尝试使用用户的支付方式创建订阅
        for (const paymentMethod of paymentMethods.data) {
          subscriptionParams.default_payment_method = paymentMethod.id;
          try {
            subscription = await stripe.subscriptions.create({ ...subscriptionParams });
            break;
          } catch (error) {
            subscriptionLogger.error(
              `[createSubByWebhook] 创建订阅失败, 支付方式异常, metadata: ${JSON.stringify(invoice.metadata)}, error: ${error}`,
            );
          }
        }
      }
      // 获取用户订阅信息
      const subscriptionInfo = await stripe.subscriptions.retrieve(subscription.id);
      const currentPeriodStart = subscriptionInfo.current_period_start;
      const trialEnd = subscriptionInfo.trial_end;
      const isInTrialPeriod = trialEnd && currentPeriodStart < trialEnd;
      const updateData = {
        transactionId: subscription.id,
        purchaseTimeStamp: Date.now(),
        status: 'complete',
        invoice: invoice.id,
        completedRaw: JSON.stringify(invoice),
      };
      // 更新订单信息
      await ctx.model.Order.update(updateData, { where: { originalTransactionId: orderId } });
      // 添加订阅信息
      const productId = subscriptionInfo.items.data[0].price.product;
      const period = ctx.service.stripe.getSubscriptionPeriod(subscriptionInfo);
      const subscriptionData = {
        deviceId,
        transactionId: subscription.id,
        originalTransactionId: orderId,
        productId,
        refund: 0,
        isCancel: 0,
        regular: isInTrialPeriod ? 0 : 1,
        expired: 0,
        isTrialPeriod: isInTrialPeriod ? 1 : 0,
        period,
        purchaseTimeStamp: subscriptionInfo.start_date * 1000,
        expireTimeStamp: subscriptionInfo.current_period_end * 1000,
        subscriptionType,
        bundleId: 'stripe',
        environment: env,
      };
      const subInfo = await ctx.model.Subscription.findOne({
        where: { deviceId },
      });
      if (subInfo) {
        await ctx.model.Subscription.update(subscriptionData, { where: { deviceId } });
        return;
      }
      await ctx.model.Subscription.create(subscriptionData);
      return;
    } catch (error) {
      subscriptionLogger.error(
        `[createSubByWebhook] 创建订阅失败, metadata: ${JSON.stringify(invoice.metadata)}, error: ${error}`,
      );
      ctx.throw(new Error(`[createSubByWebhook] 创建订阅失败: ${error}`));
    }
  }
  /**
   * 预创建订阅
   * @param {string} customerId 客户ID
   * @param {object} meta 元数据
   * @param {object} priceData 价格映射
   */
  async preCreateSub(customerId, meta, priceData) {
    const { ctx, app } = this;
    const subscriptionLogger = app.getLogger('subscriptionLogger');
    try {
      const env = app.config.env === 'prod' ? 'Production' : 'Sandbox';
      // 预先创建订阅记录， orderId 作为 transactionId
      const orderId = ctx.helper.generateOrderId();
      const orderData = {
        deviceId: meta.deviceId,
        originalTransactionId: orderId,
        transactionId: orderId,
        purchaseChannel: 'stripe',
        amount: priceData.calculatedPrice.originalPrice - priceData.calculatedPrice.discount,
        currency: 'usd',
        mode: 'subscription',
        purchaseTimeStamp: Date.now(),
        productId: priceData.productId,
        quantity: 1,
        period: priceData.period,
        status: 'open',
        isTrial: 1,
        createdRaw: JSON.stringify({
          email: meta.email,
          promotionCodeId: meta.promotionCodeId || '',
        }),
        environment: env,
        version: 2,
        subscriptionType: 1,
        priceId: priceData.priceId,
        customer: customerId,
        invoice: '',
      };
      await ctx.service.order.create(orderData);
      return {
        orderId,
      };
    } catch (error) {
      subscriptionLogger.error(`[preCreateSub] 预先创建订阅失败: ${error}`);
      ctx.throw(new Error(`[preCreateSub] 预先创建订阅失败: ${error}`));
    }
  }
  /**
   * 创建消费品支付
   * @param {string} customerId 客户ID
   * @param {object} meta 元数据 {deviceId,email,promotionCode,subscriptionType}
   * @param {object} priceData 价格数据
   */
  async createPaymentIntent(customerId, meta, priceData) {
    const { ctx, app } = this;
    const subscriptionLogger = app.getLogger('subscriptionLogger');
    try {
      const env = app.config.env === 'prod' ? 'Production' : 'Sandbox';
      const stripe = ctx.stripeV2;

      // 创建一次性商品的支付意向
      const orderId = ctx.helper.generateOrderId();
      // 获取价格
      const amount = priceData.calculatedPrice.originalPrice - priceData.calculatedPrice.discount;
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId,
        payment_method_types: ['card', 'link'],
        metadata: {
          ...meta,
          orderId,
          priceId: priceData.priceId,
        },
        setup_future_usage: 'off_session',
        confirmation_method: 'automatic', // 添加确认方法
        capture_method: 'automatic', // 添加捕获方法
      });
      const orderData = {
        deviceId: meta.deviceId,
        originalTransactionId: orderId,
        purchaseChannel: 'stripe',
        currency: 'usd',
        mode: 'payment',
        purchaseTimeStamp: Date.now(),
        productId: priceData.productId,
        quantity: 1,
        period: priceData.period,
        amount,
        status: 'open',
        createdRaw: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          email: meta.email,
          promotionCodeId: meta.promotionCodeId || '',
        }),
        environment: env,
        version: 2,
        subscriptionType: 1,
        priceId: priceData.priceId,
        customer: customerId,
        invoice: '',
      };
      await ctx.service.order.create(orderData);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      subscriptionLogger.error(`[createPaymentIntent] 创建一次性商品支付意向失败: ${error}`);
      ctx.throw(new Error(`[createPaymentIntent] 创建一次性商品支付意向失败: ${error}`));
    }
  }
  /**
   * 检查用户是否符合商业化实验
   * @param {string} deviceId 设备ID
   * @param {number} period 订阅周期
   * @param {object} checkOptions 检查选项
   * @param {object} queryOptions 查询选项
   * @return {object} 价格ID和周期
   */
  async checkUserCommercializeExperiment({ deviceId, period, checkOptions, queryOptions }) {
    const { ctx } = this;
    try {
      // 先判断试验分组
      let userProductInfo;

      // 实验全量后新规则
      const experimentTags = ['TEST_M_SV_Old_Price_B_off_v1', 'TEST_M_NewShop_v1'];
      const mergeExperimentTags = [
        'TEST_M_Web_SV_New',
        'TEST_M_SV_Old_Price_B',
        'TEST_M_SV_Old_Price_B_on',
        'TEST_M_SV_Old_Price_B_off',
        'TEST_M_Web_month_trial',
        'TEST_S_Webspeed_NewShop',
      ];

      // 查询用户实验分组
      const commercializeExperiment = await ctx.service.product.queryCommercializeExperiment(
        deviceId,
        [...experimentTags, ...mergeExperimentTags],
      );

      if (commercializeExperiment.length > 0 && checkOptions) {
        // 优先匹配新规则实验
        const matchedNewExperiment = experimentTags.find((tag) =>
          commercializeExperiment.includes(tag),
        );

        if (matchedNewExperiment) {
          userProductInfo = await ctx.service.product.queryCommercializeProductInfo(
            matchedNewExperiment,
            period,
          );
        } else {
          // 匹配合并规则实验
          const matchedMergeExperiment = mergeExperimentTags.find((tag) =>
            commercializeExperiment.includes(tag),
          );

          if (matchedMergeExperiment) {
            // TEST_M_Web_month_trial实验组全量
            userProductInfo = await ctx.service.product.queryCommercializeProductInfo(
              'TEST_M_Web_month_trial',
              period,
            );
          }
        }
      }

      // 如果没有匹配到实验或产品信息为空,使用默认配置
      if (_.isEmpty(userProductInfo)) {
        userProductInfo = await ctx.service.product.findPriceIdByModeAndMonth(queryOptions);
      }

      return userProductInfo;
    } catch (error) {
      ctx.throw(new Error(`主动创建订阅失败: ${error}`));
    }
  }
}

module.exports = SubscriptionService;
