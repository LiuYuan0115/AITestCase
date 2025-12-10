<template>
  <div class="relative mx-auto flex h-screen min-h-[726px] min-w-[1200px] max-w-[1400px] flex-col">
    <div class="min-h-[98px] flex-[0.4]">
      <div class="flex items-center justify-between px-[40px] pt-[21px]">
        <img
          src="~/assets/app/ext-onboarding/logo.webp"
          alt="Solvely.ai"
          class="h-[32px] w-[129px]"
        />
        <img
          src="~/assets/app/ext-onboarding/badge.webp"
          alt="2025 Chrome's Feature Extension"
          class="h-[56px] w-[198px]"
        />
      </div>
    </div>

    <div>
      <div class="font-inter text-center text-[32px] font-bold leading-[1.3]">
        <template v-if="isOnboarding">
          <p>👏Congratulations! You've successfully solved 1 question</p>
          <p>Go ahead to solve your questions on any webpage</p>
        </template>
        <template v-else>
          <p>🎉You've installed the Solvely.ai Extension!</p>
          <p>Capture any problem on any webpage and get instant solutions!</p>
        </template>
      </div>

      <div class="mt-[60px] flex flex-col items-center gap-[40px]">
        <p class="text-[18px] font-normal leading-[1.3] text-[#999]">
          👇Try taking a screenshot of this example question
        </p>
        <img src="~/assets/app/ext-onboarding/question.webp" class="h-[250px] w-[565px]" />
      </div>
    </div>

    <div v-if="isOnboarding" class="absolute bottom-[16px] left-[0] right-[0] gap-[12px]">
      <p class="mb-[16px] text-center text-[16px] font-medium leading-[1.3] text-[#999]">
        Works on various study platforms
      </p>
      <div class="relative w-full overflow-hidden">
        <div class="platforms-scroll-wrapper">
          <div class="platforms-scroll-inner">
            <img
              src="~/assets/app/ext-onboarding/platforms.webp"
              alt="Supported Platforms"
              class="h-[80px]"
            />
            <img
              src="~/assets/app/ext-onboarding/platforms.webp"
              alt="Supported Platforms"
              class="h-[80px]"
            />
            <img
              src="~/assets/app/ext-onboarding/platforms.webp"
              alt="Supported Platforms"
              class="h-[80px]"
            />
            <img
              src="~/assets/app/ext-onboarding/platforms.webp"
              alt="Supported Platforms"
              class="h-[80px]"
            />
          </div>
        </div>
        <div
          class="platforms-scroll-mask absolute bottom-[0] left-[0] right-[0] top-[0] opacity-70"
        ></div>
      </div>
    </div>

    <client-only>
      <div
        v-if="isOnboarding && showAnimation"
        class="fixed bottom-[0] left-[0] right-[0] top-[0] flex justify-center"
      >
        <Vue3Lottie
          :animation-data="animationData"
          width="100%"
          height="100%"
          :loop="false"
          :autoplay="true"
          @complete="showAnimation = false"
        />
      </div>
    </client-only>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Vue3Lottie } from 'vue3-lottie'
import animationData from '~/assets/app/ext-onboarding/confetti.json'
const { $pageViewEvent, $trackAdjustEvent } = useNuxtApp()

useSeoMeta({
  title: 'Solvely - Take a Picture Math Solver Online',
  robots: 'noindex'
})

const isOnboarding = ref(false)
const showAnimation = ref(true)

onMounted(() => {
  if (sessionStorage.getItem('isCompletedExtOnboarding') !== null) {
    isOnboarding.value = true
    showAnimation.value = false
  }

  $pageViewEvent('Web_extension_installed')
  $pageViewEvent('Web_Extension_Installed')
  $trackAdjustEvent('6d6swq')

  window.addEventListener('onboarding', () => {
    isOnboarding.value = true
    sessionStorage.setItem('isCompletedExtOnboarding', '1')
    $pageViewEvent('Plugin_onboarding_first')
  })
})
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
  background-image: url('~/assets/app/ext-onboarding/bg.webp');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  height: 100%;
  margin: 0;
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
</style>
