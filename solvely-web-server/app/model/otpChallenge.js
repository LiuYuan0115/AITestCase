'use strict';

module.exports = (app) => {
  const { INTEGER, TINYINT, DATE, STRING, NOW } = app.Sequelize;

  const otpChallenge = app.model.define(
    'otpChallenge',
    {
      id: {
        field: 'id',
        type: INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        comment: '自增id',
      },
      challengeId: {
        field: 'challengeId',
        type: STRING(64),
        allowNull: false,
        unique: true,
        comment: '一次性id（base64url/uuid等）',
      },
      email: {
        field: 'email',
        type: STRING(100),
        allowNull: false,
        comment: '目标邮箱（统一小写）',
      },
      purpose: {
        field: 'purpose',
        type: TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        comment: '用途: 1:login',
      },
      channel: {
        field: 'channel',
        type: STRING(10),
        allowNull: false,
        defaultValue: 'email',
        comment: '发送通道: email/sms',
      },
      codeHash: {
        field: 'codeHash',
        type: STRING(64),
        allowNull: false,
        comment: '验证码HMAC-SHA256十六进制(不存明文)',
      },
      attempts: {
        field: 'attempts',
        type: INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '已尝试次数',
      },
      maxAttempts: {
        field: 'maxAttempts',
        type: INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: '最大尝试次数',
      },
      resendCount: {
        field: 'resendCount',
        type: INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '重发次数',
      },
      ip: {
        field: 'ip',
        type: STRING(45),
        comment: '请求IP(IPv4/IPv6)',
      },
      expireTime: {
        field: 'expireTime',
        type: DATE,
        allowNull: false,
        comment: '过期时间',
      },
      useTime: {
        field: 'useTime',
        type: DATE,
        comment: '验证成功时间(一次性使用)',
      },
      supersededTime: {
        field: 'supersededTime',
        type: DATE,
        comment: '被新验证码替代的时间(失效标记)',
      },
      createTime: {
        field: 'createTime',
        type: DATE,
        defaultValue: NOW,
        allowNull: false,
      },
      updateTime: {
        field: 'updateTime',
        type: DATE,
        defaultValue: NOW,
        allowNull: false,
      },
      deleteTime: {
        field: 'deleteTime',
        type: DATE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: 'otpChallenge',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime',
      updatedAt: 'updateTime',
      deletedAt: 'deleteTime',
    },
  );

  return otpChallenge;
};
