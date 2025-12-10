module.exports = (app) => {
  const { DATE, STRING, NOW, BIGINT, TEXT } = app.Sequelize;

  const subscriptionRenew = app.model.define(
    'subscriptionRenew',
    {
      transactionId: {
        field: 'transactionId',
        type: STRING,
        comment: '订阅订单特有id',
        allowNull: false,
      },
      productId: {
        field: 'productId',
        type: STRING(64),
        comment: '产品id',
        allowNull: false,
      },
      purchaseTimeStamp: {
        field: 'purchaseTimeStamp',
        type: BIGINT,
        comment: '交易时间戳',
        allowNull: false,
      },
      expireTimeStamp: {
        field: 'expireTimeStamp',
        type: BIGINT,
        comment: '过期时间戳',
        allowNull: true,
      },
      transactionPayload: {
        field: 'transactionPayload',
        type: TEXT,
        comment: '交易详情',
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
      tableName: 'subscriptionRenewWeb',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return subscriptionRenew;
};
