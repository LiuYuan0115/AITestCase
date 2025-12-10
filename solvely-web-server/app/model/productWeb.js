module.exports = (app) => {
  const { INTEGER, DATE, STRING, NOW, DOUBLE } = app.Sequelize;

  const productWeb = app.model.define(
    'productWeb',
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
        index: true,
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
        type: DOUBLE,
        comment: '价格',
        allowNull: false,
      },
      originalPrice: {
        field: 'originalPrice',
        type: INTEGER,
        comment: '原价',
        allowNull: false,
      },
      test: {
        field: 'test',
        type: STRING(255),
        comment: '实验',
        allowNull: false,
      },
      period: {
        type: INTEGER,
        comment: '订阅时长(1,3,6,12月)',
      },
      productClass: {
        field: 'productClass',
        type: STRING(64),
        index: true,
        comment: 'subscription/comsumable',
        allowNull: false,
      },
      priceId: {
        field: 'priceId',
        type: STRING(255),
        comment: '价格id',
        allowNull: true,
      },
      language: {
        field: 'language',
        type: STRING(255),
        comment: '语言',
        allowNull: true,
        defaultValue: 'en',
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
      tableName: 'productWeb',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return productWeb;
};
