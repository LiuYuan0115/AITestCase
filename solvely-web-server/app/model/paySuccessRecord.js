'use strict';

module.exports = (app) => {
  const { STRING, INTEGER, DECIMAL, DATE, NOW } = app.Sequelize;

  const PaySuccessRecord = app.model.define(
    'paySuccessRecord',
    {
      id: {
        field: 'id',
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: '自增id',
      },
      deviceId: {
        field: 'deviceId',
        type: STRING(64),
        allowNull: false,
        comment: '设备id',
      },
      eventId: {
        field: 'eventId',
        type: STRING(64),
        allowNull: false,
        comment: '事件id',
      },
      productId: {
        field: 'productId',
        type: STRING(64),
        allowNull: false,
        comment: '产品id',
      },
      amount: {
        field: 'amount',
        type: DECIMAL(10, 2),
        allowNull: false,
        comment: '金额',
      },
      currency: {
        field: 'currency',
        type: STRING(10),
        allowNull: false,
        defaultValue: 'usd',
        comment: '币种',
      },
      quantity: {
        field: 'quantity',
        type: INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: '购买数量',
      },
      receiptUrl: {
        field: 'receiptUrl',
        type: STRING(255),
        allowNull: false,
        comment: '发票url',
      },
      orderId: {
        field: 'orderId',
        type: STRING(128),
        allowNull: true,
        comment: '订单id',
      },
      subscriptionId: {
        field: 'subscriptionId',
        type: STRING(64),
        allowNull: true,
        comment: '订阅id',
      },
      mode: {
        field: 'mode',
        type: STRING(40),
        allowNull: false,
        comment: '订单类型: payment, subscription',
      },
      type: {
        field: 'type',
        type: STRING(40),
        allowNull: false,
        comment: '入金类型',
      },
      source: {
        field: 'source',
        type: STRING(40),
        allowNull: false,
        comment: '来源',
      },
      createTime: {
        field: 'createTime',
        type: DATE,
        allowNull: false,
        defaultValue: NOW,
        comment: '创建时间',
      },
      updateTime: {
        field: 'updateTime',
        type: DATE,
        allowNull: false,
        defaultValue: NOW,
        onUpdate: NOW,
        comment: '更新时间',
      },
      deleteTime: {
        field: 'deleteTime',
        type: DATE,
        allowNull: true,
        comment: '删除时间',
      },
      version: {
        field: 'version',
        type: INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: 'paySuccessRecord',
      timestamps: false,
      indexes: [
        {
          fields: ['deviceId'],
        },
        {
          fields: ['eventId'],
        },
        {
          fields: ['productId'],
        },
        {
          fields: ['orderId'],
        },
        {
          fields: ['subscriptionId'],
        },
      ],
    },
  );

  return PaySuccessRecord;
};
