/**
 * @param {Egg.Application} app - egg application
 */
module.exports = (app) => {
  const { router, controller } = app;
  // 图片解题 - ask tutor模式需要多传递一个mode属性 = teach | fast
  router.post('/question/photo', controller.question.photo);
  // 文字解题 - ask tutor模式需要多传递一个mode属性 = teach | fast
  router.post('/question/text', controller.question.text);

  // 解题历史
  router.get('/question', controller.question.history);
  // 解题统计
  router.get('/question/statistics', controller.question.statistics);
  // 重试解题
  router.post('/question/:questionId/retry', controller.question.retry);
  // 获取流式解题状态
  router.get('/question/status', controller.question.getIsStartAnswerQuestions);
  // 获取流式解题答案
  router.get('/answer/:deviceId/:questionId/stream', controller.question.answerQuestionStream);
  // 获取题目列表 - 新接口
  router.post('/questions', controller.questionList.list);
  // 搜索题目 - 新接口
  router.post('/questions/search', controller.questionList.searchQuestions);
  // 获取收藏题目列表 - 新接口
  router.post('/bookmarks', controller.bookmark.list);
  // 收藏/取消收藏题目
  router.post('/questions/:questionId/bookmark', controller.bookmark.toggleBookmark);
  // 删除题目
  router.post('/questions/delete', controller.questionList.deleteQuestions);
  // 清空题目
  router.post('/questions/clean', controller.questionList.cleanQuestions);

  // Teach Mode下生成题目信息并返回前端questionId
  router.post('/question/teach/add', controller.teach.add);
  // Teach Mode下解题，包含文本、图片、既有文本又有图片的解题，流式接口
  router.post('/question/teach/:deviceId/:questionId/stream', controller.teach.chatStream);
  // Teach Mode下获取输入框上方给用户的提示列表
  router.get('/question/teach/actions', controller.teach.getActions);
  // Teach Mode下 题目级别反馈
  router.post('/question/teach/feedback', controller.teach.questionFeedback);
  // Teach Mode下 消息级别反馈
  router.post('/question/teach/message/feedback', controller.teach.messageFeedback);
  // Fast Mode进入，然后切换为Teach Mode，需要调用的接口
  router.post('/question/:questionId/resolve', controller.teach.teachTofastResolve);
  // 提交解题 - 自定义答案 - 只有fast模式
  router.post('/question/fast/add', controller.question.fastAdd);
  // 匿名用户提交解题
  router.post('/question/guest/fast/add', controller.question.guestFastAdd);
  // 根据问题和答案生成对应到的 keywords 包含解释 - 代理
  router.post('/question/fast/keywords', controller.question.getKeywordsAndExplain);
  // 对关键词进行点赞和点踩 - 代理
  router.post('/question/fast/keyword/feedback', controller.question.keywordsFeedback);

  // 答案卡片隐藏
  router.post('/answer/hide', controller.question.hide);
  // 答案风格改写
  router.post('/answer/style', controller.question.style);
  // 答案语言改写
  router.post('/answer/language', controller.question.language);
  // instruction 列表
  router.post('/question/instruction/list', controller.question.instructionList);
  // instruction 新增
  router.post('/question/instruction/add', controller.question.instructionAdd);
  // instruction 删除
  router.post('/question/instruction/del', controller.question.instructionDelete);
  // 微服务解题回调
  router.post('/question/webhook', controller.question.webhook);
  // 解题详情
  router.get('/question/:questionId', controller.question.detail);
  // 赞/踩
  router.post('/question/:questionId/like', controller.question.like);
  // 踩完feedback
  router.post('/question/:questionId/feedback', controller.question.feedback);
  // 追问webhook
  router.post('/question/follow/webhook', controller.follow.webhook);
  // 获取追问记录
  router.get('/question/follow/:questionId', controller.follow.getFollow);
  // 追问
  router.post('/question/follow/:questionId', controller.follow.postFollow);
  // 重试追问
  router.post('/question/follow/:questionId/retry', controller.follow.retryFollow);
  // 追问点赞/踩
  router.post('/question/follow/:questionId/like', controller.follow.likeFollow);
  // 获取追问流式回答
  router.get(
    '/question/follow/:deviceId/:questionId/stream',
    controller.follow.followQuestionStream,
  );
  // 匿名用户追问
  router.post('/question/guest/follow/:questionId', controller.follow.guestPostFollow);
  // 匿名用户获取追问流式回答
  router.get(
    '/question/guest/follow/:deviceId/:questionId/stream',
    controller.follow.guestFollowQuestionStream,
  );
  // 获取followup推荐问题接口 - 代理
  router.post(
    '/question/fast/askmore/questions/recommend',
    controller.follow.getFollowupQuestionRecommend,
  );
  // 选择followup推荐问题接口 - 代理
  router.post('/question/fast/askmore/question/choose', controller.follow.reportSelectedRecommend);

  // 商品列表
  router.get('/product', controller.pricing.list);
  // 商品列表-游客身份请求
  router.get('/product/guest', controller.pricing.guestList);
  // 创建付款链接
  router.post('/pricing/checkout', controller.pricing.checkout);
  // 创建订阅
  router.post('/pricing/checkout/create-subscription', controller.pricing.createSubscription);
  // 检查促销码
  router.get('/pricing/billing/check-promoCode', controller.pricing.checkPromoCode);
  // 创建组合订阅
  router.post('/pricing/billing/create-combinedSub', controller.pricing.createCombinedSub);
  // 检查订单状态
  router.get('/pricing/check/:id', controller.pricing.check);
  // 订单支付成功回调
  router.post('/pricing/webhook', controller.pricing.webhook);
  // stripe新主体回调 -- TODO: free-trail 调用的回调
  router.post('/pricing/webhookv2', controller.pricing.webhookV2);
  // 检查是否有未发放的钻石
  router.get('/pricing/checkRecord', controller.pricing.checkGrantDiamondRecord);
  // 获取用户订阅信息
  router.get('/pricing/subscription', controller.pricing.subscription);
  // 获取订阅支付方式
  router.get('/pricing/subscriptionPaymentInfo', controller.pricing.subscriptionPaymentInfo);
  // 是否取消当前订阅的自动续订
  router.post('/pricing/changeSubscriptionStatus', controller.pricing.cancelSubscription);
  // 获取订单信息
  router.get('/pricing/order/:id', controller.pricing.order);
  // 获取转完美金后的金额
  router.get('/pricing/rate/:currency', controller.pricing.rate);
  // 更新当前汇率
  router.get('/pricing/rate', controller.pricing.rateServer);
  // 更改订阅
  router.post('/pricing/changeSubscription', controller.pricing.changeSubscriptionV2);
  // 取消订阅问卷调查
  router.post('/pricing/cancelSurvey', controller.pricing.cancelSurvey);
  // 暂停订阅问卷调查
  router.post('/pricing/pauseSurvey', controller.pricing.pauseSurvey);
  // 暂停/恢复订阅
  router.post('/pricing/pauseSubscription', controller.pricing.pauseSubscription);
  // 查询invoice详情
  router.get('/pricing/invoice/:invoiceId', controller.pricing.invoiceDetail);
  // 生成S3预签名URL，前端把文件上传到这个URL上
  router.post('/uploadurl', controller.common.buildPreUploadUrl);
  router.post('/guest/uploadurl', controller.common.buildGuestPreUploadUrl);
  // flashcards 批量上传预签名 URL（迁移自 flashcards-server）
  router.post('/flashcards/uploadurl', controller.flashcards.batchPresignedUrl);
  // 新的桶，目前用于插件上传 PDF
  router.post('/uploadurl/file', controller.common.buildPreUploadFileUrl);
  // Canvas 抓取上传
  router.post('/canvas/uploadurl', controller.canvas.getUploadUrl);
  // 插件 Feedback 附件上传
  router.post('/plugin/feedback/uploadurl', controller.pluginFeedback.getUploadUrl);
  // 获取用户 token
  router.get('/token', controller.user.getToken);
  // 获取用户 firebase id token
  router.get('/auth/idToken', controller.user.getFirebaseIdToken);
  router.post('/auth/email/code/send', controller.user.sendEmailCode);
  router.post('/auth/email/code/verify', controller.user.verifyEmailCode);
  // 用户信息
  router.get('/user', controller.user.info);
  // 获取余额
  router.get('/user/balance', controller.user.balance);
  // 上报用户信息 ｜ 旧，准备废弃
  router.post('/user', controller.user.updateUserInfo);
  // 上报用户信息专用 | 新
  router.post('/userinfo', controller.user.updateUserInfo);
  // 上报插件新用户信息
  router.post('/plugin/userinfo', controller.user.updatePluginUserInfo);
  // 完成插件试用订阅（freeTrialCount + 1）
  router.post('/plugin/trial/complete', controller.user.completePluginTrial);
  // 修改插件用户余额（仅限非生产环境，用于调试工具）
  router.put('/debug/plugin/userinfo/balance', controller.user.updatePluginUserBalance);
  // 修改用户信息
  router.put('/user', controller.user.updateUserInfoItem);
  // 修改用户年级
  router.put('/user/grade', controller.user.updateUserGrade);
  // 获取用户扩展信息
  router.get('/user/extend', controller.user.getExtendInfo);
  // 更新用户扩展信息
  router.put('/user/extend', controller.user.updateExtendInfo);
  // 获取用户最近使用的语言
  router.get('/user/recent-language', controller.user.getRecentLanguage);
  // feedback
  router.post('/feedback', controller.user.feedback);
  // 上传图片
  router.post('/upload/image', controller.home.upload);
  // 生成二维码
  router.get('/v8/qrcode', controller.user.qrCode);
  // 校验二维码
  router.get('/v8/qrcode/check', controller.user.qrCodeCheck);
  // 注销二维码
  router.get('/v8/qrcode/logout', controller.user.qrCodeLogout);
  // 校验邮箱是否已注册
  router.get('/v8/email/check', controller.user.checkEmail);

  // 获取通用弹窗
  router.get('/common/feedback', controller.common.getPopupFeedbackConfig);
  // 保存反馈
  router.post('/common/feedback', controller.common.savePopupFeedback);

  // 健康检查 容器调用
  router.get('/v8/health', controller.health.check);
  // 获取是否有需要上报的埋点
  router.get('/track', controller.user.getTrack);

  // IL一期 - 获取interactive lesson的学习物料，目前只有预生成的html
  router.post('/question/fast/il/materials', controller.il.recommendFast);
  // IL二期 - 判断题干是否可以生成对应的 html
  router.post('/question/il/html/judgement', controller.il.htmlJudgement);
  // IL二期 - 获取题目对应的 html 内容，会先判断是否经历过 “IL-判断题干是否可以生成 html 片段” 如果没有则直接返回为空
  router.get('/question/il/html/content', controller.il.htmlContent);
  // IL三期 - 判断题干是否可以生成对应的 html
  router.post('/question/v2/il/html/judgement', controller.il.htmlJudgementV2);
  // IL三期 - 获取题目对应的 html 内容，会先判断是否经历过 “IL-判断题干是否可以生成 html 片段” 如果没有则直接返回为空
  router.post('/question/v2/il/html/content', controller.il.htmlContentV2);
  // IL三期 - IL反馈
  router.post('/question/il/html/feedback', controller.il.feedback);
  // 实验配置管理接口
  // router.get('/v8/experiment/refresh-config', controller.experiment.refreshConfig);
  router.get('/v8/experiment/current-config', controller.experiment.getCurrentConfig);

  // 上报插件推送结果
  router.post('/v8/report/server/web/plugin/bq', controller.report.reportServerPluginBq);
  router.get('/v8/report/server/web/plugin/pushtest', controller.report.reportServerPluginPushTest);

  // 上报浏览器插件前端交互事件（因为firbase的埋点上报功能不支持在插件环境中运行，详见：https://firebase.google.com/docs/web/environments-js-sdk?hl=zh-cn）
  router.post('/v8/report/browser-ext/event', controller.report.reportBrowserExtEvent);
  // 上报用户 rengage 信息
  router.post('/v8/report/rengage/userInfo', controller.report.uploadUserRengageInfo);

  // 插件总结相关接口
  router.post('/plugin/summary', controller.plugin.postSummary);
  router.post('/plugin/summary/:summaryId/feedback', controller.plugin.feedbackSummary);
  // 插件总结重试（不扣余额）
  router.post('/plugin/summary/retry', controller.plugin.retrySummary);

  // 获取 YouTube 视频总结摘要
  router.post('/plugin/youtube/summaryOutline', controller.plugin.getYouTubeSummaryOutline);
  // 获取 YouTube 视频总结详情
  router.post('/plugin/youtube/summaryDetails', controller.plugin.getYouTubeSummaryDetails);

  // 扣减免费插件使用次数
  router.post('/plugin/usage/decrement', controller.solve.decrementPluginUsage);

  // 上报用户功能使用情况
  router.post('/v8/rengage', controller.user.postRengage);

  // 插件登录rengage上报
  router.post('/plugin/rengage/pluginLogin', controller.user.pluginLoginRengage);

  // pdf 总结
  router.post('/summary/pdf', controller.summary.pdf);
  // pdf 总结重试（不扣余额）
  router.post('/summary/pdf/retry', controller.summary.pdfRetry);

  // pdf 聊天缓存创建
  router.post('/chat/pdf/context/cache', controller.chat.pdfContextCache);

  // pdf 聊天提问题
  router.post('/chat/pdf/ask/context', controller.chat.pdfAskContext);

  // pdf 检索入库
  router.post('/chat/pdf/upload', controller.chat.pdfUpload);

  // pdf 检索提问
  router.post('/chat/pdf/ask', controller.chat.pdfAsk);

  // pdf 问答接口
  router.post('/chat/pdf/askAndAnswer', controller.chat.pdfAskAndAnswer);

  // 网页总结提问
  router.post('/chat/page/ask', controller.chat.pageAsk);

  // 一键解题
  router.post('/solve/all', controller.solve.solveAll);

  // 上下文提问 & 追问
  router.post('/context/ask', controller.chat.contentChat);
  // 上下文提问重试（不扣余额）
  router.post('/context/ask/retry', controller.chat.contentChatRetry);
  router.post('/context/chat', controller.chat.contentChatFollowUp);

  // 用户解题总数
  router.get('/questionCount', controller.question.totalCount);

  // ABTest 实验标签 - 查询/新增/删除/全量替换
  router.get('/abtest/assignments', controller.abtest.getAbTestAssignments);
  router.post('/abtest/assignments', controller.abtest.addAbTestAssignments);
  router.delete('/abtest/assignments', controller.abtest.deleteAbTestAssignments);
  router.put('/abtest/assignments', controller.abtest.replaceAbTestAssignments);
  // 动态分配实验
  router.post('/user/setExperiments', controller.user.setExperimentsDynamic);

  // ----------------- v9 解题 ----------------------
  const headerValidation = app.middleware.headerValidation();

  // 解题
  router.post('/v9/question/solve', headerValidation, controller.v9.question.questionSolve);

  // 重解
  router.post('/v9/question/reSolve', headerValidation, controller.v9.question.questionReSolve);

  /**
   * 解题(注意类型是指定模型)
   * answerType = regeneration
   */
  router.post(
    '/v9/question/model/solve',
    headerValidation,
    controller.v9.question.questionModelSolve,
  );

  // 匿名用户解题 - 使用 headerValidation，保持接口约定一致
  router.post(
    '/v9/question/guest/solve',
    headerValidation,
    controller.v9.question.guestQuestionSolve,
  );

  // 匿名用户指定模型解题
  router.post(
    '/v9/question/guest/model/solve',
    headerValidation,
    controller.v9.question.guestQuestionModelSolve,
  );

  // ----------------- v9 解题 ----------------------

  // ----------------- 促销码管理 ----------------------
  // 创建促销码
  router.post('/promotion/codes/create', controller.promotion.createPromotionCodes);
  // 获取促销码列表
  router.get('/promotion/codes', controller.promotion.getPromotionCodes);
  // ----------------- 促销码管理 ----------------------
};
