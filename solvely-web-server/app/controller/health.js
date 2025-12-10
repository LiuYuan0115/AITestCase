const { Controller } = require('egg');

class HomeController extends Controller {
  async check() {
    const { ctx } = this;
    ctx.body = 'ok';
  }
}

module.exports = HomeController;
