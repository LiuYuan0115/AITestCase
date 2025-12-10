<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import Notify from '@/components/ui/Notify.vue'
import { getUrlQuery, throttle } from '~/utils'

const { $firebaseLogEvent, $pageViewEvent } = useNuxtApp()

const title = 'Get 7-Day Free. This is a gift from your friend!'
const description =
  'I’ve been using Solvely to tackle math, physics, chem, and so on. Honestly, it’s a total lifesaver! Finals are coming—hit my link for 7 days free and let’s crush this together! '
useSeoMeta({
  title,
  description,
  ogType: 'website',
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://activity.solvely.ai/assets/h5/get_7_day_free_2411/og-image.png',
  twitterCard: 'summary_large_image',
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: 'https://activity.solvely.ai/assets/h5/get_7_day_free_2411/og-image.png',
  robots: 'noindex'
})
definePageMeta({
  layout: 'h5-only'
})

const code = ref('')
const notify = ref<ComponentPublicInstance<{ showNotify: (msg: string) => void }> | null>(null)

const handleCopy = throttle(() => {
  try {
    // 复制到剪贴板
    navigator.clipboard.writeText(code.value)
    // 弹出提示
    if (notify.value) {
      notify.value.showNotify('Referral Code copied.')
    }
    $firebaseLogEvent('H5_Click_referral_code_2411', {
      code: code.value
    })
  } catch (e) {
    // console.error(e)
  }
}, 3000)

// 获取url中的code
onMounted(() => {
  const urlCode = getUrlQuery('code')
  if (urlCode) {
    code.value = urlCode
  }
  $pageViewEvent('H5_View_get_7_day_free_2411')
})
</script>

<template>
  <Notify ref="notify" />
  <div class="relative h-full text-center font-[Inter]">
    <img
      class="w-full"
      src="~/assets/h5/get_7_day_free_2411/image/header.webp"
      height="261"
      alt="header-image"
    />
    <section class="flex flex-col items-center justify-center gap-8 pb-[150px] pt-5">
      <div class="inline-flex h-[84px] flex-col items-center justify-start gap-2">
        <div
          class="flex h-[23px] items-center justify-center self-stretch text-center text-sm font-bold leading-tight text-[#111111]"
        >
          Referral Code
        </div>
        <div class="flex h-[53px] flex-col items-center justify-start gap-0.5 self-stretch">
          <div
            class="h-[38px] text-[26px] font-extrabold leading-[38px] text-[#111111]"
            @click="handleCopy"
          >
            {{ code }}
          </div>
          <div class="self-stretch text-center text-sm leading-tight text-[#999999]">
            Tap to copy
          </div>
        </div>
      </div>
      <div class="flex w-full items-center justify-start gap-3 px-5 pt-2">
        <div class="h-[1px] flex-1 bg-[#ccc]"></div>
        <div class="text-center text-base leading-snug text-[#999999]">
          Solvely provides step-by-step
          <br />solutions for all courses, <br />from K12 to Graduate school
        </div>
        <div class="h-[1px] flex-1 bg-[#ccc]"></div>
      </div>
      <img src="~/assets/h5/get_7_day_free_2411/image/rating.webp" height="304" alt="rating" />
      <div class="flex w-full flex-col items-center justify-start gap-5 px-5">
        <img
          src="~/assets/h5/get_7_day_free_2411/image/stepbystepexplainations.webp"
          alt="stepbystepexplainations"
        />
        <img
          src="~/assets/h5/get_7_day_free_2411/image/advancedimagerecognition.webp"
          alt="advancedimagerecognition"
        />
        <img
          src="~/assets/h5/get_7_day_free_2411/image/superioraccuracybeyondgpt4.webp"
          alt="superioraccuracybeyondgpt4"
        />
      </div>
    </section>
    <footer
      class="fixed bottom-0 left-0 inline-flex w-full flex-col items-start justify-start gap-2.5 border-t border-[#eeeeee] bg-white px-5 pb-4 pt-6"
    >
      <div class="flex h-[77px] flex-col items-start justify-start gap-3 self-stretch">
        <a
          class="btn flex h-12 select-none flex-col items-center justify-center gap-1.5 self-stretch rounded-[26px] px-3 py-1.5 text-center text-xl font-extrabold leading-relaxed text-white"
          href="https://solvely.go.link/referral"
          target="_blank"
          @click="$firebaseLogEvent('H5_Click_try_free_2411')"
        >
          Try Free
        </a>
        <div class="inline-flex items-center justify-center gap-2.5 self-stretch px-2">
          <div
            class="shrink grow basis-0 text-center text-xs font-normal leading-none text-[#999999]"
          >
            Or search "Solvely" on App Store
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.btn {
  background-image: url(~/assets/common/image/bg_btn.webp);
  background-size: 100% 100%;
}
/* 大于500px */
@media (min-width: 500px) {
  footer {
    width: 500px;
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>
