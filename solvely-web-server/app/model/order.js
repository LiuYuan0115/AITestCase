module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW, BIGINT } = app.Sequelize;

  const order = app.model.define(
    'orderWeb',
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
      originalTransactionId: {
        field: 'originalTransactionId',
        type: STRING,
        allowNull: false,
        index: true,
        comment: '订单id',
      },
      transactionId: {
        field: 'transactionId',
        type: STRING,
        comment: '订阅订单特有id',
      },
      purchaseChannel: {
        field: 'purchaseChannel',
        type: STRING(10),
        comment: '购买渠道: stripe',
        defaultValue: 'stripe',
      },
      currency: {
        field: 'currency',
        type: STRING(10),
        comment: '币种',
        defaultValue: 'usd',
      },
      mode: {
        field: 'mode',
        type: STRING(10),
        comment: '订单类型: 订阅subscription, 消耗品payment',
        allowNull: false,
      },
      purchaseTimeStamp: {
        field: 'purchaseTimeStamp',
        type: BIGINT,
        comment: '交易时间戳',
        allowNull: false,
      },
      productId: {
        field: 'productId',
        type: STRING(64),
        comment: '产品id',
        allowNull: false,
      },
      quantity: {
        field: 'quantity',
        type: INTEGER,
        comment: '购买数量',
        allowNull: false,
        defaultValue: 1,
      },
      period: {
        field: 'period',
        type: INTEGER,
        comment: '订阅时长: 1, 3, 6/月',
        allowNull: false,
        defaultValue: 1,
      },
      isTrial: {
        field: 'isTrial',
        type: INTEGER,
        comment: '是否试用: 1:试用, 0:非试用',
        allowNull: false,
        defaultValue: 0,
      },
      amount: {
        field: 'amount',
        type: INTEGER,
        comment: '金额: 单位:分',
        allowNull: false,
      },
      diamond: {
        field: 'diamond',
        type: INTEGER,
        comment: '钻石数量',
        allowNull: true,
      },
      status: {
        field: 'status',
        type: STRING(10),
        comment: '订单状态: open complete',
        allowNull: false,
      },
      refund: {
        type: INTEGER,
        comment: '退款: 1:退款, 0:未退款',
        allowNull: false,
        defaultValue: 0,
      },
      regular: {
        type: INTEGER,
        comment: '是否入金: 1:入金, 0:未入金',
        allowNull: false,
        defaultValue: 0,
      },
      createdRaw: {
        field: 'createdRaw',
        type: STRING,
        comment: '创建订单的session',
      },
      completedRaw: {
        field: 'completedRaw',
        type: STRING,
        comment: '订单完成的webhook返回',
      },
      environment: {
        field: 'environment',
        type: STRING,
        comment: '环境',
        allowNull: true,
        defaultValue: 'Production',
      },
      customer: {
        field: 'customer',
        type: STRING(64),
        comment: '客户id',
        allowNull: true,
      },
      invoice: {
        field: 'invoice',
        type: STRING(64),
        comment: '订阅交易id',
        allowNull: true,
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
      priceId: {
        field: 'priceId',
        type: STRING,
        comment: '价格id',
        allowNull: true,
      },
      version: {
        field: 'version',
        type: INTEGER,
        allowNull: true,
      },
      subscriptionType: {
        field: 'subscriptionType',
        type: STRING,
        allowNull: true,
        defaultValue: 1, // 1: solver, 2: writer, 3: solver+writer bundle
      },
      // 订单来源
      source: {
        field: 'source',
        type: STRING(32),
        allowNull: true,
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: 'orderWeb',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return order;
};
