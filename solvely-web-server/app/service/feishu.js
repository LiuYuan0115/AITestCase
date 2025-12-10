const { Service } = require('egg');

class Feishu extends Service {
  /**
   * 发送AIO订阅通知
   * @param {object} payload 消息内容
   */
  async sendAioSubscriptionNotification(payload) {
    const { ctx, app } = this;
    const { deviceId, email, subscriptionPeriod, paymentType, paymentAmount, paymentTime, source } =
      payload;

    try {
      const webhookUrl = app.config.feishu?.aioWebhookNotificationUrl;
      if (!webhookUrl) {
        ctx.logger.warn('飞书webhook地址未配置，跳过通知');
        return;
      }

      // 根据付款类型设置颜色和图标
      const typeConfig = {
        直接订阅: { color: 'green', icon: '🎉' },
        续订: { color: 'blue', icon: '🔄' },
        试用转入金: { color: 'orange', icon: '💰' },
        开始试用: { color: 'purple', icon: '🚀' },
      };
      const config = typeConfig[paymentType] || { color: 'grey', icon: '📋' };

      const messageContent = {
        msg_type: 'interactive',
        card: {
          config: {
            wide_screen_mode: true,
            enable_forward: true,
          },
          header: {
            title: {
              content: `${config.icon} 喜报：新订单来啦 - ${paymentType}`,
              tag: 'text',
            },
            template: config.color,
          },
          elements: [
            {
              tag: 'div',
              text: {
                content: `订阅周期: ${subscriptionPeriod}\n\n订单来源: ${source}${paymentAmount > 0 ? `\n\n付款金额: $${paymentAmount}\n\n付款时间: ${paymentTime}` : ''}\n\nDeviceID: ${deviceId}\n\n付款邮箱: ${email || '未提供'}`,
                tag: 'lark_md',
              },
            },
          ],
        },
      };

      const result = await ctx.curl(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        data: messageContent,
        dataType: 'json',
        timeout: 10000,
      });

      if (result.status === 200 && result.data?.code === 0) {
        ctx.logger.info(
          `飞书AIO订阅通知发送成功: deviceId=${deviceId}, paymentType=${paymentType}`,
        );
      } else {
        ctx.logger.error(`飞书AIO订阅通知发送失败: ${JSON.stringify(result.data)}`);
        ctx.logger.error(`飞书AIO订阅通知发送失败: ${JSON.stringify(payload)}`);
      }
    } catch (error) {
      ctx.logger.error(`飞书AIO订阅通知发送异常: deviceId=${deviceId}, error=${error.message}`);
    }
  }
}

module.exports = Feishu;
