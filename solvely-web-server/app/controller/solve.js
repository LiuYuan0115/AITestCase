const { Controller } = require('egg');

class SolveController extends Controller {
  async solveAll() {
    const { ctx } = this;
    const {
      questionId,
      questionText,
      answerId,
      answerStyle,
      answerLanguage,
      answerType = 'generation',
      experimental,
      instructions,
      platform,
      language,
      pdfUrl,
      pictures,
    } = ctx.request.body;

    // 检查余额
    const { consumptionType, approved } = await ctx.service.balance.checkBalance(
      ctx.user.uid,
      platform === 'plugin' ? 'plugin' : 'fast',
    );
    if (!approved) {
      ctx.helper.streamResponse(
        ctx,
        {
          code: 30001,
          msg: '余额不足',
          command: 'server-stop',
        },
        { isEnd: true },
      );
      return;
    }

    const questionInfo = {
      questionId,
      questionText,
      answerId,
      answerStyle,
      answerLanguage,
      answerType,
      experimental,
      instructions,
      platform,
      language,
      subject: 'math',
    };

    if (pdfUrl) {
      questionInfo.pdfUrl = pdfUrl;
    }

    if (pictures) {
      questionInfo.pictures = pictures;
    }

    await ctx.service.solve.solveAll(ctx.user.uid, {
      questionInfo,
      consumptionType,
    });
  }

  async decrementPluginUsage() {
    const { ctx } = this;
    const deviceId = ctx.user.uid;

    // 从请求头获取 pluginUuid（可选）
    const pluginUuid = ctx.request.header['x-plugin-uuid'];

    // 使用全局校验：正整数且 >= 1；>50 的情况在后续代码中按 50 处理
    ctx.validate({
      amount: { type: 'int?', min: 1 },
    });

    let { amount } = ctx.request.body || {};

    if (typeof amount === 'undefined') {
      amount = 1;
    }

    if (amount > 50) {
      amount = 50;
    }

    // 根据是否有 pluginUuid 调用扣减逻辑
    // pluginUuid 可以为 undefined，service 层会自动判断扣减模式
    const result = await ctx.service.balance.deductPluginBalance(deviceId, pluginUuid, amount);

    ctx.body = {
      code: result.success ? 0 : 30001,
      data: result,
    };
  }
}

module.exports = SolveController;
