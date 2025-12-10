<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { getBrowserType } from '~/utils'
import ChromeIcon from '~/assets/app/extension/image/chrome.webp'
import EdgeIcon from '~/assets/app/extension/image/edge.webp'

useSeoMeta({
  title: 'All-in-One AI Homework Help | Boost Learning & Improve Grades',
  description:
    'Get instant study help with the Solvely.ai extension! Capture screenshots, ask questions on any webpage, and receive high-quality answers. Supports all subjects and academic levels.',
  robots: 'noindex, nofollow'
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: 'https://solvely.ai/extension'
    }
  ]
})

const { $firebaseLogEvent, $pageViewEvent, $trackAdjustEvent } = useNuxtApp()

const isEdgeBrowser = ref(false)
const isMenuOpen = ref(false)

const scrollY = ref(0)
// 谷歌浏览器商店地址
const chromeUrl =
  'https://chromewebstore.google.com/detail/solvelyai-ai-homework-hel/aedglnfjjccpifohekdeoogffomjcikm'
// edge浏览器商店地址
const edgeUrl =
  'https://microsoftedge.microsoft.com/addons/detail/solvelyai-ai-homework-/mmbhhcmacpojimkcgnkkfemajlfhdhoh'

const storeUrl = ref(chromeUrl)
// 当前url参数
const currentUrlQuery = ref('')
// 谷歌浏览器跳转地址
const storeJumpUrl = computed(() => {
  return `${storeUrl.value}${currentUrlQuery.value}`
})

const handleScroll = () => {
  scrollY.value = window.scrollY
}

