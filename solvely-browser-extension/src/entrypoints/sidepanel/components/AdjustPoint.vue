<template>
  <iframe
    v-if="shouldLoadIframe"
    ref="iframeRef"
    :src="iframeUrl"
    style="width: 0; height: 0; border: none; position: absolute; visibility: hidden"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { STORAGE_KEY } from '~/config/storage'
import type useAuth from '../composables/useAuth'

// 通过 props 接收 auth 实例
interface Props {
  auth: ReturnType<typeof useAuth>
}

const props = defineProps<Props>()

const shouldLoadIframe = ref(false)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const iframeUrl = ref('')

// 构建查询参数（与 background/index.ts 逻辑一致）
const buildQueryString = async (): Promise<string> => {
  let queryString = '?portal=extinstall'

  try {
    // 获取存储的 ad_referrer
    const result = await browser.storage.local.get(STORAGE_KEY.AD_REFERRER)
    const adReferrer = result[STORAGE_KEY.AD_REFERRER]

    if (adReferrer) {
      queryString = `${queryString}&adjust_referrer=${encodeURIComponent(adReferrer)}`
    }
  } catch (error) {
    console.error('[AdjustPoint] 获取 ad_referrer 失败:', error)
  }

  return queryString
}

// 检查是否应该加载 iframe（不修改 storage）
const checkShouldLoad = async (): Promise<boolean> => {
  try {
    // 1. 检查首次安装版本是否与当前版本一致
    const manifest = chrome.runtime.getManifest()
    const versionResult = await browser.storage.local.get(STORAGE_KEY.INSTALL_VERSION)
    const installVersion = versionResult[STORAGE_KEY.INSTALL_VERSION]

    if (!installVersion || installVersion !== manifest.version) {
      console.log('[AdjustPoint] 版本不匹配，跳过', {
        installVersion,
        currentVersion: manifest.version,
      })
      return false
    }

    // 2. 检查是否已有 WEB_ADJUST_USER_ID 或已同步标识
    const storageResult = await browser.storage.local.get([
      STORAGE_KEY.WEB_ADJUST_USER_ID,
      STORAGE_KEY.WEB_ADJUST_USER_ID_SYNCED,
    ])

    const hasWebAdjustUserId = !!storageResult[STORAGE_KEY.WEB_ADJUST_USER_ID]
    const hasSynced = !!storageResult[STORAGE_KEY.WEB_ADJUST_USER_ID_SYNCED]

    if (hasWebAdjustUserId || hasSynced) {
      console.log('[AdjustPoint] 已有 webAdjustUserId 或已同步，跳过', {
        hasWebAdjustUserId,
        hasSynced,
      })
      return false
    }

    console.log('[AdjustPoint] 满足条件，准备加载 iframe')
    return true
  } catch (error) {
    console.error('[AdjustPoint] 检查失败:', error)
    return false
  }
}

// 处理来自 iframe 的消息
const handleMessage = async (event: MessageEvent) => {
  // 验证消息类型
  if (event.data?.type === 'adjust:webAdjustUserId') {
    const webAdjustUserId = event.data.data?.webAdjustUserId

    if (!webAdjustUserId) {
      console.warn('[AdjustPoint] 收到消息但 webAdjustUserId 为空')
      return
    }

    console.log('[AdjustPoint] 收到 webAdjustUserId:', webAdjustUserId)

    try {
      // 检查用户是否已登录（使用传入的 auth 实例）
      const isAuthenticated = await props.auth.getAuthStatus()

      // 先存储 webAdjustUserId 到 storage
      await browser.storage.local.set({
        [STORAGE_KEY.WEB_ADJUST_USER_ID]: webAdjustUserId,
      })

      if (isAuthenticated) {
        // 已登录：主动调用 saveAdjustUserId 同步到服务器
        console.log('[AdjustPoint] 用户已登录，开始同步 webAdjustUserId')
        await props.auth.saveAdjustUserId()
        console.log('[AdjustPoint] webAdjustUserId 同步完成')
      } else {
        // 未登录：已存储到 storage，等待登录后由 handleStorageChange 触发同步
        console.log('[AdjustPoint] 用户未登录，webAdjustUserId 已暂存，等待登录后同步')
      }
    } catch (error) {
      console.error('[AdjustPoint] 处理消息失败:', error)
      removeIframe()
    }
  }
}

// 移除 iframe
const removeIframe = () => {
  shouldLoadIframe.value = false
  window.removeEventListener('message', handleMessage)
  console.log('[AdjustPoint] iframe 已移除')
}

onMounted(async () => {
  console.log('[AdjustPoint] 组件挂载')

  try {
    // 1. 首先检查是否已执行过（最高优先级）
    const executedResult = await browser.storage.local.get(STORAGE_KEY.ADJUST_POINT_COMPONENT_EXECUTED)

    if (executedResult[STORAGE_KEY.ADJUST_POINT_COMPONENT_EXECUTED]) {
      console.log('[AdjustPoint] 组件已执行过，直接跳过')
      return
    }

    // 2. 立即标记为已执行（确保只执行一次）
    await browser.storage.local.set({
      [STORAGE_KEY.ADJUST_POINT_COMPONENT_EXECUTED]: true,
    })
    console.log('[AdjustPoint] 已标记组件已执行')

    // 3. 检查是否应该加载 iframe
    const shouldLoad = await checkShouldLoad()

    if (!shouldLoad) {
      console.log('[AdjustPoint] 不满足加载条件，结束')
      return
    }

    // 4. 构建 iframe URL
    const queryString = await buildQueryString()
    const baseUrl = import.meta.env.VITE_POINT_PAGE_URL
    iframeUrl.value = `${baseUrl}${queryString}`

    console.log('[AdjustPoint] 准备加载 iframe:', iframeUrl.value)

    // 5. 监听消息
    window.addEventListener('message', handleMessage)

    // 6. 显示 iframe
    shouldLoadIframe.value = true

    // 7. 设置超时保护（30秒后自动移除 iframe）
    setTimeout(() => {
      if (shouldLoadIframe.value) {
        console.warn('[AdjustPoint] 超时未收到消息，自动移除 iframe')
        removeIframe()
      }
    }, 30000)
  } catch (error) {
    console.error('[AdjustPoint] 初始化失败:', error)
  }
})

onBeforeUnmount(() => {
  removeIframe()
  console.log('[AdjustPoint] 组件卸载')
})
</script>
