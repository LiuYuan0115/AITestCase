module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW } = app.Sequelize;

  const webPluginsPushLog = app.model.define(
    'webPluginsPushLog',
    {
      id: {
        field: 'id',
        type: INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        comment: '自增id',
      },
      pushTime: {
        field: 'pushTime',
        unique: true,
        type: STRING,
        comment: '推送时间（唯一）',
      },
      pushTokenLength: {
        field: 'pushTokenLength',
        type: INTEGER,
        comment: '推送人数',
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
      tableName: 'webPluginsPushLog',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return webPluginsPushLog;
};
