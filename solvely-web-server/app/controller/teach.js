const BaseController = require('../core/base');
const _ = require('lodash');
const moment = require('moment');

class TeachControler extends BaseController {
  /**
   * @description 新建question信息，并返回新建的question信息的id
   * @steps
   *  1. 参数校验，需要对图片和问题内容参数做精细化校验
   *  2. 处理订阅信息
   *  3. 组装参数
   *  4. 图片OCR识别，基于识别到的内容，继续组装参数
   *  5. 插入question表
   *  6. 把题目信息推给public
   */
  async add() {
    const { ctx } = this;
    // 1. 参数校验，需要对图片和问题内容参数做精细化校验
    ctx.validate({
      // 这种方式创建的题目，mode只能是teach
      mode: [ctx.app.config.SOLVE_MODES.TEACH],
      language: 'string',
      subject: 'string?',
      time: 'int',
      contents: {
        type: 'array',
        // 最少要有1项。目前因为文本解题和图片解题是互斥的，所以只有1项，要求最少有1项，是为了将来可能的扩展性
        min: 1,
        itemType: 'object',
        rule: {
          type: ['text', 'image'],
        },
      },
    });
    const { body } = ctx.request;
    const [questionInfoFromUser] = body.contents;
    const { type } = questionInfoFromUser;
    // 用户是否传了图片用来解题
    const hasImage = type === 'image';
    // 精细校验，根据不同的解题类型，选择不同的检验rule
    const rule = hasImage
      ? {
          content: {
            type: 'object',
            rule: {
              files: {
                type: 'array',
                min: 1,
                itemType: 'object',
                rule: {
                  processed: 'url',
                  origin: 'url?',
                },
              },
            },
          },
        }
      : {
          content: 'string',
        };
    try {
      ctx.validate(rule, questionInfoFromUser);
    } catch (error) {
      if (hasImage) {
        return this.fail(30002, '图片为空或格式不正确');
      }
      return this.fail(30003, '问题不能为空');
    }
    // 2. 处理订阅信息
    // 原来的状态码：30002 图片为空或格式不正确 30003 不在解题中 30004 题意不清晰（前端只用来打点） 30005 解题次数已用完
    const { isUnlimited, exceedLimit } = await this.ctx.service.teach.checkSubscriptionByMode(
      ctx.app.config.SOLVE_MODES.TEACH,
    );

    if (exceedLimit) {
      return this.fail(30001, '解题次数已用完');
    }
    // 3. 组装参数
    const { mode: solveMode, language, time, subject } = body;
    const { content } = questionInfoFromUser;

    const questionInfo = {
      solveMode,
      language,
      subject,
      time,
      isImageSolve: false,
      costType: isUnlimited ? 'unlimited' : 'teachFreeCount', // 不管有没有订阅，只要从这个入口进来，都赋`teachFreeCount`
      platform: 'web',
      modelName: 'gpt-4-stream', // 目前写死，原来有其他值，后面统一成了这个
    };

    // 4. 若有图片，需OCR识别 并判断是否是图片题（因为有些图片里面只有文本内容，所以虽然是一张图片，但本质上还是文本）
    if (hasImage) {
      // 目前只能传一张图，这张图已经在前端压缩处理过了
      const { processed, origin } = content.files[0];
      const result = await ctx.service.teach.resolveImage(processed, origin);
      Object.assign(questionInfo, result);
      questionInfo.pictureKey = processed;
      questionInfo.originPictureKey = origin;
    } else {
      questionInfo.questionText = content;
      questionInfo.questionId = ctx.helper.generateQuestionId();
    }
    // questionInfo.questionId = '2023_09_14_455322185a1b2f3f412ag'
    // 5. 插入question表
    await ctx.service.teach.insertQuesionTable(questionInfo);
    // 6. 把题目信息推给public 那边要存数据，public那边能解题，依赖于question表和mongo中有这条quesiton数据
    await ctx.service.teach.pushQuestionInfoToPublic(questionInfo);
    this.success({ questionId: questionInfo.questionId });
  }

