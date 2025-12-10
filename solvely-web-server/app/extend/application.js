module.exports = {
  // question自动查找分表
  async questionTable(hex) {
    const modelName = `question_${hex}`;
    const existTable = this.model.models[modelName];
    if (existTable) {
      return existTable;
    }
    const tableModal = require('../model/question');
    if (tableModal && modelName) {
      tableModal(this, this.model, modelName);
      return this.model.models[modelName];
    }
    return null;
  },
  // 追问自动查找分表
  async answerMoreTable(hex) {
    const modelName = `questionAskMore_${hex}`;
    const existTable = this.model.models[modelName];
    if (existTable) {
      return existTable;
    }
    const tableModal = require('../model/questionAskMore');
    if (tableModal && modelName) {
      tableModal(this, this.model, modelName);
      return this.model.models[modelName];
    }
    return null;
  },
};
