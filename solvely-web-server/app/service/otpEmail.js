'use strict';

const { Service } = require('egg');
const crypto = require('crypto');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

class OtpEmailService extends Service {
  /**
   * Send OTP email.
   * @param {{ email: string }} payload
   * @return {Promise<{ ok: boolean, status?: 'pending' }>}
   */
  async sendOtpEmail({ email }) {
    const ctx = this.ctx;
    const app = this.app;
    const emailLower = String(email || '')
      .trim()
      .toLowerCase();
    // Basic email format validation to avoid SES InvalidParameterValue
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailLower || !emailRegex.test(emailLower)) {
      const err = new Error('invalid email');
      err.status = 400;
      throw err;
    }
    const purpose = 1;
    const now = new Date();
    const ip = (ctx.get('x-forwarded-for') || '').split(',')[0].trim() || ctx.ip;
    const { Op } = app.Sequelize;

    // Read SES config
    const sesCfg = app.config.aws?.ses || {};
    const region = sesCfg.region;
    const credentials = sesCfg.credentials || {};
    const otpPepper = credentials.otpPepper;
    const fromEmail = sesCfg.email;

    // Built-in strategy params (as requested)
    const ttlSec = 600;
    // const cooldownSec = 60;
    // const emailWindowSec = 600;
    // const emailWindowLimit = 5;
    // const ipWindowSec = 600;
    // const ipWindowLimit = 30;
    const maxAttempts = 5;

    // Window limits
    // const emailWindowStart = new Date(now.getTime() - emailWindowSec * 1000);
    // const ipWindowStart = new Date(now.getTime() - ipWindowSec * 1000);

    // Email window
    // const emailCount = await ctx.model.OtpChallenge.count({
    //   where: {
    //     email: emailLower,
    //     createTime: { [Op.gt]: emailWindowStart },
    //   },
    // });
    // if (emailCount >= emailWindowLimit) {
    //   const err = new Error('rate limited');
    //   err.status = 429;
    //   throw err;
    // }

    // IP window
    // if (ip) {
    //   const ipCount = await ctx.model.OtpChallenge.count({
    //     where: {
    //       ip,
    //       createTime: { [Op.gt]: ipWindowStart },
    //     },
    //   });
    //   if (ipCount >= ipWindowLimit) {
    //     const err = new Error('rate limited');
    //     err.status = 429;
    //     throw err;
    //   }
    // }

    // Cooldown: latest record for email+purpose
    // const lastOne = await ctx.model.OtpChallenge.findOne({
    //   where: { email: emailLower, purpose },
    //   order: [['createTime', 'DESC']],
    //   raw: true,
    // });
    // if (lastOne && now.getTime() - new Date(lastOne.createTime).getTime() < cooldownSec * 1000) {
    //   const err = new Error('cooldown');
    //   err.status = 429;
    //   throw err;
    // }

    // Active challenge reuse
    const active = await ctx.model.OtpChallenge.findOne({
      where: {
        email: emailLower,
        purpose,
        useTime: null,
        supersededTime: null,
        expireTime: { [Op.gt]: now },
      },
      order: [['createTime', 'DESC']],
      raw: true,
    });

    let challengeId;
    let code;
    if (active) {
      // resend same code
      challengeId = active.challengeId;
      code = this._deriveCode(otpPepper, emailLower, challengeId, purpose);
      await ctx.model.OtpChallenge.update(
        { resendCount: active.resendCount + 1, updateTime: now },
        { where: { id: active.id } },
      );
    } else {
      // new challenge
      challengeId = crypto.randomBytes(16).toString('base64url');
      code = this._deriveCode(otpPepper, emailLower, challengeId, purpose);
      const codeHash = this._calcCodeHash(otpPepper, emailLower, code, challengeId, purpose);
      const expireTime = new Date(now.getTime() + ttlSec * 1000);
      await ctx.model.OtpChallenge.create({
        challengeId,
        email: emailLower,
        purpose,
        channel: 'email',
        codeHash,
        attempts: 0,
        maxAttempts,
        resendCount: 0,
        ip: ip || null,
        expireTime,
        createTime: now,
        updateTime: now,
      });
    }

