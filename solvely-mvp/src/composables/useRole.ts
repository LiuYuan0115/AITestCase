/**
 * useRole - 角色管理 Composable
 * Week 8: 统一角色状态管理
 */
import { ref, computed } from 'vue';

export type UserRole = 'pm' | 'dev' | 'qa' | '';

// 角色信息（含图标）
export const ROLE_INFO: Record<UserRole, { label: string; description: string; icon: string }> = {
  pm: { label: '产品经理', description: '更关注需求、范围、优先级', icon: '📊' },
  dev: { label: '开发', description: '更关注实现、边界、技术风险', icon: '💻' },
  qa: { label: '测试', description: '更关注覆盖、异常、可测性', icon: '🔍' },
  '': { label: '', description: '', icon: '' }
};

// 单例状态
let _currentRole = ref<UserRole>('');

/**
 * 角色管理 Composable
 *
 * 提供统一的用户角色管理。
 * 所有使用此 composable 的组件共享同一个角色状态。
 *
 * @example
 * ```ts
 * const { currentRole, roleLabel, selectRole, isRoleSelected } = useRole();
 *
 * // 选择角色
 * selectRole('qa');
 *
 * // 获取角色标签
 * console.log(roleLabel.value); // '测试'
 * ```
 */
export function useRole() {
  const currentRole = computed(() => _currentRole.value);

  const roleLabel = computed(() =>
    ROLE_INFO[_currentRole.value]?.label || ''
  );

  const roleDescription = computed(() =>
    ROLE_INFO[_currentRole.value]?.description || ''
  );

  const isRoleSelected = computed(() =>
    _currentRole.value !== ''
  );

  const isPM = computed(() => _currentRole.value === 'pm');
  const isDev = computed(() => _currentRole.value === 'dev');
  const isQA = computed(() => _currentRole.value === 'qa');

  /**
   * 选择角色
   */
  function selectRole(role: UserRole): void {
    _currentRole.value = role;
    console.log('[useRole] Role selected:', role);
  }

  /**
   * 清除角色（返回角色选择页面）
   */
  function clearRole(): void {
    _currentRole.value = '';
  }

  /**
   * 获取角色信息
   */
  function getRoleInfo(role: UserRole) {
    return ROLE_INFO[role];
  }

  /**
   * 获取所有可用角色
   */
  function getAvailableRoles(): UserRole[] {
    return ['pm', 'dev', 'qa'];
  }

  return {
    currentRole,
    roleLabel,
    roleDescription,
    isRoleSelected,
    isPM,
    isDev,
    isQA,
    selectRole,
    switchRole: selectRole,  // 别名，兼容 RoleSelector 组件
    clearRole,
    getRoleInfo,
    getAvailableRoles
  };
}

export default useRole;
