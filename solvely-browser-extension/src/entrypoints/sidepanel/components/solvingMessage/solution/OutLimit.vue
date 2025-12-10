<template>
  <div
    class="out-limit-container w-full h-[232px] rounded-[16px] bg-white flex justify-center items-center"
  >
    <div
      class="px-5 py-7 bg-white rounded-xl shadow-[0px_2px_10px_0px_rgba(110,107,168,0.25)] outline outline-1 outline-offset-[-1px] outline-blue-600 inline-flex flex-col justify-center items-center gap-6"
    >
      <div class="flex flex-col justify-start items-center gap-2.5">
        <div class="flex flex-col justify-start items-center gap-2">
          <div
            class="text-center justify-start text-emph-1 text-lg font-bold font-['Inter'] leading-normal"
          >
            Out of Free Attempts
          </div>
        </div>
        <div
          class="w-72 text-center justify-start text-emph-1 text-sm font-medium font-['Inter'] leading-tight"
        >
          No worries! Enjoy a 3-Day Free Trial with unlimited access to all
          features.
        </div>
      </div>
      <button
        class="gradient-btn w-60 h-10 px-10 py-3 rounded-[66.90px] inline-flex justify-center items-center"
        @click="toStartFreeTrail"
      >
        <div
          class="text-center justify-center text-white text-base font-bold font-['Inter'] leading-tight whitespace-nowrap"
        >
          Start 3-Day Free Trial
        </div>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { inject } from 'vue'
import { getTrpc } from '@/lib/trpc/client'
import type { PanelControls } from '../types'
import { getPricingPath } from '@/utils'
import trackEvent from '~/utils/trackEvent'

// 解题面板控制器
const { closePanel } = inject('panelControls') as PanelControls

// 点击开始 free trail 跳转商店页
const toStartFreeTrail = async () => {
  closePanel('free-trial')
  trackEvent.track('Plugin_Solve_startfree')
  const queryString = '?portal=freeTrail_click'
  const pricingPath = await getPricingPath()
  getTrpc().goToSolvely.query(`${pricingPath}${queryString}`)
}
</script>

<style lang="less" scoped>
.out-limit-container {
  background-image: url('@/assets/images/out-limit-bg.webp');
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
}

.gradient-btn {
  background: linear-gradient(90deg, #007aff, #9250ff);
}
</style>
