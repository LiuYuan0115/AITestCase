const { Service } = require('egg');
const _ = require('lodash');
const Decimal = require('decimal.js');
const { Op } = require('sequelize');
const { experimentStrategies, getDiscountCode } = require('../../config/price');

const PERIOD_MAP = {
  oneMonth: 1,
  sixMonth: 6,
  oneYear: 12,
  oneWeek: 7,
};

class Product extends Service {
  async list() {
    const { ctx, app } = this;
    const deviceId = ctx.user.uid;
    const stripeConfig = app.config.stripeConfig;
    const result = {
      stripePublicKey: stripeConfig.publicKeyV2,
      subscription: {},
    };
    const language = ctx.request.headers['solvely-language'] || 'en';
    const allProducts = await ctx.model.ProductList.findAll({
      raw: true,
      attributes: [
        'productId',
        'priceWeb',
        'priceId',
        'discount',
        'period',
        'ab_test',
        'originPrice',
        'productClass',
      ],
      where: {
        system: 'web',
        version: 2,
      },
    });
    // 处理solver商品
    const hasTutor = await ctx.service.abtest.isTutorOnExperiment(deviceId);
    const subscriptionList = allProducts.filter((item) => item.productClass === 'unlimited_sub');
    Object.keys(subscriptionList).forEach((key) => {
      const item = subscriptionList[key];
      const priceWeb = JSON.parse(item.priceWeb);
      result.subscription[item.period] = {
        price: priceWeb[language] || priceWeb.en,
        originPrice: item.originPrice,
        discount: item.discount,
        period: item.period,
      };
    });
    if (hasTutor) {
      // tutor用户没有12个月的订阅
      delete result.subscription[12];
    } else {
      const activeSubscription = await ctx.service.subscription.findActiveSubscription(deviceId);
      if (
        _.isEmpty(activeSubscription) ||
        (activeSubscription[0].period !== 6 && activeSubscription[0].nextPlan?.period !== 6)
      ) {
        // 其他用户没有6个月的订阅
        delete result.subscription[6];
      }
    }
    // 处理实验价格策略
    await this.handleExperimentPriceV2(deviceId, result);
    return result;
  }
  /**
   * 处理实验价格策略
   * @param {string} deviceId - 设备ID
   * @param {Object} result - 结果对象
   */
  async handleExperimentPrice(deviceId, result) {
    // 策略配置 - 按照 priceTag 和 periods 组合进行分组
    const experimentStrategies = {
      // control 价格策略 + oneYear
      control_oneYear: {
        periods: [PERIOD_MAP.oneYear],
        priceTag: 'control',
        experiments: ['TEST_M_Web_SV_New', 'TEST_S_Webspeed_NewShop', 'TEST_M_NewShop_v1'],
      },
      // control 价格策略 + oneMonth + oneYear
      control_oneMonth_oneYear: {
        periods: [PERIOD_MAP.oneMonth, PERIOD_MAP.oneYear],
        priceTag: 'control',
        experiments: ['TEST_M_Web_month_trial'],
      },
      // TEST_M_SV_Old_Price_B 价格策略 + oneYear
      TEST_M_SV_Old_Price_B_oneYear: {
        periods: [PERIOD_MAP.oneYear],
        priceTag: 'TEST_M_SV_Old_Price_B',
        experiments: [
          // 'TEST_M_SV_Old_Price_B',
          // 'TEST_M_SV_Old_Price_B_off',
          // 'TEST_M_SV_Old_Price_B_off_v1',
          // 'TEST_M_SV_Old_Price_B_on',
          // 'TEST_M_Price_B_control',
          // 'TEST_M_Price_B_expe',
          // 'TEST_C_Price_B_control',
          // 'TEST_C_Price_B_expe',
          // 'TEST_P_Price_B_control',
          // 'TEST_P_Price_B_control_month_trial',
        ],
      },
      // control 价格策略 + oneWeek
      control_oneWeek: {
        periods: [PERIOD_MAP.oneWeek],
        priceTag: 'control',
        experiments: ['TEST_M_web_recall_popup_on', 'TEST_P_web_recall_popup_on'],
      },
      // 5799 价格策略 + oneYear
      Test_5799_oneYear: {
        periods: [PERIOD_MAP.oneYear],
        priceTag: 'TEST_P_PriceTest_5799',
        experiments: ['TEST_P_PriceTest_5799'],
      },
      // 5899 价格策略 + oneYear
      // Test_5899_oneYear: {
      //   periods: [PERIOD_MAP.oneYear],
      //   priceTag: 'TEST_P_PriceTest_5899',
      //   experiments: ['TEST_P_PriceTest_5899'],
      // },
    };

    try {
      // 创建实验标签到策略的映射
      const experimentToStrategyMap = {};
      const experimentTags = [];

      // 构建映射和标签列表
      Object.values(experimentStrategies).forEach((strategy) => {
        strategy.experiments.forEach((experiment) => {
          experimentToStrategyMap[experiment] = strategy;
          experimentTags.push(experiment);
        });
      });

      // 获取实验分组
      const commercializeExperiment = await this.queryCommercializeExperiment(
        deviceId,
        experimentTags,
      );

      const price_product = await this.handleUserExperimentPrice('control', [12]);
      if (!_.isEmpty(price_product) && price_product[12]) {
        result.subscription[12] = price_product[12];
      }
      if (commercializeExperiment.length > 0) {
        // 按周期分组实验
        const experimentsByPeriod = {
          [PERIOD_MAP.oneWeek]: [],
          [PERIOD_MAP.oneMonth]: [],
          [PERIOD_MAP.sixMonth]: [],
          [PERIOD_MAP.oneYear]: [],
        };

        // 将实验按照周期分组
        commercializeExperiment.forEach((experimentTag) => {
          if (experimentToStrategyMap[experimentTag]) {
            const { periods } = experimentToStrategyMap[experimentTag];
            periods.forEach((period) => {
              if (!experimentsByPeriod[period].includes(experimentTag)) {
                experimentsByPeriod[period].push(experimentTag);
              }
            });
          }
        });

        // 处理每个周期的实验
        for (const [period, experiments] of Object.entries(experimentsByPeriod)) {
          if (experiments.length > 0) {
            // 按优先级查找匹配的实验（使用数组中的第一个实验）
            const matchedExperiment = experiments[0];
            const { priceTag } = experimentToStrategyMap[matchedExperiment];

            // 特殊处理 oneWeek 周期的实验
            if (
              period === PERIOD_MAP.oneWeek &&
              matchedExperiment.includes('web_recall_popup_on')
            ) {
              const priceProduct = await this.handleUserExperimentPrice(priceTag, [
                parseInt(period),
              ]);
              result.weeklySubscription = priceProduct[period];
            } else {
              // 处理其他周期的实验
              const priceProduct = await this.handleUserExperimentPrice(priceTag, [
                parseInt(period),
              ]);
              if (!_.isEmpty(priceProduct) && priceProduct[period]) {
                result.subscription[period] = priceProduct[period];
              }
            }
          }
        }
      }
    } catch (error) {
      this.ctx.logger.error('处理实验价格失败:', error);
    }
  }

