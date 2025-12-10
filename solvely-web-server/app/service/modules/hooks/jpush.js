const BaseHookService = require('./baseHook');

class JpushHook extends BaseHookService {
  async before() {
    return { isSkip: false, result: {} };
  }

  after() {
    return { isSkip: false, result: {} };
  }
}

module.exports = JpushHook;
