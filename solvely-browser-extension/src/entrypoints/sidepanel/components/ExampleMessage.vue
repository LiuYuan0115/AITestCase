<template>
  <div class="flex flex-col gap-[20px] mb-[20px]">
    <div>
      <UserMessage v-if="!isExperiment" :message="controlUserMessage" />
      <UserMessageBlock v-else :message="experimentUserMessage" />
    </div>
    
    <!-- Loading 状态 -->
    <div v-if="isLoading" class="pb-[20px] w-8">
      <Vue3Lottie
        v-if="isDark"
        :animation-data="loadingPromptDark"
        :width="32"
        :height="32"
        :loop="true"
        :autoplay="true"
        :style="{ margin: '-4px' }"
      />
      <Vue3Lottie
        v-else
        :animation-data="loadingPrompt"
        :width="32"
        :height="32"
        :loop="true"
        :autoplay="true"
        :style="{ margin: '-4px' }"
      />
    </div>
    
    <!-- 答案内容 -->
    <div v-else>
      <div
        :class="[
          'inline-flex justify-center items-start gap-[10px]',
          'self-stretch rounded-[16px] transition-colors duration-200',
        ]"
      >
        <AnswerInfo
          v-if="currentAnswer.answerJsonObject"
          :data="currentAnswerData"
          :isExample="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, inject } from 'vue'
import UserMessage from './UserMessage.vue'
import type { UserMessage as UserMessageType } from '../types/message'
import { MessageType } from '../types/message'
import { QuestionType } from '../types/question'
import exampleQuestion from '~/assets/images/onboarding/example-question.webp'
import geoImage from '~/assets/images/onboarding/geo.webp'
import geoDarkImage from '~/assets/images/onboarding/geo-dark.webp'
import calImage from '~/assets/images/onboarding/cal.webp'
import calDarkImage from '~/assets/images/onboarding/cal-dark.webp'
import AnswerInfo from './solvingMessage/AnswerInfo/index.vue'
import { STORAGE_KEYS } from '~/types/config'
import { LatexSandboxSymbol } from '~/plugins/latex-sandbox'
import { LatexSandboxService } from '~/services/latex-sandbox'
import { Vue3Lottie } from 'vue3-lottie'
import loadingPrompt from '@/assets/animations/loading-prompt.json'
import loadingPromptDark from '@/assets/animations/loading-prompt-dark.json'
import { useDarkMode } from '@/composables/useDarkMode'
import { getShowExampleQuestion } from '@/entrypoints/background/service/datasync'
import useABTest from '@/composables/useABTest'
import UserMessageBlock from './UserMessageBlock.vue'

// 定义题目类型
type ExampleType = 'geometry' | 'calculus'

const sandboxService = inject<LatexSandboxService>(LatexSandboxSymbol)
const { isDark } = useDarkMode()

// 内部管理的题目类型状态
const exampleType = ref<ExampleType>('geometry')
// AB 实验：是否实验组（T 组）
const { isOnboardingNew, isABTestReady } = useABTest()
const isExperiment = computed(() => isOnboardingNew.value === true)

// 几何题目数据（支持暗黑模式）
const geometryExampleUserMessage = computed<UserMessageType>(() => ({
  type: MessageType.USER,
  id: '1',
  content: {
    type: QuestionType.PHOTO,
    value: isDark.value ? geoDarkImage : geoImage,
  },
  timestamp: Date.now(),
}))

// 微积分题目数据（支持暗黑模式）
const calculusExampleUserMessage = computed<UserMessageType>(() => ({
  type: MessageType.USER,
  id: '2',
  content: {
    type: QuestionType.PHOTO,
    value: isDark.value ? calDarkImage : calImage,
  },
  timestamp: Date.now(),
}))

