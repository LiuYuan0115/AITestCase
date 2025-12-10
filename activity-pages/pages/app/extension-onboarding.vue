<template>
  <div class="relative h-screen min-h-[726px] min-w-[800px] bg-white dark:bg-[#212836]">
    <div class="relative mx-auto flex h-screen min-h-[726px] min-w-[800px] max-w-[1400px] flex-col">
      <!-- logo and badge -->
      <div class="flex items-center justify-between px-[40px] pt-[21px]">
        <img
          src="~/assets/app/ext-onboarding/logo.webp"
          alt="Solvely.ai"
          class="logo-image h-[32px] w-[129px]"
        />
        <img
          src="~/assets/app/ext-onboarding/badge.webp"
          alt="2025 Chrome's Feature Extension"
          class="badge-image h-[56px] w-[198px]"
        />
      </div>

      <!-- Loading白屏 -->
      <transition name="fade-out" appear>
        <div
          v-if="isShowEmpty"
          class="absolute top-20 z-[1] flex h-[calc(100vh-80px)] w-full flex-col items-center justify-center overflow-hidden bg-white dark:bg-[#212836]"
        ></div>
      </transition>

      <!-- new-content with transition between level/click pages -->
      <div
        v-if="!isShowEmpty"
        class="relative flex min-w-[836px] flex-1 flex-col items-center justify-start overflow-hidden"
      >
        <div class="h-[23px]"></div>

        <transition name="slide-fade" mode="out-in">
          <!-- level页面 -->
          <div v-if="currentStage === 'level'" key="level">
            <div class="mb-[6px] text-center font-[Inter] text-[24px] font-[700] leading-[1.3]">
              What's your education level
            </div>
            <div class="mb-3 text-center font-[Inter] text-[18px] font-[500] leading-[1.4]">
              Select your current study level
            </div>
            <div
              class="mb-4 text-center font-[Inter] text-[14px] font-[500] leading-[1.4] text-[#999999]"
            >
              {{ getProgressText('level') }}
            </div>
            <div class="flex flex-col gap-4">
              <div
                v-for="item in educationLevelList"
                :key="item.id"
                class="flex w-[420px] cursor-pointer items-center justify-start rounded-[16px] border border-[#EDEDED] px-[24px] pb-[23px] pt-[21px] font-[Inter] text-[16px] font-[500] leading-[1.4] transition-all duration-200 hover:bg-[#ECF5FF] dark:border-[#CCCCCC] dark:hover:bg-[#122E57]"
                @click="selectLevel(item.id)"
              >
                <div class="mr-2 h-6 w-6 text-center text-[18px]">{{ item.icon }}</div>
                <div>{{ item.description }}</div>
              </div>
            </div>
          </div>

          <!-- click页面 -->
          <div v-else-if="currentStage === 'click'" key="click">
            <div class="mb-[6px] text-center font-[Inter] text-[24px] font-[700] leading-[1.3]">
              Take a solve all question
            </div>
            <div class="mb-3 text-center font-[Inter] text-[18px] font-[500] leading-[1.4]">
              Click the "S" button on right side
            </div>
            <div
              class="mb-6 text-center font-[Inter] text-[14px] font-[500] leading-[1.4] text-[#999999]"
            >
              {{ getProgressText('click') }}
            </div>
            <div
              v-if="showQuestion1"
              class="flex h-[264px] w-[562px] items-center justify-center rounded-[16px] bg-[#F6F8FA] dark:bg-[#2F3543]"
            >
              <img
                src="~/assets/app/ext-onboarding/question.webp"
                class="question-image h-[192px] w-[425px] rounded-[16px]"
              />
            </div>
            <div
              v-else
              class="flex h-[224px] w-[562px] items-center justify-center rounded-[16px] bg-[#F6F8FA] pl-[62px] dark:bg-[#2F3543]"
            >
              <img
                src="~/assets/app/ext-onboarding/question2.webp"
                class="question2-image h-[160px] w-[521px] rounded-[16px]"
              />
            </div>
            <div
              class="mt-3 text-center font-[Inter] text-[12px] font-[500] leading-[1.3] text-[#999999]"
            >
              <span>{{
                educationLevelList.find((item) => item.id === chooseEducationLevel)?.question
              }}</span>
            </div>
          </div>

          <!-- Congrats页面 -->
          <div
            v-else-if="currentStage === 'congrats'"
            key="congrats"
            class="flex flex-col items-center justify-center"
          >
            <div
              class="mb-1 flex items-center justify-center gap-2 text-center font-[Inter] text-[24px] font-[700] leading-[1.3]"
            >
              <span class="text-[44px] leading-[1.3]">🤩</span>
              <span v-if="tabList.length > 0"
                >Congrats! Now, you can try Solvely with your current pages</span
              >
              <span v-else>Congrats! Now, you can try Solvely with other sites</span>
            </div>
            <div
              class="mb-6 text-center font-[Inter] text-[14px] font-[500] leading-[1.4] text-[#999999]"
            >
              {{ getProgressText('congrats') }}
            </div>
            <!-- tab页面容器 -->
            <div v-if="tabList.length > 0" class="mb-10 flex items-center justify-center gap-4">
              <div
                v-for="item in tabList"
                :key="item.id"
                class="flex max-w-[224px] cursor-pointer items-center justify-start gap-2 rounded-[12px] border border-[#ccc] px-5 py-[10px] transition-all duration-300 hover:bg-[#ecf5ff] dark:hover:bg-[#122E57]"
                @click="openTab(item.url)"
              >
                <!-- 网站icon -->
                <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                  <img
                    v-if="item.favicon && !item.faviconError"
                    :src="item.favicon"
                    :alt="item.title"
                    class="h-6 w-6 object-cover"
                    @error="handleFaviconError"
                  />
                  <img
                    v-else
                    src="~/assets/app/ext-onboarding/website/default.svg"
                    :alt="item.title"
                    class="h-6 w-6 object-cover"
                  />
                </div>
                <!-- 网站标题 -->
                <div
                  class="h-[25px] flex-1 truncate font-[Inter] text-[18px] font-[400] leading-[1.4]"
                >
                  {{ item.title }}
                </div>
              </div>
            </div>
            <div
              v-if="tabList.length > 0"
              class="mb-6 text-center font-[Inter] text-[18px] font-[500] leading-[1.4]"
            >
              Or, you can try other study sites that work perfectly with Solvely
            </div>

            <div class="flex w-full max-w-[800px] flex-wrap justify-center gap-4">
              <div
                v-for="site in getStudySitesByLevel()"
                :key="site.id"
                class="flex w-fit cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[#CCC] py-[10px] pl-5 pr-6 transition-all duration-200 hover:bg-[#ECF5FF] dark:hover:bg-[#122E57]"
                @click="openTab(site.url)"
              >
                <div :class="site.iconClass" class="h-6 w-6"></div>
                <div class="h-[25px] font-[Inter] text-[18px] font-[400] leading-[1.4]">
                  {{ site.name }}
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { STORAGE_KEYS } from '~/config/storage'

