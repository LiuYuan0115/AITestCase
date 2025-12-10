module.exports = (app) => {
  const { INTEGER, DATE, STRING, TEXT, NOW } = app.Sequelize;

  const userFeedback = app.model.define(
    'userFeedback',
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
      device: {
        field: 'device',
        type: STRING(50),
        comment: '设备名',
      },
      appVersion: {
        field: 'appVersion',
        type: STRING(50),
        comment: 'app版本号',
      },
      system: {
        field: 'system',
        type: STRING(50),
        comment: '反馈',
      },
      title: {
        field: 'title',
        type: STRING,
        comment: '标题',
      },
      description: {
        field: 'description',
        type: TEXT,
        comment: '反馈',
      },
      imageUrls: {
        field: 'imageUrls',
        type: STRING(500),
        comment: '反馈图片',
      },
      solvelyTime: {
        field: 'solvelyTime',
        type: STRING(100),
        comment: '题目标识',
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
      questionId: {
        field: 'questionId',
        type: STRING(200),
        comment: '题目id',
        default: '',
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: 'userFeedback',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return userFeedback;
};
