<template>
  <div class="role-selector">
    <button
      v-for="role in roles"
      :key="role.id"
      class="role-tab"
      :class="{ 'active': currentRole === role.id }"
      @click="handleRoleClick(role.id)"
    >
      <span class="role-icon">{{ role.icon }}</span>
      <span class="role-label">{{ role.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRole, ROLE_INFO, type UserRole } from '@/composables';

const emit = defineEmits<{
  change: [role: UserRole];
}>();

const { currentRole, switchRole } = useRole();

const roles = computed(() => [
  { id: 'pm' as UserRole, icon: ROLE_INFO.pm.icon, label: ROLE_INFO.pm.label },
  { id: 'dev' as UserRole, icon: ROLE_INFO.dev.icon, label: ROLE_INFO.dev.label },
  { id: 'qa' as UserRole, icon: ROLE_INFO.qa.icon, label: ROLE_INFO.qa.label },
]);

function handleRoleClick(role: UserRole) {
  if (role !== currentRole.value) {
    switchRole(role);
    emit('change', role);
  }
}
</script>

<style scoped>
.role-selector {
  display: flex;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
}

.role-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
}

.role-tab:hover:not(.active) {
  background: rgba(255, 255, 255, 0.5);
  color: #374151;
}

.role-tab.active {
  background: white;
  color: #5D6AB4;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.role-icon {
  font-size: 16px;
}

.role-label {
  font-size: 13px;
}

/* 紧凑模式 */
.role-selector.compact .role-tab {
  padding: 8px 12px;
}

.role-selector.compact .role-label {
  display: none;
}

/* 垂直模式 */
.role-selector.vertical {
  flex-direction: column;
}

.role-selector.vertical .role-tab {
  justify-content: flex-start;
}
</style>
