<template>
  <div class="w-full">
    <!-- copy success modal -->
    <div
      v-if="showCopied"
      class="px-5 py-3 pointer-events-none left-1/2 -translate-x-1/2 top-[12px] absolute bg-[#191919] bg-opacity-70 rounded-xl inline-flex justify-center items-center overflow-hidden"
    >
      <div
        class="text-center justify-start text-white text-sm font-normal font-['Inter'] leading-tight"
      >
        Copied
      </div>
    </div>
    <!-- 1.loading 动画 -->
    <div v-if="props.isLoading && !isMutipleModel && !props.isStop" class="pb-[20px]">
      <Vue3Lottie
        :animation-data="animationData"
        :width="257"
        :height="20"
        :loop="true"
        :autoplay="true"
        :style="{
          margin: 0,
        }"
      />
    </div>

    <!-- 2.loading 模型 -->
    <div v-if="props.isLoading && isMutipleModel && !props.isStop" class="pb-[20px]">
      <TextLoadingModel />
    </div>

    <!-- 2.超出限制 -->
    <OutLimit v-else-if="props.isOutLimit" />

    <!-- 4.解题详情 -->
    <div
      v-else
      :class="[
        'flex justify-center items-start gap-[10px] w-full',
        'self-stretch rounded-[16px]',
        'transition-all duration-300',
      ]"
    >
      <div class="text-[16px] font-normal font-['Inter'] leading-[24px] w-full">
        <!-- 根据数据格式选择不同的组件 -->
        <AnswerInfoJson
          v-if="props.currentAnswer.isJsonFormat"
          :data="props.currentAnswer"
        />
        <AnswerInfo v-else :data="props.currentAnswer" :is-stop="props.isStop" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import OutLimit from './OutLimit.vue'
import AnswerInfo from '../AnswerInfo/index.vue'
import AnswerInfoJson from '../AnswerInfoJson/index.vue'
import { Vue3Lottie } from 'vue3-lottie'
import animationData from '@/assets/animations/message-loading.json'
import TextLoadingModel from '../../models/TextLoadingModel.vue'
import useABTest from '@/composables/useABTest'

const { isMutipleModel } = useABTest()
const props = defineProps<{
  isLoading: boolean
  isOutLimit: boolean
  isNetworkError: boolean
  isAnswering: boolean
  currentAnswer: any
  isQuestionExpanded: boolean
  isStop: boolean
}>()

const showCopied = ref(false)
</script>

<style lang="less" scoped>
:deep(.answer-info-wrapper) {
  &::-webkit-scrollbar-track {
    margin: 12px 0;
  }

  overscroll-behavior: contain;
}
</style>
