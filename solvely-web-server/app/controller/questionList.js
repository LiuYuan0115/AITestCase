'use strict';

const { Controller } = require('egg');
const moment = require('moment');

// 题目解题状态
const QUESTION_STATUS = {
  analyzing: 1, // 解题中
  gptFail: 3, // 解题失败
};

// 超时时间（7分钟）
const QUESTION_TIMEOUT = 7 * 60 * 1000;

class QuestionListController extends Controller {
  /**
   * 获取题目列表
   * 接口转发到 /solvelyPubServer/v1/question/history
   */
  async list() {
    const { ctx, app } = this;
    const { answerStatus, page = 1, size = 20 } = ctx.request.body || {};
    const deviceId = ctx.user.uid;
    const commonHost = app.config.commonServiceConfig.host;

    try {
      const result = await ctx.curl(`${commonHost}/solvelyPubServer/v1/question/history`, {
        method: 'POST',
        data: {
          deviceId,
          answerStatus,
          page,
          size,
        },
        contentType: 'json',
        dataType: 'json',
      });

      // 检查状态，如果解题中且超时，改为失败状态
      if (result.data && result.data.data && result.data.data.questions) {
        const now = moment().valueOf();
        const model = await ctx.helper._getModelByDeviceId(deviceId);
        const updatedQuestions = [];

        // 遍历所有题目检查状态
        for (const item of result.data.data.questions) {
          const updateTimestamp = moment(item.updateTime).valueOf();
          if (
            now - updateTimestamp > QUESTION_TIMEOUT &&
            item.answerStatus === QUESTION_STATUS.analyzing
          ) {
            // 更新响应中的状态
            item.answerStatus = QUESTION_STATUS.gptFail;
            updatedQuestions.push({
              questionId: item.questionId,
              deviceId,
            });
          }
        }

        // 批量更新数据库
        if (updatedQuestions.length > 0) {
          for (const question of updatedQuestions) {
            await model.update(
              { answerStatus: QUESTION_STATUS.gptFail },
              {
                where: {
                  deviceId: question.deviceId,
                  questionId: question.questionId,
                },
              },
            );
          }
        }
      }
      ctx.body = result.data;
    } catch (error) {
      ctx.logger.error('获取题目列表失败:', error);
      ctx.body = {
        code: -1,
        msg: '获取题目列表失败',
        data: null,
      };
    }
  }

  /**
   * 批量删除题目
   * 接口转发到 /solvelyPubServer/v1/question/delete
   */
  async deleteQuestions() {
    const { ctx, app } = this;
    const { questionIds } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const commonHost = app.config.commonServiceConfig.host;

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      ctx.body = {
        code: -1,
        data: null,
      };
      return;
    }

    try {
      const result = await ctx.curl(`${commonHost}/solvelyPubServer/v1/question/delete`, {
        method: 'POST',
        data: {
          deviceId,
          questionIds,
        },
        contentType: 'json',
        dataType: 'json',
      });

      ctx.body = result.data;
    } catch (error) {
      ctx.logger.error('删除题目失败:', error);
      ctx.body = {
        code: -1,
        msg: '删除题目失败',
        data: null,
      };
    }
  }

  /**
   * 搜索题目
   * 接口转发到 /solvelyPubServer/v2/searchQuestion
   */
  async searchQuestions() {
    const { ctx, app } = this;
    const { keyword, page = 1, size = 20 } = ctx.request.body;
    const deviceId = ctx.user.uid;
    const commonHost = app.config.commonServiceConfig.host;

    if (!keyword) {
      ctx.body = {
        code: -1,
        data: null,
      };
      return;
    }

    try {
      const result = await ctx.curl(`${commonHost}/solvelyPubServer/v2/searchQuestion`, {
        method: 'POST',
        data: {
          deviceId,
          keyword,
          page,
          size,
        },
        contentType: 'json',
        dataType: 'json',
      });

      ctx.body = result.data;
    } catch (error) {
      ctx.logger.error('搜索题目失败:', error);
      ctx.body = {
        code: -1,
        msg: '搜索题目失败',
        data: null,
      };
    }
  }

  /**
   * 清空题目
   * 接口转发到 /solvelyPubServer/v1/question/clean
   */
  async cleanQuestions() {
    const { ctx, app } = this;
    const deviceId = ctx.user.uid;
    const commonHost = app.config.commonServiceConfig.host;
    const { answerStatus } = ctx.request.body;

    try {
      const result = await ctx.curl(`${commonHost}/solvelyPubServer/v1/question/clean`, {
        method: 'POST',
        data: {
          deviceId,
          answerStatus,
        },
        contentType: 'json',
        dataType: 'json',
      });

      ctx.body = result.data;
    } catch (error) {
      ctx.logger.error('清空题目失败:', error);
      ctx.body = {
        code: -1,
        msg: '清空题目失败',
        data: null,
      };
    }
  }
}

module.exports = QuestionListController;
