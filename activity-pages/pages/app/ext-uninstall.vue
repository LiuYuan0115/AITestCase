<template>
  <div class="uninstall min-w-[898px]" :class="!isSubmitted ? 'min-h-[780px]' : 'min-h-screen'">
    <div
      class="mx-auto flex min-w-[898] max-w-[1440px] flex-col"
      :class="!isSubmitted ? 'min-h-[780px]' : 'min-h-screen'"
    >
      <!-- Logo Section -->
      <div class="mb-[30px] flex h-[80px] items-center pl-[100px]">
        <a href="https://solvely.ai"
          ><img
            src="~/assets/app/ext-uninstall/logo.webp"
            alt="Solvely.ai"
            class="h-[50px] w-[153px]"
        /></a>
      </div>

      <!-- Main Content Section -->
      <div class="flex flex-1 items-center justify-center" :class="{ 'items-center': isSubmitted }">
        <template v-if="!isSubmitted">
          <div class="flex w-[712px] flex-col">
            <!-- Title Section -->
            <h1 class="mb-[16px] text-[36px] font-semibold leading-[1]">Sorry to see you go</h1>
            <p class="mb-[16px] text-[14px] leading-[21px]">
              Solvely is improving with exciting updates and new capabilities. Let us know why
              you're leaving, and consider staying to see what's next!
            </p>

            <!-- Two Column Layout -->
            <ClientOnly class="h-[540px]">
              <div class="pt-16px flex justify-between">
                <!-- Form Section -->
                <div class="flex w-[360px] flex-col">
                  <!-- Checkboxes -->
                  <div
                    v-for="(option, index) in reasonOptions"
                    :key="index"
                    :class="[
                      'mb-2 flex h-[36px] cursor-pointer items-center rounded-[6px] border border-[#EEEEEE] text-[14px]',
                      'hover:bg-[#F6F8FA]',
                      formData.reasons.includes(option) ? 'bg-[#ECF5FF] text-[#007AFF]' : '',
                      'select-none'
                    ]"
                    @click="toggleReason(option)"
                  >
                    <input
                      type="checkbox"
                      :checked="formData.reasons.includes(option)"
                      class="mx-3 h-[14px] w-[14px] rounded-[3px] border border-[#ccc] bg-[#fff]"
                      @click.stop
                    />
                    <span class="select-none text-[14px]">{{ option }}</span>
                  </div>

                  <!-- Other Feedback -->
                  <div class="mt-[4px] flex flex-col">
                    <p class="mb-[8px] text-[14px] leading-[18px]">Other</p>
                    <textarea
                      v-model="formData.otherReason"
                      placeholder="Could you share with us any other reason? Your feedback is greatly valued"
                      class="h-[114px] w-full resize-none rounded-xl border border-[#EEEEEE] p-3 text-[14px] text-[#111] placeholder:text-[#999] focus:outline-none"
                    ></textarea>
                  </div>

                  <!-- Submit Button -->
                  <button
                    :disabled="!isFormValid"
                    :class="[
                      'text-medium mt-[12px] h-[32px] w-[112px] rounded-[30px] text-[14px] text-white',
                      isFormValid ? 'bg-[#007AFF]' : 'bg-[#EEEEEE]'
                    ]"
                    @click="handleSubmit"
                  >
                    Submit
                  </button>
                </div>

                <!-- Right Card Section -->
                <div class="w-[302px]">
                  <span v-if="!isSubmitted" class="cursor-pointer" @click="handleReinstall">
                    <img
                      src="~/assets/app/ext-uninstall/reinstall.webp"
                      alt="Don't miss what's next"
                      class="h-[184px] w-[302px]"
                    />
                  </span>
                </div>
              </div>
            </ClientOnly>
          </div>
        </template>

        <template v-else>
          <!-- Submitted State -->
          <div class="flex w-[560px] flex-col items-center gap-[16px] pb-[250px] text-center">
            <img src="~/assets/app/ext-uninstall/robot.webp" class="h-[88px] w-[88px]" />
            <h1 class="text-[18px] font-semibold leading-[1]">Feedback received. We'll improve!</h1>
            <p class="text-[14px] leading-[21px] text-[#555]">
              Thanks for your feedback! We're already hard at work on the next version. Reinstall
              now to get all future updates automatically and see the difference!
            </p>
            <button
              class="text-semibold h-[41px] rounded-[30px] bg-[#007AFF] px-[21px] text-[16px] text-[#fff]"
              @click="handleReinstall"
            >
              Reinstall now
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNuxtApp } from '#app'

const { $pageViewEvent, $firebaseLogEvent, $posthog } = useNuxtApp()

