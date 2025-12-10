const { Service } = require('egg');
const moment = require('moment');

const COST_TYPE_MAP = {
  unlimited: 'unlimited',
  balance: 'gems',
  fast: 'fastFreeCount',
  teach: 'gems',
  plugin: 'plugin',
};

class SolveService extends Service {
  async solveAll(deviceId, { questionInfo, consumptionType }) {
    const { ctx } = this;
    const solvelyTime = moment().valueOf();
    const model = await ctx.helper._getModelByDeviceId(deviceId);
    questionInfo.costType = COST_TYPE_MAP[consumptionType] || '';

    // 处理不同的消费方式
    if (consumptionType === 'unlimited') {
      // unlimited订阅用户检查剩余次数
      const hasRemainingCount = await ctx.service.question.addCount();
      if (!hasRemainingCount) {
        ctx.helper.streamResponse(
          ctx,
          {
            code: 30005,
            msg: '解题次数已用完',
            command: 'server-stop',
          },
          { isEnd: true },
        );
        return;
      }
    } else {
      // 非订阅用户扣除钻石/次数
      const deductAmount = consumptionType === 'balance' ? -10 : -1;
      await ctx.service.balance.updateDiamond(deviceId, {
        [consumptionType]: deductAmount,
      });
    }

    // 创建新题目记录
    await model.create({
      ...questionInfo,
      deviceId,
      answerStatus: 1,
      solvelyTime,
    });

    await ctx.service.common.commonStreamRequest(
      questionInfo.pdfUrl
        ? '/solvelyPubServer/v7/oneclick/pdf/solveQuestion'
        : questionInfo.pictures
          ? '/solvelyPubServer/v7/oneclick/image/solveQuestion'
          : '/solvelyPubServer/v7/oneclick/website/solveQuestion',
      {
        ...questionInfo,
        costType: COST_TYPE_MAP[consumptionType],
        solveCount: 1,
        deviceId,
        callbackUrl: this.app.config.questionWebhookURL,
      },
    );
  }
}

module.exports = SolveService;
