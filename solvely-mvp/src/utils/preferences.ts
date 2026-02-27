/**
 * 用户偏好设置管理
 * 使用 LocalStorage 持久化用户偏好
 */

const STORAGE_PREFIX = 'aiTestCase_';

export type OutputFormatType = 'markdown' | 'table' | 'yaml' | 'json' | 'mindmap';
export type ContentType = 'testcase' | 'testpoint' | 'prd';

// 测试用例生成时的输出格式（传给后端的格式）
export type TestCaseOutputFormat = 'xmind' | 'table' | 'yaml';

export interface FormatPreferences {
  testcase: OutputFormatType;
  testpoint: OutputFormatType;
  prd: OutputFormatType;
  // 生成测试用例时选择的输出格式
  testcaseGeneration: TestCaseOutputFormat;
}

export interface ToolConfigPreferences {
  enableRAG: boolean;
  ragTopK: number;
  enableCritic: boolean;
  generatePDF: boolean;
  streamOutput: boolean;
  outputFormat: OutputFormatType;
  enableInlineEdit: boolean;
}

export interface UIPreferences {
  sidebarWidth: number;
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
}

export interface UserPreferences {
  formats: FormatPreferences;
  toolConfig: ToolConfigPreferences;
  ui: UIPreferences;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  formats: {
    testcase: 'mindmap',
    testpoint: 'mindmap',
    prd: 'markdown',
    testcaseGeneration: 'xmind',
  },
  toolConfig: {
    enableRAG: true,
    ragTopK: 5,
    enableCritic: false,
    generatePDF: false,
    streamOutput: true,
    outputFormat: 'mindmap',
    enableInlineEdit: false,
  },
  ui: {
    sidebarWidth: 400,
    theme: 'light',
    compactMode: false,
  },
};

class PreferencesManager {
  private cache: UserPreferences | null = null;

  /**
   * 获取所有偏好设置
   */
  getAll(): UserPreferences {
    if (this.cache) return this.cache;

    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}preferences`);
      if (stored) {
        this.cache = this.deepMerge(DEFAULT_PREFERENCES, JSON.parse(stored));
      } else {
        this.cache = { ...DEFAULT_PREFERENCES };
      }
    } catch {
      this.cache = { ...DEFAULT_PREFERENCES };
    }

    return this.cache;
  }

  /**
   * 深度合并对象
   */
  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key in source) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(
          (target as any)[key] || {},
          source[key] as any
        );
      } else if (source[key] !== undefined) {
        result[key] = source[key] as any;
      }
    }
    return result;
  }

  /**
   * 获取特定偏好
   */
  get<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    return this.getAll()[key];
  }

  /**
   * 设置偏好
   */
  set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    const prefs = this.getAll();
    prefs[key] = value;
    this.save(prefs);
  }

  /**
   * 更新部分偏好
   */
  update(partial: Partial<UserPreferences>): void {
    const prefs = this.getAll();
    Object.assign(prefs, partial);
    this.save(prefs);
  }

  /**
   * 保存到 localStorage
   */
  private save(prefs: UserPreferences): void {
    this.cache = prefs;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}preferences`, JSON.stringify(prefs));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }

  /**
   * 重置为默认值
   */
  reset(): void {
    this.cache = null;
    localStorage.removeItem(`${STORAGE_PREFIX}preferences`);
  }

  // ==========================================
  // 便捷方法
  // ==========================================

  /**
   * 获取指定内容类型的格式偏好
   */
  getFormat(contentType: ContentType): OutputFormatType {
    return this.get('formats')[contentType];
  }

  /**
   * 设置指定内容类型的格式偏好
   */
  setFormat(contentType: ContentType, format: OutputFormatType): void {
    const formats = this.get('formats');
    formats[contentType] = format;
    this.set('formats', formats);
  }

  /**
   * 获取工具配置
   */
  getToolConfig(): ToolConfigPreferences {
    return this.get('toolConfig');
  }

  /**
   * 更新工具配置
   */
  updateToolConfig(updates: Partial<ToolConfigPreferences>): void {
    const config = this.get('toolConfig');
    Object.assign(config, updates);
    this.set('toolConfig', config);
  }

  /**
   * 获取 UI 偏好
   */
  getUIPreferences(): UIPreferences {
    return this.get('ui');
  }

  /**
   * 更新 UI 偏好
   */
  updateUIPreferences(updates: Partial<UIPreferences>): void {
    const ui = this.get('ui');
    Object.assign(ui, updates);
    this.set('ui', ui);
  }
}

// 单例导出
export const preferences = new PreferencesManager();

// 默认导出
export default preferences;
