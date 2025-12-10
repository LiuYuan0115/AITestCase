<template>
  <div
    class="self-stretch w-full flex justify-start items-center text-sm font-medium font-['Inter'] leading-tight whitespace-nowrap"
  >
    <span class="text-emph-1 mr-[4px]">{{ label }}: </span>
    <span :class="valueClass">
      {{ resourceValue }} {{ resourceType === 'gems' ? '💎' : '' }}
    </span>
    <button
      v-if="showUpgrade"
      @click="$emit('upgrade')"
      type="button"
      class="ml-auto rounded-[6px] w-[85px] h-[26px] bg-iap-1 text-emph-1 text-sm font-bold hover:bg-iap-1/80"
    >
      Upgrade
    </button>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  resourceType: string
  resourceValue: number | null | undefined
  showUpgrade: boolean | 0 | null | undefined
}>()

defineEmits<{
  upgrade: []
}>()

// 根据资源类型显示不同的标签
const label = computed(() =>
  props.resourceType === 'solves' ? 'Free Solves Left' : 'Gems Left'
)

// 根据资源类型和数值确定样式
const valueClass = computed(() => {
  const isWarning =
    props.resourceType === 'solves'
      ? props.resourceValue! <= 1
      : props.resourceValue! < 10
  return isWarning ? 'text-status-error' : 'text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200'
})
</script>
