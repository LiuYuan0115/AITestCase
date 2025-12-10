'use strict';

module.exports = (app) => {
  const { TEXT, DATE, STRING, NOW } = app.Sequelize;

  const userTestTag = app.model.define(
    'userTestTag',
    {
      deviceId: {
        field: 'deviceId',
        index: true,
        type: STRING,
        comment: '设备id',
      },
      test: {
        field: 'test',
        type: TEXT,
        comment: '用户分组逻辑',
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
      platform: {
        field: 'platform',
        type: STRING,
        comment: '平台',
        allowNull: true,
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
      tableName: 'userTestTag',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return userTestTag;
};
