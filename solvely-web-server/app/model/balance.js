module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW, BIGINT } = app.Sequelize;

  const balance = app.model.define(
    'balance',
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
      balance: {
        field: 'balance',
        type: BIGINT,
        comment: '余额',
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
      teach: {
        field: 'teach',
        type: INTEGER,
        comment: 'teach 剩余次数',
      },
      teachTotal: {
        field: 'teachTotal',
        type: INTEGER,
        comment: 'teach 总次数',
      },
      fast: {
        field: 'fast',
        type: INTEGER,
        comment: 'fast 剩余次数',
      },
      fastTotal: {
        field: 'fastTotal',
        type: INTEGER,
        comment: 'fast 总次数',
      },
      plugin: {
        field: 'plugin',
        type: INTEGER,
        comment: '插件解题剩余次数',
      },
      pluginTotal: {
        field: 'pluginTotal',
        type: INTEGER,
        comment: '插件解题总次数',
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: 'balance',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return balance;
};
