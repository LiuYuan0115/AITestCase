const { Service } = require('egg');
/**
 * 解题完毕的消息通知，仅限fast模式
 */
class FcmService extends Service {
  async push(deviceId, questionId, webPushToken, answerStatus) {
    const { ctx, app } = this;
    const fcmLogger = app.getLogger('fcmLogger');
    if (!webPushToken) {
      fcmLogger.info(`用户${deviceId} 题目:${questionId} 没有webPushToken`);
      ctx.service.point.firebasePoint(deviceId, 'Web_FCM_NoToken', { questionId, answerStatus });
      return;
    }
    const successMessage = {
      data: {
        type: 'notification',
        title: '🎉 Question Processed',
        body: 'ALL of your questions have been processed, tap to view.',
        icon: '/favicon.ico',
        questionId,
      },
      token: webPushToken,
    };
    const failMessage = {
      data: {
        type: 'notification',
        title: 'Something went wrong with the question',
        body: 'Tap to view the details.',
        icon: '/favicon.ico',
        questionId,
      },
      token: webPushToken,
    };
    ctx.firebaseAdmin
      .messaging()
      .send(answerStatus === 3 ? failMessage : successMessage)
      .then(() => {
        ctx.service.point.firebasePoint(deviceId, 'Web_FCM_Success', { questionId, answerStatus });
        fcmLogger.info(`用户:${deviceId} 题目:${questionId} 推送成功`);
      })
      .catch(() => {
        ctx.service.point.firebasePoint(deviceId, 'Web_FCM_Fail', { questionId, answerStatus });
        fcmLogger.info(`用户:${deviceId} 题目:${questionId} 推送失败`);
      });
  }
}

module.exports = FcmService;
