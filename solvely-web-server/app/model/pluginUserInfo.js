module.exports = (app) => {
  const { INTEGER, TINYINT, STRING, DATE, NOW } = app.Sequelize;

  const pluginUserInfo = app.model.define(
    'pluginUserInfo',
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
        type: STRING(255),
        allowNull: false,
        comment: '用户账号唯一ID',
      },
      pluginUuid: {
        field: 'pluginUuid',
        type: STRING(255),
        allowNull: false,
        comment: '插件唯一UUID',
      },
      freeQuota: {
        field: 'freeQuota',
        type: INTEGER,
        defaultValue: 2,
        comment: '插件设备维度剩余免费解题次数',
      },
      freeTrialCount: {
        field: 'freeTrialCount',
        type: INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: '免费试用次数',
      },
      isNewUser: {
        field: 'isNewUser',
        type: TINYINT,
        defaultValue: 0,
        comment: '是否为新用户: 0-老用户, 1-新用户（UUID功能上线后首次登录）',
      },
      browserType: {
        field: 'browserType',
        type: STRING(50),
        allowNull: true,
        comment: '浏览器类型',
      },
      browserVersion: {
        field: 'browserVersion',
        type: STRING(50),
        allowNull: true,
        comment: '浏览器版本',
      },
      pluginVersion: {
        field: 'pluginVersion',
        type: STRING(50),
        allowNull: true,
        comment: '插件版本',
      },
      installSource: {
        field: 'installSource',
        type: STRING(50),
        allowNull: true,
        comment: '安装来源',
      },
      installTime: {
        field: 'installTime',
        type: DATE,
        allowNull: true,
        comment: '安装时间',
      },
      lastActiveTime: {
        field: 'lastActiveTime',
        type: DATE,
        allowNull: true,
        comment: '最后活跃时间',
      },
      metadata: {
        field: 'metadata',
        type: STRING('TEXT'),
        allowNull: true,
        comment: '其他元数据',
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
        comment: '删除时间',
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: 'pluginUserInfo',
      underscored: true,
      createdAt: 'createTime',
      updatedAt: 'updateTime',
      indexes: [
        {
          name: 'idx_device_id',
          fields: ['deviceId'],
        },
        {
          name: 'idx_plugin_uuid',
          unique: true,
          fields: ['pluginUuid'],
        },
        {
          name: 'idx_device_uuid',
          unique: true,
          fields: ['deviceId', 'pluginUuid'],
        },
      ],
    },
  );

  return pluginUserInfo;
};
