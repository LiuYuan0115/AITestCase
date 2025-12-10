<template>
  <!-- 购买模式 -->
  <div class="fixed inset-0 flex items-center justify-center z-50">
    <!-- Blur background -->
    <div
      class="w-full h-full left-0 top-0 absolute text-white bg-s-interface-bg/60 dark:bg-s-interface-bg-dark/60 backdrop-blur-[10px] -z-1"
    ></div>
    <template v-if="auth.userFrom.value === 'SEM' || auth.userFrom.value === 'web'">
      <PricePanelFullV2
        v-if="abTest.isMutiModel.value"
        :show-model="'modal'"
        :from="props.from"
        @close="emit('close')"
      />
      <PricePanelFull
        v-else
        :show-model="'modal'"
        :from="props.from"
        @close="emit('close')"
      />
    </template>
    <template v-else>
      <PricePanelFullV3
        v-if="abTest.isQuaterPackageRecall.value"
        :show-model="'modal'"
        :from="props.from"
        :show-ticket="props.showTicket"
        @close="emit('close')"
      />
      <PricePanelFullV2
        v-else-if="abTest.isMutiModel.value"
        :show-model="'modal'"
        :from="props.from"
        @close="emit('close')"
      />
      <PricePanelFull
        v-else
        :show-model="'modal'"
        :from="props.from"
        @close="emit('close')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import trackEvent from '~/utils/trackEvent'
import PricePanelFull from './business/PricePanelFull.vue'
import PricePanelFullV2 from './business/PricePanelFullV2.vue'
import PricePanelFullV3 from './business/PricePanelFullV3.vue'
import useAuth from '../composables/useAuth'
import { ABTestState } from '@/composables/useABTest'

const abTest = inject<ABTestState>('abTest')!

const emit = defineEmits<{
  (e: 'close'): void
}>()

const props = defineProps<{
  auth: ReturnType<typeof useAuth>
  from?: string
  showTicket?: boolean
}>()

// 打点：由父级 v-if 控制挂载/卸载，这里在挂载/卸载时各打一次
onMounted(() => {
  trackEvent.track('Plugin_Sidebar_Paywall_Show', {
    from: props.from,
  })
  trackEvent.track('Plugin_Sidebar_Paywall_Mount')
})

onUnmounted(() => {
  trackEvent.track('Plugin_Sidebar_Paywall_Close', {
    from: props.from,
  })
})
</script>
