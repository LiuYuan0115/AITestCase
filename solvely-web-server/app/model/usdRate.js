module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW } = app.Sequelize;

  const usdRate = app.model.define(
    'usdRate',
    {
      id: {
        field: 'id',
        type: INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        comment: '自增id',
      },
      currency: {
        field: 'currency',
        unique: true,
        type: STRING(10),
        comment: '币种',
      },
      rate: {
        field: 'rate',
        type: STRING(10),
        comment: '汇率',
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
      tableName: 'usdRate',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return usdRate;
};