const isClickSolveAll = ref(false)
const showQuestion1 = ref(true)
const chooseEducationLevel = ref(0)
const currentStage = ref<'level' | 'click' | 'congrats'>('level')
const webUpgrade = ref(false) // 是否要在onborading去更新用户grade字段
const skipLevel = ref(false) // 是否跳过level页面
const checkUserGradeDone = ref(false) // 检查用户grade字段是否已经处理完成

// 是否显示白屏
const isShowEmpty = computed(() => !checkUserGradeDone.value)

const { $pageViewEvent, $trackAdjustEvent, $adjust, $posthog } = useNuxtApp()
// 仅使用 useHead 脚本管理暗黑模式，不在组件内重复监听

const educationLevelList = ref([
  {
    id: 1,
    icon: '✏️',
    description: 'Middle school',
    grade: 'middleSchool',
    question: 'Sample question for middle school'
  },
  {
    id: 2,
    icon: '📚',
    description: 'High school',
    grade: 'highSchool',
    question: 'Sample question for high school'
  },
  {
    id: 3,
    icon: '🏫',
    description: 'Community college',
    grade: 'communityCollege',
    question: 'Sample question for community college'
  },
  {
    id: 4,
    icon: '🎓',
    description: 'University / College',
    grade: 'university',
    question: 'Sample question for university / college'
  },
  {
    id: 5,
    icon: '🧩',
    description: 'Other',
    grade: 'others',
    question: 'Sample question for other'
  }
])

const tabList = ref<any[]>([])

// 计算进度显示
const getProgressText = (stage: string) => {
  const totalSteps = skipLevel.value ? 2 : 3
  const stageOrder = ['level', 'click', 'congrats']
  const currentStep = stageOrder.indexOf(stage) + 1

  // 如果跳过level页面，调整click和congrats的步骤
  const adjustedStep = skipLevel.value && stage !== 'level' ? currentStep - 1 : currentStep

  return `${adjustedStep} of ${totalSteps}`
}

// grade值到id的映射
const getEducationLevelIdByGrade = (grade: string) => {
  const level = educationLevelList.value.find((item) => item.grade === grade)
  return level ? level.id : 0
}

// 根据grade值设置showQuestion1
const setShowQuestionByGrade = (grade: string) => {
  const levelId = getEducationLevelIdByGrade(grade)
  // 规则：Community college (3) 和 University/College (4) 显示题2，其他显示题1
  if (levelId === 3 || levelId === 4) {
    showQuestion1.value = false
  } else {
    showQuestion1.value = true
  }
}

// 根据教育等级获取对应的学习网站推荐
const getStudySitesByLevel = () => {
  const levelId = chooseEducationLevel.value

  // 如果levelId为0或无效，默认显示低年级网站（安全fallback）
  if (!levelId || levelId === 0) {
    return studySites.value
  }

  // 规则：Community college (3) 和 University/College (4) 显示大学级别的网站，其他显示低年级网站
  if (levelId === 3 || levelId === 4) {
    return studySites.value
  } else {
    return studySitesForLowGrade.value
  }
}

