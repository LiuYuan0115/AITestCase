<script lang="ts" setup>
const props = defineProps<{
  keys: string[];
  winKeys: string[];
  toHomeKeys: string[];
  winToHomeKeys: string[];
}>();
const emits = defineEmits<{
  (e: "enter"): void;
  (e: "escape"): void;
  (e: "trigger"): void; // 自定义事件
  (e: "toHome"): void;
}>();
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    emits("enter");
  } else if (event.key === "Escape") {
    emits("escape");
  }
  let is_windows = navigator.userAgent.includes("Windows");
  let sys_keys = is_windows ? props.winKeys : props.keys;
  let match = true;
  for (let i = 0; i < sys_keys.length; i++) {
    if (sys_keys.includes("command") && !event.metaKey) {
      match = false;
      break;
    }
    if (sys_keys.includes("ctrl") && !event.ctrlKey) {
      match = false;
      break;
    }
    if (sys_keys.includes("shift") && !event.shiftKey) {
      match = false;
      break;
    }
    if (sys_keys.includes("alt") && !event.altKey) {
      match = false;
      break;
    }
    if (event.key.length > 1) {
      match = false;
      break;
    }
    if (!sys_keys.includes(event.key.toLowerCase())) {
      match = false;
      break;
    }
  }
  // console.log("快捷键：", event.metaKey, event.key, match);
  if (match) {
    emits("trigger");
  }

  // 处理主页快捷键
  let home_sys_keys = is_windows ? props.winToHomeKeys : props.toHomeKeys;
  match = true;
  for (let i = 0; i < home_sys_keys.length; i++) {
    if (home_sys_keys.includes("command") && !event.metaKey) {
      match = false;
      break;
    }
    if (home_sys_keys.includes("ctrl") && !event.ctrlKey) {
      match = false;
      break;
    }
    if (home_sys_keys.includes("shift") && !event.shiftKey) {
      match = false;
      break;
    }
    if (home_sys_keys.includes("alt") && !event.altKey) {
      match = false;
      break;
    }
    if (event.key.length > 1) {
      match = false;
      break;
    }
    if (!home_sys_keys.includes(event.key.toLowerCase())) {
      match = false;
      break;
    }
  }
  if (match) {
    emits("toHome");
  }
};
onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template></template>
