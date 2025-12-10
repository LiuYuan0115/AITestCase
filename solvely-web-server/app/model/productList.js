module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW, DOUBLE } = app.Sequelize;

  const productList = app.model.define(
    'productList',
    {
      id: {
        field: 'id',
        type: INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        comment: '自增id',
      },
      productId: {
        field: 'productId',
        type: STRING(50),
        allowNull: false,
        unique: true,
        comment: '产品id',
      },
      discount: {
        field: 'discount',
        type: STRING(20),
        comment: '折扣',
      },
      oneTimeOnly: {
        field: 'oneTimeOnly',
        type: INTEGER,
        comment: '是否是一次性折扣产品: 0:不是;1:是',
        defaultValue: '0',
      },
      diamond: {
        field: 'diamond',
        type: INTEGER,
        comment: '钻石数',
        allowNull: false,
      },
      price: {
        field: 'price',
        type: STRING(64),
        comment: '价格',
        allowNull: false,
      },
      priceWeb: {
        field: 'priceWeb',
        type: STRING(64),
        comment: '价格-web',
      },
      period: {
        type: INTEGER,
        comment: '订阅时长(1,3,6月)',
      },
      productClass: {
        field: 'productClass',
        type: STRING(64),
        comment: 'subscription/comsumable',
        allowNull: false,
      },
      adjustEvent: {
        field: 'adjustEvent',
        type: STRING(64),
        comment: 'adjust埋点',
      },
      abTest: {
        field: 'ab_test',
        type: STRING(64),
        comment: '测试分组',
        allowNull: false,
        defaultValue: 'A',
      },
      system: {
        field: 'system',
        type: STRING(64),
        comment: '系统',
        allowNull: false,
      },
      priceId: {
        field: 'priceId',
        type: STRING(255),
        comment: '价格id',
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
      version: {
        field: 'version',
        type: INTEGER,
        allowNull: true,
      },
      originPrice: {
        field: 'originPrice',
        type: DOUBLE,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: 'productList',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return productList;
};
