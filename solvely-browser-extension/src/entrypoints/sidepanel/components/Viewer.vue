<template>
  <Dialog
    v-model:visible="visible"
    :modal="true"
    :draggable="false"
    :resizable="false"
    class="w-[300px] !border-none"
    :style="{
      '--p-dialog-border-radius': '6px 6px 0 0',
      '--p-dialog-header-padding': '0',
      '--p-dialog-content-padding': '0',
    }"
    @hide="handleHide"
  >
    <template #header>
      <div
        class="w-full h-[36px] rounded-tl-[6px] pl-[8px] bg-white dark:bg-white-dark flex items-center border-b border-custom-border-2 dark:border-none"
      >
        <div
          class="flex items-center gap-[4px] text-s-text-medium-emphasis dark:text-s-text-medium-emphasis-dark"
        >
          <SvgIcon
            name="sidepanel/zoom-out"
            class="cursor-pointer"
            @click="handleZoomOut"
          />
          <span class="text-[12px] select-none min-w-[36px] text-center"
            >{{ zoomPercent }}%</span
          >
          <SvgIcon
            name="sidepanel/zoom-in"
            class="cursor-pointer"
            @click="handleZoomIn"
          />
        </div>
      </div>
    </template>

    <template #closebutton>
      <div
        class="h-[36px] rounded-tr-[6px] bg-white dark:bg-white-dark pr-[8px] flex items-center justify-end border-b border-custom-border-2 dark:border-none text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark"
      >
        <SvgIcon
          name="sidepanel/close"
          class="cursor-pointer"
          size="14"
          @click="closeDialog"
        />
      </div>
    </template>

    <div
      class="viewer-container overflow-hidden cursor-grab bg-white dark:bg-s-bg-panel-dark"
      :style="{ height: containerHeight }"
      ref="containerRef"
    >
      <img
        v-if="src"
        ref="imgRef"
        :src="src"
        :alt="alt || 'preview'"
        class="block select-none"
        draggable="false"
      />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import Dialog from 'primevue/dialog'
import SvgIcon from '@/components/common/SvgIcon.vue'
import Panzoom from '@panzoom/panzoom'

const props = defineProps<{
  modelValue: boolean
  src: string
  alt?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

const containerHeight = ref<string>('auto')

const containerRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const panzoomRef = ref<ReturnType<typeof Panzoom> | null>(null)
const zoomPercent = ref(100)
const currentContain = ref<'inside' | 'outside' | null>(null)
const baseScale = ref(1)
const isTallImage = ref(false)

const updateZoomPercent = () => {
  const panzoom = panzoomRef.value
  if (!panzoom) return
  const scale = panzoom.getScale()
  const effectiveScale = baseScale.value * scale
  zoomPercent.value = Math.round(effectiveScale * 100)
}

const updateContain = () => {
  const panzoom = panzoomRef.value
  const img = imgRef.value
  const container = containerRef.value
  if (!panzoom || !img || !container) return
  const containerW = container.clientWidth
  const containerH = container.clientHeight
  const baseW = img.offsetWidth
  const baseH = img.offsetHeight
  if (!baseW || !baseH || !containerW || !containerH) return
  const scale = panzoom.getScale()
  const scaledW = baseW * scale
  const scaledH = baseH * scale
  const contain: 'inside' | 'outside' =
    scaledW <= containerW && scaledH <= containerH ? 'inside' : 'outside'
  if (contain !== currentContain.value) {
    currentContain.value = contain
    panzoom.setOptions({ contain })
  }
}

const computeLayout = () => {
  const img = imgRef.value
  const container = containerRef.value
  if (!img || !container) return
  const naturalW = img.naturalWidth
  const naturalH = img.naturalHeight
  if (!naturalW || !naturalH) return
  const containerW = container.clientWidth || 300
  const maxViewerHeight = Math.max(0, Math.floor(window.innerHeight * 0.8 - 36))

  if (naturalW >= naturalH) {
    const targetHeight = Math.round((containerW * naturalH) / naturalW)
    containerHeight.value = `${targetHeight}px`
    img.style.width = '100%'
    img.style.height = 'auto'
    img.style.maxWidth = '100%'
    img.style.maxHeight = ''
    baseScale.value = containerW / naturalW
    isTallImage.value = false
  } else {
    const scale = Math.min(1, containerW / naturalW, maxViewerHeight / naturalH)
    const targetWidth = Math.round(naturalW * scale)
    const targetHeight = Math.round(naturalH * scale)
    containerHeight.value = `${targetHeight}px`
    img.style.width = `${targetWidth}px`
    img.style.height = `${targetHeight}px`
    img.style.maxWidth = ''
    img.style.maxHeight = ''
    baseScale.value = scale
    isTallImage.value = true
  }
  updateZoomPercent()
  // 更新最小缩放为初始显示比例对应的 CSS 比例（=1）
  if (panzoomRef.value) {
    panzoomRef.value.setOptions({ minScale: 1 })
  }
}

const onImgLoad = () => {
  computeLayout()
  updateContain()
}

const onWindowResize = () => {
  computeLayout()
  updateContain()
  // 若仍处于初始比例且为高图，保持水平居中
  const panzoom = panzoomRef.value
  const img = imgRef.value
  const container = containerRef.value
  if (
    panzoom &&
    img &&
    container &&
    isTallImage.value &&
    panzoom.getScale() === 1
  ) {
    const containerW = container.clientWidth
    const baseW = img.offsetWidth
    const centerX = (containerW - baseW) / 2
    panzoom.pan(centerX, 0, { force: true })
  }
}

const onPanzoomZoom = (event: Event) => {
  updateZoomPercent()
}

const onPanzoomChange = async () => {
  updateZoomPercent()
  await nextTick()
  updateContain()
  // 缩放结束时吸附到初始比例，避免浮点误差
  const panzoom = panzoomRef.value
  if (!panzoom) return
  const s = panzoom.getScale()
  if (Math.abs(s - 1) < 0.01) {
    panzoom.zoom(1, { animate: false })
    updateZoomPercent()
  }
}

const initPanzoom = async () => {
  await nextTick()
  const img = imgRef.value
  if (!img) return
  // 销毁旧实例
  destroyPanzoom()

  // 等待图片尺寸就绪后再布局并初始化 panzoom
  if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
    img.addEventListener(
      'load',
      () => {
        initPanzoom()
      },
      { once: true }
    )
    return
  }

  // 根据图片比例计算容器与图片初始布局
  computeLayout()
  // 等容器高度样式应用完成，确保可测量到正确的 clientHeight
  await nextTick()

  // 预判初始 contain（基于 CSS 渲染尺寸）
  const container = containerRef.value!
  const baseW = img.offsetWidth
  const baseH = img.offsetHeight
  const containerW = container.clientWidth
  const containerH = container.clientHeight
  const initialContain: 'inside' | 'outside' =
    baseW <= containerW && baseH <= containerH ? 'inside' : 'outside'
  // 计算初始水平居中偏移（仅高图）
  const startX = isTallImage.value ? (containerW - baseW) / 2 : 0

  // 创建实例
  panzoomRef.value = Panzoom(img, {
    step: 0.1,
    minScale: 1,
    maxScale: 8,
    contain: initialContain,
    startX,
    startY: 0,
  })
  // 初始化百分比
  updateZoomPercent()
  // 初始化边界限制并强制一次校正位移
  updateContain()
  // 通过轻微相对位移触发一次边界夹紧
  panzoomRef.value.pan(0.01, 0.01, { relative: true, force: true })
  panzoomRef.value.pan(-0.01, -0.01, { relative: true, force: true })
  // 监听变化：仅在结束或重置后更新 contain，避免动画中途干扰
  img.addEventListener('panzoomzoom', onPanzoomZoom)
  img.addEventListener('panzoomreset', onPanzoomChange)
  img.addEventListener('panzoomend', onPanzoomChange)
  // 窗口尺寸变化时重新计算
  window.addEventListener('resize', onWindowResize)
}