const studySites = ref([
  {
    id: 1,
    name: 'Canvas',
    iconClass: 'canvas-onboarding-icon',
    url: 'https://www.instructure.com/canvas'
  },
  {
    id: 2,
    name: 'Blackboard',
    iconClass: 'blackboard-onboarding-icon',
    url: 'https://www.blackboard.com/'
  },
  {
    id: 3,
    name: 'McGraw',
    iconClass: 'mcgraw-onboarding-icon',
    url: 'https://www.mheducation.com/'
  },
  {
    id: 4,
    name: 'College Board',
    iconClass: 'college-board-onboarding-icon',
    url: 'https://www.collegeboard.org/'
  },
  {
    id: 5,
    name: 'Cengage',
    iconClass: 'cengage-onboarding-icon',
    url: 'https://www.cengage.com/'
  },
  {
    id: 6,
    name: 'Pearson',
    iconClass: 'pearson-onboarding-icon',
    url: 'https://www.pearson.com/'
  },
  {
    id: 7,
    name: 'WebAssign',
    iconClass: 'webassign-onboarding-icon',
    url: 'https://www.webassign.net/'
  },
  {
    id: 8,
    name: 'ATI Testing',
    iconClass: 'ati-testing-onboarding-icon',
    url: 'https://www.atitesting.com/'
  }
])

const studySitesForLowGrade = ref([
  {
    id: 1,
    name: 'I-Ready',
    iconClass: 'i-ready-onboarding-icon',
    url: 'https://www.i-ready.com/'
  },
  {
    id: 2,
    name: 'IXL',
    iconClass: 'ixl-onboarding-icon',
    url: 'https://www.ixl.com/'
  },
  {
    id: 3,
    name: 'Imagine Learning',
    iconClass: 'imagine-learning-onboarding-icon',
    url: 'https://www.imaginelearning.com/'
  },
  {
    id: 4,
    name: 'Khan Academy',
    iconClass: 'khan-academy-onboarding-icon',
    url: 'https://www.khanacademy.org/'
  },
  {
    id: 5,
    name: 'Quizizz',
    iconClass: 'quizizz-onboarding-icon',
    url: 'https://quizizz.com/'
  },
  {
    id: 6,
    name: 'Edpuzzle',
    iconClass: 'edpuzzle-onboarding-icon',
    url: 'https://edpuzzle.com/'
  },
  {
    id: 7,
    name: 'Deltamath',
    iconClass: 'deltamath-onboarding-icon',
    url: 'https://www.deltamath.com/'
  },
  {
    id: 8,
    name: 'Google Docs',
    iconClass: 'google-docs-onboarding-icon',
    url: 'https://docs.google.com/'
  }
])

useSeoMeta({
  title: 'Solvely - Take a Picture Math Solver Online',
  robots: 'noindex'
})

// 提供给 useHead 内联脚本使用的 API 基础域名
const apiBase = useRuntimeConfig().public.apiBase

// Add canvas-confetti script
useHead({
  script: [
    {
      src: 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
      defer: true
    }
  ]
})

// 使用 useHead 在页面加载前设置主题检测脚本和Grade初始化
useHead({
  script: [
    {
      innerHTML: `
        (function () {
          // 1) 先检测系统主题
          var mql = window.matchMedia('(prefers-color-scheme: dark)');
          var isDark = mql.matches;

          // 2) 立即写入根节点（尽量早，避免 FOUC）
          var root = document.documentElement;
          root.setAttribute('data-theme', isDark ? 'dark' : 'light');
          root.style.colorScheme = isDark ? 'dark' : 'light';

          // 3) body 可能还没准备好，等到了再同步 class
          function syncBody() {
            if (document.body) {
              document.body.classList.toggle('dark', isDark);
            } else {
              requestAnimationFrame(syncBody);
            }
          }
          syncBody();

          // 4) 监听系统主题变化 → 同步到 DOM
          function applyTheme(e) {
            isDark = e.matches;
            root.setAttribute('data-theme', isDark ? 'dark' : 'light');
            root.style.colorScheme = isDark ? 'dark' : 'light';
            if (document.body) {
              document.body.classList.toggle('dark', isDark);
            }
          }
          if (mql.addEventListener) mql.addEventListener('change', applyTheme);
          else if (mql.addListener) mql.addListener(applyTheme);

          // 5) 离开页面时清理监听（可选）
          window.addEventListener('beforeunload', function () {
            if (mql.removeEventListener) mql.removeEventListener('change', applyTheme);
            else if (mql.removeListener) mql.removeListener(applyTheme);
          });

          // 清理 URL 中的 auid 参数
          const hash = window.location.hash
          if (hash && hash.includes('#auid=')) {
            const newHash = hash.replace(/#auid=[^&]+&?/, '').replace(/&$/, '')
            window.history.replaceState({}, '', window.location.pathname + window.location.search + (newHash || ''))
            console.log('[Onboarding] 已清理 URL 中的 auid 参数')
          }

          // Grade初始化逻辑 =================================================================
          function initGrade() {
            console.log('[Onboarding] 开始执行Grade初始化逻辑')
            
            // 检查localStorage是否有登录信息
            const solvelyWebT = localStorage.getItem('solvelyWebT')
            const solvelyWebUid = localStorage.getItem('solvelyWebUid')
            const hasLoginInfo = solvelyWebT && solvelyWebUid

            if (hasLoginInfo) {
              fetchUserInfo(solvelyWebT)
            } else {
              // 未登录，不跳过level页面
              sessionStorage.setItem('skip_level', 'false')
              try { window.dispatchEvent(new Event('ONBOARDING_GRADE_READY')) } catch (_) {}
            }
          }

          // 获取用户信息
          async function fetchUserInfo(token) {
            try {
              const userResponse = await fetch('${apiBase}/user', {
                headers: {
                  'Authorization': 'Bearer ' + token
                }
              })
              
              const userData = await userResponse.json()
              console.log('[Onboarding] 获取用户信息:', userData)
              
              // 检查用户是否有grade字段
              const validGrades = ['middleSchool', 'highSchool', 'communityCollege', 'university', 'others']
              const hasGrade = userData && userData.grade && validGrades.includes(userData.grade)

              console.log('[Onboarding] hasGrade:', hasGrade)
              
              if (hasGrade) {
                // 如果用户已有grade字段，跳过level页面
                sessionStorage.setItem('skip_level', 'true')
                sessionStorage.setItem('user_grade', userData.grade)
                console.log('[Onboarding] 设置user_grade:', userData.grade)
              } else {
                // 用户无grade字段，需要显示level页面
                sessionStorage.setItem('skip_level', 'false')
                console.log('[Onboarding] 设置skip_level:', 'false')
              }
            } catch (error) {
              console.error('[Onboarding] 获取用户信息失败:', error)
              sessionStorage.setItem('skip_level', 'false')
            } finally {
              // 通知页面grade检查完成
              try { window.dispatchEvent(new Event('ONBOARDING_GRADE_READY')) } catch (_) {}
             }
          }

          // 立即执行Grade初始化
          initGrade()
        })();
      `,
      type: 'text/javascript'
    }
  ]
})

