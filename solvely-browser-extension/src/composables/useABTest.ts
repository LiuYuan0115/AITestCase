import { ref, computed, onMounted, onUnmounted } from 'vue'
import { STORAGE_KEY } from '@/config/storage'

type AssignmentsMap = Record<string, string>

export default function useABTest() {
  const assignments = ref<AssignmentsMap>({})
  const isABTestReady = ref(false)

  const loadAssignments = async () => {
    try {
      const res = await browser.storage.local.get(STORAGE_KEY.ABTEST_ASSIGNMENTS)
      assignments.value = res[STORAGE_KEY.ABTEST_ASSIGNMENTS] || {}
    } catch (e) {
      assignments.value = {}
    } finally {
      isABTestReady.value = true
    }
  }

  const handleStorageChange = (changes: any, area: string) => {
    if (area !== 'local') return
    if (STORAGE_KEY.ABTEST_ASSIGNMENTS in changes) {
      const next = changes[STORAGE_KEY.ABTEST_ASSIGNMENTS]?.newValue || {}
      assignments.value = next || {}
      isABTestReady.value = true
    }
  }

  onMounted(async () => {
    console.log('abtest mounted')
    await loadAssignments()
    browser.storage.onChanged.addListener(handleStorageChange)
  })

  onUnmounted(() => {
    browser.storage.onChanged.removeListener(handleStorageChange)
  })

  // 为每个实验生成一个布尔标记，表示是否命中 T 组
  const flags = computed<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {}
    const map = assignments.value || {}
    for (const key of Object.keys(map)) {
      out[key] = map[key] === 'T'
    }
    return out
  })

  const isIn = (expId: string, variant: string = 'T') =>
    computed<boolean>(() => (assignments.value?.[expId] || '') === variant)

  const getVariant = (expId: string) => computed<string | undefined>(() => assignments.value?.[expId])

  const isMutiModel = computed<boolean>(() => (assignments.value?.['TEST_Plugin_MutiModel'] || '') === 'Test')

  const isMutipleModel = computed<boolean>(() => false)

  const isOnboardingNew = computed<boolean | null>(() => {
    const assignment = assignments.value?.['TEST_Plugin_Onboarding']
    if (!assignment) return null // 初始状态，还没有分配
    return assignment === 'Test'
  })

  // 季包实验下线
  const isQuaterPackage = computed<boolean | null>(() => {
    return false
  })

  const isSolveLayer = computed<boolean | null>(() => {
    const assignmentA = assignments.value?.['TEST_Plugin_MutiModel_Panel'] || ''
    const assignmentB = assignments.value?.['TEST_Plugin_MutiModel'] || ''
    return assignmentA === 'Test' && assignmentB === 'Test'
  })

  const isQuaterPackageRecall = computed<boolean | null>(() => {
    const assignmentA = assignments.value?.['TEST_Plugin_QuaterPackage_Recall']
    const assignmentB = assignments.value?.['TEST_Plugin_MutiModel']
    return assignmentA === 'Test' && assignmentB === 'Test'
  })

  return {
    assignments,
    flags,
    isIn,
    getVariant,
    isMutipleModel,
    isOnboardingNew,
    isABTestReady,
    isMutiModel,
    isQuaterPackage,
    isSolveLayer,
    isQuaterPackageRecall,
  }
}
export interface ABTestState {
  assignments: Ref<AssignmentsMap>
  flags: ComputedRef<Record<string, boolean>>
  isIn: (expId: string, variant: string) => ComputedRef<boolean>
  getVariant: (expId: string) => ComputedRef<string | undefined>
  isMutiModel: ComputedRef<boolean>
  isMutipleModel: ComputedRef<boolean>
  isOnboardingNew: ComputedRef<boolean | null>
  isQuaterPackage: ComputedRef<boolean | null>
  isSolveLayer: ComputedRef<boolean | null>
  isQuaterPackageRecall: ComputedRef<boolean | null>
}