const destroyPanzoom = () => {
  if (panzoomRef.value) {
    // 重置再销毁，避免残留 transform
    try {
      panzoomRef.value.reset({ animate: false })
    } catch {}
    // Panzoom 无专门 destroy，移除引用即可
    panzoomRef.value = null
  }
  if (imgRef.value) {
    imgRef.value.removeEventListener('panzoomzoom', onPanzoomZoom)
    imgRef.value.removeEventListener('panzoomreset', onPanzoomChange)
    imgRef.value.removeEventListener('panzoomend', onPanzoomChange)
  }
  window.removeEventListener('resize', onWindowResize)
}

const handleZoomIn = () => {
  const panzoom = panzoomRef.value
  const img = imgRef.value
  const container = containerRef.value
  if (!panzoom || !img || !container) return
  const opts = panzoom.getOptions() as any
  const step = typeof opts.step === 'number' ? opts.step : 0.1
  const maxScale = typeof opts.maxScale === 'number' ? opts.maxScale : Infinity
  const currentScale = panzoom.getScale()
  const nextScale = Math.min(maxScale, currentScale * (1 + step))

  const baseW = img.offsetWidth
  const baseH = img.offsetHeight
  const containerW = container.clientWidth
  const containerH = container.clientHeight

  const nextW = baseW * nextScale
  const nextH = baseH * nextScale
  const nextContain: 'inside' | 'outside' =
    nextW > containerW || nextH > containerH ? 'outside' : 'inside'
  if (nextContain !== currentContain.value) {
    currentContain.value = nextContain
    panzoom.setOptions({ contain: nextContain })
  }

  panzoom.zoom(nextScale, { animate: true })
  zoomPercent.value = Math.round(baseScale.value * nextScale * 100)
}

const handleZoomOut = () => {
  const panzoom = panzoomRef.value
  const img = imgRef.value
  const container = containerRef.value
  if (!panzoom || !img || !container) return
  const opts = panzoom.getOptions() as any
  const step = typeof opts.step === 'number' ? opts.step : 0.1
  const minScale = typeof opts.minScale === 'number' ? opts.minScale : 0.1
  const currentScale = panzoom.getScale()
  const nextScale = Math.max(minScale, currentScale / (1 + step))

  const baseW = img.offsetWidth
  const baseH = img.offsetHeight
  const containerW = container.clientWidth
  const containerH = container.clientHeight

  const nextW = baseW * nextScale
  const nextH = baseH * nextScale
  const nextContain: 'inside' | 'outside' =
    nextW <= containerW && nextH <= containerH ? 'inside' : 'outside'
  if (nextContain !== currentContain.value) {
    currentContain.value = nextContain
    panzoom.setOptions({ contain: nextContain })
  }

  panzoom.zoom(nextScale, { animate: true })
  zoomPercent.value = Math.round(baseScale.value * nextScale * 100)
}

const closeDialog = () => {
  visible.value = false
}

const handleHide = () => {
  destroyPanzoom()
  trackEvent.track('Plugin_Sidebar_Message_Pic_Close')
}

watch(
  () => visible.value,
  (v) => {
    if (v) initPanzoom()
    else destroyPanzoom()
  }
)

watch(
  () => props.src,
  async () => {
    if (visible.value) await initPanzoom()
  }
)

onUnmounted(() => destroyPanzoom())
</script>

<style scoped>
.viewer-container {
  cursor: grab;
}
</style>
