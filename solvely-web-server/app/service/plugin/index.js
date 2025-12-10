const { Service } = require('egg');

class PluginService extends Service {
  constructor(ctx) {
    super(ctx);
    // 初始化子服务
    this.youtube = new (require('./youtube'))(ctx);
    // this.summary = new (require('./summary'))(ctx);
  }
}

module.exports = PluginService;
