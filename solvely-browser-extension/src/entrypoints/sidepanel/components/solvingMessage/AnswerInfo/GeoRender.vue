<template>
    <div class="content-wrapper w-[270px] h-[220px] bg-disabled-bg flex justify-center items-center rounded-[12px] my-3">
        <div class="geo-render-container">
            <!-- 一般情况iframe挂载很快，所以只在内部网页逻辑做loading处理 -->
            <!-- <div v-if="isLoading" class="loading-wrapper">
                <div class="loading-spinner"></div>
            </div> -->
            <iframe 
                ref="iframeRef"
                :src="graphUrl" 
                class="geo-render-frame" 
                frameborder="0" 
                scrolling="no" 
                allow="fullscreen"
                @load="handleIframeLoad"
                :class="{ 'hidden': isLoading }"
            ></iframe>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'

// 根据环境变量获取基础URL
const BASE_URL = import.meta.env.VITE_EXTENSION_GRAPH_UPL
// const BASE_URL = 'http://localhost:3000'


const iframeRef = ref<HTMLIFrameElement | null>(null)
const isLoading = ref(true) // 默认显示 loading

interface Props {
    graphData: {
        axisType: number
        coordSystem: {
            xmin: number
            xmax: number
            ymin: number
            ymax: number
        }
        commands: string[]
        width?: number
        height?: number
    }
}

const props = defineProps<Props>()
const emit = defineEmits<{
    (e: 'mounted'): void
}>()

const graphUrl = computed(() => {
    return `${BASE_URL}/app/extension-graph`
})

// 发送图形数据到 iframe
const sendGraphData = () => {
    if (!iframeRef.value?.contentWindow) return
    
    try {
        iframeRef.value.contentWindow.postMessage(JSON.stringify(props.graphData), '*')
    } catch (error) {
        console.error('Failed to send graph data:', error)
    }
}

// iframe 加载完成时发送数据
const handleIframeLoad = () => {
    isLoading.value = false // iframe 加载完成后隐藏 loading
    sendGraphData()
}

// 监听数据变化时重新发送
watch(() => props.graphData, () => {
    isLoading.value = true // 数据变化时显示 loading
    sendGraphData()
}, { deep: true })

onMounted(() => {
    emit('mounted')
})
</script>

<style scoped>
.geo-render-container {
    width: 285px;
    height: 220px;
    overflow: hidden;
    border-radius: 6px;
    background: #fff;
    position: relative;
}

.geo-render-frame {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
}

.geo-render-frame.hidden {
    visibility: hidden;
}

.loading-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #fff;
    z-index: 1000;
}

.loading-spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid rgb(0, 122, 255);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>