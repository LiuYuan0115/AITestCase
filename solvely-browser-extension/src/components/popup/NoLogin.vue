<template>
  <div>
    <!-- recommended image title -->
    <img :src="recommendedImage" class="absolute top-2 -right-2 w-[160px]" />

    <!-- screen shot -->
    <div class="flex justify-start flex-col gap-2 items-center mt-[32px]">
      <div class="self-stretch inline-flex justify-center items-center">
        <img :src="lightingIcon" class="w-[20px] h-[20px] mr-[2px]" />
        <span
          class="justify-center text-emph-1 text-base !font-bold font-['Inter'] leading-tight"
        >
          Screenshot for an instant answer
        </span>
      </div>
      <div
        class="h-[160px] w-[320px] bg-black/50 rounded-[8px] overflow-hidden"
      >
        <img :src="screenshotImage" class="w-full h-full object-cover" />
      </div>
    </div>

    <!-- step by step solution -->
    <div class="mt-[24px] flex justify-start flex-col gap-2 items-center">
      <div class="self-stretch inline-flex justify-center items-center">
        <img :src="searchIcon" class="w-[20px] h-[20px] mr-[2px]" />
        <span
          class="justify-center text-emph-1 text-base !font-bold font-['Inter'] leading-tight"
        >
          Step-by-step solutions
        </span>
      </div>
      <div
        class="h-[164px] w-[320px] bg-black/50 rounded-[8px] overflow-hidden"
      >
        <img :src="stepByStepImage" class="w-full h-full object-cover" />
      </div>
    </div>

    <!-- login button -->
    <button
      class="self-stretch mt-[20px] w-full h-[36px] px-6 py-2 bg-primary rounded-[10px] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.12)] inline-flex justify-center items-center gap-0.5 overflow-hidden"
      @click="handleLoginClick()"
    >
      <div
        class="text-center justify-center text-white text-base font-bold font-['Inter'] leading-tight"
      >
        Log in
      </div>
    </button>
  </div>
</template>

<script lang="ts" setup>
import lightingIcon from '@/assets/images/popup/no-login-lighting-icon.webp'
import searchIcon from '@/assets/images/popup/no-login-search-icon.webp'
import screenshotImage from '@/assets/images/popup/no-login-screenshot-image.webp'
import stepByStepImage from '@/assets/images/popup/no-login-step-by-step-image.webp'
import recommendedImage from '@/assets/images/popup/no-login-recommended.webp'
import trackEvent from '~/utils/trackEvent'
import { getTrpc } from '~/lib/trpc/client'

const handleLoginClick = async () => {
  await getTrpc().goToLogin.query()
  trackEvent.track('Plugin_popup_login')
}
</script>

<style lang="less" scoped></style>
