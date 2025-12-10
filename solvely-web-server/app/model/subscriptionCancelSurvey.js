module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW } = app.Sequelize;

  const order = app.model.define(
    'subscriptionCancelSurvey',
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
      text1: {
        field: 'text1',
        type: STRING,
        comment: '文本1',
      },
      text2: {
        field: 'text2',
        type: STRING,
        comment: '文本2',
      },
      text3: {
        field: 'text3',
        type: STRING,
        comment: '文本3',
      },
      type: {
        field: 'type',
        type: INTEGER,
        comment: '类型: 0: 取消订阅问卷调查 1: 暂停订阅问卷调查',
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
      tableName: 'subscriptionCancelSurvey',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return order;
};