  /**
   * 处理实验价格策略(新版)
   * @param {string} deviceId - 设备ID
   * @param {Object} result - 结果对象
   */
  async handleExperimentPriceV2(deviceId, result) {
    const { ctx } = this;
    try {
      // 获取实验分组
      const experiments = await ctx.service.abtest.getUserExperiments(deviceId);
      // 查找匹配的实验策略
      const price_product = await this.handleUserExperimentPriceV2(experiments, [1, 3, 7, 12]);

      result.subscription = price_product;

      const order = await ctx.service.order.find({
        deviceId,
        period: 7,
        amount: 199,
        status: 'complete',
      });
      const order_month = await ctx.service.order.find({
        deviceId,
        period: 1,
        amount: { [Op.in]: [699, 899] },
        status: 'complete',
      });
      if (!_.isEmpty(order)) {
        result.weekDiscountUsed = true;
      }
      if (!_.isEmpty(order_month)) {
        result.monthDiscountUsed = true;
      }
    } catch (error) {
      this.ctx.logger.error('处理实验价格失败:', error);
    }
  }

  /**
   * 处理开学季价格敏感度实验
   * @param {string} priceTag 价格标签
   * @param {Array} periods 订阅周期
   * @param {string} language 语言
   * @return {Object} 处理后的订阅列表和组合订阅列表
   */
  async handleUserExperimentPrice(priceTag, periods = [], language = 'en') {
    // 取出组合订阅的商品列表中的0.99商品
    const productList = await this.listCombinedSub(language);
    const filteredProduct = [];
    productList.forEach((item) => {
      if (item.test === priceTag && periods.includes(item.period)) {
        filteredProduct.push({
          price: new Decimal(item.price).dividedBy(100).toNumber(),
          discount: item.discount,
          period: item.period,
          originPrice: new Decimal(item.originalPrice).dividedBy(100).toNumber(),
        });
      }
    });
    const periodIndexData = _.keyBy(filteredProduct, 'period');
    return periodIndexData;
  }