function selectLevel(id: number) {
  chooseEducationLevel.value = id
  // 规则：
  // 1: Middle school → 题1
  // 2: High school → 题1
  // 3: Community college → 题2
  // 4: University / College → 题2
  // 5: Other → 题1
  const questionType = [3, 4].includes(id) ? 'question2' : 'question1'
  showQuestion1.value = questionType === 'question1'
  window.postMessage(
    {
      type: 'solvely-browser-extension-data-async',
      api: 'show_example_question',
      data: {
        type: questionType
      }
    },
    '*'
  )
  // Extension_Onboarding_MiddleSchool        l1oau3（从插件，年级段选择中学）
  // Extension_Onboarding_HighSchool        e9wnpn（从插件，年级段选择高中）
  // Extension_Onboarding_CommunityCollege        hk517d（从插件，年级段选择社区大学）
  // Extension_Onboarding_University        hl86y2（从插件，年级段选择大学）
  // Extension_Onboarding_Other        v1jwc7（从插件，年级段选择其他）
  const eventName: Record<number, string> = {
    1: 'l1oau3',
    2: 'e9wnpn',
    3: 'hk517d',
    4: 'hl86y2',
    5: 'v1jwc7'
  }

  const level: Record<number, string> = {
    1: 'MiddleSchool',
    2: 'HighSchool',
    3: 'CommunityCollege',
    4: 'University',
    5: 'Other'
  }
  // adjust埋点上报
  $trackAdjustEvent(`${eventName[id]}`)
  // Plugin_Newuser_Onboarding_Grade_Click
  $posthog?.capture('Plugin_Newuser_Onboarding_Grade_Click', {
    level: `${level[id]}`
  })
  console.log('Plugin_Newuser_Onboarding_Grade_Click', {
    level: `${level[id]}`
  })

  // 切换到下一个页面
  currentStage.value = 'click'
  // 通知插件进入引导阶段
  window.postMessage(
    {
      type: 'ONBOARDING_CLICK_STAGE',
      data: {
        stage: 'click'
      }
    },
    '*'
  )

  if (webUpgrade.value) {
    // 调用更新grade字段的方法
    const selectedLevel = educationLevelList.value.find((item) => item.id === id)
    if (selectedLevel) {
      updateUserGrade(selectedLevel.grade)
    }
  } else {
    // 记录在插件的storage中，等待插件登录成功后同步
    const selectedLevel = educationLevelList.value.find((item) => item.id === id)
    if (selectedLevel) {
      // 通知探针内容脚本，探针内容脚本再通知后台存储
      window.postMessage(
        {
          type: 'solvely-browser-extension-data-async',
          api: 'pending_grade',
          data: {
            pendingGrade: selectedLevel.grade
          }
        },
        '*'
      )
    }
  }
}

function openTab(url: string) {
  // 发送事件给内容脚本，请求切换到指定URL的标签页
  // window.dispatchEvent(
  //   new CustomEvent('REQUEST_SWITCH_TAB', {
  //     detail: { url }
  //   })
  // )

  window.open(url, '_blank')

  // Plugin_Newuser_Onboarding_Tabs_Click
  $posthog?.capture('Plugin_Newuser_Onboarding_Tabs_Click', {
    URL: url
  })
  console.log('Plugin_Newuser_Onboarding_Tabs_Click', {
    URL: url
  })
}

