<template>
  <div
    class="w-[242px] bg-s-interface-bg dark:bg-s-interface-bg-dark border-r border-s-border-secondary dark:border-s-border-secondary-dark p-8 pr-6 duration-200 transition-all"
  >
    <!-- Logo -->
    <div class="flex items-center h-8 text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark duration-200 transition-all">
      <SvgIcon
        name="logo"
        :size="30"
      />
      <SvgIcon
        name="solvelyAi"
        :size="102"
      />
    </div>

    <!-- 导航菜单 -->
    <nav class="mt-9">
      <ul class="space-y-2">
        <li
          v-for="item in menuItems"
          :key="item.id"
        >
          <button
            @click="$emit('navigate', item.id)"
            :class="[
              'w-full flex items-center px-4 py-3 text-left rounded-lg transition-all duration-200',
              'text-[14px] font-[400] leading-[20px]',
              activeTab === item.id
                ? 'bg-tertiary dark:bg-[#252D3E] text-s-text-brand dark:text-s-text-brand-dark'
                : 'hover:bg-s-hover-on-white dark:hover:bg-[#324b68] text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark',
            ]"
          >
            <SvgIcon
              :name="item.icon"
              :size="20"
              class="mr-1.5"
            />
            {{ item.name }}
          </button>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue'

// 定义props
interface Props {
  activeTab: string
  menuItems: Array<{
    id: string
    name: string
    icon: string
    component: any
  }>
}

defineProps<Props>()

// 定义emits
defineEmits<{
  navigate: [section: string]
}>()
</script>

<style scoped>
/* 可以添加自定义样式 */
</style>
