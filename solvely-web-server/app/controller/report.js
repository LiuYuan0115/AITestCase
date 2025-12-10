const { Controller } = require('egg');

class ReportController extends Controller {
  /**
   * 上报插件推送结果
   */
  async reportServerPluginBq() {
    const { ctx } = this;
    const { deviceId, eventName } = ctx.request.body;
    if (eventName === '') {
      ctx.body = {
        code: 200,
        data: {},
      };
      return;
    }

    ctx.service.common.saveQuestionInfoToBq(
      {
        eventName,
        deviceId,
        platform: 'web',
      },
      'Solvely',
      'ServerEventTracking',
    );
    ctx.body = {
      code: 200,
      data: {},
    };
  }

  /**
   * 上报插件推送结果
   */
  async reportServerPluginPushTest() {
    const { ctx } = this;
    const { deviceId, webPushToken, secret } = ctx.query;

    if (secret !== 'XOfnxB0LqqgRBrFNroB8BeSE40un2kFE') {
      ctx.body = {
        code: 200,
        data: {},
      };
      return;
    }

    const successMessage = {
      data: {
        type: 'extension_notification',
        title: 'Solvely.ai Browser Extension Now Available! 🚀',
        body: 'Get instant answers without leaving your current webpage',
        time: Date.now().toString(),
        deviceId,
      },
      token: webPushToken,
    };
    const ress = await ctx.firebaseAdmin.messaging().send(successMessage);
    ctx.body = ress;
  }

  /**
   * @description 上报浏览器插件前端交互事件
   * @reason 因为firebase的埋点上报功能不支持在插件环境中运行
   * @example 详见：https://firebase.google.com/docs/web/environments-js-sdk?hl=zh-cn
   */
  async reportBrowserExtEvent() {
    const { ctx } = this;
    const { id: deviceId, name, params, cid } = ctx.request.body;
    try {
      ctx.validate({
        id: 'string?',
        name: 'string',
        params: 'object?',
        cid: 'string?',
      });
    } catch (error) {
      ctx.logger.error(`[reportBrowserExtEvent] 上报浏览器插件前端交互事件失败: ${error}`);
      ctx.body = {
        code: 0,
      };
      return;
    }
    ctx.service.point.firebasePoint(deviceId, name, params, cid);
    // 插件解题成功adjust埋点上报
    if (name === 'Plugin_Solve_loading_total') {
      ctx.service.point.adjustPoint(deviceId, 'kknp8z', params);
      ctx.service.point.adjustPoint(deviceId, 'bio29v', params);
    } else if (name === 'Plugin_sidebar_login_success') {
      ctx.service.point.adjustPoint(deviceId, '81rc0v', params);
    } else if (name === 'Extension_University_Solve_Success') {
      ctx.service.point.adjustPoint(deviceId, 'proygj', params);
    }
    ctx.body = {
      code: 0,
    };
  }
  /**
   * 上报用户 rengage 信息
   */
  async uploadUserRengageInfo() {
    const { ctx } = this;
    ctx.validate(
      {
        deviceId: {
          type: 'string',
          required: true,
        },
        secret: {
          type: 'string',
          required: true,
        },
        userInfo: {
          type: 'object',
          required: true,
        },
      },
      ctx.request.body,
    );
    const { deviceId, userInfo, secret } = ctx.request.body;

    if (secret !== 'XOfnxB0LqqgRBrFNroB8BeSE40un2kFE') {
      ctx.body = {
        code: 400,
        data: {},
      };
      return;
    }
    ctx.service.common.uploadUserRengageInfo(deviceId, userInfo);
    ctx.body = {
      code: 200,
      data: {},
    };
  }
}

module.exports = ReportController;
