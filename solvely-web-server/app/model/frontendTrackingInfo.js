module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW } = app.Sequelize;

  const frontendTrackingInfo = app.model.define(
    'frontendTrackingInfo',
    {
      id: {
        field: 'id',
        type: INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        comment: '自增的主键，用于唯一标识每条记录',
      },
      deviceId: {
        field: 'deviceId',
        type: STRING(64),
        allowNull: false,
        comment: '前端设备的 ID',
      },
      source: {
        field: 'source',
        type: STRING(10),
        allowNull: false,
        comment: '数据的来源渠道',
      },
      status: {
        field: 'status',
        type: INTEGER,
        defaultValue: 1,
        comment: '数据的当前状态; 1 待打点 | 0 已打点',
      },
      platform: {
        field: 'platform',
        type: STRING(10),
        defaultValue: 'web',
        comment: '来源平台',
      },
      eventName: {
        field: 'eventName',
        type: STRING(64),
        allowNull: false,
        comment: '发生的事件名称',
      },
      params: {
        field: 'params',
        type: STRING,
        comment: '与事件相关的参数信息',
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
      tableName: 'frontend_tracking_info',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return frontendTrackingInfo;
};
