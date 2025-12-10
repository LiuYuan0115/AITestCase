const { Controller } = require('egg');

class BaseController extends Controller {
  async success(data, message = 'SUCCESS') {
    const dataType = typeof data;
    const body = { code: 0, message };
    if (dataType === 'object') {
      body.data = data;
    } else if (dataType === 'string') {
      body.message = data;
    }
    body.success = true;
    this.ctx.body = body;
  }

  async fail(code, message = 'FAIL') {
    if (typeof code === 'object') {
      this.ctx.body = code;
      this.ctx.body.success = false;
    } else {
      this.ctx.body = { code, message, success: false };
    }
  }
}

module.exports = BaseController;
