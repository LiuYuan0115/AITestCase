<template>
  <div class="self-stretch h-[245px] rounded-[12px] flex flex-col justify-start items-start gap-[8px] overflow-hidden">
    <div
      class="relative overflow-hidden max-w-[388px] min-h-[112px] max-h-[262px] inline-flex justify-center items-start gap-[10px] self-stretch bg-b_card dark:bg-b_card_dk rounded-[16px] color-transition"
    >
      <div class="w-full overflow-auto">
        <img
          src="@/assets/images/login/mask-solve.webp"
          class="w-full dark:hidden"
        />
        <img
          src="@/assets/images/login/mask-solve-dark.webp"
          class="w-full hidden dark:block"
        />
      </div>
      <div
        class="absolute bottom-0 w-full h-[32px] bg-gradient-to-t from-white/80 dark:from-b_1_dk/80 to-transparent pointer-events-none"
      ></div>
    </div>

    <!-- 登录弹窗 -->
    <div class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <div class="relative w-[300px] h-[174px] rounded-[20px] border border-white overflow-hidden pointer-events-auto">
        <!-- 背景图片 -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src="@/assets/images/login/bg-gradient.webp"
            class="w-full h-full object-cover"
          />
        </div>

        <!-- 内容区域 -->
        <div
          class="absolute top-[20px] left-1/2 -translate-x-1/2 w-[270px] flex flex-col items-center gap-[8px] pointer-events-none"
        >
          <!-- 标题 -->
          <p class="text-[16px] font-bold leading-[130%] text-center text-t_1 w-[246px] whitespace-pre-wrap m-0">
            This problem has bee solved
          </p>
          <!-- 描述 -->
          <p class="text-[14px] font-normal leading-[140%] text-center text-t_1 w-[246px] whitespace-pre-wrap m-0">
            You'll get a detialed solution the help you master concepts
          </p>
        </div>

        <!-- 登录按钮 -->
        <button
          @click="handleLoginClick"
          class="absolute left-1/2 -translate-x-1/2 top-[109px] w-[220px] px-[40px] py-[12px] rounded-[66.899px] bg-gradient-to-r from-b_brand to-[#9250ff] text-white text-[16px] font-bold leading-[130%] text-center hover:opacity-90 transition-opacity duration-200 cursor-pointer border-0 outline-none pointer-events-auto text-nowrap"
        >
          Login to See Answers
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'login-click'): void
}>()

const handleLoginClick = async () => {
    emit('login-click')
}
</script>
