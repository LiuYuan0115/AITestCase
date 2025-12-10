const { Controller } = require('egg');
const _ = require('lodash');

class PricingController extends Controller {
  // 更新汇率
  async rateServer() {
    const { ctx } = this;
    await ctx.service.common.updateUsdRate();
    ctx.body = null;
  }
  // 获取转完美金后的金额
  async rate() {
    const { ctx } = this;
    ctx.validate(
      {
        amount: 'string',
      },
      ctx.request.query,
    );
    ctx.validate(
      {
        currency: 'string',
      },
      ctx.params,
    );
    const { amount } = ctx.request.query;
    const { currency } = ctx.params;
    const result = await ctx.service.common.getUsdAmount(currency, amount);
    ctx.body = result;
  }
  /**
   * 获取商品列表
   */
  async list() {
    const { ctx } = this;
    const productList = await ctx.service.product.list();
    ctx.body = productList;
  }
  /**
   * 提交订单，返回支付页面url
   */
  async checkout() {
    const { ctx } = this;

    ctx.validate({
      mode: 'string',
      quantity: 'int?',
      questionId: 'string?',
      period: 'int?',
      diamond: 'int?',
      discounts: {
        type: 'array',
        required: false,
        min: 1,
        itemType: 'object',
        rule: {
          coupon: 'string?',
          promotion_code: 'string?',
        },
      },
      backPath: 'string?',
      email: 'string?',
    });
    let {
      type: subscriptionType,
      mode,
      quantity = 1,
      questionId = '',
      period,
      diamond,
      discounts,
      backUrl,
      backPath = '',
      source,
      discount,
      email = '',
      isFreeTrail = false,
    } = ctx.request.body;

    // 处理插件用户关联切换
    const pluginUuid = ctx.request.header['x-plugin-uuid'];
    if (pluginUuid) {
      try {
        const currentUid = ctx.user.uid;

        // 查询当前 pluginUuid 关联的用户信息
        const pluginInfo = await ctx.model.PluginUserInfo.findOne({
          where: { pluginUuid },
        });

        // 检查是否需要切换关联：记录存在 && 不是当前用户 && 原用户是新用户
        if (pluginInfo && pluginInfo.deviceId !== currentUid && pluginInfo.isNewUser === 1) {
          const oldDeviceId = pluginInfo.deviceId;

          // 直接更新 deviceId
          await pluginInfo.update({ deviceId: currentUid });

          ctx.logger.info(
            `[Plugin Association Switch] 插件关联切换成功 - pluginUuid: ${pluginUuid}, oldDeviceId: ${oldDeviceId}, newDeviceId: ${currentUid}`,
          );
        }
      } catch (error) {
        ctx.logger.error(
          `[Plugin Association Switch] 插件关联切换失败 - pluginUuid: ${pluginUuid}, currentUid: ${ctx.user.uid}, error: ${error.message}`,
        );
        // 不中断主流程，继续执行 checkout 逻辑
      }
    }

    if (mode === 'subscription') {
      subscriptionType = subscriptionType || 'solver';

      // 检查是否有未过期的订阅solver或bundle
      const solverOrBundleSubscription = await ctx.service.subscription.findActiveSubscription();
      const hasActiveSubscription = solverOrBundleSubscription.some(
        (item) =>
          item.subscriptionType === 3 ||
          (item.subscriptionType === 1 && subscriptionType === 'solver'),
      );

      if (hasActiveSubscription) {
        ctx.body = {
          code: 400,
          msg: 'server_error.has_active_subscription',
        };
        return;
      }

      if (subscriptionType === 'writer') {
        const writerSubscription = await ctx.service.subscription.findActiveWriterSubscription(
          ctx.user.uid,
        );
        if (!_.isEmpty(writerSubscription)) {
          ctx.body = {
            code: 400,
            msg: 'server_error.has_active_subscription',
          };
          return;
        }
      }
    }
    const result = await ctx.service.product.createCheckout({
      subscriptionType,
      mode,
      quantity,
      questionId,
      month: period,
      diamond,
      discounts,
      backUrl,
      backPath,
      source,
      discount,
      email,
      isFreeTrail,
    });
    ctx.body = result;
  }
  // 创建订阅
  async createSubscription() {
    const { ctx } = this;
    ctx.validate({
      period: 'int',
      email: 'string',
    });
    const { period, email } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const result = await ctx.service.subscription.createSubscription({
      deviceId,
      month: period,
      email,
    });
    ctx.body = result;
  }
  // 检查促销码
  async checkPromoCode() {
    const { ctx } = this;
    // 参数校验
    ctx.validate(
      {
        promotionCode: 'string',
        combinationType: 'string',
        period: 'string?',
      },
      ctx.query,
    );
    const { promotionCode, combinationType, period } = ctx.query;
    const language = ctx.request.headers['solvely-language'] || 'en';
    try {
      const result = await ctx.service.subscription.checkPromoCode(
        promotionCode,
        combinationType,
        language,
        +period,
      );
      ctx.body = result.valid
        ? { code: 0, data: { discounts: result.discounts, discountOffer: result.discountOffer } }
        : { code: 400, data: {} };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: '验证促销码失败',
      };
    }
  }
  // 创建组合订阅
  async createCombinedSub() {
    const { ctx } = this;
    ctx.validate({
      combinationType: 'string',
      promotionCode: 'string?',
      email: 'string?',
      period: 'int?',
      source: 'string?',
    });
    const { combinationType, promotionCode, email, period, source } = ctx.request.body;
    const language = ctx.request.headers['solvely-language'] || 'en';
    const deviceId = ctx.user.uid;
    const result = await ctx.service.subscription.createCombinedSub(
      deviceId,
      combinationType,
      promotionCode,
      language,
      email,
      period,
      source,
    );
    ctx.body = result;
  }
  // 检查订单状态
  async check() {
    const { ctx } = this;
    const stripe = ctx.stripe;
    const { id } = ctx.params;
    const result = await stripe.checkout.sessions.retrieve(id);
    ctx.body = result.status;
  }
  // 获取订单信息
  async order() {
    const { ctx } = this;
    const { id } = ctx.params;
    const result = await ctx.service.order.find({ originalTransactionId: id });
    ctx.body = result;
  }
  // 获取是否有未发放钻石的记录
  async checkGrantDiamondRecord() {
    const { ctx } = this;
    const res = await ctx.service.subscription.checkGrantDiamondRecord();
    ctx.body = res;
  }
  /**
   * 获取用户订阅信息
   */
  async subscription() {
    const { ctx } = this;
    let {
      purchasedFreeTrial,
      resultData,
      isPurchased = false,
    } = await ctx.service.subscription.findSubscription();

    // 新增逻辑：检查插件维度的免费试用
    if (!purchasedFreeTrial) {
      const pluginUuid = ctx.request.header['x-plugin-uuid'];

      if (pluginUuid) {
        try {
          const pluginUserInfo = await ctx.model.PluginUserInfo.findOne({
            raw: true,
            attributes: ['freeTrialCount'],
            where: {
              pluginUuid,
            },
          });

          if (pluginUserInfo && pluginUserInfo.freeTrialCount > 0) {
            purchasedFreeTrial = true;
            ctx.logger.info(
              `[Plugin Free Trial] deviceId: ${ctx.user.uid}, pluginUuid: ${pluginUuid}, freeTrialCount: ${pluginUserInfo.freeTrialCount}`,
            );
          }
        } catch (error) {
          ctx.logger.error(
            `[Plugin Free Trial] 查询插件免费试用次数失败 - deviceId: ${ctx.user.uid}, pluginUuid: ${pluginUuid}, error: ${error}`,
          );
        }
      }
    }

    ctx.body = {
      code: 0,
      purchasedFreeTrial,
      data: resultData,
      isPurchased,
    };
  }
  // 获取订阅支付方式
  async subscriptionPaymentInfo() {
    const { ctx } = this;
    const { subscriptionId } = ctx.query;
    if (!subscriptionId) {
      ctx.body = {
        code: 400,
        message: 'subscriptionId不能为空',
      };
      return;
    }
    const result = await ctx.service.subscription.getSubscriptionPaymentInfo(subscriptionId);

    ctx.body = {
      code: 0,
      data: result,
    };
  }
  /**
   * 取消订阅
   */
  async cancelSubscription() {
    const { ctx } = this;
    ctx.validate({
      isCancel: 'boolean',
    });
    const subscription = await ctx.service.subscription.find({
      deviceId: ctx.user.uid,
    });
    if (_.isEmpty(subscription)) {
      ctx.body = {
        code: 400,
        message: '没有订阅记录',
      };
      return;
    }
    const { isCancel = false } = ctx.request.body;
    const result = await ctx.service.subscription.cancel(subscription.transactionId, isCancel);
    ctx.body = {
      code: 0,
      data: result,
      message: '订阅修改成功',
    };
  }
  // cancelSurvey
  async cancelSurvey() {
    const { ctx } = this;
    ctx.validate({
      text1: 'string',
      text2: 'string',
    });
    const { text1, text2 } = ctx.request.body;
    const result = await ctx.service.subscription.createSurvey({
      deviceId: ctx.user.uid,
      data: {
        text1,
        text2,
      },
    });
    ctx.service.common.cancelTrialSubscription({
      deviceId: ctx.user.uid,
      subscriptionCancelSurveyId: result.id,
    });
    ctx.status = 200;
    ctx.body = {
      code: 0,
    };
  }
  // pauseSurvey
  async pauseSurvey() {
    const { ctx } = this;
    ctx.validate({
      text1: 'string',
      text2: 'string',
    });
    const { text1, text2, text3 = '' } = ctx.request.body;
    await ctx.service.subscription.createSurvey(
      {
        deviceId: ctx.user.uid,
        data: {
          text1,
          text2,
          text3,
        },
      },
      1,
    );
    ctx.status = 200;
    ctx.body = {
      code: 0,
    };
  }
  /**
   * stripe支付webhook
   */
  async webhook() {
    const { ctx } = this;
    await ctx.service.stripe.webhook();
    ctx.body = null;
  }
  async webhookV2() {
    const { ctx } = this;
    const event = ctx.request.body;
    const { metadata } = event.data.object;
    if (metadata?.project === 'GMAT') {
      ctx.body = null;
      return;
    }
    await ctx.service.stripe.webhook(2);
    ctx.body = null;
  }
  async changeSubscriptionV2() {
    const { ctx } = this;
    const { period, promotionCode } = ctx.request.body || {};
    const deviceId = ctx.user.uid;
    const sqlCurrentSubscription = await ctx.service.subscription.find({
      deviceId,
    });
    if (_.isEmpty(sqlCurrentSubscription)) {
      ctx.body = {
        code: 400,
        message: '没有订阅记录',
      };
      return;
    }
    // TODO：free-trail 注释掉
    if (sqlCurrentSubscription.isTrialPeriod) {
      const result = await ctx.service.subscription.changeSubscriptionV2WithTrial(
        deviceId,
        period,
        sqlCurrentSubscription,
        promotionCode,
      );
      // ctx.body = {
      //   code: 400,
      //   message: '试用期内无法更改订阅',
      // };
      ctx.body = {
        code: 0,
        data: { ...result },
      };
      return;
    }

    const result = await ctx.service.subscription.changeSubscriptionV3(
      deviceId,
      period,
      sqlCurrentSubscription,
      promotionCode,
    );
    ctx.body = {
      code: 0,
      data: { ...result },
    };
  }
  /**
   * 更改订阅
   */
  async changeSubscription() {
    const { ctx } = this;
    const { priceId: newPriceId } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const sqlCurrentSubscription = await ctx.service.subscription.find({
      deviceId,
    });
    const { transactionId: subscriptionId } = sqlCurrentSubscription || {};
    try {
      const orderVersion = await ctx.service.order.findOrderVersionBySubscription(subscriptionId);
      const stripe = orderVersion === 2 ? ctx.stripeV2 : ctx.stripe;
      // 获取当前订阅对象
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // 检查是否有未生效的更新
      if (
        subscription.pending_update &&
        subscription.pending_update.expires_at > Math.floor(Date.now() / 1000)
      ) {
        // 取消未生效的更新
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
          items: [
            {
              id: subscription.items.data[0].id,
              price: subscription.plan.id, // 重置回当前计划
            },
          ],
        });
      }

      // 更新为新的订阅计划
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId, // 新计划的 price_id
          },
        ],
        proration_behavior: 'none', // 若要避免即时计费变动
        trial_end: subscription.current_period_end, // 延迟到当前周期结束
      });
      ctx.logger.info('updatedSubscription', updatedSubscription);

      await ctx.service.subscription.updateSubscription(deviceId, updatedSubscription);

      ctx.body = {
        code: 0,
        data: updatedSubscription,
      };
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }
  /**
   * 暂停/取消暂停订阅
   */
  async pauseSubscription() {
    const { ctx } = this;
    ctx.validate({
      isPause: 'boolean',
    });
    const { isPause, pauseEnd } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const subscription = await ctx.service.subscription.find({
      deviceId,
    });
    if (_.isEmpty(subscription)) {
      ctx.body = {
        code: 40001,
        message: '没有订阅记录',
      };
      return;
    }
    const subscriptionPauseRecords = await ctx.service.common.getPauseSubscriptionRecord(
      subscription.transactionId,
    );
    const currentTime = Date.now();
    const currentPeriodPausedRecord = subscriptionPauseRecords.find(
      (item) =>
        item.status === 1001 ||
        (item === 1002 && item.subStartTime < currentTime && currentTime <= item.subEndTime),
    );
    if (isPause) {
      if (currentPeriodPausedRecord) {
        ctx.body = {
          code: 40002,
          message: '订阅暂停次数已达上限',
        };
        return;
      }
    }
    const result = await ctx.service.subscription.pause(
      {
        deviceId,
        subscriptionId: subscription.transactionId,
        isPause,
        pauseEnd,
      },
      currentPeriodPausedRecord,
    );
    if (!result.success) {
      ctx.body = {
        code: -1,
        message: '操作与现有状态冲突',
      };
      return;
    }
    delete result.success;
    ctx.body = {
      code: 0,
      data: result,
      message: '订阅修改成功',
    };
  }
  /**
   * 查询invoice详情
   */
  async invoiceDetail() {
    const { ctx } = this;
    const { invoiceId } = ctx.params;
    const subscriptionId = ctx.query.subscriptionId;
    const orderVersion = await ctx.service.order.findOrderVersionBySubscription(subscriptionId);
    const stripe = orderVersion === 2 ? ctx.stripeV2 : ctx.stripe;
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      ctx.body = {
        code: 0,
        data: {
          id: invoice.id,
          status: invoice.status,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          subscription: invoice.subscription,
        },
      };
    } catch (e) {
      ctx.body = {
        code: -1,
        data: {},
        message: e.message,
      };
    }
  }

  /**
   * 获取商品列表
   */
  async guestList() {
    const { ctx } = this;
    const productList = await ctx.service.product.guestList();
    ctx.body = productList;
  }
}

module.exports = PricingController;
