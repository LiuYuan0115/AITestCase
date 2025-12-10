/**
 * 模型配置管理（V2 版本）
 *
 * 职责：
 * - 从 plugin-config.json 读取 aiModelsV2 配置
 * - 提供扁平化的模型列表用于查询
 * - 提供分组模型列表用于 UI 渲染
 * - 提供模型 ID 与名称、图标的映射
 */

import { ref, computed } from 'vue'
import { getConfigValue } from '@/utils/config'
import type { ModelsConfigV2, ModelItemV2, ModelGroupV2 } from './types'
import { useDarkMode } from '@/composables/useDarkMode'
import { STORAGE_KEY } from '@/config/storage'
import useSubscription from '@/entrypoints/sidepanel/composables/useSubscription'

const { isDark } = useDarkMode()

// 默认模型配置（V2 结构）
const DEFAULT_MODELS_V2: ModelsConfigV2 = {
  defaultModel: 'Fast',
  data: [
    {
      name: 'Solvely AI',
      models: [
        {
          id: 'Fast',
          name: 'Fast',
          description: 'Instant answers, reliable results',
          icon: 'aiModels/solvely-fast-active',
        },
        {
          id: 'MultiModel',
          name: 'Multi-model',
          description: 'Cross-checked for highest accuracy',
          icon: 'aiModels/solvely-multi-active',
        },
      ],
    },
    {
      name: 'Third-Party Model',
      models: [
        {
          id: 'GPT5Pro',
          name: 'GPT-5 Pro',
          description: 'Strong in math and logic',
          icon: 'aiModels/gpt',
          iconDark: 'aiModels/gpt-dark',
        },
        {
          id: 'GeminiPro',
          name: 'Gemini Pro',
          description: 'Deep, insightful, cross-domain',
          icon: 'aiModels/gemini',
        },
        {
          id: 'ClaudeMax',
          name: 'Claude Max',
          description: 'Eloquent, thoughtful, linguist',
          icon: 'aiModels/claude',
        },
      ],
    },
  ],
}

