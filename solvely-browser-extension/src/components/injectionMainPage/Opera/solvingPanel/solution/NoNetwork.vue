<template>
  <div
    class="self-stretch h-56 min-h-28 p-4 bg-white rounded-2xl inline-flex flex-col justify-center items-center gap-2.5 overflow-hidden"
  >
    <div class="flex flex-col justify-start items-center gap-6">
      <img src="@/assets/images/no-network.webp" class="h-[76px] w-[76px]" />
      <div class="flex flex-col justify-start items-center gap-2">
        <div
          class="text-center justify-start text-emph-1 !text-lg font-bold font-['Inter'] leading-normal"
        >
          Connection failed
        </div>
        <button
          class="px-6 h-[41px] rounded-3xl border-[1.5px] border-custom-border-2 inline-flex justify-center items-center gap-2 overflow-hidden"
          @click="refreshClick()"
          :disabled="props.refreshDisabled"
        >
          <div
            class="text-center justify-start text-emph-1 text-base font-bold font-['Inter'] leading-[20px]"
          >
            Refresh
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import trackEvent from '@/utils/trackEvent'

const props = defineProps<{
  refreshDisabled: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const refreshClick = () => {
  trackEvent.track('Plugin_Solve_connect_refresh')
  emit('refresh')
}
</script>

<style lang="less" scoped></style>
