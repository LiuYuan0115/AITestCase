'use strict';

module.exports = (app) => {
  // egg-sequelize插件会将Sequelize类绑定到app上线，从里面可以取到各种静态类型
  // egg默认将文件名改为大驼峰格式
  // 表字段会egg会自动改为word_word格式，使用field字段可自定义表字段
  const { INTEGER, DATE, STRING, NOW, BIGINT } = app.Sequelize;

  const questionRefund = app.model.define(
    'questionRefund',
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
        index: true,
        type: STRING,
        comment: '设备id',
      },
      solvelyTime: {
        field: 'solvelyTime',
        type: BIGINT,
        comment: '问题标识',
      },
      questionId: {
        field: 'questionId',
        type: STRING(200),
        comment: '题目Id',
      },
      isRefund: {
        field: 'isRefund',
        type: INTEGER,
        comment: '是否退钻, 0:未退,1:已退',
        defaultValue: 0,
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
      tableName: 'questionRefund',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return questionRefund;
};
