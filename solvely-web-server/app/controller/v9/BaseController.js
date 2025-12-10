const { Controller } = require('egg');
const fs = require('fs');

class BaseController extends Controller {
  success(data = {}, statusCode = 200) {
    this.ctx.body = {
      statusCode,
      data,
    };
  }
  error(data = {}, statusCode = 500) {
    this.ctx.body = {
      statusCode,
      data,
    };
  }

  errorV2(data = {}, statusCode = 500) {
    if (data instanceof Error || typeof data === 'string') {
      this.ctx.body = {
        statusCode,
        data: {
          message: data instanceof Error && data.code !== 'invalid_param' ? data.message : data,
        },
      };
      return;
    }
    this.ctx.body = {
      statusCode,
      data,
    };
  }

  deleteFiles(files = []) {
    const { ctx } = this;
    try {
      (files || []).forEach((file) => {
        if (file && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
      });
    } catch (error) {
      ctx.logger.error('[controller] deleteFiles error', error);
    }
  }
}
module.exports = BaseController;
