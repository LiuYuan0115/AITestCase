module.exports = (app) => {
  const { INTEGER, DATE, STRING, TEXT, NOW, BIGINT } = app.Sequelize;

  const questionFeedbackRetry = app.model.define(
    'questionFeedbackRetry',
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
      questionId: {
        field: 'questionId',
        type: STRING(200),
        comment: '题目Id',
      },
      questionText: {
        field: 'questionText',
        type: TEXT,
        comment: '题目文本',
      },
      pictureKey: {
        field: 'pictureKey',
        type: STRING(100),
        comment: '题目图片地址',
      },
      answer: {
        field: 'answer',
        type: TEXT,
        comment: '答案',
      },
      feedBack: {
        field: 'feedBack',
        type: INTEGER,
        comment: '解题的反馈, -1:无,1:赞,0:踩',
        defaultValue: -1,
      },
      subject: {
        field: 'subject',
        type: STRING,
        comment: '科目',
      },
      language: {
        field: 'language',
        type: STRING,
        comment: '语言',
      },
      answerStatus: {
        field: 'answerStatus',
        type: INTEGER,
        comment: '0:解题成功,1:解答中 2:ocr失败,3:gpt解题失败',
      },
      solvelyTime: {
        field: 'solvelyTime',
        type: BIGINT,
        comment: '解决问题的时间戳',
      },
      taskType: {
        field: 'taskType',
        type: STRING,
        comment: '解答问题的方式: langchain,embedding',
      },
      pushToken: {
        field: 'pushToken',
        type: STRING(500),
        comment: '推送token',
      },
      questionTag: {
        field: 'questionTag',
        type: INTEGER,
        comment: '题目标识',
      },
      promptToken: {
        field: 'promptToken',
        type: INTEGER,
        comment: '问句token长度',
      },
      completionToken: {
        field: 'completionToken',
        type: INTEGER,
        comment: '回答token长度',
      },
      modelName: {
        field: 'modelName',
        type: STRING(100),
        comment: '使用模型',
        defaultValue: 'gpt-4',
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
      solveCount: {
        field: 'solveCount',
        type: INTEGER,
        comment: '解题次数',
        defaultValue: 1,
      },
      costType: {
        field: 'costType',
        type: STRING(64),
        comment: '消耗类型gems/coins/unlimited',
        defaultValue: 'gems',
      },
      platform: {
        field: 'platform',
        type: STRING(64),
        comment: '解题平台:ios,web',
        defaultValue: 'ios',
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: 'questionFeedbackRetry',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return questionFeedbackRetry;
};
