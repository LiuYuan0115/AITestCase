/**
 * Quizlet 页面相关的 DOM 选择器
 */
export const QUIZLET_SELECTORS = {
  /** 页面容器选择器 */
  pageContainer: '#setPageSetIntroWrapper',
  /** 页面标题选择器 */
  title: '#setPageSetIntroWrapper h1',
  /** 学习模式按钮容器选择器 */
  container:
    '.SetPageStudyModeButtonsSectionList:not(.navTeacherTest)',
  /** 第三个 li 元素选择器 (A版本替换目标) */
  thirdLi:
    '.SetPageStudyModeButtonsSectionList:not(.navTeacherTest) li:nth-child(3)',
  /** 登录后的按钮容器 */
  loginContainer:
    '.SetPageStudyModeButtonsSectionList.simpleButtons',
} as const

/**
 * Quizlet URL 匹配正则表达式
 */
export const QUIZLET_URL_PATTERN = /^https:\/\/quizlet\.com\/\d+\/[^\/]+\/?$/

/**
 * YouTube 播放页面 URL 匹配正则表达式
 */
export const YOUTUBE_URL_PATTERN = /^https:\/\/(?:www\.)?youtube\.com\/watch.*/

/**
 * A/B 测试相关常量
 */
export const QUIZLET_AB_TEST = {
  /** A/B 测试标签名 */
  TAG_NAME: 'TEST_M_plugin_quizlet_button_T',
  /** A 版本组件标识 */
  COMPONENT_A_ATTRIBUTE: 'data-quizlet-component',
  /** A 版本组件标识值 */
  COMPONENT_A_VALUE: 'A',
} as const

/**
 * 埋点事件名称
 */
export const QUIZLET_EVENTS = {
  /** 按钮显示事件 */
  BUTTON_SHOW: 'Plugin_Quizletbutton_Show',
  /** 按钮点击事件 */
  BUTTON_CLICK: 'Plugin_Quizletbutton_Click',
} as const
