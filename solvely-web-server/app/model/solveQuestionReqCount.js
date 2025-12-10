'use strict';

module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW, BIGINT } = app.Sequelize;

  const solveQuestionReqCount = app.model.define(
    'solveQuestionReqCount',
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
        type: STRING,
        comment: '设备id',
      },
      frequency: {
        field: 'frequency',
        type: INTEGER,
        comment: '解题频次',
      },
      startTime: {
        field: 'startTime',
        type: BIGINT,
        comment: '开始时间',
      },
      endTime: {
        field: 'endTime',
        type: BIGINT,
        comment: '结束时间',
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
      tableName: 'solveQuestionReqCount',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return solveQuestionReqCount;
};
