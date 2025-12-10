module.exports = () => {
  return async function responseTime(ctx, next) {
    await next();

    const { method, path, user, query, request, response, body, logger } = ctx;
    const { uid = 'unknown' } = user || {};

    // 需要简化响应日志的路径
    const shortLogPaths = {
      get: ['/question'],
      post: ['/plugin/youtube/summaryOutline', '/plugin/youtube/summaryDetails'],
    };

    // 构建日志对象
    const logObj = {
      deviceId: uid,
      request: method === 'GET' ? query : request.body,
      href: request.href || '',
      response: {},
    };

    // 处理响应内容
    if (response.type === 'application/octet-stream') {
      // 二进制流响应保持空对象
      logObj.response = {};
    } else if (shortLogPaths.get.includes(path) || shortLogPaths.post.includes(path)) {
      // 特定路径使用简化响应
      logObj.response = {
        m: '...too many fields...',
      };
    } else {
      // 常规响应
      logObj.response = body || {};
    }

    // 输出日志
    logger.info(JSON.stringify(logObj));
  };
};
