<template>
  <iframe
    ref="iframeRef"
    :src="sandboxUrl"
    style="width: 0; height: 0; border: none; position: absolute;"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { LatexSandboxSymbol } from '~/plugins/latex-sandbox'
import { LatexSandboxService } from '~/services/latex-sandbox'

const sandboxUrl = chrome.runtime.getURL('sandbox.html')
const iframeRef = ref<HTMLIFrameElement | null>(null)

onMounted(() => {
  const service = inject<LatexSandboxService>(LatexSandboxSymbol)
  if (service && iframeRef.value) {
    service.setIframeRef(iframeRef.value)
  }
})
</script> 