    // Send email via SES (v3)
    const ses = new SESClient(sesCfg.env === 'dev' ? { region, credentials } : { region });
    const subject = `${code} is your Solvely.ai verification code.`;
    const html = `
<html>
  <head>
    <title>${code} is your Solvely.ai verification code.</title>
  </head>
  <body>
      <p><b>Please enter the 4-digit code on Solvely.ai to verify your email address.</b></p>
      <p><b>${code}</b></p>
      <p><small>Please don't reply to this automatically generated service email. If you have any feedback, feel free to contact</small></p>
      <p><small>support@solvely.ai</small></p>
      <p>Solvely.ai Team</p>
  </body>
</html>`;
    const text = `Please enter the 4-digit code on Solvely.ai to verify your email address.\n${code}\nPlease don't reply to this automatically generated service email. If you have any feedback, feel free to contact\nsupport@solvely.ai\nSolvely.ai Team`;

    const params = {
      Source: fromEmail,
      Destination: { ToAddresses: [emailLower] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: html },
          Text: { Data: text },
        },
      },
    };

    try {
      await ses.send(new SendEmailCommand(params));
    } catch (e) {
      this.ctx.logger.error('SES send failed', e);
      const err = new Error('send failed');
      err.status = e?.$metadata?.httpStatusCode || 500;
      throw err;
    }

    return { ok: true, status: 'pending' };
  }

  /**
   * Verify OTP email code.
   * @param {{ email: string, code: string }} payload
   * @return {Promise<{ ok: boolean }>}
   */
  async verifyOtpEmail({ email, code }) {
    const ctx = this.ctx;
    const app = this.app;
    const emailLower = String(email || '')
      .trim()
      .toLowerCase();
    const codeStr = String(code || '').trim();
    const purpose = 1;
    const now = new Date();
    const { Op } = app.Sequelize;

    const sesCfg = app.config.aws?.ses || {};
    const credentials = sesCfg.credentials || {};
    const otpPepper = credentials.otpPepper;

    // Latest active challenge
    const row = await ctx.model.OtpChallenge.findOne({
      where: {
        email: emailLower,
        purpose,
        useTime: null,
        supersededTime: null,
        expireTime: { [Op.gt]: now },
        attempts: { [Op.lt]: 5 },
      },
      order: [['createTime', 'DESC']],
      raw: true,
    });
    if (!row) {
      return { ok: false };
    }

    const recalc = this._calcCodeHash(otpPepper, emailLower, codeStr, row.challengeId, purpose);
    try {
      const a = Buffer.from(recalc, 'hex');
      const b = Buffer.from(row.codeHash || '', 'hex');
      if (a.length !== b.length) {
        // lengths differ -> treat as invalid without leaking timing
        await ctx.model.OtpChallenge.update(
          { attempts: Math.min((row.attempts || 0) + 1, row.maxAttempts || 5) },
          { where: { id: row.id } },
        );
        return { ok: false };
      }
      const isEqual = crypto.timingSafeEqual(a, b);
      if (!isEqual) {
        await ctx.model.OtpChallenge.update(
          { attempts: Math.min((row.attempts || 0) + 1, row.maxAttempts || 5) },
          { where: { id: row.id } },
        );
        return { ok: false };
      }
    } catch (e) {
      // Any error -> treat as invalid
      await ctx.model.OtpChallenge.update(
        { attempts: Math.min((row.attempts || 0) + 1, row.maxAttempts || 5) },
        { where: { id: row.id } },
      );
      return { ok: false };
    }

    // Mark used and invalidate others (same email/purpose)
    await ctx.model.OtpChallenge.update(
      { useTime: now, updateTime: now },
      { where: { id: row.id } },
    );
    await ctx.model.OtpChallenge.update(
      { supersededTime: now },
      {
        where: {
          email: emailLower,
          purpose,
          id: { [Op.ne]: row.id },
          useTime: null,
          supersededTime: null,
        },
      },
    );

    return { ok: true };
  }

  _deriveCode(pepper, emailLower, challengeId, purpose) {
    const h = crypto.createHmac('sha256', String(pepper || ''));
    h.update(`codeGen:${emailLower}:${challengeId}:${purpose}`);
    const buf = h.digest();
    const num = buf.readUInt32BE(0) % 10000;
    return String(num).padStart(4, '0');
  }

  _calcCodeHash(pepper, emailLower, code, challengeId, purpose) {
    const h = crypto.createHmac('sha256', String(pepper || ''));
    h.update(`${emailLower}:${code}:${challengeId}:${purpose}`);
    return h.digest('hex');
  }
}

module.exports = OtpEmailService;
