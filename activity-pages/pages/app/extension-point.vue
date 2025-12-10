<template>
  <div class="point-handler"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

const { $trackAdjustEvent, $adjust } = useNuxtApp()

let webAdjustUserId: string | null = null
let intervalId: ReturnType<typeof setInterval> | null = null
const maxAttempts = 20
let attempts = 0

// 发送 webAdjustUserId 给插件
function postUuid() {
  if (webAdjustUserId) {
    window.parent.postMessage(
      {
        type: 'adjust:webAdjustUserId',
        data: {
          webAdjustUserId
        }
      },
      '*'
    )
    console.log('[Adjust] 发送 webAdjustUserId 到父窗口:', webAdjustUserId)
  }
}

// 处理来自插件的消息
function handleMessage(event: MessageEvent) {
  if (event.data && event.data.type === 'REQUEST_WEB_ADJUST_USERID') {
    console.log('[Adjust] 收到插件请求 webAdjustUserId')
    postUuid()
  }
}

onMounted(() => {
  console.log('[Adjust] 组件挂载，开始初始化')

  // 1. 监听来自插件的消息
  window.addEventListener('message', handleMessage)

  // 2. 检查是否已经上报过 adjust 事件
  const ADJUST_EVENT_KEY = 'solvely_adjust_6d6swq_reported'
  const hasReported = localStorage.getItem(ADJUST_EVENT_KEY)

  if (!hasReported) {
    // 首次访问，触发事件并记录
    $trackAdjustEvent('6d6swq')
    localStorage.setItem(ADJUST_EVENT_KEY, 'true')
    console.log('[Adjust] 首次触发事件: 6d6swq，已记录到 localStorage')
  } else {
    console.log('[Adjust] 事件 6d6swq 已上报过，跳过本次上报')
  }

  // 3. 立即尝试获取并发送 webAdjustUserId
  const firstUuid = $adjust.getWebUUID()
  webAdjustUserId = firstUuid === undefined ? null : firstUuid

  if (webAdjustUserId) {
    console.log('[Adjust] 立即获取到 webAdjustUserId:', webAdjustUserId)
    postUuid()
  } else {
    console.log('[Adjust] 未立即获取到 webAdjustUserId，启动重试机制')

    // 4. 如果未获取到，启动重试机制
    intervalId = setInterval(() => {
      const tryUuid = $adjust.getWebUUID()
      webAdjustUserId = tryUuid === undefined ? null : tryUuid

      if (webAdjustUserId) {
        console.log('[Adjust] 重试成功获取 webAdjustUserId:', webAdjustUserId)
        postUuid()
        if (intervalId !== null) {
          clearInterval(intervalId)
          intervalId = null
        }
      } else if (++attempts >= maxAttempts) {
        console.warn('[Adjust] 达到最大重试次数，停止重试')
        if (intervalId !== null) {
          clearInterval(intervalId)
          intervalId = null
        }
      }
    }, 500)
  }
})

onBeforeUnmount(() => {
  console.log('[Adjust] 组件卸载，清理资源')
  window.removeEventListener('message', handleMessage)

  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
})

useSeoMeta({
  title: 'Solvely',
  robots: 'noindex'
})
</script>
