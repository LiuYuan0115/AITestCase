'use strict';

const { Controller } = require('egg');

class BookmarkController extends Controller {
  /**
   * 获取收藏题目列表
   * 接口转发到 /solvelyPubServer/v1/question/bookmark/list
   */
  async list() {
    const { ctx, app } = this;
    const { page = 1, size = 20, questionId } = ctx.request.body || {};
    const deviceId = ctx.user.uid;
    const commonHost = app.config.commonServiceConfig.host;
    try {
      const result = await ctx.curl(`${commonHost}/solvelyPubServer/v1/question/bookmark/list`, {
        method: 'POST',
        data: {
          deviceId,
          page,
          size,
          questionId,
        },
        contentType: 'json',
        dataType: 'json',
      });
      ctx.body = result.data;
    } catch (error) {
      ctx.logger.error('获取收藏题目列表失败:', error);
      ctx.body = {
        code: -1,
        msg: '获取收藏题目列表失败',
        data: null,
      };
    }
  }

  /**
   * 收藏/取消收藏题目
   * 接口转发到 /solvelyPubServer/v1/question/bookmark
   * @param {number} type - 1: 收藏; 2: 取消收藏
   */
  async toggleBookmark() {
    const { ctx, app } = this;
    const { questionId, type } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const commonHost = app.config.commonServiceConfig.host;

    if (!questionId) {
      ctx.body = {
        code: -1,
        data: null,
      };
      return;
    }

    if (![1, 2].includes(Number(type))) {
      ctx.body = {
        code: -1,
        data: null,
      };
      return;
    }

    try {
      const result = await ctx.curl(`${commonHost}/solvelyPubServer/v1/question/bookmark`, {
        method: 'POST',
        data: {
          deviceId,
          questionId,
          type,
        },
        contentType: 'json',
        dataType: 'json',
      });

      ctx.body = result.data;
    } catch (error) {
      const actionText = type === 1 ? '收藏' : '取消收藏';
      ctx.logger.error(`${actionText}题目失败:`, error);
      ctx.body = {
        code: -1,
        msg: `${actionText}题目失败`,
        data: null,
      };
    }
  }
}

module.exports = BookmarkController;
