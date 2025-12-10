<template>
  <div v-if="isStop" class="text-[14px] leading-[140%] text-t_3 dark:text-t_3_dk">
    You stopped this response
  </div>
  <div v-else class="flex justify-start gap-3 -ml-[6px]">
    <div
      v-if="isLiked"
      class="px-[6px] text-t_brand dark:text-t_brand_dk color-transition w-8 h-8 flex items-center justify-center"
    >
      <SvgIcon name="liked" size="20" />
    </div>
    <div
      v-else-if="isDisliked"
      class="px-[6px] text-t_3 dark:text-t_3_dk w-8 h-8 flex items-center justify-center color-transition"
    >
      <SvgIcon name="disliked" size="20" />
    </div>
    <template v-else>
      <CustomTooltip text="Like" position="top">
        <Button
          type="icon-only"
          icon="like"
          @click="handleLike"
        />
      </CustomTooltip>
      <CustomTooltip text="Dislike" position="top">
        <Button
          type="icon-only"
          icon="dislike"
          @click="handleDislike"
        />
      </CustomTooltip>
    </template>
    <CustomTooltip text="Copy" position="top">
      <Button
        type="icon-only"
        icon="copy"
        @click="handleCopy"
      />
    </CustomTooltip>
    <CustomTooltip v-if="!noNeedRetry" text="Regenerate" position="top">
      <Button
        type="icon-only"
        icon="retry"
        @click="handleRetry"
      />
    </CustomTooltip>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/common/Button.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import CustomTooltip from '@/components/common/CustomTooltip.vue'
import trackEvent from '~/utils/trackEvent'

defineProps<{
  isLiked: boolean
  isDisliked: boolean
  noNeedRetry?: boolean
  isStop?: boolean
}>()

const emit = defineEmits<{
  (e: 'like'): void
  (e: 'dislike'): void
  (e: 'copy'): void
  (e: 'retry'): void
}>()

const handleLike = () => {
  emit('like')
  trackEvent.track('Plugin_sidebar_like')
}

const handleDislike = () => {
  emit('dislike')
  trackEvent.track('Plugin_sidebar_dislike')
}

const handleCopy = () => {
  emit('copy')
  trackEvent.track('Plugin_sidebar_copy')
}

const handleRetry = () => {
  emit('retry')
  trackEvent.track('Plugin_sidebar_regenerate')
}
</script>
