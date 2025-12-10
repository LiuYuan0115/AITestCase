'use strict';

module.exports = (app, sequelize, modelName) => {
  const { INTEGER, DATE, STRING, TEXT, NOW } = app.Sequelize;

  const questionAskMore = app.model.define(
    modelName || 'questionAskMore_0',
    {
      deviceId: {
        field: 'deviceId',
        type: STRING,
        index: true,
        comment: '设备id',
      },
      questionId: {
        field: 'questionId',
        index: true,
        type: STRING(200),
        comment: '题目Id',
      },
      sessionId: {
        field: 'sessionId',
        index: true,
        type: STRING(64),
        comment: '会话id',
      },
      conversationId: {
        field: 'conversationId',
        index: true,
        type: STRING(64),
        comment: '对话id',
      },
      messageId: {
        field: 'messageId',
        index: true,
        type: STRING(64),
        comment: '消息id',
      },
      role: {
        field: 'role',
        type: INTEGER,
        comment: '角色,1:user,2:assistant',
      },
      content: {
        field: 'content',
        type: TEXT,
        comment: '对话内容',
      },
      gptModel: {
        field: 'gptModel',
        type: STRING(64),
        comment: '使用的模型',
      },
      feedback: {
        field: 'feedback',
        type: INTEGER,
        comment: '反馈, -1:无,1:赞,0:踩',
        defaultValue: -1,
      },
      language: {
        field: 'language',
        type: STRING,
        comment: '语言',
      },
      promptToken: {
        field: 'promptToken',
        type: INTEGER,
        comment: '问句token长度',
      },
      completionToken: {
        field: 'completionToken',
        type: INTEGER,
        comment: '回答token长度',
      },
      costType: {
        field: 'costType',
        type: STRING(64),
        comment: '消耗类型gems/coins/unlimited',
        defaultValue: 'gems',
      },
      associationId: {
        field: 'associationId',
        type: STRING(64),
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
      platform: {
        field: 'platform',
        type: STRING(64),
        comment: '平台',
      },
      step: {
        field: 'step',
        type: INTEGER,
        comment: '步骤',
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: modelName || 'questionAskMore_0',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return questionAskMore;
};
