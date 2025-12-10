'use strict';

module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW } = app.Sequelize;

  const userExtendInfo = app.model.define(
    'userExtendInfo',
    {
      deviceId: {
        field: 'deviceId',
        unique: true,
        type: STRING,
        comment: '设备id',
      },
      updateCount: {
        field: 'updateCount',
        type: INTEGER,
        comment: '用户更新信息次数',
        defaultValue: 1,
      },
      isNeFeedback: {
        field: 'isNeFeedback',
        type: INTEGER,
        comment: '是否有过负反馈：0-没有，1-有',
        defaultValue: 0,
      },
      isEnRegion: {
        field: 'isEnRegion',
        type: INTEGER,
        comment: '是否属英大区,0:否,1:是',
        defaultValue: -1,
      },
      isUsRegion: {
        field: 'isUsRegion',
        type: INTEGER,
        comment: '是否属美大区,0:否,1:是',
        defaultValue: -1,
      },
      joinedCommunity: {
        field: 'joinedCommunity',
        type: STRING,
        comment: '加入的社群',
      },
      defaultAnswerStyle: {
        field: 'defaultAnswerStyle',
        type: STRING,
        comment: '默认解题风格',
      },
      defaultAnswerLanguage: {
        field: 'defaultAnswerLanguage',
        type: STRING,
        comment: '默认解题语言',
      },
      intercomUserHash: {
        field: 'intercomUserHash',
        type: STRING,
        comment: 'Intercom用户哈希',
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
      bucketId: {
        field: 'bucketId',
        type: STRING,
        comment: 'bucket标识',
      },
      abTestTags: {
        field: 'abTestTags',
        type: STRING,
        comment: 'abTest实验标签',
      },
      abTestAssignments: {
        field: 'abTestAssignments',
        type: STRING,
        comment: '新 ABTest 实验标签',
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: 'userExtendInfo',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return userExtendInfo;
};