  /**
   * @description 流式答题接口，进到这个入口来有两种情况：
   *  1. 正常从`/home`页选teach模式进来；
   *  2. 从`/home`页选fast模式，但是中途切换为了teach模式
   * 每次进来，都要处理订阅，否则从fast切teach，没有通过订阅校验，会造成没有订阅或者免费次数用完，但是还可以解题的bug
   */
  async chatStream() {
    const { ctx } = this;

    ctx.validate({
      // messageType: [ 'normal', 'action', 'option', 'quote', 'quote_and_explain', 'retry' ],
      messageType: 'string', // 此字段前端用来展示和状态判断的，服务端只做必填和类型校验，至于传什么值，前端来决定
      subject: 'string?',
      language: 'string',
      time: 'int', // Date.now() 返回的时间戳：1725502301743
      contents: {
        type: 'array',
        itemType: 'object',
        rule: {
          content: 'string',
          // 不做内容校验，防止后续又添加类型
          // type: { type: 'string', format: /^(text|image_url|actionCode|optionCode|messageId)$/ },
          type: 'string',
          // 不做内容校验，防止后续又添加类型
          // source: { type: 'string', format: /^quote$/, required: false },
          source: 'string?',
        },
      },
    });
    const { request, params, app } = ctx;
    // const { deviceId, questionId } = params
    /**
     * 下面的`解题次数已用完`的逻辑是不会执行的，因为前端已经做过了校验，没有次数的话是不会调用到这里来的
     */
    // const { exceedLimit } = await this.ctx.service.teach.checkSubscriptionByMode(ctx.app.config.SOLVE_MODES.FAST, params.deviceId)
    // if(exceedLimit) {
    //   return this.fail(30001, '解题次数已用完')
    // }
    /**
     * @description 校验该deviceId下的questionId是否匹配，并且是否在解题中。
     * 因为这个接口没有经过JWT校验，所以如果是一个非法的deviceId，查询问题详情时👇🏻，是查不到问题的，所以下方的`该问题不存在`，存在两种情况：
     * 1. deviceId是非法的或者不存在
     * 2. deviceId是合法存在，但是根据这个questionId确实查不到数据
     * 所以不必再对deviceId进行合法校验了
     */
    const result = await ctx.service.question.detail(params);
    // A/B 两个账号访问同一个题目
    if (_.isEmpty(result)) {
      return this.fail(30002, '该问题不存在');
    }
    // 2024-9-9 下午会议确认，teach mode不需要这个判断了
    // else if (result.answerStatus !== 1) {
    //   return this.fail(30003, '该问题不在解题中')
    // }

    // 有可能这道题最初是fast模式，然后切回的teach模式，此时对应的最后一次解题模式这个字段（lastSolveMode）要更新为2，即teach模式，不用等待结果
    // 2024-09-19 找明昊确认，更新完lastSolveMode，不用告诉他最新的值，他那块暂时用不到
    ctx.service.question.updateInfo({ lastSolveMode: app.config.SOLVE_MODES.TEACH }, params);
    // const { messageType, subject, language, time, contents } = request.body
    await ctx.service.common.commonAskTutorStream({
      ...params,
      input: request.body, // 把前端传入参数透传给public
    });
  }
  /**
   * @description teach切fast要调用的接口
   * @steps
   *  1. 查询订阅信息并处理订阅信息
   *  2. 查询question表
   *  3. 更新解题状态
   *  4. 组装question数据
   *  5. 推送给public开始答题
   */
  async teachTofastResolve() {
    const { ctx } = this;
    const { params, user, app } = ctx;
    const { questionId } = params;
    const deviceId = user.uid;
    // 1. 查询订阅信息并处理订阅信息
    const { isUnlimited, exceedLimit } = await this.ctx.service.teach.checkSubscriptionByMode(
      ctx.app.config.SOLVE_MODES.FAST,
    );
    if (exceedLimit) {
      return this.fail(30001, '解题次数已用完');
    }
    // 准备好查询和更新的where子句
    const whereClause = { deviceId, questionId };
    // 2. 查询question表
    const question = await ctx.service.question.info(whereClause);
    if (_.isEmpty(question)) {
      return this.fail(30002, '该问题不存在');
    }
    /**
     * 查出来的costType值为：
     *  1. `unlimited`，则经过处理后，值还是`unlimited`
     *  2. 非`unlimited`的单值，例如`teachFreeCount`，则经过处理后，值为`teachFreeCount,fastFreeCount`（即把`fastFreeCount`追加到后面，使用逗号隔开）
     *  3. 非`unlimited`的单值，例如`fastFreeCount`，经过去重后，值还是`fastFreeCount`
     *  4. 非`unlimited`的多值，例如`unlimited,teachFreeCount`，则经过处理后，值为`unlimited,teachFreeCount,fastFreeCount`（同2）
     */
    const costTypes = question.costType.split(',');
    costTypes.push(isUnlimited ? 'unlimited' : 'fastFreeCount');
    // 3. 更新解题状态，要把最后一次解题模式置为fast模式，并且把isFirstSolve置为false(因为从teach切fast，说明不是首次解题)
    const updateData = {
      answerStatus: 1,
      solveCount: 1,
      solvelyTime: moment().valueOf(),
      lastSolveMode: app.config.SOLVE_MODES.FAST,
      costType: _.uniq(costTypes).join(','),
      isFirstSolve: false,
    };
    await ctx.service.question.updateInfo(updateData, whereClause);
    // 4. 组装question数据，注意：应该使用assign的方式，而不是解构，当raw:false时，解构有坑，查询返回的question对象是ORM封装后的对象，会有超多用不到的字段
    Object.assign(question, updateData);
    // const questionInfo = {
    //   ...question,
    //   ...updateData,
    // }
    // 5. 推送给public开始答题
    ctx.service.question.answerQuestion(question, 'fast', false, 'fastFreeCount', 0);
    this.success();
  }
  /**
   * @description 输入框上方的快捷提示
   */
  async getActions() {
    const { ctx } = this;
    // 校验规则，mode属性前端可以不传，但是只要是传了，值必须为`teach`
    ctx.validate(
      {
        mode: {
          type: 'string',
          required: false,
          default: ctx.app.config.SOLVE_MODES.TEACH,
          format: new RegExp(`^${ctx.app.config.SOLVE_MODES.TEACH}$`, 'i'), // 匹配这个正则的`/^teach$/i`才是合法的mode值
        },
      },
      ctx.query,
    );
    const commonUrl = ctx.app.config.commonServiceConfig.host;
    // result = { data, headers, res, status }
    const { status, data, res } = await ctx.curl(
      `${commonUrl}/solvelyPubServer/v1/tutor/actions?mode=${ctx.query.mode}`,
      { dataType: 'json' },
    );
    if (status === 200) {
      this.success(data.data);
    } else {
      this.fail(-1, res.statusMessage);
    }
  }
  /**
   * @description 对整个问题反馈
   */
  async questionFeedback() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/tutor/feedback');
  }
  /**
   * @description 消息反馈（点赞/点踩）
   */
  async messageFeedback() {
    await this.ctx.helper.proxy('/solvelyPubServer/v1/tutor/message/feedback');
  }
}

module.exports = TeachControler;
