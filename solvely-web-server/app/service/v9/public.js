'use strict';

const BaseService = require('./BaseService');

class PublicService extends BaseService {
  /**
   * 查询题目信息, 纯 Question Schema 不含其它
   * @param {string} deviceId 用户id
   * @param {string} questionId 题目id
   */
  async queryQuestionPureInfo(deviceId, questionId) {
    const { ctx } = this;
    try {
      const url = '/solvelyPubServer/v1/questionPureInfo';
      const pureInfo = await this.publicServerGetRequest(url, {
        deviceId,
        questionId,
      });
      return pureInfo?.data;
    } catch (error) {
      ctx.throw(new Error(`queryQuestionPureInfo:Error:${error}`));
    }
  }

  /**
   * 只更新 mongodb 中 question schema 字段
   * @param {string} deviceId 用户id
   * @param {string} questionId 题目id
   * @param {object} updateObj 更新对象
   * @return {Promise} 更新结果
   */
  async updatePureQuestionSchema(deviceId, questionId, updateObj) {
    const { ctx } = this;
    try {
      const url = '/solvelyPubServer/questionInfo/v1';
      const result = await this.publicServerPostRequest(url, {
        questionId,
        updateObj: { ...updateObj, deviceId },
      });
      return result?.data;
    } catch (error) {
      ctx.throw(new Error(`updatePureQuestionSchema:Error:${error}`));
    }
  }

  /**
   * 更新 mathpix 识别之后的附加信息，用于以后进行分析
   * @param {string} questionId 题目id
   * @param {object} addInfo 附加信息
   * @return {Promise} 更新结果
   */
  async updateQuestionAddInfo(questionId, addInfo) {
    const { ctx } = this;
    try {
      const url = '/solvelyPubServer/questionAddInfo/v1';
      const result = await this.publicServerPostRequest(url, {
        questionId,
        addInfo,
      });
      return result?.data;
    } catch (error) {
      ctx.throw(new Error(`updateQuestionAddInfo:Error:${error}`));
    }
  }
}

module.exports = PublicService;
