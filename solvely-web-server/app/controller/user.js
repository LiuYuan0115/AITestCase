const { Controller } = require('egg');
const _ = require('lodash');
class UserController extends Controller {
  // 邮箱验证码登录 - 发送验证码
  async sendEmailCode() {
    const { ctx } = this;
    try {
      ctx.validate(
        {
          email: 'string',
        },
        ctx.request.body,
      );
    } catch (e) {
      ctx.body = { code: 400, message: 'invalid params' };
      return;
    }

    const { email } = ctx.request.body;

    ctx.service.point.posthogPoint(
      ctx.helper._md5(email.toLowerCase().trim()),
      'Plugin_Server_Email_Login_Send',
      { email },
    );

    try {
      const r = await ctx.service.otpEmail.sendOtpEmail({ email });
      if (r && r.ok) {
        ctx.body = { code: 0, data: { status: r.status || 'pending' } };
        return;
      }
      ctx.body = { code: 400, message: 'send code failed' };
    } catch (err) {
      ctx.logger.error('sendEmailCode error', err);
      ctx.service.point.posthogPoint(
        ctx.helper._md5(email.toLowerCase().trim()),
        'Plugin_Server_Email_Login_Send_Error',
        {
          email,
          errorInfo: String(err),
        },
      );
      ctx.body = { code: err?.status || 400, message: 'send code failed' };
    }
  }

