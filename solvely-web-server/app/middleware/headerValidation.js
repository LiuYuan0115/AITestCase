const _ = require('lodash');
const { languageMapKeys } = require('../common/i18n');

const validateMap = {
  // 事件追踪
  'x-solvely-request-id': 'string',
  'x-solvely-request-time': 'string',
  // 系统
  'x-solvely-app-version': 'string',
  'x-solvely-language': { type: 'enum', required: true, values: languageMapKeys },
  'x-solvely-platform': 'string',
  // 用户
  'x-solvely-device-id': 'string',
  'x-solvely-user-group-label': 'string',
};

module.exports = () => {
  /**
   * 验证请求头
   * @param {Egg.Context} ctx 上下文
   * @param {Function} next 下一个中间件
   */
  return async (ctx, next) => {
    try {
      const serverTime = Date.now();
      ctx.validate(validateMap, ctx.header);
      const headers = _.pick(ctx.header, Object.keys(validateMap));

      // 转换为驼峰命名
      const headerParams = { serverTime };
      for (const [key, value] of Object.entries(headers)) {
        const newKey = _.camelCase(key.replace('x-solvely-', ''));
        if (key === 'x-solvely-request-time') {
          headerParams[newKey] = Number(value);
        } else {
          headerParams[newKey] = value;
        }
      }
      ctx.__updateQuestionInfo(headerParams);
      ctx.__updateQuestionInfo({ __headers__: headers });
      ctx.__initLogger(headerParams);
    } catch (error) {
      ctx.status = 400;
      ctx.body = { statusCode: 400, data: error };
      return;
    }
    await next();
  };
};
