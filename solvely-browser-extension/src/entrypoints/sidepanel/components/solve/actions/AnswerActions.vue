<template>
  <div class="flex items-center gap-2 w-full">
    <template v-if="!isDisliked">
      <div
        v-if="isLiked"
        class="px-[6px] w-8 h-8 flex items-center justify-center text-s-text-brand dark:text-s-text-brand-dark transition-colors duration-200"
      >
        <SvgIcon
          name="liked"
          size="20"
        />
      </div>
      <ActionButton
        v-else
        icon="like"
        :tooltip="'Like'"
        :offset="{ x: 6, y: 0 }"
        @click="emit('like')"
      />
    </template>

    <template v-if="!isLiked">
      <div
        v-if="isDisliked"
        class="px-[6px] w-8 h-8 flex items-center justify-center text-s-text-low-emphasis dark:text-s-text-low-emphasis-dark transition-colors duration-200"
      >
        <SvgIcon
          name="disliked"
          size="20"
        />
      </div>
      <ActionButton
        v-else
        icon="dislike"
        :tooltip="'Dislike'"
        :offset="{ x: 6, y: 0 }"
        @click="emit('dislike')"
      />
    </template>

    <ActionButton
      icon="copy"
      :tooltip="'Copy'"
      @click="emit('copy')"
    />

    <ActionButton
      v-if="showRetry"
      icon="retry"
      :tooltip="'Regenerate'"
      @click="emit('retry')"
    />
  </div>
</template>

<script setup lang="ts">
import ActionButton from './ActionButton.vue'
import SvgIcon from '~/components/common/SvgIcon.vue'

defineProps<{
  isLiked: boolean
  isDisliked: boolean
  showRetry?: boolean
}>()

const emit = defineEmits<{
  (e: 'like'): void
  (e: 'dislike'): void
  (e: 'copy'): void
  (e: 'retry'): void
}>()
</script>
