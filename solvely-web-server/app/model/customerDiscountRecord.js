'use strict';

module.exports = (app) => {
  const { STRING, INTEGER, DATE, NOW } = app.Sequelize;

  const CustomerDiscountRecord = app.model.define(
    'customerDiscountRecord',
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
        allowNull: true,
        comment: '设备id',
      },
      discountId: {
        field: 'discountId',
        type: STRING(64),
        allowNull: false,
        comment: '折扣id',
      },
      couponId: {
        field: 'couponId',
        type: STRING(32),
        allowNull: false,
        comment: '优惠券id',
      },
      couponName: {
        field: 'couponName',
        type: STRING(32),
        allowNull: false,
        comment: '优惠券名称',
      },
      amountOff: {
        field: 'amountOff',
        type: INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: '折扣金额',
      },
      currency: {
        field: 'currency',
        type: STRING(32),
        allowNull: true,
        defaultValue: null,
        comment: '币种',
      },
      duration: {
        field: 'duration',
        type: STRING(32),
        allowNull: false,
        comment: '持续时间',
      },
      percentOff: {
        field: 'percentOff',
        type: INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: '折扣百分比',
      },
      promotionCodeId: {
        field: 'promotionCodeId',
        type: STRING(32),
        allowNull: false,
        comment: '促销码id',
      },
      customer: {
        field: 'customer',
        type: STRING(32),
        comment: '客户id',
      },
      subscription: {
        field: 'subscription',
        type: STRING(32),
        allowNull: true,
        comment: '订阅id',
      },
      code: {
        field: 'code',
        type: STRING(32),
        allowNull: false,
        comment: '折扣码',
      },
      source: {
        field: 'source',
        type: STRING(40),
        allowNull: false,
        defaultValue: 'stripe',
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
        comment: '更新时间',
      },
      deleteTime: {
        field: 'deleteTime',
        type: DATE,
        allowNull: true,
        comment: '删除时间',
      },
    },
    {
      tableName: 'customerDiscountRecord',
      timestamps: false,
      indexes: [
        {
          fields: ['deviceId'],
        },
        {
          fields: ['discountId'],
        },
        {
          fields: ['couponId'],
        },
        {
          fields: ['code'],
        },
      ],
    },
  );

  return CustomerDiscountRecord;
};