export function useModelConfig() {
  const modelsConfigV2 = ref<ModelsConfigV2>(DEFAULT_MODELS_V2)
  const isLoading = ref(false)

  // 🎯 在函数内部调用 useDarkMode，而不是模块顶层
  const { isDark } = useDarkMode()

  // 🎯 获取订阅状态
  const { isSubscribed } = useSubscription

  // 加载配置（从 aiModelsV2 读取）
  const loadConfig = async () => {
    try {
      isLoading.value = true
      // 从新的 aiModelsV2 字段读取
      const aiModelsV2 = await getConfigValue<ModelsConfigV2>('features.aiModelsV2')

      if (aiModelsV2 && aiModelsV2.data && aiModelsV2.data.length > 0) {
        modelsConfigV2.value = aiModelsV2
        console.log('✅ useModelConfig: 成功加载 V2 配置', aiModelsV2)
      } else {
        console.log('⚠️ useModelConfig: 使用默认 V2 配置')
      }
    } catch (error) {
      console.error('❌ useModelConfig: 配置加载失败，使用默认配置', error)
    } finally {
      isLoading.value = false
    }
  }

  // 初始化时加载配置
  loadConfig()

  // 扁平化的所有模型（用于查询和遍历）
  const flattenedModels = computed((): ModelItemV2[] => {
    const result: ModelItemV2[] = []
    for (const group of modelsConfigV2.value.data) {
      result.push(...group.models)
    }
    return result
  })

  // 分组模型（用于 UI 渲染，保留分组信息）
  const groupedModels = computed((): ModelGroupV2[] => {
    return modelsConfigV2.value.data
  })

  // 默认模型 ID
  const defaultModelId = computed(() => {
    return modelsConfigV2.value.defaultModel || 'Fast'
  })

  // 根据 ID 获取模型配置
  const getModelById = (modelId: string): ModelItemV2 | undefined => {
    return flattenedModels.value.find((m) => m.id === modelId)
  }

  // 根据 ID 获取模型名称
  const getModelName = (modelId: string): string => {
    return getModelById(modelId)?.name || modelId
  }

  // 根据 ID 获取模型图标（支持深色模式）
  const getModelIcon = (modelId: string): string => {
    const model = getModelById(modelId)
    if (!model) return ''
    return (isDark.value && model.iconDark) || model.icon
  }

  // 根据 ID 获取模型描述
  const getModelDescription = (modelId: string): string => {
    return getModelById(modelId)?.description || ''
  }

  // 根据 ID 获取模型所属分组名称
  const getModelGroupName = (modelId: string): string => {
    for (const group of modelsConfigV2.value.data) {
      if (group.models.some((m) => m.id === modelId)) {
        return group.name
      }
    }
    return ''
  }

  /**
   * 根据模型 ID 获取按钮显示名称
   * 考虑分组的 showGroupNameInButton 配置
   *
   * @param modelId 模型 ID
   * @returns 按钮应显示的名称（分组名或模型名）
   */
  const getButtonDisplayName = (modelId: string): string => {
    // 查找模型所属的分组
    for (const group of modelsConfigV2.value.data) {
      const model = group.models.find((m) => m.id === modelId)
      if (model) {
        // 如果分组配置了显示分组名，返回分组名
        if (group.showGroupNameInButton) {
          return group.name
        }
        // 否则返回模型名
        return model.name
      }
    }
    return modelId
  }

  /**
   * 检查某个模型是否属于需要显示分组名的分组
   *
   * @param modelId 模型 ID
   * @returns 是否需要显示分组名
   */
  const shouldShowGroupNameForModel = (modelId: string): boolean => {
    for (const group of modelsConfigV2.value.data) {
      if (group.models.some((m) => m.id === modelId)) {
        return !!group.showGroupNameInButton
      }
    }
    return false
  }

  /**
   * 获取有效的默认模型 ID
   *
   * 功能：
   * 0. 检查用户订阅状态，未订阅用户直接返回配置默认值
   * 1. 从 storage 读取用户保存的默认模型
   * 2. 验证该模型是否存在于当前配置中
   * 3. 如果不存在，返回配置中的 defaultModel
   *
   * @returns Promise<string> 有效的模型 ID
   */
  const getEffectiveDefaultModel = async (): Promise<string> => {
    try {
      // 0. 检查订阅状态：未订阅用户直接返回默认模型
      if (!isSubscribed.value) {
        console.log('📌 useModelConfig: 未订阅用户，使用配置默认值', defaultModelId.value)
        return defaultModelId.value
      }

      // 1. 从 storage 读取用户保存的默认模型
      const result = await browser.storage.local.get(STORAGE_KEY.DEFAULT_SOLVE_MODEL)
      const savedModelId = result[STORAGE_KEY.DEFAULT_SOLVE_MODEL]

      // 2. 如果没有保存值，返回配置的默认值
      if (!savedModelId) {
        console.log('📌 useModelConfig: 未找到保存的默认模型，使用配置默认值', defaultModelId.value)
        return defaultModelId.value
      }

      // 3. 检查保存的值是否存在于当前配置中
      const model = getModelById(savedModelId as string)
      if (model) {
        console.log('✅ useModelConfig: 使用保存的默认模型', savedModelId)
        return savedModelId as string
      }

      // 4. 不存在，返回配置的默认值
      console.warn(
        `⚠️ useModelConfig: 保存的模型 "${savedModelId}" 在当前配置中不存在，使用默认值 "${defaultModelId.value}"`
      )

      return defaultModelId.value
    } catch (error) {
      console.error('❌ useModelConfig: 获取有效默认模型失败', error)
      return defaultModelId.value
    }
  }

  return {
    modelsConfigV2,
    flattenedModels,
    groupedModels,
    defaultModelId,
    isLoading,
    getModelById,
    getModelName,
    getModelIcon,
    getModelDescription,
    getModelGroupName,
    getButtonDisplayName,
    shouldShowGroupNameForModel,
    getEffectiveDefaultModel,
    loadConfig,
  }
}
