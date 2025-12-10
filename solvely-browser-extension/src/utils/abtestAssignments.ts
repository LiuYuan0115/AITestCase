import { STORAGE_KEY } from '@/config/storage'
import {
  getAbtestAssignmentsRemote,
  replaceAbtestAssignmentsRemote,
} from '@/api'
import trackEvent from '@/utils/trackEvent'

type ExperimentConfig = {
  id: string
  status: 'running' | 'paused' | 'off'
  audience: 'all' | 'new'
  allocation: Record<string, number>
  mutableVariants?: string[]
  variantOrder?: string[]
}

type ExperimentsMap = Record<string, ExperimentConfig>

type AssignmentsRecord = Record<string, string>
type AllocationCacheRecord = Record<string, Record<string, number>>

/**
 * 处理 experiments：首次分配与再分配
 */
export async function processExperiments(
  experiments: Record<string, any>,
  hasChanged: boolean
): Promise<void> {
  try {
    const normalized: ExperimentsMap = normalizeExperiments(experiments)

    const storage = await browser.storage.local.get([
      STORAGE_KEY.ANON_DEVICE_ID,
      STORAGE_KEY.ABTEST_FIRST_SEEN_AT,
      STORAGE_KEY.ABTEST_ASSIGNMENTS,
      STORAGE_KEY.ABTEST_ALLOCATION_CACHE,
    ])

    let deviceId: string | undefined = storage[STORAGE_KEY.ANON_DEVICE_ID]
    if (!deviceId) {
      deviceId = crypto?.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random()}`
      await browser.storage.local.set({
        [STORAGE_KEY.ANON_DEVICE_ID]: deviceId,
      })
    }

    let firstSeenAt: number | undefined =
      storage[STORAGE_KEY.ABTEST_FIRST_SEEN_AT]
    const isNewUser = !firstSeenAt
    if (!firstSeenAt) {
      firstSeenAt = Date.now()
      await browser.storage.local.set({
        [STORAGE_KEY.ABTEST_FIRST_SEEN_AT]: firstSeenAt,
      })
    }

    const assignments: AssignmentsRecord =
      storage[STORAGE_KEY.ABTEST_ASSIGNMENTS] || {}
    const allocCache: AllocationCacheRecord =
      storage[STORAGE_KEY.ABTEST_ALLOCATION_CACHE] || {}
    const prevAssignments: AssignmentsRecord = { ...assignments }

    let mutated = false
    let cacheMutated = false

    // 遍历每个实验
    for (const expId of Object.keys(normalized)) {
      const exp = normalized[expId]
      const variantOrder = exp.variantOrder

      // status: off → 清理分配与缓存
      if (exp.status === 'off') {
        if (assignments[expId] !== undefined) {
          delete assignments[expId]
          mutated = true
        }
        if (allocCache[expId] !== undefined) {
          delete allocCache[expId]
          cacheMutated = true
        }
        continue
      }

      // paused：不新增/不再分配，但更新缓存为当前配置（便于恢复时计算差分）
      if (exp.status === 'paused') {
        if (!shallowEqual(allocCache[expId], exp.allocation)) {
          allocCache[expId] = { ...exp.allocation }
          cacheMutated = true
        }
        continue
      }

      // running：参与分配
      // 受众：仅 new，且当前无历史分配且非新用户 → 跳过
      if (exp.audience === 'new' && !isNewUser && !assignments[expId]) {
        // 仍然同步缓存
        if (!shallowEqual(allocCache[expId], exp.allocation)) {
          allocCache[expId] = { ...exp.allocation }
          cacheMutated = true
        }
        continue
      }

      const normalizedAlloc = normalizeAllocation(exp.allocation, variantOrder)
      if (!normalizedAlloc) {
        // allocation 非法，跳过
        continue
      }

      const current = assignments[expId]
      const prevAlloc = allocCache[expId]
      if (!current) {
        // 首次分配（确定性哈希分桶）
        const variant = pickByWeightsDeterministic(
          normalizedAlloc,
          `${deviceId}:${expId}:assign`,
          variantOrder
        )
        if (variant) {
          assignments[expId] = variant
          mutated = true
        }
      } else {
        // 再分配（仅当允许变更、且确有变更时）
        const canMutate = Array.isArray(exp.mutableVariants)
          ? exp.mutableVariants.includes(current)
          : false

        const hasPrev = !!prevAlloc
        const allocationChanged =
          hasPrev && !shallowEqual(prevAlloc, normalizedAlloc)
        if (canMutate && hasChanged && allocationChanged) {
          // 如果目标组占比降为 0：全量迁出（确定性选择目标）
          if ((normalizedAlloc[current] || 0) === 0) {
            const targetVariant =
              pickByPositiveDeltasDeterministic(
                prevAlloc,
                normalizedAlloc,
                `${deviceId}:${expId}:target`,
                variantOrder
              ) ||
              pickByWeightsDeterministic(
                normalizedAlloc,
                `${deviceId}:${expId}:target_fallback`,
                variantOrder
              )
            if (targetVariant && targetVariant !== current) {
              assignments[expId] = targetVariant
              mutated = true
            }
          } else {
            // 通用再分配（确定性）：rank > new/prev 则迁出
            const prevWeight = prevAlloc[current] || 0
            const newWeight = normalizedAlloc[current] || 0
            const delta = newWeight - prevWeight
            if (delta < 0 && prevWeight > 0) {
              const threshold = Math.min(1, Math.max(0, newWeight / prevWeight))
              const rank = hash01(`${deviceId}:${expId}:${current}:rank`)
              if (rank > threshold) {
                const targetVariant =
                  pickByPositiveDeltasDeterministic(
                    prevAlloc,
                    normalizedAlloc,
                    `${deviceId}:${expId}:target`,
                    variantOrder
                  ) ||
                  pickByWeightsDeterministic(
                    normalizedAlloc,
                    `${deviceId}:${expId}:target_fallback`,
                    variantOrder
                  )
                if (targetVariant && targetVariant !== current) {
                  assignments[expId] = targetVariant
                  mutated = true
                }
              }
            }
          }
        }
      }

      // 更新缓存为当前配置
      if (!shallowEqual(allocCache[expId], normalizedAlloc)) {
        allocCache[expId] = { ...normalizedAlloc }
        cacheMutated = true
      }
    }

    if (mutated) {
      await browser.storage.local.set({
        [STORAGE_KEY.ABTEST_ASSIGNMENTS]: assignments,
      })
    }
    if (cacheMutated) {
      await browser.storage.local.set({
        [STORAGE_KEY.ABTEST_ALLOCATION_CACHE]: allocCache,
      })
    }

    let addedEvents: string[] = []
    if (mutated) {
      for (const [exp, grp] of Object.entries(assignments)) {
        const prev = prevAssignments[exp]
        if (!prev || prev !== grp) {
          addedEvents.push(`${exp}_${grp}`)
        }
      }
    }

    // 若用户已登录，则与服务端进行一次同步（无需节流，频率由配置同步保证）
    try {
      const userRes = await browser.storage.local.get(STORAGE_KEY.USER)
      const isLoggedIn = !!userRes[STORAGE_KEY.USER]
      if (isLoggedIn) {
        await syncAssignmentsWithServer(true)
      } else if (addedEvents.length > 0) {
        try {
          for (const ev of addedEvents) {
            await trackEvent.smartTrack(ev, {
              anonDeviceId: deviceId,
            })
          }
        } catch (e2) {
          console.warn('Report ABTest assignment events (anon) failed:', e2)
        }
      }
    } catch (e) {
      console.warn('Server sync after processExperiments failed:', e)
    }
  } catch (error) {
    console.warn('processExperiments failed:', error)
  }
}

function normalizeExperiments(input: Record<string, any>): ExperimentsMap {
  const out: ExperimentsMap = {}
  if (!input || typeof input !== 'object') return out
  for (const key of Object.keys(input)) {
    const raw = input[key] || {}
    const id = raw.id || key
    const status = raw.status || 'off'
    const audience = raw.audience || 'all'
    const allocation = (raw.allocation || {}) as Record<string, number>
    const mutableVariants = Array.isArray(raw.mutableVariants)
      ? raw.mutableVariants.slice()
      : undefined
    const variantOrder = Array.isArray((raw as any)?.order)
      ? normalizeVariantOrder(allocation, (raw as any).order)
      : undefined
    out[id] = {
      id,
      status,
      audience,
      allocation,
      mutableVariants,
      variantOrder,
    }
  }
  return out
}

function normalizeVariantOrder(
  allocation: Record<string, number>,
  order: any[]
): string[] | undefined {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of order) {
    if (typeof item !== 'string') continue
    if (!(item in allocation)) continue
    if (seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  for (const key of Object.keys(allocation)) {
    if (seen.has(key)) continue
    seen.add(key)
    result.push(key)
  }
  return result.length > 0 ? result : undefined
}

function normalizeAllocation(
  allocation: Record<string, number>,
  order?: string[]
): Record<string, number> | null {
  const entries = Object.entries(allocation || {}).filter(
    ([, v]) => typeof v === 'number' && v > 0
  )
  if (entries.length === 0) return null
  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  if (total <= 0) return null
  const normalized: Record<string, number> = {}
  if (order && order.length > 0) {
    const weightMap = Object.fromEntries(entries)
    for (const key of getOrderedKeys(weightMap, order)) {
      const value = weightMap[key]
      if (typeof value !== 'number') continue
      normalized[key] = value / total
    }
  } else {
    for (const [k, v] of entries) {
      normalized[k] = v / total
    }
  }
  return normalized
}

function pickByWeightsDeterministic(
  weights: Record<string, number>,
  seed: string,
  order?: string[]
): string | undefined {
  let r = hash01(seed)
  const keys = getOrderedKeys(weights, order)
  for (const key of keys) {
    const w = weights[key]
    if (r < w) return key
    r -= w
  }
  return keys[keys.length - 1]
}

// 根据正增量进行一次加权选择（确定性）
function pickByPositiveDeltasDeterministic(
  prev: Record<string, number> | undefined,
  next: Record<string, number>,
  seed: string,
  order?: string[]
): string | undefined {
  if (!prev) return undefined
  const positives: Record<string, number> = {}
  let total = 0
  for (const key of getOrderedKeys(next, order)) {
    const delta = (next[key] || 0) - (prev[key] || 0)
    if (delta > 0) {
      positives[key] = delta
      total += delta
    }
  }
  if (total <= 0) return undefined
  const normalized: Record<string, number> = {}
  for (const key of getOrderedKeys(positives, order)) {
    normalized[key] = positives[key] / total
  }
  return pickByWeightsDeterministic(normalized, seed, order)
}

function getOrderedKeys(
  weights: Record<string, number>,
  order?: string[]
): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  if (Array.isArray(order)) {
    for (const key of order) {
      if (typeof key !== 'string') continue
      if (!(key in weights)) continue
      if (seen.has(key)) continue
      seen.add(key)
      keys.push(key)
    }
  }
  for (const key of Object.keys(weights)) {
    if (seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

// 简单稳定哈希，返回 [0,1)
function hash01(input: string): number {
  let h = 2166136261 >>> 0 // FNV-1a 32-bit
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h += h << 13
  h ^= h >>> 7
  h += h << 3
  h ^= h >>> 17
  h += h << 5
  h >>>= 0
  return h / 4294967296
}

function shallowEqual(
  a?: Record<string, number>,
  b?: Record<string, number>
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}

/**
 * 用户登录后调用：将服务端标签与本地标签进行合并并同步。
 * 返回：
 *  - 'noauth': 未登录或请求被拒绝
 *  - 'unchanged': 本地与服务端合并后无变更
 *  - 'synced': 已向服务端全量更新并写回本地
 *  - 'failed': 请求失败或发生异常
 */
export async function syncAssignmentsWithServer(
  isMutable: boolean = false
): Promise<'noauth' | 'unchanged' | 'synced' | 'failed'> {
  try {
    // 读取本地 assignments
    const local = await browser.storage.local.get(
      STORAGE_KEY.ABTEST_ASSIGNMENTS
    )
    const localObj: AssignmentsRecord =
      local[STORAGE_KEY.ABTEST_ASSIGNMENTS] || {}

    // 拉取服务端 assignments 字符串
    let serverStr: string
    try {
      serverStr = await getAbtestAssignmentsRemote()
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 401 || status === 403) return 'noauth'
      console.warn('GET /abtest/assignments failed:', e)
      return 'failed'
    }

    // 读取插件配置以获取每个实验的 mutableVariants
    const pluginCfgRes = await browser.storage.local.get(
      STORAGE_KEY.PLUGIN_CONFIG
    )
    const pluginCfg = pluginCfgRes[STORAGE_KEY.PLUGIN_CONFIG]
    const mvMap: Record<string, string[]> = {}
    if (
      isMutable &&
      pluginCfg &&
      pluginCfg.experiments &&
      typeof pluginCfg.experiments === 'object'
    ) {
      for (const [expId, cfg] of Object.entries<any>(pluginCfg.experiments)) {
        if (
          Array.isArray((cfg as any)?.mutableVariants) &&
          (cfg as any).mutableVariants.length > 0
        ) {
          mvMap[expId] = (cfg as any).mutableVariants.slice()
        }
      }
    }

    const serverMap = parseAssignmentsString(serverStr)
    const { mergedMap, changedForServer, mergedLocalObj } = mergeAssignments(
      serverMap,
      localObj,
      mvMap
    )

    // 如本地需要更新到合并后的对象，写回一次（不触发服务端变更判断）
    if (!shallowAssignmentsEqual(localObj, mergedLocalObj)) {
      await browser.storage.local.set({
        [STORAGE_KEY.ABTEST_ASSIGNMENTS]: mergedLocalObj,
      })
    }

    if (!changedForServer) {
      return 'unchanged'
    }

    // 有变更：PUT 全量替换
    const outStr = stringifyAssignments(mergedMap)
    try {
      const resStr = await replaceAbtestAssignmentsRemote(outStr)
      // 成功后确保本地与服务端一致
      await browser.storage.local.set({
        [STORAGE_KEY.ABTEST_ASSIGNMENTS]: mergedLocalObj,
      })
      // 上报新增/变更实验标签事件（无参数）
      try {
        // 计算新增或变更的标签（用于上报），格式 EXP_VARIANT
        const addedEvents: string[] = []
        for (const [exp, grp] of mergedMap.entries()) {
          const prev = serverMap.get(exp)
          if (!prev || prev !== grp) {
            addedEvents.push(`${exp}_${grp}`)
          }
        }
        for (const ev of addedEvents) {
          await trackEvent.smartTrack(ev)
        }
      } catch (reportErr) {
        console.warn('Report ABTest assignment events failed:', reportErr)
      }
      return 'synced'
    } catch (e) {
      console.warn('PUT /abtest/assignments failed:', e)
      return 'failed'
    }
  } catch (error) {
    console.warn('syncAssignmentsWithServer failed:', error)
    return 'failed'
  }
}

// ---- 合并与字符串编解码工具（与服务端规则对齐） ----

const ASSIGNMENT_ITEM_RE = /^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/

function parseAssignmentsString(str: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!str || typeof str !== 'string') return map
  for (const raw of str
    .split(',')
    .map((s) => (s || '').trim())
    .filter(Boolean)) {
    if (!ASSIGNMENT_ITEM_RE.test(raw)) continue
    const idx = raw.indexOf(':')
    const exp = raw.slice(0, idx)
    const grp = raw.slice(idx + 1)
    if (!map.has(exp)) map.set(exp, grp)
  }
  return map
}

function stringifyAssignments(map: Map<string, string>): string {
  const items = Array.from(map.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  return items.map(([exp, grp]) => `${exp}:${grp}`).join(',')
}

function mergeAssignments(
  serverMap: Map<string, string>,
  localObj: AssignmentsRecord,
  mutableVariantsMap: Record<string, string[]> = {}
): {
  mergedMap: Map<string, string>
  changedForServer: boolean
  mergedLocalObj: AssignmentsRecord
} {
  const merged = new Map<string, string>()
  let changedForServer = false

  // 先放入服务端的（作为基线）
  for (const [exp, grp] of serverMap.entries()) {
    merged.set(exp, grp)
  }

  // 合入本地的，处理冲突
  for (const exp of Object.keys(localObj)) {
    const localGrp = localObj[exp]
    if (!merged.has(exp)) {
      merged.set(exp, localGrp)
      changedForServer = true // 服务端没有的标签被新增
      continue
    }
    const serverGrp = merged.get(exp)!
    if (serverGrp === localGrp) {
      continue // 一致
    }
    // 新冲突策略：若服务端当前组在 mutableVariants 中，采用本地；否则采用服务端
    const mv = mutableVariantsMap[exp] || []
    const canMigrateFromServerGrp = mv.includes(serverGrp)
    const finalGrp = canMigrateFromServerGrp ? localGrp : serverGrp
    if (finalGrp !== serverGrp) {
      changedForServer = true
    }
    merged.set(exp, finalGrp)
  }

  // 生成本地对象（用于写回 storage）
  const mergedLocalObj: AssignmentsRecord = {}
  for (const [exp, grp] of merged.entries()) {
    mergedLocalObj[exp] = grp
  }

  return { mergedMap: merged, changedForServer, mergedLocalObj }
}

function shallowAssignmentsEqual(
  a: AssignmentsRecord,
  b: AssignmentsRecord
): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}
