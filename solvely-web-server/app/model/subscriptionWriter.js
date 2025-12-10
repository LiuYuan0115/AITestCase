module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW, BIGINT, TINYINT } = app.Sequelize;

  const subscriptionWriter = app.model.define(
    'subscriptionWriter',
    {
      deviceId: {
        field: 'deviceId',
        type: STRING,
        unique: true,
        comment: '用户id',
      },
      originalTransactionId: {
        field: 'originalTransactionId',
        index: true,
        type: STRING(255),
        comment: '原始订单id',
        allowNull: false,
      },
      transactionId: {
        field: 'transactionId',
        type: STRING(255),
        comment: '订单id',
        allowNull: false,
      },
      productId: {
        field: 'productId',
        type: STRING(64),
        comment: '产品id',
        allowNull: false,
      },
      bundleId: {
        field: 'bundleId',
        type: STRING(64),
        comment: '产品名',
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
      expired: {
        type: TINYINT,
        comment: '是否过期: 1:过期, 0:未过期',
        allowNull: false,
        defaultValue: 0,
      },
      isCancel: {
        field: 'isCancel',
        type: TINYINT,
        comment: '是否取消自动续订: 1:是, 0:否',
        allowNull: false,
        defaultValue: 0,
      },
      period: {
        type: INTEGER,
        comment: '订阅时长(1,3,6月)',
        allowNull: false,
        defaultValue: 0,
      },
      isTrialPeriod: {
        field: 'isTrialPeriod',
        type: INTEGER,
        comment: '是否试用,0:否,1:是',
        allowNull: false,
        defaultValue: 0,
      },
      grantGems: {
        field: 'grantGems',
        type: INTEGER,
        comment: '该发放钻石数',
        allowNull: false,
        defaultValue: 0,
      },
      nextGrantGemsTime: {
        field: 'nextGrantGemsTime',
        type: BIGINT,
        comment: '下次发放钻石时间',
        allowNull: false,
        defaultValue: 0,
      },
      hasUnredeemedGems: {
        field: 'hasUnredeemedGems',
        type: INTEGER,
        comment: '是否有未发放的钻石,1:有,0:无',
        allowNull: false,
        defaultValue: 0,
      },
      redeemGems: {
        field: 'redeemGems',
        type: INTEGER,
        comment: '订阅周期内已发放的钻石数',
        allowNull: false,
        defaultValue: 0,
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
      environment: {
        field: 'environment',
        type: STRING,
        comment: '环境',
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
      subscriptionType: {
        field: 'subscriptionType',
        type: INTEGER,
        comment: '订阅类型: 2: writer',
        allowNull: false,
        defaultValue: 2,
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: 'subscriptionWriter',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return subscriptionWriter;
};
