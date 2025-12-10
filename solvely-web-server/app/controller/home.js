const { Controller } = require('egg');

class HomeController extends Controller {
  async upload() {
    const { ctx } = this;
    const file = ctx.request.files[0];
    // 分别上传到s3
    const url = await ctx.service.question.uploadPictureToS3('', file);

    ctx.body = url;
  }
}

module.exports = HomeController;
