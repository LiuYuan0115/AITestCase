<template>
    <div class="content-wrapper w-fit mb-0.5">
        <div @click="handleClick"
            class="content flex items-center justify-start cursor-pointer px-1.5 py-2 bg-s-disable-bg dark:bg-s-disable-bg-dark rounded-md transition-all duration-200 group">
            <div class="content-logo pr-1">
                <SvgIcon name="gmat/logo" size="16" />
            </div>
            <div class="text-sm text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark group-hover:text-s-text-brand dark:group-hover:text-s-text-brand-dark transition-colors duration-200 h-4 leading-4">
                {{ data.contents[0].sourceReference }}
            </div>
            <SvgIcon name="arrow-right" size="16"
                class="text-s-text-high-emphasis dark:text-s-text-high-emphasis-dark group-hover:!text-s-text-brand dark:group-hover:!text-s-text-brand-dark transition-colors duration-200" />
        </div>
    </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue'
import { onMounted } from 'vue'
import trackEvent from '@/utils/trackEvent'

const props = defineProps<{
    data: {
        type: string
        contents: {
            type: string
            examName: string
            sourceReference: string
            targetUrl: string
        }[]
    }
}>()

// 组件挂载时触发展示埋点
onMounted(() => {
    trackEvent.track('Plugin_Sidebar_GMAT_Show')
})

const handleClick = () => {
    // 点击时触发埋点
    trackEvent.track('Plugin_Sidebar_GMAT_Click')
    window.open(props.data.contents[0].targetUrl, '_blank')
}
</script>

<style scoped lang="scss"></style>