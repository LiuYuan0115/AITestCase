'use strict';

module.exports = (app) => {
  const { INTEGER, TINYINT, DATE, STRING, NOW } = app.Sequelize;

  const userInfo = app.model.define(
    'userInfo',
    {
      id: {
        field: 'id',
        type: INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        comment: '自增id',
      },
      deviceId: {
        field: 'deviceId',
        unique: true,
        type: STRING,
        comment: '设备id',
      },
      role: {
        field: 'role',
        type: TINYINT,
        comment: '用户角色: 1:student, 2:parents, 3:teacher, 4:others',
      },
      loginType: {
        field: 'loginType',
        type: STRING(10),
        comment: '登录方式: email,apple,google,facebook',
      },
      isSigned: {
        field: 'isSigned',
        type: INTEGER,
        comment: '是否登录过: 0:未登录,1:已登录',
        defaultValue: 0,
      },
      isReceive: {
        field: 'isReceive',
        type: INTEGER,
        comment: '领取首次将路: 0:未领取,1:领取',
        defaultValue: 0,
      },
      userName: {
        field: 'userName',
        type: STRING,
        comment: '用户姓名',
      },
      email: {
        type: STRING,
        comment: '电子邮箱',
      },
      password: {
        type: STRING,
        comment: '密码',
      },
      userPicture: {
        field: 'userPicture',
        type: STRING,
        comment: '头像',
      },
      appVersion: {
        field: 'appVersion',
        type: STRING(10),
        comment: '使用的app版本',
      },
      system: {
        field: 'system',
        type: STRING(50),
        comment: '使用的系统',
      },
      appleAppId: {
        field: 'appleAppId',
        type: STRING,
        comment: '苹果id',
      },
      adjustUserId: {
        field: 'adjustUserId',
        type: STRING,
        comment: 'adjust用户id',
      },
      idfa: {
        field: 'idfa',
        type: STRING,
        comment: 'adjust广告追踪参数',
      },
      idfv: {
        field: 'idfv',
        type: STRING,
        comment: 'adjust广告追踪参数',
      },
      country: {
        field: 'country',
        type: STRING(10),
        comment: '国家',
      },
      pushToken: {
        field: 'pushToken',
        type: STRING(500),
        comment: '推送token',
      },
      webPushToken: {
        field: 'webPushToken',
        type: STRING,
        comment: 'web推送token',
      },
      grade: {
        field: 'grade',
        type: STRING(50),
        comment: '年级',
      },
      webAdjustUserId: {
        field: 'webAdjustUserId',
        type: STRING,
        comment: 'web adjust用户id',
      },
      userPseudoId: {
        field: 'userPseudoId',
        type: STRING,
        comment: '业务用户ID',
      },
      marketingType: {
        field: 'marketingType',
        type: INTEGER.UNSIGNED,
        comment: '营销类型, EDM:1',
      },
      source: {
        field: 'source',
        type: STRING,
        comment: '来源',
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
      tableName: 'userInfo',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return userInfo;
};