// 处理tab数据
function handleTabData(tabs: any[]) {
  // 更新tabList数组
  const newTabList = tabs
    .filter((tab) => tab.success)
    .map((tab, index) => ({
      id: index + 1,
      title: tab.title || `Tab ${index + 1}`,
      url: tab.url || '',
      favicon: tab.favicon || '',
      faviconError: false
    }))

  tabList.value = newTabList
}

// 处理favicon加载错误
function handleFaviconError(event: Event) {
  const img = event.target as HTMLImageElement
  // 找到对应的tab项并设置faviconError为true
  const tabIndex = tabList.value.findIndex((tab) => tab.favicon === img.src)
  if (tabIndex !== -1) {
    tabList.value[tabIndex].faviconError = true
  }
}

const isOnboarding = ref(false)
const showAnimation = ref(false)
// 埋点：学段列表曝光只报一次
const hasTrackedGradeShow = ref(false)

let progressUpdateId: number | null = null
let webAdjustUserId: string | null = null
let cid: string | null = null
let intervalId: ReturnType<typeof setInterval> | null = null
let webAnonDeviceId: string | null = null
const maxAttempts = 20
let attempts = 0

// Shadow DOM CSS injection
let shadowCSSRetryId: ReturnType<typeof setTimeout> | null = null
let shadowCSSAttempts = 0
const maxShadowCSSAttempts = 10
const shadowCSSRetryInterval = 3000
let shadowTargetElement: HTMLElement | null = null

function postUuid() {
  if (webAdjustUserId) {
    window.postMessage(
      {
        api: 'web_adjust_user_id',
        type: 'solvely-browser-extension-data-async',
        data: {
          webAdjustUserId
        }
      },
      '*'
    )
  }
}

function postCid() {
  if (cid) {
    window.postMessage(
      {
        api: 'web_ga_cid',
        type: 'solvely-browser-extension-data-async',
        data: {
          cid
        }
      },
      '*'
    )
  }
}

function postAnonDeviceId() {
  if (webAnonDeviceId) {
    window.postMessage(
      {
        api: 'web_anon_device_id',
        type: 'solvely-browser-extension-data-async',
        data: {
          webAnonDeviceId
        }
      },
      '*'
    )
  }
}

function handleMessage(event: MessageEvent) {
  if (event.data) {
    switch (event.data.type) {
      case 'REQUEST_WEB_ADJUST_USERID':
        postUuid()
        break
      case 'REQUEST_WEB_GA_CID':
        postCid()
        break
      case 'REQUEST_WEB_ANON_DEVICE_ID':
        postAnonDeviceId()
        break
      case 'TAB_DATA_RESULTS':
        handleTabData(event.data.data)
        break
      default:
        console.log('[Onboarding] 忽略未知消息类型:', event.data.type)
        break
    }
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isClickSolveAll.value = false
  }
}

const checkGrade = () => {
  // 确保用户登录过
  const hasToken = !!localStorage.getItem(STORAGE_KEYS.TOKEN)
  console.log('[Onboarding] checkGrade hasToken:', hasToken)
  if (!hasToken) {
    checkUserGradeDone.value = true
    return
  }

  const storedValue = sessionStorage.getItem('skip_level')
  const userGrade = sessionStorage.getItem('user_grade')

  if (storedValue !== null) {
    // 设置checkUserGradeDone
    checkUserGradeDone.value = true
    // 设置skipLevel
    skipLevel.value = storedValue === 'true'
    // 如果有grade字段，跳过level页面，直接跳到click页面
    if (skipLevel.value && userGrade) {
      currentStage.value = 'click'
      // 根据grade值设置对应的教育等级选择
      const levelId = getEducationLevelIdByGrade(userGrade)
      chooseEducationLevel.value = levelId
      // 根据grade值设置显示哪道题目
      setShowQuestionByGrade(userGrade)
      // 发送示例题目消息，与selectLevel函数中的逻辑保持一致
      const showQuestion1 = levelId === 1 || levelId === 2 || levelId === 5
      window.postMessage(
        {
          type: 'solvely-browser-extension-data-async',
          api: 'show_example_question',
          data: {
            type: showQuestion1 ? 'question1' : 'question2'
          }
        },
        '*'
      )
      // 通知插件侧边栏显示引导
      window.postMessage(
        {
          type: 'ONBOARDING_CLICK_STAGE',
          data: {
            stage: 'click'
          }
        },
        '*'
      )
    } else {
      // 如果没有grade字段，显示level页面
      currentStage.value = 'level'
      checkUserGradeDone.value = true
    }
  }
}

