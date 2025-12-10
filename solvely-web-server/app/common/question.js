'use strict';
module.exports = {
  // 题目解题状态
  QUESTION_STATUS: Object.freeze({
    success: 0,
    analyzing: 1,
    recognizeFail: 2,
    gptFail: 3,
  }),

  // 命令列表
  StreamCommandEnum: {
    Pending: 'pending',
    Done: 'done',
    Subject: 'subject',
    Graph: 'graph',
    Error: 'error',
    All: 'all',

    Keepalive: 'keepalive', // 保活命令
  },

  QuestionErrorCodeEnum: {
    QUESTION_TYPE_FUZZY: 2003,
    QUESTION_TYPE_INCOMPLETE: 2004,
  },
};
