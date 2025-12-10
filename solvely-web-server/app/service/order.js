const { Service } = require('egg');
const _ = require('lodash');

class OrderService extends Service {
  /**
   * 查询订单信息
   * @param {object} where 条件
   * @param {array} orderBy 排序
   * @return {object} 订单信息
   */
  async find(where, orderBy = []) {
    const { ctx } = this;
    const order = await ctx.model.Order.findOne({
      raw: true,
      where,
      order: orderBy,
    });
    return order;
  }
  /**
   * 查询订单信息
   * @param {object} where 条件
   * @param {array} orderBy 排序
   * @return {object} 订单信息
   */
  async findAll(where) {
    const { ctx } = this;
    const order = await ctx.model.Order.findAll({
      raw: true,
      where,
    });
    return order;
  }
  /**
   * 创建订单
   * @param {object} order 订单信息
   */
  async create(order) {
    try {
      await this.ctx.model.Order.create(order);
    } catch (e) {
      this.ctx.throw(new Error(`订单创建失败: ${order.originalTransactionId} ${e}`));
    }
  }
  /**
   * 更新订单信息
   * @param {object} session stripe返回的结果
   * @param {number} diamond 钻石数量
   * @param {number|undefined} period 订阅周期
   */
  async update(session, diamond = 0, period = 1) {
    const { ctx, app } = this;
    const orderLogger = app.getLogger('orderLogger');
    try {
      const originalTransactionId = session.id;
      const orderInfo = await this.find({
        originalTransactionId,
      });
      if (!_.isEmpty(orderInfo) && orderInfo.amount !== session.amount_subtotal) {
        ctx.service.point.firebasePoint(orderInfo.deviceId, 'Web_Pay_Up_Sell', {
          productId: orderInfo.productId,
          subscriptionId: session.subscription,
          oldPeriod: orderInfo.period,
          currency: orderInfo.currency,
          amount: session.amount_total,
          customer: session.customer,
        });
      }
      const updateData = {
        status: session.status,
        completedRaw: JSON.stringify(session),
        diamond,
        regular: 1,
        amount: session.amount_total,
      };
      if (session.mode === 'subscription') {
        updateData.transactionId = session.subscription;
        updateData.period = period;
        updateData.customer = session.customer || '';
        updateData.invoice = session.invoice;
      }
      await ctx.model.Order.update(updateData, {
        where: {
          originalTransactionId,
        },
      });
      orderLogger.info(
        `订单更新成功: 订单ID:${originalTransactionId} 类型:${session.mode} 状态:${updateData.status} 钻石:${updateData.diamond} 订阅ID:${updateData.transactionId || ''} 订阅周期:${updateData.period || ''}`,
      );
      return orderInfo;
    } catch (e) {
      orderLogger.error(`订单更新失败: ${session.id} ${e}`);
    }
  }
  /**
   * 获取订单版本
   * @param {string} subscriptionId 订阅ID
   * @return {number} 订单版本
   */
  async findOrderVersionBySubscription(subscriptionId) {
    const { ctx } = this;
    try {
      const orderInfo = await ctx.model.Order.findOne({
        raw: true,
        attributes: ['version'],
        where: {
          transactionId: subscriptionId,
        },
      });
      return orderInfo?.version || 2;
    } catch (e) {
      ctx.throw(new Error(`获取订单版本失败: ${e}`));
    }
  }
}

module.exports = OrderService;