const isSubmitted = ref(false)

const reasonOptions = [
  'Inaccurate / Wrong Answers',
  'Technical Issues / Bugs / Compatibility Issues',
  'Difficult to Use',
  'Lacks Needed Features/ Limited Features',
  'Found Better Alternatives',
  'Infrequent Need / Rarely Used',
  'Privacy Concerns',
  'Usage Limit Reached / Cost Issues'
].sort(() => Math.random() - 0.5)

// 选项与简写的映射关系
const reasonMapping = {
  'Inaccurate / Wrong Answers': 'wrong',
  'Technical Issues / Bugs / Compatibility Issues': 'bug',
  'Difficult to Use': 'difficult',
  'Lacks Needed Features/ Limited Features': 'limitfeature',
  'Found Better Alternatives': 'alternatives',
  'Infrequent Need / Rarely Used': 'rare',
  'Privacy Concerns': 'privacy',
  'Usage Limit Reached / Cost Issues': 'usage'
}

const formData = ref({
  reasons: [] as string[],
  otherReason: ''
})

const isFormValid = computed(() => {
  return formData.value.reasons.length > 0 || formData.value.otherReason.trim().length > 0
})

const toggleReason = (reason: string) => {
  const index = formData.value.reasons.indexOf(reason)
  if (index === -1) {
    // 选中状态，触发埋点
    formData.value.reasons.push(reason)
    // 获取对应的简写
    const shortName = reasonMapping[reason as keyof typeof reasonMapping]
    // 触发埋点
    $firebaseLogEvent?.('Plugin_feedback_submit', { [shortName]: 1 })
    $posthog?.capture('Plugin_feedback_submit', { [shortName]: 1 })
  } else {
    formData.value.reasons.splice(index, 1)
  }
}

const handleReinstall = () => {
  $firebaseLogEvent?.('Plugin_feedback_reinstall')
  $posthog?.capture('Plugin_feedback_reinstall')

  // 判断是否为 Edge 浏览器
  const isEdge = /Edg/.test(navigator.userAgent)

  // 根据浏览器类型跳转到不同的链接
  const chromeStoreUrl =
    'https://chromewebstore.google.com/detail/solvelyai-ai-homework-hel/aedglnfjjccpifohekdeoogffomjcikm'
  const edgeStoreUrl =
    'https://microsoftedge.microsoft.com/addons/detail/solvelyai-ai-homework-/mmbhhcmacpojimkcgnkkfemajlfhdhoh'

  window.location.href = isEdge ? edgeStoreUrl : chromeStoreUrl
}

const handleSubmit = () => {
  if (!isFormValid.value) return

  // 构建选中原因的数据
  const selectedReasons = formData.value.reasons.reduce((acc, reason) => {
    const shortName = reasonMapping[reason as keyof typeof reasonMapping]
    return { ...acc, [shortName]: 1 }
  }, {})

  // 如果有其他原因，添加到上报数据中
  const eventData = formData.value.otherReason.trim()
    ? { ...selectedReasons, userText: formData.value.otherReason.trim() }
    : selectedReasons

  // 触发埋点
  $firebaseLogEvent?.('Plugin_feedback_submit', eventData)
  $posthog?.capture('Plugin_feedback_submit', eventData)

  isSubmitted.value = true

  setTimeout(() => {
    window.location.href = 'https://solvely.ai/home'
  }, 15000)
}

onMounted(() => {
  $pageViewEvent?.('Plugin_feedback_uninstall')
})

// SEO
useSeoMeta({
  title: 'Solvely - Take a Picture Math Solver Online',
  robots: 'noindex'
})
</script>

<style>
*::after {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html {
  height: 100%;
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
  color: #111;
  text-rendering: optimizeLegibility;
  font-weight: 500;
}

/* Custom checkbox styles */
input[type='checkbox'] {
  appearance: none;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 3px;
  cursor: pointer;
}

input[type='checkbox']:checked {
  background-color: #007aff;
  border-color: #007aff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='none'%3E%3Cpath d='M11.6666 3.5L5.24992 9.91667L2.33325 7' stroke='white' stroke-width='1.66667' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-position: center;
  background-repeat: no-repeat;
}

.uninstall {
  background:
    radial-gradient(38.02% 18% at 100% 93.98%, #fff 0%, rgba(255, 255, 255, 0) 100%),
    radial-gradient(37.85% 30.91% at 0% 100%, #fff 0%, rgba(255, 255, 255, 0) 100%),
    linear-gradient(180deg, #e4fdff 0%, #fff 43.48%);
}
</style>
