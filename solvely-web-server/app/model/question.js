module.exports = (app, sequelize, modelName) => {
  const { INTEGER, DATE, STRING, TEXT, NOW, BIGINT } = app.Sequelize;

  const question = app.model.define(
    modelName || 'question_0',
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
        comment:
          '消耗类型gems/coins/unlimited/teachFreeCount/fastFreeCount,带`count`后缀的消耗类型为次数，因为可以切换解题模式，每次都要记录消耗类型，所以可能有多个，使用逗号隔开',
        defaultValue: 'gems',
      },
      lastSolveMode: {
        field: 'lastSolveMode',
        type: INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        comment: '最后一次答题的模式是什么，1:fast,2:teach, and more...',
        /**
         * @return {string | number} 转换后的值
         * @description 如果值是1，返回fast，如果值是2，返回teach，这样程序不用在单独处理了，这儿统一处理就行
         * @notice raw为false，才执行
         * @example https://sequelize.org/docs/v6/core-concepts/getters-setters-virtuals/
         */
        get() {
          const value = this.getDataValue('lastSolveMode');
          if (value === app.config.SOLVE_MODES.FAST_CODE) {
            return app.config.SOLVE_MODES.FAST;
          } else if (value === app.config.SOLVE_MODES.TEACH_CODE) {
            return app.config.SOLVE_MODES.TEACH;
          }
          return value;
        },
        /**
         * @param {string | number} value
         * @description 如果设置的值为fast，则转换成1，如果设置的值是teach，则转换成2
         * @notice model.create，执行这个setter
         */
        set(value) {
          if (value === app.config.SOLVE_MODES.FAST) {
            this.setDataValue('lastSolveMode', app.config.SOLVE_MODES.FAST_CODE);
          } else if (value === app.config.SOLVE_MODES.TEACH) {
            this.setDataValue('lastSolveMode', app.config.SOLVE_MODES.TEACH_CODE);
          } else {
            this.setDataValue('lastSolveMode', value);
          }
        },
      },
      platform: {
        field: 'platform',
        type: STRING(64),
        comment: '解题平台:ios,web',
        defaultValue: 'ios',
      },
      renderStyle: {
        field: 'renderStyle',
        type: STRING(16),
        comment: '渲染样式:[markdown|dsl]',
        defaultValue: 'markdown',
      },
    },
    {
      timestamps: true,
      freezeTableName: true,
      tableName: modelName || 'question_0',
      underscored: true,
      paranoid: true,
      createdAt: 'createTime', // 自定义时间戳
      updatedAt: 'updateTime', // 自定义时间戳
      deletedAt: 'deleteTime', // 自定义删除字段
    },
  );
  return question;
};
