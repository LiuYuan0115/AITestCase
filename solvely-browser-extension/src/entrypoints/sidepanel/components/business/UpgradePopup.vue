<template>
  <div class="absolute -left-[12px] -bottom-[3px] h-fit w-fit scale-[90%] pb-[10px] z-[999999]">
    <template v-if="props.auth.userFrom.value === 'SEM' || props.auth.userFrom.value === 'web'">
      <PricePanelFullV2
        v-if="abTest.isMutiModel.value"
        showModel="popup"
      />
      <PricePanelFull
        v-else
        showModel="popup"
      />
    </template>
    <template v-else>
      <PricePanelFullV3
        v-if="abTest.isQuaterPackageRecall.value"
        showModel="popup"
      />
      <PricePanelFullV2
        v-else-if="abTest.isMutiModel.value"
        showModel="popup"
      />
      <PricePanelFull
        v-else
        showModel="popup"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import PricePanelFullV2 from './PricePanelFullV2.vue'
import PricePanelFull from './PricePanelFull.vue'
import PricePanelFullV3 from './PricePanelFullV3.vue'
import { ABTestState } from '@/composables/useABTest'

const props = defineProps<{
  auth: any
}>()

const abTest = inject<ABTestState>('abTest')!
</script>

<style scoped lang="less"></style>
