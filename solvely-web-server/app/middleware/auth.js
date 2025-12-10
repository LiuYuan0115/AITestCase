const Jwt = require('jsonwebtoken');
const version = require('../../package.json').version;

// 自定义 JWT 验证函数
const verifyJwt = (token, ctx) => {
  // JWT 密钥
  const secret = ctx.app.config.jwt.secret;
  try {
    const decoded = Jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * @description 创建中间件函数
 *  1. 对请求进来的结果进行统一校验
 *  2. stream相关的接口在白名单内，是因为前端使用了两种技术:
 *     1. EventSource
 *     2. fetch
 *  这两种都没有经过axios的拦截器处理，故其没有 `Authorization` 头，所以需要加入白名单，由后续业务逻辑做拦截
 */
module.exports = () => {
  return async function (ctx, next) {
    // 如果请求的 URL 在白名单内，则直接放行
    if (
      ctx.url.includes('/token') ||
      ctx.url.includes('/pricing/webhook') ||
      ctx.url.includes('/question/webhook') ||
      ctx.url.includes('/question/follow/webhook') ||
      ctx.url.includes('/stream') ||
      ctx.url.startsWith('/v8') ||
      ctx.url.includes('/product/guest') ||
      ctx.url.includes('/question/il/html/content') ||
      ctx.url.includes('/question/guest/fast/add') ||
      ctx.url.includes('/v9/question/guest/solve') ||
      ctx.url.includes('/v9/question/guest/model/solve') ||
      ctx.url.includes('/guest/uploadurl') ||
      ctx.url.includes('/question/guest/follow/') ||
      ctx.url.includes('/auth/email/code/')
    ) {
      ctx.set('Solvely-Web-Version', version);
      await next();
      return;
    }
    // 获取请求头中的 Authorization Bearer 字段
    const authorization = ctx.headers.authorization;

    if (authorization) {
      // 解析 Authorization Bearer 字段并进行 JWT 验证
      const token = authorization.split(' ')[1];
      const decoded = await verifyJwt(token, ctx);

      if (decoded && typeof decoded === 'object' && decoded.expireTime > Date.now()) {
        // 将用户信息存储在 ctx.user 中，以便后续路由使用
        ctx.user = decoded;
        const abtestStr = ctx.cookies.get('abtest', { signed: false });
        if (abtestStr) {
          ctx.user.abTestTags = abtestStr.split(',');
        }
        ctx.set('Solvely-Web-Version', version);
        await next();
      } else {
        ctx.status = 403;
        ctx.body = { message: 'Invalid token.' };
      }
    } else {
      // 如果没有 Authorization Bearer 字段，则直接返回
      ctx.status = 403;
      ctx.body = { message: 'Invalid token.' };
    }
  };
};