// Shadow DOM CSS injection functions
function injectShadowCSS(): boolean {
  try {
    // 1. 查找宿主元素
    const hostElement = document.querySelector('solvely-screen-shot') as HTMLElement
    if (!hostElement) {
      console.log(
        `[Shadow CSS] Attempt ${shadowCSSAttempts}: solvely-screen-shot element not found`
      )
      return false
    }

    // 2. 获取Shadow Root
    const shadowRoot = hostElement.shadowRoot
    if (!shadowRoot) {
      console.log(`[Shadow CSS] Attempt ${shadowCSSAttempts}: shadowRoot not accessible`)
      return false
    }

    // 3. 检查是否已经注入过CSS
    const existingStyle = shadowRoot.querySelector('style[data-solvely-z-index]')
    if (existingStyle) {
      console.log(`[Shadow CSS] CSS already injected successfully`)
      return true
    }

    // 4. 检查目标元素是否存在
    const targetElement = shadowRoot.querySelector('div[data-v-0ad64690]')
    if (!targetElement) {
      console.log(
        `[Shadow CSS] Attempt ${shadowCSSAttempts}: target element div[data-v-0ad64690] not found in shadow DOM`
      )
      return false
    }

    // 5. 创建并注入CSS
    const style = document.createElement('style')
    style.setAttribute('data-solvely-z-index', 'true')
    style.textContent = 'div[data-v-0ad64690] { z-index: 100 !important; }'
    shadowRoot.appendChild(style)

    // 6. 查找并处理absolute元素
    const absoluteElement = shadowRoot.querySelector('div[data-v-0ad64690].absolute') as HTMLElement
    if (absoluteElement) {
      shadowTargetElement = absoluteElement
      // 根据当前isOnboarding状态设置初始透明度
      const initialOpacity = isOnboarding.value ? '1' : '0.2'
      updateShadowElementOpacity(initialOpacity)
      console.log(`[Shadow CSS] Found and configured absolute element`)
    } else {
      console.log(`[Shadow CSS] No absolute element found in div[data-v-0ad64690]`)
    }

    console.log(`[Shadow CSS] CSS injected successfully after ${shadowCSSAttempts} attempts`)
    return true
  } catch (error) {
    console.error(`[Shadow CSS] Error during injection:`, error)
    return false
  }
}

function startShadowCSSInjection(): void {
  shadowCSSAttempts++

  if (shadowCSSAttempts > maxShadowCSSAttempts) {
    console.warn(
      `[Shadow CSS] Max attempts (${maxShadowCSSAttempts}) reached, stopping injection attempts`
    )
    return
  }

  console.log(
    `[Shadow CSS] Starting injection attempt ${shadowCSSAttempts}/${maxShadowCSSAttempts}`
  )

  if (injectShadowCSS()) {
    // 成功注入，停止重试
    stopShadowCSSInjection()
    return
  }

  // 失败，设置下次重试
  shadowCSSRetryId = setTimeout(() => {
    startShadowCSSInjection()
  }, shadowCSSRetryInterval)
}

function stopShadowCSSInjection(): void {
  if (shadowCSSRetryId) {
    clearTimeout(shadowCSSRetryId)
    shadowCSSRetryId = null
  }
}

function updateShadowElementOpacity(opacity: string): void {
  if (shadowTargetElement) {
    shadowTargetElement.style.opacity = opacity
    console.log(`[Shadow CSS] Updated element opacity to: ${opacity}`)
  }
}

function getTabData() {
  console.log('[Onboarding_getTabData] 获取tab数据')
  window.dispatchEvent(new Event('REQUEST_TAB_DATA'))
}

// 更新用户grade字段
async function updateUserGrade(grade: string) {
  try {
    const { $api } = useNuxtApp()
    await $api('/user/grade', {
      method: 'PUT',
      body: { grade }
    })
  } catch (error) {
    console.error('Failed to update grade:', error)
  }
}

// Watch isOnboarding state and update element opacity
watch(isOnboarding, (newValue) => {
  console.log(`[Shadow CSS] isOnboarding changed to: ${newValue}`)
  const opacity = newValue ? '1' : '0.2'
  updateShadowElementOpacity(opacity)
})

// 当白屏消失后，根据当前页面决定是否上报学段列表曝光（解决初始就在 level 时 watch 不触发的问题）
watch(isShowEmpty, (empty, prev) => {
  if (empty === false && prev === true) {
    if (currentStage.value === 'level' && !skipLevel.value && !hasTrackedGradeShow.value) {
      try {
        console.log('Plugin_Newuser_Onboarding_Grade_Show')
        $posthog?.capture?.('Plugin_Newuser_Onboarding_Grade_Show')
      } catch (e) {}
      hasTrackedGradeShow.value = true
    }
  }
})