  // 新版获取实验价格Map结构
  async handleUserExperimentPriceV2(experiments, periods = [], language = 'en') {
    const { source } = this.ctx.query;
    // 取出所有web端商品列表
    const productList = await this.listCombinedSub(language);
    // 取出价格和对应的价格标签
    const periodExpeList = periods.map((period) => ({
      period,
      experiment:
        experimentStrategies.find(
          (item) =>
            item.period === period &&
            item.platform.includes(source || 'web') &&
            item.experiments.some((experiment) => experiments.includes(experiment)),
        )?.priceTag || 'control',
    }));
    const filteredProduct = [];
    // 筛选最终的价格列表
    productList
      .filter((item) => periods.includes(item.period))
      .forEach((item) => {
        const priceOne = periodExpeList.find((subitem) => item.period === subitem.period);
        if (priceOne.experiment === item.test && priceOne.period === item.period) {
          filteredProduct.push({
            price: new Decimal(item.price).dividedBy(100).toNumber(),
            discount: item.discount,
            period: item.period,
            originPrice: new Decimal(item.originalPrice).dividedBy(100).toNumber(),
          });
        }
      });
    const periodIndexData = _.keyBy(filteredProduct, 'period');
    return periodIndexData;
  }

  /**
   * 查询商业化实验分组
   * @param {string} deviceId 设备ID
   * @param {Array} testList 实验列表
   * @param {string} findTag 需要查找的实验标签
   * @return {Array} 实验标签数组
   */
  async queryCommercializeExperiment(deviceId, testList = [], findTag = '') {
    const { ctx } = this;
    let result = [];

    try {
      const experiments = await ctx.service.abtest.getUserExperiments(deviceId);
      // 并行查询所有实验
      result = experiments.filter((item) => testList.includes(item));

      // 如果指定了findTag，返回包含匹配结果的数组
      if (!_.isEmpty(findTag)) {
        const matchedTag = result.find((item) => item === findTag);
        return matchedTag ? [matchedTag] : [];
      }
    } catch (error) {
      ctx.logger.error('查询商业化实验失败', error);
      return [];
    }

    return result;
  }

