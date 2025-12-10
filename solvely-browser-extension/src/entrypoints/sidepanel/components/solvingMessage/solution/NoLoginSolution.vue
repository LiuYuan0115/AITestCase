<template>
  <div
    class="self-stretch pt-[8px] bg-[#F3F6FF] rounded-[16px] border-[1px] border-white flex flex-col justify-start items-start gap-[8px] overflow-hidden"
  >
    <div
      class="self-stretch px-[16px] inline-flex justify-between items-center"
    >
      <span
        class="justify-center text-[#474A7E] text-[16px] font-bold font-['Inter'] leading-[20px]"
      >
        Solution
      </span>
    </div>

    <div
      :class="[
        'relative overflow-hidden',
        'max-w-[388px] min-h-[112px] max-h-[262px]',
        'inline-flex justify-center items-start gap-[10px]',
        'self-stretch  bg-s-interface-bg dark:bg-s-interface-bg-dark rounded-[16px] transition-colors duration-200',
      ]"
    >
      <div class="w-full overflow-auto">
        <img
          src="@/assets/images/no-login-answers.webp"
          class="w-full h-[272px] cursor-pointer"
          @click="handleLoginClick"
        />
      </div>
      <div
        class="absolute bottom-0 w-full h-[32px] bg-gradient-to-t from-white/80 to-transparent pointer-events-none"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getTrpc } from '~/lib/trpc/client'
import trackEvent from '~/utils/trackEvent'

const handleLoginClick = async () => {
  // 未登录状态下，solution区域展示遮蔽状态，用户点击login
  trackEvent.track('Plugin_Solve_login')
  await getTrpc().goToLogin.query()
}

onMounted(() => {
  // 未登录状态下，solution区域展示遮蔽状态
  trackEvent.track('Plugin_Solve_unlogin_show')
})
</script>