const handleClickChrome = (params) => {
  $firebaseLogEvent('Web_Extension_LP_Outbound_Click', params)
  $trackAdjustEvent('vwv74g', params)
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  $pageViewEvent('LP_View_Extension')
  currentUrlQuery.value = location.search || ''
  isEdgeBrowser.value = getBrowserType() === 'edge'
  storeUrl.value = isEdgeBrowser.value ? edgeUrl : chromeUrl
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <header
    class="fixed left-0 right-0 top-0 z-50 flex h-16 w-full items-center justify-center transition-all duration-300"
    :class="{ 'bg-white': scrollY > 0 || isMenuOpen }"
  >
    <div class="flex w-full max-w-[1304px] items-center justify-between px-10">
      <a href="#app-extension" class="flex items-center justify-start gap-[6px]">
        <img src="~/assets/app/extension/image/logo.svg" alt="Solvely Logo" />
        <img src="~/assets/app/extension/image/logo-text.svg" alt="Solvely Logo Text" />
      </a>
      <div class="hidden items-center justify-end gap-4 min-[1200px]:flex">
        <a
          class="mx-auto flex h-10 cursor-pointer items-center justify-start gap-2.5 overflow-hidden rounded-[27px] bg-gradient-to-r from-[#007aff] to-[#A723FF] px-6 hover:translate-y-[-2px] hover:shadow-[0px_5px_12px_0px_rgba(76,151,203,0.43)] min-[1200px]:ml-0"
          :href="storeJumpUrl"
          target="_blank"
          @click="handleClickChrome({ position: 'header' })"
        >
          <img
            :src="isEdgeBrowser ? EdgeIcon : ChromeIcon"
            :alt="`${isEdgeBrowser ? 'Edge' : 'Chrome'}`"
            class="w-6"
          />
          <div
            class="cursor-pointer font-['Inter'] text-[16px] font-medium leading-relaxed text-white"
          >
            {{ isEdgeBrowser ? "Add to Edge - It's Free" : "Add to Chrome - It's Free" }}
          </div>
        </a>
      </div>
    </div>
  </header>
  <div
    id="app-extension"
    class="relative flex w-full flex-col items-start justify-start bg-white"
    @click="isMenuOpen = false"
  >
    <!-- Hero Section with Gradient Background -->
    <div class="relative w-full overflow-hidden bg-gradient-to-b from-[#b1d6ff] to-white">
      <!-- Background Blurs -->
      <div
        class="bg-linear-to-l absolute left-0 top-[-129px] h-[626px] w-full from-[#d0ffee] to-white/0 mix-blend-overlay blur-[219px] min-[1200px]:left-[283px] min-[1200px]:w-[606px]"
      ></div>
      <div
        class="absolute left-0 top-[-42px] h-[788px] w-full origin-top-left bg-white bg-opacity-70 blur-[113px] min-[1200px]:left-[-114px] min-[1200px]:w-[1109px] min-[1200px]:rotate-[14deg]"
      ></div>
      <div
        class="absolute left-1/2 top-[97px] h-[949px] w-[183px] origin-top-left bg-[#dd70ff]/10 blur-[74px] min-[1200px]:left-[773px] min-[1200px]:rotate-[-49deg]"
      ></div>
      <div
        class="absolute right-0 top-[-125px] h-[603px] w-[762px] origin-top-left rounded-full bg-[#b1f7ff]/30 blur-[62px] min-[1200px]:left-[1243px] min-[1200px]:rotate-[27deg]"
      ></div>

      <!-- Hero Content -->
      <div
        class="relative z-10 flex w-full flex-col items-center justify-start gap-2 px-10 pb-[60px] pt-[100px] min-[1200px]:pb-[100px] min-[1200px]:pt-[140px]"
      >
        <div
          class="flex w-full max-w-[1224px] flex-col items-center justify-start gap-[60px] min-[1200px]:flex-row"
        >
          <!-- Left Content -->
          <div
            class="flex w-full max-w-[1224px] flex-col items-start justify-start gap-10 min-[1200px]:w-[520px]"
          >
            <!-- Heading and Description -->
            <div
              class="flex w-full flex-col items-start justify-start gap-6 text-center min-[1200px]:text-left"
            >
              <h1 class="w-full">
                <span class="font-['Inter'] text-[48px] font-extrabold leading-[60px] text-black">
                  Your Best<br />
                </span>
                <span
                  class="font-['Inter'] text-[48px] font-extrabold leading-[60px] text-[#0e6eff]"
                >
                  AI Homework Helper
                </span>
                <span class="font-['Inter'] text-[48px] font-extrabold leading-[60px] text-black">
                  Extension
                </span>
              </h1>
              <div
                class="w-full font-['Inter'] text-2xl font-normal leading-[33.6px] tracking-[0] text-black opacity-70"
              >
                The simplest way to take a screenshot and get step-by-step solutions for any
                question.
              </div>
            </div>

            <!-- CTA Button -->
            <a
              class="mx-auto flex items-center justify-start gap-2.5 overflow-hidden rounded-[27px] bg-gradient-to-r from-[#007aff_0%] via-[#A723FF_51%] to-[#007aff_100%] bg-[length:200%_auto] px-8 py-[15px] transition-[background] hover:translate-y-[-2px] hover:bg-right hover:shadow-[0px_11px_22px_0px_rgba(76,151,203,0.22)] min-[1200px]:ml-0"
              :href="storeJumpUrl"
              target="_blank"
              @click="handleClickChrome({ position: 'hero' })"
            >
              <img
                :src="isEdgeBrowser ? EdgeIcon : ChromeIcon"
                :alt="`${isEdgeBrowser ? 'Edge' : 'Chrome'}`"
                class="w-6"
              />
              <div class="font-['Inter'] text-[18px] font-medium leading-[130%] text-white">
                {{ isEdgeBrowser ? "Add to Edge - It's Free" : "Add to Chrome - It's Free" }}
              </div>
              <img src="~/assets/app/extension/image/arrow.svg" alt="Arrow" />
            </a>

            <!-- Stats -->
            <div class="flex w-full items-start justify-between">
              <!-- Problems Solved Stat -->
              <div class="flex flex-col items-center justify-start">
                <div
                  class="text-center font-['Inter'] text-3xl font-extrabold leading-9 text-black"
                >
                  100M
                </div>
                <div
                  class="text-center font-['Inter'] text-sm font-medium leading-[16.8px] text-black"
                >
                  Problems Solved
                </div>
              </div>

              <!-- Divider -->
              <div class="h-[52px] w-[1px] bg-black/40"></div>

              <!-- Accuracy Stat -->
              <div class="flex flex-col items-center justify-start">
                <div
                  class="text-center font-['Inter'] text-3xl font-extrabold leading-9 text-black"
                >
                  98%
                </div>
                <div
                  class="text-center font-['Inter'] text-sm font-medium leading-[16.8px] text-black"
                >
                  Accurate
                </div>
              </div>

              <!-- Divider -->
              <div class="h-[52px] w-[1px] bg-black/40"></div>

              <!-- Rating Stat -->
              <div class="flex flex-col items-center justify-start">
                <div
                  class="text-center font-['Inter'] text-3xl font-extrabold leading-9 text-black"
                >
                  4.9
                </div>
                <div
                  class="text-center font-['Inter'] text-sm font-medium leading-[16.8px] text-black"
                >
                  {{ isEdgeBrowser ? 'Rating on web store' : 'Rating on chrome web store' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Hero Image -->
          <div
            class="mt-[60px] w-full overflow-hidden rounded-[32px] bg-transparent shadow-[0px_1px_4px_0px_rgba(78,61,67,0.12)] min-[1200px]:mt-0 min-[1200px]:w-[640px]"
          >
            <video
              class="h-full w-full"
              src="~/assets/app/extension/videos/solvely-ai-extension-user-guide-2.mp4"
              autoplay
              muted
              playsinline
              loop
              preload="auto"
              fetchpriority="high"
              poster="~/assets/app/extension/image/solvely-ai-extension-user-guide-2-poster.webp"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Works on All Websites You Need Section -->
    <section
      class="all-online-platforms-bg mt-[60px] flex w-full flex-col items-center justify-start gap-[52px] overflow-hidden pb-[150px] pt-[30px]"
    >
      <!-- Section Title -->
      <div class="flex w-full max-w-[1224px] flex-col items-center justify-center">
        <h2
          class="text-center font-['Inter'] text-[40px] font-[800] tracking-[-1px] text-black min-[1200px]:tracking-normal"
        >
          Works on All Websites You Need
        </h2>
        <p class="text-center font-['Inter'] text-[16px] font-[500] text-black opacity-[.7]">
          Including, but not limited to, the platforms shown below.
        </p>
      </div>

      <!-- Features -->
      <div class="flex w-full flex-col items-start justify-start gap-[120px] min-[1200px]:gap-44">
        <div class="w-full">
          <ul
            class="flex w-max animate-[extension-brands-marquee-scroll_20s_linear_infinite] items-center justify-center gap-[30px] px-[15px]"
          >
            <!-- 第一份内容 -->
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[30px] opacity-50"
                src="~/assets/app/extension/image/brands/khan-academy.svg"
                alt="Lhan Academy"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[40px] opacity-50"
                src="~/assets/app/extension/image/brands/blackboard.svg"
                alt="Blackboard"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[32px] opacity-50"
                src="~/assets/app/extension/image/brands/classmarker.svg"
                alt="Class Marker"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[30px] opacity-50"
                src="~/assets/app/extension/image/brands/google-classroom.svg"
                alt="Google Classroom"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[34px] opacity-50"
                src="~/assets/app/extension/image/brands/d2l.svg"
                alt="D2L"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[51px] opacity-50"
                src="~/assets/app/extension/image/brands/exam-builder.svg"
                alt="Exam Builder"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[32px] opacity-50"
                src="~/assets/app/extension/image/brands/canvas.svg"
                alt="Canvas"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[32px] opacity-50"
                src="~/assets/app/extension/image/brands/moodle.svg"
                alt="Moodle"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[32px] opacity-50"
                src="~/assets/app/extension/image/brands/schoology.svg"
                alt="Schoology"
              />
            </li>
            <!-- 复制一份内容，用于无限循环滚动 -->
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[30px] opacity-50"
                src="~/assets/app/extension/image/brands/khan-academy.svg"
                alt="Lhan Academy"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[40px] opacity-50"
                src="~/assets/app/extension/image/brands/blackboard.svg"
                alt="Blackboard"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[32px] opacity-50"
                src="~/assets/app/extension/image/brands/classmarker.svg"
                alt="Class Marker"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[30px] opacity-50"
                src="~/assets/app/extension/image/brands/google-classroom.svg"
                alt="Google Classroom"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[34px] opacity-50"
                src="~/assets/app/extension/image/brands/d2l.svg"
                alt="D2L"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[51px] opacity-50"
                src="~/assets/app/extension/image/brands/exam-builder.svg"
                alt="Exam Builder"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[32px] opacity-50"
                src="~/assets/app/extension/image/brands/canvas.svg"
                alt="Canvas"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[32px] opacity-50"
                src="~/assets/app/extension/image/brands/moodle.svg"
                alt="Moodle"
              />
            </li>
            <li
              class="flex h-[108px] min-w-[285px] items-center justify-center rounded-[18px] bg-white"
            >
              <img
                class="h-[32px] opacity-50"
                src="~/assets/app/extension/image/brands/schoology.svg"
                alt="Schoology"
              />
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- AI-Driven Student Success Section -->
    <section
      class="flex w-full flex-col items-center justify-start gap-[80px] overflow-hidden px-10 pb-[90px] pt-[30px]"
    >
      <!-- Section Title -->
      <div
        class="flex w-full max-w-[1224px] flex-col items-center justify-center gap-12 min-[1200px]:gap-24"
      >
        <h2
          class="text-center font-['Inter'] text-[40px] font-[800] tracking-[-1px] text-black min-[1200px]:tracking-normal"
        >
          AI-Driven Student Success
        </h2>
      </div>

      <!-- Features -->
      <div
        class="flex w-full max-w-[1224px] flex-col items-center justify-center gap-[120px] min-[1200px]:gap-44"
      >
        <div
          class="flex w-full max-w-[600px] flex-wrap items-center justify-center gap-[48px] font-['Inter'] min-[1200px]:max-w-full min-[1200px]:flex-nowrap min-[1200px]:justify-between min-[1200px]:gap-[0]"
        >
          <div
            class="flex h-[260px] w-[240px] flex-col items-center justify-center gap-[10px] rounded-[24px] bg-[#DDF7FD] py-[38px]"
          >
            <div class="pb-[10px]">
              <img src="~/assets/app/extension/image/school-student.svg" alt="Student" />
            </div>
            <div class="text-[50px] font-[800] leading-[50px] text-black">
              <p>6M+</p>
            </div>
            <div
              class="flex flex-col items-center justify-center text-[16px] font-[500] leading-[1.3] text-black"
            >
              <p class="opacity-70">Happy</p>
              <p class="opacity-70">Students</p>
            </div>
          </div>
          <div
            class="flex h-[260px] w-[240px] flex-col items-center justify-center gap-[10px] rounded-[24px] bg-[#F2E3FF] py-[38px]"
          >
            <div class="pb-[10px]">
              <img src="~/assets/app/extension/image/higher-grades.svg" alt="Student" />
            </div>
            <div class="text-[50px] font-[800] leading-[50px] text-black">
              <p>92%</p>
            </div>
            <div
              class="flex flex-col items-center justify-center text-[16px] font-[500] leading-[1.3] text-black"
            >
              <p class="opacity-70">of Students</p>
              <p class="opacity-70">Improved Grades</p>
            </div>
          </div>
          <div
            class="flex h-[260px] w-[240px] flex-col items-center justify-center gap-[10px] rounded-[24px] bg-[#CFFFF0] py-[38px]"
          >
            <div class="pb-[10px]">
              <img src="~/assets/app/extension/image/faster-assignments.svg" alt="Student" />
            </div>
            <div class="text-[50px] font-[800] leading-[50px] text-black">
              <p>50%</p>
            </div>
            <div
              class="flex flex-col items-center justify-center text-[16px] font-[500] leading-[1.3] text-black"
            >
              <p class="opacity-70">Less</p>
              <p class="opacity-70">Homework Time</p>
            </div>
          </div>
          <div
            class="flex h-[260px] w-[240px] flex-col items-center justify-center gap-[10px] rounded-[24px] bg-[#FFF2C4] py-[38px]"
          >
            <div class="pb-[10px]">
              <img src="~/assets/app/extension/image/stress-reduced.svg" alt="Student" />
            </div>
            <div class="text-[50px] font-[800] leading-[50px] text-black">
              <p>10X</p>
            </div>
            <div
              class="flex flex-col items-center justify-center text-[16px] font-[500] leading-[1.3] text-black"
            >
              <p class="opacity-70">Fast</p>
              <p class="opacity-70">Learning</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How it Works Section -->
    <section
      id="how-it-works"
      class="flex w-full flex-col items-center justify-start gap-[80px] overflow-hidden px-10 py-[90px]"
    >
      <!-- Section Title -->
      <div
        class="flex w-full max-w-[1224px] flex-col items-center justify-center gap-12 min-[1200px]:gap-24"
      >
        <h2
          class="text-center font-['Inter'] text-[40px] font-[800] tracking-[-1px] text-black min-[1200px]:tracking-normal"
        >
          How it Works
        </h2>
      </div>

      <!-- Features -->
      <div
        class="flex w-full max-w-[1224px] flex-col items-center justify-center gap-[120px] font-['Inter'] min-[1200px]:gap-44"
      >
        <div
          class="flex w-full max-w-[700px] flex-wrap items-center justify-center gap-[48px] font-['Inter'] min-[1200px]:max-w-full min-[1200px]:flex-nowrap min-[1200px]:justify-between min-[1200px]:gap-[0]"
        >
          <div
            class="flex size-[350px] flex-col items-center justify-center gap-[22px] rounded-[23px] bg-[#F9FAFC] bg-[linear-gradient(137deg,#FBF6FF_3%,#EAF8FF_42%,#FAFCFF_98%)] p-[30px] sm:size-[526px] sm:p-[48px] min-[1200px]:size-[350px] min-[1200px]:p-[30px]"
          >
            <div
              class="flex w-full grow flex-col overflow-hidden rounded-[17px] bg-white shadow-[inset_0_0_4px_2px_rgba(255,255,255,0.70)]"
            >
              <div class="flex h-[26px] w-full items-center gap-[4px] bg-[#F5F9FF] px-[16px]">
                <span class="inline-block h-[6px] w-[6px] rounded-full bg-[#FE6057]"></span>
                <span class="inline-block h-[6px] w-[6px] rounded-full bg-[#FFBD2E]"></span>
                <span class="inline-block h-[6px] w-[6px] rounded-full bg-[#27C841]"></span>
              </div>
              <div class="flex grow items-center justify-center">
                <a
                  class="mx-auto flex h-[55px] items-center justify-start gap-[10px] overflow-hidden rounded-[27px] bg-gradient-to-r from-[#007aff] to-[#A723FF] px-[24px]"
                  :href="storeJumpUrl"
                  target="_blank"
                  @click="handleClickChrome({ position: 'feature5' })"
                >
                  <img
                    :src="isEdgeBrowser ? EdgeIcon : ChromeIcon"
                    :alt="`${isEdgeBrowser ? 'Edge' : 'Chrome'}`"
                    class="w-6"
                  />
                  <span
                    class="whitespace-nowrap font-['Inter'] text-[18px] font-medium leading-[130%] text-white sm:text-[28px] min-[1200px]:text-[18px]"
                  >
                    {{ isEdgeBrowser ? 'Add to Edge' : 'Add to Chrome' }}
                  </span>
                  <img src="~/assets/app/extension/image/arrow.svg" alt="Arrow" />
                </a>
              </div>
            </div>
            <div class="flex w-full flex-col gap-[12px]">
              <div
                class="text-[24px] font-[700] leading-[1.3] text-black sm:text-[34px] min-[1200px]:text-[24px]"
              >
                <p>Step 1</p>
              </div>
              <div
                class="text-[16px] font-[400] leading-[1.4] text-black sm:text-[20px] min-[1200px]:text-[16px]"
              >
                <p>
                  Click the
                  <span class="text-[#0E6EFF]"
                    >''Add to {{ isEdgeBrowser ? 'Edge' : 'Chrome' }}''</span
                  >
                  button on the page.
                </p>
              </div>
            </div>
          </div>
          <div
            class="flex size-[350px] flex-col items-center justify-center gap-[22px] rounded-[23px] bg-[#F9FAFC] bg-[linear-gradient(137deg,#FBF6FF_3%,#EAF8FF_42%,#FAFCFF_98%)] p-[30px] sm:size-[526px] sm:p-[48px] min-[1200px]:size-[350px] min-[1200px]:p-[30px]"
          >
            <div
              class="flex w-full grow flex-col overflow-hidden rounded-[17px] bg-white shadow-[inset_0_0_4px_2px_rgba(255,255,255,0.70)]"
            >
              <div class="flex h-[26px] w-full items-center gap-[4px] bg-[#F5F9FF] px-[16px]">
                <span class="inline-block h-[6px] w-[6px] rounded-full bg-[#FE6057]"></span>
                <span class="inline-block h-[6px] w-[6px] rounded-full bg-[#FFBD2E]"></span>
                <span class="inline-block h-[6px] w-[6px] rounded-full bg-[#27C841]"></span>
              </div>
              <div class="flex grow flex-wrap items-center justify-center p-[18px] pb-[20px]">
                <div class="h-[50%] w-[50%] pr-[4px]">
                  <div class="flex flex-col gap-[4px]">
                    <div class="flex items-center justify-start gap-[2px]">
                      <img
                        src="~/assets/app/extension/image/logo.svg"
                        width="23"
                        height="23"
                        alt="Solvely Logo"
                      />
                      <img
                        src="~/assets/app/extension/image/logo-text.svg"
                        class="h-[22px]"
                        alt="Solvely Logo Text"
                      />
                    </div>
                    <div class="inline-flex items-center justify-start font-[700] text-black">
                      <img
                        src="~/assets/app/extension/image/solvely-link.svg"
                        alt="Solvely Link"
                        class="inline"
                      />
                      <span
                        class="inline-block text-[12px] leading-[.7]"
                        style="transform: scale(0.6)"
                        >4.8</span
                      >
                      <span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="7"
                          height="7"
                          viewBox="0 0 7 7"
                          fill="none"
                        >
                          <path
                            d="M3.56801 0.267578L4.26357 2.51845H6.51444L4.69345 3.90956L5.389 6.16043L3.56801 4.76932L1.74702 6.16043L2.44258 3.90956L0.621582 2.51845H2.87245L3.56801 0.267578Z"
                            fill="black"
                          />
                        </svg>
                      </span>
                    </div>
                    <div class="inline-flex items-center justify-start gap-[0.5em] pr-[28px]">
                      <span class="h-[6px] w-[1.5em] rounded-[2px] bg-[#F0F4F9]"></span>
                      <span class="h-[6px] grow rounded-[2px] bg-[#F0F4F9]"></span>
                    </div>
                  </div>
                </div>
                <div class="h-[50%] w-[50%] pl-[4px]">
                  <div class="relative">
                    <a
                      class="mx-auto flex h-[40px] w-[100px] cursor-pointer items-center justify-center overflow-hidden rounded-[27px] bg-gradient-to-r from-[#007aff] to-[#A723FF]"
                      :href="storeJumpUrl"
                      target="_blank"
                      @click="handleClickChrome({ position: 'feature6' })"
                    >
                      <span
                        class="font-['Inter'] text-[18px] font-medium leading-[130%] text-white"
                      >
                        Install
                      </span>
                    </a>
                    <img
                      src="~/assets/app/extension/image/click-hand-1.svg"
                      class="absolute left-[50%] top-[80%] h-[56px]"
                      alt="Install Solvely"
                    />
                  </div>
                </div>
                <div class="h-[50%] w-[50%] pr-[4px]">
                  <div class="h-full w-full rounded-[6px] bg-[#F0F4F9]"></div>
                </div>
                <div class="h-[50%] w-[50%] pr-[4px]">
                  <div class="h-full w-full rounded-[6px] bg-[#F0F4F9]"></div>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-[12px]">
              <div
                class="text-[24px] font-[700] leading-[1.3] text-black sm:text-[34px] min-[1200px]:text-[24px]"
              >
                <p>Step 2</p>
              </div>
              <div
                class="text-[16px] font-[400] leading-[1.4] text-black sm:text-[20px] min-[1200px]:text-[16px]"
              >
                <p>
                  On the {{ isEdgeBrowser ? 'Edge' : 'Chrome' }} store, click
                  <span class="text-[#0E6EFF]">''Install''</span> and then click
                  <span class="text-[#0E6EFF]">'Confirm'</span>.
                </p>
              </div>
            </div>
          </div>
          <div
            class="flex size-[350px] flex-col items-center justify-center gap-[22px] rounded-[23px] bg-[#F9FAFC] bg-[linear-gradient(137deg,#FBF6FF_3%,#EAF8FF_42%,#FAFCFF_98%)] p-[30px] sm:size-[526px] sm:p-[48px] min-[1200px]:size-[350px] min-[1200px]:p-[30px]"
          >
            <div
              class="flex w-full grow flex-col overflow-hidden rounded-[17px] bg-white shadow-[inset_0_0_4px_2px_rgba(255,255,255,0.70)]"
            >
              <div class="flex h-[26px] w-full items-center gap-[4px] bg-[#F5F9FF] px-[16px]">
                <span class="inline-block h-[6px] w-[6px] rounded-full bg-[#FE6057]"></span>
                <span class="inline-block h-[6px] w-[6px] rounded-full bg-[#FFBD2E]"></span>
                <span class="inline-block h-[6px] w-[6px] rounded-full bg-[#27C841]"></span>
              </div>
              <div class="flex h-full items-center justify-center p-[20px] pr-0">
                <div class="flex h-full grow flex-col justify-between">
                  <div class="relative">
                    <img
                      src="~/assets/app/extension/image/screenshot.svg"
                      class="w-full"
                      alt="Screenshot"
                    />
                    <div class="absolute bottom-[-8%] left-[10%]">
                      <div
                        class="flex h-[24px] w-max items-center justify-center gap-[6px] rounded-[9px] bg-white p-[3px] shadow-[0_3px_18px_0_rgba(52,50,123,0.22)]"
                        style="transform: scale(0.66); transform-origin: left top"
                      >
                        <img
                          src="~/assets/app/extension/image/logo.svg"
                          class="h-[15px]"
                          alt="Solvely Logo"
                        />
                        <div class="h-[15px] border-r border-[#CCC]"></div>
                        <div
                          class="inline-flex h-full items-center justify-center gap-[3px] text-[12px] text-[#555]"
                        >
                          <span class="inline-flex items-center justify-center gap-[3px] px-[6px]">
                            <svg
                              class="size-[12px]"
                              width="9"
                              height="9"
                              viewBox="0 0 9 9"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M6.68066 2.21582L2.37008 6.5264"
                                stroke="#999999"
                                stroke-width="0.653152"
                                stroke-linecap="round"
                              />
                              <path
                                d="M6.68042 6.52539L2.36984 2.21481"
                                stroke="#999999"
                                stroke-width="0.653152"
                                stroke-linecap="round"
                              />
                            </svg>
                            Cancel
                          </span>
                          <span class="inline-flex items-center justify-center gap-[3px] px-[6px]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="size-[12px]"
                              width="9"
                              height="9"
                              viewBox="0 0 9 9"
                              fill="none"
                            >
                              <path
                                d="M5.94952 5.49084H6.75819C6.92997 5.49084 7.06921 5.3516 7.06921 5.17982V2.06957C7.06921 1.8978 6.92997 1.75854 6.75819 1.75854H3.64794C3.47616 1.75854 3.33691 1.8978 3.33691 2.06957C3.33691 2.06957 3.33691 2.27092 3.33691 2.87823"
                                stroke="#999999"
                                stroke-width="0.653152"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                              <rect
                                x="1.84375"
                                y="2.87769"
                                width="4.10553"
                                height="4.10553"
                                rx="0.559845"
                                stroke="#999999"
                                stroke-width="0.653152"
                              />
                            </svg>
                            Copy
                          </span>
                          <span
                            class="h-full rounded-[6px] bg-[#007AFF] px-[15px] text-white shadow-[0_0_12px_0_rgba(0,0,0,0.12)]"
                          >
                            Solve
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div class="my-[4px] h-[6px] rounded-[2px] bg-[#F0F4F9]"></div>
                    <div class="h-[6px] w-[55%] rounded-[2px] bg-[#F0F4F9]"></div>
                  </div>
                </div>
                <div class="flex h-full w-[45%] items-center justify-end">
                  <div class="flex flex-col items-center justify-center gap-[10px]">
                    <div
                      class="relative flex size-[36px] items-center justify-center rounded-[50%] border border-[#007AFF] bg-[#F9F9F9] shadow-[0_0_13px_0_rgba(52,50,123,0.22)]"
                    >
                      <a
                        class="cursor-pointer"
                        :href="storeJumpUrl"
                        target="_blank"
                        @click="handleClickChrome({ position: 'feature7' })"
                      >
                        <img
                          src="~/assets/app/extension/image/scissor.svg"
                          width="26"
                          height="26"
                          alt="Solvely Logo"
                        />
                      </a>
                      <img
                        src="~/assets/app/extension/image/click-hand-2.svg"
                        class="absolute right-[110%] top-[46%] scale-[1.6]"
                        alt="Use Solvely"
                      />
                    </div>
                    <div
                      class="flex size-[44px] items-center justify-center rounded-l-[50%] bg-[#F9F9F9] shadow-[0_0_13px_0_rgba(52,50,123,0.22)]"
                    >
                      <a
                        class="cursor-pointer"
                        :href="storeJumpUrl"
                        target="_blank"
                        @click="handleClickChrome({ position: 'feature8' })"
                      >
                        <img
                          src="~/assets/app/extension/image/logo.svg"
                          width="26"
                          height="26"
                          alt="Solvely Logo"
                        />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-[12px]">
              <div
                class="text-[24px] font-[700] leading-[1.3] text-black sm:text-[34px] min-[1200px]:text-[24px]"
              >
                <p>Step 3</p>
              </div>
              <div
                class="text-[16px] font-[400] leading-[1.4] text-black sm:text-[20px] min-[1200px]:text-[16px]"
              >
                <p>
                  Take a screenshot or select the text. Get answer in less than
                  <span class="text-[#0E6EFF]">5 seconds</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- All-in-One AI Learning Companion Section -->
    <div
      id="features"
      class="flex w-full flex-col items-center justify-start gap-[100px] overflow-hidden px-10 py-[60px]"
    >
      <div
        class="flex w-full max-w-[1224px] flex-col items-start justify-start gap-12 min-[1200px]:gap-24"
      >
        <!-- Section Title -->
        <div class="flex w-full items-center justify-center">
          <h2 class="text-center tracking-[-1px] min-[1200px]:tracking-normal">
            <span class="font-['Inter'] text-[40px] font-extrabold leading-[45.6px] text-[#0e6eff]"
              >All-in-One
            </span>
            <span class="font-['Inter'] text-[40px] font-extrabold leading-[45.6px] text-black"
              >AI Learning Companion</span
            >
          </h2>
        </div>

        <!-- Features -->
        <div
          class="flex w-full max-w-[1224px] flex-col items-start justify-start gap-[120px] min-[1200px]:gap-44"
        >
          <!-- Feature 1: Instant and Accurate Solutions -->
          <div
            class="flex w-full flex-col items-center justify-center gap-5 min-[1200px]:flex-row min-[1200px]:gap-20"
          >
            <!-- Feature 1 Image -->
            <div
              class="outline-opacity-50 relative order-2 w-full overflow-hidden rounded-[26px] px-[50px] min-[1200px]:order-1 min-[1200px]:w-[539px] min-[1200px]:px-0"
            >
              <!-- Chart Image -->
              <img src="~/assets/app/extension/image/image_01.webp" alt="Chart" />
            </div>

            <!-- Feature 1 Text -->
            <div
              class="order-1 flex w-full flex-col items-start justify-center gap-10 min-[1200px]:order-2 min-[1200px]:flex-1"
            >
              <div class="flex w-full flex-col items-start justify-start gap-5">
                <div class="flex w-full flex-col items-start justify-start gap-4">
                  <h3
                    class="w-full text-center font-['Inter'] text-[26px] font-bold leading-loose text-black min-[1200px]:text-left"
                  >
                    Instant and Accurate Solutions
                  </h3>
                  <div
                    class="w-full font-['Inter'] text-base font-normal leading-snug text-black opacity-70"
                  >
                    Solvely delivers answers in seconds, ensuring you're never stuck on homework.
                    With 24/7 support, you can get help anytime, anywhere.<br /><br />
                    Find clear, step-by-step solutions to any question. Solvely's AI is 30% more
                    accurate than ChatGPT.
                  </div>
                </div>
              </div>
              <a
                class="hidden h-12 cursor-pointer items-center justify-start gap-2.5 overflow-hidden rounded-[27px] bg-gradient-to-r from-[#007aff] to-[#A723FF] px-6 min-[1200px]:flex"
                :href="storeJumpUrl"
                target="_blank"
                @click="handleClickChrome({ position: 'feature1' })"
              >
                <div class="font-['Inter'] text-base font-medium text-white">Install Now</div>
              </a>
            </div>
          </div>

          <!-- Feature 2: Take a Screenshot, Get an Answer -->
          <div
            class="flex w-full flex-col items-center justify-center gap-5 min-[1200px]:flex-row min-[1200px]:gap-20"
          >
            <!-- Feature 2 Text -->
            <div class="flex w-full flex-col items-start justify-center gap-10 min-[1200px]:flex-1">
              <div class="flex w-full flex-col items-start justify-start gap-5">
                <div class="flex w-full flex-col items-start justify-start gap-4">
                  <h3
                    class="w-full text-center font-['Inter'] text-[26px] font-bold leading-loose text-black min-[1200px]:text-left"
                  >
                    Take a Screenshot, Get an Answer
                  </h3>
                  <div
                    class="w-full font-['Inter'] text-base font-normal leading-snug text-black opacity-70"
                  >
                    Screenshot any question for instant AI help! Just snap your problem, and Solvely
                    will provide a quick solution.<br /><br />
                    Use Solvely's extension on any website. It works seamlessly with platforms like
                    Blackboard, Canvas, Google Classroom, and Moodle.
                  </div>
                </div>
              </div>
              <a
                class="hidden h-12 cursor-pointer items-center justify-start gap-2.5 overflow-hidden rounded-[27px] bg-gradient-to-r from-[#007aff] to-[#A723FF] px-6 min-[1200px]:flex"
                :href="storeJumpUrl"
                target="_blank"
                @click="handleClickChrome({ position: 'feature2' })"
              >
                <div class="font-['Inter'] text-base font-medium text-white">Install Now</div>
              </a>
            </div>

            <!-- Feature 2 Image -->
            <div
              class="relative w-full overflow-hidden rounded-[26px] px-[50px] min-[1200px]:w-[539px] min-[1200px]:px-0"
            >
              <img src="~/assets/app/extension/image/image_02.webp" alt="Image" />
            </div>
          </div>

          <!-- Feature 3: Any Subject, Any Level -->
          <div
            class="flex w-full flex-col items-center justify-center gap-5 min-[1200px]:flex-row min-[1200px]:gap-20"
          >
            <!-- Feature 3 Image -->
            <div
              class="order-2 w-full overflow-hidden rounded-[26px] px-[50px] min-[1200px]:order-1 min-[1200px]:w-[539px] min-[1200px]:px-0"
            >
              <img src="~/assets/app/extension/image/image_03.webp" alt="Image" />
            </div>

            <!-- Feature 3 Text -->
            <div
              class="order-1 flex w-full flex-col items-start justify-center gap-10 min-[1200px]:order-2 min-[1200px]:flex-1"
            >
              <div class="flex w-full flex-col items-start justify-start gap-5">
                <div class="flex w-full flex-col items-start justify-start gap-4">
                  <h3
                    class="w-full text-center font-['Inter'] text-[26px] font-bold leading-loose text-black min-[1200px]:text-left"
                  >
                    Any Subject, Any Level
                  </h3>
                  <div
                    class="w-full font-['Inter'] text-base font-normal leading-snug text-black opacity-70"
                  >
                    Whether you're tackling a simple equation or a complex multi-step problem or
                    tricky word problem, it breaks down each step to help you understand.<br /><br />
                    From math and chemistry to finance and more, Solvely AI supports students from
                    K-12 to graduate level in learning and mastering concepts.
                  </div>
                </div>
              </div>
              <a
                class="hidden h-12 cursor-pointer items-center justify-start gap-2.5 overflow-hidden rounded-[27px] bg-gradient-to-r from-[#007aff] to-[#A723FF] px-6 min-[1200px]:flex"
                :href="storeJumpUrl"
                target="_blank"
                @click="handleClickChrome({ position: 'feature3' })"
              >
                <div class="font-['Inter'] text-base font-medium text-white">Install Now</div>
              </a>
            </div>
          </div>

          <!-- Feature 4: Clarify Your Understanding -->
          <div
            class="flex w-full flex-col items-center justify-center gap-5 min-[1200px]:flex-row min-[1200px]:gap-20"
          >
            <!-- Feature 4 Text -->
            <div class="flex w-full flex-col items-start justify-center gap-10 min-[1200px]:flex-1">
              <div class="flex w-full flex-col items-start justify-start gap-5">
                <div class="flex w-full flex-col items-start justify-start gap-4">
                  <h3
                    class="w-full text-center font-['Inter'] text-[26px] font-bold leading-loose text-black min-[1200px]:text-left"
                  >
                    Clarify Your Understanding, Boost Your Grades
                  </h3>
                  <div
                    class="w-full font-['Inter'] text-base font-normal leading-snug text-black opacity-70"
                  >
                    If you don't understand the answer, Solvely helps you break it down further,
                    step-by-step. It's like a patient tutor, giving clear guidance until you
                    understand.<br /><br />
                    Beyond answers, Solvely explains each step. With its help, you'll grasp
                    concepts, master techniques, and solve questions confidently.
                  </div>
                </div>
              </div>
              <a
                class="hidden h-12 cursor-pointer items-center justify-start gap-2.5 overflow-hidden rounded-[27px] bg-gradient-to-r from-[#007aff] to-[#A723FF] px-6 min-[1200px]:flex"
                :href="storeJumpUrl"
                target="_blank"
                @click="handleClickChrome({ position: 'feature4' })"
              >
                <div class="font-['Inter'] text-base font-medium text-white">Install Now</div>
              </a>
            </div>

            <!-- Feature 4 Image -->
            <div
              class="flex w-full items-center justify-center overflow-hidden rounded-[26px] px-[50px] min-[1200px]:w-[539px] min-[1200px]:px-0"
            >
              <img src="~/assets/app/extension/image/image_04.webp" alt="Image" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <section
      id="reviews"
      class="flex flex-col items-center justify-start gap-8 self-stretch overflow-hidden px-5 py-10 sm:gap-[52px] sm:px-10 sm:py-[60px]"
    >
      <div
        class="relative flex w-full max-w-[1224px] flex-col items-center justify-center gap-8 sm:gap-[52px]"
      >
        <!-- 标题部分 -->
        <div class="flex w-full max-w-[1224px] items-center justify-center gap-1">
          <img src="~/assets/app/extension/image/laurel-03.webp" alt="icon" class="w-[74px]" />
          <div class="flex flex-col items-center justify-center gap-2">
            <img src="~/assets/app/extension/image/star.svg" alt="icon" class="w-[254px]" />
            <h2
              class="whitespace-nowrap text-center font-['Inter'] text-[40px] font-extrabold leading-tight sm:text-[38px] sm:leading-[45.60px]"
            >
              <span class="text-[#0e6eff]">Trusted by users</span>
              <span class="text-black"> worldwide</span>
            </h2>
          </div>
          <img src="~/assets/app/extension/image/laurel-04.webp" alt="icon" class="w-[74px]" />
        </div>

        <!-- 评论卡片 - 移动端单列布局 -->
        <div
          class="flex flex-col items-center justify-start gap-5 self-stretch min-[1200px]:hidden"
        >
          <div class="flex w-full max-w-[392px] flex-col items-start justify-start gap-5">
            <!-- 卡片1 -->
            <div
              class="flex h-auto w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] bg-[#e7eaff] px-5 py-[17px]"
            >
              <div class="flex items-center justify-start gap-2 self-stretch">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_03.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @harold
                </div>
              </div>
              <p
                class="self-stretch font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]"
              >
                This app makes it super convenient for me to take screenshots in the quiz. I don't
                have to keep switching between different pages. It's really handy!
              </p>
            </div>

            <!-- 卡片2 -->
            <div
              class="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] bg-[#ffeae7] p-5"
            >
              <div class="flex items-center justify-start gap-2 self-stretch">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_04.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @Jianping Zhang
                </div>
              </div>
              <p
                class="self-stretch font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]"
              >
                Wow, It solves questions accurately, and the operation is very simple and
                convenient, great tool
              </p>
            </div>

            <!-- 卡片3 -->
            <div
              class="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] bg-[#e5fcee] p-5"
            >
              <div class="flex items-center justify-start gap-2 self-stretch">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_05.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @William
                </div>
              </div>
              <p
                class="self-stretch font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]"
              >
                I've never used such an efficient and convenient screenshot software. It has greatly
                shortened the time I spend on completing my homework. I am happy to recommend it to
                everyone!!!
              </p>
            </div>
          </div>
        </div>

        <!-- 评论卡片网格 - 桌面端三列布局 -->
        <div class="hidden grid-cols-3 gap-6 self-stretch min-[1200px]:grid">
          <!-- 第一列 -->
          <div class="flex flex-col gap-6">
            <!-- 卡片1 -->
            <div class="flex flex-col gap-2 overflow-hidden rounded-[20px] bg-[#fafade] p-5">
              <div class="flex items-center gap-2">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_07.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @Caspian Atticus
                </div>
              </div>
              <p class="font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]">
                Thi extension is an absolute game-changer! Not only does it make capturing images
                incredibly quick and efficient, but its ability to analyze and solve problems
                directly from screenshots is truly remarkable. The accuracy and speed of
                problem-solving have significantly improved my workflow. The interface is intuitive,
                and the functionality is seamless. It's become an indispensable tool in my daily
                work routine. Highly recommend this extension to anyone looking to boost their
                productivity. Definitely worth 5 stars!
              </p>
            </div>

            <!-- 卡片2 -->
            <div class="flex grow flex-col gap-2 overflow-hidden rounded-[20px] bg-[#e7fcff] p-5">
              <div class="flex items-center gap-2">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_06.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @Kristen
                </div>
              </div>
              <p class="font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]">
                God saved my life, and Solvely.ai saved my day. Straight A's this semester, y'all!
                🙌📚
              </p>
            </div>
          </div>

          <!-- 第二列 -->
          <div class="flex flex-col gap-6">
            <!-- 卡片3 -->
            <div class="flex flex-col gap-2 overflow-hidden rounded-[20px] bg-[#e7eaff] p-5">
              <div class="flex items-center gap-2">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_03.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @harold
                </div>
              </div>
              <p class="font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]">
                This app makes it super convenient for me to take screenshots in the quiz. I don't
                have to keep switching between different pages. It's really handy!
              </p>
            </div>

            <!-- 卡片4 -->
            <div class="flex flex-col gap-2 overflow-hidden rounded-[20px] bg-[#ffeae7] p-5">
              <div class="flex items-center gap-2">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_04.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @Jianping Zhang
                </div>
              </div>
              <p class="font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]">
                Wow, It solves questions accurately, and the operation is very simple and
                convenient, great tool
              </p>
            </div>

            <!-- 卡片5 -->
            <div class="flex flex-col gap-2 overflow-hidden rounded-[20px] bg-[#e5fcee] p-5">
              <div class="flex items-center gap-2">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_05.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @William
                </div>
              </div>
              <p class="font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]">
                I've never used such an efficient and convenient screenshot software. It has greatly
                shortened the time I spend on completing my homework. I am happy to recommend it to
                everyone!!!
              </p>
            </div>
          </div>

          <!-- 第三列 -->
          <div class="flex flex-col gap-6">
            <!-- 卡片6 -->
            <div class="flex flex-col gap-2 overflow-hidden rounded-[20px] bg-[#e5fcee] p-5">
              <div class="flex items-center gap-2">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_02.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @Go Ruidoc
                </div>
              </div>
              <p class="font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]">
                Screenshots are very convenient, The solution is very accurate, recommended!
              </p>
            </div>

            <!-- 卡片7 -->
            <div class="flex grow flex-col gap-2 overflow-hidden rounded-[20px] bg-[#e7fcff] p-5">
              <div class="flex items-center gap-2">
                <div class="relative h-[50px] w-[50px] overflow-hidden rounded-full bg-white">
                  <img
                    class="h-full w-full object-cover"
                    src="~/assets/app/extension/image/avatar_01.webp"
                    alt="User"
                  />
                </div>
                <div class="font-['Inter'] text-sm font-medium text-[#0d0d0d] opacity-50">
                  @Peilin
                </div>
              </div>
              <p class="font-['Inter'] text-base font-normal leading-snug text-[#0d0d0d]">
                I've found the Solvely.ai Chrome extension to be an invaluable addition to my
                academic toolkit. Its screenshot feature allows me to capture homework questions
                directly from my screen, providing instant, step-by-step solutions that enhance my
                understanding of complex problems. The ability to save problems for later review and
                access solutions in various formats and languages further enriches my study
                sessions. This extension seamlessly integrates into my workflow, making learning
                more efficient and effective.
              </p>
            </div>
          </div>
        </div>

        <!-- 底部渐变遮罩 -->
        <div
          class="absolute bottom-0 h-[121px] w-full bg-gradient-to-b from-white/0 to-white"
        ></div>
      </div>
    </section>

    <!-- Final CTA Section -->
    <div class="slogan flex w-full flex-col items-center justify-start px-10 py-[60px] text-white">
      <div class="flex w-full max-w-[1224px] flex-col items-center justify-start gap-8">
        <div class="text-center">
          <span class="font-['Inter'] text-[38px] font-extrabold leading-[45.6px]"
            >Use the Solvely extension &
          </span>
          <span class="font-['Inter'] text-[38px] font-extrabold leading-[45.6px]"
            >boost your studies with AI!</span
          >
        </div>
        <a
          :href="storeJumpUrl"
          target="_blank"
          class="flex h-[76px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-[38px] bg-[#101010] px-6 py-5 min-[1200px]:gap-2.5 min-[1200px]:px-11"
          @click="handleClickChrome({ position: 'cta' })"
        >
          <img
            :src="isEdgeBrowser ? EdgeIcon : ChromeIcon"
            :alt="`${isEdgeBrowser ? 'Edge' : 'Chrome'}`"
            class="w-6"
          />
          <div
            class="font-['Inter'] text-lg font-medium leading-tight text-white min-[1200px]:text-2xl min-[1200px]:leading-[28.80px]"
          >
            {{ isEdgeBrowser ? "Add to Edge - It's Free" : "Add to Chrome - It's Free" }}
          </div>
        </a>
      </div>
    </div>
  </div>
  <footer class="flex w-full items-center justify-center">
    <div class="flex h-20 w-full max-w-[1304px] items-center justify-between px-10">
      <div
        class="justify-center text-center font-['Inter'] text-sm font-medium leading-none text-[#282828]"
      >
        © 2025 Solvely
      </div>
      <div class="inline-flex items-center justify-start gap-5">
        <div class="flex items-center justify-start gap-2">
          <a
            href="https://solvely.ai/term"
            target="_blank"
            class="cursor-pointer justify-center text-center font-['Inter'] text-sm font-medium leading-none text-[#282828]"
          >
            Terms of Service
          </a>
        </div>
        <div class="h-[14px] w-[1px] bg-black/40"></div>
        <div class="flex items-center justify-start gap-2">
          <a
            href="https://solvely.ai/privacy-policy"
            target="_blank"
            class="cursor-pointer justify-center text-center font-['Inter'] text-sm font-medium leading-none text-[#282828]"
          >
            Privacy Policy
          </a>
        </div>
        <div class="h-[14px] w-[1px] bg-black/40"></div>
        <div class="flex items-center justify-start gap-2">
          <a
            href="https://solvely.ai/honor-code"
            target="_blank"
            class="cursor-pointer justify-center text-center font-['Inter'] text-sm font-medium leading-none text-[#282828]"
          >
            Honor Code
          </a>
        </div>
      </div>
    </div>
  </footer>
  <a
    :href="storeJumpUrl"
    target="_blank"
    class="fixed bottom-[100px] left-1/2 z-50 flex h-[76px] -translate-x-1/2 transform cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-[38px] bg-[#101010] px-6 py-5 min-[1200px]:left-auto min-[1200px]:hidden"
    @click="handleClickChrome({ position: 'footer' })"
  >
    <img
      :src="isEdgeBrowser ? EdgeIcon : ChromeIcon"
      :alt="`${isEdgeBrowser ? 'Edge' : 'Chrome'}`"
      class="w-6"
    />
    <div
      class="font-['Inter'] text-lg font-medium leading-tight text-white min-[1200px]:text-2xl min-[1200px]:leading-[28.80px]"
    >
      {{ isEdgeBrowser ? "Add to Edge - It's Free" : "Add to Chrome - It's Free" }}
    </div>
  </a>
</template>

<style scoped>
.slogan {
  background-image: url('~/assets/app/extension/image/slogan_bg.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
.all-online-platforms-bg {
  background-image: url('~/assets/app/extension/image/online-platforms-background.webp');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
</style>

<style>
@keyframes extension-brands-marquee-scroll {
  0% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(-50%);
  }
}
</style>
