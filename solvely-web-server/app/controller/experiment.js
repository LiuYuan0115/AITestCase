const Controller = require('egg').Controller;

class ExperimentController extends Controller {
  /**
   * 刷新实验配置
   */
  async refreshConfig() {
    const { ctx } = this;

    // 参数校验
    const { token } = ctx.query;
    if (token !== ctx.app.config.experimentConfig.refreshToken) {
      ctx.status = 403;
      ctx.body = {
        success: false,
        message: '无效的 token',
      };
      return;
    }

    try {
      const response = await ctx.curl(ctx.app.config.experimentConfig.configUrl, {
        dataType: 'json',
        timeout: 5000,
      });

      if (!response.data) {
        ctx.status = 500;
        ctx.body = {
          success: false,
          message: '获取实验配置失败',
        };
        return;
      }

      // 更新 context 中的配置
      ctx.experimentConfig = {
        data: response.data,
        lastFetchTime: Date.now(),
      };

      // 同时更新 app.context 中的配置，使其对新请求生效
      ctx.app.context.experimentConfig = ctx.experimentConfig;

      ctx.body = {
        success: true,
        data: {
          config: ctx.experimentConfig.data,
          lastFetchTime: ctx.experimentConfig.lastFetchTime,
        },
      };
    } catch (error) {
      ctx.logger.error('刷新实验配置失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        message: '刷新实验配置失败',
        error: error.message,
      };
    }
  }

  /**
   * 获取当前配置
   */
  async getCurrentConfig() {
    const { ctx } = this;

    const { token } = ctx.query;
    if (token !== ctx.app.config.experimentConfig.accessToken) {
      ctx.status = 403;
      ctx.body = {
        success: false,
        message: '无效的 token',
      };
      return;
    }

    ctx.body = {
      success: true,
      data: {
        config: ctx.experimentConfig.data,
        lastFetchTime: ctx.experimentConfig.lastFetchTime,
      },
    };
  }
}

module.exports = ExperimentController;
