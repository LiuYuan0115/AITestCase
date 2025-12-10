<template>
  <div class="answer-info-json">
    <!-- 文科选择题：单题 -->
    <template v-if="v8ComponentJson?.componentType === 'question_single'">
      <QuestionSingle :componentJson="v8ComponentJson" />
    </template>
    <!-- 文科选择题：多题 -->
    <template
      v-else-if="v8ComponentJson?.componentType === 'question_multiple'"
    >
      <QuestionMultiple :componentJson="v8ComponentJson" />
    </template>
    <!-- 一键解题接口返回的题目 -->
    <template v-else-if="v7Solutions?.length > 0">
      <Questions :solutions="v7Solutions"/>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onUpdated } from 'vue'
import QuestionSingle from './QuestionSingle.vue'
import QuestionMultiple from './QuestionMultiple.vue'
import Questions from './Questions.vue'

const props = defineProps(['data'])

// 文科题 v8 接口返回的数据结构
const v8ComponentJson = computed(() => {
  return props.data?.jsonFormatObject?.components?.[0]
})

// 一键解题接口返回的题目鲭
const v7Solutions = computed(() => {
  return props.data?.jsonFormatObject?.solutions
})
</script>