  /**
   * 查询商业化实验分组
   * @param {string} userTestTag 用户实验标签
   * @param {number} period 订阅周期
   * @param {string} language 语言
   * @return {Object} 实验标签数组
   */
  async queryCommercializeProductInfo(userTestTag, period, language = 'en') {
    const { ctx } = this;
    try {
      const productList = await this.listCombinedSub(language);
      let testType = 'control';
      let shouldProcess = false;

      // 确定测试类型和是否需要处理
      if (['TEST_M_SV_Old_Price_B_off_v1'].includes(userTestTag) && period === PERIOD_MAP.oneYear) {
        testType = 'TEST_M_SV_Old_Price_B';
        shouldProcess = true;
      } else if (['TEST_M_NewShop_v1'].includes(userTestTag) && period === PERIOD_MAP.oneYear) {
        shouldProcess = true;
      } else if (
        userTestTag === 'TEST_M_Web_month_trial' &&
        [PERIOD_MAP.oneMonth, PERIOD_MAP.oneYear].includes(period)
      ) {
        shouldProcess = true;
      }

      if (!shouldProcess) {
        return {};
      }

      // 查找匹配的商品
      const matchedProduct = productList.find(
        (item) => item.test === testType && item.period === period,
      );

      if (!matchedProduct) {
        return {};
      }

      // 返回价格信息
      return {
        price: new Decimal(matchedProduct.price).dividedBy(100).toNumber(),
        originPrice: new Decimal(matchedProduct.originalPrice).dividedBy(100).toNumber(),
        period: matchedProduct.period,
        productId: matchedProduct.productId,
        priceId: matchedProduct.priceId,
      };
    } catch (error) {
      ctx.logger.error('查询商业化实验失败', error);
      return {};
    }
  }
  /**
   * 获取商品详情
   * @param {Object} where 查询条件
   */
  async productInfo(where) {
    const { ctx } = this;
    const productInfo = await ctx.model.ProductList.findOne({
      raw: true,
      where: {
        system: 'web',
        ...where,
      },
    });
    return productInfo;
  }
  /**
   * 创建支付链接
   * @param {Object} param 参数
   * @param {string} param.subscriptionType 订阅类型: solver | writer | solver_writer(组合包)
   * @param {string} param.mode 支付模式: payment | subscription
   * @param {number} param.quantity 数量
   * @param {string} param.questionId 问题id
   * @param {number} param.month 月份
   * @param {number} param.diamond 钻石数量
   * @param {array}  param.discounts 优惠券或者促销码
   * @param {string} param.backUrl 返回地址
   * @param {string} param.backPath 返回路径
   * @param param.source
   * @param param.discount
   * @param param.email
   * @param param.isFreeTrail
   */
  async createCheckout({
    subscriptionType = '',
    mode,
    quantity = 1,
    questionId = '',
    month,
    source,
    discounts,
    backUrl,
    backPath,
    discount,
    email,
    isFreeTrail,
  }) {
    const { ctx, app } = this;
    let priceId,
      freeTrailType = 'none';
    try {
      const redirectUrl = app.config.stripeConfig.redirectUrl;
      const successQuery = `?success=true&order_id={CHECKOUT_SESSION_ID}&source=${source || ''}`;
      const cancelQuery = '';
      const { uid: deviceId } = ctx.user;
      const stripe = ctx.stripeV2;
      // 目前只有solver订阅，用类型1表示
      const rightsPath = source === 'plugin' ? 'plugin-rights' : 'rights';
      let productId, period, product;
      // 只有solver订阅，且是开学季实验，且是12个月订阅
      if (subscriptionType === 'solver') {
        const { productInfo } = await ctx.service.subscription.getSubAndRefundPriceInfo(
          'en',
          month,
          source,
        );
        product = productInfo[0];
        if (_.isEmpty(product)) {
          return {
            code: 400,
            msg: 'server_error.product_not_found',
          };
        }
        ({ productId, priceId, period } = product);
      }
      const stripeCheckoutData = {
        billing_address_collection: 'auto',
        line_items: [
          {
            price: priceId,
            quantity,
          },
        ],
        mode,
        success_url: `${redirectUrl}${questionId ? '/history/' + questionId : '/pricing/' + rightsPath}${successQuery}`,
        cancel_url:
          backUrl ||
          `${redirectUrl}${questionId ? '/history/' + questionId : backPath ? '/' + backPath : '/pricing'}${cancelQuery}`,
      };
      stripeCheckoutData.metadata = {
        deviceId,
        productId,
        quantity,
        source,
      };
      if (email) {
        stripeCheckoutData.customer_email = email;
      }
      if (mode === 'subscription') {
        // const productInfo = await ctx.service.product.productInfo({ productId });
        /**
         * 当传入的discounts为合法参数且不为空，说明需要自动填入优惠券，故allow_promotion_codes不在需要（这个参数用来展示优惠码输入框）
         * 且必须得这样做，因为stripe规定allow_promotion_codes和discounts无法共存，否则报错
         */
        if (
          ['discount_10_off', 'discount_5_usd', 'discount_6_usd', 'discount_4_usd'].includes(
            discount,
          )
        ) {
          // 1. 先查找促销码
          const promoCode = await stripe.promotionCodes.list({
            code: getDiscountCode(discount),
            active: true,
            limit: 1,
          });
          if (promoCode.data.length > 0) {
            discounts = [{ promotion_code: promoCode.data[0].id }];
          }
        }
        if (_.isEmpty(discounts)) {
          stripeCheckoutData.allow_promotion_codes = true;
        } else {
          stripeCheckoutData.discounts = discounts;
        }
        const order_week = await ctx.service.order.find({
          deviceId,
          period: 7,
          amount: 199,
          status: 'complete',
        });
        const order_month = await ctx.service.order.find({
          deviceId,
          period: 1,
          amount: 699,
          status: 'complete',
        });
        if ((!_.isEmpty(order_week) && period === 7) || (!_.isEmpty(order_month) && period === 1)) {
          stripeCheckoutData.allow_promotion_codes = false;
        }
        // const experiments = await ctx.service.abtest.getUserExperiments(deviceId);
        /**
         * free-trial需求，只在solver且12个月的订阅：
         *  1. 添加 subscription_data: {trial_period_days:3} -- 生成的付款链接含有3天试用
         *  2. 添加 stripeCheckoutData.metadata中增加isTrial: true -- 用于区分是否是3天试用
         *  3. 只有年包会有免费试用，月包免费试用走自定义订阅流程；如果修改，下面的period===12判断要更新
         */
        if (subscriptionType === 'solver' && source === 'plugin' && period === 12) {
          const orderInfo = await ctx.service.order.find({
            deviceId,
            isTrial: 1,
            status: 'complete',
          });

          // 查询用户来源信息
          const userInfo = await ctx.model.UserInfo.findOne({
            raw: true,
            attributes: ['source', 'createTime'],
            where: { deviceId },
          });

          // 从插件注册的用户
          const isSourcePlugin = userInfo.source.includes('plugin');

          // 来自SEM或Web的用户
          const isSemOrWebUser =
            userInfo && (userInfo.source === 'SEM' || userInfo.source === 'web');

          // 🎯 新增：检查插件用户是否已完成过试用订阅
          let hasCompletedPluginTrial = false;
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

              // 如果 freeTrialCount > 0，说明已完成过试用订阅
              if (pluginUserInfo && pluginUserInfo.freeTrialCount > 0) {
                hasCompletedPluginTrial = true;
                ctx.logger.info(
                  `[Free Trial] Plugin user has completed trial before - pluginUuid: ${pluginUuid}, freeTrialCount: ${pluginUserInfo.freeTrialCount}`,
                );
              }
            } catch (error) {
              ctx.logger.error(
                `[Free Trial] Failed to check plugin trial status - pluginUuid: ${pluginUuid}, error: ${error}`,
              );
            }
          }

          if (
            (_.isEmpty(orderInfo) || isFreeTrail) &&
            (!isSemOrWebUser || isSourcePlugin) &&
            !hasCompletedPluginTrial // 🎯 新增条件：未完成过插件试用
          ) {
            stripeCheckoutData.subscription_data = {
              trial_period_days: 3,
            };
            stripeCheckoutData.metadata.isTrial = true;
            freeTrailType = 'basic';
          }
        }
      } else if (mode === 'payment') {
        stripeCheckoutData.payment_intent_data = {
          metadata: {
            ...stripeCheckoutData.metadata,
          },
        };
      }
      const session = await stripe.checkout.sessions.create({
        ...stripeCheckoutData,
      });
      const env = app.config.env === 'prod' ? 'Production' : 'Sandbox';
      const data = {
        deviceId: ctx.user.uid,
        originalTransactionId: session.id,
        purchaseChannel: 'stripe',
        currency: session.currency,
        mode,
        purchaseTimeStamp: session.created * 1000,
        productId,
        quantity,
        period,
        amount: session.amount_total,
        status: session.status,
        createdRaw: JSON.stringify(session),
        isTrial: stripeCheckoutData.metadata.isTrial ? 1 : 0,
        environment: env,
        priceId,
        version: 2,
        subscriptionType: 1,
        source,
      };
      ctx.service.order.create(data);
      return {
        code: 0,
        url: session.url,
      };
    } catch (e) {
      ctx.logger.error('创建支付链接失败', e);
      // 埋点上报
      const { uid: deviceId } = ctx.user;
      // 上传web server打点
      ctx.service.point.uploadServerPoint(deviceId, 'sub_fail', {
        period: month,
        deviceId,
        freetrial: freeTrailType,
        price: priceId,
        errorCode: 500,
        errorMsg: `创建支付链接失败: ${e.message}`,
      });
      return {
        code: 400,
        msg: 'solve_fail',
      };
    }
  }
  // 查询商品的信息
  async findPriceIdByModeAndMonth({ mode, period, diamond, subscriptionType, version = 2 }) {
    const { ctx } = this;
    const language = ctx.request.headers['solvely-language'] || 'en';
    // 钻石购买
    // todo: plus用户钻石购买
    if (mode === 'payment') {
      const productInfo = await ctx.model.ProductList.findOne({
        raw: true,
        where: {
          system: 'web',
          productClass: 'comsumable',
          version: 2,
          diamond,
        },
      });
      const priceId = JSON.parse(productInfo.priceId);
      return {
        productId: productInfo.productId,
        priceId: priceId[language] || priceId.en,
        period: 1,
      };
    }
    const productClassMap = {
      1: 'unlimited_sub',
      2: 'unlimited_writer',
      3: 'unlimited_solver_writer',
    };
    let productClass = productClassMap[subscriptionType];
    if (productClass === 'unlimited_writer') {
      // 判断是否有生效中的solver，如果有，productClass为unlimited_writer_discount
      const activeSolverSubscription = await ctx.service.subscription.findActiveSubscription(
        ctx.user.uid,
      );
      if (!_.isEmpty(activeSolverSubscription)) {
        productClass = 'unlimited_writer_discount';
      }
    }
    // 订阅购买
    const productInfo = await ctx.model.ProductList.findOne({
      raw: true,
      where: {
        system: 'web',
        productClass,
        period,
        version: version === 2 ? 2 : null,
      },
    });
    const priceId = JSON.parse(productInfo.priceId);
    return {
      productId: productInfo.productId,
      priceId: priceId[language] || priceId.en,
      period: productInfo.period,
    };
  }

  async guestList() {
    const { ctx } = this;
    const result = {
      subscription: {},
    };
    const language = ctx.request.headers['solvely-language'] || 'en';
    const allProducts = await ctx.model.ProductList.findAll({
      raw: true,
      attributes: [
        'productId',
        'priceWeb',
        'priceId',
        'discount',
        'period',
        'ab_test',
        'originPrice',
        'productClass',
      ],
      where: {
        system: 'web',
        version: 2,
      },
    });
    const subscriptionList = allProducts.filter((item) => item.productClass === 'unlimited_sub');
    Object.keys(subscriptionList).forEach((key) => {
      const item = subscriptionList[key];
      const priceWeb = JSON.parse(item.priceWeb);
      result.subscription[item.period] = {
        price: priceWeb[language] || priceWeb.en,
        originPrice: item.originPrice,
        discount: item.discount,
        period: item.period,
      };
    });
    // 其他用户没有6个月的订阅
    delete result.subscription[6];
    return result;
  }
  /**
   * 获取组合订阅商品列表
   * @param {string} language 语言
   */
  async listCombinedSub(language) {
    const { ctx } = this;
    const { source } = ctx.query;
    const productInfo = await ctx.model.ProductWeb.findAll({
      raw: true,
      where: {
        productClass: ['unlimited_combined_annual', 'unlimited_plugin'],
        language,
      },
    });
    let index = 0;
    if (source !== 'plugin') {
      index = productInfo.findIndex(
        (item) => item.period === 12 && item.productClass === 'unlimited_plugin',
      );
    } else {
      index = productInfo.findIndex(
        (item) =>
          item.period === 12 &&
          item.test === 'control' &&
          item.productClass === 'unlimited_combined_annual',
      );
    }
    if (index !== -1) {
      delete productInfo[index];
    }
    return productInfo;
  }
}

module.exports = Product;