  // 邮箱验证码登录 - 校验验证码并获取/创建用户
  async verifyEmailCode() {
    const { ctx } = this;
    try {
      ctx.validate(
        {
          email: 'string',
          code: 'string',
        },
        ctx.request.body,
      );
    } catch (e) {
      ctx.body = { code: 400, message: 'invalid params' };
      return;
    }

    const { email, code } = ctx.request.body;

    ctx.service.point.posthogPoint(
      ctx.helper._md5(email.toLowerCase().trim()),
      'Plugin_Server_Email_Login_Verify',
      { email },
    );

    try {
      const r = await ctx.service.otpEmail.verifyOtpEmail({ email, code });
      if (!r || !r.ok) {
        ctx.body = { code: 400, message: 'invalid code' };
        return;
      }
    } catch (err) {
      ctx.logger.error('verifyEmailCode check error', err);
      ctx.service.point.posthogPoint(
        ctx.helper._md5(email.toLowerCase().trim()),
        'Plugin_Server_Email_Login_Verify_Error',
        {
          email,
          errorInfo: String(err),
        },
      );
      ctx.body = { code: err?.status || 400, message: 'verify code failed' };
      return;
    }

    try {
      const auth = ctx.firebaseAdmin.auth();
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (err) {
        userRecord = await auth.createUser({ email, emailVerified: true });
      }

      const { uid, email: userEmail, displayName, photoURL } = userRecord || {};
      const customToken = await auth.createCustomToken(uid, {});

      ctx.body = {
        code: 0,
        data: {
          uid,
          email: userEmail || email,
          displayName: displayName || null,
          photoURL: photoURL || null,
          customToken,
        },
      };
    } catch (err) {
      ctx.logger.error('verifyEmailCode firebase error', err);
      ctx.body = { code: 400, message: 'firebase error' };
    }
  }
  /**
   * 获取 Firebase ID Token（服务端用 Admin 生成 customToken，再换取 idToken）
   * 仅返回 idToken 与 expiresIn（秒），不返回 refreshToken
   */
  async getFirebaseIdToken() {
    const { ctx, app } = this;
    try {
      const uid = ctx.user.uid;
      const customToken = await ctx.firebaseAdmin.auth().createCustomToken(uid, {});

      const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${app.config?.firebaseWebApiKey}`;
      const res = await ctx.curl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        dataType: 'json',
        data: {
          token: customToken,
          returnSecureToken: true,
        },
        timeout: 10000,
      });

      if (res.status !== 200 || !res.data || !res.data.idToken) {
        ctx.logger.error('signInWithCustomToken failed', { status: res.status, data: res.data });
        ctx.status = 502;
        ctx.body = { message: 'signInWithCustomToken failed' };
        return;
      }

      const { idToken, expiresIn } = res.data;
      ctx.body = { idToken, expiresIn: Number(expiresIn) };
    } catch (err) {
      ctx.logger.error('getFirebaseIdToken error', err);
      ctx.throw(502, 'signInWithCustomToken failed');
    }
  }
  /**
   * 获取jwt token
   */
  async getToken() {
    const { ctx } = this;
    const { uid } = ctx.query;
    const hasUser = await ctx.helper.checkFirebaseUid(uid);
    if (!hasUser) {
      ctx.status = 401;
      ctx.body = {
        code: 1,
        data: {},
        message: '用户不存在',
      };
      return;
    }
    const holdTime = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30天过期
    const token = this.app.jwt.sign({ uid, expireTime: holdTime }, this.app.config.jwt.secret);
    // 当用户登录、切换账号时，删除s_bucket，防止还是用的上一个账号的bucket
    ctx.cookies.set('s_bucket', null, {
      signed: false,
      httpOnly: false,
      sameSite: 'Strict',
      path: '/',
    });
    ctx.body = token;
    const ip = ctx.helper.getRealIp();
    ip && ctx.service.point.firebasePoint(uid, 'Web_User_IP', { ip });
  }
  /**
   * 获取用户信息
   */
  async info() {
    const { ctx } = this;
    const user = await ctx.service.user.find(ctx.user.uid);
    // 无用户信息，创建用户
    if (_.isEmpty(user)) {
      ctx.body = {
        isSigned: 0,
      };
    } else {
      ctx.body = user;
    }
  }
  /**
   * 上报用户信息
   */
  async report() {
    const { ctx } = this;
    const data = ctx.request.body;
    const result = await ctx.service.user.report(data);
    ctx.body = result;
  }
  /**
   * feedback
   */
  async feedback() {
    const { ctx } = this;
    ctx.validate(
      {
        system: 'string',
        title: 'string',
        description: 'string',
        time: 'number',
      },
      ctx.request.body,
    );
    await ctx.service.user.feedback();
    ctx.body = null;
  }
  /**
   * 获取余额
   * 支持两种独立模式：
   * 1. 无 pluginUuid：返回 deviceId 维度的完整余额（Balance 表）
   * 2. 有 pluginUuid：只返回 pluginUuid 维度的 plugin 余额（PluginUserInfo 表），其他字段为 0
   */
  async balance() {
    const { ctx } = this;

    // 从请求头获取 pluginUuid
    const pluginUuid = ctx.request.header['x-plugin-uuid'];

    let balance;

    if (pluginUuid) {
      // 模式1：有 pluginUuid，只返回 pluginUuid 维度的 plugin
      balance = await ctx.service.balance.getPluginUuidBalance(ctx.user.uid, pluginUuid);
    } else {
      // 模式2：无 pluginUuid，返回 deviceId 维度的完整余额
      balance = await ctx.service.balance.getDiamond();
    }

    ctx.body = {
      code: 0,
      data: balance,
    };
  }
  /**
   * 上报用户信息专用
   */
  async updateUserInfo() {
    const { ctx } = this;
    const data = ctx.request.body;
    const result = await ctx.service.user.updateUserInfo(data);
    ctx.body = result;
  }
  /**
   * 上报插件新用户信息（包含 pluginUuid）
   * pluginUuid 可选：
   * - 有 pluginUuid：处理 PluginUserInfo 表和 pluginUuid 维度的 ABTest
   * - 无 pluginUuid：只处理 deviceId 维度的 ABTest
   */
  async updatePluginUserInfo() {
    const { ctx } = this;
    const deviceId = ctx.user.uid;

    // 从请求头获取 pluginUuid（可选）
    const pluginUuid = ctx.request.header['x-plugin-uuid'];

    try {
      const {
        assignments = {},
        isSigned, // 由插件传递，不查询数据库
      } = ctx.request.body || {};

      const responseData = {};

      // ========== 有 pluginUuid 时的处理 ==========
      if (pluginUuid) {
        // 1. 处理 PluginUserInfo 表
        let pluginUserInfo = await ctx.model.PluginUserInfo.findOne({
          raw: true,
          where: {
            pluginUuid,
          },
        });

        if (!pluginUserInfo) {
          // 首次创建：根据插件传递的 isSigned 判断是否新用户
          const isNewUser = isSigned === 0 ? 1 : 0;

          pluginUserInfo = await ctx.model.PluginUserInfo.create({
            deviceId,
            pluginUuid,
            freeQuota: 2,
            isNewUser,
          });

          console.log(
            `[PluginUserInfo] 创建成功 - deviceId: ${deviceId}, uuid: ${pluginUuid}, isNewUser: ${isNewUser}`,
          );
        }

        responseData.isNewUser = pluginUserInfo.isNewUser;
      }
      // ========== 无 pluginUuid 时的处理 ==========
      else {
        // ABTest 逻辑（deviceId 维度）
        if (assignments?.TEST_Plugin_Weblogin === 'Test') {
          const balance = await ctx.model.Balance.findOne({
            raw: true,
            attributes: ['plugin'],
            where: { deviceId },
          });

          if (balance && balance.plugin === 5) {
            await ctx.model.Balance.update({ plugin: 2 }, { where: { deviceId } });
            console.log(`[ABTest] deviceId维度 plugin 5->2 - deviceId: ${deviceId}`);
          }
        }
      }

      ctx.body = {
        code: 0,
        data: responseData,
        message: 'success',
      };
    } catch (error) {
      ctx.logger.error(
        `[updatePluginUserInfo] 失败 - deviceId: ${deviceId}, uuid: ${pluginUuid || 'N/A'}`,
        error,
      );
      ctx.body = {
        code: -1,
        message: 'update plugin user info failed',
      };
    }
  }
  /**
   * 完成插件试用订阅（freeTrialCount + 1）
   * 当用户完成试用订阅支付后调用此接口
   */
  async completePluginTrial() {
    const { ctx } = this;
    const pluginUuid = ctx.request.header['x-plugin-uuid'];

    if (!pluginUuid) {
      ctx.body = {
        code: 400,
        message: 'x-plugin-uuid header is required',
      };
      return;
    }

    try {
      // 查询记录
      const pluginUserInfo = await ctx.model.PluginUserInfo.findOne({
        where: {
          pluginUuid,
        },
      });

      if (!pluginUserInfo) {
        ctx.body = {
          code: 404,
          message: 'Plugin user info not found',
        };
        return;
      }

      // 原子性更新：freeTrialCount + 1
      await ctx.model.PluginUserInfo.increment('freeTrialCount', {
        by: 1,
        where: {
          pluginUuid,
        },
      });

      // 重新加载获取最新值
      await pluginUserInfo.reload();

      ctx.body = {
        code: 0,
        data: {
          freeTrialCount: pluginUserInfo.freeTrialCount,
        },
        message: 'Trial completed successfully',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: 'Internal server error',
      };
    }
  }
  /**
   * 单独修改用户信息某个字段
   **/
  async updateUserInfoItem() {
    const { ctx } = this;
    const body = ctx.request.body;
    const changeList = [
      'userName',
      'webPushToken',
      'webAdjustUserId',
      'marketingType',
      'source',
      'grade',
    ];
    // 只可以修改changeList中的字段
    const changeKeys = Object.keys(body);
    const isChange = changeKeys.every((item) => changeList.includes(item));
    if (!isChange) {
      ctx.throw(400, '参数错误');
    }
    /**
     * @description marketingType 当勾选了接受邮件时，值为1，当取消勾选值为null，所以判空时只看是否是understand就行了，null要放过
     * @example https://pf6xrzskv9.feishu.cn/wiki/TcscwHOlOifhIxkiA3HcmSyxnYb#share-VYcad4xKhomarsxSvoucd5q7npb
     */
    const { userName, source, webPushToken, webAdjustUserId, marketingType, grade } = body;
    if (
      !userName &&
      !source &&
      !grade &&
      !webPushToken &&
      !webAdjustUserId &&
      marketingType === undefined
    ) {
      ctx.throw(400, '无有效参数');
    }
    const result = await ctx.service.user.updateUserInfoItem(ctx.user.uid, { ...body });
    ctx.body = result;
  }
  /**
   * 修改用户年级（userInfo.grade）
   */
  async updateUserGrade() {
    const { ctx } = this;
    try {
      ctx.validate(
        {
          grade: 'string',
        },
        ctx.request.body,
      );
    } catch (e) {
      ctx.body = { code: 400, message: 'invalid params' };
      return;
    }

    const { grade } = ctx.request.body;
    try {
      const [affectedCount] = await ctx.model.UserInfo.update(
        { grade },
        { where: { deviceId: ctx.user.uid } },
      );
      if (affectedCount === 0) {
        ctx.body = { code: -1, msg: 'User info not found' };
        return;
      }
      ctx.body = { code: 0, msg: 'User info updated successfully' };
    } catch (err) {
      ctx.logger.error('updateUserGrade error', err);
      ctx.throw(500, 'update user grade failed');
    }
  }
  // 生成二维码
  async qrCode() {
    const { ctx } = this;
    const data = ctx.request.query;
    const result = await ctx.service.common.generateQrCode(data);
    ctx.body = result;
  }
  // 校验二维码
  async qrCodeCheck() {
    const { ctx } = this;
    ctx.validate(
      {
        qrCodeId: 'string',
      },
      ctx.request.query,
    );
    const { qrCodeId } = ctx.request.query;
    const result = await ctx.service.common.checkQrCode(qrCodeId);
    ctx.body = result;
  }
  // 注销二维码
  async qrCodeLogout() {
    const { ctx } = this;
    ctx.validate(
      {
        qrCodeId: 'string',
      },
      ctx.request.query,
    );
    const { qrCodeId } = ctx.request.query;
    const result = await ctx.service.common.logoutQrCode(qrCodeId);
    ctx.body = result;
  }
  /**
   * 查询email是否已注册
   * 用户不是都有邮箱的：
   *  1. facebook登录时，无邮箱
   *  2. 用户使用apple隐私登录，相当于无邮箱（私密邮箱，不能用）
   *  3. 用户使用google登录，有邮箱
   *  4. 用户使用email/password或者email-link登录，有邮箱
   *  5. 在库内，还有一部分不明原因/历史原因导致的无邮箱（firebase库有，userinfo没有）
   */
  async checkEmail() {
    const { ctx } = this;
    ctx.validate(
      {
        email: 'string',
      },
      ctx.query,
    );
    const email = ctx.query.email;
    const result = await ctx.service.user.checkEmail(email);
    ctx.body = result;
  }
  // 获取是否有需要上报的埋点
  async getTrack() {
    const { ctx } = this;
    const result = await ctx.service.point.getTrack(ctx.user.uid);
    ctx.body = result;
  }
  // 获取用户扩展信息
  async getExtendInfo() {
    const { ctx } = this;
    const result = await ctx.service.user.getExtendInfo(ctx.user.uid);
    ctx.body = result;
  }
  // 获取用户扩展信息
  async setExperimentsDynamic() {
    const { ctx } = this;
    ctx.validate(
      {
        tag: 'string',
      },
      ctx.request.body,
    );
    const { tag } = ctx.request.body;
    const result = await ctx.service.user.setExperimentsDynamic(tag);
    ctx.body = result;
  }
  // 更新用户扩展信息
  async updateExtendInfo() {
    const { ctx } = this;
    const { defaultAnswerStyle, defaultAnswerLanguage } = ctx.request.body;

    ctx.validate({
      defaultAnswerStyle: { type: 'string', required: false },
      defaultAnswerLanguage: { type: 'string', required: false },
    });

    if (!defaultAnswerStyle && !defaultAnswerLanguage) {
      ctx.throw(400, '必须提供 defaultAnswerStyle 或 defaultAnswerLanguage 中的至少一个');
    }

    const updateData = {
      ...(defaultAnswerStyle && { defaultAnswerStyle }),
      ...(defaultAnswerLanguage && { defaultAnswerLanguage }),
    };

    ctx.body = await ctx.service.user.updateExtendInfo(ctx.user.uid, updateData);
  }
  // 获取用户最近使用的语言
  async getRecentLanguage() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/user/recentTranslationLanguage');
  }
  // 上报用户功能使用情况
  async postRengage() {
    const body = this.ctx.request.body;
    await this.ctx.helper.proxy('/solvelyPubServer/v1/customerIO/push/user', {
      ...body,
    });
  }

  // 新增插件登录rengage上报
  async pluginLoginRengage() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/customerIO/push/user', {
      deviceId: this.ctx.user.uid,
      userInfo: {
        Plugin_Login: 1,
      },
    });
  }
  /**
   * 修改插件用户余额（仅限非生产环境）
   * 用于调试工具修改 pluginUserInfo.freeQuota
   */
  async updatePluginUserBalance() {
    const { ctx, app } = this;

    // 检查 plugin.env 是否为 test，不满足直接返回
    if (app.config?.plugin?.env !== 'test') {
      ctx.body = {};
      return;
    }

    try {
      ctx.validate(
        {
          pluginUuid: 'string',
          freeQuota: 'number',
        },
        ctx.request.body,
      );
    } catch (e) {
      ctx.body = { code: 400, message: 'invalid params' };
      return;
    }

    const { pluginUuid, freeQuota } = ctx.request.body;
    const deviceId = ctx.user.uid;

    try {
      // 查询记录是否存在
      const pluginUserInfo = await ctx.model.PluginUserInfo.findOne({
        where: {
          pluginUuid,
        },
      });

      if (!pluginUserInfo) {
        ctx.body = {
          code: 404,
          message: 'Plugin user info not found',
        };
        return;
      }

      // 更新 freeQuota
      await ctx.model.PluginUserInfo.update(
        { freeQuota },
        {
          where: {
            pluginUuid,
          },
        },
      );

      console.log(
        `[UpdatePluginUserBalance] 修改成功 - deviceId: ${deviceId}, pluginUuid: ${pluginUuid}, freeQuota: ${freeQuota}`,
      );

      ctx.body = {
        code: 0,
        data: {
          pluginUuid,
          freeQuota,
        },
        message: '余额修改成功',
      };
    } catch (error) {
      ctx.logger.error('updatePluginUserBalance error', error);
      ctx.body = {
        code: 500,
        message: 'Internal server error',
      };
    }
  }
}

module.exports = UserController;
