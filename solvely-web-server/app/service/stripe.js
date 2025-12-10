const { Service } = require('egg');
const _ = require('lodash');
const moment = require('moment');
const { experimentStrategies } = require('../../config/price');

class Stripe extends Service {
  // 获取stripe对象
  getStripe(version) {
    const { ctx } = this;
    return version === 2 ? ctx.stripeV2 : ctx.stripe;
  }
  // 获取订阅周期，单位月
  getSubscriptionPeriod(subscription) {
    const intervalMap = {
      month: 1,
      week: 7,
      year: 12,
    };
    const subscriptionRecurring = subscription.items.data[0].price.recurring;
    const period =
      intervalMap[subscriptionRecurring.interval] * subscriptionRecurring.interval_count;
    return period;
  }
  async webhook(version = 1) {
    const { ctx, app } = this;
    try {
      const stripe = this.getStripe(version);
      const stripeConfig = app.config.stripeConfig;
      const endpointSecret =
        version === 2 ? stripeConfig.endpointSecretV2 : stripeConfig.endpointSecret;
      const sig = ctx.request.header['stripe-signature'];
      let event;
      try {
        event = stripe.webhooks.constructEvent(ctx.request.rawBody, sig, endpointSecret);
      } catch (err) {
        ctx.throw(400, `Webhook Error: ${err.message}`);
      }
      switch (event.type) {
        // 一个会话流程结束
        case 'checkout.session.completed':
          this.checkoutCompleted(event.data.object, version);
          break;
        // 会话过期
        case 'checkout.session.expired':
          this.checkoutExpired(event.data.object);
          break;
        // 更新订阅状态，以及免费试用到期，都会触发这个事件
        case 'customer.subscription.updated':
          this.customerSubscriptionUpdated(event.data.object, version);
          break;
        // 订阅过期，以及在stripe控制台取消订阅，都会触发这个事件
        case 'customer.subscription.deleted':
          this.customerSubscriptionDeleted(event.data.object, version);
          break;
        // 订阅支付成功（试用期结束，会触发这个事件）
        case 'invoice.payment_succeeded':
          this.invoicePaymentSucceeded(event.data.object, version);
          break;
        // 消耗品购买成功
        case 'payment_intent.succeeded':
          this.paymentIntentSucceeded(event.data.object, version);
          break;
        // 订阅付款失败
        case 'invoice.payment_failed':
          this.invoicePaymentFailed(event.data.object, version);
          break;
        // 使用优惠券
        case 'customer.discount.created':
          this.customerDiscountCreated(event.data.object, version);
          break;
        // 入金，（试用期结束，会触发这个事件）
        case 'charge.succeeded':
          this.chargeSuccessRecord(event.data.object, version);
          break;
        // 退款
        case 'charge.refunded':
          this.chargeRefunded(event.data.object);
          break;
        default:
          break;
      }
      ctx.service.dynamoDB.create('StripeWebhook', event);
    } catch (e) {
      ctx.logger.error(`stripe webhook: ${e}`);
    }
  }
  // 一个会话流程结束
  async checkoutCompleted(session, version) {
    const { ctx, app } = this;
    const payLogger = app.getLogger('payLogger');
    let deviceId = null,
      period = 0,
      isTrial = 0;
    try {
      if (session.mode === 'subscription') {
        const subscriptionId = session.subscription;
        // const customerId = session.customer;
        const productId = session.metadata.productId;
        isTrial = session.metadata.isTrial === 'true' ? 1 : 0;
        deviceId = session.metadata.deviceId;

        const stripe = this.getStripe(version);

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        period = this.getSubscriptionPeriod(subscription);

        const { subscriptionType } = await ctx.service.order.update(session, 0, period);
        const subscriptionData = {
          deviceId,
          transactionId: subscriptionId,
          originalTransactionId: session.id,
          productId,
          bundleId: 'stripe',
          refund: 0,
          regular: 1,
          expired: 0,
          isTrialPeriod: isTrial,
          isCancel: 0,
          period,
          purchaseTimeStamp: subscription.start_date * 1000,
          expireTimeStamp: subscription.current_period_end * 1000,
          environment: app.config.env === 'prod' ? 'Production' : 'Sandbox',
          subscriptionType,
        };
        await ctx.service.subscription.updateSubscriptionV2(subscriptionData, { deviceId }, stripe);
        if (isTrial) {
          // 如果是试用，调用微服务api
          await ctx.service.common.saveUserTrialInfo({
            deviceId,
            originalTransactionId: session.id,
            transactionId: subscriptionId,
            productId,
            bundleId: 'stripe',
            purchaseTimeStamp: Date.now(),
            expireTimeStamp: subscriptionData.expireTimeStamp,
            realExpireTimeStamp: moment(subscriptionData.expireTimeStamp)
              .add(subscriptionData.period, 'months')
              .valueOf(),
            environment: app.config.env === 'prod' ? 'Production' : 'Sandbox',
            platform: 'web',
          });
          // free-trial调用发邮件接口，在session.customer_details中有用户在stripe支付时填写的邮箱，metadata中有deviceId
          const { email } = session.customer_details;
          if (!_.isEmpty(email)) {
            // 上报用户信息到EDM
            const reportUserResult = await ctx.curl(
              `${app.config.commonServiceConfig.host}/solvelyPubServer/v1/customerIO/push/user`,
              {
                method: 'POST',
                data: { deviceId, userInfo: { deviceId, email } },
                contentType: 'json',
                dataType: 'json',
              },
            );
            const SUCCESS_STATUS_CODES = [200, 202];
            if (SUCCESS_STATUS_CODES.includes(reportUserResult.data?.statusCode)) {
              payLogger.info(`上报用户信息到EDM成功: ${deviceId} ${email}`);
              // 上报事件到EDM
              const reportEventResult = await ctx.curl(
                `${app.config.commonServiceConfig.host}/solvelyPubServer/v1/customerIO/push/event`,
                {
                  method: 'POST',
                  data: {
                    deviceId,
                    eventName: 'last_day_of_free_trial',
                    extendInfo: { user_profile: { email } },
                  },
                  contentType: 'json',
                  dataType: 'json',
                },
              );
              if (SUCCESS_STATUS_CODES.includes(reportEventResult.data?.statusCode)) {
                payLogger.info(`上报事件到EDM成功: ${deviceId} ${email}`);
              } else {
                payLogger.error(`上报事件到EDM失败: ${deviceId} ${email}  ${reportEventResult}`);
              }
            } else {
              payLogger.error(`上报用户信息到EDM失败: ${deviceId} ${email} ${reportUserResult}`);
            }
          }
          // AIO开始试用通知
          this.checkAioOrderAndNotify({
            deviceId,
            isTrial: 1,
            period,
            amount: 0, // 开始试用不需要金额
            source: session.metadata.source,
            email: session.customer_details?.email,
            message: '开始试用',
          });
        } else {
          const amount = session.amount_total;
          const currency = session.currency;
          const realAmount = await ctx.service.common.getUsdAmount(currency, amount);
          ctx.service.point.firebasePoint(deviceId, 'Web_In_App_Purchase', {
            amount: realAmount,
            productId,
            transactionId: subscriptionId,
            type: 'subscription',
            isTrial: 0,
            subscriptionType,
          });
          ctx.service.point.adjustPoint(
            deviceId,
            'l4gik0',
            { revenue: realAmount, currency: 'USD' },
            productId,
          );
          ctx.service.point.adjustPoint(
            deviceId,
            'j1t1mh',
            { revenue: 0, currency: 'USD' },
            productId,
          );
          this.posthogPointWithPluginCheck(deviceId, 'Web_In_App_Purchase', {
            amount: realAmount,
            productId,
            transactionId: subscriptionId,
            type: 'subscription',
            isTrial: 0,
            subscriptionType,
          });
          this.trackAdjustForCollegeStudent(deviceId, productId);
          if (subscriptionType === 2 || subscriptionType === 3) {
            // writer / bundle 埋点上报
            ctx.service.point.firebasePoint(deviceId, 'Web_Writer_Subscribed_Success', {
              amount: realAmount,
              productId,
              transactionId: subscriptionId,
              type: 'subscription',
              isTrial: 0,
              subscriptionType,
            });
            ctx.service.point.adjustPoint(deviceId, 'jno88r', {}, productId);
            switch (subscriptionType) {
              case 2:
                // writer 订阅埋点上报，判断是月包还是年包
                if (period === 1) {
                  // 月包
                  ctx.service.point.firebasePoint(
                    deviceId,
                    'Web_Writer_Monthly_Subscribed_Success',
                    {
                      amount: realAmount,
                      productId,
                      transactionId: subscriptionId,
                      type: 'subscription',
                      isTrial: 0,
                      subscriptionType,
                    },
                  );
                  ctx.service.point.adjustPoint(deviceId, 'fvaunr', {}, productId);
                } else {
                  // 年包
                  ctx.service.point.firebasePoint(
                    deviceId,
                    'Web_Writer_Yearly_Subscribed_Success',
                    {
                      amount: realAmount,
                      productId,
                      transactionId: subscriptionId,
                      type: 'subscription',
                      isTrial: 0,
                      subscriptionType,
                    },
                  );
                  ctx.service.point.adjustPoint(deviceId, '51ms82', {}, productId);
                }
                break;
              case 3:
                // bundle 订阅埋点上报
                ctx.service.point.firebasePoint(
                  deviceId,
                  'Web_Writer_Bundle_Yearly_Subscribed_Success',
                  {
                    amount: realAmount,
                    productId,
                    transactionId: subscriptionId,
                    type: 'subscription',
                    isTrial: 0,
                    subscriptionType,
                  },
                );
                ctx.service.point.adjustPoint(deviceId, 'uwbbcj', {}, productId);
                break;
              default:
                break;
            }
          } else {
            // solver 埋点上报（直接订阅入金）
            ctx.service.point.firebasePoint(deviceId, 'Web_Subscribed_Success', {
              amount: realAmount,
              productId,
              transactionId: subscriptionId,
              type: 'subscription',
              isTrial: 0,
              subscriptionType,
            });
            ctx.service.point.adjustPoint(deviceId, 'hnu98p', {}, productId);
            ctx.service.point.createTrack(deviceId, 'bing', 'subscribe', {
              value: realAmount * 100,
              subscriptionType,
            });
            ctx.service.point.adjustPoint(deviceId, 'n9xv5f', {}, productId); // 订阅首次入金
            ctx.service.point.posthogPoint(deviceId, 'Web_Subscribed_Success', {
              amount: realAmount,
              productId,
              transactionId: subscriptionId,
              type: 'subscription',
              isTrial: 0,
              subscriptionType,
            });
            if (session.metadata.source === 'plugin') {
              ctx.service.point.firebasePoint(deviceId, 'Web_Plugin_Subscribed_Success', {
                amount: realAmount,
                productId,
                transactionId: subscriptionId,
                type: 'subscription',
                isTrial: 0,
                subscriptionType,
              });
              ctx.service.point.adjustPoint(deviceId, 'rwbqx0', {}, productId);
            }
            this.checkAioOrderAndNotify({
              deviceId,
              isTrial,
              period,
              amount: realAmount,
              source: session.metadata.source,
              email: session.customer_details?.email,
              message: '直接订阅',
            });
          }
        }
        payLogger.info(
          `订阅购买: ${deviceId} isFreeTrial:${isTrial} ${productId} ${subscriptionId} ${session.amount_total} ${session.currency}`,
        );
        // 检查并取消失败的订阅
        this.checkRenewFailedAndRefund(deviceId, subscriptionId);
      } else if (session.mode === 'payment') {
        const orderInfo = await ctx.service.order.find({ originalTransactionId: session.id });
        const deviceId = orderInfo.deviceId;
        const product = await ctx.service.product.productInfo({ productId: orderInfo.productId });
        const diamond = product.diamond;
        await ctx.service.order.update(session, diamond);
        // 发放钻石
        const quantity = orderInfo.quantity;
        await ctx.service.balance.updateDiamond(deviceId, { balance: diamond * quantity });
        const amount = session.amount_total;
        const currency = session.currency;
        const realAmount = await ctx.service.common.getUsdAmount(currency, amount);
        ctx.service.point.firebasePoint(deviceId, 'Web_In_App_Purchase', {
          amount: realAmount,
          productId: orderInfo.productId,
          type: 'payment',
        });
        ctx.service.point.adjustPoint(
          deviceId,
          'l4gik0',
          { revenue: realAmount, currency: 'USD' },
          orderInfo.productId,
        );
        ctx.service.point.adjustPoint(
          deviceId,
          'j1t1mh',
          { revenue: 0, currency: 'USD' },
          orderInfo.productId,
        );
        this.posthogPointWithPluginCheck(deviceId, 'Web_In_App_Purchase', {
          amount: realAmount,
          productId: orderInfo.productId,
          type: 'payment',
        });
        this.trackAdjustForCollegeStudent(deviceId, orderInfo.productId);
        payLogger.info(
          `钻石购买: ${deviceId} ${orderInfo.productId} ${orderInfo.quantity || 1} ${session.amount_total} ${session.currency}`,
        );
      } else {
        payLogger.error(`checkoutCompleted: 未知的支付: ${JSON.stringify(session)}`);
      }
      // 上传web server打点
      ctx.service.point.uploadServerPoint(deviceId, 'sub_success', {
        period,
        deviceId,
        freetrial: isTrial ? 'basic' : 'none',
        type: 'checkout',
      });
    } catch (e) {
      payLogger.error(`checkoutCompleted: ${JSON.stringify(session)} \n ${e}`);
      // 上传web server打点
      ctx.service.point.uploadServerPoint(deviceId, 'sub_fail', {
        period,
        deviceId,
        freetrial: isTrial ? 'basic' : 'none',
        errorCode: 500,
        errorMsg: `checkoutCompleted error: ${e.message}`,
      });
    }
  }
  // 会话过期
  async checkoutExpired(session) {
    const { ctx, app } = this;
    const orderLogger = app.getLogger('orderLogger');
    const deviceId = session.metadata.deviceId;

    if (!deviceId) {
      return;
    }
    const originalTransactionId = session.id;
    try {
      await ctx.model.Order.update(
        {
          status: 'expired',
        },
        {
          where: {
            deviceId,
            originalTransactionId,
          },
        },
      );
      const order = await ctx.model.Order.findOne({
        where: {
          deviceId,
          originalTransactionId,
        },
      });
      ctx.service.point.uploadServerPoint(deviceId, 'sub_checkout_expired', {
        period: order.period,
        deviceId,
        price: order.priceId,
        type: 'checkout',
      });
    } catch (e) {
      orderLogger.error(`checkoutExpired: ${JSON.stringify(session)} \n ${e}`);
    }
  }
  // 订阅支付成功
  /**
   *
   * @param {*} invoice
   * @param {*} version
   * @return
   * @description 下面三种情况会走到这里
   *  1. 试用转入金
   *  2. 直接购买
   *  3. 续订
   */
  async invoicePaymentSucceeded(invoice, version) {
    const { ctx, app } = this;
    const payLogger = app.getLogger('payLogger');
    try {
      const stripe = this.getStripe(version);
      const subscriptionId = invoice.subscription;
      const customerId = invoice.customer;
      this.paymentMethodUpdated(invoice, version);
      if (!subscriptionId || !customerId) {
        payLogger.error(`subscriptionId或customerId为空: ${JSON.stringify(invoice)}`);
        return;
      }
      let whereFlag = false;
      let deviceId = '';
      const isStripeElementsCreatedSubscription =
        invoice.billing_reason === 'subscription_create' &&
        invoice.subscription_details?.metadata?.createType === 'stripe_elements';
      // 通过customerId查找，可能会存在transactionId找不到的情况，如切换订阅后transactionId会变
      let orderInfo = await ctx.service.order.find({ customer: customerId });
      if (!_.isEmpty(orderInfo)) {
        deviceId = orderInfo.deviceId;
        whereFlag = true;
      }
      if (!whereFlag && isStripeElementsCreatedSubscription) {
        if (invoice.subscription_details?.metadata?.orderId) {
          orderInfo = await ctx.service.order.find({
            originalTransactionId: invoice.subscription_details.metadata.orderId,
          });
          deviceId = orderInfo.deviceId;
          whereFlag = true;
        }
      }

      if (!whereFlag) {
        return;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const isRenewal = invoice.billing_reason === 'subscription_cycle';
      const currentPeriodStart = subscription.current_period_start;
      const trialEnd = subscription.trial_end;
      // const isTrial = trialEnd && trialEnd <= invoice.lines.data[0].period.start && trialEnd >= currentPeriodStart;
      // const currentTime = Math.floor(Date.now() / 1000);
      // 试用转入金这一刻，这两个值是相等的（currentPeriodStart === trialEnd）
      // 试用转入金后，currentPeriodStart 会大于等于 trialEnd
      const isInTrialPeriod = trialEnd && currentPeriodStart < trialEnd;
      const productId = subscription.items.data[0].price.product;
      const period = this.getSubscriptionPeriod(subscription);
      const subscriptionType = orderInfo.subscriptionType;
      const subscriptionData = {
        deviceId,
        transactionId: subscriptionId,
        originalTransactionId: orderInfo.originalTransactionId,
        productId,
        refund: 0,
        regular: isInTrialPeriod ? 0 : 1,
        expired: 0,
        isTrialPeriod: isInTrialPeriod ? 1 : 0,
        period,
        purchaseTimeStamp: subscription.start_date * 1000,
        expireTimeStamp: subscription.current_period_end * 1000,
        subscriptionType,
        bundleId: 'stripe',
      };
      await ctx.service.subscription.updateSubscriptionV2(subscriptionData, { deviceId }, stripe);
      if (invoice.subscription_details?.metadata?.orderId) {
        await ctx.model.Order.update(
          {
            transactionId: subscriptionId,
            status: 'complete',
            regular: 1,
            invoice: invoice.id,
            customer: customerId,
            completedRaw: JSON.stringify(invoice),
          },
          {
            where: {
              originalTransactionId: invoice.subscription_details.metadata.orderId,
            },
          },
        );
      }
      // 使用stripe elements 创建的订阅，更新一下订单表（旧逻辑不需要处理）
      if (isStripeElementsCreatedSubscription && invoice.subscription_details?.metadata?.orderId) {
        // 弹窗支付埋点上报
        const amount = invoice.amount_paid;
        const currency = invoice.currency;
        const realAmount = await ctx.service.common.getUsdAmount(currency, amount);
        ctx.service.point.firebasePoint(deviceId, 'Web_In_App_Purchase', {
          amount: realAmount,
          productId,
          transactionId: subscriptionId,
          type: 'subscription',
          isTrial: 0,
        });
        ctx.service.point.firebasePoint(deviceId, 'Web_Subscribed_Success', {
          amount: realAmount,
          productId,
          transactionId: subscriptionId,
          type: 'subscription',
          isTrial: 0,
        });
        ctx.service.point.adjustPoint(
          deviceId,
          'l4gik0',
          { revenue: realAmount, currency: 'USD' },
          productId,
        );
        ctx.service.point.adjustPoint(
          deviceId,
          'j1t1mh',
          { revenue: 0, currency: 'USD' },
          productId,
        );
        ctx.service.point.adjustPoint(deviceId, 'hnu98p', {}, productId);
        ctx.service.point.createTrack(deviceId, 'bing', 'subscribe', { value: realAmount * 100 });
        ctx.service.point.adjustPoint(deviceId, 'n9xv5f', {}, productId); // 订阅首次入金
        ctx.service.point.uploadServerPoint(deviceId, 'sub_success', {
          period,
          deviceId,
          freetrial: 'refund',
          type: 'custom',
        });
        this.posthogPointWithPluginCheck(deviceId, 'Web_In_App_Purchase', {
          amount: realAmount,
          productId,
          transactionId: subscriptionId,
          type: 'subscription',
          isTrial: 0,
        });
        ctx.service.point.posthogPoint(deviceId, 'Web_Subscribed_Success', {
          amount: realAmount,
          productId,
          transactionId: subscriptionId,
          type: 'subscription',
          isTrial: 0,
        });
        this.trackAdjustForCollegeStudent(deviceId, productId);
      }

      if (isInTrialPeriod && invoice.billing_reason === 'subscription_create') {
        // 如果是试用，调用微服务api
        await ctx.service.common.saveUserTrialInfo({
          deviceId,
          originalTransactionId: orderInfo.originalTransactionId,
          transactionId: subscriptionId,
          productId,
          bundleId: 'stripe',
          purchaseTimeStamp: Date.now(),
          expireTimeStamp: subscriptionData.expireTimeStamp,
          realExpireTimeStamp: moment(subscriptionData.expireTimeStamp)
            .add(subscriptionData.period, 'months')
            .valueOf(),
          environment: app.config.env === 'prod' ? 'Production' : 'Sandbox',
          platform: 'web',
        });
        // free-trial调用发邮件接口，在session.customer_details中有用户在stripe支付时填写的邮箱，metadata中有deviceId
        const { email } = invoice.subscription_details?.metadata;
        if (!_.isEmpty(email)) {
          // 上报用户信息到EDM
          const reportUserResult = await ctx.curl(
            `${app.config.commonServiceConfig.host}/solvelyPubServer/v1/customerIO/push/user`,
            {
              method: 'POST',
              data: { deviceId, userInfo: { deviceId, email } },
              contentType: 'json',
              dataType: 'json',
            },
          );
          const SUCCESS_STATUS_CODES = [200, 202];
          if (SUCCESS_STATUS_CODES.includes(reportUserResult.data?.statusCode)) {
            payLogger.info(`上报用户信息到EDM成功: ${deviceId} ${email}`);
            // 上报事件到EDM
            const reportEventResult = await ctx.curl(
              `${app.config.commonServiceConfig.host}/solvelyPubServer/v1/customerIO/push/event`,
              {
                method: 'POST',
                data: {
                  deviceId,
                  eventName: 'last_day_of_free_trial',
                  extendInfo: { user_profile: { email } },
                },
                contentType: 'json',
                dataType: 'json',
              },
            );
            if (SUCCESS_STATUS_CODES.includes(reportEventResult.data?.statusCode)) {
              payLogger.info(`上报事件到EDM成功: ${deviceId} ${email}`);
            } else {
              payLogger.error(`上报事件到EDM失败: ${deviceId} ${email}  ${reportEventResult}`);
            }
          } else {
            payLogger.error(`上报用户信息到EDM失败: ${deviceId} ${email} ${reportUserResult}`);
          }
        }
        // 开始试用打点
        ctx.service.point.firebasePoint(deviceId, 'Web_Start_Free_Trial', {
          productId,
          transactionId: subscriptionId,
          type: 'subscription',
          isTrial: 1,
          subscriptionType,
        });
        ctx.service.point.adjustPoint(deviceId, 'acejpa', {}, productId);
        if (invoice.subscription_details?.metadata?.source === 'plugin') {
          ctx.service.point.firebasePoint(deviceId, 'Web_Plugin_Start_Free_Trial', {
            productId,
            transactionId: subscriptionId,
            type: 'subscription',
            isTrial: 1,
            subscriptionType,
          });
          ctx.service.point.adjustPoint(deviceId, 'moiul1', {}, productId);
        }
        ctx.service.point.firebasePoint(deviceId, 'Web_In_App_Purchase', {
          amount: 0,
          transactionId: subscriptionId,
          productId: subscriptionData.productId,
          subscriptionType: subscriptionData.subscriptionType,
        });
        ctx.service.point.adjustPoint(
          deviceId,
          'l4gik0',
          { revenue: 0, currency: 'USD' },
          subscriptionData.productId,
        );
        ctx.service.point.adjustPoint(
          deviceId,
          'j1t1mh',
          { revenue: 0, currency: 'USD' },
          subscriptionData.productId,
        );
        // 上传web server打点
        ctx.service.point.uploadServerPoint(deviceId, 'sub_success', {
          period,
          deviceId,
          freetrial: 'basic',
          type: 'custom',
        });
        this.posthogPointWithPluginCheck(deviceId, 'Web_In_App_Purchase', {
          amount: 0,
          transactionId: subscriptionId,
          productId: subscriptionData.productId,
          subscriptionType: subscriptionData.subscriptionType,
        });
        this.trackAdjustForCollegeStudent(deviceId, subscriptionData.productId);
      }
      // 检查并取消失败的订阅
      this.checkRenewFailedAndRefund(deviceId, subscriptionId);
      const amount = invoice.amount_paid;
      const currency = invoice.currency;
      const realAmount = await ctx.service.common.getUsdAmount(currency, amount);
      // 首次订阅成功
      const isFirstSubscription = invoice.period_start === invoice.lines.data[0].period.start;
      // 不是首次订阅成功, 下面两个埋点在sessionCompleted中已经上报
      if (amount > 0 && !isFirstSubscription) {
        // 不是试用入金上报入金埋点
        ctx.service.point.firebasePoint(deviceId, 'Web_In_App_Purchase', {
          amount: realAmount,
          transactionId: subscriptionId,
          productId: subscriptionData.productId,
          subscriptionType: subscriptionData.subscriptionType,
        });
        ctx.service.point.adjustPoint(
          deviceId,
          'l4gik0',
          { revenue: realAmount, currency: 'USD' },
          subscriptionData.productId,
        );
        ctx.service.point.adjustPoint(
          deviceId,
          'j1t1mh',
          { revenue: 0, currency: 'USD' },
          subscriptionData.productId,
        );
        this.posthogPointWithPluginCheck(deviceId, 'Web_In_App_Purchase', {
          amount: realAmount,
          transactionId: subscriptionId,
          productId: subscriptionData.productId,
          subscriptionType: subscriptionData.subscriptionType,
        });
        this.trackAdjustForCollegeStudent(deviceId, subscriptionData.productId);
      }
      if (isRenewal) {
        // 续订
        if (
          trialEnd &&
          trialEnd <= invoice.lines.data[0].period.start &&
          trialEnd >= currentPeriodStart
        ) {
          // 试用期后的第一次扣款
          ctx.service.point.firebasePoint(deviceId, 'Web_Subscribed_Success', {
            amount: realAmount,
            productId,
            transactionId: subscriptionId,
            type: 'subscription',
            isTrial: 1,
            subscriptionType: subscriptionData.subscriptionType,
          });
          ctx.service.point.adjustPoint(deviceId, 'hnu98p', {}, productId);
          ctx.service.point.firebasePoint(deviceId, 'Web_Subscription_Convert', {
            amount: realAmount,
            productId,
            transactionId: subscriptionId,
            type: 'subscription',
            isTrial: 1,
            subscriptionType: subscriptionData.subscriptionType,
          });
          ctx.service.point.adjustPoint(deviceId, '5v0wd5', {}, subscriptionData.productId);
          ctx.service.point.adjustPoint(deviceId, 'n9xv5f', {}, productId); // 订阅首次入金
          if (invoice.subscription_details?.metadata?.source === 'plugin') {
            ctx.service.point.firebasePoint(deviceId, 'Web_Plugin_Subscribed_Success', {
              amount: realAmount,
              productId,
              transactionId: subscriptionId,
              type: 'subscription',
              isTrial: 1,
              subscriptionType: subscriptionData.subscriptionType,
            });
            ctx.service.point.firebasePoint(deviceId, 'Web_Plugin_Subscription_Convert', {
              amount: realAmount,
              productId,
              transactionId: subscriptionId,
              type: 'subscription',
              isTrial: 1,
              subscriptionType: subscriptionData.subscriptionType,
            });
            ctx.service.point.adjustPoint(deviceId, 'rwbqx0', {}, productId);
            ctx.service.point.adjustPoint(deviceId, 'h1p52u', {}, productId);
          }
          ctx.service.point.posthogPoint(deviceId, 'Web_Subscribed_Success', {
            amount: realAmount,
            productId,
            transactionId: subscriptionId,
            type: 'subscription',
            isTrial: 1,
            subscriptionType: subscriptionData.subscriptionType,
          });
          this.checkAioOrderAndNotify({
            deviceId,
            isTrial: 1,
            period,
            amount: realAmount,
            source: orderInfo.source,
            email: invoice.customer_email,
            message: '试用转入金',
          });
        } else {
          // 其他续订
          const renewData = {
            transactionId: subscriptionId,
            productId,
            purchaseTimeStamp: moment().valueOf(),
            expireTimeStamp: subscription.current_period_end * 1000,
            transactionPayload: JSON.stringify(invoice),
          };
          await ctx.model.SubscriptionRenew.create(renewData);
          if (subscriptionType === 2 || subscriptionType === 3) {
            // writer / bundle 续订埋点上报
            ctx.service.point.firebasePoint(deviceId, 'Web_Writer_Subscription_Renew', {
              amount: realAmount,
              productId,
              transactionId: subscriptionId,
              type: 'subscription',
              subscriptionType: subscriptionData.subscriptionType,
            });
            ctx.service.point.adjustPoint(deviceId, 'i5vo93', {}, subscriptionData.productId);
          } else {
            // solver 续订埋点上报
            ctx.service.point.firebasePoint(deviceId, 'Web_Subscription_Renew', {
              amount: realAmount,
              productId,
              transactionId: subscriptionId,
              type: 'subscription',
              subscriptionType: subscriptionData.subscriptionType,
            });
            ctx.service.point.adjustPoint(deviceId, 'al95t9', {}, subscriptionData.productId);
            ctx.service.point.posthogPoint(deviceId, 'Web_Subscription_Renew', {
              amount: realAmount,
              productId,
              transactionId: subscriptionId,
              type: 'subscription',
              subscriptionType: subscriptionData.subscriptionType,
            });
            this.checkAioOrderAndNotify({
              deviceId,
              isTrial: 0,
              period,
              amount: realAmount,
              source: orderInfo.source,
              email: invoice.customer_email,
              message: '续订',
            });
          }
        }
      }
    } catch (e) {
      payLogger.error(`invoicePaymentSucceeded: ${JSON.stringify(invoice)} \n ${e}`);
    }
  }
  // 订阅付款失败
  async invoicePaymentFailed(invoice, version) {
    const { ctx, app } = this;
    const payLogger = app.getLogger('payLogger');
    try {
      const subscriptionId = invoice.subscription;

      if (!subscriptionId) {
        return;
      }
      let subscriptionType;
      const orderInfo = await ctx.service.order.find({ customer: invoice.customer });
      if (!_.isEmpty(orderInfo)) {
        subscriptionType = orderInfo.subscriptionType;
      }
      if (!subscriptionType) {
        const subscription = await ctx.service.subscription.find({ transactionId: subscriptionId });
        if (!_.isEmpty(subscription)) {
          subscriptionType = subscription.subscriptionType;
        }
      }

      if (!subscriptionType) {
        return;
      }
      const stripe = this.getStripe(version);
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const productId = subscription.items.data[0].price.product;
      const period = this.getSubscriptionPeriod(subscription);
      // 获取订阅的开始和结束时间
      const subscriptionData = {
        productId,
        bundleId: 'stripe',
        refund: 0,
        regular: 0,
        expired: 0,
        isTrialPeriod: 0,
        isCancel: 0,
        period,
        purchaseTimeStamp: Date.now(),
        expireTimeStamp: subscription.current_period_end * 1000,
        subscriptionType,
      };
      await ctx.service.subscription.updateSubscriptionV2(
        subscriptionData,
        { transactionId: subscriptionId },
        stripe,
      );
      ctx.service.point.firebasePoint('', 'Web_Subscription_Pay_Fail', {
        productId,
        transactionId: subscriptionId,
        type: 'subscription',
        subscriptionType,
      });
      ctx.service.point.uploadServerPoint(orderInfo.deviceId, 'sub_fail', {
        period,
        deviceId: orderInfo.deviceId,
        freetrial: '',
        price: '',
        errorMsg: `订阅支付失败: ${subscriptionId} ${productId} ${period}`,
      });
      payLogger.info(`订阅支付失败: ${subscriptionId} ${productId} ${period}`);
    } catch (e) {
      payLogger.error(`invoicePaymentFailed: ${JSON.stringify(invoice)} \n ${e}`);
    }
  }
  // 订阅更新
  async customerSubscriptionUpdated(updatedSubscription, version) {
    const { ctx, app } = this;
    const payLogger = app.getLogger('payLogger');
    try {
      const orderInfo = await ctx.service.order.find({ customer: updatedSubscription.customer });
      if (_.isEmpty(orderInfo)) {
        payLogger.info(`新购买订阅更新: checkout session正在写: ${updatedSubscription.id}`);
        return;
      }
      const stripe = this.getStripe(version);
      // 如果是需要升级的套餐，则更新套餐
      const { upgradePriceId, status } = updatedSubscription.metadata;
      if (
        updatedSubscription.status === 'active' &&
        status === 'regular' &&
        upgradePriceId &&
        updatedSubscription.latest_invoice // 确保有发票
      ) {
        const priceId = JSON.parse(upgradePriceId)[0];
        // 更新订阅的价格
        await stripe.subscriptions.update(updatedSubscription.id, {
          proration_behavior: 'none', // 不进行按比例计费
          cancel_at_period_end: false,
          items: [
            {
              id: updatedSubscription.items.data[0].id,
              price: priceId, // 替换成新的价格ID
            },
          ],
          metadata: {
            ...updatedSubscription.metadata,
            upgradePriceId: '',
            priceId,
            status: 'exchange_price',
          },
          payment_behavior: 'default_incomplete',
        });
      }
      // 在免费试用结束之后取消入金之后的自动续订
      // 测试环境不验证过期时间
      const isProd = app.config.env === 'prod';
      if (
        updatedSubscription.status === 'active' &&
        status &&
        status === 'start_free_trail' &&
        (isProd
          ? updatedSubscription.trial_end &&
            updatedSubscription.trial_end < Math.floor(Date.now() / 1000)
          : true) && // 已过试用期
        updatedSubscription.latest_invoice // 确保有发票
      ) {
        // 如果更新订阅失败，则等待5秒之后进行重试，重试3次
        let retryCount = 0;
        while (retryCount < 3) {
          try {
            // 设置订阅在当前付费周期结束时取消
            await stripe.subscriptions.update(updatedSubscription.id, {
              cancel_at_period_end: true,
              promotion_code: null, // 移除促销码
              metadata: {
                ...updatedSubscription.metadata,
                status: 'regular',
              },
            });
            payLogger.info(
              `升级用户订阅价格成功: ${JSON.stringify(updatedSubscription)} \n ${JSON.stringify(
                updatedSubscription.metadata,
              )}`,
            );
            break;
          } catch (error) {
            payLogger.error(
              `升级用户订阅价格失败,进行重试: ${JSON.stringify(updatedSubscription)} \n error: ${error}`,
            );
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      }
      // billing_cycle_anchor 是订阅的计费周期锚点时间戳，用于确定下一个计费周期的开始时间
      // 到期自动取消
      const isAutoCancel = updatedSubscription.cancel_at_period_end;
      // 是否试用期
      const isTrial = updatedSubscription.status === 'trialing';
      // 试用期间取消
      // const isTrialCanceledInUpdate = isTrial && isAutoCancel;
      // if (isTrialCanceledInUpdate) {
      // await ctx.service.common.hasUserTriedProduct(subscriptionItem.deviceId);
      // }
      const period = this.getSubscriptionPeriod(updatedSubscription);
      const updateData = {
        subscriptionId: updatedSubscription.id,
        productId: updatedSubscription.items.data[0].price.product,
        isTrialPeriod: isTrial ? 1 : 0,
        isCancel: isAutoCancel ? 1 : 0,
        period,
        purchaseTimeStamp: updatedSubscription.start_date * 1000,
        expireTimeStamp: updatedSubscription.current_period_end * 1000,
        subscriptionType: orderInfo.subscriptionType,
      };
      await ctx.service.subscription.updateSubscriptionV2(
        updateData,
        { transactionId: updatedSubscription.id },
        stripe,
      );
      // 处理自动恢复暂停收款
      if (!updatedSubscription.pause_collection) {
        const pauseSubscription = await ctx.service.common.getPauseSubscriptionRecord(
          updatedSubscription.id,
          1,
          1001,
        );
        if (!_.isEmpty(pauseSubscription)) {
          // 订阅恢复暂停收款，自动触发
          try {
            await ctx.service.subscription.updateSubscriptionPauseInfo(
              { updateData: { status: 1003 }, type: 'update' },
              { transactionId: updatedSubscription.id, preStatus: 1001 },
            );
            // 使用 setImmediate 避免阻塞主线程
            setImmediate(async () => {
              try {
                /**
                 * 延迟1分钟执行
                 * 1. 查询订阅的最后一个账单
                 * 2. 如果最后一个账单是废弃账单，立刻开单
                 * 3. 上报埋点
                 * 如果不延迟，则无法获取到最新的账单
                 */
                await new Promise((resolve) => setTimeout(resolve, 1000 * 60));

                // 查询订阅的最后一个账单
                const invoices = await stripe.invoices.list({
                  subscription: updatedSubscription.id,
                  limit: 1,
                });

                // 如果最后一个账单是废弃账单，立刻开单
                if (invoices.data[0].status === 'void') {
                  await stripe.subscriptions.update(updatedSubscription.id, {
                    billing_cycle_anchor: 'now',
                    proration_behavior: 'none',
                  });
                }

                ctx.service.point.firebasePoint(
                  orderInfo.deviceId,
                  'Web_PauseSubscription_AutoResume',
                  {
                    transactionId: updatedSubscription.id,
                    productId: updateData.productId,
                    period: updateData.period,
                  },
                );
              } catch (err) {
                payLogger.error('延迟执行订阅更新失败:', err);
              }
            });
          } catch (e) {
            payLogger.error(`恢复暂停收款失败: ${e}`);
          }
        }
      }
    } catch (e) {
      payLogger.error(
        `customerSubscriptionUpdated: ${JSON.stringify(updatedSubscription)} \n ${e}`,
      );
    }
  }
  // 订阅过期
  async customerSubscriptionDeleted(deletedSubscription, version) {
    const { ctx } = this;
    try {
      let orderInfo = await ctx.service.order.find({ transactionId: deletedSubscription.id });
      if (_.isEmpty(orderInfo)) {
        // 如果在order表中找不到订阅信息，则到subscription表中查找
        const subscription = await ctx.service.subscription.find({
          transactionId: deletedSubscription.id,
        });
        if (_.isEmpty(subscription)) {
          return;
        }
        orderInfo = subscription;
      }
      const data = {
        subscriptionId: deletedSubscription.id,
        productId: deletedSubscription.items.data[0].price.product,
        isTrialPeriod: 0,
        refund: 0,
        regular: 0,
        expired: 1,
        isCancel: 1,
        expireTimeStamp: Date.now(),
        subscriptionType: orderInfo.subscriptionType,
      };
      const stripe = this.getStripe(version);
      await ctx.service.subscription.updateSubscriptionV2(
        data,
        { transactionId: deletedSubscription.id },
        stripe,
      );

      const subscription = await ctx.service.subscription.find({
        transactionId: deletedSubscription.id,
      });
      if (_.isEmpty(subscription)) {
        return;
      }
      // 对暂停收款的订阅数据进行处理
      const pauseList = await ctx.service.common.getPauseSubscriptionRecord(
        deletedSubscription.id,
        1,
        1001,
      );
      if (!_.isEmpty(pauseList)) {
        await ctx.service.subscription.updateSubscriptionPauseInfo(
          { updateData: { status: 1003 }, type: 'update' },
          { transactionId: deletedSubscription.id, preStatus: 1001 },
        );
      }
      // 切换订阅计划的处理
      const deviceId = subscription.deviceId;
      const nextSubscription = await ctx.service.subscription.findNextPendingPlan(deviceId);
      if (_.isEmpty(nextSubscription) || !nextSubscription.priceId) {
        return;
      }
      await ctx.service.subscription.createNewSubscription(
        deletedSubscription.customer,
        nextSubscription.priceId,
        version,
      );
      await ctx.service.subscription.updateSubscriptionWebManage(
        {
          status: 'active',
        },
        { deviceId, status: 'pending' },
      );
    } catch (e) {
      ctx.logger.error(
        `customerSubscriptionDeleted: ${JSON.stringify(deletedSubscription)} \n ${e}`,
      );
    }
  }
  // 退款
  async chargeRefunded(charge) {
    const { ctx, app } = this;
    try {
      const amount = charge.amount_refunded;
      const currency = charge.currency;
      const customer = charge.customer;
      const orderInfo = await ctx.service.order.find({
        customer,
        status: 'complete',
        mode: 'subscription',
      });
      if (_.isEmpty(orderInfo)) {
        return;
      }
      const deviceId = orderInfo?.deviceId;
      const realAmount = await ctx.service.common.getUsdAmount(currency, amount);
      ctx.service.point.firebasePoint(deviceId, 'Web_Subscription_Refund', {
        amount: realAmount,
        currency,
        customer,
      });
      ctx.service.point.firebasePoint(deviceId, 'Web_Charge_Refunded', {
        amount: realAmount,
        currency,
        customer,
      });
      if (deviceId) {
        ctx.service.point.adjustPoint(deviceId, 'rgryp6', {}, '');
      } else {
        const payLogger = app.getLogger('payLogger');
        payLogger.error(`chargeRefunded: 未找到deviceId ${customer}`);
      }
      ctx.service.point.posthogPoint(deviceId, 'Web_Subscription_Refund', {
        amount: realAmount,
        currency,
        customer,
      });
    } catch (e) {
      ctx.logger.error(`chargeRefunded: ${JSON.stringify(charge)} \n ${e}`);
    }
  }
  // 使用优惠券
  async customerDiscountCreated(discount, version) {
    const { ctx } = this;
    try {
      const { id: discountId, coupon, customer, promotion_code, subscription } = discount;
      const {
        id: couponId,
        name: couponName,
        amount_off,
        currency,
        duration,
        percent_off,
      } = coupon || {};
      const data = {
        discountId,
        couponId,
        couponName,
        amountOff: amount_off,
        currency,
        duration,
        percentOff: percent_off,
        promotionCodeId: promotion_code,
        customer,
        subscription,
      };
      const stripe = this.getStripe(version);
      const promotionCodeInfo = await stripe.promotionCodes.retrieve(promotion_code);
      if (!_.isEmpty(promotionCodeInfo)) {
        data.code = promotionCodeInfo.code;
      }
      const orderInfo = await ctx.service.order.find({
        customer,
        status: 'complete',
        mode: 'subscription',
        transactionId: subscription,
      });
      if (_.isEmpty(orderInfo)) {
        return;
      }
      const deviceId = orderInfo.deviceId;
      await ctx.model.CustomerDiscountRecord.create({ deviceId, ...data });
      ctx.service.point.firebasePoint(deviceId, 'Web_Use_Promotion_Code', data);
    } catch (e) {
      ctx.logger.error(`customerDiscountCreated: ${JSON.stringify(discount)} \n ${e}`);
    }
  }
  // 入金记录到数据库
  async chargeSuccessRecord(charge, version) {
    const { ctx, app } = this;
    const payRecordLogger = app.getLogger('payRecordLogger');
    try {
      const { id, amount, currency, receipt_url } = charge;
      const realAmount = await ctx.service.common.getUsdAmount(currency, amount);
      const stripe = this.getStripe(version);
      const data = {
        deviceId: '',
        productId: '',
        amount: realAmount,
        currency,
        quantity: 1,
        receiptUrl: receipt_url,
        eventId: id,
        orderId: '',
        subscriptionId: '',
        source: 'stripe',
        version,
      };

      // 检查是否为订阅支付
      if (charge.invoice) {
        data.mode = 'subscription';
        // 获取相应的发票对象
        const invoice = await stripe.invoices.retrieve(charge.invoice);
        // 获取订阅对象
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        data.subscriptionId = subscription.id;
        const orderInfo = await ctx.service.order.find({ customer: subscription.customer });
        if (!_.isEmpty(orderInfo)) {
          data.deviceId = orderInfo.deviceId;
          data.productId = orderInfo.productId;
          data.quantity = orderInfo.quantity || 1;
          data.orderId = orderInfo.originalTransactionId;
        } else {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: charge.payment_intent,
          });

          if (sessions.data.length === 0 || !sessions.data[0]?.metadata?.deviceId) {
            return;
          }

          if (sessions.data.length > 0) {
            const session = sessions.data[0];
            data.orderId = session.id;
            data.deviceId = session.metadata.deviceId;
            data.quantity = 1;
            data.productId = session.metadata.productId;
          }

          if (!data.deviceId && invoice.subscription_details?.metadata?.orderId) {
            const orderId = invoice.subscription_details.metadata.orderId;
            const orderInfo = await ctx.service.order.find({ originalTransactionId: orderId });
            if (!_.isEmpty(orderInfo)) {
              data.deviceId = orderInfo.deviceId;
              data.productId = orderInfo.productId;
              data.quantity = orderInfo.quantity || 1;
              data.orderId = orderId;
            }
          }
        }
        const trialEnd = subscription.trial_end;
        const isTrialFirst =
          trialEnd &&
          trialEnd <= invoice.lines.data[0].period.start &&
          trialEnd >= subscription.current_period_start;
        // 判断支付类型
        switch (invoice.billing_reason) {
          case 'subscription_create':
            // 订阅首次入金
            data.type = 'first';
            break;
          case 'subscription_cycle':
            // 续订入金
            if (isTrialFirst) {
              // 试用首次入金
              data.type = 'trial_first';
            } else {
              data.type = 'renew';
            }
            break;
          case 'subscription_update':
            // 订阅更新
            data.type = 'update';
            break;
          default:
            // 其他类型的入金
            data.type = 'other';
            break;
        }
      } else {
        // 钻石入金
        data.mode = 'payment';
        data.type = 'payment';
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: charge.payment_intent,
        });

        if (sessions.data.length > 0) {
          const session = sessions.data[0];
          data.orderId = session.id;
          data.deviceId = session.metadata.deviceId;
          // 获取 line_items
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          if (lineItems.data.length > 0) {
            const lineItem = lineItems.data[0];
            data.productId = lineItem.price.product;
            data.quantity = lineItem.quantity || 1;
          }
        }
      }
      await ctx.model.PaySuccessRecord.create(data);
      ctx.service.point.firebasePoint(data.deviceId, 'Web_Charge_Success', {
        amount: realAmount,
        currency,
      });
      this.posthogPointWithPluginCheck(data.deviceId, 'Web_Charge_Success', {
        amount: realAmount,
        currency,
      });
    } catch (e) {
      payRecordLogger.error(`入金记录失败: ${JSON.stringify(charge)}\n${e}`);
    }
  }
  // 校验支付方式和已有订阅是否一致
  async paymentMethodUpdated(invoice, version) {
    const { app } = this;
    const payLogger = app.getLogger('payLogger');
    try {
      const { subscription, payment_intent } = invoice;

      if (!subscription || !payment_intent) {
        return;
      }
      const stripe = this.getStripe(version);
      const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
      const paymentMethod = paymentIntent.payment_method;
      const subscriptionData = await stripe.subscriptions.retrieve(subscription);
      const defaultPaymentMethod = subscriptionData.default_payment_method;
      if (paymentMethod !== defaultPaymentMethod) {
        await stripe.subscriptions.update(subscription, {
          default_payment_method: paymentMethod,
        });
      }
    } catch (e) {
      payLogger.error(`paymentMethodUpdated: ${JSON.stringify(invoice)} \n ${e}`);
    }
  }
  // 消耗品支付成功
  async paymentIntentSucceeded(invoice) {
    const { ctx, app } = this;
    const orderLogger = app.getLogger('orderLogger');
    try {
      if (_.isEmpty(invoice.metadata)) {
        return;
      }
      const { amount } = invoice;
      // {
      //   "createType": "stripe_elements",
      //   "deviceId": "7izvszCRcUUsdFYiTNbZemWobvY2",
      //   "orderId": "cs_local_ZDc4NWQzYWMtMmE5My00N2I5LTk1OTktY2EwY2E2YmNjNmUy_1735897784892",
      //   "priceId": "price_1Qbcfz1n1QMvNfT8wR5vWHBe",
      //   "promotionCodeId": "BCMXDKL5",
      //   "subOrderId": "cs_local_ZTI0NzhkZTgtOGM1NC00MzdlLWEwOWItM2UyNzBjZTRiNzRi_1735897784649",
      //   "subscriptionType": "combined_payment_intent",
      //   "upgradePriceId": "price_1Qbcfz1n1QMvNfT8wR5vWHBe"
      // }
      const { orderId, subscriptionType } = invoice.metadata;
      const orderInfo = await ctx.model.Order.findOne({
        raw: true,
        where: {
          originalTransactionId: orderId,
        },
      });
      if (!orderInfo) {
        orderLogger.error(`paymentIntentSucceeded: 未找到orderId ${orderId}, 等待重试`);
        return;
      }
      if (subscriptionType === 'combined_payment_intent') {
        // 更新消耗品订单状态
        await ctx.model.Order.update(
          {
            status: 'complete',
            amount,
            completedRaw: JSON.stringify(invoice),
            regular: 1,
          },
          {
            where: {
              originalTransactionId: orderId,
            },
          },
        );
        await ctx.service.subscription.createSubByWebhook(invoice);
        orderLogger.info(`paymentIntentSucceeded: 消耗品支付成功: ${orderId}`);
        return;
      }
    } catch (e) {
      orderLogger.error(`paymentIntentSucceeded: 消耗品支付失败: ${e}`);
      throw new Error(e);
    }
  }

  /**
   * 一次性消耗品退款
   * @param {object} invoice 发票
   * @param {object} metadata 元数据
   * @param {string} orderId 订单ID
   */
  async paymentRefund(invoice, metadata, orderId) {
    const { ctx, app } = this;
    const subscriptionLogger = app.getLogger('subscriptionLogger');
    const stripe = ctx.stripeV2;
    // 创建退款
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // 先更新 mysql 在退款，确保退款埋点正常
        // 记录退款信息到订单
        await ctx.model.Order.update(
          {
            refund: 1,
          },
          {
            where: {
              originalTransactionId: orderId,
            },
          },
        );
        const refund = await stripe.refunds.create({
          charge: invoice.latest_charge,
          metadata,
        });
        subscriptionLogger.info(`[createSubByWebhook] 退款成功: ${JSON.stringify(refund)}`);
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          subscriptionLogger.error(`[createSubByWebhook] 退款失败(重试${maxRetries}次): ${error}`);
          // 继续创建订阅,不影响主流程
        } else {
          subscriptionLogger.warn(`[createSubByWebhook] 退款失败,重试第${retryCount}次: ${error}`);
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待1秒后重试
        }
      }
    }
  }
  /**
   * 检查并取消失败的订阅
   * @param {string} deviceId 设备ID
   * @param {string} currentTransactionId 当前交易ID (可选，用于排除当前正在处理的订阅)
   */
  async checkRenewFailedAndRefund(deviceId, currentTransactionId = null) {
    const { ctx, app } = this;
    const subscriptionLogger = app.getLogger('subscriptionLogger');
    const stripe = this.getStripe(2); // 使用 V2 版本的 Stripe API
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // 查询用户的所有订阅订单
      const userOrderInfo = await ctx.model.Order.findAll({
        where: {
          deviceId,
          status: 'complete',
          mode: 'subscription',
          subscriptionType: 1,
        },
      });

      if (_.isEmpty(userOrderInfo)) {
        subscriptionLogger.info('用户没有订阅记录');
        return;
      }

      // 过滤掉当前正在处理的订阅（如果有）
      const filteredOrders = currentTransactionId
        ? userOrderInfo.filter((item) => item.transactionId !== currentTransactionId)
        : userOrderInfo;

      if (filteredOrders.length === 0) {
        subscriptionLogger.info('没有需要检查的订阅');
        return;
      }

      // 并行获取所有订阅信息
      const promises = filteredOrders.map((item) =>
        stripe.subscriptions.retrieve(item.transactionId).catch((err) => {
          subscriptionLogger.error(`获取订阅信息失败: ${item.transactionId}, 错误: ${err.message}`);
          return null; // 返回 null 以便后续过滤
        }),
      );

      const subscriptionInfos = (await Promise.all(promises)).filter(Boolean);
      let canceledCount = 0;
      let retryCount = 0;
      const maxRetries = 3;
      // 处理每个订阅
      for (const subscription of subscriptionInfos) {
        // 检查是否是需要取消的状态
        if (
          subscription.status === 'incomplete_expired' ||
          subscription.status === 'past_due' ||
          subscription.status === 'unpaid'
        ) {
          // 添加重试机制
          let cancelSuccess = false;

          while (retryCount < maxRetries && !cancelSuccess) {
            try {
              // 记录取消前的状态
              const statusBeforeCancel = subscription.status;

              // 取消订阅
              await stripe.subscriptions.cancel(subscription.id);
              cancelSuccess = true;
              canceledCount++;

              // 记录日志
              subscriptionLogger.info(
                `成功取消失败状态的订阅: deviceId: ${deviceId}, transactionId: ${subscription.id}, 原状态: ${statusBeforeCancel}`,
              );

              // 发送通知给用户
              ctx.service.point.firebasePoint(
                deviceId,
                'Web_Subscription_Canceled_Due_To_Payment_Failure',
                {
                  transactionId: subscription.id,
                  previousStatus: statusBeforeCancel,
                  productId: subscription.items.data[0].price.product,
                },
              );
            } catch (error) {
              retryCount++;
              if (retryCount === maxRetries) {
                subscriptionLogger.error(
                  `取消订阅失败(重试${maxRetries}次): deviceId: ${deviceId}, transactionId: ${subscription.id}, 错误: ${error.message}`,
                );
              } else {
                subscriptionLogger.warn(
                  `取消订阅失败,重试第${retryCount}次: deviceId: ${deviceId}, transactionId: ${subscription.id}, 错误: ${error.message}`,
                );
                // 等待一段时间后重试
                await sleep(1000 * retryCount);
              }
            }
          }
        }
      }

      // 返回处理结果
      subscriptionLogger.info(
        `检查了 ${subscriptionInfos.length} 个订阅，取消了 ${canceledCount} 个失败状态的订阅`,
      );
    } catch (error) {
      subscriptionLogger.error(`checkRenewFailedAndRefund 执行失败: ${error.message}`);
      return;
    }
  }
  /**
   * 针对大学生的 Adjust 入金埋点
   * @param {string} deviceId 用户设备 ID
   * @param {string} productId 关联产品 ID
   */
  async trackAdjustForCollegeStudent(deviceId, productId = '') {
    const { ctx, app } = this;
    const pointLogger = app.getLogger('pointLogger');

    try {
      if (!deviceId) {
        return;
      }

      const userInfo = await ctx.model.UserInfo.findOne({
        raw: true,
        attributes: ['grade', 'source'],
        where: { deviceId },
      });

      if (!userInfo) {
        return;
      }

      const grade = (userInfo.grade || '').toLowerCase();
      if (grade !== 'university' && grade !== 'communitycollege') {
        return;
      }

      const source = (userInfo.source || '').toLowerCase();
      let eventToken = '';

      if (source === 'sem' || source === 'web') {
        eventToken = '9vmjcu';
      } else if (source === 'plugin_sem' || source === 'plugin') {
        eventToken = '1eiaxc';
      }

      if (!eventToken) {
        return;
      }

      await ctx.service.point.adjustPoint(deviceId, eventToken, {}, productId);
    } catch (error) {
      pointLogger.error(`trackAdjustForCollegeStudent: ${deviceId} ${productId} ${error}`);
    }
  }
  /**
   * 处理实验价格策略
   * @param {string} deviceId - 设备ID
   * @param {number} period - 周期
   */
  async handleExperimentPrice(deviceId, period) {
    const { ctx } = this;

    try {
      // 获取实验分组
      const experiments = await ctx.service.abtest.getUserExperiments(deviceId);
      // 默认价格标签
      let priceTag = 'control';
      // 查找匹配的实验策略
      const tagItem = experimentStrategies.find(
        (item) =>
          item.period === period &&
          item.experiments.some((experiment) => experiments.includes(experiment)),
      );
      if (tagItem) {
        priceTag = tagItem.priceTag;
      }
      const productInfo = await ctx.model.ProductWeb.findOne({
        raw: true,
        where: {
          productClass: priceTag === 'control' ? 'unlimited_combined_annual' : 'unlimited_plugin',
          test: priceTag,
          period,
          language: 'en',
        },
      });
      if (productInfo) {
        return productInfo;
      }
      throw new Error('获取实验价格失败');
    } catch (error) {
      this.ctx.logger.error('获取实验价格失败:', error);
    }
  }

  /**
   * 检查是aio的订单，并发送飞书通知
   * @param {object} payload 订单信息
   */
  async checkAioOrderAndNotify(payload) {
    const { ctx } = this;
    const { source, deviceId, period, amount, email, message } = payload;

    if (!source?.startsWith('aio')) {
      // 非aio订单，直接返回
      return;
    }

    try {
      const periodMap = {
        1: '月包',
        7: '周包',
        12: '年包',
      };
      const periodName = periodMap[period] || '未知包';

      // 构建飞书通知数据
      const notificationData = {
        deviceId,
        email: email || '未提供',
        subscriptionPeriod: periodName,
        paymentType: message, // 直接订阅/续订/试用转入金
        paymentEmail: email || '未提供',
        paymentAmount: amount,
        paymentTime: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
        source,
      };

      // 发送飞书通知
      await ctx.service.feishu.sendAioSubscriptionNotification(notificationData);

      ctx.logger.info(
        `AIO订阅飞书通知已发送: deviceId=${deviceId}, type=${message}, amount=${amount}`,
      );
    } catch (error) {
      ctx.logger.error(`AIO订阅飞书通知发送失败: deviceId=${deviceId}, error=${error.message}`);
    }
  }

  /**
   * PostHog 事件上报（支持插件用户检测）
   * 如果用户是插件新用户，则使用 pluginUuid 代替 deviceId 进行上报
   * 注意：此方法设计为异步非阻塞，调用时无需 await
   * @param {string} deviceId - 用户设备ID
   * @param {string} eventName - 事件名称
   * @param {object} eventData - 事件数据
   */
  async posthogPointWithPluginCheck(deviceId, eventName, eventData) {
    const { ctx } = this;

    try {
      if (!deviceId) {
        ctx.service.point.posthogPoint(deviceId, eventName, eventData);
        return;
      }

      let reportDeviceId = deviceId;

      // 查询 pluginUserInfo 表，查找该用户的插件信息
      const pluginUserInfo = await ctx.model.PluginUserInfo.findOne({
        where: { deviceId },
        order: [['updateTime', 'DESC']], // 按更新时间降序，取最新的一条
        raw: true,
      });

      // 如果找到记录且是新用户，使用 pluginUuid 代替 deviceId
      if (pluginUserInfo && pluginUserInfo.isNewUser === 1) {
        reportDeviceId = pluginUserInfo.pluginUuid;
        ctx.logger.info(
          `[PostHog Plugin User] 插件新用户事件上报 - event: ${eventName}, originalDeviceId: ${deviceId}, pluginUuid: ${reportDeviceId}`,
        );
      }

      // 执行 PostHog 事件上报
      ctx.service.point.posthogPoint(reportDeviceId, eventName, eventData);
    } catch (error) {
      ctx.logger.error(
        `[PostHog Plugin User] 插件用户检测失败 - deviceId: ${deviceId}, event: ${eventName}, error: ${error.message}`,
      );
      // 发生错误时使用原 deviceId 上报，不影响主流程
      ctx.service.point.posthogPoint(deviceId, eventName, eventData);
    }
  }
}

module.exports = Stripe;
