// src/config/storage.ts 存储相关的配置

// 插件的 local storage 前缀
export const STORAGE_PREFIX = 'solvely_plugin'

// 插件的 local storage 的 key
export const STORAGE_KEY = {
  // 用户信息
  // 用户 token, 在请求中带上验证头
  TOKEN_KEY: `${STORAGE_PREFIX}_token`,
  // 用户 id
  USER_ID_KEY: `${STORAGE_PREFIX}_user_id`,
  // 用户信息
  USER: `${STORAGE_PREFIX}_user`,
  // 用户扩展信息, 会包含用户的实验标签配置
  USER_EXTEND_INFO: `${STORAGE_PREFIX}_user_extend_info`,
  // 用户订阅
  SUBSCRIPTION: `${STORAGE_PREFIX}_subscription`,
  // 用户余额
  USER_BALANCE: `${STORAGE_PREFIX}_user_balance`,

  // 用户消息存储
  // SIDE_PANEL_MESSAGES: `${STORAGE_PREFIX}_sidepanel_messages`,
  // 活跃请求状态
  // SIDE_PANEL_REQUESTS: `${STORAGE_PREFIX}_sidepanel_requests`,

  // 是否隐藏浮窗按钮
  FLOAT_BTN_HIDDEN_KEY: `${STORAGE_PREFIX}_float_btn_hidden`,
  // 问题面板是否展开
  QUESTION_EXPANDED_KEY: `${STORAGE_PREFIX}_question_expanded`,

  // 设置相关
  // 是否显示侧边栏浮窗按钮
  FLOAT_BTN_ENABLED: `${STORAGE_PREFIX}_float_btn_enabled`,
  // 是否自动检测
  AUTO_DETECT_ENABLED: `${STORAGE_PREFIX}_auto_detect_enabled`,
  // 是否启用划词快捷键
  SELECT_TOOLBAR_ENABLED: `${STORAGE_PREFIX}_select_toolbar_enabled`,
  // 是否显示侧边栏弹窗
  SIDEBAR_POPUP_PANEL_ENABLED: `${STORAGE_PREFIX}_sidebar_popup_panel_enabled`,
  // 是否显示 YouTube 面板
  YOUTUBE_PANEL_ENABLED: `${STORAGE_PREFIX}_youtube_panel_enabled`,
  // 是否显示 ChatGPT 按钮
  CHATGPT_BTN_ENABLED: `${STORAGE_PREFIX}_chatgpt_btn_enabled`,

  // others
  // 是否显示过引导提示
  ATTRACT_TOOLTIP_SHOWN_KEY: `${STORAGE_PREFIX}_attract_tooltip_shown`,
  // 浮窗按钮位置
  FLOAT_BTN_POSE: `${STORAGE_PREFIX}_float_btn_position`,
  // 用户消息存储
  SIDE_PANEL_MESSAGES: `${STORAGE_PREFIX}_sidepanel_messages`,
  // 活跃请求状态
  SIDE_PANEL_REQUESTS: `${STORAGE_PREFIX}_sidepanel_requests`,
  // 用户 web adjust 用户 id
  WEB_ADJUST_USER_ID: `${STORAGE_PREFIX}_web_adjust_user_id`,
  // 用户 web ga cid
  WEB_GA_CID: `${STORAGE_PREFIX}_web_ga_cid`,
  // 用户 web anon device id
  WEB_ANON_DEVICE_ID: `${STORAGE_PREFIX}_web_anon_device_id`,

  // ABTest 相关
  // 匿名设备 id（ABTest 使用，勿复用 WEB_ANON_DEVICE_ID）
  ANON_DEVICE_ID: `${STORAGE_PREFIX}_anon_device_id`,
  // 实验分配结果
  ABTEST_ASSIGNMENTS: `${STORAGE_PREFIX}_abtest_assignments`,
  // 上次实验分配权重缓存
  ABTEST_ALLOCATION_CACHE: `${STORAGE_PREFIX}_abtest_allocation_cache`,
  // 首次执行 AB 的时间戳（用于判断新用户）
  ABTEST_FIRST_SEEN_AT: `${STORAGE_PREFIX}_abtest_first_seen_at`,

  // YouTube 摘要缓存相关
  YOUTUBE_SUMMARY_CACHE: `${STORAGE_PREFIX}_youtube_summary_cache`,
  YOUTUBE_SUMMARY_CACHE_META: `${STORAGE_PREFIX}_youtube_summary_cache_meta`,
  // 是否显示 Quizlet 按钮
  QUIZLET_BTN_ENABLED: `${STORAGE_PREFIX}_quizlet_btn_enabled`,
  // 是否启用悬浮划词工具栏
  TEXT_SELECTION_ENABLED: `${STORAGE_PREFIX}_text_selection_enabled`,
  // 用户安装渠道
  AD_REFERRER: `${STORAGE_PREFIX}_ad_referrer`,
  // 插件云端配置
  PLUGIN_CONFIG: `${STORAGE_PREFIX}_plugin_config`,
  // 定价信息
  PRICING_PRODUCTS: `${STORAGE_PREFIX}_pricing_products`,
  // ChatGPT 解题相关数据
  CHATGPT_SOLVE_DATA: `${STORAGE_PREFIX}_chatgpt_solve_data`,
  // 页面数据获取今日限制记录
  PAGE_DATA_FETCH_TODAY: `${STORAGE_PREFIX}_page_data_fetch_today`,

  // 浮动按钮禁用站点列表（包含页面级别和网站级别的禁用）
  FLOAT_BUTTON_DISABLED_SITES: `${STORAGE_PREFIX}_float_button_disabled_sites`,

  // 划词禁用站点列表（包含页面级别和网站级别的禁用）
  TEXT_SELECTION_DISABLED_SITES: `${STORAGE_PREFIX}_text_selection_disabled_sites`,

  // 主题模式设置
  THEME_MODE: `${STORAGE_PREFIX}_theme_mode`,

  // AI 响应语言设置
  AI_RESPONSE_LANGUAGE: `${STORAGE_PREFIX}_ai_response_language`,

  // 24小时节流埋点记录
  THROTTLE_TRACK_RECORDS: `${STORAGE_PREFIX}_throttle_track_records`,

  // 嗅探元素上报的最近检查时间戳
  SNIFFING_LAST_CHECK_AT: `${STORAGE_PREFIX}_sniffing_last_check_at`,

  // 待同步的用户教育等级（未登录时选择的教育等级）
  PENDING_GRADE: `${STORAGE_PREFIX}_pending_grade`,

  // 示例题目的显示
  SHOW_EXAMPLE_QUESTION: `${STORAGE_PREFIX}_show_example_question`,
  // Meet 嗅探（tactiq-lang）最近检查时间戳
  MEET_SNIFFING_LAST_CHECK_AT: `${STORAGE_PREFIX}_meet_sniffing_last_check_at`,
  // PostHog 已 identify 的用户 email（用于避免重复 identify）
  POSTHOG_IDENTIFIED_EMAIL: `${STORAGE_PREFIX}_posthog_identified_email`,
  // SEO 次数原始数据（已过滤）
  SEO_CREDITS_RAW_DATA: `${STORAGE_PREFIX}_seo_credits_raw_data`,
  // Google 搜索引导全局禁用状态
  GOOGLE_SEARCH_GUIDANCE_DISABLED: `${STORAGE_PREFIX}_google_search_guidance_disabled`,
  // 默认解题模型
  DEFAULT_SOLVE_MODEL: `${STORAGE_PREFIX}_default_solve_model`,
  // 模型选择器引导红点是否已显示
  MODEL_SELECTOR_GUIDE_SHOWN: `${STORAGE_PREFIX}_model_selector_guide_shown`,
  // 已解题次数（done 完成时递增）
  SOLVE_COUNT: `${STORAGE_PREFIX}_solve_count`,
  // 是否使用过 Multi-model（记录首次使用 Multi-model 的时间戳）
  MULTI_MODEL_USED: `${STORAGE_PREFIX}_multi_model_used`,
  // Multi-model 引导弹窗是否已显示过
  MULTI_MODEL_PROMPT_SHOWN: `${STORAGE_PREFIX}_multi_model_prompt_shown`,

  // 首次安装时间（毫秒时间戳）
  INSTALL_TIME: `${STORAGE_PREFIX}_install_time`,

  // 首次安装版本号
  INSTALL_VERSION: `${STORAGE_PREFIX}_install_version`,

  // webAdjustUserId 已同步标识
  WEB_ADJUST_USER_ID_SYNCED: `${STORAGE_PREFIX}_web_adjust_user_id_synced`,

  // adjust 补充埋点组件已执行标识
  ADJUST_POINT_COMPONENT_EXECUTED: `${STORAGE_PREFIX}_adjust_point_component_executed`,
  
  // 插件唯一 UUID（用于设备维度统计和权益控制）
  PLUGIN_UUID: `${STORAGE_PREFIX}_plugin_uuid`,

  // 插件唯一 UUID 是否为新用户
  PLUGIN_UUID_IS_NEW_USER: `${STORAGE_PREFIX}_plugin_uuid_is_new_user`,

  // Price Panel 相关
  PRICE_TICKET_TIMESTAMP: `${STORAGE_PREFIX}_price_ticket_timestamp`,
  PRICE_GIFT_TIMESTAMP: `${STORAGE_PREFIX}_price_gift_timestamp`,
  PRICE_GIFT_CLICK: `${STORAGE_PREFIX}_price_gift_click`,

  // LMS 埋点时间戳记录（每个域名独立计时）
  LMS_TRACK_TIMESTAMPS: `${STORAGE_PREFIX}_lms_track_timestamps`,
}
