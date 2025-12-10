module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW, BIGINT } = app.Sequelize;
  /**
   * 生效中的订阅（即`status`为`active`的订阅）切换，会在这里面加一条数据
   * 这个时候此表的`status`字段为`pending`，当订阅切过去之后，这条数据的`status`会变为`active`
   */
  const order = app.model.define(
    'subscriptionWebManage',
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
      transactionId: {
        field: 'transactionId',
        type: STRING,
        index: true,
        comment: 'transactionId',
      },
      status: {
        field: 'status',
        type: STRING(10),
        comment: '订单状态: pending active',
        allowNull: false,
      },
      currency: {
        field: 'currency',
        type: STRING(10),
        comment: '币种',
        defaultValue: 'usd',
      },
      productId: {
        field: 'productId',
        type: STRING(64),
        comment: '产品id',
        allowNull: false,
      },
      priceId: {
        field: 'priceId',
        type: STRING(64),
        comment: '价格id',
        allowNull: false,
      },
      period: {
        field: 'period',
        type: INTEGER,
        comment: '订阅时长: 1, 3, 6/月',
        allowNull: false,
        defaultValue: 1,
      },
      amount: {
        field: 'amount',
        type: INTEGER,
        comment: '金额: 单位:分',
      },
      customer: {
        field: 'customer',
        type: STRING(64),
        comment: '客户id',
        allowNull: true,
      },
      startTime: {
        field: 'startTime',
        type: BIGINT,
        comment: '新订阅开始时间',
        allowNull: false,
      },
      newTransactionExpireTime: {
        field: 'newTransactionExpireTime',
        type: BIGINT,
        comment: '新订阅到期时间',
      },
      newSubscription: {
        field: 'newSubscription',
        type: STRING,
        comment: '新订阅详情',
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
      tableName: 'subscriptionWebManage',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return order;
};