// 控制组消息（固定几何，使用原来的 example-question.webp）
const controlUserMessage = computed<UserMessageType>(() => ({
  type: MessageType.USER,
  id: 'control',
  content: {
    type: QuestionType.PHOTO,
    value: exampleQuestion,
  },
  timestamp: Date.now(),
}))
// 实验组消息（几何/微积分按存储决定）
const experimentUserMessage = computed(() =>
  exampleType.value === 'calculus' ? calculusExampleUserMessage.value : geometryExampleUserMessage.value
)

// 添加 loading 状态
const isLoading = ref(true)

// 模拟流出输出：代码从 useSolve 和 SolveCore 中提出
const currentAnswer = reactive({
  command: '',
  content: '',
  answerJsonObject: null as any,
})

const isWaiting = ref(false)
const isDone = ref(false)

const currentAnswerData = computed(() => {
  return {
    language: 'en',
    questionId: '',
    answer: currentAnswer.content,
    answerJsonObject: currentAnswer.answerJsonObject,
  }
})

// 几何题目流式数据
const geometryStreamData = [
  { content: '', command: 'keepalive' },
  {
    content: '',
    command: 'pending',
    renderType: 'stepAndAnswer',
    renderStyle: 'dsl',
  },
  { content: '', command: 'pending', contentSection: 'finalAnswer' },
  { content: '\n', command: 'pending' },
  { content: '\\( ', command: 'pending' },
  { content: '\\boxed{m\\angle ', command: 'pending' },
  { content: 'ABC ', command: 'pending' },
  { content: '= ', command: 'pending' },
  { content: '90^\\circ} ', command: 'pending' },
  { content: '\\)', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepTitle' },
  { content: 'Determine ', command: 'pending' },
  { content: 'if ', command: 'pending' },
  { content: '$\\angle ', command: 'pending' },
  { content: 'ABC$ ', command: 'pending' },
  { content: 'is ', command: 'pending' },
  { content: 'a ', command: 'pending' },
  { content: 'right ', command: 'pending' },
  { content: 'angle.', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepBody' },
  { content: 'It ', command: 'pending' },
  { content: 'is ', command: 'pending' },
  { content: 'given ', command: 'pending' },
  { content: 'that ', command: 'pending' },
  { content: ' $\\overline{AB} \\perp \\overline{BC}$, ', command: 'pending' },
  { content: 'which ', command: 'pending' },
  { content: 'means ', command: 'pending' },
  { content: 'that ', command: 'pending' },
  { content: 'segments ', command: 'pending' },
  { content: 'AB ', command: 'pending' },
  { content: 'and ', command: 'pending' },
  { content: 'BC ', command: 'pending' },
  { content: 'are ', command: 'pending' },
  { content: 'perpendicular. ', command: 'pending' },
  { content: 'Therefore, ', command: 'pending' },
  { content: '$\\angle ', command: 'pending' },
  { content: 'ABC$ ', command: 'pending' },
  { content: 'is ', command: 'pending' },
  { content: 'a ', command: 'pending' },
  { content: 'right ', command: 'pending' },
  { content: 'angle.', command: 'pending' },
  { content: '\n\n', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepTitle' },
  { content: 'Determine ', command: 'pending' },
  { content: 'the ', command: 'pending' },
  { content: 'measure ', command: 'pending' },
  { content: 'of ', command: 'pending' },
  { content: 'a ', command: 'pending' },
  { content: 'right ', command: 'pending' },
  { content: 'angle.', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepBody' },
  { content: 'A ', command: 'pending' },
  { content: 'right ', command: 'pending' },
  { content: 'angle ', command: 'pending' },
  { content: 'measures ', command: 'pending' },
  { content: '90 ', command: 'pending' },
  { content: 'degrees. ', command: 'pending' },
  { content: 'Thus, ', command: 'pending' },
  { content: '$m\\angle ', command: 'pending' },
  { content: 'ABC ', command: 'pending' },
  { content: '= ', command: 'pending' },
  { content: '90^\\circ$.', command: 'pending' },
  { content: '\n', command: 'pending' },
  {
    content:
      ' Determine if $\\angle ABC$ is a right angle.\n It is given that $\\overline{AB} \\perp \\overline{BC}$, which means that segments AB and BC are perpendicular. Therefore, $\\angle ABC$ is a right angle.\n\n Determine the measure of a right angle. A right angle measures 90 degrees. Thus, $m\\angle ABC = 90^\\circ$. \n\\( \\boxed{m\\angle ABC = 90^\\circ} \\)\n',
    command: 'done',
  },
]

// 微积分题目流式数据
const calculusStreamData = [
  { content: '', command: 'keepalive' },
  { content: '', command: 'pending', renderType: 'stepAndAnswer', renderStyle: 'dsl' },
  { content: '', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'thinking' },
  { content: '', command: 'pending' },
  { content: 'To', command: 'pending' },
  { content: ' calculate the derivative of the function $f(x) = 3x^2 + ', command: 'pending' },
  { content: '2x + 1$ at the point $x=2$, we first find the', command: 'pending' },
  { content: ' derivative of the function with respect to $x$.\n\nThe derivative of $f(x)$ is denoted as $f\'(x)$. We can use the power rule for', command: 'pending' },
  { content: ' differentiation, which states that $\\frac{d}{dx}(x^n) = nx^{n-1}$.\n\nApplying the power rule to each term:', command: 'pending' },
  { content: '\nThe derivative of $3x^2$ is $3 \\cdot 2x^{2-1} = 6x$.\nThe derivative of $2x$ is $2 \\cdot 1x^{1-1} =', command: 'pending' },
  { content: ' 2x^0 = 2 \\cdot 1 = 2$.\nThe derivative of a constant term, $1$, is $0$.\n\nSo, the derivative of the function $f(x)$ is $f\'(x)', command: 'pending' },
  { content: ' = 6x + 2$.\n\nNow, we need to evaluate this derivative at the point $x=2$. We substitute $x=2$ into $f\'(x)$:\n$f\'(2) = 6(2) + 2$.\n\n', command: 'pending' },
  { content: '$f\'(2) =', command: 'pending' },
  { content: ' 12 + 2 = 14$.\n\nThe derivative of the function $f(x) = 3x^2 + 2x + 1$ at the point $x=2$ is 14.\n\n', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'finalAnswer' },
  { content: '1', command: 'pending' },
  { content: '. ', command: 'pending' },
  { content: '\\(\\boldsymbol{14}\\)', command: 'pending' },
  { content: '\n\n', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'solving' },
  { content: '', command: 'pending', contentSection: 'question' },
  { content: 'Calculate the derivative of', command: 'pending' },
  { content: ' \\(f(x) = 3x^2', command: 'pending' },
  { content: ' + 2x + 1\\) at \\', command: 'pending' },
  { content: '(x = 2\\)', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepTitle' },
  { content: 'Find the derivative of the function', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepOverview' },
  { content: 'Differentiate the function using the power rule.', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepBody' },
  { content: 'The derivative is \\(f\'(x', command: 'pending' },
  { content: ') = 6x + 2\\). Each', command: 'pending' },
  { content: ' term is differentiated: the derivative of \\(3x', command: 'pending' },
  { content: '^2\\) is \\(6x\\),', command: 'pending' },
  { content: ' the derivative of \\(2x\\) is \\', command: 'pending' },
  { content: '(2\\), and the derivative of the constant \\', command: 'pending' },
  { content: '(1\\) is \\(0\\).', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepTitle' },
  { content: 'Evaluate the derivative at \\(x =', command: 'pending' },
  { content: ' 2\\)', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepOverview' },
  { content: 'Substitute \\', command: 'pending' },
  { content: '(x = 2\\) into the derivative to', command: 'pending' },
  { content: ' find the value at that point.', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionStepBody' },
  { content: 'The', command: 'pending' },
  { content: ' value is \\(f\'(2) = 6', command: 'pending' },
  { content: ' \\times 2 + 2 = 12 +', command: 'pending' },
  { content: ' 2 = 14\\). Substituting \\', command: 'pending' },
  { content: '(x = 2\\) into \\(f', command: 'pending' },
  { content: '\'(x)\\) gives \\(14\\).', command: 'pending' },
  { content: '', command: 'pending', contentSection: 'questionAnswer' },
  { content: '\\(\\boldsymbol{14', command: 'pending' },
  { content: '}\\)', command: 'pending' },
  {
    content: 'To calculate the derivative of the function $f(x) = 3x^2 + 2x + 1$ at the point $x=2$, we first find the derivative of the function with respect to $x$.\n\nThe derivative of $f(x)$ is denoted as $f\'(x)$. We can use the power rule for differentiation, which states that $\\frac{d}{dx}(x^n) = nx^{n-1}$.\n\nApplying the power rule to each term:\nThe derivative of $3x^2$ is $3 \\cdot 2x^{2-1} = 6x$.\nThe derivative of $2x$ is $2 \\cdot 1x^{1-1} = 2x^0 = 2 \\cdot 1 = 2$.\nThe derivative of a constant term, $1$, is $0$.\n\nSo, the derivative of the function $f(x)$ is $f\'(x) = 6x + 2$.\n\nNow, we need to evaluate this derivative at the point $x=2$. We substitute $x=2$ into $f\'(x)$:\n$f\'(2) = 6(2) + 2$.\n\n$f\'(2) = 12 + 2 = 14$.\n\nThe derivative of the function $f(x) = 3x^2 + 2x + 1$ at the point $x=2$ is 14.\n\n1. \\(\\boldsymbol{14}\\)\n\nCalculate the derivative of \\(f(x) = 3x^2 + 2x + 1\\) at \\(x = 2\\)Find the derivative of the functionDifferentiate the function using the power rule.The derivative is \\(f\'(x) = 6x + 2\\). Each term is differentiated: the derivative of \\(3x^2\\) is \\(6x\\), the derivative of \\(2x\\) is \\(2\\), and the derivative of the constant \\(1\\) is \\(0\\).Evaluate the derivative at \\(x = 2\\)Substitute \\(x = 2\\) into the derivative to find the value at that point.The value is \\(f\'(2) = 6 \\times 2 + 2 = 12 + 2 = 14\\). Substituting \\(x = 2\\) into \\(f\'(x)\\) gives \\(14\\).\\(\\boldsymbol{14}\\)',
    command: 'done'
  }
]

// 根据题目类型选择流式数据
const fakeStreamData = computed(() => {
  return exampleType.value === 'calculus' ? calculusStreamData : geometryStreamData
})

function renderDsl(content: string, rest: any, answerJson: any) {
  const { contentSection } = rest
  if (!Array.isArray(answerJson.questions)) {
    answerJson.questions = []
  }
  if (!answerJson.questions[answerJson.currentIndex]) {
    answerJson.questions[answerJson.currentIndex] = {
      question: '',
      questionSteps: [],
    }
  }
  if (!answerJson.currentSection && !contentSection) {
    return answerJson
  }
  if (contentSection) {
    answerJson.currentSection = contentSection
    if (contentSection === 'questionStepTitle') {
      answerJson.questionStepIndex =
        answerJson.questions[answerJson.currentIndex].questionSteps.length
    }
  }
  let currentStep
  switch (answerJson.currentSection) {
    case 'question': {
      if (contentSection === 'question') {
        answerJson.questions[answerJson.currentIndex].question = content
      } else {
        answerJson.questions[answerJson.currentIndex].question += content
      }
      break
    }
    case 'questionStepTitle': {
      if (contentSection === 'questionStepTitle') {
        answerJson.questions[answerJson.currentIndex].questionSteps[
          answerJson.questionStepIndex
        ] = {
          questionStepTitle: content,
          questionStepBody: '',
        }
      } else {
        currentStep =
          answerJson.questions[answerJson.currentIndex].questionSteps[
            answerJson.questionStepIndex
          ]
        if (currentStep) {
          currentStep.questionStepTitle += content
        }
      }
      break
    }
    case 'questionStepBody': {
      currentStep =
        answerJson.questions[answerJson.currentIndex].questionSteps[
          answerJson.questionStepIndex
        ]
      if (!currentStep) {
        answerJson.questions[answerJson.currentIndex].questionSteps[
          answerJson.questionStepIndex
        ] = {
          questionStepTitle: '',
          questionStepBody: '',
        }
        currentStep =
          answerJson.questions[answerJson.currentIndex].questionSteps[
            answerJson.questionStepIndex
          ]
      }
      if (contentSection === 'questionStepBody') {
        currentStep.questionStepBody = content
      } else {
        currentStep.questionStepBody += content
      }
      break
    }
    case 'finalAnswer': {
      if (contentSection === 'finalAnswer') {
        answerJson.finalAnswer = content
      } else {
        answerJson.finalAnswer = (answerJson.finalAnswer || '') + content
      }
      break
    }
  }
  return answerJson
}

function handleSimulatedMessageEvent(data: any) {
  const { content, command, ...rest } = data || {}
  if (command === 'pending' && content && !isWaiting.value) {
    isWaiting.value = true
  }
  if (command === 'pending' || command === 'graph') {
    currentAnswer.content += content
    currentAnswer.command = command
    currentAnswer.answerJsonObject = renderDsl(
      content,
      rest,
      currentAnswer.answerJsonObject || {
        finalAnswer: '',
        questions: [],
        currentSection: '',
        currentIndex: 0,
        questionStepIndex: 0,
      }
    )
  } else if (command === 'done' || command === 'all') {
    currentAnswer.command = command
    currentAnswer.content = content
  }
}

async function simulateStream() {
  // 先显示 1.5s 的 loading
  isLoading.value = true
  await new Promise((r) => setTimeout(r, 1800))
  
  // 开始流式输出
  isLoading.value = false
  currentAnswer.command = ''
  currentAnswer.content = ''
  currentAnswer.answerJsonObject = null
  isWaiting.value = false
  isDone.value = true
  
  for (const data of fakeStreamData.value) {
    handleSimulatedMessageEvent(data)
    await new Promise((r) => setTimeout(r, 60))
  }
}

// 当满足条件后触发一次模拟（需要 AB 就绪并且沙盒就绪）
const abInitDone = ref(false)
const isInitializing = ref(false) // 添加初始化锁，防止重复初始化

const trySimulate = () => {
  if (abInitDone.value && sandboxService?.isReady.value && !isDone.value) {
    simulateStream()
  }
}
watch(() => sandboxService?.isReady.value, trySimulate)

onMounted(async () => {
  browser.storage.local.set({ [STORAGE_KEYS.ONBOARDING_COMPLETED]: true })
  
  // 初始化 AB 结果并据此设置题目类型
  const initByAB = async () => {
    // 防止重复初始化
    if (isInitializing.value || abInitDone.value) {
      return
    }
    
    isInitializing.value = true
    try {
      // 确保在 isABTestReady 为 true 后才获取数据
      if (isExperiment.value) {
        const questionType = await getShowExampleQuestion()
        exampleType.value = questionType === 'question2' ? 'calculus' : 'geometry'
      } else {
        exampleType.value = 'geometry'
      }
    } catch (error) {
      console.error('AB测试初始化失败:', error)
      exampleType.value = 'geometry'
    } finally {
      abInitDone.value = true
      isInitializing.value = false
      trySimulate()
    }
  }

  // 确保等待 isABTestReady 为 true 后才执行初始化
  const waitForABTestReady = () => {
    return new Promise<void>((resolve) => {
      if (isABTestReady.value) {
        // 如果已经就绪，直接执行
        initByAB().then(resolve)
      } else {
        // 如果未就绪，等待就绪状态
        const stop = watch(
          () => isABTestReady.value,
          async (ready) => {
            if (ready) {
              stop()
              await initByAB()
              resolve()
            }
          }
        )
      }
    })
  }
  
  await waitForABTestReady()
})
</script>