onMounted(() => {
  const timestamp = new Date().toISOString()
  console.log(`[Onboarding] ${timestamp} - onMounted 开始`)

  // 1. 立即设置实验组 AB 测试结果并通知 FloatBtns
  sessionStorage.setItem('abtest_result', 'true')
  window.dispatchEvent(new Event('ONBOARDING_ABTEST_READY'))

  // 2. 检查是否已经完成onboarding流程
  if (sessionStorage.getItem('isCompletedExtOnboarding') !== null) {
    isOnboarding.value = true
    showAnimation.value = false
  }

  // 3. 检查Grade
  checkGrade()
  if (!checkUserGradeDone.value) {
    // 改为事件驱动：等待 ONBOARDING_GRADE_READY 后再读一次 session
    const onGradeReady = () => {
      window.removeEventListener('ONBOARDING_GRADE_READY' as any, onGradeReady)
      checkGrade()
    }
    window.addEventListener('ONBOARDING_GRADE_READY' as any, onGradeReady)
  }

  // 3. 先监听 message 事件
  window.addEventListener('message', handleMessage)

  // 5. 获取tab数据
  getTabData()

  // 6. Start Shadow DOM CSS injection
  startShadowCSSInjection()

  // 7. 消息监听器已在后面统一添加，这里不需要重复添加

  $pageViewEvent('Web_extension_installed')
  $pageViewEvent('Web_Extension_Installed')
  $trackAdjustEvent('6d6swq')

  // 8. 立即尝试获取并发送
  const firstUuid = $adjust.getWebUUID()
  webAdjustUserId = firstUuid === undefined ? null : firstUuid
  postUuid()

  // 9. 如果未获取到，启动重试
  if (!webAdjustUserId) {
    intervalId = setInterval(() => {
      const tryUuid = $adjust.getWebUUID()
      webAdjustUserId = tryUuid === undefined ? null : tryUuid
      if (webAdjustUserId) {
        postUuid()
        if (intervalId !== null) {
          clearInterval(intervalId)
          intervalId = null
        }
      } else if (++attempts >= maxAttempts) {
        if (intervalId !== null) {
          clearInterval(intervalId)
          intervalId = null
        }
      }
    }, 500)
  }

  try {
    ;(window as any).gtag('get', 'G-7QW6YNRL1Z', 'client_id', (clientId: string) => {
      if (clientId) {
        cid = clientId
        postCid()
      }
    })
  } catch (error) {}

  webAnonDeviceId = localStorage.getItem('webAnonDeviceId')
  if (webAnonDeviceId) {
    postAnonDeviceId()
  }

  // 10. 监听键盘事件
  window.addEventListener('keydown', handleKeyDown)

  // 11. 解题一键解题的onboarding流程
  window.addEventListener('onboarding_oneClick', () => {
    sessionStorage.setItem('isCompletedExtOnboarding', '1')
    $pageViewEvent('Plugin_onboarding_first')
    $posthog?.capture('Plugin_onboarding_first')
    if (typeof window !== 'undefined' && (window as any).confetti) {
      ;(window as any).confetti({
        particleCount: 150,
        spread: 120,
        origin: { x: 0.4, y: 0.8 },
        colors: ['#0073FF', '#FDA90D', '#FD0D0D']
      })
      setTimeout(() => {
        isOnboarding.value = true
        isClickSolveAll.value = true
        // 切换到第三个页面
        currentStage.value = 'congrats'

        // Plugin_Newuser_Onboarding_Tabs_Show - 在切换到 congrats 页面时发送埋点
        const tabUrl = tabList.value.map((tab) => tab.url).join(',') || ''
        $posthog?.capture('Plugin_Newuser_Onboarding_Tabs_Show', {
          Tab_URL: tabUrl || ''
        })
        console.log('Plugin_Newuser_Onboarding_Tabs_Show', {
          Tab_URL: tabUrl || ''
        })
      }, 0)
    }
  })

  // 12. 监听点击解题一键解题事件
  window.addEventListener('clickSolveAll', () => {
    isClickSolveAll.value = true
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
  window.removeEventListener('keydown', handleKeyDown)
  stopProgressUpdate()
  stopShadowCSSInjection()
  // 清理Shadow DOM元素引用
  shadowTargetElement = null
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
})

function stopProgressUpdate() {
  if (progressUpdateId) {
    cancelAnimationFrame(progressUpdateId)
    progressUpdateId = null
  }
}
</script>

<style>
*::after {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

body {
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    'Fira Sans',
    'Droid Sans',
    'Helvetica Neue',
    sans-serif;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
  height: 100%;
  margin: 0;
}

/* 使用 CSS 变量处理图片切换 */
.logo-image {
  content: var(--logo-image);
}

.badge-image {
  content: var(--badge-image);
}

.question-image {
  content: var(--question-image);
}

.question2-image {
  content: var(--question2-image);
}

/* 学习网站图标通用样式 */
.canvas-onboarding-icon {
  background-image: var(--canvas-icon);
}
.blackboard-onboarding-icon {
  background-image: var(--blackboard-icon);
}
.mcgraw-onboarding-icon {
  background-image: var(--mcgraw-icon);
}
.college-board-onboarding-icon {
  background-image: var(--college-board-icon);
}
.cengage-onboarding-icon {
  background-image: var(--cengage-icon);
}
.pearson-onboarding-icon {
  background-image: var(--pearson-icon);
}
.webassign-onboarding-icon {
  background-image: var(--webassign-icon);
}
.ati-testing-onboarding-icon {
  background-image: var(--ati-testing-icon);
}

/* 低年级学习网站图标样式 */
.i-ready-onboarding-icon {
  background-image: var(--i-ready-icon);
}
.ixl-onboarding-icon {
  background-image: var(--ixl-icon);
}
.imagine-learning-onboarding-icon {
  background-image: var(--imagine-learning-icon);
}
.khan-academy-onboarding-icon {
  background-image: var(--khan-academy-icon);
}
.quizizz-onboarding-icon {
  background-image: var(--quizizz-icon);
}
.edpuzzle-onboarding-icon {
  background-image: var(--edpuzzle-icon);
}
.deltamath-onboarding-icon {
  background-image: var(--deltamath-icon);
}
.google-docs-onboarding-icon {
  background-image: var(--google-docs-icon);
}

/* 通用图标样式 - 只影响onboarding页面 */
[class$='-onboarding-icon'] {
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

/* 亮色模式 */
[data-theme='light'] {
  --logo-image: url('~/assets/app/ext-onboarding/logo.webp');
  --badge-image: url('~/assets/app/ext-onboarding/badge.webp');
  --question-image: url('~/assets/app/ext-onboarding/question.webp');
  --question2-image: url('~/assets/app/ext-onboarding/question2.webp');

  /* 学习网站图标 */
  --canvas-icon: url('~/assets/app/ext-onboarding/website/canvas.svg');
  --blackboard-icon: url('~/assets/app/ext-onboarding/website/blackboard.svg');
  --mcgraw-icon: url('~/assets/app/ext-onboarding/website/mgGraw.svg');
  --college-board-icon: url('~/assets/app/ext-onboarding/website/college-board.svg');
  --cengage-icon: url('~/assets/app/ext-onboarding/website/cengage.svg');
  --pearson-icon: url('~/assets/app/ext-onboarding/website/pearson.svg');
  --webassign-icon: url('~/assets/app/ext-onboarding/website/webassign.svg');
  --ati-testing-icon: url('~/assets/app/ext-onboarding/website/ati-testing.svg');

  /* 低年级学习网站图标 */
  --i-ready-icon: url('~/assets/app/ext-onboarding/website/i-ready.svg');
  --ixl-icon: url('~/assets/app/ext-onboarding/website/ixl.svg');
  --imagine-learning-icon: url('~/assets/app/ext-onboarding/website/imagine-learning.svg');
  --khan-academy-icon: url('~/assets/app/ext-onboarding/website/khan-academy.svg');
  --quizizz-icon: url('~/assets/app/ext-onboarding/website/quizizz.svg');
  --edpuzzle-icon: url('~/assets/app/ext-onboarding/website/edpuzzle.svg');
  --deltamath-icon: url('~/assets/app/ext-onboarding/website/deltamath.svg');
  --google-docs-icon: url('~/assets/app/ext-onboarding/website/google-docs.svg');
}

/* 暗黑模式 */
[data-theme='dark'] {
  --logo-image: url('~/assets/app/ext-onboarding/logo-dark.webp');
  --badge-image: url('~/assets/app/ext-onboarding/badge-dark.webp');
  --question-image: url('~/assets/app/ext-onboarding/question-dark.webp');
  --question2-image: url('~/assets/app/ext-onboarding/question2-dark.webp');

  /* 学习网站图标 */
  --canvas-icon: url('~/assets/app/ext-onboarding/website/canvas.svg');
  --blackboard-icon: url('~/assets/app/ext-onboarding/website/blackboard.svg');
  --mcgraw-icon: url('~/assets/app/ext-onboarding/website/mgGraw.svg');
  --college-board-icon: url('~/assets/app/ext-onboarding/website/college-board-dark.svg');
  --cengage-icon: url('~/assets/app/ext-onboarding/website/cengage.svg');
  --pearson-icon: url('~/assets/app/ext-onboarding/website/pearson.svg');
  --webassign-icon: url('~/assets/app/ext-onboarding/website/webassign.svg');
  --ati-testing-icon: url('~/assets/app/ext-onboarding/website/ati-testing-dark.svg');

  /* 低年级学习网站图标 */
  --i-ready-icon: url('~/assets/app/ext-onboarding/website/i-ready.svg');
  --ixl-icon: url('~/assets/app/ext-onboarding/website/ixl.svg');
  --imagine-learning-icon: url('~/assets/app/ext-onboarding/website/imagine-learning.svg');
  --khan-academy-icon: url('~/assets/app/ext-onboarding/website/khan-academy.svg');
  --quizizz-icon: url('~/assets/app/ext-onboarding/website/quizizz.svg');
  --edpuzzle-icon: url('~/assets/app/ext-onboarding/website/edpuzzle.svg');
  --deltamath-icon: url('~/assets/app/ext-onboarding/website/deltamath.svg');
  --google-docs-icon: url('~/assets/app/ext-onboarding/website/google-docs.svg');
}

html {
  height: 100%;
}

.platforms-scroll-wrapper {
  overflow: hidden;
  position: relative;
  width: 100%;
}

.platforms-scroll-inner {
  display: flex;
  width: max-content;
  position: relative;
  animation: marquee 40s linear infinite;
  will-change: transform;
}

@keyframes marquee {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
}

.platforms-scroll-mask {
  background: linear-gradient(90deg, #f9fbff 0%, rgba(249, 251, 255, 0.2) 50%, #f9fbff 100%);
}

/* Fade transition for the free-solves image */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.8s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

/* slide-fade 过渡：左到右滑动 + 渐隐渐现 */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.4s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.slide-fade-enter-to {
  opacity: 1;
  transform: translateX(0);
}

.slide-fade-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

/* fade-out 过渡：白屏消失动画 */
.fade-out-enter-active,
.fade-out-leave-active {
  transition: opacity 0.6s ease-out;
}

.fade-out-enter-from,
.fade-out-leave-to {
  opacity: 0;
}

.fade-out-enter-to,
.fade-out-leave-from {
  opacity: 1;
}
</style>
