module.exports = (app) => {
  const { INTEGER, STRING, DATEONLY, DATE, NOW } = app.Sequelize;

  const anonSolveCounter = app.model.define(
    'anonSolveCounter',
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
        allowNull: false,
        comment: '匿名设备id；GLOBAL 表示全站',
      },
      day: {
        field: 'day',
        type: DATEONLY,
        allowNull: false,
        comment: '业务自然日',
      },
      cnt: {
        field: 'cnt',
        type: INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '当日累计次数',
      },
      uploadCnt: {
        field: 'uploadCnt',
        type: INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '当日累计上传图片的次数',
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
      tableName: 'anonSolveCounter',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime',
      updatedAt: 'updateTime',
      deletedAt: 'deleteTime',
      indexes: [
        {
          name: 'uniq_deviceId_day',
          unique: true,
          fields: ['deviceId', 'day'],
          using: 'BTREE',
        },
        {
          name: 'idx_day',
          fields: ['day'],
          using: 'BTREE',
        },
      ],
    },
  );

  return anonSolveCounter;
};
