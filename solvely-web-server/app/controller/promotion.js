const { Controller } = require('egg');

class PromotionController extends Controller {
  /**
   * 为指定优惠券创建50个促销码
   * @param {string} couponId - Stripe优惠券ID
   * @param {string} prefix - 促销码前缀 (可选，默认为 'PROMO')
   * @param {number} count - 创建数量 (可选，默认为10)
   */
  async createPromotionCodes() {
    const { ctx } = this;
    const { couponId, prefix = 'PROMO', count = 10 } = ctx.request.body;

    // 参数验证
    if (!couponId) {
      ctx.body = {
        statusCode: 400,
        data: {
          message: '优惠券ID不能为空',
        },
      };
      return;
    }

    if (count > 100) {
      ctx.body = {
        statusCode: 400,
        data: {
          message: '一次最多只能创建100个促销码',
        },
      };
      return;
    }

    try {
      const stripe = ctx.stripeV2;
      const promotionCodes = [];
      const errors = [];

      // 验证优惠券是否存在
      try {
        await stripe.coupons.retrieve(couponId);
      } catch (error) {
        ctx.body = {
          statusCode: 404,
          data: {
            message: '优惠券不存在或无效',
            error: error.message,
          },
        };
        return;
      }

      // 批量创建促销码
      for (let i = 1; i <= count; i++) {
        try {
          // 生成唯一的促销码
          // const code = `${prefix}${i.toString().padStart(3, '0')}`; // PROMO001, PROMO002...
          const promotionCode = await stripe.promotionCodes.create({
            promotion: {
              type: 'coupon',
              coupon: couponId,
            },
            max_redemptions: 1, // 每个促销码只能使用一次
            active: true,
          });

          promotionCodes.push(promotionCode.code);

          // 添加延迟避免API限制
          if (i % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (error) {
          errors.push({
            index: i,
            code: `${prefix}${i.toString().padStart(3, '0')}`,
            error: error.message,
          });
          ctx.logger.error(`创建促销码失败: ${prefix}${i.toString().padStart(3, '0')}`, error);
        }
      }

      // 记录创建结果
      ctx.logger.info(`促销码创建完成: 成功${promotionCodes.length}个, 失败${errors.length}个`);

      ctx.body = {
        statusCode: 200,
        data: {
          message: '促销码创建完成',
          summary: {
            total_requested: count,
            success_count: promotionCodes.length,
            error_count: errors.length,
            coupon_id: couponId,
          },
          promotion_codes: promotionCodes,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      ctx.logger.error('创建促销码接口错误:', error);
      ctx.body = {
        statusCode: 500,
        data: {
          message: '创建促销码失败',
          error: error.message,
        },
      };
    }
  }

  /**
   * 获取指定优惠券的所有促销码
   * @param {string} couponId - Stripe优惠券ID
   */
  async getPromotionCodes() {
    const { ctx } = this;
    const { couponId } = ctx.query;

    if (!couponId) {
      ctx.body = {
        statusCode: 400,
        data: {
          message: '优惠券ID不能为空',
        },
      };
      return;
    }

    try {
      const stripe = ctx.stripeV2;

      // 获取该优惠券的所有促销码
      const promotionCodes = await stripe.promotionCodes.list({
        coupon: couponId,
        limit: 100, // Stripe默认限制
      });

      ctx.body = {
        statusCode: 200,
        data: {
          coupon_id: couponId,
          promotion_codes: promotionCodes.data.map((code) => ({
            code: code.code,
            active: code.active,
          })),
          total_count: promotionCodes.data.length,
        },
      };
    } catch (error) {
      ctx.logger.error('获取促销码失败:', error);
      ctx.body = {
        statusCode: 500,
        data: {
          message: '获取促销码失败',
          error: error.message,
        },
      };
    }
  }
}

module.exports = PromotionController;
