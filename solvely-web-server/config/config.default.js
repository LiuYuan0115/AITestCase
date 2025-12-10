/* eslint valid-jsdoc: "off" */
const version = require('../package.json').version;
const path = require('path');
const fs = require('fs');
// 常量定义
const CONSTANTS = {
  SOLVE_MODES: {
    TEACH: 'teach',
    FAST: 'fast',
    PLUGIN: 'plugin', // 插件解题
    TEACH_CODE: 2,
    FAST_CODE: 1,
    PLUGIN_CODE: 3,
  },
  LOG_LEVEL: 'INFO',
};

// 通用日志格式化函数
const commonLogFormatter = (name, meta) => {
  return JSON.stringify({
    level: meta.level,
    date: meta.date.replace(' ', 'T').replace(',', '.'),
    method: meta.ctx.method,
    url: meta.ctx.url,
    message: meta.message,
    logType: name,
  });
};

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = (appInfo) => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = (exports = {});

  config.proxy = true;

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1702371093705_7922';

  // add your middleware config here
  config.middleware = ['auth', 'errorHandler', 'responseTime'];

  // config.routerAuth = [ '/token' ]
  config.version = version;
  config.security = {
    csrf: {
      enable: false,
    },
  };

  // CORS 配置
  config.cors = {
    origin(ctx) {
      // 从请求头中获取 origin
      const origin = ctx.get('origin');

      // 允许的域名列表
      const allowedOrigins = [
        'https://solvely.ai',
        'https://dev.solvely.ai',
        'https://dev-gmat.solvely.ai',
        'https://gmat.solvely.ai',
        'https://web-staging.justsolvely.com',
        'https://d3biosj2b3wzh6.cloudfront.net',
      ];

      // 如果是同源请求（没有 origin 头）或者在允许列表中，则允许
      if (!origin || allowedOrigins.includes(origin)) {
        return origin || '*';
      }

      // 其他情况返回 false 拒绝跨域请求
      return false;
    },
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
    credentials: true,
  };

  config.httpclient = {
    request: {
      timeout: 7 * 60 * 1000,
    },
  };

  config.multipart = {
    fields: '100',
    mode: 'file',
    fileSize: '10mb',
    // 设置允许上传的文件类型
    fileExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  };

  config.cluster = {
    listen: {
      path: '',
      port: 7009,
      hostname: '0.0.0.0',
    },
  };

  const env = process.env.SOLVELY_WEB_SERVER_ENV;
  const logPath = env !== 'local' ? '../../logs' : '../logs';

  // 日志配置
  config.logger = {
    level: CONSTANTS.LOG_LEVEL,
    dir: path.join(__dirname, logPath),
    formatter(meta) {
      const { level, paddingMessage, message, ctx } = meta || {};
      const { method, url } = ctx?.request || {};
      const status = ctx?.response?.status;
      const time = parseInt(paddingMessage?.match(/\d+ms/)?.[0] || '0', 10);
      const pureUrl = url?.match(/^[^?]+/)?.[0] || '';

      return JSON.stringify({
        level,
        env,
        httpStatus: status,
        date: meta.date.replace(' ', 'T').replace(',', '.'),
        time,
        method,
        url: pureUrl,
        message,
      });
    },
  };

  // 自定义日志配置
  const loggers = [
    'subscription',
    'balance',
    'fcm',
    'point',
    'order',
    'pay',
    'commonServer',
    'payRecord',
  ];

  config.customLogger = loggers.reduce((acc, name) => {
    acc[`${name}Logger`] = {
      file: path.join(__dirname, logPath, `${name}.log`),
      level: CONSTANTS.LOG_LEVEL,
      formatter: commonLogFormatter.bind(null, name),
    };
    return acc;
  }, {});

  // 日志轮转配置
  config.logrotator = {
    maxDays: 1,
    filesRotateByHour: [],
    hourDelimiter: '-',
  };

  // 业务配置
  const bizConfig = {
    SOLVE_MODES: {
      LIST: [CONSTANTS.SOLVE_MODES.FAST, CONSTANTS.SOLVE_MODES.TEACH, CONSTANTS.SOLVE_MODES.PLUGIN],
      ...CONSTANTS.SOLVE_MODES,
    },
  };

  const configPath = path.resolve(__dirname, env !== 'local' ? `../../server-config` : '../');

  // 读取环境变量
  const envConfigPath = path.resolve(__dirname, configPath, `config.json`);
  // 读取 firebase 配置
  const firebaseConfigPath = path.resolve(__dirname, configPath, `firebaseSolvelyKey.json`);

  // 安全检查
  if (!fs.existsSync(envConfigPath)) {
    throw new Error(`envConfigPath ${envConfigPath} not found`);
  }
  if (!fs.existsSync(firebaseConfigPath)) {
    throw new Error(`firebaseConfigPath ${firebaseConfigPath} not found`);
  }
  const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf8'));
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

  return {
    ...config,
    ...bizConfig,
    ...envConfig,
    firebaseConfig,
  };
};
