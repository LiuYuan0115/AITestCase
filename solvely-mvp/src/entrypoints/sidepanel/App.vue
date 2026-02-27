<template>
  <!-- 角色选择页面（首次进入） -->
  <div v-if="!userRole" class="role-select-container">
    <div class="role-select-box">
      <h1 class="role-select-title">请选择你的角色</h1>
      <p class="role-select-desc">选择后会自动进入聊天区域，你也可以随时在右上角切换。</p>
      <div class="role-cards">
        <button class="role-card" @click="selectUserRole('pm')">
          <img class="role-card-avatar" :src="pmAvatarUrl" alt="产品经理头像" />
          <div class="role-card-name">产品经理</div>
          <div class="role-card-tip">更关注需求、范围、优先级</div>
        </button>
        <button class="role-card" @click="selectUserRole('dev')">
          <img class="role-card-avatar" :src="devAvatarUrl" alt="开发头像" />
          <div class="role-card-name">开发</div>
          <div class="role-card-tip">更关注实现、边界、技术风险</div>
        </button>
        <button class="role-card" @click="selectUserRole('qa')">
          <img class="role-card-avatar" :src="qaAvatarUrl" alt="测试头像" />
          <div class="role-card-name">测试</div>
          <div class="role-card-tip">更关注覆盖、异常、可测性</div>
        </button>
      </div>
    </div>
  </div>

  <!-- 统一布局：PM / DEV / QA 共用 -->
  <div v-else class="unified-layout">
    <!-- 顶部栏 -->
    <div class="unified-header">
      <div class="header-title">{{ userRoleLabel }}模式</div>
      <button class="new-chat-btn" @click="reset" v-tooltip="'新建会话'">
        <Plus :size="14" /> New
      </button>
      <div class="role-area" @click.stop>
        <button class="role-avatar-btn" @click="toggleRoleMenu" v-tooltip="`当前角色：${userRoleLabel}`">
          <img class="role-avatar" :src="userRoleAvatarUrl" :alt="`${userRoleLabel}头像`" />
        </button>
        <div v-if="isRoleMenuOpen" class="role-menu">
          <div class="role-menu-title">切换角色</div>
          <button class="role-menu-item" @click="changeUserRole('pm')">
            <img class="role-menu-avatar" :src="pmAvatarUrl" alt="产品经理头像" />
            <span>产品经理</span>
          </button>
          <button class="role-menu-item" @click="changeUserRole('dev')">
            <img class="role-menu-avatar" :src="devAvatarUrl" alt="开发头像" />
            <span>开发</span>
          </button>
          <button class="role-menu-item" @click="changeUserRole('qa')">
            <img class="role-menu-avatar" :src="qaAvatarUrl" alt="测试头像" />
            <span>测试</span>
          </button>
          <!-- QA角色的步骤导航 -->
          <template v-if="userRole === 'qa'">
            <div class="role-menu-divider"></div>
            <div class="role-menu-title">流程步骤</div>
            <button class="role-menu-item workflow-step" :class="{ active: ['setup', 'analyzing', 'content_review'].includes(projectState.currentStep) }" @click="goToStep('content_review'); isRoleMenuOpen = false">
              <span>1. 分析</span>
            </button>
            <button class="role-menu-item workflow-step" :class="{ active: ['optimizing', 'prd_review'].includes(projectState.currentStep) }" @click="goToStep('prd_review'); isRoleMenuOpen = false">
              <span>2. PRD</span>
            </button>
            <button class="role-menu-item workflow-step" :class="{ active: projectState.currentStep === 'test_point' }" @click="goToStep('test_point'); isRoleMenuOpen = false">
              <span>3. 测试点</span>
            </button>
            <button class="role-menu-item workflow-step" :class="{ active: projectState.currentStep === 'test_case' }" @click="goToStep('test_case'); isRoleMenuOpen = false">
              <span>4. 用例</span>
            </button>
            <button class="role-menu-item workflow-step" :class="{ active: projectState.currentStep === 'auto_test' }" @click="goToStep('auto_test'); isRoleMenuOpen = false">
              <span>5. 测试</span>
            </button>
            <div class="role-menu-divider"></div>
            <div class="role-menu-title">用例输出格式</div>
            <div class="format-selector-inline">
              <button
                v-for="opt in testCaseFormatOptions"
                :key="opt.value"
                :class="['format-option-btn', { active: testCaseOutputFormat === opt.value }]"
                @click="selectTestCaseFormat(opt.value)"
                v-tooltip="opt.description"
              >
                <span class="format-icon">{{ opt.icon }}</span>
                <span class="format-label">{{ opt.label }}</span>
              </button>
            </div>
          </template>
        </div>
        </div>
      </div>

    <!-- 主体区域 -->
    <div class="unified-body">
      <!-- 左侧面板：聊天 + 输入 -->
      <div class="left-panel" :style="{ width: leftPanelWidth + 'px' }">

        <!-- ===== Midscene 全屏面板 (Step 5 + Midscene 引擎) ===== -->
        <div v-if="projectState.currentStep === 'auto_test' && uiEngine === 'midscene'" class="midscene-full-panel">
          <!-- 顶部状态栏 -->
          <div class="midscene-topbar">
            <button class="midscene-topbar-btn" @click="projectState.currentStep = 'test_case'" v-tooltip="'返回测试用例'">
              <ChevronLeft :size="13" />
            </button>
            <span class="midscene-topbar-title">Midscene</span>
            <span class="midscene-topbar-status" :class="{ ok: midsceneSidecarReady }">
              {{ midsceneSidecarReady ? 'OK' : 'OFF' }}
            </span>

            <div class="midscene-topbar-spacer"></div>

            <!-- 当前模式标签（快速可视化） -->
            <span class="midscene-mode-tag" :class="midsceneExecutionMode">
              {{ midsceneExecutionMode === 'free' ? '自由' : midsceneExecutionMode === 'mixed' ? '混合' : '回归' }}
            </span>

            <!-- 基线覆盖率（仅有基线时显示） -->
            <span v-if="baselineCoverage.total > 0 && baselineCoverage.covered > 0" class="midscene-baseline-tag" v-tooltip="'回归基线覆盖率'">
              R {{ baselineCoverage.covered }}/{{ baselineCoverage.total }}
            </span>

            <!-- 停止按钮 -->
            <button v-if="midsceneExecuting" class="midscene-topbar-btn midscene-stop-btn" @click.stop="stopMidsceneExecution" v-tooltip="'停止执行'">
              <Square :size="11" />
            </button>

            <!-- 设置按钮 -->
            <div class="midscene-settings-wrap" @click.stop>
              <button class="midscene-topbar-btn" :class="{ active: midsceneSettingsVisible }" @click="toggleSettingsPanel" v-tooltip="'设置'">
                <Settings :size="13" />
              </button>

              <!-- 设置下拉面板 -->
              <transition name="settings-fade">
                <div v-if="midsceneSettingsVisible" class="midscene-settings-dropdown">
                  <div class="settings-section">
                    <div class="settings-label">执行模式</div>
                    <div class="settings-desc" v-if="modeRecommendationTip">{{ modeRecommendationTip }}</div>
                    <div class="settings-mode-group">
                      <button class="settings-mode-btn" :class="{ active: midsceneExecutionMode === 'free' }" @click="midsceneExecutionMode = 'free'" :disabled="midsceneExecuting">
                        <Zap :size="12" /> 自由
                      </button>
                      <button class="settings-mode-btn" :class="{ active: midsceneExecutionMode === 'mixed' }" @click="midsceneExecutionMode = 'mixed'" :disabled="midsceneExecuting">
                        <Puzzle :size="12" /> 混合
                      </button>
                      <button class="settings-mode-btn" :class="{ active: midsceneExecutionMode === 'regression' }" @click="midsceneExecutionMode = 'regression'" :disabled="midsceneExecuting">
                        <ShieldCheck :size="12" /> 回归
                      </button>
                    </div>
                  </div>

                  <div class="settings-divider"></div>

                  <div class="settings-section">
                    <div class="settings-label">缓存策略</div>
                    <div class="settings-cache-group">
                      <button v-for="opt in [
                        { val: 'smart', label: '智能' },
                        { val: 'read-write', label: '读写' },
                        { val: 'read-only', label: '只读' },
                        { val: 'write-only', label: '仅写' },
                        { val: 'false', label: '关闭' }
                      ]" :key="opt.val"
                        class="settings-cache-btn" :class="{ active: midsceneCacheStrategy === opt.val }"
                        @click="midsceneCacheStrategy = opt.val as any" :disabled="midsceneExecuting">
                        {{ opt.label }}
                      </button>
                    </div>
                  </div>

                  <div class="settings-divider"></div>

                  <div class="settings-section">
                    <div class="settings-label">浏览器</div>
                    <div class="settings-row">
                      <button class="settings-toggle-btn" :class="{ active: !isHeadlessMode }" @click="isHeadlessMode = false">
                        <Monitor :size="12" /> CDP
                      </button>
                      <button class="settings-toggle-btn" :class="{ active: isHeadlessMode }" @click="isHeadlessMode = true">
                        <Ghost :size="12" /> Headless
                      </button>
                      <div class="settings-row-spacer"></div>
                      <button class="settings-toggle-btn" @click="switchUiEngine" v-tooltip="'切换到传统引擎'">
                        <Gamepad2 :size="12" /> 传统
                      </button>
                    </div>
                  </div>

                  <div class="settings-divider"></div>

                  <div class="settings-section">
                    <div class="settings-label">数据管理</div>
                    <div class="settings-row">
                      <button class="settings-action-btn" @click="toggleCachePanel(); midsceneSettingsVisible = false;">
                        <Database :size="12" /> 缓存管理
                      </button>
                      <button class="settings-action-btn" @click="toggleRegressionPanel(); midsceneSettingsVisible = false;">
                        <ClipboardList :size="12" /> 基线管理
                      </button>
                    </div>
                  </div>

                  <!-- 基线覆盖率统计 -->
                  <div v-if="baselineCoverage.total > 0" class="settings-coverage">
                    <div class="settings-coverage-bar">
                      <div class="settings-coverage-fill" :style="{ width: baselineCoverage.percentage + '%' }"></div>
                    </div>
                    <span class="settings-coverage-text">
                      基线覆盖 {{ baselineCoverage.covered }}/{{ baselineCoverage.total }} ({{ baselineCoverage.percentage }}%)
                    </span>
                  </div>
                </div>
              </transition>
            </div>
          </div>

          <!-- ★ 缓存管理面板（展开/收起） -->
          <div v-if="midsceneCachePanelVisible" class="midscene-cache-panel">
            <div class="midscene-cache-header">
              <span class="midscene-cache-title">缓存管理</span>
              <span class="midscene-cache-size">总计: {{ formatBytes(midsceneCacheTotalSize) }}</span>
              <button class="midscene-cache-clear-btn" @click="handleClearAllCache" :disabled="midsceneCacheList.length === 0">清空全部</button>
            </div>
            <div v-if="midsceneCacheLoading" class="midscene-cache-loading">加载中...</div>
            <div v-else-if="midsceneCacheList.length === 0" class="midscene-cache-empty">暂无缓存文件</div>
            <div v-else class="midscene-cache-list">
              <div v-for="cache in midsceneCacheList" :key="cache.id" class="midscene-cache-item">
                <div class="midscene-cache-item-info">
                  <span class="midscene-cache-item-id" :title="cache.id">{{ cache.id }}</span>
                  <span class="midscene-cache-item-meta">{{ cache.planCount }}P / {{ cache.locateCount }}L · {{ formatBytes(cache.sizeBytes) }}</span>
                </div>
                <button class="midscene-cache-item-del" @click="handleDeleteCache(cache.id)" v-tooltip="'删除此缓存'">×</button>
              </div>
            </div>
          </div>

          <!-- ★ 回归基线管理面板 -->
          <div v-if="regressionPanelVisible" class="midscene-cache-panel">
            <div class="midscene-cache-header">
              <span class="midscene-cache-title">回归基线管理</span>
              <span class="midscene-cache-size">共 {{ regressionBaselines.length }} 条</span>
            </div>
            <div v-if="regressionLoading" class="midscene-cache-loading">加载中...</div>
            <div v-else-if="regressionBaselines.length === 0" class="midscene-cache-empty">暂无回归基线。请先在混合模式执行成功后保存。</div>
            <div v-else class="midscene-cache-list">
              <div v-for="bl in regressionBaselines" :key="bl.id" class="midscene-cache-item">
                <div class="midscene-cache-item-info" style="flex: 1;">
                  <span class="midscene-cache-item-id" :title="bl.fileName">{{ bl.caseId }}: {{ bl.caseName }}</span>
                  <span class="midscene-cache-item-meta">
                    {{ bl.stepsCount }}步 · {{ bl.assertionsCount }}断言
                    <span v-if="bl.lastRunStatus" :style="{ color: bl.lastRunStatus === 'passed' ? '#4caf50' : '#f44336' }">
                      · {{ bl.lastRunStatus === 'passed' ? 'PASS' : 'FAIL' }}
                    </span>
                  </span>
                </div>
                <button class="midscene-topbar-btn" @click="handleRunBaseline(bl)" v-tooltip="'执行'" style="margin: 0 2px;"><Play :size="10" /></button>
                <button class="midscene-topbar-btn" @click="handleEditBaseline(bl.id)" v-tooltip="'编辑'" style="margin: 0 2px;"><Settings :size="10" /></button>
                <button class="midscene-cache-item-del" @click="handleDeleteBaseline(bl.id)" v-tooltip="'删除'">×</button>
              </div>
            </div>
          </div>

          <!-- ★ 步骤编辑器面板 -->
          <div v-if="stepEditorVisible" class="midscene-step-editor">
            <div class="midscene-cache-header">
              <span class="midscene-cache-title">步骤编辑器</span>
              <button class="midscene-topbar-btn" @click="stepEditorVisible = false" v-tooltip="'关闭'" style="margin-left: auto;">✕</button>
            </div>
            <div class="midscene-step-editor-meta">
              <input v-model="stepEditorCaseId" placeholder="用例 ID" class="midscene-step-input" style="width: 80px;" />
              <input v-model="stepEditorCaseName" placeholder="用例名称" class="midscene-step-input" style="flex: 1;" />
            </div>
            <div class="midscene-step-list">
              <div v-for="(step, i) in stepEditorSteps" :key="i" class="midscene-step-item" :class="{ 'step-failed': instantStepResults[i]?.success === false, 'step-passed': instantStepResults[i]?.success === true }">
                <span class="midscene-step-index">{{ i + 1 }}</span>
                <select v-model="step.type" class="midscene-step-type-select">
                  <option value="tap">点击</option>
                  <option value="doubleTap">双击</option>
                  <option value="rightClick">右键</option>
                  <option value="hover">悬停</option>
                  <option value="input">输入</option>
                  <option value="keypress">按键</option>
                  <option value="scroll">滚动</option>
                  <option value="aiAct">自由</option>
                </select>
                <input v-model="step.target" placeholder="目标描述" class="midscene-step-input" style="flex: 1;" />
                <input v-if="step.type === 'input' || step.type === 'keypress'" v-model="step.value" placeholder="输入值/按键名" class="midscene-step-input" style="width: 80px;" />
                <span v-if="instantStepResults[i]" class="midscene-step-method" :title="instantStepResults[i].method">
                  {{ instantStepResults[i].success ? '✓' : '✗' }}
                  {{ instantStepResults[i].method === 'instant' ? '即时' : instantStepResults[i].method === 'aiAct-single' ? 'AI' : 'DT' }}
                </span>
                <button class="midscene-topbar-btn" @click="runFromStep(i)" v-tooltip="'从此步重跑'" style="margin: 0 1px;"><RotateCcw :size="9" /></button>
                <button class="midscene-topbar-btn" @click="moveStepUp(i)" :disabled="i === 0" v-tooltip="'上移'" style="margin: 0 1px;">↑</button>
                <button class="midscene-topbar-btn" @click="moveStepDown(i)" :disabled="i === stepEditorSteps.length - 1" v-tooltip="'下移'" style="margin: 0 1px;">↓</button>
                <button class="midscene-cache-item-del" @click="removeStep(i)" v-tooltip="'删除'">×</button>
              </div>
            </div>
            <div class="midscene-step-editor-actions">
              <button class="midscene-step-btn" @click="addNewStep">+ 添加步骤</button>
              <button class="midscene-step-btn" @click="runFromStep(0)">全部运行</button>
              <button class="midscene-step-btn midscene-step-btn-primary" @click="saveStepsAsBaseline">保存为回归基线</button>
            </div>
          </div>

          <!-- ★ 逐步执行结果展示（混合/回归模式） -->
          <div v-if="instantStepResults.length > 0" class="midscene-instant-results">
            <div class="midscene-cache-header">
              <span class="midscene-cache-title">逐步执行详情</span>
              <button class="midscene-topbar-btn" @click="instantStepResults = []" v-tooltip="'关闭'">✕</button>
            </div>
            <div v-for="sr in instantStepResults" :key="sr.stepIndex" class="midscene-instant-step" :class="{ 'step-passed': sr.success, 'step-failed': !sr.success }">
              <span class="midscene-step-index">{{ sr.stepIndex + 1 }}</span>
              <span class="midscene-step-status">{{ sr.success ? '✓' : '✗' }}</span>
              <span class="midscene-step-desc">{{ sr.original }}</span>
              <span class="midscene-step-method" :title="sr.method">
                {{ sr.method === 'instant' ? '即时' : sr.method === 'aiAct-single' ? 'AI单步' : 'DeepThink' }}
              </span>
              <span class="midscene-step-time">{{ sr.durationMs > 0 ? (sr.durationMs / 1000).toFixed(1) + 's' : '' }}</span>
              <div v-if="sr.error" class="midscene-step-error">{{ sr.error }}</div>
              <div v-if="sr.suggestion" class="midscene-step-suggestion">💡 {{ sr.suggestion }}</div>
            </div>
          </div>

          <!-- ★ 回归模式基线覆盖率提示 -->
          <div v-if="midsceneExecutionMode === 'regression' && midsceneParsedCases.length > 0" class="midscene-regression-summary">
            <span class="midscene-regression-summary-text">
              基线覆盖: {{ regressionBaselineMap.size }} / {{ midsceneParsedCases.length }} 条用例
            </span>
            <span v-if="regressionBaselineMap.size < midsceneParsedCases.length" class="midscene-regression-summary-hint">
              (无基线的用例将降级为混合模式，成功后自动保存基线)
            </span>
            <span v-else class="midscene-regression-summary-ok">
              全部就绪
            </span>
          </div>

          <!-- 用例列表 -->
          <div class="midscene-case-section">
            <div v-if="midsceneParsedCases.length === 0 && !quickCreateVisible" class="midscene-empty-guide">
              <div class="midscene-empty-title">暂无测试用例</div>
              <div class="midscene-empty-desc">请通过以下方式添加用例：</div>
              <button class="midscene-guide-btn" @click="quickCreateVisible = true; resetQuickCreateForm()">
                <PlusCircle :size="13" /> 快速创建用例
              </button>
              <button class="midscene-guide-btn" @click="goToStep('test_case')">
                <FileEdit :size="13" /> 批量编写用例
              </button>
              <button class="midscene-guide-btn" @click="toggleRightPanel('knowledge')">
                <Library :size="13" /> 从知识库加载
              </button>
              <div class="midscene-empty-hint">
                知识库：点击已保存的测试用例文档即可导入
              </div>
            </div>
            <!-- ★ 快速创建用例表单 -->
            <div v-if="midsceneParsedCases.length === 0 && quickCreateVisible" class="quick-create-panel">
              <div class="quick-create-header">
                <span class="quick-create-title"><PlusCircle :size="13" /> 快速创建测试用例</span>
                <button class="case-detail-edit-btn" @click="quickCreateVisible = false">取消</button>
              </div>
              <div class="quick-create-field">
                <label>用例名称 <span class="required">*</span></label>
                <input v-model="quickCreateForm.name" placeholder="如：登录功能测试" class="quick-create-input" />
              </div>
              <div class="quick-create-field">
                <label>场景描述</label>
                <input v-model="quickCreateForm.scenario" placeholder="如：验证用户可以正常登录（可选，不填则自动生成）" class="quick-create-input" />
              </div>
              <div class="quick-create-field">
                <label>操作步骤 <span class="quick-create-tip">具体步骤可提升混合模式执行效果</span></label>
                <div v-for="(s, si) in quickCreateForm.steps" :key="si" class="quick-create-list-row">
                  <span class="case-step-num">{{ si + 1 }}</span>
                  <input v-model="quickCreateForm.steps[si]" :placeholder="si === 0 ? '如：点击登录按钮' : '下一步操作...'" class="quick-create-input" />
                  <button class="case-step-action case-step-del" @click="removeQuickCreateStep(si)" v-tooltip="'删除'"><X :size="10" /></button>
                </div>
                <button class="case-step-add-btn" @click="addQuickCreateStep"><Plus :size="11" /> 添加步骤</button>
              </div>
              <div class="quick-create-field">
                <label>预期结果</label>
                <div v-for="(e, ei) in quickCreateForm.expectedResults" :key="ei" class="quick-create-list-row">
                  <input v-model="quickCreateForm.expectedResults[ei]" :placeholder="ei === 0 ? '如：页面跳转到首页' : '其他预期...'" class="quick-create-input" />
                  <button class="case-step-action case-step-del" @click="removeQuickCreateExpected(ei)" v-tooltip="'删除'"><X :size="10" /></button>
                </div>
                <button class="case-step-add-btn" @click="addQuickCreateExpected"><Plus :size="11" /> 添加预期结果</button>
              </div>
              <div class="quick-create-actions">
                <button class="midscene-guide-btn quick-create-submit" @click="submitQuickCreate"><Check :size="13" /> 创建并添加</button>
              </div>
              <div class="quick-create-mode-info">
                <Lightbulb :size="11" />
                <div>
                  <div><strong>自由模式</strong>：只需场景描述即可执行，不需要具体步骤</div>
                  <div><strong>混合模式</strong>：需要具体步骤（如"点击X"、"输入Y"），执行更可控</div>
                </div>
              </div>
            </div>
            <div v-for="tc in midsceneParsedCases" :key="tc.id"
                 class="midscene-case-item" :class="[getCaseResultClass(tc.id), { selected: midsceneSelectedCaseId === tc.id }]"
                 @click="midsceneSelectedCaseId = tc.id">
              <input type="checkbox" :checked="midsceneSelectedCases.has(tc.id)" @change.stop="toggleCaseSelection(tc.id)" :disabled="midsceneExecuting" />
              <div class="midscene-case-info">
                <span class="midscene-case-id">{{ tc.id }}</span>
                <span v-if="regressionBaselineMap.has(tc.id)" class="midscene-baseline-badge" v-tooltip="'已有回归基线'">R</span>
                <span class="midscene-case-name">{{ tc.name }}</span>
                <span v-if="tc.priority" class="midscene-case-priority" :class="tc.priority?.toLowerCase()">{{ tc.priority }}</span>
              </div>
              <div class="midscene-case-status">
                <span v-if="getCaseResult(tc.id)?.status === 'passed'" class="status-pass">PASS</span>
                <span v-else-if="getCaseResult(tc.id)?.status === 'failed'" class="status-fail">FAIL</span>
                <span v-else-if="getCaseResult(tc.id)?.status === 'running'" class="status-running">...</span>
                <span v-else-if="midsceneExecutionMode === 'regression' && !regressionBaselineMap.has(tc.id)" class="status-no-baseline" v-tooltip="'无基线，将降级为混合模式'">无基线</span>
              </div>
              <button class="midscene-btn-run" @click.stop="runOneCaseOnly(tc)" :disabled="midsceneExecuting"><Play :size="11" /></button>
            </div>
            <div v-if="midsceneParsedCases.length > 0" class="midscene-batch-bar">
              <button @click="selectAllCases" class="midscene-batch-btn">全选</button>
              <button @click="deselectAllCases" class="midscene-batch-btn">清除</button>
              <button class="midscene-batch-btn midscene-btn-primary" @click="runSelectedCases" :disabled="midsceneSelectedCases.size === 0 || midsceneExecuting">
                <Play :size="11" /> 执行 ({{ midsceneSelectedCases.size }})
              </button>
              <span v-if="midsceneExecuting" class="midscene-executing-label">{{ midsceneCurrentCase }}...</span>
            </div>
          </div>

          <!-- 执行时间线 -->
          <div v-if="midsceneTimeline.length > 0" class="midscene-timeline-section">
            <div class="midscene-timeline-header">执行时间线</div>
            <div class="midscene-timeline-list">
              <div v-for="card in midsceneTimeline" :key="card.id" class="timeline-card" :class="card.status">
                <div class="timeline-card-header">
                  <span class="timeline-card-type"
                        :style="{ color: (stepTypeMap[card.type] || stepTypeMap['aiAct']).color }">
                    {{ (stepTypeMap[card.type] || stepTypeMap['aiAct']).label }}
                  </span>
                  <span class="timeline-card-desc">{{ card.description }}</span>
                  <span v-if="card.durationMs" class="timeline-card-duration">{{ (card.durationMs / 1000).toFixed(1) }}s</span>
                  <span class="timeline-card-icon">
                    {{ card.status === 'success' ? 'PASS' : card.status === 'failed' ? 'FAIL' : card.status === 'running' ? '...' : '' }}
                  </span>
                </div>
                <img v-if="card.screenshot" :src="card.screenshot" class="timeline-card-screenshot" alt="screenshot" />
                <div v-if="card.error" class="timeline-card-error">{{ card.error }}</div>
              </div>
            </div>
          </div>

          <!-- 结果汇总 -->
          <div v-if="midsceneResults.length > 0" class="midscene-summary-bar">
            <span class="summary-passed">PASS {{ midscenePassedCount }}</span>
            <span class="summary-failed">FAIL {{ midsceneFailedCount }}</span>
            <span class="summary-total">/ {{ midsceneResults.length }}</span>
            <span v-if="midsceneTotalDuration" class="summary-duration">{{ midsceneTotalDuration }}s</span>
            <div style="margin-left:auto; display:flex; gap:4px;">
              <!-- 打开右侧结果面板 -->
              <button @click="rightPanelTab = 'midscene'; midsceneViewType = 'results'" class="midscene-btn-secondary" style="font-size:11px;" v-tooltip="'在右侧面板查看详细执行结果'">
                <BarChart3 :size="11" /> 详情
              </button>
              <!-- HTML 报告按钮 -->
              <button v-if="midsceneReportUrls.length > 0 || midsceneReportUrl" @click="openMidsceneHtmlReport" class="midscene-btn-primary" style="font-size:11px;">
                <ExternalLink :size="11" /> HTML报告
              </button>
            </div>
          </div>
        </div>

        <!-- ===== 正常聊天面板 (非 Midscene Step 5) ===== -->
        <!-- 聊天消息区（Phase 4: 使用 ChatMessage 组件） -->
      <div v-show="!(projectState.currentStep === 'auto_test' && uiEngine === 'midscene')" class="chat-container" ref="chatContainer">
        <template v-for="adaptedMsg in adaptedMessages" :key="adaptedMsg.id">
          <ChatMessage
            :message="adaptedMsg"
            @retry="handleMessageRetry(adaptedMsg)"
            @attachment-click="handleAttachmentClick"
            @ref-click="handleRefClick"
          />
          <!-- Phase 4: 撤回按钮（保留原有逻辑） -->
          <button
            v-if="canUndoMessage(adaptedMsg)"
            @click="getActionType(adaptedMsg) === 'testcase_edit'
              ? undoTestCaseEdit(getOriginalIndex(adaptedMsg))
              : undoPrdEdit(getOriginalIndex(adaptedMsg))"
            class="undo-btn"
            v-tooltip="'撤回此操作'"
          >
            <Undo2 :size="14" /> 撤回
          </button>
        </template>
        <div v-if="isProcessing" class="msg ai">
          <div class="typing-indicator">{{ statusText || 'AI 正在思考...' }}</div>
          <div class="progress-bar" v-if="progress > 0">
             <div :style="{width: progress + '%'}" class="progress-fill"></div>
          </div>
        </div>
      </div>

        <!-- 统一输入区（固定底部）- Phase 5: 使用 ChatInput 组件 -->
        <div class="unified-input-area">
          <ChatInput
            v-model="unifiedInput"
            :placeholder="unifiedInputPlaceholder"
            :disabled="isProcessing"
            :attachments="attachments"
            :available-docs="allRightDocsForRef"
            :active-role="userRole"
            :hints="currentRoleHints"
            @send="handleChatInputSend"
            @extract-page="startFullPageAnalysis"
            @show-extract-modal="showExtractModal = true"
            @add-attachment="handleAddAttachment"
            @remove-attachment="(id: string) => fileUpload.removeAttachment(id)"
            @quick-generate="handleQuickGenerateFromAttachment"
          />

          <!-- QA特有的步骤操作按钮 -->
          <div v-if="userRole === 'qa'" class="step-actions">
            <!-- 分析步骤 -->
            <template v-if="['setup', 'analyzing', 'content_review'].includes(projectState.currentStep)">
              <template v-if="!projectState.documents.prd">
                <!-- 无PRD时，显示提取按钮 -->
                <button @click="startFullPageAnalysis" class="btn-primary step-action-btn" :disabled="isProcessing">
                  <Camera :size="14" /> 提取当前PRD
                </button>
              </template>
              <template v-else-if="!hasGeneratedPRD">
                <button @click="startOptimizePRD" class="btn-primary step-action-btn" :disabled="isProcessing"><Sparkles :size="14" /> 优化需求文档</button>
              </template>
              <template v-else>
                <button @click="forwardToPRDReview" class="btn-secondary step-action-btn" :disabled="isProcessing">查看优化PRD <ChevronRight :size="14" /></button>
              </template>
            </template>
            <!-- PRD步骤 -->
            <template v-else-if="['optimizing', 'prd_review'].includes(projectState.currentStep)">
              <button @click="backToContentReview" class="btn-secondary step-action-btn" :disabled="isProcessing"><ChevronLeft :size="14" /> 返回分析</button>
              <button @click="regeneratePRD" class="btn-secondary step-action-btn" :disabled="isProcessing">重新优化</button>
              <button @click="proceedToTestPoints" class="btn-secondary step-action-btn" :disabled="isProcessing">生成测试点</button>
              <button @click="startGenerateTestCases" class="btn-primary step-action-btn" :disabled="isProcessing">直接生成用例</button>
            </template>
            <!-- 测试点步骤 -->
            <template v-else-if="projectState.currentStep === 'test_point'">
              <button @click="backToPRD" class="btn-secondary step-action-btn" :disabled="isProcessing"><ChevronLeft :size="14" /> 返回PRD</button>
              <button @click="proceedToTestCases" class="btn-primary step-action-btn" :disabled="isProcessing">确认并生成用例</button>
            </template>
            <!-- 测试用例步骤 -->
            <template v-else-if="projectState.currentStep === 'test_case'">
              <button @click="backToTestPoints" class="btn-secondary step-action-btn" :disabled="isProcessing"><ChevronLeft :size="14" /> 返回测试点</button>
              <button @click="runQualityEvaluation" class="btn-evaluate step-action-btn" :disabled="isProcessing || qualityLoading"><ShieldCheck :size="14" /> 质量评估</button>
              <button @click="exportResults" class="btn-success step-action-btn">导出结果</button>
              <button @click="enterAutoTest()" class="btn-primary step-action-btn">进入自动化测试</button>
            </template>
            <!-- 自动化测试步骤 — 仅传统引擎显示工具栏（Midscene 模式用全屏面板自带的 topbar） -->
            <template v-else-if="projectState.currentStep === 'auto_test' && uiEngine !== 'midscene'">
              <button @click="projectState.currentStep = 'test_case'" class="btn-secondary step-action-btn"><ChevronLeft :size="14" /> 返回</button>
              <button @click="switchUiEngine" class="btn-mode-toggle step-action-btn"><Zap :size="14" /> Midscene</button>
              <button @click="showScreenshots" class="btn-secondary step-action-btn"><ImageIcon :size="14" /> 截图</button>
              <button v-if="projectState.documents.uiPlan" @click="toggleUiDoc('plan')" class="btn-secondary step-action-btn"><ClipboardList :size="14" /> 计划</button>
              <button v-if="projectState.documents.uiReport" @click="toggleUiDoc('report')" class="btn-secondary step-action-btn"><BarChart3 :size="14" /> 报告</button>
            </template>
          </div>
          </div>
           </div>

      <!-- 可拖拽分隔条 -->
      <div class="panel-resizer" @mousedown="startResize"></div>

      <!-- 右侧面板：文档预览 -->
      <div class="right-panel" :style="{ flex: rightPanelFlex }">
        <!-- 文档列表侧边栏 -->
        <div class="doc-list-sidebar" v-if="showDocList">
          <div class="doc-list-header">
            <span class="doc-list-title"><Library :size="16" /> 文档列表</span>
            <button class="doc-list-close" @click="showDocList = false" v-tooltip="'关闭'"><X :size="14" /></button>
        </div>
          <div class="doc-list-items">
            <!-- QA角色的主文档 -->
            <template v-if="userRole === 'qa'">
              <div class="doc-list-item main-doc" :class="{ active: activeRightTab === 'main' && activeMainDocType === 'prd', 'is-url-main': !!urlDocs.find(d => d.isMainPrd) }" @click="activeRightTab = 'main'; activeMainDocType = 'prd'; switchToDocView()" @dblclick.stop="renameQaMainDocTitle('prd')">
                <span class="doc-icon"><component :is="urlDocs.find(d => d.isMainPrd) ? Star : FileText" :size="16" /></span>
                <div class="doc-info">
                  <div class="doc-title">{{ currentPrdTitle || '主需求文档' }}</div>
                  <div class="doc-meta">主PRD · {{ urlDocs.find(d => d.isMainPrd) ? 'URL文档' : '可编辑' }}</div>
                </div>
              </div>
              <div v-if="hasGeneratedPRD" class="doc-list-item optimized-doc" :class="{ active: activeRightTab === 'main' && activeMainDocType === 'optimizedPrd' }" @click="activeRightTab = 'main'; activeMainDocType = 'optimizedPrd'; switchToDocView()" @dblclick.stop="renameQaMainDocTitle('optimizedPrd')">
                <span class="doc-icon"><Sparkles :size="16" /></span>
                <div class="doc-info">
                  <div class="doc-title">{{ optimizedPrdTitle }}</div>
                  <div class="doc-meta">优化PRD · 可编辑</div>
                </div>
              </div>
              <div v-if="hasGeneratedTestPoints" class="doc-list-item testpoint-doc" :class="{ active: activeRightTab === 'main' && activeMainDocType === 'testPoints' }" @click="activeRightTab = 'main'; activeMainDocType = 'testPoints'; switchToDocView()" @dblclick.stop="renameQaMainDocTitle('testPoints')">
                <span class="doc-icon"><Target :size="16" /></span>
                <div class="doc-info">
                  <div class="doc-title">{{ testPointsTitle }}</div>
                  <div class="doc-meta">测试点 · 可编辑</div>
                </div>
              </div>
              <div v-if="hasGeneratedTestCases" class="doc-list-item testcase-doc" :class="{ active: activeRightTab === 'main' && activeMainDocType === 'testCases' }" @click="activeRightTab = 'main'; activeMainDocType = 'testCases'; switchToDocView()" @dblclick.stop="renameQaMainDocTitle('testCases')">
                <span class="doc-icon"><ClipboardList :size="16" /></span>
                <div class="doc-info">
                  <div class="doc-title">{{ testCasesTitle }}</div>
                  <div class="doc-meta">测试用例 · 可编辑</div>
                </div>
              </div>
            </template>
            <!-- PM/DEV角色的提取文档 -->
            <template v-else>
              <div v-for="(doc, idx) in chatOnlyDocuments" :key="doc.id" class="doc-list-item main-doc" :class="{ active: activeRightTab === 'chatDoc' && activeChatDocId === doc.id }" @click="activeRightTab = 'chatDoc'; activeChatDocId = doc.id; switchToDocView()" @dblclick.stop="renameChatDocTitle(doc.id)">
                <span class="doc-icon"><FileText :size="16" /></span>
                <div class="doc-info">
                  <div class="doc-title">{{ doc.title || `文档 ${idx + 1}` }}</div>
                  <div class="doc-meta">{{ doc.type }} · 可编辑</div>
                </div>
                <button class="doc-delete" @click.stop="removeChatOnlyDoc(doc.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
              </div>
            </template>
            
            <!-- URL 文档列表（所有角色可用：链接提取/提取当前页/输入框URL，QA角色排除已设为主PRD的） -->
            <template v-if="urlDocs.filter(d => userRole !== 'qa' || !d.isMainPrd).length > 0">
              <div class="doc-list-divider"><Link :size="14" /> URL 文档</div>
              <div v-for="doc in urlDocs.filter(d => userRole !== 'qa' || !d.isMainPrd)" :key="doc.id" class="doc-list-item url-doc" :class="{ active: activeRightTab === 'url' && activeUrlDocId === doc.id }" @click="doc.status === 'success' && (activeRightTab = 'url', activeUrlDocId = doc.id, switchToDocView())" @dblclick.stop="doc.status === 'success' && renameUrlDocTitle(doc.id)">
                <span class="doc-icon">
                  <Loader2 v-if="doc.status === 'loading'" :size="16" class="spinning" />
                  <XCircle v-else-if="doc.status === 'error'" :size="16" class="error-icon" />
                  <Link v-else :size="16" />
                </span>
                <div class="doc-info">
                  <div class="doc-title">{{ doc.title || 'URL文档' }}</div>
                  <div class="doc-meta">URL · 可编辑</div>
          </div>
                <!-- 仅 QA 角色可设为主PRD -->
                <button v-if="userRole === 'qa' && doc.status === 'success'" class="doc-set-main" @click.stop="setAsMainPrd(doc.id)" v-tooltip="'设为主PRD'"><Star :size="12" /></button>
                <button class="doc-delete" @click.stop="removeUrlDoc(doc.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
        </div>
            </template>
            
            <!-- 辅助PRD列表（通用） -->
            <div v-for="prd in additionalPrds" :key="prd.id" class="doc-list-item" :class="{ active: activeRightTab === 'additional' && activeAdditionalPrdId === prd.id, loading: prd.status === 'loading', error: prd.status === 'error' }" @click="prd.status === 'success' && (activeRightTab = 'additional', activeAdditionalPrdId = prd.id, switchToDocView())" @dblclick.stop="prd.status === 'success' && renameAdditionalPrdTitle(prd.id)">
              <span class="doc-icon">
                <Loader2 v-if="prd.status === 'loading'" :size="16" class="spinning" />
                <XCircle v-else-if="prd.status === 'error'" :size="16" class="error-icon" />
                <File v-else :size="16" />
              </span>
              <div class="doc-info">
                <div class="doc-title">{{ formatPrdTitle(prd, 22) }}</div>
                <div class="doc-meta">辅助PRD · {{ prd.status === 'success' ? '只读' : prd.status === 'loading' ? '加载中' : '失败' }}</div>
              </div>
              <button class="doc-delete" @click.stop="removeAdditionalPrd(prd.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
            </div>
            <!-- Figma文档列表 -->
            <div v-for="figma in figmaDocs" :key="figma.id" class="doc-list-item figma-doc" :class="{ active: activeRightTab === 'figma' && activeFigmaDocId === figma.id, loading: figma.status === 'loading', error: figma.status === 'error' }" @click="figma.status === 'success' && (activeRightTab = 'figma', activeFigmaDocId = figma.id, switchToDocView())" @dblclick.stop="figma.status === 'success' && renameFigmaTitle(figma.id)">
              <span class="doc-icon">
                <Loader2 v-if="figma.status === 'loading'" :size="16" class="spinning" />
                <XCircle v-else-if="figma.status === 'error'" :size="16" class="error-icon" />
                <Palette v-else :size="16" />
              </span>
              <div class="doc-info">
                <div class="doc-title">{{ formatPrdTitle(figma, 22) }}</div>
                <div class="doc-meta">Figma · {{ figma.status === 'success' ? '交互文档' : figma.status === 'loading' ? '解析中' : '失败' }}</div>
              </div>
              <button class="doc-delete" @click.stop="removeFigmaDoc(figma.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
        </div>

            <!-- 自定义文档列表 -->
            <div v-if="customDocs.length > 0" class="doc-list-divider"><FileEdit :size="14" /> 自定义文档</div>
            <div v-for="doc in customDocs" :key="doc.id" class="doc-list-item custom-doc" :class="{ active: activeRightTab === 'custom' && activeCustomDocId === doc.id }" @click="activeRightTab = 'custom'; activeCustomDocId = doc.id; switchToDocView()" @dblclick.stop="renameCustomDocTitle(doc.id)">
              <span class="doc-icon"><FileEdit :size="16" /></span>
              <div class="doc-info">
                <div class="doc-title">{{ doc.title || '自定义文档' }}</div>
                <div class="doc-meta">自定义 · 可编辑</div>
              </div>
              <button class="doc-delete" @click.stop="removeCustomDoc(doc.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
            </div>
          </div>
        </div>

        <!-- Tab栏导航（折叠展示） -->
        <div class="right-panel-tabs">
          <!-- 可见Tab -->
          <button 
            v-for="tab in visibleTabs" 
            :key="tab.key" 
            class="panel-tab"
            :class="[
              tab.type === 'url' ? 'url-tab' : '',
              tab.type === 'additional' ? 'additional-tab' : '',
              tab.type === 'figma' ? 'figma-tab' : '',
              tab.type === 'custom' ? 'custom-tab' : '',
              tab.mainDocType === 'optimizedPrd' ? 'optimized-tab' : '',
              tab.mainDocType === 'testPoints' ? 'testpoint-tab' : '',
              tab.mainDocType === 'testCases' ? 'testcase-tab' : '',
              tab.type === 'url' && urlDocs.find(d => d.id === tab.id)?.isMainPrd ? 'is-main' : '',
              { active: isTabActive(tab) }
            ]"
            @click="tab.onClick(); isTabOverflowOpen = false"
            @dblclick.stop="tab.onDblClick()"
          >
            {{ tab.label }}
          </button>
          
          <!-- 折叠菜单按钮 -->
          <div v-if="overflowTabs.length > 0" class="tab-overflow-wrapper">
            <button 
              class="panel-tab overflow-tab" 
              :class="{ active: isTabOverflowOpen }"
              @click="isTabOverflowOpen = !isTabOverflowOpen"
            >
              更多({{ overflowTabs.length }})
            </button>
            <!-- 折叠菜单 -->
            <div v-if="isTabOverflowOpen" class="tab-overflow-menu">
              <button 
                v-for="tab in overflowTabs" 
                :key="tab.key" 
                class="overflow-tab-item"
                :class="[
                  tab.type === 'url' ? 'url-tab' : '',
                  tab.type === 'additional' ? 'additional-tab' : '',
                  tab.type === 'figma' ? 'figma-tab' : '',
                  tab.type === 'custom' ? 'custom-tab' : '',
                  tab.mainDocType === 'optimizedPrd' ? 'optimized-tab' : '',
                  tab.mainDocType === 'testPoints' ? 'testpoint-tab' : '',
                  tab.mainDocType === 'testCases' ? 'testcase-tab' : '',
                  tab.type === 'url' && urlDocs.find(d => d.id === tab.id)?.isMainPrd ? 'is-main' : '',
                  { active: isTabActive(tab) }
                ]"
                @click="tab.onClick(); isTabOverflowOpen = false"
                @dblclick.stop="tab.onDblClick(); isTabOverflowOpen = false"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>
          
          <!-- 右侧控制按钮 -->
          <div class="tab-controls">
            <NeoTooltip v-if="hasAnyDocument" :text="showDocList ? '隐藏列表' : '显示列表'">
              <button class="tab-control-btn" @click="showDocList = !showDocList">
                <Menu :size="16" />
              </button>
            </NeoTooltip>
            <!-- Phase 4: 知识库入口 -->
            <NeoTooltip text="知识库">
              <button class="tab-control-btn" :class="{ active: rightPanelTab === 'knowledge' }" @click="toggleRightPanel('knowledge')">
                <Library :size="16" />
              </button>
            </NeoTooltip>
            <!-- P1: 历史记录入口 -->
            <NeoTooltip text="历史记录">
              <button class="tab-control-btn" :class="{ active: rightPanelTab === 'history' }" @click="toggleRightPanel('history')">
                <ScrollText :size="16" />
              </button>
            </NeoTooltip>
            <!-- 质量评估入口 -->
            <NeoTooltip text="质量评估">
              <button class="tab-control-btn" :class="{ active: rightPanelTab === 'quality' }" @click="toggleRightPanel('quality')">
                <ShieldCheck :size="16" />
              </button>
            </NeoTooltip>
            <!-- Midscene 报告入口 -->
            <NeoTooltip v-if="uiEngine === 'midscene'" text="Midscene 报告">
              <button class="tab-control-btn" :class="{ active: rightPanelTab === 'midscene' }" @click="toggleRightPanel('midscene')">
                <Zap :size="16" />
              </button>
            </NeoTooltip>
            <!-- Phase 4: 批量上传入口 -->
            <NeoTooltip text="批量上传">
              <button class="tab-control-btn add" @click="showBatchUploader = true">
                <Upload :size="16" />
              </button>
            </NeoTooltip>
            <!-- 新建自定义文档 -->
            <NeoTooltip text="新建自定义文档">
              <button class="tab-control-btn add" @click="createCustomDoc">
                <Plus :size="16" />
              </button>
            </NeoTooltip>
            <NeoTooltip v-if="activeRightTab !== 'main' && activeRightTab !== 'chatDoc'" text="关闭当前Tab">
              <button class="tab-control-btn close" @click="closeCurrentTab">
                <X :size="16" />
              </button>
            </NeoTooltip>
          </div>
        </div>

        <!-- Phase 4: 知识库面板（覆盖编辑器） -->
        <KnowledgeBasePanel
          ref="knowledgePanelRef"
          v-if="rightPanelTab === 'knowledge'"
          :session-id="projectState.assets.sessionId"
          @upload="showBatchUploader = true"
          @select="handleKnowledgeSelect"
          @add-to-chat="handleKnowledgeAddToChat"
          class="knowledge-panel-overlay"
        />

        <!-- P1: 历史记录面板（覆盖编辑器） -->
        <HistoryPanel
          v-if="rightPanelTab === 'history'"
          :session-id="projectState.assets.sessionId"
          @use="handleHistoryUse"
          class="history-panel-overlay"
        />

        <!-- 质量评估面板（覆盖编辑器） -->
        <QualityReportPanel
          v-if="rightPanelTab === 'quality'"
          :report="qualityReport"
          :loading="qualityLoading"
          :error="qualityError"
          @retry="runQualityEvaluation"
          @supplement="handleSupplementFromEvaluation"
          class="quality-panel-overlay"
        />

        <!-- Midscene 面板（与知识库等面板同级，不覆盖导航栏） -->
        <div v-if="rightPanelTab === 'midscene'" class="midscene-report-overlay">
          <div class="midscene-report-header">
            <div class="midscene-report-tabs">
              <button :class="{ active: midsceneViewType === 'cases' }" @click="midsceneViewType = 'cases'">用例详情</button>
              <button :class="{ active: midsceneViewType === 'results' }" @click="midsceneViewType = 'results'">执行结果</button>
            </div>
          </div>
          <div class="midscene-report-content">
            <!-- 用例详情 (选中的用例) -->
            <div v-if="midsceneViewType === 'cases'" class="midscene-report-body">
              <template v-if="selectedCaseDetail">
                <div class="case-detail-card">
                  <div class="case-detail-id">{{ selectedCaseDetail.id }} <span v-if="selectedCaseDetail.priority" class="midscene-case-priority" :class="selectedCaseDetail.priority?.toLowerCase()">{{ selectedCaseDetail.priority }}</span></div>
                  <div class="case-detail-name">{{ selectedCaseDetail.name }}</div>
                  <div v-if="selectedCaseDetail.preconditions" class="case-detail-section">
                    <div class="case-detail-label">前置条件</div>
                    <div class="case-detail-value">{{ selectedCaseDetail.preconditions }}</div>
                  </div>
                  <div class="case-detail-section">
                    <div class="case-detail-label">操作场景</div>
                    <div class="case-detail-value">{{ selectedCaseDetail.scenario }}</div>
                  </div>

                  <!-- ★ 操作步骤（可内联编辑） -->
                  <div class="case-detail-section">
                    <div class="case-detail-label" style="display:flex;align-items:center;justify-content:space-between;">
                      <span>操作步骤</span>
                      <button v-if="!editingCaseSteps || editingCaseId !== selectedCaseDetail.id"
                              class="case-detail-edit-btn" @click="startEditCaseSteps" v-tooltip="'编辑步骤'">
                        <Pencil :size="11" /> 编辑
                      </button>
                      <div v-else style="display:flex;gap:4px;">
                        <button class="case-detail-edit-btn case-detail-save-btn" @click="saveCaseStepsEdit">
                          <Save :size="11" /> 保存
                        </button>
                        <button class="case-detail-edit-btn" @click="cancelEditCaseSteps">取消</button>
                      </div>
                    </div>
                    <!-- 编辑模式 -->
                    <div v-if="editingCaseSteps && editingCaseId === selectedCaseDetail.id" class="case-steps-editor">
                      <div v-for="(step, si) in editingStepsBuffer" :key="si" class="case-step-row">
                        <span class="case-step-num">{{ si + 1 }}</span>
                        <input class="case-step-input" v-model="editingStepsBuffer[si]"
                               :placeholder="'步骤描述（如：点击登录按钮、在搜索框输入hello）'" />
                        <span class="step-type-badge"
                              :style="{ background: inferStepType(editingStepsBuffer[si]).color + '18', color: inferStepType(editingStepsBuffer[si]).color, borderColor: inferStepType(editingStepsBuffer[si]).color + '40' }"
                              :title="inferStepType(editingStepsBuffer[si]).tip">
                          {{ inferStepType(editingStepsBuffer[si]).label }}
                        </span>
                        <button class="case-step-action" @click="moveEditingStepUp(si)" :disabled="si === 0" v-tooltip="'上移'"><ArrowUp :size="10" /></button>
                        <button class="case-step-action" @click="moveEditingStepDown(si)" :disabled="si === editingStepsBuffer.length - 1" v-tooltip="'下移'"><ArrowDown :size="10" /></button>
                        <button class="case-step-action case-step-del" @click="removeEditingStep(si)" v-tooltip="'删除'"><X :size="10" /></button>
                      </div>
                      <button class="case-step-add-btn" @click="addEditingStep"><Plus :size="11" /> 添加步骤</button>
                      <div class="case-steps-hint">
                        <Lightbulb :size="10" /> 标记为<span style="color:#10b981;font-weight:600;">绿色/蓝色</span>的步骤会精准执行（快），
                        <span style="color:#ef4444;font-weight:600;">红色 AI执行</span>的步骤会交给 AI 自由理解（慢）
                      </div>
                      <div class="case-steps-hint" style="margin-top:2px;">
                        💡 优化提示：将 <span style="color:#ef4444;">"AI执行"</span> 改为明确操作，如
                        <code>点击XXX</code> <code>在XXX中输入YYY</code> <code>输入YYY</code>
                      </div>
                    </div>
                    <!-- 只读模式 -->
                    <div v-else>
                      <div v-if="selectedCaseDetail.steps?.length" class="case-steps-list">
                        <div v-for="(s, si) in selectedCaseDetail.steps" :key="si" class="case-step-item">
                          <span class="case-step-num">{{ si + 1 }}</span>
                          <span>{{ s }}</span>
                          <span class="step-type-badge step-type-badge-ro"
                                :style="{ background: inferStepType(s).color + '18', color: inferStepType(s).color, borderColor: inferStepType(s).color + '40' }"
                                :title="inferStepType(s).tip">
                            {{ inferStepType(s).label }}
                          </span>
                        </div>
                      </div>
                      <div v-else class="case-steps-empty">
                        暂无步骤 — 自由模式可直接执行场景描述，混合模式建议添加具体步骤
                      </div>
                    </div>
                  </div>

                  <div v-if="selectedCaseDetail.expectedResults?.length" class="case-detail-section">
                    <div class="case-detail-label">预期结果</div>
                    <div v-for="(er, i) in selectedCaseDetail.expectedResults" :key="i" class="case-detail-assertion">
                      <span class="assertion-status">{{ getAssertionStatus(selectedCaseDetail.id, i) }}</span>
                      {{ er }}
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="midscene-empty">在左侧选中一个测试用例查看详情</div>
            </div>
            <!-- 执行结果 -->
            <div v-else class="midscene-report-body">
              <div v-if="midsceneResults.length > 0">
                <div v-for="r in midsceneResults" :key="r.testcaseId" class="midscene-result-card" :class="r.status">
                  <div class="midscene-result-header">
                    <span class="midscene-result-icon">{{ r.status === 'passed' ? 'PASS' : r.status === 'failed' ? 'FAIL' : r.status === 'running' ? '...' : 'ERR' }}</span>
                    <span class="midscene-result-name">{{ r.testcaseName }}</span>
                    <span v-if="r.durationMs" class="midscene-result-duration">{{ (r.durationMs / 1000).toFixed(1) }}s</span>
                    <button v-if="r.reportUrl" class="midscene-result-report-btn" @click="openReportByUrl(r.reportUrl!)" v-tooltip="'查看该用例的 HTML 报告'">
                      <ExternalLink :size="11" /> 报告
                    </button>
                  </div>
                  <div v-if="r.assertions?.length" class="midscene-assertions">
                    <div v-for="(a, i) in r.assertions" :key="i" class="midscene-assertion" :class="{ pass: a.success, fail: !a.success }">
                      {{ a.success ? 'PASS' : 'FAIL' }} {{ a.expected }}
                      <span v-if="a.reason" class="midscene-assertion-reason">- {{ a.reason }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="midscene-empty">暂无执行结果</div>
            </div>
          </div>
          <div v-if="midsceneReportUrls.length > 0 || midsceneReportUrl" class="midscene-report-footer">
            <!-- 多份报告时显示列表 -->
            <template v-if="midsceneReportUrls.length > 1">
              <div class="midscene-report-list">
                <span class="midscene-report-list-label">HTML 可视化报告 ({{ midsceneReportUrls.length }})：</span>
                <div v-for="(rpt, i) in midsceneReportUrls" :key="i" class="midscene-report-list-item">
                  <button class="midscene-btn-report-link" @click="openReportByUrl(rpt.url)" v-tooltip="rpt.testcaseName">
                    <ExternalLink :size="11" /> {{ rpt.testcaseName }}
                  </button>
                </div>
              </div>
              <button class="midscene-btn-primary" @click="openAllReports" style="margin-top:6px">
                <ExternalLink :size="14" /> 打开全部报告
              </button>
            </template>
            <!-- 单份报告 -->
            <template v-else>
              <button class="midscene-btn-primary" @click="openMidsceneHtmlReport">
                <ExternalLink :size="14" /> HTML 可视化报告
              </button>
            </template>
          </div>
        </div>

        <!-- 文档内容区域 -->
        <div v-show="rightPanelTab === 'docs'" class="editor-container">
          <div class="editor-header">
            <span class="editor-header-title">{{ currentEditorTitle }}</span>
            <div class="editor-header-actions">
              <!-- 保存按钮（所有可编辑文档在编辑模式且有变化时显示） -->
              <button
                v-if="isCurrentDocDirty"
                class="btn-save"
                @click="saveCurrentDocument"
                :disabled="isSavingDoc"
                v-tooltip="isSavingDoc ? '保存中...' : '保存文档到知识库'"
              >
                {{ isSavingDoc ? '💾...' : '💾 保存' }}
              </button>
              <!-- 插入图片按钮（仅编辑模式显示） -->
              <button
                v-if="viewMode === 'edit'"
                class="btn-upload-img"
                @click="triggerEditorImageUpload"
                :disabled="isUploadingEditorImage"
                v-tooltip="'上传图片到文档（也可直接粘贴图片）'"
              >
                {{ isUploadingEditorImage ? '上传中...' : '📷 插入图片' }}
              </button>
              <input
                ref="editorImageInputRef"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleEditorImageFileSelect"
              />
              <button class="btn-toggle" @click="viewMode = viewMode === 'edit' ? 'preview' : 'edit'" v-tooltip="viewMode === 'edit' ? '预览' : '编辑'">
                {{ viewMode === 'edit' ? '预览' : '编辑' }}
              </button>
            </div>
          </div>

          <!-- QA角色的主文档内容（有内容时显示，或在测试用例步骤允许手动输入） -->
          <template v-if="userRole === 'qa' && activeRightTab === 'main' && (hasAnyMainDoc || projectState.currentStep === 'test_case')">
            <!-- ★ 手动编写用例引导面板 -->
            <div v-if="manualGuideVisible && projectState.currentStep === 'test_case' && !projectState.documents.testCases" class="manual-guide-overlay">
              <div class="manual-guide-card">
                <div class="manual-guide-header">
                  <BookOpen :size="16" />
                  <span>编写测试用例</span>
                  <button class="case-detail-edit-btn" @click="manualGuideVisible = false" style="margin-left:auto;">直接编辑</button>
                </div>

                <div class="manual-guide-section">
                  <div class="manual-guide-label">选择格式模板</div>
                  <div class="manual-guide-format-btns">
                    <button class="manual-guide-format-btn" @click="insertTestCaseTemplate('yaml')">
                      <span class="format-icon">Y</span>
                      <span>YAML 格式</span>
                      <span class="format-desc">推荐，结构清晰</span>
                    </button>
                    <button class="manual-guide-format-btn" @click="insertTestCaseTemplate('table')">
                      <span class="format-icon">T</span>
                      <span>表格格式</span>
                      <span class="format-desc">Markdown 表格</span>
                    </button>
                  </div>
                </div>

                <div class="manual-guide-section">
                  <div class="manual-guide-label"><Lightbulb :size="12" /> 编写规范</div>
                  <div class="manual-guide-rules">
                    <div class="guide-rule">
                      <div class="guide-rule-title">必填字段</div>
                      <div class="guide-rule-desc"><code>name</code> 用例名称、<code>steps</code> 操作步骤 或 <code>scenario</code> 场景描述</div>
                    </div>
                    <div class="guide-rule">
                      <div class="guide-rule-title">steps 字段（核心）</div>
                      <div class="guide-rule-desc">每一步应包含具体的操作动词和目标元素</div>
                      <div class="guide-examples">
                        <div class="guide-example good">
                          <Check :size="10" /> <code>点击登录按钮</code>、<code>在用户名输入框中输入admin</code>
                        </div>
                        <div class="guide-example bad">
                          <X :size="10" /> <code>通过文本输入框提交数学问题</code>（太模糊，执行效果差）
                        </div>
                      </div>
                    </div>
                    <div class="guide-rule">
                      <div class="guide-rule-title">执行模式与 steps 的关系</div>
                      <div class="guide-mode-table">
                        <div class="guide-mode-row"><span class="guide-mode-name">自由模式</span><span>只需 scenario 即可，AI 自行规划</span></div>
                        <div class="guide-mode-row"><span class="guide-mode-name">混合模式</span><span>需要具体 steps，逐步执行更可控</span></div>
                        <div class="guide-mode-row"><span class="guide-mode-name">回归模式</span><span>基线自动生成，无需手写</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <textarea 
              v-show="viewMode === 'edit'"
              v-model="activeMainDocContent" 
              class="markdown-editor"
              :placeholder="editorPlaceholder"
            ></textarea>
            <!-- UI自动化步骤（auto_test）：报告/计划始终使用 Markdown 渲染，不走思维导图 -->
            <div 
              v-show="viewMode === 'preview' && isAutoTestStep"
              class="markdown-preview"
              v-html="renderMarkdown(activeMainDocContent)"
            ></div>
            <!-- PRD内容使用 Markdown 预览（非 auto_test 步骤，且不是测试点/测试用例） -->
            <div 
              v-show="viewMode === 'preview' && !isAutoTestStep && !['testPoints', 'testCases'].includes(activeMainDocType)"
              class="markdown-preview"
              v-html="renderMarkdown(activeMainDocContent)"
            ></div>
            <!-- 测试点使用思维导图预览（非 auto_test 步骤） -->
            <MindMapPreview
              v-if="viewMode === 'preview' && !isAutoTestStep && activeMainDocType === 'testPoints'"
              :content="activeMainDocContent"
              type="test_point"
              class="mindmap-wrapper"
            />
            <!-- 测试用例根据输出格式选择渲染方式（非 auto_test 步骤） -->
            <MindMapPreview
              v-if="viewMode === 'preview' && !isAutoTestStep && activeMainDocType === 'testCases' && testCaseOutputFormat === 'xmind'"
              :content="activeMainDocContent"
              type="test_case"
              class="mindmap-wrapper"
            />
            <!-- 表格或YAML格式使用Markdown渲染（非 auto_test 步骤） -->
            <div
              v-if="viewMode === 'preview' && !isAutoTestStep && activeMainDocType === 'testCases' && testCaseOutputFormat !== 'xmind'"
              class="markdown-preview"
              v-html="renderMarkdown(activeMainDocContent)"
            />
          </template>
          
          <!-- PM/DEV：提取文档内容 -->
          <template v-else-if="activeRightTab === 'chatDoc' && activeChatDocId">
            <textarea 
              v-show="viewMode === 'edit'"
              v-model="chatOnlyActiveDocContent" 
              class="markdown-editor"
              placeholder="提取的内容将显示在这里..."
            ></textarea>
            <div 
              v-show="viewMode === 'preview'"
              class="markdown-preview"
              v-html="renderMarkdown(chatOnlyActiveDocContent)"
            ></div>
          </template>
          
          <!-- URL 文档内容 -->
          <template v-else-if="activeRightTab === 'url' && activeUrlDocId">
            <textarea 
              v-show="viewMode === 'edit'"
              v-model="urlDocs.find(d => d.id === activeUrlDocId)!.content"
              class="markdown-editor"
              placeholder="URL文档内容..."
            ></textarea>
            <div 
              v-show="viewMode === 'preview'"
              class="markdown-preview"
              v-html="renderMarkdown(urlDocs.find(d => d.id === activeUrlDocId)?.content || '')"
            ></div>
          </template>
          
          <!-- 辅助PRD内容 -->
          <template v-else-if="activeRightTab === 'additional'">
            <textarea 
              v-show="viewMode === 'edit'"
              v-model="additionalPrds.find(p => p.id === activeAdditionalPrdId)!.content"
              class="markdown-editor"
              placeholder="辅助PRD内容..."
            ></textarea>
            <div 
              v-show="viewMode === 'preview'"
              class="markdown-preview"
              v-html="renderMarkdown(additionalPrds.find(p => p.id === activeAdditionalPrdId)?.content || '')"
            ></div>
          </template>
          
          <!-- Figma内容 -->
          <template v-else-if="activeRightTab === 'figma'">
            <textarea 
              v-show="viewMode === 'edit'"
              v-model="figmaDocs.find(f => f.id === activeFigmaDocId)!.content"
              class="markdown-editor"
              placeholder="Figma交互文档内容..."
            ></textarea>
            <div 
              v-show="viewMode === 'preview'"
              class="markdown-preview"
              v-html="renderMarkdown(figmaDocs.find(f => f.id === activeFigmaDocId)?.content || '')"
            ></div>
          </template>

          <!-- 自定义文档内容 -->
          <template v-else-if="activeRightTab === 'custom'">
            <textarea 
              v-show="viewMode === 'edit'"
              v-model="customActiveDocContent"
              class="markdown-editor"
              placeholder="自定义文档内容..."
            ></textarea>
            <div 
              v-show="viewMode === 'preview'"
              class="markdown-preview"
              v-html="renderMarkdown(customActiveDocContent)"
            ></div>
          </template>
          
          <!-- 空状态 -->
          <template v-else>
            <div class="empty-state">
              <div class="empty-state-icon"><FileText :size="48" /></div>
              <div class="empty-state-text">等待开始</div>
              <div class="empty-state-hint">使用左侧输入框开始分析</div>
          </div>
          </template>
        </div>
      </div>
        </div>

    <!-- Phase 4: QA 工作流进度条 -->
    <WorkflowProgress
      v-if="userRole === 'qa' && projectState.currentStep"
      :current-step="qaWorkflowStepIndex"
      :task-progress="progress"
      :task-label="statusText"
      :is-processing="isProcessing"
      @step-click="handleWorkflowStepClick"
    />

    <!-- Phase 4: 批量上传弹窗 -->
    <BatchUploader
      v-if="showBatchUploader"
      :session-id="projectState.assets.sessionId"
      @close="showBatchUploader = false"
      @uploaded="handleBatchUploaded"
    />

    <!-- 参考确认弹窗（增强：当无参考和引用时弹出，可选择tab列表内容） -->
    <div v-if="showReferenceConfirmModal" class="assist-modal-overlay" @click.self="showReferenceConfirmModal = false"></div>
    <div v-if="showReferenceConfirmModal" class="reference-confirm-modal">
      <div class="confirm-modal-header">
        <span class="confirm-modal-icon"><Paperclip :size="20" /></span>
        <span class="confirm-modal-title">{{ referenceConfirmAction === 'optimize' ? '优化需求文档' : '生成测试用例' }}</span>
      </div>
      <div class="confirm-modal-body">
        <p>是否需要添加辅助参考资料？</p>
        <p class="confirm-hint">添加辅助PRD或Figma设计可以提高{{ referenceConfirmAction === 'optimize' ? '优化' : '生成' }}质量</p>

        <!-- 当无任何"参考/引用"时：允许从右侧 Tab 文档中勾选引用 -->
        <div class="confirm-refpick" v-if="shouldShowRefPickInConfirm">
          <div class="confirm-refpick-title"><ClipboardList :size="16" /> 从右侧文档列表选择引用（可多选）</div>
          <div class="confirm-refpick-list">
            <label v-for="doc in confirmPickDocs" :key="doc.id" class="confirm-refpick-item">
              <input type="checkbox" :value="doc.id" v-model="confirmPickedDocIds" />
              <span class="confirm-refpick-name">{{ doc.title }}</span>
              <span class="confirm-refpick-tag">{{ doc.kind }}</span>
            </label>
            <div v-if="confirmPickDocs.length === 0" class="confirm-refpick-empty">暂无可选文档</div>
          </div>
        </div>
      </div>
      <div class="confirm-modal-actions">
        <button v-if="shouldShowRefPickInConfirm && confirmPickedDocIds.length > 0" @click="confirmUsePickedDocs" class="btn-primary confirm-btn">
          <CheckCircle :size="14" /> 引用并继续
        </button>
        <button @click="openReferencePanel" class="btn-primary confirm-btn">
          <Paperclip :size="14" /> 添加参考
        </button>
        <button @click="skipReference" class="btn-secondary confirm-btn">
          <SkipForward :size="14" /> 跳过
        </button>
      </div>
    </div>
    
    <!-- 统一提取弹窗（主PRD / 辅助PRD / Figma / URL 四区） -->
    <div v-if="showExtractModal" class="assist-modal-overlay" @click.self="showExtractModal = false"></div>
    <div v-if="showExtractModal" class="extract-modal">
      <div class="extract-modal-header">
        <span><Library :size="16" /> 提取文档</span>
        <button class="assist-panel-close" @click="showExtractModal = false" v-tooltip="'关闭'"><X :size="16" /></button>
      </div>
      
      <div class="extract-modal-body">
        <!-- 主PRD区域（与文档列表结构一致） -->
        <div class="extract-section main-prd-section" v-if="userRole === 'qa'">
          <div class="section-label"><Star :size="14" /> 主PRD</div>
          <div v-if="urlDocs.find(d => d.isMainPrd)" class="extract-item is-main" @dblclick="renameQaMainDocTitle('prd')">
            <span class="extract-status success"><Star :size="14" /></span>
            <span class="extract-url">{{ currentPrdTitle || '主需求文档' }}</span>
            <span class="extract-tag">URL文档</span>
          </div>
          <div v-else-if="projectState.documents.prd" class="extract-item is-main" @dblclick="renameQaMainDocTitle('prd')">
            <span class="extract-status success"><FileText :size="14" /></span>
            <span class="extract-url">{{ currentPrdTitle || '主需求文档' }}</span>
            <span class="extract-tag">可编辑</span>
          </div>
          <div v-else class="extract-empty">暂无主PRD，请从下方URL列表添加</div>
        </div>
        
        <div class="extract-divider" v-if="userRole === 'qa'"></div>
        
        <!-- 辅助PRD区域 -->
        <div class="extract-section">
          <div class="section-label"><File :size="14" /> 辅助PRD</div>
          <div v-for="prd in additionalPrds" :key="prd.id" class="extract-item" @dblclick="prd.status === 'success' && renameAdditionalPrdTitle(prd.id)">
            <span class="extract-status" :class="prd.status">
              <Loader2 v-if="prd.status === 'loading'" :size="14" class="spinning" />
              <Check v-else-if="prd.status === 'success'" :size="14" />
              <XCircle v-else :size="14" />
            </span>
            <span class="extract-url">{{ prd.title || prd.url.slice(0, 30) }}</span>
            <button class="extract-remove" @click="removeAdditionalPrd(prd.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
          </div>
          <div class="extract-input-row">
              <input 
              v-model="newPrdUrl"
              type="text"
              placeholder="输入PRD链接..."
                class="input-field" 
                style="flex:1;" 
              @keydown.enter="addAdditionalPrd"
            />
            <button class="btn-add-prd" @click="addAdditionalPrd" :disabled="!newPrdUrl.trim()">+</button>
            </div>
          </div>

        <div class="extract-divider"></div>
        
        <!-- Figma区域 -->
        <div class="extract-section">
          <div class="section-label"><Palette :size="14" /> Figma</div>
          <div v-for="figma in figmaDocs" :key="figma.id" class="extract-item" @dblclick="figma.status === 'success' && renameFigmaTitle(figma.id)">
            <span class="extract-status" :class="figma.status">
              <Loader2 v-if="figma.status === 'loading'" :size="14" class="spinning" />
              <Check v-else-if="figma.status === 'success'" :size="14" />
              <XCircle v-else :size="14" />
            </span>
            <span class="extract-url">{{ figma.title || figma.url.slice(0, 30) }}</span>
            <button class="extract-remove" @click="removeFigmaDoc(figma.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
          </div>
          <div class="extract-input-row">
            <input 
              v-model="newFigmaUrl"
              type="text"
              placeholder="输入Figma链接..."
              class="input-field"
              style="flex:1;"
              @keydown.enter="addFigmaDoc"
            />
            <button class="btn-add-prd" @click="addFigmaDoc" :disabled="!newFigmaUrl.trim()">+</button>
          </div>
        </div>

        <div class="extract-divider"></div>
        
        <!-- URL区域（所有角色：QA角色排除已设为主PRD的） -->
        <div class="extract-section">
          <div class="section-label"><Link :size="14" /> URL</div>
          <div v-for="doc in urlDocs.filter(d => userRole !== 'qa' || !d.isMainPrd)" :key="doc.id" class="extract-item" @dblclick="doc.status === 'success' && renameUrlDocTitle(doc.id)">
            <span class="extract-status" :class="doc.status">
              <Loader2 v-if="doc.status === 'loading'" :size="14" class="spinning" />
              <Check v-else-if="doc.status === 'success'" :size="14" />
              <XCircle v-else :size="14" />
            </span>
            <span class="extract-url">{{ doc.title || doc.url.slice(0, 30) }}</span>
            <!-- 仅 QA 角色可设为主PRD -->
            <button v-if="userRole === 'qa' && doc.status === 'success'" class="extract-set-main" @click="setAsMainPrd(doc.id)" v-tooltip="'设为主PRD'"><Star :size="12" /></button>
            <button class="extract-remove" @click="removeUrlDoc(doc.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
                </div>
          <div class="extract-input-row">
                    <input 
              v-model="extractModalUrlInput"
              type="text"
              placeholder="输入URL链接..."
                        class="input-field" 
                        style="flex:1;" 
              @keydown.enter="extractModalUrl"
                        :disabled="isProcessing" 
                    />
            <button class="btn-add-prd" @click="extractModalUrl" :disabled="!extractModalUrlInput.trim() || isProcessing">+</button>
          </div>
        </div>
      </div>
      
      <div class="extract-modal-footer">
        <button @click="showExtractModal = false" class="btn-primary" style="flex:1;">
          确认
        </button>
        <button @click="showExtractModal = false" class="btn-secondary" style="flex:1;">
          跳过
                    </button>
                </div>
                </div>
    
    <!-- 辅助优化弹窗（通用） -->
    <div v-if="showAdditionalPrdPanel || showFigmaPanel" class="assist-modal-overlay" @click.self="showAdditionalPrdPanel = false; showFigmaPanel = false"></div>
    <div v-if="showAdditionalPrdPanel || showFigmaPanel" class="assist-optimize-panel">
      <div class="assist-panel-title">
        <span>📎 添加参考资料</span>
        <button class="assist-panel-close" @click="showAdditionalPrdPanel = false; showFigmaPanel = false">×</button>
                    </div>
      
      <!-- 辅助PRD区域 -->
      <div v-if="showAdditionalPrdPanel" class="assist-prd-section">
        <div class="section-label"><FileText :size="14" /> 辅助PRD链接</div>
        <div v-for="prd in additionalPrds" :key="prd.id" class="prd-item">
          <div class="prd-item-content">
            <span class="prd-status" :class="prd.status">
              <Loader2 v-if="prd.status === 'loading'" :size="14" class="spinning" />
              <Check v-else-if="prd.status === 'success'" :size="14" />
              <XCircle v-else :size="14" />
            </span>
            <span class="prd-url">{{ prd.url.substring(0, 40) }}{{ prd.url.length > 40 ? '...' : '' }}</span>
                </div>
          <button class="prd-remove" @click="removeAdditionalPrd(prd.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
                    </div>
        <div class="add-prd-row">
          <input 
            v-model="newPrdUrl"
            type="text"
            placeholder="输入PRD链接..."
            class="input-field" 
            style="flex:1;" 
            @keydown.enter="addAdditionalPrd"
          />
          <button class="btn-add-prd" @click="addAdditionalPrd" :disabled="!newPrdUrl.trim()">+</button>
                </div>
            </div>
            
      <!-- Figma 区域 -->
      <div v-if="showFigmaPanel" class="assist-figma-section">
        <div class="section-label"><Palette :size="14" /> Figma 设计链接</div>
        <div v-for="figma in figmaDocs" :key="figma.id" class="prd-item">
          <div class="prd-item-content">
            <span class="prd-status" :class="figma.status">
              <Loader2 v-if="figma.status === 'loading'" :size="14" class="spinning" />
              <Check v-else-if="figma.status === 'success'" :size="14" />
              <XCircle v-else :size="14" />
            </span>
            <span class="prd-url">{{ figma.url.substring(0, 40) }}{{ figma.url.length > 40 ? '...' : '' }}</span>
          </div>
          <button class="prd-remove" @click="removeFigmaDoc(figma.id)" v-tooltip="'删除'"><Trash2 :size="12" /></button>
        </div>
        <div class="add-prd-row">
          <input 
            v-model="newFigmaUrl"
            type="text"
            placeholder="输入Figma链接..."
            class="input-field"
            style="flex:1;"
            @keydown.enter="addFigmaDoc"
          />
          <button class="btn-add-prd" @click="addFigmaDoc" :disabled="!newFigmaUrl.trim()">+</button>
        </div>
            </div>
            
      <div class="assist-actions" style="margin-top: 12px;">
        <button @click="showAdditionalPrdPanel = false; showFigmaPanel = false" class="btn-secondary" style="flex:1;">
          完成
                </button>
            </div>
        </div>
        
    <!-- 可视化测试面板（FlowEditor） -->
    <div v-if="showFlowEditor" class="flow-editor-overlay">
      <FlowEditor @close="showFlowEditor = false" @result="handleFlowResult" />
    </div>

    <!-- 截图弹窗（QA自动化测试用） -->
        <div v-if="showScreenshotModal" class="screenshot-modal-overlay" @click.self="showScreenshotModal = false">
            <div class="screenshot-modal">
                <div class="screenshot-modal-header">
                    <h3><ImageIcon :size="18" /> 测试截图</h3>
                    <div style="display:flex; gap:8px;">
                        <button @click="refreshScreenshots" class="btn-secondary" style="font-size:12px; padding:4px 8px;" v-tooltip="'刷新'"><RefreshCw :size="12" /> 刷新</button>
                        <button @click="clearAllScreenshots" class="btn-secondary" style="font-size:12px; padding:4px 8px;" v-tooltip="'清空'"><Trash2 :size="12" /> 清空</button>
                        <button @click="showScreenshotModal = false" class="btn-text" style="font-size:18px;" v-tooltip="'关闭'"><X :size="18" /></button>
                    </div>
                </div>
                <div class="screenshot-modal-body">
          <div v-if="screenshotList.length === 0" class="no-screenshots">暂无截图</div>
                    <div v-else class="screenshot-grid">
                        <div v-for="(ss, idx) in screenshotList" :key="idx" class="screenshot-item" @click="previewScreenshot(ss)">
                            <img :src="ss.base64" :alt="ss.step" />
                            <div class="screenshot-label">{{ ss.step }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 截图预览 -->
        <div v-if="previewingScreenshot" class="screenshot-preview-overlay" @click="previewingScreenshot = null">
            <img :src="previewingScreenshot.base64" :alt="previewingScreenshot.step" />
            <div class="preview-label">{{ previewingScreenshot.step }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, reactive, onMounted, onBeforeUnmount, watch } from 'vue';
import { marked } from 'marked';

// 配置 marked：启用 breaks 选项，让单个换行符渲染为 <br>
marked.use({
  breaks: true,  // 单个换行符转换为 <br>
  gfm: true,     // GitHub 风格 Markdown
});

import { ImageProcessor } from '@/utils/imageProcessor';
import { extractAndUploadImages } from '@/utils/imageExtractor';
import type { ExtractedImage } from '@/utils/page';
import { postRetrieve, ask, uploadImage, prdAgent, clearPrdSession, testCaseAgent, clearTestCaseSession, uiAgent, clearUiSession, getUiScreenshots, clearUiScreenshots, chatAgent, evaluateTestCases, midsceneAgent, midsceneAgentSmart, checkMidsceneHealth, listMidsceneReports, midsceneRunTestcaseStream, getMidsceneCacheList, deleteMidsceneCache, clearAllMidsceneCache, midsceneRunInstantStream, midsceneRunYaml, listRegressionBaselines, getRegressionBaseline, saveRegressionBaseline, updateRegressionBaseline, deleteRegressionBaseline } from '@/api';
import type { MidsceneCacheItem, InstantStep, InstantStepResult, RegressionBaseline, RunInstantOptions } from '@/api';
import type { MidsceneTestCase, MidsceneStreamEvent } from '@/api';
import { parseTestCases } from '@/utils/testcaseParser';
import { uploadRawPrd, uploadAuxDoc, upsertDocs, getDocContent, type DocUpsertItem } from '@/utils/docStoreApi';
import { askV2 } from '@/utils/askApi';
import type { DocRef } from '@/utils/refRegistry';
import MindMapPreview from '@/components/MindMapPreview.vue';
import FlowEditor from '@/components/flow/FlowEditor.vue';
import RoleSelector from '@/components/RoleSelector.vue';
import WorkflowProgress from '@/components/WorkflowProgress.vue';
import ChatMessage from '@/components/ChatMessage.vue';
import DocumentPanel from '@/components/DocumentPanel.vue';
import KnowledgeBasePanel from '@/components/KnowledgeBasePanel.vue';
import HistoryPanel from '@/components/HistoryPanel.vue';
import QualityReportPanel from '@/components/QualityReportPanel.vue';
import BatchUploader from '@/components/BatchUploader.vue';
import TaskProgressBar from '@/components/TaskProgressBar.vue';
import NeoTooltip from '@/components/common/NeoTooltip.vue';
import { preferences, type TestCaseOutputFormat } from '@/utils/preferences';
import ChatInput from '@/components/ChatInput.vue';
import { useSession, useRole, useWorkflow, useTaskProgress } from '@/composables';
import { useFileUpload } from '@/composables/useFileUpload';
import type { Attachment, ChatSendPayload, EvaluationReport } from '@/types/chat';
import { adaptLegacyMessage, canUndoMessage, getOriginalIndex, getActionType, type AdaptedChatMessage } from '@/utils/messageAdapter';
import { getLocalAgentUrl } from '@/utils/agentUrl';
import { browser } from 'wxt/browser';
import { ensureConnection, sendMessageToContent, getActiveTab, isInjectableTab } from '@/utils/connectionHelper';

// Lucide Icons
import {
  Undo2,
  Camera,
  Sparkles,
  ListChecks,
  FileText,
  BarChart3,
  Puzzle,
  Ghost,
  Monitor,
  RefreshCcw,
  Gamepad2,
  Database,
  Bandage,
  Flame,
  Recycle,
  Library,
  X,
  Star,
  File,
  Target,
  ClipboardList,
  Link,
  Palette,
  FileEdit,
  Menu,
  ScrollText,
  Upload,
  Plus,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Trash2,
  Loader2,
  XCircle,
  RefreshCw,
  Image as ImageIcon,
  Eye,
  Paperclip,
  CheckCircle,
  SkipForward,
  Check,
  ShieldCheck,
  ExternalLink,
  Zap,
  Play,
  Square,
  GripVertical,
  RotateCcw,
  Settings,
  ChevronDown,
  Pencil,
  Save,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  Lightbulb,
  AlertTriangle,
  BookOpen,
} from 'lucide-vue-next';

// 角色头像（占位资源，可用你的图一/二/三替换同名文件）
import pmAvatarUrl from '@/assets/roles/pm.svg?url';
import devAvatarUrl from '@/assets/roles/dev.svg?url';
import qaAvatarUrl from '@/assets/roles/qa.svg?url';

// Step 类型定义
type Step = '' | 'setup' | 'analyzing' | 'content_review' | 'optimizing' | 'prd_review' | 'test_point' | 'test_case' | 'auto_test';

interface ProjectState {
  currentStep: Step;
  inputs: {
    figmaUrl: string;
  };
  assets: {
    screenshotUrl: string;
    domMarkdown: string;
    cdnUrl: string;
    cdnUrls: string[];
    sessionId: string;
  };
  documents: {
    prd: string;           // 原始提取的PRD
    optimizedPrd: string;  // 优化后的PRD
    testPoints: string;
    testCases: string;
    uiPlan: string;
    uiReport: string;
    uiPlanJson: string;      // 可执行 Plan JSON（闭环模式返回，可直接回放）
    midsceneReport: string;      // Midscene 执行结果 Markdown
    midsceneCasesJson: string;   // Midscene 解析后的用例 JSON
  };
}


// --- State ---
// 可调节面板宽度
const leftPanelWidth = ref(350);
const isResizing = ref(false);
const rightPanelFlex = computed(() => 1); // 右侧面板弹性填充剩余空间

const startResize = (e: MouseEvent) => {
  isResizing.value = true;
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
};

const onResize = (e: MouseEvent) => {
  if (!isResizing.value) return;
  const newWidth = Math.max(250, Math.min(600, e.clientX));
  leftPanelWidth.value = newWidth;
};

const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
};

const projectState = reactive<ProjectState>({
  currentStep: '',
  inputs: { figmaUrl: '' },
  assets: { screenshotUrl: '', domMarkdown: '', cdnUrl: '', cdnUrls: [], sessionId: '' },
  documents: { prd: '', optimizedPrd: '', testPoints: '', testCases: '', uiPlan: '', uiReport: '', uiPlanJson: '', midsceneReport: '', midsceneCasesJson: '' }
});

// 消息类型扩展：支持撤回操作和附件
interface MessageAttachmentInfo {
  type: 'file' | 'image' | 'document';
  name: string;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  actionType?: 'edit' | 'delete' | 'add' | 'query' | 'testcase_edit'; // 操作类型
  canUndo?: boolean; // 是否可撤回
  undoData?: string; // 撤回前的 PRD 内容
  attachments?: MessageAttachmentInfo[]; // 附件信息
}

const messages = ref<Message[]>([]);
const isProcessing = ref(false);
const statusText = ref('');

// Phase 4: 消息适配（用于 ChatMessage 组件）
const adaptedMessages = computed<AdaptedChatMessage[]>(() =>
  messages.value.map((msg, idx) => adaptLegacyMessage(msg, idx))
);

// Phase 4: ChatMessage 组件事件处理
function handleMessageRetry(msg: AdaptedChatMessage) {
  console.log('[App] Message retry:', msg.id);
}

function handleAttachmentClick(attachment: any) {
  console.log('[App] Attachment clicked:', attachment);
}

function handleRefClick(ref: any) {
  console.log('[App] Ref clicked:', ref);
}

// Phase 4: QA 工作流步骤索引（用于 WorkflowProgress 组件）
const qaWorkflowStepIndex = computed(() => {
  const stepMap: Record<string, number> = {
    'setup': 0, 'analyzing': 0, 'content_review': 0,
    'optimizing': 1, 'prd_review': 1,
    'test_point': 2,
    'test_case': 3,
    'auto_test': 4
  };
  return stepMap[projectState.currentStep] ?? 0;
});

const ensureSessionId = (): string => {
  if (projectState.assets.sessionId) return projectState.assets.sessionId;
  const sid = `mvp-${Date.now()}`;
  projectState.assets.sessionId = sid;
  return sid;
};

// QA 输入框统一走 /api/ask，根据当前步骤映射 ask type
const getQaAskTypeByStep = (step: string): 'testprd' | 'testpoint' | 'testcase' => {
  if (step === 'test_point') return 'testpoint';
  if (step === 'test_case') return 'testcase';
  return 'testprd';
};

// 存储生成文档的 docRef（用于后续阶段的 docRefs 构建）
const generatedDocRefs = reactive<{
  optimizedPrd: DocRef | null;
  testPoints: DocRef | null;
  testCases: DocRef | null;
  uploadedPrd: DocRef | null;  // 上传的 PDF/图片主文档（用于质量评估时回取内容）
}>({
  optimizedPrd: null,
  testPoints: null,
  testCases: null,
  uploadedPrd: null,
});

// 构建 docRefs（根据阶段返回正确的主文档）
const buildDocRefsForAsk = (type: 'testprd' | 'testpoint' | 'testcase'): DocRef[] => {
  const docRefs: DocRef[] = [];
  
  // 根据 type 决定主文档
  if (type === 'testprd') {
    // 优化 PRD 阶段：使用原始 PRD（raw_prd）
    const mainPrdDoc = urlDocs.value.find(d => d.isMainPrd && (d as any).docRef);
    if (mainPrdDoc && (mainPrdDoc as any).docRef) {
      docRefs.push({
        docId: (mainPrdDoc as any).docRef.docId,
        kind: 'main',
        logicalId: 'raw_prd',
        title: mainPrdDoc.title,
      });
    }
  } else if (type === 'testpoint') {
    // 生成测试点阶段：使用优化后的 PRD（optimized_prd_current）
    if (generatedDocRefs.optimizedPrd) {
      docRefs.push({
        docId: generatedDocRefs.optimizedPrd.docId,
        kind: 'main',
        logicalId: 'optimized_prd_current',
        title: generatedDocRefs.optimizedPrd.title || '优化后PRD',
      });
    } else {
      // fallback: 使用原始 PRD
      const mainPrdDoc = urlDocs.value.find(d => d.isMainPrd && (d as any).docRef);
      if (mainPrdDoc && (mainPrdDoc as any).docRef) {
        docRefs.push({
          docId: (mainPrdDoc as any).docRef.docId,
          kind: 'main',
          logicalId: 'raw_prd',
          title: mainPrdDoc.title,
        });
      }
    }
  } else if (type === 'testcase') {
    // 生成测试用例阶段：主文档使用优化后的 PRD，辅助使用测试点
    if (generatedDocRefs.optimizedPrd) {
      docRefs.push({
        docId: generatedDocRefs.optimizedPrd.docId,
        kind: 'main',
        logicalId: 'optimized_prd_current',
        title: generatedDocRefs.optimizedPrd.title || '优化后PRD',
      });
    } else {
      // fallback: 使用原始 PRD
      const mainPrdDoc = urlDocs.value.find(d => d.isMainPrd && (d as any).docRef);
      if (mainPrdDoc && (mainPrdDoc as any).docRef) {
        docRefs.push({
          docId: (mainPrdDoc as any).docRef.docId,
          kind: 'main',
          logicalId: 'raw_prd',
          title: mainPrdDoc.title,
        });
      }
    }
    // 如果有测试点，作为辅助文档
    if (generatedDocRefs.testPoints) {
      docRefs.push({
        docId: generatedDocRefs.testPoints.docId,
        kind: 'aux',
        logicalId: 'testpoints_current',
        title: generatedDocRefs.testPoints.title || '测试点',
      });
    }
  }
  
  // 通用辅助文档（非主 PRD 的已入库文档）
  for (const doc of urlDocs.value) {
    if (!doc.isMainPrd && (doc as any).docRef) {
      docRefs.push({
        docId: (doc as any).docRef.docId,
        kind: 'aux',
        title: doc.title,
      });
    }
  }
  
  // 辅助 PRD 文档
  for (const prd of additionalPrds.value) {
    if (prd.status === 'success' && (prd as any).docRef) {
      docRefs.push({
        docId: (prd as any).docRef.docId,
        kind: 'aux',
        title: prd.title,
      });
    }
  }
  
  // Figma 文档
  for (const figma of figmaDocs.value) {
    if (figma.status === 'success' && (figma as any).docRef) {
      docRefs.push({
        docId: (figma as any).docRef.docId,
        kind: 'aux',
        title: figma.title,
      });
    }
  }
  
  return docRefs;
};

// 构建输入框的 docRefs（根据当前阶段的已生成文档）
const buildDocRefsForChat = (): DocRef[] => {
  const step = projectState.currentStep;
  const docRefs: DocRef[] = [];
  
  // 根据当前步骤选择主文档
  if (step === 'test_case' && generatedDocRefs.testCases) {
    // 测试用例阶段：使用测试用例
    docRefs.push({
      docId: generatedDocRefs.testCases.docId,
      kind: 'main',
      logicalId: 'testcases_current',
      title: generatedDocRefs.testCases.title || '测试用例',
    });
  } else if (step === 'test_point' && generatedDocRefs.testPoints) {
    // 测试点阶段：使用测试点
    docRefs.push({
      docId: generatedDocRefs.testPoints.docId,
      kind: 'main',
      logicalId: 'testpoints_current',
      title: generatedDocRefs.testPoints.title || '测试点',
    });
  } else if (['prd_review', 'optimizing'].includes(step) && generatedDocRefs.optimizedPrd) {
    // PRD 阶段：使用优化后的 PRD
    docRefs.push({
      docId: generatedDocRefs.optimizedPrd.docId,
      kind: 'main',
      logicalId: 'optimized_prd_current',
      title: generatedDocRefs.optimizedPrd.title || '优化后PRD',
    });
  } else {
    // 默认：使用原始 PRD
    const mainPrdDoc = urlDocs.value.find(d => d.isMainPrd && (d as any).docRef);
    if (mainPrdDoc && (mainPrdDoc as any).docRef) {
      docRefs.push({
        docId: (mainPrdDoc as any).docRef.docId,
        kind: 'main',
        logicalId: 'raw_prd',
        title: mainPrdDoc.title,
      });
    }
  }
  
  return docRefs;
};

/**
 * ✅ 新增：构建 @ 多选文档的 docRefs
 * 将 @ 引用的文档作为 main 候选（支持多选），其他文档作为 aux
 * 
 * @param selected @ 选中的文档列表
 * @returns docRefs 数组
 */
const buildDocRefsForAtSelection = (selected: RefDoc[]): DocRef[] => {
  const docRefs: DocRef[] = [];
  
  // @ 选中的文档作为 main 候选（支持多个）
  for (const doc of selected) {
    // 根据 kind 获取对应的 docRef
    let targetDocRef: DocRef | undefined;
    let logicalId: string = '';
    
    if (doc.kind === 'main') {
      // QA 主文档
      if (doc.id === 'main:optimizedPrd' && generatedDocRefs.optimizedPrd) {
        targetDocRef = generatedDocRefs.optimizedPrd;
        logicalId = 'optimized_prd_current';
      } else if (doc.id === 'main:testPoints' && generatedDocRefs.testPoints) {
        targetDocRef = generatedDocRefs.testPoints;
        logicalId = 'testpoints_current';
      } else if (doc.id === 'main:testCases' && generatedDocRefs.testCases) {
        targetDocRef = generatedDocRefs.testCases;
        logicalId = 'testcases_current';
      } else if (doc.id === 'main:prd') {
        const mainPrdDoc = urlDocs.value.find(d => d.isMainPrd && d.docRef);
        if (mainPrdDoc?.docRef) {
          targetDocRef = mainPrdDoc.docRef;
          logicalId = 'raw_prd';
        }
      }
    } else if (doc.kind === 'url') {
      const urlDoc = urlDocs.value.find(d => d.id === doc.id.replace('url:', ''));
      if (urlDoc?.docRef) {
        targetDocRef = urlDoc.docRef;
        logicalId = urlDoc.logicalId || `aux_url_${urlDoc.id}`;
      }
    } else if (doc.kind === 'additional') {
      const prdDoc = additionalPrds.value.find(p => p.id === doc.id.replace('additional:', ''));
      if (prdDoc?.docRef) {
        targetDocRef = prdDoc.docRef as DocRef;
        logicalId = prdDoc.logicalId || `aux_prd_${prdDoc.id}`;
      }
    } else if (doc.kind === 'figma') {
      const figmaDoc = figmaDocs.value.find(f => f.id === doc.id.replace('figma:', ''));
      if (figmaDoc?.docRef) {
        targetDocRef = figmaDoc.docRef as DocRef;
        logicalId = figmaDoc.logicalId || `aux_figma_${figmaDoc.id}`;
      }
    } else if (doc.kind === 'custom') {
      const customDoc = customDocs.value.find(c => c.id === doc.id.replace('custom:', ''));
      if (customDoc?.docRef) {
        targetDocRef = customDoc.docRef as DocRef;
        logicalId = customDoc.logicalId || `custom_${customDoc.id}`;
      }
    } else if (doc.kind === 'chatDoc') {
      // PM/DEV 的聊天文档（提取的页面内容）
      const chatDoc = chatOnlyDocuments.value.find(c => c.id === doc.id.replace('chatDoc:', ''));
      if (chatDoc?.docRef) {
        targetDocRef = chatDoc.docRef as DocRef;
        logicalId = chatDoc.logicalId || `chatdoc_${chatDoc.id}`;
      }
    }
    
    if (targetDocRef && targetDocRef.docId) {
      docRefs.push({
        docId: targetDocRef.docId,
        kind: 'main',  // @ 选中的文档作为 main 候选
        logicalId: logicalId,
        title: doc.title,
      });
    }
  }
  
  return docRefs;
};

// 检查是否有已入库的主文档（用于判断是否使用 docRefs 模式）
const hasStoredMainPrd = (): boolean => {
  const mainPrdDoc = urlDocs.value.find(d => d.isMainPrd && (d as any).docRef);
  return !!mainPrdDoc || !!generatedDocRefs.optimizedPrd;
};

const progress = ref(0);
const viewMode = ref<'edit' | 'preview'>('preview');
const chatContainer = ref<HTMLElement|null>(null);
const hasGeneratedPRD = ref(false); // Track if PRD has been generated at least once
const cachedPRD = ref('');
const hasGeneratedTestPoints = ref(false);
const cachedTestPoints = ref('');
const hasGeneratedTestCases = ref(false);
const cachedTestCases = ref('');

// 测试用例输出格式选择
const testCaseOutputFormat = ref<TestCaseOutputFormat>(
  preferences.get('formats').testcaseGeneration || 'xmind'
);

// 测试用例格式选项
const testCaseFormatOptions = [
  {
    value: 'xmind' as const,
    label: 'XMind',
    icon: '🗺️',
    description: 'H1-H6层级结构，兼容XMind导入',
  },
  {
    value: 'table' as const,
    label: '表格',
    icon: '📊',
    description: 'Markdown表格格式，便于复制到Excel/飞书',
  },
  {
    value: 'yaml' as const,
    label: 'YAML',
    icon: '📄',
    description: 'YAML结构化格式，便于程序化处理',
  },
];

// 选择测试用例输出格式
function selectTestCaseFormat(format: TestCaseOutputFormat) {
  testCaseOutputFormat.value = format;
  // 持久化偏好设置
  const formats = preferences.get('formats');
  formats.testcaseGeneration = format;
  preferences.set('formats', formats);
}

// 文档保存相关
const isSavingDoc = ref(false);
const lastSavedContent = reactive<{
  optimizedPrd: string;
  testPoints: string;
  testCases: string;
}>({
  optimizedPrd: '',
  testPoints: '',
  testCases: '',
});

// 检测当前文档是否有未保存的修改（扩展到所有右侧可编辑文档）
const isCurrentDocDirty = computed(() => {
  // ✅ 1. QA 主文档（优化PRD/测试点/测试用例）
  if (userRole.value === 'qa' && activeRightTab.value === 'main') {
    let currentContent = '';
    let savedContent = '';
    
    if (activeMainDocType.value === 'optimizedPrd') {
      currentContent = projectState.documents.optimizedPrd || '';
      savedContent = lastSavedContent.optimizedPrd || '';
    } else if (activeMainDocType.value === 'testPoints') {
      currentContent = projectState.documents.testPoints || '';
      savedContent = lastSavedContent.testPoints || '';
    } else if (activeMainDocType.value === 'testCases') {
      currentContent = projectState.documents.testCases || '';
      savedContent = lastSavedContent.testCases || '';
    } else {
      return false;
    }
    
    return currentContent.trim() !== '' && currentContent !== savedContent;
  }
  
  // ✅ 2. URL 文档
  if (activeRightTab.value === 'url' && activeUrlDocId.value) {
    const doc = urlDocs.value.find(d => d.id === activeUrlDocId.value);
    if (doc && doc.status === 'success') {
      const currentContent = doc.content || '';
      const savedContent = doc.lastSavedContent || '';
      return currentContent.trim() !== '' && currentContent !== savedContent;
    }
  }
  
  // ✅ 3. 辅助 PRD
  if (activeRightTab.value === 'additional' && activeAdditionalPrdId.value) {
    const doc = additionalPrds.value.find(p => p.id === activeAdditionalPrdId.value);
    if (doc && doc.status === 'success') {
      const currentContent = doc.content || '';
      const savedContent = doc.lastSavedContent || '';
      return currentContent.trim() !== '' && currentContent !== savedContent;
    }
  }
  
  // ✅ 4. Figma 文档
  if (activeRightTab.value === 'figma' && activeFigmaDocId.value) {
    const doc = figmaDocs.value.find(f => f.id === activeFigmaDocId.value);
    if (doc && doc.status === 'success') {
      const currentContent = doc.content || '';
      const savedContent = doc.lastSavedContent || '';
      return currentContent.trim() !== '' && currentContent !== savedContent;
    }
  }
  
  // ✅ 5. 自定义文档
  if (activeRightTab.value === 'custom' && activeCustomDocId.value) {
    const doc = customDocs.value.find(d => d.id === activeCustomDocId.value);
    if (doc) {
      const currentContent = doc.content || '';
      const savedContent = doc.lastSavedContent || '';
      return currentContent.trim() !== '' && currentContent !== savedContent;
    }
  }
  
  // ✅ 6. PM/DEV 聊天文档（chatDoc）
  if (activeRightTab.value === 'chatDoc' && activeChatDocId.value) {
    const doc = chatOnlyDocuments.value.find(d => d.id === activeChatDocId.value);
    if (doc) {
      const currentContent = doc.content || '';
      const savedContent = doc.lastSavedContent || '';
      // 新文档（无 docRef）或内容有变化都视为 dirty
      return currentContent.trim() !== '' && (currentContent !== savedContent || !doc.docRef);
    }
  }
  
  return false;
});

// 保存当前文档到 DocStore（扩展到所有右侧可编辑文档）
const saveCurrentDocument = async () => {
  if (isSavingDoc.value) return;
  
  isSavingDoc.value = true;
  
  try {
    const sessionId = ensureSessionId();
    let content = '';
    let logicalId = '';
    let title = '';
    let kind: 'main' | 'aux' | 'output' = 'output';
    let targetDoc: AdditionalPrd | UrlDoc | FigmaDoc | CustomDoc | null = null;
    let docType: 'qa_main' | 'url' | 'additional' | 'figma' | 'custom' = 'qa_main';
    
    // ✅ 1. QA 主文档（优化PRD/测试点/测试用例）
    if (userRole.value === 'qa' && activeRightTab.value === 'main') {
      docType = 'qa_main';
      if (activeMainDocType.value === 'optimizedPrd') {
        content = projectState.documents.optimizedPrd || '';
        logicalId = 'optimized_prd_current';
        title = optimizedPrdTitle.value || '优化后PRD';
        kind = 'output';
      } else if (activeMainDocType.value === 'testPoints') {
        content = projectState.documents.testPoints || '';
        logicalId = 'testpoints_current';
        title = testPointsTitle.value || '测试点';
        kind = 'output';
      } else if (activeMainDocType.value === 'testCases') {
        content = projectState.documents.testCases || '';
        logicalId = 'testcases_current';
        title = testCasesTitle.value || '测试用例';
        kind = 'output';
      }
    }
    // ✅ 2. URL 文档
    else if (activeRightTab.value === 'url' && activeUrlDocId.value) {
      docType = 'url';
      const doc = urlDocs.value.find(d => d.id === activeUrlDocId.value);
      if (doc && doc.status === 'success') {
        targetDoc = doc;
        content = doc.content || '';
        logicalId = doc.logicalId || (doc.isMainPrd ? 'raw_prd' : `aux_url_${doc.id}`);
        title = doc.title || 'URL文档';
        kind = doc.isMainPrd ? 'main' : 'aux';
      }
    }
    // ✅ 3. 辅助 PRD
    else if (activeRightTab.value === 'additional' && activeAdditionalPrdId.value) {
      docType = 'additional';
      const doc = additionalPrds.value.find(p => p.id === activeAdditionalPrdId.value);
      if (doc && doc.status === 'success') {
        targetDoc = doc;
        content = doc.content || '';
        logicalId = doc.logicalId || `aux_prd_${doc.id}`;
        title = doc.title || '辅助PRD';
        kind = 'aux';
      }
    }
    // ✅ 4. Figma 文档
    else if (activeRightTab.value === 'figma' && activeFigmaDocId.value) {
      docType = 'figma';
      const doc = figmaDocs.value.find(f => f.id === activeFigmaDocId.value);
      if (doc && doc.status === 'success') {
        targetDoc = doc;
        content = doc.content || '';
        logicalId = doc.logicalId || `aux_figma_${doc.id}`;
        title = doc.title || 'Figma交互文档';
        kind = 'aux';
      }
    }
    // ✅ 5. 自定义文档
    else if (activeRightTab.value === 'custom' && activeCustomDocId.value) {
      docType = 'custom';
      const doc = customDocs.value.find(d => d.id === activeCustomDocId.value);
      if (doc) {
        targetDoc = doc;
        content = doc.content || '';
        logicalId = doc.logicalId || `custom_${doc.id}`;
        title = doc.title || '自定义文档';
        kind = 'aux';
      }
    }
    // ✅ 6. PM/DEV 聊天文档（chatDoc）
    else if (activeRightTab.value === 'chatDoc' && activeChatDocId.value) {
      docType = 'chatDoc' as any;  // 扩展类型
      const doc = chatOnlyDocuments.value.find(d => d.id === activeChatDocId.value);
      if (doc) {
        targetDoc = doc as any;  // ChatOnlyDocument 兼容
        content = doc.content || '';
        logicalId = doc.logicalId || `chatdoc_${doc.id}`;
        title = doc.title || '提取文档';
        kind = 'aux';  // PM/DEV 文档默认作为辅助文档
      }
    }
    
    if (!content.trim()) {
      addMessage('ai', '⚠️ 文档内容为空，无法保存');
      isSavingDoc.value = false;
      return;
    }
    
    if (!logicalId) {
      addMessage('ai', '⚠️ 无法确定文档类型，无法保存');
      isSavingDoc.value = false;
      return;
    }
    
    // 调用 upsert 入库
    const docRefResult = await upsertDocs({
      sessionId,
      docs: [{
        logicalId,
        kind,
        title,
        content,
        contentType: 'text/markdown',
      }]
    });
    
    const storedRef = docRefResult.stored[0]?.docRef;
    
    // 更新 lastSavedContent 和 docRef
    if (docType === 'qa_main') {
      if (activeMainDocType.value === 'optimizedPrd') {
        lastSavedContent.optimizedPrd = content;
        if (storedRef) generatedDocRefs.optimizedPrd = storedRef as DocRef;
      } else if (activeMainDocType.value === 'testPoints') {
        lastSavedContent.testPoints = content;
        if (storedRef) generatedDocRefs.testPoints = storedRef as DocRef;
      } else if (activeMainDocType.value === 'testCases') {
        lastSavedContent.testCases = content;
        if (storedRef) generatedDocRefs.testCases = storedRef as DocRef;
        // 保存后同步重新解析左侧 Midscene 用例列表
        if (projectState.currentStep === 'auto_test' || projectState.currentStep === 'test_case') {
          const parsed = parseTestCases(content, testCaseOutputFormat.value);
          if (parsed.length > 0) {
            midsceneParsedCases.value = parsed;
            midsceneSelectedCases.value = new Set(parsed.map(c => c.id));
            projectState.documents.midsceneCasesJson = JSON.stringify(parsed, null, 2);
            console.log('[saveCurrentDocument] 已同步更新 Midscene 用例列表:', parsed.length, '条');
          }
        }
      }
    } else if (targetDoc) {
      // 更新目标文档的 lastSavedContent 和 docRef
      targetDoc.lastSavedContent = content;
      targetDoc.docRef = storedRef as DocRef;
      targetDoc.logicalId = logicalId;

      // 如果是主PRD的URL文档，同步到 projectState.documents.prd
      if (docType === 'url' && (targetDoc as UrlDoc).isMainPrd) {
        projectState.documents.prd = content;
        projectState.assets.domMarkdown = content;
      }
    }

    addMessage('ai', `✅ 「${title}」已保存`);
    console.log('[saveCurrentDocument] 保存成功:', docRefResult);

    // 刷新知识库面板
    knowledgePanelRef.value?.refresh?.();
    
  } catch (e: any) {
    console.error('[saveCurrentDocument] 保存失败:', e);
    addMessage('ai', `❌ 保存失败：${e.message || e}`);
  } finally {
    isSavingDoc.value = false;
  }
};

/**
 * 将当前测试用例自动保存到知识库（DocStore）
 * 用于快速创建、内联编辑、模板插入等场景，无需用户手动点击保存按钮
 */
const autoSaveTestCasesToKnowledge = async (source: string = '测试用例') => {
    const content = projectState.documents.testCases;
    if (!content || !content.trim()) return;

    try {
        const sessionId = ensureSessionId();
        const title = testCasesTitle.value || '测试用例';
        const result = await upsertDocs({
            sessionId,
            docs: [{
                logicalId: 'testcases_current',
                kind: 'output',
                title,
                content,
                contentType: 'text/markdown',
            }]
        });

        const storedRef = result.stored[0]?.docRef;
        if (storedRef) {
            generatedDocRefs.testCases = storedRef as DocRef;
        }
        lastSavedContent.testCases = content;
        console.log(`[autoSave] ${source} → 已自动保存到知识库`);

        // 刷新知识库面板（如果已挂载）
        knowledgePanelRef.value?.refresh?.();
    } catch (e: any) {
        console.warn(`[autoSave] ${source} → 自动保存失败:`, e.message || e);
    }
};

const imageProcessor = new ImageProcessor();
const uiAgentInput = ref('');
const prdAgentInput = ref(''); // PRD 智能体输入
const prdHistory = ref<string[]>([]); // PRD 历史记录，用于撤回
const testCaseAgentInput = ref(''); // Test Case 智能体输入
const testCaseHistory = ref<string[]>([]); // Test Case 历史记录
const uiAgentSessionId = ref(`ui-session-${Date.now()}`);
const isHeadlessMode = ref(false); // UI自动化测试：有头/无头模式
const uiWorkflowMode = ref<'direct' | 'closed_loop'>('closed_loop'); // UI自动化工作流模式
const uiAutoHeal = ref(true); // 闭环模式自愈开关
const uiMaxHealRounds = ref(1); // 闭环模式最大自愈轮数
const showFlowEditor = ref(false); // 可视化测试面板开关

// ================= Midscene Engine State =================
const uiEngine = ref<'legacy' | 'midscene'>('midscene');
const midsceneMode = ref<'cases' | 'freeform'>('cases');
const midsceneSessionId = ref(`midscene-session-${Date.now()}`);
const midsceneParsedCases = ref<MidsceneTestCase[]>([]);
const midsceneSelectedCases = ref<Set<string>>(new Set());
const midsceneResults = ref<Array<{
    testcaseId: string;
    testcaseName: string;
    status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
    durationMs?: number;
    assertions?: Array<{ expected: string; success: boolean; reason?: string }>;
    /** 该用例对应的 HTML 报告 URL */
    reportUrl?: string;
}>>([]);
const midsceneExecuting = ref(false);
const midsceneCurrentCase = ref('');
// 用于取消正在进行的 Midscene 请求（停止按钮触发时 abort）
const midsceneAbortController = ref<AbortController | null>(null);
const midsceneSidecarReady = ref(false);
// ★ 执行模式相关状态
const midsceneExecutionMode = ref<'free' | 'mixed' | 'regression'>('free');
// ★ 缓存管理相关状态
const midsceneCacheStrategy = ref<'smart' | 'read-write' | 'read-only' | 'write-only' | 'false'>('smart');
const midsceneCacheList = ref<MidsceneCacheItem[]>([]);
const midsceneCacheTotalSize = ref(0);
const midsceneCachePanelVisible = ref(false);
// ★ 设置面板状态
const midsceneSettingsVisible = ref(false);
// ★ 回归基线管理面板状态
const regressionPanelVisible = ref(false);
const regressionBaselines = ref<any[]>([]);
const regressionLoading = ref(false);
// ★ 基线映射：caseId → baseline（用于标记哪些用例有回归基线）
const regressionBaselineMap = ref<Map<string, any>>(new Map());

// ★ 模式智能推荐
const modeRecommendation = computed(() => {
    const cases = midsceneParsedCases.value;
    if (cases.length === 0) return { mode: 'free' as const, tip: '执行模式' };

    const totalCases = cases.length;
    const withBaseline = cases.filter(c => regressionBaselineMap.value.has(c.id)).length;
    const withSteps = cases.filter(c => c.steps && c.steps.length > 0).length;

    if (withBaseline > 0 && withBaseline >= totalCases * 0.5) {
        return {
            mode: 'regression' as const,
            tip: `推荐回归模式 (${withBaseline}/${totalCases} 条用例有基线)`,
        };
    }
    if (withSteps > 0 && withSteps >= totalCases * 0.5) {
        return {
            mode: 'mixed' as const,
            tip: `推荐混合模式 (${withSteps}/${totalCases} 条用例有步骤)`,
        };
    }
    return {
        mode: 'free' as const,
        tip: `推荐自由模式 (大部分用例仅有场景描述)`,
    };
});
const modeRecommendationTip = computed(() => modeRecommendation.value.tip);

// ★ 基线覆盖率统计
const baselineCoverage = computed(() => {
    const total = midsceneParsedCases.value.length;
    const covered = midsceneParsedCases.value.filter(c => regressionBaselineMap.value.has(c.id)).length;
    return { total, covered, percentage: total > 0 ? Math.round(covered / total * 100) : 0 };
});
// ★ 用例详情面板 — 内联 steps 编辑状态
const editingCaseSteps = ref(false);
const editingStepsBuffer = ref<string[]>([]);
const editingCaseId = ref('');

// ★ Step 5 快速创建用例表单
const quickCreateVisible = ref(false);
const quickCreateForm = ref({ name: '', scenario: '', steps: [''], expectedResults: [''] });

// ★ Step 4 手动编写引导
const manualGuideVisible = ref(false);

// ★ 步骤编辑器状态
const stepEditorVisible = ref(false);
const stepEditorSteps = ref<any[]>([]);
const stepEditorCaseId = ref('');
const stepEditorCaseName = ref('');
const stepEditorUrl = ref('');
const stepEditorAssertions = ref<string[]>([]);
// ★ 逐步执行结果（混合/回归模式）
const instantStepResults = ref<any[]>([]);
const midsceneCacheLoading = ref(false);
const midsceneReportUrl = ref('');
/** 批量执行时收集每条用例的报告 URL 列表 */
const midsceneReportUrls = ref<Array<{ testcaseId: string; testcaseName: string; url: string }>>([]);
const midsceneViewType = ref<'cases' | 'results' | 'html_report'>('cases');

// Timeline cards for real-time execution logs
interface TimelineCard {
    id: string;
    type: 'aiAct' | 'aiAssert' | 'aiQuery' | 'screenshot' | 'navigate' | 'status'
        | 'tap' | 'input' | 'assert' | 'scroll' | 'hover' | 'keypress' | 'wait'
        | 'doubleTap' | 'rightClick';
    description: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    durationMs?: number;
    screenshot?: string;
    error?: string;
}
const midsceneTimeline = ref<TimelineCard[]>([]);
const midsceneSelectedCaseId = ref(''); // Currently selected case for right panel detail

// ================= 参考确认弹窗 =================
const showReferenceConfirmModal = ref(false); // 是否显示参考确认弹窗
const referenceConfirmAction = ref<'optimize' | 'testcase'>('optimize'); // 当前操作类型

// ================= 多PRD引用功能 =================
interface AdditionalPrd {
  id: string;
  url: string;
  title: string;
  status: 'loading' | 'success' | 'error';
  content: string;
  error?: string;
  // ✅ 新增：文档保存相关字段
  docRef?: DocRef;  // DocStore 返回的引用
  lastSavedContent?: string;  // 上次保存的内容（用于 dirty 检测）
  logicalId?: string;  // 稳定的逻辑ID（例如 aux_prd_${id}）
}
const showAdditionalPrdPanel = ref(false);  // 是否显示添加PRD面板
const newPrdUrl = ref('');  // 新PRD输入框
const currentPrdTitle = ref('');  // 当前PRD标题（从URL或内容中提取）

// ================= URL 文档区域（链接提取 / 提取当前页 / 输入框URL） =================
interface UrlDoc {
  id: string;
  url: string;
  title: string;
  status: 'loading' | 'success' | 'error';
  content: string;
  error?: string;
  isMainPrd?: boolean;  // 是否被选为主PRD
  // ✅ 新增：文档保存相关字段
  docRef?: DocRef;  // DocStore 返回的引用
  lastSavedContent?: string;  // 上次保存的内容（用于 dirty 检测）
  logicalId?: string;  // 稳定的逻辑ID（例如 aux_url_${id} 或 raw_prd）
}

// 自定义文档（用户新增）
interface CustomDoc {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  // ✅ 新增：文档保存相关字段
  docRef?: DocRef;  // DocStore 返回的引用
  lastSavedContent?: string;  // 上次保存的内容（用于 dirty 检测）
  logicalId?: string;  // 稳定的逻辑ID（例如 custom_${id}）
}

// Figma文档
interface FigmaDoc {
  id: string;
  url: string;
  title: string;
  status: 'loading' | 'success' | 'error';
  content: string;  // 生成的交互补充文档
  error?: string;
  // ✅ 新增：文档保存相关字段
  docRef?: DocRef;  // DocStore 返回的引用
  lastSavedContent?: string;  // 上次保存的内容（用于 dirty 检测）
  logicalId?: string;  // 稳定的逻辑ID（例如 aux_figma_${id}）
}

// ================= 按角色分离文档集合 =================
// 每个角色独立的文档存储，切换角色时不会串
interface RoleDocuments {
  additionalPrds: AdditionalPrd[];
  figmaDocs: FigmaDoc[];
  customDocs: CustomDoc[];
  urlDocs: UrlDoc[];  // QA专用
  activeRightTab: RightPanelTab;
  activeAdditionalPrdId: string;
  activeFigmaDocId: string;
  activeCustomDocId: string;
  activeUrlDocId: string;
  activeMainDocType: MainDocType;
}

// 各角色文档存储
const roleDocumentsStore = reactive<Record<string, RoleDocuments>>({
  pm: { additionalPrds: [], figmaDocs: [], customDocs: [], urlDocs: [], activeRightTab: 'chatDoc', activeAdditionalPrdId: '', activeFigmaDocId: '', activeCustomDocId: '', activeUrlDocId: '', activeMainDocType: 'prd' },
  dev: { additionalPrds: [], figmaDocs: [], customDocs: [], urlDocs: [], activeRightTab: 'chatDoc', activeAdditionalPrdId: '', activeFigmaDocId: '', activeCustomDocId: '', activeUrlDocId: '', activeMainDocType: 'prd' },
  qa: { additionalPrds: [], figmaDocs: [], customDocs: [], urlDocs: [], activeRightTab: 'main', activeAdditionalPrdId: '', activeFigmaDocId: '', activeCustomDocId: '', activeUrlDocId: '', activeMainDocType: 'prd' },
});

// 当前角色的文档集合（computed 自动切换）
const additionalPrds = computed({
  get: () => roleDocumentsStore[userRole.value || 'qa']?.additionalPrds || [],
  set: (val) => { if (userRole.value) roleDocumentsStore[userRole.value].additionalPrds = val; }
});

const figmaDocs = computed({
  get: () => roleDocumentsStore[userRole.value || 'qa']?.figmaDocs || [],
  set: (val) => { if (userRole.value) roleDocumentsStore[userRole.value].figmaDocs = val; }
});

const customDocs = computed({
  get: () => roleDocumentsStore[userRole.value || 'qa']?.customDocs || [],
  set: (val) => { if (userRole.value) roleDocumentsStore[userRole.value].customDocs = val; }
});

const urlDocs = computed({
  get: () => roleDocumentsStore[userRole.value || 'qa']?.urlDocs || [],
  set: (val) => { if (userRole.value) roleDocumentsStore[userRole.value].urlDocs = val; }
});

// ================= 右侧多Tab功能 =================
type RightPanelTab = 'main' | 'url' | 'additional' | 'figma' | 'chatDoc' | 'custom';
const activeRightTab = ref<RightPanelTab>('main');  // 当前激活的Tab

// 点击文档 tab 或文档列表项时，自动切回文档视图（退出知识库/Midscene 等面板）
// 注意：watch 只在 activeRightTab 值实际发生变化时触发，
// 如果用户点击的是当前已激活的 tab（值不变），watch 不会触发。
// 因此还需要在 switchToDocView() 中做兜底处理。
watch(activeRightTab, () => {
  if (rightPanelTab.value !== 'docs') {
    rightPanelTab.value = 'docs';
  }
});

/**
 * 切换到文档视图的统一入口
 * 无论当前在哪个面板（知识库/历史/Midscene 等），都能确保切回文档。
 * 解决了 watch(activeRightTab) 在值不变时不触发的问题。
 */
const switchToDocView = () => {
  if (rightPanelTab.value !== 'docs') {
    rightPanelTab.value = 'docs';
  }
};

const activeAdditionalPrdId = ref<string>('');  // 当前查看的辅助PRD ID
const activeCustomDocId = ref<string>(''); // 当前查看的自定义文档 ID
const activeUrlDocId = ref<string>('');
const showDocList = ref(false);  // 是否显示文档列表侧边栏
const isTabOverflowOpen = ref(false);  // Tab折叠菜单是否打开
const MAX_VISIBLE_TABS = 5;  // 最多显示的Tab数量

// 主文档类型切换 (prd: 原始PRD, optimizedPrd: 优化后PRD, testPoints: 测试点, testCases: 测试用例)
type MainDocType = 'prd' | 'optimizedPrd' | 'testPoints' | 'testCases';
const activeMainDocType = ref<MainDocType>('prd');

// QA 主文档标题（支持双击重命名）
const optimizedPrdTitle = ref('优化后PRD');
const testPointsTitle = ref('测试点');
const testCasesTitle = ref('测试用例');

/**
 * 根据生成上下文智能命名测试用例文档
 * 优先用 URL 域名 / 知识库文档标题 / 用户输入关键词
 */
const autoNameTestCases = (context?: { url?: string; docTitle?: string; instruction?: string }) => {
  if (!context) return;
  // 如果用户已手动重命名过（非默认名），则不覆盖
  const current = testCasesTitle.value;
  const isDefault = current === '测试用例' || current.startsWith('测试用例 ·');

  if (!isDefault) return;

  let name = '';
  if (context.docTitle) {
    // 从知识库文档标题中提取
    name = context.docTitle.replace(/测试用例[：:：\s]*/g, '').trim();
    if (name) {
      testCasesTitle.value = `测试用例 · ${name.slice(0, 20)}`;
      return;
    }
  }
  if (context.url) {
    // 从 URL 中提取域名
    try {
      const hostname = new URL(context.url).hostname.replace(/^www\./, '');
      testCasesTitle.value = `测试用例 · ${hostname}`;
      return;
    } catch { /* ignore */ }
  }
  if (context.instruction) {
    // 从用户输入指令中提取关键词（去掉"基于""生成""测试用例"等通用词）
    const cleaned = context.instruction
      .replace(/基于|根据|生成|测试用例|当前页面|请|帮我|分析/g, '')
      .trim();
    if (cleaned.length > 0 && cleaned.length <= 30) {
      testCasesTitle.value = `测试用例 · ${cleaned.slice(0, 20)}`;
      return;
    }
  }
};

// 保存当前角色的Tab状态
const saveRoleTabState = () => {
  const role = userRole.value;
  if (!role) return;
  roleDocumentsStore[role].activeRightTab = activeRightTab.value;
  roleDocumentsStore[role].activeAdditionalPrdId = activeAdditionalPrdId.value;
  roleDocumentsStore[role].activeFigmaDocId = activeFigmaDocId.value;
  roleDocumentsStore[role].activeCustomDocId = activeCustomDocId.value;
  roleDocumentsStore[role].activeUrlDocId = activeUrlDocId.value;
  roleDocumentsStore[role].activeMainDocType = activeMainDocType.value;
};

// 恢复角色的Tab状态
const restoreRoleTabState = (role: string) => {
  const store = roleDocumentsStore[role];
  if (!store) return;
  activeRightTab.value = store.activeRightTab;
  activeAdditionalPrdId.value = store.activeAdditionalPrdId;
  activeFigmaDocId.value = store.activeFigmaDocId;
  activeCustomDocId.value = store.activeCustomDocId;
  activeUrlDocId.value = store.activeUrlDocId;
  activeMainDocType.value = store.activeMainDocType;
};

// 关闭当前Tab
const closeCurrentTab = () => {
    if (activeRightTab.value === 'chatDoc' && activeChatDocId.value) {
        removeChatOnlyDoc(activeChatDocId.value);
    } else if (activeRightTab.value === 'additional' && activeAdditionalPrdId.value) {
        removeAdditionalPrd(activeAdditionalPrdId.value);
    } else if (activeRightTab.value === 'figma' && activeFigmaDocId.value) {
        removeFigmaDoc(activeFigmaDocId.value);
    } else if (activeRightTab.value === 'custom' && activeCustomDocId.value) {
        removeCustomDoc(activeCustomDocId.value);
    }
    activeRightTab.value = 'main';
};

// 删除自定义文档
const removeCustomDoc = (docId: string) => {
  const index = customDocs.value.findIndex(d => d.id === docId);
  if (index !== -1) {
    customDocs.value.splice(index, 1);
    if (activeCustomDocId.value === docId) {
      if (customDocs.value.length > 0) {
        activeCustomDocId.value = customDocs.value[0].id;
        activeRightTab.value = 'custom';
      } else {
        activeCustomDocId.value = '';
        activeRightTab.value = 'main';
      }
    }
  }
};

// 新建自定义文档
const createCustomDoc = () => {
  const title = window.prompt('请输入文档标题');
  if (!title || !title.trim()) return;

  const docId = `custom-${Date.now()}`;
  customDocs.value.unshift({
    id: docId,
    title: title.trim(),
    content: `# ${title.trim()}\n\n`,
    createdAt: Date.now(),
  });

  activeRightTab.value = 'custom';
  activeCustomDocId.value = docId;
  viewMode.value = 'edit';
};

// 重命名：通用弹窗（双击 Tab 或列表触发）
const renameTitle = (oldTitle: string) => {
  const nextTitle = window.prompt('修改标题', oldTitle || '');
  if (!nextTitle || !nextTitle.trim()) return null;
  return nextTitle.trim();
};

const renameChatDocTitle = (docId: string) => {
  const doc = chatOnlyDocuments.value.find(d => d.id === docId);
  if (!doc) return;
  const next = renameTitle(doc.title || '文档');
  if (next) doc.title = next;
};

const renameCustomDocTitle = (docId: string) => {
  const doc = customDocs.value.find(d => d.id === docId);
  if (!doc) return;
  const next = renameTitle(doc.title || '自定义文档');
  if (next) doc.title = next;
};

const renameAdditionalPrdTitle = (docId: string) => {
  const doc = additionalPrds.value.find(d => d.id === docId);
  if (!doc) return;
  const next = renameTitle(doc.title || '辅助PRD');
  if (next) doc.title = next;
};

const renameFigmaTitle = (docId: string) => {
  const doc = figmaDocs.value.find(d => d.id === docId);
  if (!doc) return;
  const next = renameTitle(doc.title || 'Figma文档');
  if (next) doc.title = next;
};

// URL 文档重命名（同步主PRD标题）
const renameUrlDocTitle = (docId: string) => {
  const doc = urlDocs.value.find(d => d.id === docId);
  if (!doc) return;
  const next = renameTitle(doc.title || 'URL文档');
  if (next) {
    doc.title = next;
    // 如果是主PRD，同步更新 currentPrdTitle
    if (doc.isMainPrd) {
      currentPrdTitle.value = next;
    }
  }
};

// 删除 URL 文档
const removeUrlDoc = (docId: string) => {
  urlDocs.value = urlDocs.value.filter(d => d.id !== docId);
  if (activeRightTab.value === 'url' && activeUrlDocId.value === docId) {
    activeUrlDocId.value = '';
    activeRightTab.value = 'main';
  }
};

// 设置 URL 文档为主 PRD
const setAsMainPrd = (docId: string) => {
  const doc = urlDocs.value.find(d => d.id === docId);
  if (!doc || doc.status !== 'success') return;
  
  // 取消之前的主PRD标记
  urlDocs.value.forEach(d => d.isMainPrd = false);
  
  // 设置新的主PRD
  doc.isMainPrd = true;
  projectState.documents.prd = doc.content;
  currentPrdTitle.value = doc.title || '主需求文档';
  
  // 切换到主文档Tab
  activeRightTab.value = 'main';
  activeMainDocType.value = 'prd';
  viewMode.value = 'preview';
  
  addMessage('ai', `✅ 已将《${doc.title}》设为主PRD`);
};

// 文档标题推导（所有提取的文档必须有标题）
const deriveDocTitle = (content: string, urlOrName?: string, fallback: string = '文档') => {
  const text = (content || '').trim();
  const firstH1 = text.split('\n').find(l => l.trim().startsWith('#'));
  const fromMd = firstH1 ? firstH1.replace(/^#+\s*/, '').trim() : '';
  if (fromMd) return fromMd.slice(0, 60);

  if (urlOrName) {
    try {
      const u = new URL(urlOrName);
      const last = (u.pathname || '').split('/').filter(Boolean).pop() || '';
      const name = decodeURIComponent(last).replace(/\.(md|markdown|txt)$/i, '').trim();
      return (name || u.hostname || fallback).slice(0, 60);
    } catch {
      const last = urlOrName.split('/').filter(Boolean).pop() || '';
      const name = decodeURIComponent(last).replace(/\.(md|markdown|txt)$/i, '').trim();
      if (name) return name.slice(0, 60);
    }
  }

  const firstLine = text
    .split('\n')
    .map(s => s.trim())
    .find(Boolean) || '';
  if (firstLine) return firstLine.slice(0, 60);
  return fallback;
};

const renameQaMainDocTitle = (docType: MainDocType) => {
  if (docType === 'prd') {
    const next = renameTitle(currentPrdTitle.value || '主PRD');
    if (next) {
      currentPrdTitle.value = next;
      // 同步更新对应的 URL 文档标题（如果主PRD来自URL文档）
      const mainUrlDoc = urlDocs.value.find(d => d.isMainPrd);
      if (mainUrlDoc) {
        mainUrlDoc.title = next;
      }
    }
    return;
  }
  if (docType === 'optimizedPrd') {
    const next = renameTitle(optimizedPrdTitle.value);
    if (next) optimizedPrdTitle.value = next;
    return;
  }
  if (docType === 'testPoints') {
    const next = renameTitle(testPointsTitle.value);
    if (next) testPointsTitle.value = next;
    return;
  }
  if (docType === 'testCases') {
    const next = renameTitle(testCasesTitle.value);
    if (next) testCasesTitle.value = next;
  }
};

// PM/DEV角色：当前激活的文档内容
const chatOnlyActiveDocContent = computed({
  get: () => {
    if (activeRightTab.value === 'chatDoc' && activeChatDocId.value) {
      const doc = chatOnlyDocuments.value.find(d => d.id === activeChatDocId.value);
      return doc?.content || '';
    }
    return '';
  },
  set: (val: string) => {
    if (activeRightTab.value === 'chatDoc' && activeChatDocId.value) {
      const doc = chatOnlyDocuments.value.find(d => d.id === activeChatDocId.value);
      if (doc) {
        doc.content = val;
      }
    }
  }
});

// 自定义文档：当前激活内容
const customActiveDocContent = computed({
  get: () => {
    if (activeRightTab.value === 'custom' && activeCustomDocId.value) {
      const doc = customDocs.value.find(d => d.id === activeCustomDocId.value);
      return doc?.content || '';
    }
    return '';
  },
  set: (val: string) => {
    if (activeRightTab.value === 'custom' && activeCustomDocId.value) {
      const doc = customDocs.value.find(d => d.id === activeCustomDocId.value);
      if (doc) doc.content = val;
    }
  }
});

// PM/DEV角色：当前激活的文档标题
const chatOnlyActiveDocTitle = computed(() => {
  if (activeRightTab.value === 'chatDoc' && activeChatDocId.value) {
    const doc = chatOnlyDocuments.value.find(d => d.id === activeChatDocId.value);
    return doc?.title || '文档';
  }
  if (activeRightTab.value === 'custom' && activeCustomDocId.value) {
    const doc = customDocs.value.find(d => d.id === activeCustomDocId.value);
    return doc?.title || '自定义文档';
  }
  if (activeRightTab.value === 'additional') return '辅助PRD';
  if (activeRightTab.value === 'figma') return 'Figma交互文档';
  return '文档';
});

// PM/DEV角色：删除文档
const removeChatOnlyDoc = (docId: string) => {
  const index = chatOnlyDocuments.value.findIndex(d => d.id === docId);
  if (index !== -1) {
    chatOnlyDocuments.value.splice(index, 1);
    // 如果删除的是当前激活的文档，切换到其他文档或清空
    if (activeChatDocId.value === docId) {
      if (chatOnlyDocuments.value.length > 0) {
        activeChatDocId.value = chatOnlyDocuments.value[0].id;
        activeRightTab.value = 'chatDoc';
      } else {
        activeRightTab.value = 'main';
        activeChatDocId.value = '';
      }
    }
  }
};

// ================= Figma辅助功能 =================
const showFigmaPanel = ref(false);  // 是否显示Figma输入面板
const newFigmaUrl = ref('');  // Figma链接输入
const activeFigmaDocId = ref<string>('');  // 当前查看的Figma文档ID

// ================= 用户角色（首屏选择 + 缓存） =================
type UserRole = 'pm' | 'dev' | 'qa';
const USER_ROLE_STORAGE_KEY = 'ai_test_case_user_role';

const userRole = ref<UserRole | null>(null);
const isRoleMenuOpen = ref(false);

// ================= Phase 4: Composables 初始化 =================
const { sessionId, initSession, getSessionId } = useSession();
const { currentRole, switchRole: composableSwitchRole } = useRole();
const { currentStep: workflowStep, goToStep: workflowGoToStep, progress: workflowProgress, statusText: workflowStatusText, isComplete: workflowIsComplete } = useWorkflow();
const { taskState, startTracking, stopTracking, isRunning: taskIsRunning } = useTaskProgress();

// 新组件状态
const showBatchUploader = ref(false);
const knowledgePanelRef = ref<InstanceType<typeof KnowledgeBasePanel> | null>(null);
// 右侧面板标签页（docs: 文档, history: 历史, knowledge: 知识库, quality: 质量评估）
const rightPanelTab = ref<'docs' | 'history' | 'knowledge' | 'quality' | 'midscene'>('docs');

// 质量评估报告状态
const qualityReport = ref<EvaluationReport | null>(null);
const qualityLoading = ref(false);
const qualityError = ref('');

// 切换右侧面板（智能处理：没有文档时不切换回 docs）
const toggleRightPanel = (target: 'knowledge' | 'history' | 'quality' | 'midscene') => {
  if (rightPanelTab.value === target) {
    // 如果当前已经是目标面板，尝试切换回 docs
    // 但如果 QA 角色且没有文档，则不切换
    if (userRole.value === 'qa' && !hasAnyMainDoc.value) {
      // 没有文档，保持当前面板（知识库或历史）
      return;
    }
    rightPanelTab.value = 'docs';
  } else {
    rightPanelTab.value = target;
  }
};

// 桥接函数：RoleSelector 组件事件处理
const handleRoleSelectorChange = async (role: UserRole) => {
  // 调用原有的角色切换逻辑
  if (userRole.value) {
    await changeUserRole(role);
  } else {
    await selectUserRole(role);
  }
  // 同步到 composable（便于其他组件使用）
  composableSwitchRole(role);
};

// 桥接函数：WorkflowProgress 组件步骤点击
const handleWorkflowStepClick = (stepIndex: number) => {
  const stepMap: Step[] = ['content_review', 'prd_review', 'test_point', 'test_case', 'auto_test'];
  if (stepIndex >= 0 && stepIndex < stepMap.length) {
    goToStep(stepMap[stepIndex]);
  }
};

// 桥接函数：BatchUploader 上传完成
const handleBatchUploaded = (docIds: string[]) => {
  showBatchUploader.value = false;
  console.log('[App] Batch uploaded:', docIds);
};

// 桥接函数：知识库选择（批量选中，用于批量删除等）
const handleKnowledgeSelect = (docs: any[]) => {
  console.log('[App] Knowledge docs selected:', docs);
};

// 桥接函数：知识库文档点击 -> 添加到对话引用 / 加载为测试用例
const handleKnowledgeAddToChat = async (doc: any) => {
  console.log('[App] Knowledge doc add to chat:', doc);

  // 如果当前是 auto_test 步骤 或 test_case 步骤，加载知识库文档为测试用例（支持实时切换）
  if (
    (projectState.currentStep === 'auto_test' || projectState.currentStep === 'test_case') &&
    doc.docId
  ) {
    try {
      addMessage('ai', `正在加载知识库文档「${doc.title || doc.docId}」作为测试用例...`);
      const docData = await getDocContent(doc.docId);
      const content = docData.content || '';
      if (content) {
        projectState.documents.testCases = content;
        cachedTestCases.value = content;
        hasGeneratedTestCases.value = true;
        midsceneParsedCases.value = parseTestCases(content, testCaseOutputFormat.value);
        midsceneSelectedCases.value = new Set(midsceneParsedCases.value.map(c => c.id));
        projectState.documents.midsceneCasesJson = JSON.stringify(midsceneParsedCases.value, null, 2);

        // 智能命名：使用知识库文档标题
        autoNameTestCases({ docTitle: doc.title || doc.docId });

        // 切换视图到测试用例文档
        activeRightTab.value = 'main';
        activeMainDocType.value = 'testCases';
        switchToDocView();

        const casesCount = midsceneParsedCases.value.length;
        if (casesCount > 0) {
          addMessage('ai', `已从「${doc.title || doc.docId}」加载 **${casesCount}** 条测试用例，可勾选后执行。`);
        } else {
          addMessage('ai', `文档「${doc.title || doc.docId}」已加载为测试用例文档，但未解析出结构化用例。`);
        }
      }
    } catch (e) {
      console.error('[App] Failed to load knowledge doc as test cases:', e);
      addMessage('ai', `加载文档失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
    return;
  }

  // 默认行为：添加为对话引用
  const refDoc = {
    id: doc.docId || `knowledge-${Date.now()}`,
    title: doc.title || '知识库文档',
    content: '',
    kind: 'additional' as const,
  };
  // 避免重复添加
  if (!selectedRefDocs.value.some(d => d.id === refDoc.id)) {
    selectedRefDocs.value.push(refDoc);
  }
};

// P1: 桥接函数：使用历史用例
const handleHistoryUse = (content: string) => {
  console.log('[App] History case used:', content.slice(0, 100) + '...');
  // 将历史用例内容插入到输入框或当前文档
  if (userRole.value === 'qa') {
    // QA 模式：可以将内容作为参考
    userInput.value = `请参考以下历史用例:\n\n${content}\n\n`;
  } else {
    // PM/DEV 模式：直接插入到输入框
    userInput.value += content;
  }
  // 切换回文档视图（QA角色没有文档时切换到知识库）
  if (userRole.value === 'qa' && !hasAnyMainDoc.value) {
    rightPanelTab.value = 'knowledge';
  } else {
    rightPanelTab.value = 'docs';
  }
};

const isChatOnlyRole = computed(() => userRole.value === 'pm' || userRole.value === 'dev');

const userRoleLabel = computed(() => {
  if (!userRole.value) return '';
  if (userRole.value === 'pm') return '产品经理';
  if (userRole.value === 'dev') return '开发';
  return '测试';
});

const userRoleAvatarUrl = computed(() => {
  if (!userRole.value) return pmAvatarUrl;
  if (userRole.value === 'pm') return pmAvatarUrl;
  if (userRole.value === 'dev') return devAvatarUrl;
  return qaAvatarUrl;
});

const loadUserRoleFromStorage = async () => {
  try {
    const res = await browser.storage.local.get(USER_ROLE_STORAGE_KEY);
    const role = res?.[USER_ROLE_STORAGE_KEY] as unknown;
    if (role === 'pm' || role === 'dev' || role === 'qa') {
      userRole.value = role;
    } else {
      userRole.value = null;
    }
  } catch (e) {
    console.warn('加载用户角色失败:', e);
    userRole.value = null;
  }
};

const persistUserRoleToStorage = async (role: UserRole) => {
  await browser.storage.local.set({ [USER_ROLE_STORAGE_KEY]: role });
};

const chatOnlyInput = ref('');
const chatOnlyContainer = ref<HTMLElement | null>(null);
const chatOnlySessionId = ref(`chat-${Date.now()}`);
const showChatOnlyUrlInput = ref(false);
const chatOnlyUrlValue = ref('');

// ================= 统一输入区域（PM/DEV/QA共用） =================
const unifiedInput = ref('');
const showHintsPopup = ref(false);
const showStepActions = computed(() => userRole.value === 'qa');

// ================= Phase 5: 文件上传管理 =================
const fileUpload = useFileUpload();
const { attachments, isUploading: isFileUploading, hasError: hasFileError } = fileUpload;

// 待发送的附件 DocRefs（上传完成后填充）
const pendingAttachmentDocRefs = ref<DocRef[]>([]);
// 待显示的附件信息（用于消息UI显示）
const pendingAttachmentDisplayInfo = ref<MessageAttachmentInfo[]>([]);

// ================= 统一提取弹窗（辅助PRD / Figma / URL） =================
const showExtractModal = ref(false);
const extractModalUrlInput = ref('');  // URL 输入框

// ================= 参考确认弹窗增强 =================
const confirmPickedDocIds = ref<string[]>([]);  // 弹窗中选择的文档ID列表

// ================= “@ 引用右侧文档” =================
// 设计目标：
// - 用户在输入框输入 “@” 时，弹出右侧文档列表（按标题搜索）
// - 支持多选引用，发送时以 additionalPrds 列表传给后端
// - 优先级：若用户显式引用（selectedRefDocs 非空）> 右侧当前文档；若无引用则自动带当前右侧文档

type RefDoc = {
  id: string;
  title: string;
  content: string;
  kind: 'main' | 'url' | 'chatDoc' | 'additional' | 'figma' | 'custom' | 'ui';
};

const selectedRefDocs = ref<RefDoc[]>([]);
const showAtDocPicker = ref(false);
const atQuery = ref('');
// 本次发送要用的引用（避免发送中用户继续操作导致引用变化）
const pendingAdditionalPrds = ref<Array<{ title: string; content: string }>>([]);

const _getActiveRightDocSnapshot = (): RefDoc | null => {
  // QA：主文档
  if (userRole.value === 'qa' && activeRightTab.value === 'main') {
    const content = (activeMainDocContent.value || '').trim();
    if (!content) return null;
    return {
      id: `qa-main:${activeMainDocType.value}`,
      title: currentEditorTitle.value || '主文档',
      content,
      kind: 'main'
    };
  }

  // 通用：chatDoc
  if (activeRightTab.value === 'chatDoc' && activeChatDocId.value) {
    const content = (chatOnlyActiveDocContent.value || '').trim();
    if (!content) return null;
    return {
      id: `chatDoc:${activeChatDocId.value}`,
      title: chatOnlyActiveDocTitle.value || '文档',
      content,
      kind: 'chatDoc'
    };
  }

  // 通用：URL 文档
  if (activeRightTab.value === 'url' && activeUrlDocId.value) {
    const doc = urlDocs.value.find(d => d.id === activeUrlDocId.value);
    const content = (doc?.content || '').trim();
    if (!content) return null;
    return {
      id: `url:${doc!.id}`,
      title: doc?.title || 'URL文档',
      content,
      kind: 'url'
    };
  }

  // 通用：辅助 PRD
  if (activeRightTab.value === 'additional' && activeAdditionalPrdId.value) {
    const doc = additionalPrds.value.find(p => p.id === activeAdditionalPrdId.value);
    const content = (doc?.content || '').trim();
    if (!content) return null;
    return {
      id: `additional:${doc!.id}`,
      title: doc?.title || '辅助PRD',
      content,
      kind: 'additional'
    };
  }

  // 通用：Figma
  if (activeRightTab.value === 'figma' && activeFigmaDocId.value) {
    const doc = figmaDocs.value.find(f => f.id === activeFigmaDocId.value);
    const content = (doc?.content || '').trim();
    if (!content) return null;
    return {
      id: `figma:${doc!.id}`,
      title: doc?.title || 'Figma文档',
      content,
      kind: 'figma'
    };
  }

  // 通用：自定义文档
  if (activeRightTab.value === 'custom' && activeCustomDocId.value) {
    const doc = customDocs.value.find(d => d.id === activeCustomDocId.value);
    const content = (doc?.content || '').trim();
    if (!content) return null;
    return {
      id: `custom:${doc!.id}`,
      title: doc?.title || '自定义文档',
      content,
      kind: 'custom'
    };
  }

  return null;
};

const allRightDocsForAt = computed<RefDoc[]>(() => {
  const docs: RefDoc[] = [];

  // QA 主流程文档（用于 @ 选择）
  if (userRole.value === 'qa') {
    const prd = (projectState.documents.prd || '').trim();
    if (prd) docs.push({ id: 'qa:prd', title: currentPrdTitle.value || '主PRD', content: prd, kind: 'main' });

    const opt = (projectState.documents.optimizedPrd || '').trim();
    if (opt) docs.push({ id: 'qa:optimizedPrd', title: optimizedPrdTitle.value || '优化PRD', content: opt, kind: 'main' });

    const tp = (projectState.documents.testPoints || '').trim();
    if (tp) docs.push({ id: 'qa:testPoints', title: testPointsTitle.value || '测试点', content: tp, kind: 'main' });

    const tc = (projectState.documents.testCases || '').trim();
    if (tc) docs.push({ id: 'qa:testCases', title: testCasesTitle.value || '测试用例', content: tc, kind: 'main' });

    const plan = (projectState.documents.uiPlan || '').trim();
    if (plan) docs.push({ id: 'qa:uiPlan', title: 'UI自动化测试计划', content: plan, kind: 'ui' });

    const report = (projectState.documents.uiReport || '').trim();
    if (report) docs.push({ id: 'qa:uiReport', title: 'UI自动化测试报告', content: report, kind: 'ui' });
    
    // QA：URL 文档区（排除已设为主PRD的，避免重复）
    for (const d of urlDocs.value.filter(x => x.status === 'success' && !x.isMainPrd)) {
      const content = (d.content || '').trim();
      if (!content) continue;
      docs.push({ id: `url:${d.id}`, title: d.title || 'URL文档', content, kind: 'url' });
    }
  } else {
    // PM/DEV：提取文档列表
    for (const d of chatOnlyDocuments.value) {
      const content = (d.content || '').trim();
      if (!content) continue;
      docs.push({ id: `chatDoc:${d.id}`, title: d.title || '文档', content, kind: 'chatDoc' });
    }
    
    // PM/DEV：URL 文档区（与 QA 一致，所有成功提取的 URL 文档）
    for (const d of urlDocs.value.filter(x => x.status === 'success')) {
      const content = (d.content || '').trim();
      if (!content) continue;
      docs.push({ id: `url:${d.id}`, title: d.title || 'URL文档', content, kind: 'url' });
    }
  }

  // 通用：辅助PRD / Figma / 自定义文档
  for (const d of additionalPrds.value.filter(p => p.status === 'success')) {
    const content = (d.content || '').trim();
    if (!content) continue;
    docs.push({ id: `additional:${d.id}`, title: d.title || '辅助PRD', content, kind: 'additional' });
  }
  for (const d of figmaDocs.value.filter(f => f.status === 'success')) {
    const content = (d.content || '').trim();
    if (!content) continue;
    docs.push({ id: `figma:${d.id}`, title: d.title || 'Figma文档', content, kind: 'figma' });
  }
  for (const d of customDocs.value) {
    const content = (d.content || '').trim();
    if (!content) continue;
    docs.push({ id: `custom:${d.id}`, title: d.title || '自定义文档', content, kind: 'custom' });
  }

  // 按标题排序，便于搜索
  return docs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
});

const filteredRightDocsForAt = computed(() => {
  const q = (atQuery.value || '').trim().toLowerCase();
  const list = allRightDocsForAt.value;
  const out = q ? list.filter(d => (d.title || '').toLowerCase().includes(q)) : list;
  return out.slice(0, 30);
});

// ================= Phase 5: ChatInput 辅助计算属性 =================
// 提供给 ChatInput 组件的可引用文档列表
const allRightDocsForRef = computed(() => {
  return allRightDocsForAt.value.map(doc => ({
    docId: doc.id,
    title: doc.title,
    kind: doc.kind === 'main' ? 'main' : doc.kind === 'url' ? 'aux' : 'aux',
    logicalId: doc.id,
  }));
});

// 当前角色的快捷提示词
const currentRoleHints = computed(() => {
  const role = userRole.value;
  const step = projectState.currentStep;

  if (role === 'pm') {
    return [
      { label: '梳理范围', text: '梳理需求范围和优先级' },
      { label: '拆解模块', text: '拆解功能模块，列出核心功能和子功能' },
      { label: '边界条件', text: '补充边界条件和约束' },
      { label: '识别风险', text: '识别需求风险点和潜在问题' },
      { label: '优化文档', text: '优化需求文档结构和表述' },
    ];
  } else if (role === 'dev') {
    return [
      { label: '技术方案', text: '分析技术方案和实现思路' },
      { label: '技术风险', text: '识别技术风险和难点' },
      { label: '工时评估', text: '评估开发工时和里程碑' },
      { label: '接口设计', text: '设计接口规范和参数定义' },
      { label: '架构设计', text: '梳理系统架构和模块划分' },
    ];
  } else if (role === 'qa') {
    // 根据步骤返回不同提示词
    if (['setup', 'analyzing', 'content_review'].includes(step) || !step) {
      return [
        { label: '提取功能点', text: '提取核心功能点和业务逻辑' },
        { label: '整理结构', text: '整理文档结构，按模块分类' },
        { label: '业务流程', text: '分析业务流程和状态流转' },
        { label: '边界场景', text: '识别边界情况和异常场景' },
      ];
    } else if (['optimizing', 'prd_review'].includes(step)) {
      return [
        { label: '检测冲突', text: '检测当前PRD的逻辑冲突和矛盾' },
        { label: '识别风险', text: '识别潜在风险点和遗漏' },
        { label: '功能点清单', text: '结构化输出功能点清单' },
        { label: '验收标准', text: '补充测试相关的验收标准' },
      ];
    } else if (step === 'test_point') {
      return [
        { label: '边界测试点', text: '补充边界值测试点' },
        { label: '覆盖率检查', text: '检查测试点覆盖率是否完整' },
        { label: '异常场景', text: '补充异常和错误场景测试点' },
        { label: '性能测试点', text: '补充性能相关测试点' },
      ];
    } else if (step === 'test_case') {
      return [
        { label: '评审用例', text: '评审当前用例的覆盖率和完整性' },
        { label: '检查步骤', text: '检查测试步骤和预期结果是否清晰' },
        { label: '补充异常', text: '补充异常和边界测试用例' },
        { label: '优化分类', text: '优化用例优先级和分类' },
      ];
    } else if (step === 'auto_test') {
      return [
        { label: '分析页面', text: '分析当前页面结构和元素' },
        { label: '生成计划', text: '生成UI自动化测试计划' },
        { label: '执行测试', text: '执行测试计划并生成报告' },
        { label: '点击按钮', text: '点击登录按钮' },
      ];
    }
  }
  return [];
});

const clearAtPicker = () => {
  showAtDocPicker.value = false;
  atQuery.value = '';
};

// 检查文档是否已入库（有 docRef）
const isDocSaved = (doc: RefDoc): boolean => {
  const docId = doc.id;
  
  // QA 主文档
  if (doc.kind === 'main') {
    if (docId.includes('optimizedPrd') && generatedDocRefs.optimizedPrd?.docId) return true;
    if (docId.includes('testPoints') && generatedDocRefs.testPoints?.docId) return true;
    if (docId.includes('testCases') && generatedDocRefs.testCases?.docId) return true;
    if (docId === 'main:prd') {
      const mainPrdDoc = urlDocs.value.find(d => d.isMainPrd);
      return !!(mainPrdDoc?.docRef?.docId);
    }
    return false;
  }
  
  // URL 文档
  if (doc.kind === 'url') {
    const urlDoc = urlDocs.value.find(d => `url:${d.id}` === docId);
    return !!(urlDoc?.docRef?.docId);
  }
  
  // 辅助 PRD
  if (doc.kind === 'additional') {
    const prdDoc = additionalPrds.value.find(p => `additional:${p.id}` === docId);
    return !!(prdDoc?.docRef);
  }
  
  // Figma 文档
  if (doc.kind === 'figma') {
    const figmaDoc = figmaDocs.value.find(f => `figma:${f.id}` === docId);
    return !!(figmaDoc?.docRef);
  }
  
  // 自定义文档
  if (doc.kind === 'custom') {
    const customDoc = customDocs.value.find(c => `custom:${c.id}` === docId);
    return !!(customDoc?.docRef);
  }
  
  // PM/DEV 聊天文档
  if (doc.kind === 'chatDoc') {
    const chatDoc = chatOnlyDocuments.value.find(c => `chatDoc:${c.id}` === docId);
    return !!(chatDoc?.docRef);
  }
  
  return false;
};

const addRefDoc = (doc: RefDoc) => {
  if (!doc?.id) return;
  if (selectedRefDocs.value.some(d => d.id === doc.id)) {
    clearAtPicker();
    return;
  }
  selectedRefDocs.value.push(doc);

  // 仅处理输入框末尾的 @xxx：选中后移除该 token，避免污染指令文本
  unifiedInput.value = (unifiedInput.value || '').replace(/@([^\s@]{0,40})$/, '').trimEnd();
  clearAtPicker();
};

const removeRefDoc = (id: string) => {
  selectedRefDocs.value = selectedRefDocs.value.filter(d => d.id !== id);
};

const clearAllRefDocs = () => {
  selectedRefDocs.value = [];
  // 清空引用后，不应残留到接口参数里
  pendingAdditionalPrds.value = [];
  confirmPickedDocIds.value = [];
};

// 获取全局参考文档（参考按钮面板内的文档：additionalPrds + figmaDocs）
const getGlobalReferenceDocs = (): Array<{ title: string; content: string }> => {
  const successfulPrds = additionalPrds.value.filter(p => p.status === 'success');
  const successfulFigmas = figmaDocs.value.filter(f => f.status === 'success');
  const out: Array<{ title: string; content: string }> = [];
  for (const prd of successfulPrds) out.push({ title: `[辅助PRD] ${prd.title}`, content: prd.content });
  for (const figma of successfulFigmas) out.push({ title: `[Figma交互补充] ${figma.title}`, content: figma.content });
  return out;
};

// 判断是否有参考和引用
const hasAnyReference = computed(() => {
  return selectedRefDocs.value.length > 0 || getGlobalReferenceDocs().length > 0;
});

// 获取弹窗可选择的文档列表（用于参考确认弹窗）
const confirmPickDocs = computed(() => {
  return allRightDocsForAt.value.slice(0, 20);
});

// 是否需要在参考确认弹窗显示列表选择功能
const shouldShowRefPickInConfirm = computed(() => {
  return selectedRefDocs.value.length === 0 && getGlobalReferenceDocs().length === 0;
});

// 使用弹窗选中的文档继续操作
const confirmUsePickedDocs = async () => {
  const picked = confirmPickDocs.value.filter(d => confirmPickedDocIds.value.includes(d.id));
  pendingAdditionalPrds.value = picked.map(d => ({ title: d.title, content: d.content }));
  showReferenceConfirmModal.value = false;
  confirmPickedDocIds.value = [];

  if (referenceConfirmAction.value === 'optimize') await optimizePRD();
  else await proceedToGenerateTestCases();
};

/**
 * 构建 additionalPrds（全局带辅助PRD+Figma；URL/自定义仅在 @ 引用或弹窗选择时带）
 *
 * 注意：这里的“标题前缀”会影响后端 ask_graph 对文档分类，从而决定进入哪个标签：
 * - `[辅助PRD] ...` → 后端会放进 `[辅助PRD]...[/辅助PRD]`
 * - `[Figma交互补充] ...` → 后端会放进 `[Figma交互补充]...[/Figma交互补充]`
 * - 其他标题 → 后端会放进 `[补充说明]...[/补充说明]`
 */
const buildAdditionalPrdsForRequest = (opts?: {
  selected?: RefDoc[];
  pickedOnce?: Array<{ title: string; content: string }>;
}): Array<{ title: string; content: string }> => {
  const result: Array<{ title: string; content: string }> = [];
  const selected = opts?.selected ?? selectedRefDocs.value;
  const pickedOnce = opts?.pickedOnce ?? pendingAdditionalPrds.value;
  
  // 1) 全局引用：辅助PRD（additionalPrds）和 Figma 文档（始终带上）
  const successfulPrds = additionalPrds.value.filter(p => p.status === 'success');
  const successfulFigmas = figmaDocs.value.filter(f => f.status === 'success');
  
  // 0) 一次性引用（弹窗选择）：优先级最高（放最前面）
  if (pickedOnce && pickedOnce.length > 0) {
    for (const picked of pickedOnce) {
      result.push(picked);
    }
  }

  for (const prd of successfulPrds) {
    result.push({ title: `[辅助PRD] ${prd.title}`, content: prd.content });
  }
  for (const figma of successfulFigmas) {
    result.push({ title: `[Figma交互补充] ${figma.title}`, content: figma.content });
  }
  
  // 2) 输入框 @ 引用：只包含 URL 和自定义文档（主PRD 不应该出现在这里）
  if (selected && selected.length > 0) {
    for (const doc of selected) {
      // 只添加 URL 和自定义文档，排除主PRD相关文档
      if (doc.kind === 'url' || doc.kind === 'custom') {
        // 排除主PRD（通过ID判断）
        if (!doc.id.startsWith('qa:prd') && !doc.id.startsWith('qa:optimizedPrd') && 
            !doc.id.startsWith('qa:testPoints') && !doc.id.startsWith('qa:testCases') &&
            doc.id !== 'qa:uiPlan' && doc.id !== 'qa:uiReport') {
          result.push({ title: doc.title, content: doc.content });
        }
      }
    }
  }
  
  // 去重：按 title 优先，其次按 content 前缀
  const seen = new Set<string>();
  const deduped: Array<{ title: string; content: string }> = [];
  for (const d of result) {
    const key = `${(d.title || '').trim()}::${(d.content || '').trim().slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(d);
  }

  // 控制数量，避免 token 爆炸
  return deduped.slice(0, 6);
};

/**
 * 根据“@ 引用”构建本次 ask/prdAgent/testCaseAgent 的主文本（params.text / text）
 * 规则（按你的要求）：
 * - 如果用户在输入框用 @ 选择了文档：把“选中的文档内容”作为 text
 * - 输入框文本永远作为 instruction
 * - 如果没有 @ 引用：text 使用当前步骤默认上下文（由调用方传入 fallback）
 */
const buildPrimaryTextFromAtSelection = (selected: RefDoc[], fallback: string): string => {
  if (!selected || selected.length === 0) return fallback;
  const blocks: string[] = [];
  for (const d of selected) {
    const content = (d.content || '').trim();
    if (!content) continue;
    // 用标题分段，便于模型理解来源
    blocks.push(`## ${d.title}\n\n${content}`);
  }
  const merged = blocks.join('\n\n---\n\n').trim();
  return merged || fallback;
};

// 监听输入框：当末尾出现 @xxx 时弹出候选列表（按标题检索）
watch(unifiedInput, (val) => {
  const s = (val || '').toString();
  const m = s.match(/@([^\s@]{0,40})$/);
  if (m) {
    showAtDocPicker.value = true;
    atQuery.value = m[1] || '';
    return;
  }
  clearAtPicker();
});

// 当前提示词标题（根据角色和步骤动态显示）
const currentHintsTitle = computed(() => {
  if (userRole.value === 'pm') return 'PM 产品经理提示词';
  if (userRole.value === 'dev') return 'DEV 开发者提示词';
  if (userRole.value === 'qa') {
    const step = projectState.currentStep;
    if (['setup', 'analyzing', 'content_review'].includes(step) || !step) return 'QA 分析阶段提示词';
    if (['optimizing', 'prd_review'].includes(step)) return 'QA 优化阶段提示词';
    if (step === 'test_point') return 'QA 测试点阶段提示词';
    if (step === 'test_case') return 'QA 测试用例阶段提示词';
    if (step === 'auto_test') return 'QA 自动化测试提示词';
  }
  return '快捷提示词';
});

// 统一输入框占位符
const unifiedInputPlaceholder = computed(() => {
  if (userRole.value === 'pm') return '像产品经理一样提问：梳理需求、范围、优先级、风险...';
  if (userRole.value === 'dev') return '像开发一样提问：实现方案、边界条件、技术风险、拆分任务...';
  // QA角色根据步骤显示不同提示
  if (userRole.value === 'qa') {
    const step = projectState.currentStep;
    if (['setup', 'analyzing', 'content_review'].includes(step)) return '分析助手：提取关键信息、整理结构...';
    if (['optimizing', 'prd_review'].includes(step)) return 'PRD智能助手：删除模块、检测冲突、识别风险...';
    if (step === 'test_point') return '测试点助手：补充边界、优化覆盖...';
    if (step === 'test_case') return 'Test Case助手：补充异常场景、评审覆盖率...';
    if (step === 'auto_test') return uiEngine.value === 'midscene'
      ? '输入命令：生成用例 / 执行测试 / 分析页面 / 点击按钮...'
      : '输入指令（如：点击登录按钮 / 输入admin到用户名）';
    // Midscene 智能路由：任意 Step 都支持
    if (uiEngine.value === 'midscene') return '输入命令：基于当前页面生成用例 / 根据URL生成用例 / 分析页面...';
  }
  return '请输入...';
});

// 是否有任何文档
const hasAnyDocument = computed(() => {
  if (userRole.value === 'qa') {
    return hasGeneratedPRD.value || hasGeneratedTestPoints.value || hasGeneratedTestCases.value || urlDocs.value.length > 0 || additionalPrds.value.length > 0 || figmaDocs.value.length > 0 || customDocs.value.length > 0;
  }
  return chatOnlyDocuments.value.length > 0 || additionalPrds.value.length > 0 || figmaDocs.value.length > 0 || customDocs.value.length > 0;
});

// 是否有任何主文档内容（QA角色）
const hasAnyMainDoc = computed(() => {
  const mainUrlPrd = urlDocs.value.find(d => d.isMainPrd);
  return !!(projectState.documents.prd || mainUrlPrd || projectState.documents.optimizedPrd || projectState.documents.testPoints || projectState.documents.testCases);
});

// 监听文档状态，QA角色没有文档时自动切换到知识库
watch([hasAnyMainDoc, userRole], ([hasDoc, role]) => {
  if (!hasDoc && role === 'qa' && rightPanelTab.value === 'docs') {
    rightPanelTab.value = 'knowledge';
  }
}, { immediate: true });


// Tab列表（用于折叠展示）
type TabItem = {
  key: string;
  label: string;
  type: RightPanelTab;
  mainDocType?: MainDocType;
  id?: string;
  onClick: () => void;
  onDblClick: () => void;
};

// Tab标签文本截断（全局固定长度）
const TAB_LABEL_MAX_LENGTH = 8;
const truncateTabLabel = (text: string, maxLength: number = TAB_LABEL_MAX_LENGTH): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

const allTabs = computed<TabItem[]>(() => {
  const tabs: TabItem[] = [];
  
  // 检查是否有 URL 文档被设为主PRD
  const mainUrlPrd = urlDocs.value.find(d => d.isMainPrd);
  
  if (userRole.value === 'qa') {
    // QA主文档Tabs - 主PRD（仅在有内容时显示）
    if (projectState.documents.prd || mainUrlPrd) {
      tabs.push({
        key: 'main:prd',
        label: `${mainUrlPrd ? '⭐' : '📄'} ${truncateTabLabel(currentPrdTitle.value || '主PRD')}`,
        type: 'main',
        mainDocType: 'prd',
        onClick: () => { activeRightTab.value = 'main'; activeMainDocType.value = 'prd'; switchToDocView(); },
        onDblClick: () => renameQaMainDocTitle('prd')
      });
    }

    if (projectState.documents.optimizedPrd) {
      tabs.push({
        key: 'main:optimizedPrd',
        label: `✨ ${truncateTabLabel(optimizedPrdTitle.value)}`,
        type: 'main',
        mainDocType: 'optimizedPrd',
        onClick: () => { activeRightTab.value = 'main'; activeMainDocType.value = 'optimizedPrd'; switchToDocView(); },
        onDblClick: () => renameQaMainDocTitle('optimizedPrd')
      });
    }
    
    if (projectState.documents.testPoints) {
      tabs.push({
        key: 'main:testPoints',
        label: `🎯 ${truncateTabLabel(testPointsTitle.value)}`,
        type: 'main',
        mainDocType: 'testPoints',
        onClick: () => { activeRightTab.value = 'main'; activeMainDocType.value = 'testPoints'; switchToDocView(); },
        onDblClick: () => renameQaMainDocTitle('testPoints')
      });
    }
    
    if (projectState.documents.testCases) {
      tabs.push({
        key: 'main:testCases',
        label: `📋 ${truncateTabLabel(testCasesTitle.value)}`,
        type: 'main',
        mainDocType: 'testCases',
        onClick: () => { activeRightTab.value = 'main'; activeMainDocType.value = 'testCases'; switchToDocView(); },
        onDblClick: () => renameQaMainDocTitle('testCases')
      });
    }
    
    // URL文档Tabs（排除已设为主PRD的，主PRD已在主文档Tab中显示）
    for (const doc of urlDocs.value.filter(d => d.status === 'success' && !d.isMainPrd)) {
      tabs.push({
        key: `url:${doc.id}`,
        label: `🔗 ${truncateTabLabel(doc.title || 'URL')}`,
        type: 'url',
        id: doc.id,
        onClick: () => { activeRightTab.value = 'url'; activeUrlDocId.value = doc.id; switchToDocView(); },
        onDblClick: () => renameUrlDocTitle(doc.id)
      });
    }
  } else {
    // PM/DEV文档Tabs
    for (const doc of chatOnlyDocuments.value) {
      tabs.push({
        key: `chatDoc:${doc.id}`,
        label: `📄 ${truncateTabLabel(doc.title || '文档')}`,
        type: 'chatDoc',
        id: doc.id,
        onClick: () => { activeRightTab.value = 'chatDoc'; activeChatDocId.value = doc.id; switchToDocView(); },
        onDblClick: () => renameChatDocTitle(doc.id)
      });
    }
  }
  
  // 辅助PRD Tabs（通用）
  for (const prd of additionalPrds.value.filter(p => p.status === 'success')) {
    tabs.push({
      key: `additional:${prd.id}`,
      label: `📑 ${truncateTabLabel(formatPrdTitle(prd, 20))}`,
      type: 'additional',
      id: prd.id,
      onClick: () => { activeRightTab.value = 'additional'; activeAdditionalPrdId.value = prd.id; switchToDocView(); },
      onDblClick: () => renameAdditionalPrdTitle(prd.id)
    });
  }
  
  // Figma Tabs（通用）
  for (const figma of figmaDocs.value.filter(f => f.status === 'success')) {
    tabs.push({
      key: `figma:${figma.id}`,
      label: `🎨 ${truncateTabLabel(formatPrdTitle(figma, 20))}`,
      type: 'figma',
      id: figma.id,
      onClick: () => { activeRightTab.value = 'figma'; activeFigmaDocId.value = figma.id; switchToDocView(); },
      onDblClick: () => renameFigmaTitle(figma.id)
    });
  }
  
  // 自定义文档 Tabs（通用）
  for (const doc of customDocs.value) {
    tabs.push({
      key: `custom:${doc.id}`,
      label: `📝 ${truncateTabLabel(doc.title || '自定义')}`,
      type: 'custom',
      id: doc.id,
      onClick: () => { activeRightTab.value = 'custom'; activeCustomDocId.value = doc.id; switchToDocView(); },
      onDblClick: () => renameCustomDocTitle(doc.id)
    });
  }
  
  return tabs;
});

// 可见Tab和折叠Tab
const visibleTabs = computed(() => allTabs.value.slice(0, MAX_VISIBLE_TABS));
const overflowTabs = computed(() => allTabs.value.slice(MAX_VISIBLE_TABS));

// 判断Tab是否激活
const isTabActive = (tab: TabItem): boolean => {
  if (tab.type === 'main' && tab.mainDocType) {
    return activeRightTab.value === 'main' && activeMainDocType.value === tab.mainDocType;
  }
  if (tab.type === 'url' && tab.id) {
    return activeRightTab.value === 'url' && activeUrlDocId.value === tab.id;
  }
  if (tab.type === 'chatDoc' && tab.id) {
    return activeRightTab.value === 'chatDoc' && activeChatDocId.value === tab.id;
  }
  if (tab.type === 'additional' && tab.id) {
    return activeRightTab.value === 'additional' && activeAdditionalPrdId.value === tab.id;
  }
  if (tab.type === 'figma' && tab.id) {
    return activeRightTab.value === 'figma' && activeFigmaDocId.value === tab.id;
  }
  if (tab.type === 'custom' && tab.id) {
    return activeRightTab.value === 'custom' && activeCustomDocId.value === tab.id;
  }
  return false;
};

// 当前编辑器标题
const currentEditorTitle = computed(() => {
  if (userRole.value === 'qa') {
    if (activeRightTab.value === 'url') {
      const doc = urlDocs.value.find(d => d.id === activeUrlDocId.value);
      return doc?.title || 'URL文档';
    }
    if (activeRightTab.value === 'additional') return '辅助PRD';
    if (activeRightTab.value === 'figma') return 'Figma交互文档';
    if (activeRightTab.value === 'custom') {
      const doc = customDocs.value.find(d => d.id === activeCustomDocId.value);
      return doc?.title || '自定义文档';
    }
    switch (activeMainDocType.value) {
      case 'prd': return currentDocTitle.value || '主PRD';
      case 'optimizedPrd': return `✨ ${optimizedPrdTitle.value}`;
      case 'testPoints': return `🎯 ${testPointsTitle.value}`;
      case 'testCases': return `📋 ${testCasesTitle.value}`;
      default: return '文档';
    }
  }
  return chatOnlyActiveDocTitle.value;
});

// 设置提示词
const setHint = (hint: string) => {
  unifiedInput.value = hint;
  showHintsPopup.value = false;
};

// 处理统一输入框的回车
const handleUnifiedKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendUnifiedMessage();
  }
};

// 发送统一消息

const sendQaAskMessage = async (opts?: {
  selected?: RefDoc[];
  additionalPrds?: Array<{ title: string; content: string }>;
}) => {
  const hasText = unifiedInput.value.trim().length > 0;
  const hasAttachments = pendingAttachmentDocRefs.value.length > 0;
  if ((!hasText && !hasAttachments) || isProcessing.value) return;

  const userText = unifiedInput.value.trim() || '请基于上传的文档进行分析';
  const step = projectState.currentStep || '';
  const askType = getQaAskTypeByStep(step);
  const sid = ensureSessionId();

  // 选择的 @ 文档（作为主 text 的优先来源）
  const frozenSelected = opts?.selected ?? selectedRefDocs.value;

  // fallback：按阶段选择默认主文本
  const baseForPrdStage =
    step === 'prd_review' || step === 'test_point' || step === 'test_case'
      ? (projectState.documents.optimizedPrd || projectState.documents.prd)
      : (projectState.documents.prd || projectState.documents.optimizedPrd);

  const fallbackText =
    askType === 'testprd'
      ? baseForPrdStage
      : (projectState.documents.optimizedPrd || projectState.documents.prd);

  const primaryText = buildPrimaryTextFromAtSelection(frozenSelected, fallbackText);

  // additionalPrds：全局辅助PRD+Figma + 一次性引用 + @ 引用（URL/自定义）
  const additionalPrdsToSend =
    opts?.additionalPrds ?? buildAdditionalPrdsForRequest({ selected: frozenSelected });

  // testcase 阶段：把"测试点"作为辅助输入（不要把测试点当 main）
  if (askType === 'testcase' && projectState.documents.testPoints?.trim()) {
    additionalPrdsToSend.unshift({
      title: '[测试点]',
      content: projectState.documents.testPoints,
    });
  }

  // UI 状态：先落 user 消息（包含附件信息），再清空输入和选择
  const attachmentsToShow = pendingAttachmentDisplayInfo.value.length > 0
    ? [...pendingAttachmentDisplayInfo.value]
    : undefined;
  addMessage('user', userText, attachmentsToShow);
  unifiedInput.value = '';
  selectedRefDocs.value = [];
  pendingAdditionalPrds.value = [];
  pendingAttachmentDisplayInfo.value = [];

  isProcessing.value = true;
  
  // 显示当前操作的目标文档（便于用户了解 AI 正在分析/编辑哪个文档）
  const docNameMap: Record<string, string> = {
    testprd: '优化PRD',
    testpoint: '测试点',
    testcase: '测试用例',
  };
  const targetDocName = docNameMap[askType] || '文档';
  statusText.value = `正在分析「${targetDocName}」...`;

  try {
    const codeMap: Record<string, string> = {
      testprd: 'plugin_test_testprd',
      testpoint: 'plugin_test_testpoint',
      testcase: 'plugin_test_testcase',
    };
    
    // ✅ 新增：@ 多选模式 - 将 @ 选中的文档作为 main 候选
    const atSelectedDocRefs = buildDocRefsForAtSelection(frozenSelected);
    const hasAtSelection = atSelectedDocRefs.length > 0;

    // 如果没有 @ 选择，则使用默认的 buildDocRefsForChat
    let docRefs = hasAtSelection ? atSelectedDocRefs : buildDocRefsForChat();

    // Phase 6: 添加附件的 docRef
    if (pendingAttachmentDocRefs.value.length > 0) {
      console.log('[sendQaAskMessage] 添加附件 docRefs:', pendingAttachmentDocRefs.value);
      docRefs = [...docRefs, ...pendingAttachmentDocRefs.value];
    }

    const useDocRefs = docRefs.length > 0;

    console.log('[sendQaAskMessage] @ 多选模式:', hasAtSelection, 'docRefs:', docRefs, '附件:', pendingAttachmentDocRefs.value.length);
    
    // 使用 chat 类型进行对话（区分分析类和编辑类）
    const chatType = `${askType}_chat` as 'testprd_chat' | 'testpoint_chat' | 'testcase_chat';
    
    // ✅ 多选模式：不指定 targetLogicalId，由模型决定
    // 单选模式：根据阶段设置默认 targetLogicalId
    const targetLogicalIdMap: Record<string, string> = {
      testprd: 'optimized_prd_current',
      testpoint: 'testpoints_current',
      testcase: 'testcases_current',
    };
    // 如果有多个 @ 选择，不指定 targetLogicalId，让模型选择
    const targetLogicalId = hasAtSelection && atSelectedDocRefs.length > 1 
      ? undefined  // 多选模式：由模型决定
      : (hasAtSelection && atSelectedDocRefs[0]?.logicalId) || targetLogicalIdMap[askType];

    // 更新 loading 状态
    if (hasAtSelection && atSelectedDocRefs.length > 1) {
      statusText.value = `正在分析 ${atSelectedDocRefs.length} 个文档...`;
    }

    const res = await ask({
      code: codeMap[askType] || `plugin_test_${askType}`,
      type: chatType as any,  // 使用 chat 类型，后端会区分 analysis/edit
      sessionId: sid,
      params: {
        text: useDocRefs ? '' : primaryText,
      },
      instruction: userText,
      docRefs: useDocRefs ? docRefs : undefined,
      additionalPrds: useDocRefs ? undefined : additionalPrdsToSend,
      targetLogicalId: targetLogicalId,  // 告知后端目标文档
    });

    // 同步 sessionId（后端可能回写）
    if (res?.sessionId) projectState.assets.sessionId = res.sessionId;

    // 检查响应中的 mode（分析类 vs 编辑类）
    const mode = (res as any).mode;
    const updatedDocument = (res as any).updatedDocument;
    const generatedDocRef = (res as any).generatedDocRef;
    // ✅ 新增：获取模型选择的目标文档
    const modelTargetLogicalId = (res as any).targetLogicalId as string | undefined;
    
    // ✅ 多选模式：显示模型选择的目标文档
    if (hasAtSelection && atSelectedDocRefs.length > 1 && modelTargetLogicalId) {
      const targetTitle = docRefs.find(r => r.logicalId === modelTargetLogicalId)?.title || modelTargetLogicalId;
      console.log('[sendQaAskMessage] 模型选择的目标文档:', modelTargetLogicalId, targetTitle);
    }
    
    if (mode === 'edit' && updatedDocument) {
      // ✅ 编辑类命令：根据 modelTargetLogicalId 或 askType 更新对应文档
      const effectiveLogicalId = modelTargetLogicalId || targetLogicalId;
      
      if (effectiveLogicalId === 'optimized_prd_current' || (!effectiveLogicalId && askType === 'testprd')) {
        projectState.documents.optimizedPrd = updatedDocument;
        cachedPRD.value = updatedDocument;
        hasGeneratedPRD.value = true;
        activeMainDocType.value = 'optimizedPrd';
        addMessage('ai', `✏️ 已更新优化PRD：${res.answer || '（已应用修改）'}`);
      } else if (effectiveLogicalId === 'testpoints_current' || (!effectiveLogicalId && askType === 'testpoint')) {
        projectState.documents.testPoints = updatedDocument;
        cachedTestPoints.value = updatedDocument;
        hasGeneratedTestPoints.value = true;
        activeMainDocType.value = 'testPoints';
        addMessage('ai', `✏️ 已更新测试点：${res.answer || '（已应用修改）'}`);
      } else if (effectiveLogicalId === 'testcases_current' || (!effectiveLogicalId && askType === 'testcase')) {
        projectState.documents.testCases = updatedDocument;
        cachedTestCases.value = updatedDocument;
        hasGeneratedTestCases.value = true;
        activeMainDocType.value = 'testCases';
        addMessage('ai', `✏️ 已更新测试用例：${res.answer || '（已应用修改）'}`);
      } else {
        // ✅ 其他文档（URL/辅助PRD/Figma/自定义）：根据 logicalId 更新
        const targetUrl = urlDocs.value.find(d => d.logicalId === effectiveLogicalId);
        const targetPrd = additionalPrds.value.find(p => p.logicalId === effectiveLogicalId);
        const targetFigma = figmaDocs.value.find(f => f.logicalId === effectiveLogicalId);
        const targetCustom = customDocs.value.find(c => c.logicalId === effectiveLogicalId);
        
        if (targetUrl) {
          targetUrl.content = updatedDocument;
          targetUrl.lastSavedContent = updatedDocument;
          if (generatedDocRef) targetUrl.docRef = generatedDocRef;
          addMessage('ai', `✏️ 已更新URL文档「${targetUrl.title}」：${res.answer || '（已应用修改）'}`);
        } else if (targetPrd) {
          targetPrd.content = updatedDocument;
          targetPrd.lastSavedContent = updatedDocument;
          if (generatedDocRef) targetPrd.docRef = generatedDocRef as DocRef;
          addMessage('ai', `✏️ 已更新辅助PRD「${targetPrd.title}」：${res.answer || '（已应用修改）'}`);
        } else if (targetFigma) {
          targetFigma.content = updatedDocument;
          targetFigma.lastSavedContent = updatedDocument;
          if (generatedDocRef) targetFigma.docRef = generatedDocRef as DocRef;
          addMessage('ai', `✏️ 已更新Figma文档「${targetFigma.title}」：${res.answer || '（已应用修改）'}`);
        } else if (targetCustom) {
          targetCustom.content = updatedDocument;
          targetCustom.lastSavedContent = updatedDocument;
          if (generatedDocRef) targetCustom.docRef = generatedDocRef as DocRef;
          addMessage('ai', `✏️ 已更新自定义文档「${targetCustom.title}」：${res.answer || '（已应用修改）'}`);
        } else {
          addMessage('ai', `✏️ 文档已更新（${effectiveLogicalId}）：${res.answer || '（已应用修改）'}`);
        }
      }
      
      // 如果有 generatedDocRef，更新 generatedDocRefs（用于后续阶段的 docRefs）
      if (generatedDocRef) {
        console.log('[sendQaAskMessage] 编辑后生成新版本:', generatedDocRef);
        if (askType === 'testprd') {
          generatedDocRefs.optimizedPrd = generatedDocRef;
        } else if (askType === 'testpoint') {
          generatedDocRefs.testPoints = generatedDocRef;
        } else if (askType === 'testcase') {
          generatedDocRefs.testCases = generatedDocRef;
        }
      }
    } else {
      // 分析类命令：只在聊天区输出
      addMessage('ai', res.answer || '（无输出）');
    }
  } catch (error: any) {
    console.error('QA ask failed:', error);
    addMessage('ai', `❌ 请求失败：${error?.message || error}`);
  } finally {
    isProcessing.value = false;
    statusText.value = '';
  }
};

const sendUnifiedMessage = async () => {
  const hasText = unifiedInput.value.trim().length > 0;
  const hasAttachments = pendingAttachmentDocRefs.value.length > 0;
  if ((!hasText && !hasAttachments) || isProcessing.value) return;

  const msg = unifiedInput.value.trim() || '请基于上传的文档进行分析';
  const currentAgent = userRole.value;

  // 冻结引用（防止请求过程中状态变化）
  const frozenSelected = [...selectedRefDocs.value];
  const frozenAdditionalPrds = buildAdditionalPrdsForRequest({
    selected: frozenSelected,
    pickedOnce: pendingAdditionalPrds.value,
  });

  // QA 模式：Midscene 引擎开启时，任意 Step 都走智能路由
  if (currentAgent === 'qa') {
    if (uiEngine.value === 'midscene') {
      // ★ Midscene 智能路由：任意 Step 输入 → AI 判断意图 → 自动跳转
      await sendMidsceneSmartCommand(msg);
      unifiedInput.value = '';
    } else if (projectState.currentStep === 'auto_test') {
      await sendUiAgentMessage(msg, frozenSelected, frozenAdditionalPrds);
      unifiedInput.value = '';
    } else {
      await sendQaAskMessage({ selected: frozenSelected, additionalPrds: frozenAdditionalPrds });
    }
  } else {
    // product / dev：保持原聊天接口不变
    await sendChatOnlyMessage(msg);
    unifiedInput.value = ''; // 清空统一输入框
  }
};

// ================= Phase 6: 文件选择后立即上传 =================
const handleAddAttachment = async (files: File[]) => {
  // 1. 添加文件到队列（显示在等候区）
  const newAttachments = fileUpload.addFiles(files);
  console.log('[handleAddAttachment] 添加文件到队列:', newAttachments.map(a => a.name));

  // 2. 立即上传所有待上传的文件
  if (newAttachments.length > 0) {
    try {
      statusText.value = '正在上传附件...';

      // 上传所有待上传附件
      const docRefs = await fileUpload.uploadAll();
      console.log('[handleAddAttachment] 附件上传完成:', docRefs);

      // 上传完成后，docRef 已经保存在 attachment 对象中
      // 通过 useFileUpload 的 updateAttachment 方法自动更新

    } catch (error: any) {
      console.error('[handleAddAttachment] 附件上传失败:', error);
      // 失败的附件会显示错误状态，用户可以选择移除
    } finally {
      statusText.value = '';
    }
  }
};

// ================= Phase 6: 快捷生成测试用例（基于已上传附件） =================
const handleQuickGenerateFromAttachment = async (inputText?: string) => {
  // 收集已完成上传的附件
  const completedAttachments = attachments.value.filter(a => a.status === 'completed' && a.docRef);

  // 无附件时：如果有 PRD 文档，走标准生成测试用例流程
  if (completedAttachments.length === 0) {
    if (projectState.documents.prd || projectState.documents.optimizedPrd) {
      if (inputText?.trim()) {
        unifiedInput.value = inputText.trim();
      }
      startGenerateTestCases();
      return;
    }
    addMessage('ai', '⚠️ 请先上传文档或提取页面内容');
    return;
  }

  console.log('[handleQuickGenerateFromAttachment] 已完成的附件:', completedAttachments.map(a => a.name));

  // 构建 docRefs - 第一个设为 main（主文档），其余为 aux
  const docRefs: DocRef[] = [];
  completedAttachments.forEach((att, index) => {
    if (att.docRef) {
      const isMain = index === 0;  // 第一个附件作为主文档
      const ref: DocRef = {
        docId: att.docRef.docId || `att-${Date.now()}`,
        title: att.docRef.title || att.name || '附件',
        kind: isMain ? 'main' : 'aux',  // 第一个为 main，后续为 aux
        logicalId: isMain ? 'uploaded_prd_main' : `attachment_${att.docRef.docId}`,
      };
      docRefs.push(ref);
      // 保存主文档 docRef（用于后续质量评估获取 PRD 内容）
      if (isMain) {
        generatedDocRefs.uploadedPrd = ref;
      }
    }
  });

  // 构建附件信息用于消息显示
  const messageAttachments: MessageAttachmentInfo[] = completedAttachments.map(att => ({
    type: att.type === 'pdf' ? 'document' : att.type === 'image' ? 'image' : 'file',
    name: att.name
  }));

  // 构建 instruction（带上用户输入文本）
  const baseInstruction = '基于上传的文档直接生成测试用例';
  const userText = inputText?.trim()
    ? `${baseInstruction}\n\n用户补充说明: ${inputText.trim()}`
    : baseInstruction;
  addMessage('user', userText, messageAttachments);

  // 清空输入框和附件（立即清空，不等待异步操作完成）
  unifiedInput.value = '';
  fileUpload.clearAll();

  // 开始处理
  isProcessing.value = true;
  statusText.value = '正在生成测试用例...';

  try {
    const sid = ensureSessionId();

    // 直接调用 askV2，type 固定为 'testcase'
    const res = await askV2({
      sessionId: sid,
      type: 'testcase',  // 固定为测试用例类型
      instruction: userText,
      docRefs: docRefs,
      outputFormat: testCaseOutputFormat.value,
    });

    console.log('[handleQuickGenerateFromAttachment] askV2 响应:', res);

    if (res.status === 'success' && res.answer) {
      // 更新右侧面板显示测试用例
      projectState.documents.testCases = res.answer;
      activeMainDocType.value = 'testCases';
      projectState.currentStep = 'test_case';
      // 智能命名：基于附件文件名或用户输入
      const firstAttachment = completedAttachments[0];
      autoNameTestCases({ docTitle: firstAttachment?.name, instruction: inputText });

      // 保存 generatedDocRef
      if (res.generatedDocRef) {
        generatedDocRefs.testCases = res.generatedDocRef;
      }

      addMessage('ai', '✅ 测试用例已生成，请在右侧面板查看');
    } else {
      addMessage('ai', `❌ 生成失败：${res.message || res.answer || '未知错误'}`);
    }
  } catch (error: any) {
    console.error('[handleQuickGenerateFromAttachment] 失败:', error);
    addMessage('ai', `❌ 请求失败：${error?.message || error}`);
  } finally {
    isProcessing.value = false;
    statusText.value = '';
  }
};

// ================= Phase 5: ChatInput 发送处理器 =================
const handleChatInputSend = async (payload: ChatSendPayload) => {
  // 同步 unifiedInput 以便复用现有逻辑
  unifiedInput.value = payload.text;

  // 同步引用文档
  if (payload.refDocs && payload.refDocs.length > 0) {
    selectedRefDocs.value = payload.refDocs.map(doc => ({
      id: doc.docId || doc.logicalId || `ref-${Date.now()}`,
      title: doc.title || '引用文档',
      content: '',  // 内容将通过 docRef 获取
      kind: 'additional' as const
    }));
  }

  // Phase 6: 收集已上传完成的附件 docRefs
  pendingAttachmentDocRefs.value = [];
  pendingAttachmentDisplayInfo.value = [];

  // 只收集已完成上传的附件（因为文件选择时已经上传了）
  const completedAttachments = payload.attachments.filter(a => a.status === 'completed' && a.docRef);
  console.log('[handleChatInputSend] 已完成的附件:', completedAttachments.map(a => a.name));

  // 第一个附件设为 main（主文档），其余为 aux
  completedAttachments.forEach((att, index) => {
    if (att.docRef && !pendingAttachmentDocRefs.value.some(d => d.docId === att.docRef?.docId)) {
      const isMain = index === 0;  // 第一个附件作为主文档
      const ref: DocRef = {
        docId: att.docRef.docId || `att-${Date.now()}`,
        title: att.docRef.title || att.name || '附件',
        kind: isMain ? 'main' : 'aux',  // 第一个为 main，后续为 aux
        logicalId: isMain ? 'uploaded_prd_main' : `attachment_${att.docRef.docId}`,
      };
      pendingAttachmentDocRefs.value.push(ref);
      // 保存主文档 docRef（用于后续质量评估获取 PRD 内容）
      if (isMain) {
        generatedDocRefs.uploadedPrd = ref;
      }
      // 保存用于消息UI显示的附件信息
      pendingAttachmentDisplayInfo.value.push({
        type: att.type === 'pdf' ? 'document' : att.type === 'image' ? 'image' : 'file',
        name: att.name
      });
    }
  });

  // 检查是否有未完成上传的附件
  const pendingAttachments = payload.attachments.filter(a => a.status === 'pending' || a.status === 'uploading');
  if (pendingAttachments.length > 0) {
    addMessage('ai', '⚠️ 部分附件尚未上传完成，请稍候再发送');
    return;
  }

  // 立即清理附件UI（不等待异步操作完成）
  fileUpload.clearAll();

  // 调用现有发送逻辑
  await sendUnifiedMessage();

  // 清理临时数据
  pendingAttachmentDocRefs.value = [];
};

// 保存 URL 提取结果到 URL 区域（首次提取默认设为主PRD），并调用 upsert 入库
const saveUrlDoc = async (url: string, content: string, title: string): Promise<string> => {
  const id = `url-${Date.now()}`;
  const isFirst = urlDocs.value.length === 0 && !Boolean((projectState.documents.prd || '').trim());
  
  urlDocs.value.unshift({  // 最新的在前面
    id,
    url,
    title: title || 'URL文档',
    status: 'success',
    content,
    isMainPrd: isFirst  // 首次提取默认为主PRD
  });
  
  // 如果是首次提取，同时设置为主PRD
  if (isFirst) {
    projectState.documents.prd = content;
    currentPrdTitle.value = title || '主需求文档';
    projectState.currentStep = projectState.currentStep || 'content_review';
  }
  
  // 切换到 URL Tab 显示
  activeRightTab.value = 'url';
  activeUrlDocId.value = id;
  viewMode.value = 'preview';
  
  // === 调用 upsert 入库 ===
  try {
    const sessionId = ensureSessionId();
    if (isFirst) {
      // 首次提取，作为主 PRD 入库
      const docRef = await uploadRawPrd(sessionId, content, title || '主需求文档', id);
      console.log('[saveUrlDoc] 主PRD入库成功:', docRef);
      const doc = urlDocs.value.find(d => d.id === id);
      if (doc) {
        doc.docRef = docRef;
        doc.lastSavedContent = content;
        doc.logicalId = 'raw_prd';
      }
    } else {
      // 非首次提取，作为辅助文档入库
      const logicalId = `aux_url_${id}`;
      const docRef = await uploadAuxDoc(sessionId, content, title || 'URL文档', undefined, undefined, id);
      console.log('[saveUrlDoc] 辅助文档入库成功:', docRef);
      const doc = urlDocs.value.find(d => d.id === id);
      if (doc) {
        doc.docRef = docRef;
        doc.lastSavedContent = content;
        doc.logicalId = logicalId;
      }
    }
  } catch (e: any) {
    console.error('[saveUrlDoc] 入库失败:', e);
    // 入库失败不影响本地保存
  }
  
  return id;
};

// 弹窗内提取 URL
const extractModalUrl = async () => {
  const url = (extractModalUrlInput.value || '').trim();
  if (!url) return;
  if (!url.startsWith('http')) {
    addMessage('ai', '⚠️ 请输入有效的URL（以 http 或 https 开头）');
    return;
  }
  
  try {
    isProcessing.value = true;
    statusText.value = '正在提取链接内容...';
    addMessage('user', `🔗 提取链接：${url}`);
    
    const extractResult = await extractContentFromUrlWithFullAnalysis(url);
    const content = (extractResult?.content || '').trim();
    if (!content || content.length < 100) {
      throw new Error(`提取内容过少 (${content.length} 字符)`);
    }
    
    const title = deriveDocTitle(content, url, 'URL文档');
    const docId = await saveUrlDoc(url, content, title);
    
    extractModalUrlInput.value = '';
    addMessage('ai', `✅ 已提取并加入 URL 区域：《${title}》${urlDocs.value.find(d => d.id === docId)?.isMainPrd ? '（已设为主PRD）' : ''}（已入库）`);
  } catch (e: any) {
    addMessage('ai', `❌ 链接提取失败：${e?.message || e}`);
  } finally {
    isProcessing.value = false;
    statusText.value = '';
  }
};

// 开始全页分析
const startFullPageAnalysis = async () => {
  if (userRole.value === 'pm' || userRole.value === 'dev') {
    await startChatOnlyFullPageAnalysis();
  } else {
    await startAnalysis();
  }
};

// PM/DEV角色：提取的文档列表
interface ChatOnlyDocument {
  id: string;
  title: string;
  content: string;
  type: 'extracted' | 'url' | 'page';
  url?: string;
  createdAt: number;
  // ✅ 新增：文档保存相关字段（与 UrlDoc/CustomDoc 对齐）
  docRef?: DocRef;  // 入库后的文档引用
  lastSavedContent?: string;  // 上次保存的内容（用于 dirty 检测）
  logicalId?: string;  // 稳定的逻辑ID（例如 chatdoc_${id}）
}

const chatOnlyDocuments = ref<ChatOnlyDocument[]>([]);
const activeChatDocId = ref<string>('');

const chatOnlyPlaceholder = computed(() => {
  if (userRole.value === 'pm') return '像产品经理一样提问：梳理需求、范围、优先级、风险...';
  if (userRole.value === 'dev') return '像开发一样提问：实现方案、边界条件、技术风险、拆分任务...';
  return '请输入...';
});

const localAgentUrl = computed(() => getLocalAgentUrl());


const scrollChatOnlyToBottom = () => {
  nextTick(() => {
    const el = chatOnlyContainer.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
};

const initChatOnly = () => {
  // 重置消息，避免与 workflow 的消息串台
  messages.value = [];
  chatOnlySessionId.value = `${userRole.value}-chat-${Date.now()}`;
  const greet =
    userRole.value === 'pm'
      ? '你好，我是你的产品助手。你可以直接把需求/目标/约束发给我，我会帮你拆解、澄清、补齐。'
      : '你好，我是你的开发助手。你可以直接描述功能/问题/限制，我会帮你给出实现思路、边界与拆分建议。';
  addMessage('ai', greet);
  scrollChatOnlyToBottom();
};

const selectUserRole = async (role: UserRole) => {
  // 保存当前角色的状态（如果有）
  if (userRole.value) {
    saveRoleTabState();
  }
  
  userRole.value = role;
  await persistUserRoleToStorage(role);
  
  // 恢复新角色的Tab状态
  restoreRoleTabState(role);
  
  // 产品/开发：直接进入纯聊天；测试：保留 workflow
  if (role === 'qa') enterWorkflow();
  else initChatOnly();
};

const changeUserRole = async (role: UserRole) => {
  // 保存当前角色的状态
  if (userRole.value) {
    saveRoleTabState();
  }
  
  userRole.value = role;
  await persistUserRoleToStorage(role);
  isRoleMenuOpen.value = false;
  
  // 恢复新角色的Tab状态
  restoreRoleTabState(role);
  
  if (role === 'qa') {
    // 切到测试角色：进入 workflow 首页
    projectState.currentStep = '';
  } else {
    initChatOnly();
  }
};

const toggleRoleMenu = () => {
  isRoleMenuOpen.value = !isRoleMenuOpen.value;
};

const handleGlobalClick = () => {
  if (isRoleMenuOpen.value) isRoleMenuOpen.value = false;
  if (midsceneSettingsVisible.value) midsceneSettingsVisible.value = false;
};

const openRoleMenuFromLanding = () => {
  // 如果还在 landing，header 还不存在，因此这里直接清空角色触发首屏选择更直观
  // 说明：这不会清除缓存；只是让用户重新选择一次。
  userRole.value = null;
  isRoleMenuOpen.value = false;
};

onMounted(async () => {
  await loadUserRoleFromStorage();
  // 若缓存已有角色，直接进入对应的默认界面，避免“链路束缚”
  if (userRole.value) {
    if (userRole.value === 'qa') enterWorkflow();
    else initChatOnly();
  }
  window.addEventListener('click', handleGlobalClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalClick);
});

const handleChatOnlyKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatOnlyMessage();
  }
};

const buildRoleSystemPrompt = () => {
  if (userRole.value === 'pm') {
    return `你是一个资深产品经理助手。必须使用中文回复，输出结构化、可执行、可落地的建议。`;
  }
  if (userRole.value === 'dev') {
    return `你是一个资深软件开发助手。必须使用中文回复，优先给出可实现方案、边界条件与风险点。`;
  }
  return `你是一个智能助手。必须使用中文回复。`;
};

const sendChatOnlyMessage = async (userInput?: string) => {
  // 支持从 unifiedInput 传入，或使用 chatOnlyInput
  const inputText = userInput || chatOnlyInput.value;
  if (!inputText.trim() || isProcessing.value) return;
  if (!userRole.value || !isChatOnlyRole.value) return;

  const userText = inputText.trim();
  // 清空输入框（如果是从 unifiedInput 调用，需要在调用处清空）
  if (!userInput) {
    chatOnlyInput.value = '';
  }

  // ✅ 获取当前 @ 选中的文档
  const frozenSelected = [...selectedRefDocs.value];
  selectedRefDocs.value = [];  // 清空 @ 引用

  messages.value.push({ role: 'user', content: userText });
  const aiMsg: Message = { role: 'ai', content: '' };
  messages.value.push(aiMsg);
  scrollChatOnlyToBottom();

  isProcessing.value = true;
  statusText.value = 'AI 正在思考...';

  try {
    const role = userRole.value === 'pm' ? 'pm' : 'dev';
    const additionalPrdsToSend = buildAdditionalPrdsForRequest({ selected: frozenSelected });
    pendingAdditionalPrds.value = [];
    
    // ✅ 新增：构建 @ 选中文档的 docRefs（作为 main 候选）
    let atDocRefs = buildDocRefsForAtSelection(frozenSelected);

    // Phase 6: 添加附件的 docRef
    if (pendingAttachmentDocRefs.value.length > 0) {
      console.log('[sendChatOnlyMessage] 添加附件 docRefs:', pendingAttachmentDocRefs.value);
      atDocRefs = [...atDocRefs, ...pendingAttachmentDocRefs.value];
    }

    const hasDocRefs = atDocRefs.length > 0;

    console.log('[sendChatOnlyMessage] @ 引用 docRefs:', hasDocRefs, atDocRefs, '附件:', pendingAttachmentDocRefs.value.length);

    const result = await chatAgent({
      sessionId: chatOnlySessionId.value,
      role,
      message: userText,  // 输入框文字作为 message
      additionalPrds: hasDocRefs ? undefined : additionalPrdsToSend,  // 有 docRefs 时不传 additionalPrds
      docRefs: hasDocRefs ? atDocRefs : undefined,  // ✅ 新增：传递 docRefs
    });

    if (result.status === 'success') {
      aiMsg.content = result.reply || '（无回复）';
    } else {
      // 后端返回的错误信息按规则为英文
      aiMsg.content = result.reply || 'Error: Unknown error.';
    }
  } catch (e: any) {
    // 错误信息按规则用英文
    aiMsg.content = `Error: ${e?.message || e}`;
  } finally {
    isProcessing.value = false;
    statusText.value = '';
    scrollChatOnlyToBottom();
  }
};

// PM/DEV角色：提取链接内容
const extractChatOnlyUrl = async () => {
  const url = chatOnlyUrlValue.value.trim();
  if (!url) return;
  
  showChatOnlyUrlInput.value = false;
  chatOnlyUrlValue.value = '';
  
  addMessage('user', `请分析这个链接：${url}`);
  isProcessing.value = true;
  statusText.value = '正在提取链接内容...';
  
  try {
    // 复用QA角色的全页分析逻辑
    const extractResult = await extractContentFromUrlWithFullAnalysis(url);
    
    if (!extractResult.content || extractResult.content.length < 100) {
      throw new Error(`提取内容过少 (${extractResult.content?.length || 0} 字符)`);
    }
    
    // 保存提取的内容到文档列表
    const docId = `doc-${Date.now()}`;
    const firstLine = extractResult.content.split('\n').find((l: string) => l.trim().startsWith('#'));
    const docTitle = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : url.split('/').pop() || '提取的文档';
    
    const newDoc: ChatOnlyDocument = {
      id: docId,
      title: docTitle,
      content: extractResult.content,
      type: 'url',
      url: url,
      createdAt: Date.now()
    };
    
    chatOnlyDocuments.value.push(newDoc);
    activeRightTab.value = 'chatDoc';
    activeChatDocId.value = docId;
    viewMode.value = 'preview';
    
    // === PM/DEV 模式也入库（与 QA 对齐）===
    try {
      const sessionId = ensureSessionId();
      const docRef = await uploadAuxDoc(sessionId, extractResult.content, docTitle, `aux_pmdev_${docId}`);
      if (docRef) {
        (newDoc as any).docRef = docRef;
        console.log('[extractChatOnlyUrl] PM/DEV 入库成功:', docRef);
      }
    } catch (upsertErr: any) {
      console.error('[extractChatOnlyUrl] PM/DEV upsert 失败:', upsertErr);
    }
    
    // 将提取的内容作为上下文发送给AI分析
    const role = userRole.value === 'pm' ? 'pm' : 'dev';
    const aiMsg: Message = { role: 'ai', content: '' };
    messages.value.push(aiMsg);
    
    statusText.value = 'AI 正在分析...';
    
    const result = await chatAgent({
      sessionId: chatOnlySessionId.value,
      role,
      message: `以下是从链接 ${url} 提取的内容，请帮我分析：\n\n${extractResult.content.substring(0, 10000)}`
    });
    
    if (result.status === 'success') {
      aiMsg.content = result.reply || '（无回复）';
    } else {
      aiMsg.content = result.reply || 'Error: Unknown error.';
    }
    
    addMessage('ai', `✅ 内容已提取并显示在右侧面板`);
  } catch (e: any) {
    addMessage('ai', `Error: 链接提取失败 - ${e?.message || e}`);
  } finally {
    isProcessing.value = false;
    statusText.value = '';
    scrollChatOnlyToBottom();
  }
};

// PM/DEV角色：一键提取当前页面（不打开新标签页）
const startChatOnlyFullPageAnalysis = async () => {
  isProcessing.value = true;
  statusText.value = '正在提取当前页面...';
  addMessage('user', '📸 一键提取当前页面内容');
  
  // 用于恢复页面状态
  let tabId: number | null = null;
  let originalScrollY: number = 0;
  
  try {
    // 确保与页面的连接已建立（自动注入 content script）
    statusText.value = '正在连接页面...';
    tabId = await ensureConnection();
    
    // 获取当前标签页信息
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      throw new Error('无法获取当前页面');
    }
    
    // 直接使用当前标签页，不创建新标签页
    addMessage('ai', `📄 正在提取当前页面: ${tab.url}`);
    addMessage('ai', `💡 将自动执行：滚动页面 → 截图 → 提取内容 → 上传图片`);
    
    // 等待页面加载完成（如果还在加载）
    statusText.value = "等待页面加载...";
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('页面加载超时 (45s)')), 45000);
      const listener = (updatedTabId: number, changeInfo: any) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          browser.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          resolve();
        }
      };
      browser.tabs.onUpdated.addListener(listener);
      // 如果页面已经加载完成，立即resolve
      if (tab.status === 'complete') {
        browser.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        resolve();
      }
    });
    
    // 等待 SPA 初始渲染
    addMessage('ai', `📄 页面已加载，等待动态内容渲染...`);
    await new Promise(r => setTimeout(r, 3000));
    
    // 执行全页分析（复用extractContentFromUrlWithFullAnalysis的核心逻辑）
    statusText.value = "正在获取页面信息...";
    await browser.tabs.sendMessage(tabId, { type: 'PREPARE_PAGE_FOR_SCREENSHOT' });
    const pageInfo: any = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_SCROLL_INFO' });
    const { totalHeight, viewportHeight } = pageInfo;
    const scrollSteps = Math.ceil(totalHeight / viewportHeight);
    
    // 保存原始滚动位置，用于恢复
    originalScrollY = pageInfo.currentScrollY || 0;
    
    const screenshots: string[] = [];
    let domSegments: { markdown: string, images: { url: string, base64: string }[] }[] = [];
    
    // 确保从顶部开始
    await browser.tabs.sendMessage(tabId, { type: 'SCROLL_TO_POSITION', position: 0 });
    await new Promise(r => setTimeout(r, 300));
    
    addMessage('ai', `🔄 开始全页滚动分析 (共 ${scrollSteps} 屏)...`);
    
    let lastScrollY = -1;
    for (let i = 0; i < scrollSteps; i++) {
      statusText.value = `正在处理第 ${i + 1}/${scrollSteps} 屏...`;
      
      // 滚动到位置
      await browser.tabs.sendMessage(tabId, { 
        type: 'SCROLL_TO_POSITION', 
        position: i * viewportHeight 
      });
      
      // 等待渲染
      await new Promise(r => setTimeout(r, 700));
      
      // 检查是否已到底部
      const curInfo: any = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_SCROLL_INFO' });
      const curScrollY = Number(curInfo?.currentScrollY ?? 0);
      
      if (i > 0 && curScrollY === lastScrollY) {
        console.log('[startChatOnlyFullPageAnalysis] 已到达底部，停止截图');
        break;
      }
      lastScrollY = curScrollY;
      
      // 提取当前视口的 DOM
      const domRes: any = await browser.tabs.sendMessage(tabId, { 
        type: 'GET_DOM',
        onlyInViewport: true
      });
      const segment = domRes.markdown || '';
      const images = domRes.images || [];
      domSegments.push({ markdown: segment, images });
      
      // 截图
      const dataUrl = await browser.tabs.captureVisibleTab(undefined, { format: 'png' });
      screenshots.push(dataUrl);
    }
    
    // 合并DOM内容（先下载图片上传 CDN，再用 CDN URL 替换占位符，最后合并）
    statusText.value = "正在处理图片...";
    const replacedSegments = await processAndReplaceImages(domSegments, (done, total) => {
        statusText.value = `正在处理图片 ${done}/${total}...`;
    });
    const fullMarkdown = replacedSegments.join('\n\n');

    // 拼接截图（10屏一组）
    const imageProcessor = new ImageProcessor();
    const stitchedScreenshots = await imageProcessor.stitchScreenshotsInGroups(screenshots);
    
    // 上传截图（使用postRetrieve）
    const uploadRes = await postRetrieve({ pictures: stitchedScreenshots.filter(Boolean) });
    const cdnUrls = uploadRes.cdnUrls || [];
    
    if (!fullMarkdown || fullMarkdown.length < 100) {
      throw new Error(`提取内容过少 (${fullMarkdown?.length || 0} 字符)`);
    }
    
    // 保存提取的内容到文档列表
    const docId = `doc-${Date.now()}`;
    const firstLine = fullMarkdown.split('\n').find((l: string) => l.trim().startsWith('#'));
    const docTitle = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : new URL(tab.url).hostname || '当前页面';
    
    const newDoc: ChatOnlyDocument = {
      id: docId,
      title: docTitle,
      content: fullMarkdown,
      type: 'page',
      url: tab.url,
      createdAt: Date.now()
    };
    
    chatOnlyDocuments.value.push(newDoc);
    activeRightTab.value = 'chatDoc';
    activeChatDocId.value = docId;
    viewMode.value = 'preview';
    
    // === PM/DEV 模式也入库（与 QA 对齐）===
    try {
      const sessionId = ensureSessionId();
      const docRef = await uploadAuxDoc(sessionId, fullMarkdown, docTitle, `aux_pmdev_page_${docId}`);
      if (docRef) {
        (newDoc as any).docRef = docRef;
        console.log('[startChatOnlyFullPageAnalysis] PM/DEV 入库成功:', docRef);
      }
    } catch (upsertErr: any) {
      console.error('[startChatOnlyFullPageAnalysis] PM/DEV upsert 失败:', upsertErr);
    }
    
    // 将提取的内容作为上下文发送给AI分析
    const role = userRole.value === 'pm' ? 'pm' : 'dev';
    const aiMsg: Message = { role: 'ai', content: '' };
    messages.value.push(aiMsg);
    
    statusText.value = 'AI 正在分析...';
    
    const result = await chatAgent({
      sessionId: chatOnlySessionId.value,
      role,
      message: `以下是从当前页面 ${tab.url} 提取的内容，请帮我分析：\n\n${fullMarkdown.substring(0, 10000)}`
    });
    
    if (result.status === 'success') {
      aiMsg.content = result.reply || '（无回复）';
    } else {
      aiMsg.content = result.reply || 'Error: Unknown error.';
    }
    
    addMessage('ai', `✅ 页面内容已提取并显示在右侧面板`);
  } catch (e: any) {
    addMessage('ai', `Error: 页面提取失败 - ${e?.message || e}`);
  } finally {
    // 恢复页面状态（取消与页面的控制）
    if (tabId) {
      try {
        // 恢复原始滚动位置
        await browser.tabs.sendMessage(tabId, { 
          type: 'RESTORE_SCROLL_POSITION', 
          originalPosition: originalScrollY 
        });
        // 恢复页面样式等状态
        await browser.tabs.sendMessage(tabId, { type: 'RESTORE_PAGE_AFTER_SCREENSHOT' });
        console.log('[startChatOnlyFullPageAnalysis] 页面状态已恢复');
      } catch (restoreErr) {
        console.warn('[startChatOnlyFullPageAnalysis] 恢复页面状态失败:', restoreErr);
      }
    }
    isProcessing.value = false;
    statusText.value = '';
    scrollChatOnlyToBottom();
  }
};

// ... (Computed)

// 是否处于 UI 自动化测试步骤（用于区分报告渲染方式）
const isAutoTestStep = computed(() => userRole.value === 'qa' && projectState.currentStep === 'auto_test');

const currentDocTitle = computed(() => {
  switch (projectState.currentStep) {
    case 'content_review': return '📄 原始提取内容 (可编辑)';
    case 'optimizing': return 'AI 正在优化...';
    case 'prd_review': return '📄 需求文档 (PRD)';
    case 'test_point': return '🎯 测试点拆解';
    case 'test_case': return '🧪 测试用例';
    case 'auto_test':
      if (uiViewType.value === 'report' && projectState.documents.uiReport) {
        return '📊 UI自动化测试报告';
      } else if (uiViewType.value === 'plan_json' && projectState.documents.uiPlanJson) {
        return '🧩 UI自动化 Plan JSON';
      } else if (projectState.documents.uiPlan) {
        return '📋 UI自动化测试计划';
      }
      return '🤖 UI自动化测试';
    default: return '等待开始...';
  }
});

const currentDocContent = computed({
  get: () => {
    switch (projectState.currentStep) {
      case 'content_review':
      case 'optimizing':
      case 'prd_review': return projectState.documents.prd;
      case 'test_point': return projectState.documents.testPoints;
      case 'test_case': return projectState.documents.testCases;
      case 'auto_test': return uiViewType.value === 'report' ? projectState.documents.uiReport : (uiViewType.value === 'plan_json' ? projectState.documents.uiPlanJson : projectState.documents.uiPlan);
      default: return '';
    }
  },
  set: (val) => {
    switch (projectState.currentStep) {
      case 'content_review':
      case 'optimizing':
      case 'prd_review': projectState.documents.prd = val; break;
      case 'test_point': projectState.documents.testPoints = val; break;
      case 'test_case': projectState.documents.testCases = val; break;
      case 'auto_test':
         if (uiViewType.value === 'report') projectState.documents.uiReport = val;
         else if (uiViewType.value === 'plan_json') projectState.documents.uiPlanJson = val;
         else projectState.documents.uiPlan = val;
         break;
    }
  }
});

const editorPlaceholder = computed(() => {
  if (!projectState.currentStep || projectState.currentStep === 'setup') return '请点击左侧开始分析...';
  if (projectState.currentStep === 'test_case' && !projectState.documents.testCases) {
    return `手动输入测试用例（YAML 格式），然后点击「进入自动化测试」：

- id: TC-001
  name: 登录测试
  steps:
    - 在用户名输入框中输入admin
    - 在密码输入框中输入123456
    - 点击登录按钮
  expectedResults:
    - 页面跳转到首页

- id: TC-002
  name: 搜索测试
  steps:
    - 在搜索框中输入关键词
    - 点击搜索按钮
  expectedResults:
    - 页面显示搜索结果`;
  }
  return 'AI 生成的内容将显示在这里，您可以直接编辑...';
});

// 编辑器标题（根据当前Tab类型显示）
const editorHeaderTitle = computed(() => {
  if (activeRightTab.value === 'additional') return '辅助PRD';
  if (activeRightTab.value === 'figma') return 'Figma交互文档';
  // main tab
  switch (activeMainDocType.value) {
    case 'prd': return currentDocTitle.value || '主PRD';
    case 'optimizedPrd': return '✨ 优化后PRD';
    case 'testPoints': return '🎯 测试点';
    case 'testCases': return '📋 测试用例';
    default: return '文档';
  }
});

// 主文档内容（根据 activeMainDocType 获取/设置）
// 说明：在 QA 的 UI 自动化步骤（auto_test）里，右侧主编辑区需要展示 uiPlan / uiPlanJson / uiReport。
// 之前只按 activeMainDocType 取 prd/testPoints... 会导致“右侧标题是报告但内容为空”。
const activeMainDocContent = computed({
  get: () => {
    // ✅ UI 自动化步骤：根据当前查看的文档类型决定返回什么
    // 如果用户主动切到了 prd/testPoints/testCases 等文档 tab，
    // 应该按 activeMainDocType 返回对应内容，而不是一律返回 uiPlan/uiReport。
    // 仅当 activeMainDocType 仍在 auto_test 相关的文档类型时，才绑定 currentDocContent。
    if (userRole.value === 'qa' && projectState.currentStep === 'auto_test') {
      // 如果用户选择了普通文档 tab（prd/optimizedPrd/testPoints/testCases），直接返回对应内容
      if (['prd', 'optimizedPrd', 'testPoints', 'testCases'].includes(activeMainDocType.value)) {
        switch (activeMainDocType.value) {
          case 'prd': return projectState.documents.prd;
          case 'optimizedPrd': return projectState.documents.optimizedPrd;
          case 'testPoints': return projectState.documents.testPoints;
          case 'testCases': return projectState.documents.testCases;
        }
      }
      // 否则绑定到 auto_test 的 uiPlan/uiReport 等
      return currentDocContent.value;
    }

    // ✅ 其他步骤：仍按主流程文档 tab 展示
    switch (activeMainDocType.value) {
      case 'prd': 
        return projectState.documents.prd;
      case 'optimizedPrd':
        return projectState.documents.optimizedPrd;
      case 'testPoints':
        return projectState.documents.testPoints;
      case 'testCases':
        return projectState.documents.testCases;
      default:
        return '';
    }
  },
  set: (val: string) => {
    // ✅ UI 自动化步骤：根据当前查看的文档类型写回
    if (userRole.value === 'qa' && projectState.currentStep === 'auto_test') {
      // 如果用户在编辑普通文档 tab，写回对应位置
      if (['prd', 'optimizedPrd', 'testPoints', 'testCases'].includes(activeMainDocType.value)) {
        switch (activeMainDocType.value) {
          case 'prd': projectState.documents.prd = val; break;
          case 'optimizedPrd': projectState.documents.optimizedPrd = val; break;
          case 'testPoints': projectState.documents.testPoints = val; break;
          case 'testCases': projectState.documents.testCases = val; break;
        }
        return;
      }
      // 否则写回 auto_test 的 uiPlan/uiReport 等
      currentDocContent.value = val;
      return;
    }

    switch (activeMainDocType.value) {
      case 'prd':
        projectState.documents.prd = val;
        break;
      case 'optimizedPrd':
        projectState.documents.optimizedPrd = val;
        break;
      case 'testPoints':
        projectState.documents.testPoints = val;
        break;
      case 'testCases':
        projectState.documents.testCases = val;
        break;
    }
  }
});

// --- Helpers ---
const addMessage = (role: 'user' | 'ai', content: string, attachments?: MessageAttachmentInfo[]) => {
  messages.value.push({ role, content, attachments });
  nextTick(() => {
    if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  });
};

// 统一标题格式化，避免空标题展示空白
const formatPrdTitle = (item: { title?: string; url?: string }, max = 20) => {
  const raw = (item.title || '').trim();
  const fallback = item.url ? (item.url.split('/').pop() || '未命名PRD') : '未命名PRD';
  const title = raw || fallback;
  return title.length > max ? title.slice(0, max) + '...' : title;
};

const renderMarkdown = (text: string) => {
    if (!text) return '';
    try {
        // Pre-process: Remove data URIs if they are just hanging around (optional based on legacy code)
        let clean = text.replace(/^data: /gm, '');
        
        // Use marked to render HTML
        // marked.parse returns string | Promise<string>. Since we don't use async extensions, it should be string.
        // We cast to string to be safe or handle promise if needed.
        // But default usage is sync.
        return marked.parse(clean) as string;
    } catch (e) {
        console.error("Markdown render error", e);
        return text;
    }
};

// --- Editor Image Upload & Paste Helpers ---

const editorImageInputRef = ref<HTMLInputElement | null>(null);
const isUploadingEditorImage = ref(false);

const triggerEditorImageUpload = () => {
  editorImageInputRef.value?.click();
};

/** 通过文件选择器选择图片后上传 */
const handleEditorImageFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  const file = input.files[0];
  input.value = '';
  await uploadAndInsertImage(file);
};

/** 上传图片文件到 CDN 并在编辑器光标处插入 markdown */
const uploadAndInsertImage = async (file: File) => {
  isUploadingEditorImage.value = true;
  statusText.value = '正在上传图片...';
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const cdnUrl = await uploadImage(dataUrl);
    insertImageMarkdownAtCursor(cdnUrl, file.name || 'image');
  } catch (e: any) {
    console.error('[uploadAndInsertImage] 上传失败:', e);
    addMessage('ai', `❌ 图片上传失败: ${e.message || e}`);
  } finally {
    isUploadingEditorImage.value = false;
    statusText.value = '';
  }
};

/** 上传 Blob (来自剪贴板粘贴) 到 CDN 并在编辑器光标处插入 */
const uploadAndInsertImageBlob = async (blob: Blob) => {
  isUploadingEditorImage.value = true;
  statusText.value = '正在上传粘贴的图片...';
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const cdnUrl = await uploadImage(dataUrl);
    const ext = blob.type.split('/')[1] || 'png';
    insertImageMarkdownAtCursor(cdnUrl, `pasted-image.${ext}`);
  } catch (e: any) {
    console.error('[uploadAndInsertImageBlob] 上传失败:', e);
    addMessage('ai', `❌ 粘贴图片上传失败: ${e.message || e}`);
  } finally {
    isUploadingEditorImage.value = false;
    statusText.value = '';
  }
};

/** 在当前可见的 .markdown-editor textarea 光标处插入 markdown 图片语法 */
const insertImageMarkdownAtCursor = (cdnUrl: string, altText: string) => {
  const textarea = document.querySelector('.markdown-editor') as HTMLTextAreaElement;
  if (!textarea) return;

  const imgMarkdown = `\n![${altText}](${cdnUrl})\n`;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  const newValue = before + imgMarkdown + after;

  // 根据当前活动文档类型更新对应 reactive 数据
  if (userRole.value === 'qa' && activeRightTab.value === 'main') {
    activeMainDocContent.value = newValue;
  } else if (activeRightTab.value === 'url') {
    const doc = urlDocs.value.find(d => d.id === activeUrlDocId.value);
    if (doc) doc.content = newValue;
  } else if (activeRightTab.value === 'custom') {
    customActiveDocContent.value = newValue;
  } else if (activeRightTab.value === 'chatDoc') {
    chatOnlyActiveDocContent.value = newValue;
  } else if (activeRightTab.value === 'additional') {
    const prd = additionalPrds.value.find(p => p.id === activeAdditionalPrdId.value);
    if (prd) prd.content = newValue;
  } else if (activeRightTab.value === 'figma') {
    const figma = figmaDocs.value.find(f => f.id === activeFigmaDocId.value);
    if (figma) figma.content = newValue;
  }

  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + imgMarkdown.length;
    textarea.focus();
  });
};

// 监听编辑器 textarea 的粘贴事件（事件委托）
onMounted(() => {
  const handleEditorPaste = (e: ClipboardEvent) => {
    // 仅在编辑模式下，且目标是 .markdown-editor textarea 时处理
    const target = e.target as HTMLElement;
    if (viewMode.value !== 'edit' || !target.classList?.contains('markdown-editor')) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault(); // 阻止默认粘贴行为
        const blob = item.getAsFile();
        if (blob) {
          uploadAndInsertImageBlob(blob);
        }
        return; // 处理第一个图片即可
      }
    }
    // 非图片粘贴：不拦截，走默认文本粘贴
  };

  document.addEventListener('paste', handleEditorPaste);
  onBeforeUnmount(() => {
    document.removeEventListener('paste', handleEditorPaste);
  });
});

// --- Image Placeholder Replacement ---
/** 将单个段内的 [IMAGE_001] 等占位符替换为 markdown 图片链接 ![alt](src) */
const replaceSegmentImagePlaceholders = (segment: { markdown: string, images: any[] }): string => {
  const images = segment.images || [];
  if (images.length === 0) return segment.markdown;

  // 构建该段自己的占位符 → 图片 URL 映射
  const imageMap = new Map<string, { src: string, alt: string }>();
  for (const img of images) {
    if (img.placeholder && img.src) {
      imageMap.set(img.placeholder, { src: img.src, alt: img.alt || '' });
    }
  }

  return segment.markdown.replace(/\[IMAGE_\d{3,}\]/g, (match) => {
    const img = imageMap.get(match);
    if (img) {
      return `![${img.alt}](${img.src})`;
    }
    return match;
  });
};

/**
 * 将所有段落中的图片下载并上传 CDN，然后用 CDN URL 替换占位符
 * 保持图片与文本位置一一对应
 */
const processAndReplaceImages = async (
  domSegments: { markdown: string; images: any[] }[],
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> => {
  // 1. 收集所有段中的图片，按 src 去重
  const allImages: ExtractedImage[] = [];
  const seenSrcs = new Set<string>();
  for (const seg of domSegments) {
    for (const img of (seg.images || [])) {
      if (img.src && !seenSrcs.has(img.src)) {
        seenSrcs.add(img.src);
        allImages.push(img);
      }
    }
  }

  // 2. 批量下载 + 上传 CDN
  const srcToCdnUrl = new Map<string, string>();
  if (allImages.length > 0) {
    console.log(`[processAndReplaceImages] 开始处理 ${allImages.length} 张图片...`);
    const results = await extractAndUploadImages(allImages, {
      concurrency: 3,
      timeout: 30000,
      uploadToCdn: true,
      onProgress,
    });
    for (const r of results) {
      if (r.status === 'completed' && r.cdnUrl) {
        srcToCdnUrl.set(r.src, r.cdnUrl);
      }
    }
    console.log(`[processAndReplaceImages] CDN 上传完成: ${srcToCdnUrl.size}/${allImages.length} 张成功`);
  }

  // 3. 每段用 CDN URL 替换占位符（下载失败的 fallback 到原始 src）
  return domSegments.map(seg => {
    const imageMap = new Map<string, { src: string; alt: string }>();
    for (const img of (seg.images || [])) {
      if (img.placeholder && img.src) {
        const url = srcToCdnUrl.get(img.src) || img.src;
        imageMap.set(img.placeholder, { src: url, alt: img.alt || '' });
      }
    }
    return seg.markdown.replace(/\[IMAGE_\d{3,}\]/g, (match) => {
      const img = imageMap.get(match);
      return img ? `![${img.alt}](${img.src})` : match;
    });
  });
};

// --- Image Processing Helpers (Stitching) ---
const cropImageTopByRatio = async (dataUrl: string, ratio: number) => {
  if (!dataUrl || !ratio || ratio <= 0) return dataUrl;
  const safeRatio = Math.max(0, Math.min(0.99, ratio));
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load screenshot image'));
    image.src = dataUrl;
  });
  const cropPixels = Math.round(img.height * safeRatio);
  if (cropPixels <= 0) return dataUrl;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height - cropPixels;
  ctx.drawImage(img, 0, cropPixels, img.width, img.height - cropPixels, 0, 0, img.width, img.height - cropPixels);
  return canvas.toDataURL('image/png');
};

const cropImageTopPixels = async (dataUrl: string, pixels: number) => {
  if (!dataUrl || !pixels || pixels <= 0) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load screenshot image'));
    image.src = dataUrl;
  });
  
  if (pixels >= img.height) return dataUrl;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height - pixels;
  
  ctx.drawImage(img, 0, pixels, img.width, img.height - pixels, 0, 0, img.width, img.height - pixels);
  return canvas.toDataURL('image/png');
};

const removeFinalOverlap = async (screenshots: string[], pageInfo: any) => {
  if (!screenshots.length) return screenshots;
  const { totalHeight, viewportHeight } = pageInfo;
  if (!totalHeight || !viewportHeight) return screenshots;
  const remainder = totalHeight % viewportHeight;
  if (remainder === 0) return screenshots;

  const overlapCss = viewportHeight - remainder;
  const overlapRatio = overlapCss / viewportHeight;
  
  const copy = screenshots.slice();
  copy[copy.length - 1] = await cropImageTopByRatio(copy[copy.length - 1], overlapRatio);
  return copy;
};

const removeRepeatedHeaders = async (screenshots: string[]) => {
  if (screenshots.length < 2) return screenshots;

  const first = screenshots[0];
  const second = screenshots[1];

  const [img1, img2] = await Promise.all([
    new Promise<HTMLImageElement>((resolve) => {
        const i = new Image(); 
        i.onload = () => resolve(i); 
        i.src = first;
    }),
    new Promise<HTMLImageElement>((resolve) => {
        const i = new Image(); 
        i.onload = () => resolve(i); 
        i.src = second;
    })
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = img1.width;
  canvas.height = Math.min(img1.height, 300); // Only check top 300px
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  ctx.drawImage(img1, 0, 0);
  const data1 = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img2, 0, 0);
  const data2 = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let sameHeight = 0;
  const width = canvas.width;
  
  for (let y = 0; y < canvas.height; y++) {
    let isRowSame = true;
    for (let x = 0; x < width; x += 10) { // Sample every 10px
      const idx = (y * width + x) * 4;
      if (Math.abs(data1[idx] - data2[idx]) > 5 ||
          Math.abs(data1[idx+1] - data2[idx+1]) > 5 ||
          Math.abs(data1[idx+2] - data2[idx+2]) > 5) {
        isRowSame = false;
        break;
      }
    }
    if (isRowSame) {
      sameHeight = y + 1;
    } else {
      break;
    }
  }

  if (sameHeight > 0) {
    console.log(`Detected repeated header height: ${sameHeight}px`);
    const processed = [first];
    for (let i = 1; i < screenshots.length; i++) {
      processed.push(await cropImageTopPixels(screenshots[i], sameHeight));
    }
    return processed;
  }

  return screenshots;
};

// --- Workflow Actions ---

const goToStep = (step: Step) => {
    if (isProcessing.value) return;
    if (projectState.currentStep === step) return; // 防止重复点击

    if (step === 'content_review') {
        // 防止未生成 PRD 时切换丢失 Step1 的编辑内容
        if (hasGeneratedPRD.value) {
            projectState.documents.prd = projectState.assets.domMarkdown;
        }
        projectState.currentStep = 'content_review';
        viewMode.value = 'edit';
    } else if (step === 'prd_review') {
        projectState.currentStep = 'prd_review';
        viewMode.value = 'preview';
        if (hasGeneratedPRD.value && cachedPRD.value) {
            // 恢复优化后的PRD到 optimizedPrd（不覆盖原始PRD）
            projectState.documents.optimizedPrd = cachedPRD.value;
            activeMainDocType.value = 'optimizedPrd';
        }
    } else if (step === 'test_point') {
        projectState.currentStep = 'test_point';
        viewMode.value = 'preview';
        if (hasGeneratedTestPoints.value) {
            projectState.documents.testPoints = cachedTestPoints.value;
        }
    } else if (step === 'test_case') {
        projectState.currentStep = 'test_case';
        if (hasGeneratedTestCases.value) {
            projectState.documents.testCases = cachedTestCases.value;
            viewMode.value = 'preview';
        } else {
            // 无已生成用例时显示引导面板，帮助用户选择格式和了解编写规范
            manualGuideVisible.value = true;
            viewMode.value = 'edit';
            activeRightTab.value = 'main';
            activeMainDocType.value = 'testCases';
            if (!projectState.documents.testCases) {
                projectState.documents.testCases = '';
            }
        }
    } else if (step === 'auto_test') {
        enterAutoTest();
    }
};

const enterWorkflow = () => {
  // QA角色进入后，直接进入分析步骤（与PM/DEV一致的输入界面）
  projectState.currentStep = 'content_review';
};

const enterAutoTest = async () => {
  projectState.currentStep = 'auto_test';

  if (uiEngine.value === 'midscene') {
    await initMidsceneView();
  } else {
    uiViewType.value = 'plan';
    addMessage('ai', `**UI 自动化测试智能体**

**工作流程：**
1. 生成测试计划 - 分析当前页面
2. 执行测试 - 根据计划自动执行并截图
3. 生成报告 - 汇总测试结果

**前置条件：** Agent 服务 (Port 8000) + Chrome 调试模式 (Port 9222)`);
  }
};

const captureFullPageAndDOM = async (tabId: number) => {
    statusText.value = "正在获取页面信息...";
    await browser.tabs.sendMessage(tabId, { type: 'PREPARE_PAGE_FOR_SCREENSHOT' });
    const pageInfo: any = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_SCROLL_INFO' });
    const { totalHeight, viewportHeight } = pageInfo;
    const scrollSteps = Math.ceil(totalHeight / viewportHeight);
    
    const screenshots: string[] = [];
    let domSegments: { markdown: string, images: { url: string, base64: string }[] }[] = [];
    
    // 1. Ensure we start at top
    await browser.tabs.sendMessage(tabId, { type: 'SCROLL_TO_POSITION', position: 0 });
    await new Promise(r => setTimeout(r, 300));

    try {
        let lastScrollY = -1;
        for (let i = 0; i < scrollSteps; i++) {
            statusText.value = `正在处理第 ${i + 1}/${scrollSteps} 屏...`;
            progress.value = ((i + 1) / scrollSteps) * 100;
            
            // 1. Scroll to position (Top-down)
            await browser.tabs.sendMessage(tabId, { 
                type: 'SCROLL_TO_POSITION', 
                position: i * viewportHeight 
            });
            
            // 2. Wait for render (稍微延长等待时间，确保页面内容加载)
            await new Promise(r => setTimeout(r, 700));

            // 2.1 Re-check scroll position to stop at bottom ASAP (避免到底后仍继续截图)
            const curInfo: any = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_SCROLL_INFO' });
            const curScrollY = Number(curInfo?.currentScrollY ?? 0);
            const curViewportH = Number(curInfo?.viewportHeight ?? viewportHeight);
            const curTotalH = Number(curInfo?.totalHeight ?? totalHeight);

            // 如果滚动位置不再变化，说明已到底/被 clamp，停止避免重复截图
            if (i > 0 && curScrollY === lastScrollY) {
                console.log('[captureFullPageAndDOM] 已到达底部（scrollY不再变化），停止截图', { i, curScrollY, curTotalH, curViewportH });
                break;
            }
            
            // 3. Extract DOM Segment (Current Viewport ONLY)
            const domRes: any = await browser.tabs.sendMessage(tabId, { 
                type: 'GET_DOM',
                onlyInViewport: true
            });
            const segment = domRes.markdown || '';
            const images = domRes.images || [];
            domSegments.push({ markdown: segment, images });

            // 4. Capture Screenshot
            const dataUrl = await browser.tabs.captureVisibleTab(undefined, { format: 'png' });
            screenshots.push(dataUrl);

            lastScrollY = curScrollY;
            // 到达底部后拍完这一张就停止
            const isAtBottom = curScrollY + curViewportH >= curTotalH - 10;
            if (isAtBottom) {
                console.log('[captureFullPageAndDOM] 已到达底部（拍完最后一屏停止）', { i, curScrollY, curTotalH, curViewportH });
                break;
            }
        }

    } finally {
        await browser.tabs.sendMessage(tabId, { type: 'RESTORE_SCROLL_POSITION', originalPosition: pageInfo.currentScrollY || 0 });
        await browser.tabs.sendMessage(tabId, { type: 'RESTORE_PAGE_AFTER_SCREENSHOT' });
    }
    
    // Merge DOM Segments（先下载图片上传 CDN，再用 CDN URL 替换占位符，最后合并）
    statusText.value = "正在处理图片...";
    const replacedSegments = await processAndReplaceImages(domSegments, (done, total) => {
        statusText.value = `正在处理图片 ${done}/${total}...`;
    });
    let fullDOM = '';
    for (const replaced of replacedSegments) {
        fullDOM = mergeTextSegments(fullDOM, replaced);
    }

    // Process Screenshot
    statusText.value = "正在处理截图...";
    let processed = await removeRepeatedHeaders(screenshots);
    processed = await removeFinalOverlap(processed, pageInfo);
    
    statusText.value = "正在拼接图片...";
    // 分组拼接（每10张一组），返回多张图片
    const stitchedImages = await imageProcessor.stitchScreenshotsInGroups(processed);
    console.log(`[captureFullPageAndDOM] 拼接完成：${processed.length} 张 → ${stitchedImages.length} 组`);

    return { screenshots: stitchedImages, dom: fullDOM };
};

const startAnalysis = async () => {
  try {
    isProcessing.value = true;
    progress.value = 0;
    statusText.value = "正在连接页面...";
    addMessage('user', '开始分析页面...');
    projectState.currentStep = 'analyzing';

    // 确保与页面的连接已建立（自动注入 content script）
    const tabId = await ensureConnection();

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });

    // 1. Capture Full Page & DOM (Combined Step)
    const captureResult = await captureFullPageAndDOM(tabId);
    
    // 保存第一张截图用于预览，全部截图用于上传
    projectState.assets.screenshotUrl = captureResult.screenshots[0] || '';
    projectState.assets.domMarkdown = captureResult.dom;
    
    console.log('--------------------------------------------------');
    console.log(`[startAnalysis] 截图数量: ${captureResult.screenshots.length}`);
    console.log(projectState.assets.domMarkdown);
    console.log('--------------------------------------------------');
    
    addMessage('ai', `全屏截图完成 (${captureResult.screenshots.length} 张)，DOM 提取成功 (${captureResult.dom.length} chars)。`);

    // 2. Upload to Cloud - 传入所有分组拼接的截图
    statusText.value = "正在上传上下文...";
    const uploadRes = await postRetrieve({
        pictures: captureResult.screenshots,
        dom: projectState.assets.domMarkdown
    });
    projectState.assets.cdnUrl = uploadRes.cdnUrl;
    projectState.assets.cdnUrls = uploadRes.cdnUrls || (uploadRes.cdnUrl ? [uploadRes.cdnUrl] : []);
    
    // 3. 保存到 URL 区域（首次提取默认为主PRD）并入库
    const tabUrl = tabs[0]?.url || 'current_page';
    const title = deriveDocTitle(projectState.assets.domMarkdown, tabUrl, '当前页');
    await saveUrlDoc(tabUrl, projectState.assets.domMarkdown, title);
    
    // 如果是首次提取，进入 content_review 步骤
    projectState.currentStep = 'content_review';
    viewMode.value = 'edit';
    addMessage('ai', `✅ 内容提取完成，已保存到【URL区域】并入库：《${title}》${urlDocs.value[0]?.isMainPrd ? '（已设为主PRD）' : ''}\n\n您可以直接编辑原始数据（剔除无关内容），然后点击"优化需求文档"。`);

  } catch (e) {
    console.error(e);
    addMessage('ai', `Error: ${e}`);
    projectState.currentStep = 'setup'; // Revert to setup on error
  } finally {
    isProcessing.value = false;
    progress.value = 0;
    statusText.value = '';
  }
};

// 开始优化PRD流程（先显示参考确认弹窗）
const startOptimizePRD = () => {
    // Save user edits to raw DOM before optimizing so we can go back
    projectState.assets.domMarkdown = projectState.documents.prd;
    
    // 提取当前PRD标题
    const firstLine = projectState.documents.prd.split('\n').find((l: string) => l.trim().startsWith('#'));
    currentPrdTitle.value = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : '需求文档';
    
    // 若当前无参考和引用，则弹出参考弹窗；否则直接优化
    referenceConfirmAction.value = 'optimize';
    confirmPickedDocIds.value = [];
    if (!hasAnyReference.value) {
      showReferenceConfirmModal.value = true;
    } else {
      optimizePRD();
    }
};

// 打开参考资料面板
const openReferencePanel = () => {
    showReferenceConfirmModal.value = false;
    showAdditionalPrdPanel.value = true;
    showFigmaPanel.value = true;
    
    if (referenceConfirmAction.value === 'optimize') {
        addMessage('ai', `📝 准备优化《${currentPrdTitle.value}》\n\n为了让优化更精准，您可以：\n\n1️⃣ **添加辅助PRD** - 关联的需求文档\n2️⃣ **添加Figma设计** - 补充交互细节\n\n👇 添加完成后点击"完成"`);
    } else {
        addMessage('ai', `📝 准备为《${currentPrdTitle.value}》生成测试用例\n\n为了让用例更贴合业务逻辑，您可以：\n\n1️⃣ **添加辅助PRD** - 关联的需求文档\n2️⃣ **添加Figma设计** - 补充交互细节\n\n👇 添加完成后点击"完成"`);
    }
};

// 跳过参考资料，直接执行操作
const skipReference = async () => {
    showReferenceConfirmModal.value = false;
    
    if (referenceConfirmAction.value === 'optimize') {
        await optimizePRD();
    } else {
        await proceedToGenerateTestCases();
    }
};

// 直接优化PRD（跳过辅助面板）
const optimizePRD = async () => {
    // Save user edits to raw DOM before optimizing so we can go back
    projectState.assets.domMarkdown = projectState.documents.prd;

    isProcessing.value = true;
    statusText.value = "AI 正在优化需求文档...";
    projectState.currentStep = 'optimizing';
    addMessage('user', '开始优化需求文档...');
    
    // 收集参考/引用（@ 引用 > 参考面板文档 > 当前右侧文档兜底）
    const additionalPrdParams = buildAdditionalPrdsForRequest();
    pendingAdditionalPrds.value = [];  // 清空一次性引用

    try {
        // 构建 docRefs（优先使用已入库的文档）
        const docRefs = buildDocRefsForAsk('testprd');
        const useDocRefs = docRefs.length > 0 && hasStoredMainPrd();
        
        console.log('[optimizePRD] 使用 docRefs 模式:', useDocRefs, 'docRefs:', docRefs);
        
        // New Ask Interface for PRD
        const aiRes = await ask({
            code: 'plugin_test_testprd',
            type: 'testprd',
            sessionId: ensureSessionId(),
            params: {
                text: useDocRefs ? '' : projectState.documents.prd, // 如果有 docRefs，text 可为空
                pictureKeyList: projectState.assets.cdnUrls || (projectState.assets.cdnUrl ? [projectState.assets.cdnUrl] : []),
                isImageSolve: true,
                isImageByte64: true
            },
            docRefs: useDocRefs ? docRefs : undefined,
            additionalPrds: useDocRefs ? undefined : additionalPrdParams // docRefs 模式下不传 additionalPrds
        });
        
        projectState.assets.sessionId = aiRes.sessionId;
        // 存储到优化后PRD（不覆盖原始PRD）
        projectState.documents.optimizedPrd = aiRes.answer;
        
        // 保存生成的 docRef（用于后续阶段）
        if ((aiRes as any).generatedDocRef) {
          generatedDocRefs.optimizedPrd = (aiRes as any).generatedDocRef;
          console.log('[optimizePRD] 已保存 generatedDocRef:', generatedDocRefs.optimizedPrd);
        }
        
        // 同步 lastSavedContent（标记为已保存状态）
        lastSavedContent.optimizedPrd = aiRes.answer;
        
        // Cache the result
        cachedPRD.value = aiRes.answer;
        hasGeneratedPRD.value = true;

        projectState.currentStep = 'prd_review';
        viewMode.value = 'preview';
        activeRightTab.value = 'main';
        activeMainDocType.value = 'optimizedPrd';  // 切换到优化后PRD Tab
        
        // 提取PRD标题（从内容第一行或URL）
        const firstLine = aiRes.answer.split('\n').find((l: string) => l.trim().startsWith('#'));
        currentPrdTitle.value = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : '需求文档';
        
        // 隐藏辅助面板
        showAdditionalPrdPanel.value = false;
        showFigmaPanel.value = false;
        
        // 统计参考信息
        const contextInfo = additionalPrdParams.length > 0 ? [`${additionalPrdParams.length}份参考/引用文档`] : [];

        addMessage('ai', `✅ PRD优化完成！${contextInfo.length > 0 ? `\n\n📚 已参考：${contextInfo.join('、')}` : ''}\n\n正在分析测试用例生成的不确定点...`);

        // Follow-up: 分析 PRD 完整性，给出补充建议
        try {
          statusText.value = '正在分析PRD完整性...';
          const analysisDocRefs = buildDocRefsForAsk('testprd');
          const useAnalysisDocRefs = analysisDocRefs.length > 0 && hasStoredMainPrd();

          const analysisRes = await ask({
            code: 'plugin_test_testprd',
            type: 'testprd_chat',
            sessionId: ensureSessionId(),
            params: {
              text: useAnalysisDocRefs ? '' : projectState.documents.optimizedPrd,
            },
            instruction: `请分析这份优化后的PRD，从生成测试用例的角度，给出以下反馈：\n\n1. **不确定点**：PRD 中描述模糊或可能有多种理解的功能点\n2. **需要补充的信息**：对于生成完整测试用例来说，缺失的重要内容（如边界值、异常处理规则、权限控制细节等）\n3. **改进建议**：具体的补充建议，建议确认后添加到 PRD 中再生成测试用例\n\n请用简洁的列表形式输出。`,
            docRefs: useAnalysisDocRefs ? analysisDocRefs : undefined,
          });

          addMessage('ai', `📋 **PRD 分析反馈**\n\n${analysisRes.answer}\n\n💡 建议：确认以上内容后补充到 PRD，保存后再生成测试用例。`);
        } catch (analysisError) {
          console.warn('[optimizePRD] 分析反馈请求失败:', analysisError);
          // 分析失败不影响主流程
        }
    } catch (e) {
         console.error(e);
         addMessage('ai', '❌ 优化失败，请重试。');
         projectState.currentStep = 'content_review';
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

const backToContentReview = () => {
    // Restore raw DOM content
    projectState.documents.prd = projectState.assets.domMarkdown;
    projectState.currentStep = 'content_review';
    viewMode.value = 'edit';
    addMessage('user', '返回修改提取内容...');
};

const forwardToPRDReview = () => {
    if (hasGeneratedPRD.value && cachedPRD.value) {
        // 恢复优化后的PRD到 optimizedPrd（不覆盖原始PRD）
        projectState.documents.optimizedPrd = cachedPRD.value;
        projectState.currentStep = 'prd_review';
        viewMode.value = 'preview';
        activeMainDocType.value = 'optimizedPrd';
        addMessage('user', '返回优化PRD预览...');
    }
};

// ================= 多PRD引用：使用iframe提取 =================

// 通过iframe提取页面内容
const extractContentViaIframe = async (url: string): Promise<{ content: string; title: string }> => {
    return new Promise((resolve, reject) => {
        // 创建隐藏的iframe
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1200px;height:800px;border:none;';
        iframe.src = url;
        
        const timeout = setTimeout(() => {
            document.body.removeChild(iframe);
            reject(new Error('页面加载超时 (30s)'));
        }, 30000);
        
        iframe.onload = async () => {
            try {
                // 等待页面渲染
                await new Promise(r => setTimeout(r, 2000));
                
                // 尝试访问iframe内容（同源才可以）
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                
                if (!iframeDoc) {
                    throw new Error('无法访问页面内容（跨域限制）');
                }
                
                // 提取标题
                const title = iframeDoc.title || url.split('/').pop() || '未知文档';
                
                // 提取正文内容
                const body = iframeDoc.body;
                let content = '';
                
                // 尝试提取飞书文档内容
                const mainContent = body.querySelector('[class*="doc-content"], [class*="docx-content"], article, main, .content');
                if (mainContent) {
                    content = mainContent.textContent?.trim() || '';
                } else {
                    content = body.innerText?.trim() || '';
                }
                
                clearTimeout(timeout);
                document.body.removeChild(iframe);
                
                if (content.length < 50) {
                    throw new Error('提取内容过少，可能是跨域限制');
                }
                
                resolve({ content: content.slice(0, 50000), title });
            } catch (e: any) {
                clearTimeout(timeout);
                document.body.removeChild(iframe);
                reject(e);
            }
        };
        
        iframe.onerror = () => {
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            reject(new Error('页面加载失败'));
        };
        
        document.body.appendChild(iframe);
    });
};

// 使用新标签页方式提取（备选方案）
const extractContentViaTab = async (url: string): Promise<{ content: string; title: string; cdnUrls: string[] }> => {
    const result = await extractContentFromUrlWithFullAnalysis(url);
    const firstLine = result.content.split('\n').find(l => l.trim().startsWith('#'));
    const title = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : url.split('/').pop() || '文档';
    return { content: result.content, title, cdnUrls: result.cdnUrls };
};

// 添加额外PRD
const addAdditionalPrd = async () => {
    const url = newPrdUrl.value.trim();
    if (!url || !url.startsWith('http')) {
        addMessage('ai', '⚠️ 请输入有效的URL（以 http 或 https 开头）');
        return;
    }
    
    // 检查是否已添加
    if (additionalPrds.value.some(p => p.url === url)) {
        addMessage('ai', '⚠️ 该URL已添加');
        return;
    }
    
    const prdId = `prd-${Date.now()}`;
    const newPrd: AdditionalPrd = {
        id: prdId,
        url,
        title: '加载中...',
        status: 'loading',
        content: ''
    };
    
    additionalPrds.value.push(newPrd);
    newPrdUrl.value = '';
    
    try {
        // 优先使用标签页方式（更可靠）
        addMessage('ai', `📄 正在加载: ${url.slice(0, 50)}...`);
        const result = await extractContentViaTab(url);
        
        // 更新PRD状态
        const prd = additionalPrds.value.find(p => p.id === prdId);
        if (prd) {
            prd.title = result.title;
            prd.content = result.content;
            prd.status = 'success';
        }
        
        // 入库：调用 upsert 接口
        try {
          const sessionId = ensureSessionId();
          const docRef = await uploadAuxDoc(sessionId, result.content, result.title, `aux_prd_${prdId}`);
          if (prd && docRef) {
            (prd as any).docRef = docRef;
            console.log('[addAdditionalPrd] 已入库 docRef:', docRef);
          }
        } catch (upsertErr: any) {
          console.error('[addAdditionalPrd] upsert 失败:', upsertErr);
          // 入库失败不影响显示，只记录日志
        }
        
        // 切换到辅助PRD Tab显示
        activeRightTab.value = 'additional';
        activeAdditionalPrdId.value = prdId;
        
        addMessage('ai', `✅ 已加载《${result.title}》(${result.content.length} 字符)\n\n📑 右侧已新增Tab，点击可查看和编辑`);
    } catch (e: any) {
        const prd = additionalPrds.value.find(p => p.id === prdId);
        if (prd) {
            prd.status = 'error';
            prd.error = e.message || '加载失败';
            prd.title = '加载失败';
        }
        addMessage('ai', `❌ 加载失败: ${e.message || e}`);
    }
};

// 移除额外PRD
const removeAdditionalPrd = (id: string) => {
    additionalPrds.value = additionalPrds.value.filter(p => p.id !== id);
};

// 检查是否所有PRD都已加载完成
const allPrdsLoaded = computed(() => {
    return additionalPrds.value.length === 0 || 
           additionalPrds.value.every(p => p.status === 'success' || p.status === 'error');
});

// 检查是否所有Figma文档都已加载完成
const allFigmaLoaded = computed(() => {
    return figmaDocs.value.length === 0 || 
           figmaDocs.value.every(f => f.status === 'success' || f.status === 'error');
});

// ================= Figma MCP 调用 =================
// 解析Figma URL获取fileKey和nodeId
const parseFigmaUrl = (url: string): { fileKey: string; nodeId?: string } | null => {
    // 匹配 https://www.figma.com/file/xxx 或 https://www.figma.com/design/xxx
    const fileMatch = url.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/);
    if (!fileMatch) return null;
    
    const fileKey = fileMatch[2];
    
    // 提取 node-id 参数
    const nodeMatch = url.match(/node-id=([^&]+)/);
    const nodeId = nodeMatch ? decodeURIComponent(nodeMatch[1]).replace('-', ':') : undefined;
    
    return { fileKey, nodeId };
};

// 添加Figma文档
const addFigmaDoc = async () => {
    const url = newFigmaUrl.value.trim();
    if (!url) {
        addMessage('ai', '⚠️ 请输入Figma链接');
        return;
    }
    
    const parsed = parseFigmaUrl(url);
    if (!parsed) {
        addMessage('ai', '⚠️ 无效的Figma链接，请检查URL格式');
        return;
    }
    
    // 检查是否已添加
    if (figmaDocs.value.some(f => f.url === url)) {
        addMessage('ai', '⚠️ 该Figma链接已添加');
        return;
    }
    
    const docId = `figma-${Date.now()}`;
    const newDoc: FigmaDoc = {
        id: docId,
        url,
        title: '正在获取Figma设计...',
        status: 'loading',
        content: ''
    };
    
    figmaDocs.value.push(newDoc);
    newFigmaUrl.value = '';
    
    try {
        addMessage('ai', `🎨 正在获取Figma设计数据...\n\n文件: ${parsed.fileKey}${parsed.nodeId ? ` 节点: ${parsed.nodeId}` : ''}`);
        
        // Step 1: 通过Figma MCP获取设计数据
        // 注意：这里需要通过后端调用Figma MCP，或者直接在前端调用
        // 由于Figma MCP是通过Cursor调用的，我们需要通过ask接口让模型调用MCP
        statusText.value = '正在解析Figma设计...';
        
        // 调用ask接口，type为figma，让模型调用Figma MCP并生成文档
        const aiRes = await ask({
            code: 'plugin_test_figma',
            type: 'figma',
            sessionId: `figma-${Date.now()}`,
            params: {
                text: `请解析以下Figma设计链接，生成补充交互需求文档：\n\nFigma URL: ${url}\nFile Key: ${parsed.fileKey}${parsed.nodeId ? `\nNode ID: ${parsed.nodeId}` : ''}\n\n请调用Figma MCP获取设计数据，然后按照ask_figma.md规范生成文档。`,
                figmaUrl: url,
                fileKey: parsed.fileKey,
                nodeId: parsed.nodeId,
                pictureKeyList: [],
                isImageSolve: false,
                isImageByte64: false
            }
        });
        
        // 更新文档状态
        const doc = figmaDocs.value.find(f => f.id === docId);
        if (doc) {
            // 从输出中提取标题
            const firstLine = aiRes.answer.split('\n').find((l: string) => l.trim().startsWith('#'));
            doc.title = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : 'Figma交互补充文档';
            doc.content = aiRes.answer;
            doc.status = 'success';
        }
        
        // 切换到Figma Tab显示
        activeRightTab.value = 'figma';
        activeFigmaDocId.value = docId;
        
        addMessage('ai', `✅ Figma设计解析完成！\n\n📑 右侧已新增「${doc?.title || 'Figma文档'}」Tab，点击可查看和编辑`);
        
    } catch (e: any) {
        const doc = figmaDocs.value.find(f => f.id === docId);
        if (doc) {
            doc.status = 'error';
            doc.error = e.message || '解析失败';
            doc.title = 'Figma解析失败';
        }
        addMessage('ai', `❌ Figma解析失败: ${e.message || e}`);
    } finally {
        statusText.value = '';
    }
};

// 移除Figma文档
const removeFigmaDoc = (id: string) => {
    figmaDocs.value = figmaDocs.value.filter(f => f.id !== id);
    // 如果移除的是当前查看的，切回主Tab
    if (activeFigmaDocId.value === id) {
        activeRightTab.value = 'main';
        activeFigmaDocId.value = '';
    }
};

// 跳过Figma辅助
const skipFigmaPanel = () => {
    showFigmaPanel.value = false;
    // 继续优化PRD流程
    proceedToOptimizePRD();
};

// 确认Figma并优化PRD
const confirmFigmaAndOptimize = async () => {
    showFigmaPanel.value = false;
    await proceedToOptimizePRD();
};

// 执行PRD优化（带Figma补充）
const proceedToOptimizePRD = async () => {
    isProcessing.value = true;
    statusText.value = "正在优化PRD...";
    
    try {
        // 收集成功加载的辅助PRD和Figma文档
        const successfulPrds = additionalPrds.value.filter(p => p.status === 'success');
        const successfulFigmas = figmaDocs.value.filter(f => f.status === 'success');
        
        // 构建additionalPrds参数
        const additionalPrdParams: Array<{ title: string; content: string }> = [];
        
        // 添加辅助PRD
        for (const prd of successfulPrds) {
            additionalPrdParams.push({
                title: `[辅助PRD] ${prd.title}`,
                content: prd.content
            });
        }
        
        // 添加Figma补充文档（标记为交互细节）
        for (const figma of successfulFigmas) {
            additionalPrdParams.push({
                title: `[Figma交互补充] ${figma.title}`,
                content: figma.content
            });
        }
        
        const contextInfo = [];
        if (successfulPrds.length > 0) contextInfo.push(`${successfulPrds.length}个辅助PRD`);
        if (successfulFigmas.length > 0) contextInfo.push(`${successfulFigmas.length}个Figma交互文档`);
        
        if (contextInfo.length > 0) {
            addMessage('ai', `📚 正在结合 ${contextInfo.join('、')} 优化PRD...`);
        }
        
        const aiRes = await ask({
            code: 'plugin_test_testprd',
            type: 'testprd',
            sessionId: ensureSessionId() || `prd-optimize-${Date.now()}`,
            params: {
                text: projectState.documents.prd,
                pictureKeyList: projectState.assets.cdnUrls || [],
                isImageSolve: true,
                isImageByte64: true
            },
            additionalPrds: additionalPrdParams
        });
        
        projectState.assets.sessionId = aiRes.sessionId;
        // 存储到优化后PRD（不覆盖原始PRD）
        projectState.documents.optimizedPrd = aiRes.answer;
        cachedPRD.value = aiRes.answer;
        hasGeneratedPRD.value = true;
        projectState.currentStep = 'prd_review';
        viewMode.value = 'preview';
        activeRightTab.value = 'main';
        activeMainDocType.value = 'optimizedPrd';  // 切换到优化后PRD Tab
        
        addMessage('ai', `✅ PRD优化完成！${contextInfo.length > 0 ? `（已参考${contextInfo.join('、')}）` : ''}`);
        
    } catch (e: any) {
        addMessage('ai', `❌ PRD优化失败: ${e.message || e}`);
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

// 跳过添加额外PRD，直接生成用例
const skipAdditionalPrds = () => {
    showAdditionalPrdPanel.value = false;
    showFigmaPanel.value = false;
    addMessage('ai', '好的，将基于当前PRD继续。');
};

// 开始生成测试用例流程（先显示辅助面板）
const startGenerateTestCases = () => {
    // 提取当前PRD标题
    const firstLine = projectState.documents.prd.split('\n').find((l: string) => l.trim().startsWith('#'));
    currentPrdTitle.value = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : '需求文档';
    
    // 若当前无参考和引用，则弹出参考弹窗；否则直接生成
    referenceConfirmAction.value = 'testcase';
    confirmPickedDocIds.value = [];
    if (!hasAnyReference.value) {
      showReferenceConfirmModal.value = true;
    } else {
      proceedToGenerateTestCases();
    }
};

// 直接生成测试用例（跳过参考资料）
const proceedToGenerateTestCases = async () => {
    await confirmAndGenerateTestCases();
};

// 确认额外PRD并生成测试用例
const confirmAndGenerateTestCases = async () => {
    showAdditionalPrdPanel.value = false;
    showFigmaPanel.value = false;
    
    // 获取成功加载的辅助PRD和Figma
    const successfulPrds = additionalPrds.value.filter(p => p.status === 'success');
    const successfulFigmas = figmaDocs.value.filter(f => f.status === 'success');
    
    const contextInfo = [];
    if (successfulPrds.length > 0) contextInfo.push(`${successfulPrds.length}个辅助PRD`);
    if (successfulFigmas.length > 0) contextInfo.push(`${successfulFigmas.length}个Figma交互`);
    
    if (contextInfo.length > 0) {
        addMessage('ai', `📚 正在结合 ${contextInfo.join('、')} 生成测试用例...`);
    }
    
    // 调用生成测试用例
    isProcessing.value = true;
    statusText.value = "正在生成测试用例...";
    
    try {
        // 构建辅助PRD列表参数（包含辅助PRD、Figma、@引用/弹窗引用等）
        const additionalPrdParams = buildAdditionalPrdsForRequest();

        const baseText = projectState.documents.optimizedPrd || projectState.documents.prd;
      if (projectState.documents.testPoints?.trim()) {
        additionalPrdParams.unshift({ title: '[测试点]', content: projectState.documents.testPoints });
      }
      
      // 构建 docRefs（优先使用已入库的文档）
      const docRefs = buildDocRefsForAsk('testcase');
      const useDocRefs = docRefs.length > 0 && hasStoredMainPrd();
      
      console.log('[confirmAndGenerateTestCases] 使用 docRefs 模式:', useDocRefs, 'docRefs:', docRefs);

      const aiRes = await ask({
          code: 'plugin_test_testcase',
          type: 'testcase',
          sessionId: ensureSessionId(),
          params: {
              text: useDocRefs ? '' : baseText,
          },
          docRefs: useDocRefs ? docRefs : undefined,
          additionalPrds: useDocRefs ? undefined : additionalPrdParams,
          outputFormat: testCaseOutputFormat.value,
      });

        projectState.documents.testCases = aiRes.answer;
        cachedTestCases.value = aiRes.answer;
        hasGeneratedTestCases.value = true;
        // 智能命名：基于 PRD 标题
        autoNameTestCases({ docTitle: currentPrdTitle.value || optimizedPrdTitle.value });

        // 保存生成的 docRef（用于后续阶段）
        if ((aiRes as any).generatedDocRef) {
          generatedDocRefs.testCases = (aiRes as any).generatedDocRef;
          console.log('[confirmAndGenerateTestCases] 已保存 generatedDocRef:', generatedDocRefs.testCases);
        }
        
        // 同步 lastSavedContent（标记为已保存状态）
        lastSavedContent.testCases = aiRes.answer;
        
        projectState.currentStep = 'test_case';
        viewMode.value = 'preview';
        activeRightTab.value = 'main';
        activeMainDocType.value = 'testCases';  // 切换到测试用例Tab
        
        addMessage('ai', `🎉 测试用例已生成！${contextInfo.length > 0 ? `（已参考${contextInfo.join('、')}）` : ''}`);
    } catch (e: any) {
        addMessage('ai', `❌ 生成失败: ${e.message || e}`);
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

const regeneratePRD = async () => {
  isProcessing.value = true;
  statusText.value = "正在重新生成...";
  addMessage('user', '重新优化 PRD...');
  
  try {
      // 基于原始PRD重新优化
      const sourceText = projectState.documents.prd || projectState.documents.optimizedPrd;
      const aiRes = await ask({
          code: 'plugin_test_testprd', 
          type: 'testprd',
          sessionId: ensureSessionId(),
          params: {
              text: sourceText + "\n(请重新生成)",
              pictureKeyList: projectState.assets.cdnUrls || (projectState.assets.cdnUrl ? [projectState.assets.cdnUrl] : []),
              isImageSolve: true,
              isImageByte64: true
          }
      });
      // 存储到优化后PRD
      projectState.documents.optimizedPrd = aiRes.answer;
      cachedPRD.value = aiRes.answer;
      activeMainDocType.value = 'optimizedPrd';
      addMessage('ai', '✅ PRD 已重新优化！');
  } catch(e) {
      console.error(e);
      addMessage('ai', '生成失败，请重试。');
  } finally {
      isProcessing.value = false;
      statusText.value = '';
  }
};

const proceedToTestPoints = async () => {
  isProcessing.value = true;
  statusText.value = "正在拆解测试点...";
  addMessage('user', 'PRD 确认无误，生成测试点...');
  
  try {
      // Test Point Generation
      const baseText = projectState.documents.optimizedPrd || projectState.documents.prd;
      const additionalPrdParams = buildAdditionalPrdsForRequest();
      
      // 构建 docRefs（优先使用已入库的文档）
      const docRefs = buildDocRefsForAsk('testpoint');
      const useDocRefs = docRefs.length > 0 && hasStoredMainPrd();
      
      console.log('[proceedToTestPoints] 使用 docRefs 模式:', useDocRefs, 'docRefs:', docRefs);

      const aiRes = await ask({
          code: 'plugin_test_testpoint',
          type: 'testpoint',
          sessionId: ensureSessionId(),
          params: {
              text: useDocRefs ? '' : baseText,
          },
          docRefs: useDocRefs ? docRefs : undefined,
          additionalPrds: useDocRefs ? undefined : additionalPrdParams
      });
      
      projectState.documents.testPoints = aiRes.answer;
      cachedTestPoints.value = aiRes.answer;
      hasGeneratedTestPoints.value = true;
      
      // 保存生成的 docRef（用于后续阶段）
      if ((aiRes as any).generatedDocRef) {
        generatedDocRefs.testPoints = (aiRes as any).generatedDocRef;
        console.log('[proceedToTestPoints] 已保存 generatedDocRef:', generatedDocRefs.testPoints);
      }
      
      // 同步 lastSavedContent（标记为已保存状态）
      lastSavedContent.testPoints = aiRes.answer;

      projectState.currentStep = 'test_point';
      viewMode.value = 'preview';
      activeRightTab.value = 'main';
      activeMainDocType.value = 'testPoints';  // 切换到测试点Tab
      addMessage('ai', '测试点已拆解，请确认。');
  } catch(e) {
      console.error(e);
      addMessage('ai', '生成失败。');
  } finally {
      isProcessing.value = false;
      statusText.value = '';
  }
};

const proceedToTestCasesFromPRD = async () => {
  isProcessing.value = true;
  statusText.value = "正在根据 PRD 生成测试用例...";
  addMessage('user', '跳过测试点，直接生成测试用例...');
  
  try {
      const baseText = projectState.documents.optimizedPrd || projectState.documents.prd;
      const additionalPrdParams = buildAdditionalPrdsForRequest();
      
      // 构建 docRefs（优先使用已入库的文档）
      const docRefs = buildDocRefsForAsk('testcase');
      const useDocRefs = docRefs.length > 0 && hasStoredMainPrd();
      
      console.log('[proceedToTestCasesFromPRD] 使用 docRefs 模式:', useDocRefs, 'docRefs:', docRefs);

      const aiRes = await ask({
          code: 'plugin_test_testcase',
          type: 'testcase',
          sessionId: ensureSessionId(),
          params: {
              text: useDocRefs ? '' : baseText,
          },
          docRefs: useDocRefs ? docRefs : undefined,
          additionalPrds: useDocRefs ? undefined : additionalPrdParams,
          outputFormat: testCaseOutputFormat.value,
      });

      projectState.documents.testCases = aiRes.answer;
      cachedTestCases.value = aiRes.answer;
      hasGeneratedTestCases.value = true;
      // 智能命名：基于 PRD 标题（直接生成模式）
      autoNameTestCases({ docTitle: currentPrdTitle.value || optimizedPrdTitle.value });

      // Reset Test Case Agent Session
      await clearTestCaseSession(testCaseAgentSessionId.value);
      testCaseAgentSessionId.value = `testcase-session-${Date.now()}`;
      testCaseHistory.value = [];

      projectState.currentStep = 'test_case';
      viewMode.value = 'preview';
      activeRightTab.value = 'main';
      activeMainDocType.value = 'testCases';  // 切换到测试用例Tab
      addMessage('ai', '测试用例已生成！');
  } catch(e) {
      console.error(e);
      addMessage('ai', '生成失败。');
  } finally {
      isProcessing.value = false;
      statusText.value = '';
  }
};

const backToPRD = () => {
  projectState.currentStep = 'prd_review';
  viewMode.value = 'preview'; // Usually we want to see preview when going back
};

const forwardToTestPoints = () => {
    if (hasGeneratedTestPoints.value) {
        projectState.documents.testPoints = cachedTestPoints.value;
        projectState.currentStep = 'test_point';
        viewMode.value = 'preview';
        addMessage('user', '返回测试点预览...');
    }
};

const proceedToTestCases = async () => {
  isProcessing.value = true;
  statusText.value = "正在生成测试用例...";
  addMessage('user', '测试点确认，生成用例...');
  
  const hasFigma = !!projectState.inputs.figmaUrl;
  
  try {
      // Test Case Generation
      const baseText = projectState.documents.optimizedPrd || projectState.documents.prd;
      const additionalPrdParams = buildAdditionalPrdsForRequest();
      if (projectState.documents.testPoints?.trim()) {
        additionalPrdParams.unshift({ title: '[测试点]', content: projectState.documents.testPoints });
      }
      
      // 构建 docRefs（优先使用已入库的文档）
      const docRefs = buildDocRefsForAsk('testcase');
      const useDocRefs = docRefs.length > 0 && hasStoredMainPrd();
      
      console.log('[proceedToTestCases] 使用 docRefs 模式:', useDocRefs, 'docRefs:', docRefs);

      const aiRes = await ask({
          code: 'plugin_test_testcase',
          type: 'testcase',
          sessionId: ensureSessionId(),
          params: {
              text: useDocRefs ? '' : baseText,
          },
          docRefs: useDocRefs ? docRefs : undefined,
          additionalPrds: useDocRefs ? undefined : additionalPrdParams,
          outputFormat: testCaseOutputFormat.value,
      });

      projectState.documents.testCases = aiRes.answer;
      cachedTestCases.value = aiRes.answer;
      hasGeneratedTestCases.value = true;
      // 智能命名：基于 PRD 标题（从测试点生成模式）
      autoNameTestCases({ docTitle: currentPrdTitle.value || testPointsTitle.value });

      // Reset Test Case Agent Session
      await clearTestCaseSession(testCaseAgentSessionId.value);
      testCaseAgentSessionId.value = `testcase-session-${Date.now()}`;
      testCaseHistory.value = [];

      projectState.currentStep = 'test_case';
      viewMode.value = 'preview';
      activeRightTab.value = 'main';
      activeMainDocType.value = 'testCases';  // 切换到测试用例Tab
      addMessage('ai', '测试用例已生成！');
  } catch(e) {
      console.error(e);
      addMessage('ai', '生成失败。');
  } finally {
      isProcessing.value = false;
      statusText.value = '';
  }
};

const backToTestPoints = () => {
  projectState.currentStep = 'test_point';
  viewMode.value = 'preview';
};

const forwardToTestCases = () => {
    if (hasGeneratedTestCases.value) {
        projectState.documents.testCases = cachedTestCases.value;
        projectState.currentStep = 'test_case';
        viewMode.value = 'preview';
        addMessage('user', '返回用例结果...');
    }
};

// ================= UI 智能体 (Auto Test) =================

const uiViewType = ref<'plan' | 'plan_json' | 'report'>('plan');
const showScreenshotModal = ref(false);
const screenshotList = ref<{filename: string; step: string; base64: string}[]>([]);
const screenshotCount = ref(0);
const previewingScreenshot = ref<{step: string; base64: string} | null>(null);

const toggleUiDoc = (type: 'plan' | 'plan_json' | 'report') => {
    uiViewType.value = type;
    viewMode.value = 'preview';
};

// 处理可视化测试结果
const handleFlowResult = (result: any) => {
    console.log('[App] FlowEditor result:', result);
    // 将结果转换为报告格式
    if (result && result.status) {
        const reportMd = `# 可视化测试完成\n\n状态: ${result.status}\n通过: ${result.summary?.passed || 0}\n失败: ${result.summary?.failed || 0}`;
        projectState.documents.uiReport = reportMd;
        // 提示用户
        if (result.status === 'success') {
            addMessage('ai', `✅ 可视化测试执行完成！通过 ${result.summary?.passed || 0} 个步骤，失败 ${result.summary?.failed || 0} 个步骤。`);
        } else {
            addMessage('ai', `⚠️ 可视化测试执行完成，部分步骤失败。通过 ${result.summary?.passed || 0} 个，失败 ${result.summary?.failed || 0} 个。`);
        }
    }
};

// 显示截图弹窗
const showScreenshots = async () => {
    showScreenshotModal.value = true;
    await refreshScreenshots();
};

// 刷新截图列表
const refreshScreenshots = async () => {
    try {
        const result = await getUiScreenshots();
        if (result.status === 'success') {
            screenshotList.value = result.screenshots;
            screenshotCount.value = result.total;
        }
    } catch (e) {
        console.error('获取截图失败:', e);
    }
};

// 清空所有截图
const clearAllScreenshots = async () => {
    if (!confirm('确定清空所有截图吗？')) return;
    await clearUiScreenshots();
    screenshotList.value = [];
    screenshotCount.value = 0;
    addMessage('ai', '🗑️ 所有截图已清空');
};

// 预览单张截图
const previewScreenshot = (ss: {step: string; base64: string}) => {
    previewingScreenshot.value = ss;
};

// UI Agent 模式检测
const UI_DOCUMENT_KEYWORDS = ['分析页面', '分析当前', '页面分析', '生成计划', '测试计划', '执行测试', '自动化测试', '生成报告', '测试报告'];

const getUiAgentMode = (input: string): 'document' | 'action' => {
    if (!input) return 'action';
    return UI_DOCUMENT_KEYWORDS.some(keyword => input.includes(keyword)) ? 'document' : 'action';
};

// 执行计划关键词：命中后会把右侧的计划文本作为 plan 传给后端 runner
const UI_EXECUTE_PLAN_KEYWORDS = ['执行测试计划', '执行计划', '运行计划', '按计划执行', '执行测试', '生成报告', 'run plan', 'execute plan'];

const shouldExecutePlan = (input: string): boolean => {
    if (!input) return false;
    const s = input.toLowerCase();
    return UI_EXECUTE_PLAN_KEYWORDS.some(k => s.includes(k.toLowerCase()));
};

const sendUiAgentMessage = async (userInput?: string, frozenSelected?: RefDoc[], frozenAdditionalPrds?: Array<{ title: string; content: string }>) => {
    // 支持从 unifiedInput 传入，或使用 uiAgentInput
    const inputText = userInput || uiAgentInput.value;
    if (!inputText || isProcessing.value) return;

    // 1. 获取当前标签页 URL
    let currentUrl = '';
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab?.url || '';
    } catch (e) {
        console.warn("无法获取标签页信息");
    }

    // 清空输入框（如果是从 unifiedInput 调用，需要在调用处清空）
    if (!userInput) {
        uiAgentInput.value = '';
    }

    addMessage('user', inputText);
    isProcessing.value = true;
    statusText.value = "🤖 UI 自动化智能体运行中...";

    try {
        // 若用户明确要“执行测试计划/生成报告”，并且右侧计划区有内容，则强制把右侧内容作为 plan 传入
        // 注意：右侧在 auto_test 步骤里通过 activeMainDocContent 绑定 plan/report；这里仅取 plan（避免把 report 误当 plan）
        let planToSend = projectState.documents.uiPlan || '';
        const additionalPrdsToSend = frozenAdditionalPrds ?? buildAdditionalPrdsForRequest();

        if (shouldExecutePlan(inputText)) {
            // 如果用户显式用 @ 引用文档：优先用第一个选中文档作为 plan 执行
            if (frozenSelected && frozenSelected.length > 0) {
                planToSend = (frozenSelected[0].content || '').trim() || planToSend;
            } else if (additionalPrdsToSend.length > 0) {
                planToSend = additionalPrdsToSend[0].content;
            } else {
                // 优先使用右侧当前正在查看/编辑的内容（plan 或 plan_json），避免执行时拿到旧计划
                const rightPlan = (activeMainDocContent.value || projectState.documents.uiPlan || '').trim();
                if (rightPlan) planToSend = rightPlan;
            }
        }

        const result = await uiAgent({
            sessionId: uiAgentSessionId.value,
            instruction: inputText,
            url: currentUrl,
            plan: planToSend,
            report: projectState.documents.uiReport,
            headless: false,  // 始终使用 CDP 连接（用户通过脚本控制有头/无头）
            workflow: uiWorkflowMode.value,
            autoHeal: uiWorkflowMode.value === 'closed_loop' ? uiAutoHeal.value : undefined,
            maxHealRounds: uiWorkflowMode.value === 'closed_loop' ? uiMaxHealRounds.value : undefined,
            additionalPrds: additionalPrdsToSend
        });

        if (result.status === 'success') {
            // 更新截图数量
            if (result.screenshotCount && result.screenshotCount > 0) {
                screenshotCount.value = result.screenshotCount;
            }
            
            // 更新文档（注意：执行测试计划可能同时返回 plan + report）
            if (result.type === 'closed_loop_done' && result.report) {
                // 闭环模式完成：同时返回 plan 和 report
                if (result.plan) projectState.documents.uiPlan = result.plan;
                if (result.planJson) projectState.documents.uiPlanJson = result.planJson;
                projectState.documents.uiReport = result.report;
                uiViewType.value = 'report';

                const ssInfo = result.screenshotCount ? `\n\n📸 已捕获 ${result.screenshotCount} 张测试截图，点击左侧"查看截图"按钮查看` : '';
                addMessage('ai', `✅ **闭环测试完成！**\n\n${result.response}${ssInfo}\n\n*右侧可查看完整报告*`);
            } else if (result.type === 'report_generated' && result.report) {
                if (result.plan) projectState.documents.uiPlan = result.plan;
                if (result.planJson) projectState.documents.uiPlanJson = result.planJson;
                projectState.documents.uiReport = result.report;
                uiViewType.value = 'report';

                const ssInfo = result.screenshotCount ? `\n\n📸 已捕获 ${result.screenshotCount} 张测试截图，点击左侧"查看截图"按钮查看` : '';
                addMessage('ai', `✅ **测试报告已生成！**\n\n${result.response}${ssInfo}\n\n*右侧可查看完整报告*`);
            } else if (result.type === 'plan_generated' && result.plan) {
                projectState.documents.uiPlan = result.plan;
                if (result.planJson) projectState.documents.uiPlanJson = result.planJson;
                uiViewType.value = 'plan';
                addMessage('ai', `✅ **测试计划已生成！**\n\n${result.response}\n\n*右侧可查看完整计划，点击"执行测试"开始自动化测试*`);
            } else if (result.plan) {
                // 兼容旧返回：只返回 plan
                projectState.documents.uiPlan = result.plan;
                uiViewType.value = 'plan';
                addMessage('ai', `✅ **测试计划已生成！**\n\n${result.response}\n\n*右侧可查看完整计划，点击"执行测试"开始自动化测试*`);
            } else if (result.report) {
                // 兼容旧返回：只返回 report
                projectState.documents.uiReport = result.report;
                uiViewType.value = 'report';
                
                const ssInfo = result.screenshotCount ? `\n\n📸 已捕获 ${result.screenshotCount} 张测试截图，点击左侧"查看截图"按钮查看` : '';
                addMessage('ai', `✅ **测试报告已生成！**\n\n${result.response}${ssInfo}\n\n*右侧可查看完整报告*`);
            } else {
                // 分析类响应
                addMessage('ai', result.response);
            }
            
            // 如果生成了新文档，自动切换到预览
            if (result.type === 'plan_generated' || result.type === 'report_generated' || result.type === 'closed_loop_done') {
                viewMode.value = 'preview';
            }
            
            nextTick(() => {
                if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
            });
        } else {
            addMessage('ai', `❌ **执行失败**\n\n${result.response}`);
        }
    } catch (e: any) {
        console.error("UI Agent Error", e);
        addMessage('ai', `⚠️ **连接失败**

请确保以下服务已启动：

1. **本地 Agent 服务** (Port 8000)
   \`\`\`bash
   cd agent-server && ./run_agent.sh
   \`\`\`

2. **Chrome 调试模式** (Port 9222)
   \`\`\`bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_test"
   \`\`\`

错误信息: ${e.message || e}`);
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

// 导出测试计划
const exportUiPlan = () => {
    if (!projectState.documents.uiPlan) return;
    const blob = new Blob([projectState.documents.uiPlan], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UI自动化测试计划_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addMessage('ai', '📥 测试计划已导出');
};

// 导出测试报告
const exportUiReport = () => {
    if (!projectState.documents.uiReport) return;
    const blob = new Blob([projectState.documents.uiReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UI自动化测试报告_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addMessage('ai', '📥 测试报告已导出');
};

// 重置 UI 自动化测试
const resetUiAgent = async () => {
    if (!confirm("确定重置 UI 自动化测试吗？这将清除测试计划、报告和截图。")) return;
    
    await clearUiSession(uiAgentSessionId.value);
    await clearUiScreenshots();
    uiAgentSessionId.value = `ui-session-${Date.now()}`;
    projectState.documents.uiPlan = '';
    projectState.documents.uiReport = '';
    uiViewType.value = 'plan';
    screenshotCount.value = 0;
    screenshotList.value = [];
    
    addMessage('ai', '🔄 UI 自动化测试已重置（计划、报告、截图已清空）');
};

// Rendered Midscene report (Markdown → HTML)
// Selected case detail for right panel
const selectedCaseDetail = computed(() => {
    if (!midsceneSelectedCaseId.value) return null;
    return midsceneParsedCases.value.find(c => c.id === midsceneSelectedCaseId.value) || null;
});

// ===================== 前端步骤类型推断预览 =====================

/** 步骤类型映射表：类型 → {label, color, tip} */
const stepTypeMap: Record<string, { label: string; color: string; tip: string }> = {
    tap:        { label: '点击',   color: '#10b981', tip: '精准执行 aiTap，速度最快' },
    input:      { label: '输入',   color: '#3b82f6', tip: '精准执行 aiInput，速度快' },
    assert:     { label: '断言',   color: '#8b5cf6', tip: '执行 aiAssert 验证' },
    scroll:     { label: '滚动',   color: '#f59e0b', tip: '精准执行 aiScroll' },
    hover:      { label: '悬停',   color: '#06b6d4', tip: '精准执行 aiHover' },
    keypress:   { label: '按键',   color: '#64748b', tip: '精准执行 aiKeyboardPress' },
    wait:       { label: '等待',   color: '#94a3b8', tip: '等待指定时间' },
    navigate:   { label: '导航',   color: '#0ea5e9', tip: '页面跳转' },
    doubleTap:  { label: '双击',   color: '#10b981', tip: '精准执行双击' },
    rightClick: { label: '右键',   color: '#10b981', tip: '精准执行右键点击' },
    aiAct:      { label: 'AI执行', color: '#ef4444', tip: '⚠️ 无法精确识别，将交给 AI 自由执行（较慢）' },
};

/**
 * 前端轻量级步骤类型推断（与后端 step-inference.ts 对齐）
 * 用于编辑器实时预览，不调用后端接口
 */
const inferStepType = (stepText: string): { type: string; label: string; color: string; tip: string } => {
    const text = stepText.trim();
    if (!text) return { type: 'aiAct', ...stepTypeMap['aiAct'] };

    // 断言
    if (/^(?:断言|验证|确认|检查|确保|assert|verify|check)\s*[:：]?\s*.+/i.test(text)) {
        return { type: 'assert', ...stepTypeMap['assert'] };
    }
    // 等待
    if (/^(?:等待|延时|延迟|wait|sleep|pause)\s*(\d+)?\s*(?:秒|s|ms|毫秒)?\s*$/i.test(text)) {
        return { type: 'wait', ...stepTypeMap['wait'] };
    }
    // 导航
    if (/^(?:跳转到|访问|打开(?:URL|页面|网址)?|导航到|navigate\s+to|go\s+to|open)\s+(https?:\/\/\S+)/i.test(text)) {
        return { type: 'navigate', ...stepTypeMap['navigate'] };
    }
    // 输入类（带目标）
    if (/(?:在|到).+(?:中|里|内)?(?:输入|填写|填入|键入|录入|写入)\s*.+$/i.test(text)) {
        return { type: 'input', ...stepTypeMap['input'] };
    }
    if (/(?:输入|填写|填入|键入)\s*.+?\s*(?:到|在|至)\s*.+/i.test(text)) {
        return { type: 'input', ...stepTypeMap['input'] };
    }
    if (/(?:type|enter|input|fill)\s+.+?\s+(?:in|into|to)\s+.+/i.test(text)) {
        return { type: 'input', ...stepTypeMap['input'] };
    }
    if (/.+?(?:输入框|文本框|搜索框|编辑框|字段)(?:中|里|内)?(?:输入|填写|填入|键入)\s*.+$/i.test(text)) {
        return { type: 'input', ...stepTypeMap['input'] };
    }
    // 输入类（无目标，如 "输入1+1=?"）
    if (/^(?:输入|填写|填入|键入|录入|写入)\s*.+$/i.test(text) && !/^(?:输入|填写|填入|键入|录入|写入)\s*(?:框|栏|区|字段|区域)$/i.test(text)) {
        return { type: 'input', ...stepTypeMap['input'] };
    }
    if (/^(?:type|enter|input)\s+.+$/i.test(text) && !/\b(?:in|into|to)\b/i.test(text)) {
        return { type: 'input', ...stepTypeMap['input'] };
    }
    // 双击
    if (/双击|double[\s-]?click/i.test(text)) return { type: 'doubleTap', ...stepTypeMap['doubleTap'] };
    // 右键
    if (/右键点击|右键单击|右键|右击|right[\s-]?click/i.test(text)) return { type: 'rightClick', ...stepTypeMap['rightClick'] };
    // 悬停
    if (/悬停在?|hover\s*(on|over)?|鼠标移到|鼠标移动到/i.test(text)) return { type: 'hover', ...stepTypeMap['hover'] };
    // 滚动
    if (/滚动|scroll|向[上下左右]|翻页|下拉|上拉|滑动/i.test(text)) return { type: 'scroll', ...stepTypeMap['scroll'] };
    // 按键
    if (/按下|按键|press|回车|enter|tab|escape|esc|delete|backspace|空格/i.test(text)) return { type: 'keypress', ...stepTypeMap['keypress'] };
    // 点击
    if (/点击|单击|选择|勾选|打开|关闭|切换|选中|取消选中|展开|收起|click|tap|select|check|uncheck|toggle|open|close/i.test(text)) {
        return { type: 'tap', ...stepTypeMap['tap'] };
    }
    // 兜底
    return { type: 'aiAct', ...stepTypeMap['aiAct'] };
};

// ===================== 用例 steps 内联编辑 =====================

/** 开始编辑选中用例的 steps */
const startEditCaseSteps = () => {
    const tc = selectedCaseDetail.value;
    if (!tc) return;
    editingCaseId.value = tc.id;
    editingStepsBuffer.value = [...(tc.steps || [])];
    if (editingStepsBuffer.value.length === 0) editingStepsBuffer.value.push('');
    editingCaseSteps.value = true;
};

/** 取消编辑 */
const cancelEditCaseSteps = () => {
    editingCaseSteps.value = false;
    editingStepsBuffer.value = [];
    editingCaseId.value = '';
};

/** 添加一个空步骤 */
const addEditingStep = () => {
    editingStepsBuffer.value.push('');
};

/** 删除指定步骤 */
const removeEditingStep = (index: number) => {
    editingStepsBuffer.value.splice(index, 1);
    if (editingStepsBuffer.value.length === 0) editingStepsBuffer.value.push('');
};

/** 上移步骤 */
const moveEditingStepUp = (index: number) => {
    if (index <= 0) return;
    const arr = editingStepsBuffer.value;
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
};

/** 下移步骤 */
const moveEditingStepDown = (index: number) => {
    const arr = editingStepsBuffer.value;
    if (index >= arr.length - 1) return;
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
};

/** 将 MidsceneTestCase[] 序列化回简单 YAML 格式 */
const serializeCasesToYaml = (cases: MidsceneTestCase[]): string => {
    return cases.map(tc => {
        let yaml = `- id: ${tc.id}\n  name: ${tc.name}`;
        if (tc.scenario) yaml += `\n  scenario: ${tc.scenario}`;
        if (tc.preconditions) yaml += `\n  preconditions: ${tc.preconditions}`;
        if (tc.priority) yaml += `\n  priority: ${tc.priority}`;
        if (tc.steps && tc.steps.length > 0) {
            yaml += `\n  steps:`;
            for (const s of tc.steps) yaml += `\n    - ${s}`;
        }
        if (tc.expectedResults && tc.expectedResults.length > 0) {
            yaml += `\n  expectedResults:`;
            for (const er of tc.expectedResults) yaml += `\n    - ${er}`;
        }
        return yaml;
    }).join('\n\n');
};

/** 保存 steps 编辑（同步到内存 + 原始文档） */
const saveCaseStepsEdit = () => {
    const caseId = editingCaseId.value;
    const tc = midsceneParsedCases.value.find(c => c.id === caseId);
    if (!tc) return;

    // 过滤空步骤
    const newSteps = editingStepsBuffer.value.filter(s => s.trim());
    tc.steps = newSteps.length > 0 ? newSteps : undefined;

    // 同步回原始文档（重新序列化）
    projectState.documents.testCases = serializeCasesToYaml(midsceneParsedCases.value);
    projectState.documents.midsceneCasesJson = JSON.stringify(midsceneParsedCases.value, null, 2);

    editingCaseSteps.value = false;
    editingStepsBuffer.value = [];
    editingCaseId.value = '';
    addMessage('ai', `已保存用例 ${caseId} 的步骤修改（${newSteps.length} 步），正在同步到知识库...`);

    // 自动保存到知识库
    autoSaveTestCasesToKnowledge('步骤编辑').then(() => {
        addMessage('ai', `✅ 步骤修改已同步到知识库`);
    });
};

// ===================== 快速创建用例 =====================

const resetQuickCreateForm = () => {
    const nextId = `TC-${String(midsceneParsedCases.value.length + 1).padStart(3, '0')}`;
    quickCreateForm.value = { name: '', scenario: '', steps: [''], expectedResults: [''] };
    quickCreateForm.value.name = '';
};

const addQuickCreateStep = () => { quickCreateForm.value.steps.push(''); };
const removeQuickCreateStep = (i: number) => {
    quickCreateForm.value.steps.splice(i, 1);
    if (quickCreateForm.value.steps.length === 0) quickCreateForm.value.steps.push('');
};
const addQuickCreateExpected = () => { quickCreateForm.value.expectedResults.push(''); };
const removeQuickCreateExpected = (i: number) => {
    quickCreateForm.value.expectedResults.splice(i, 1);
    if (quickCreateForm.value.expectedResults.length === 0) quickCreateForm.value.expectedResults.push('');
};

/** 提交快速创建表单 */
const submitQuickCreate = () => {
    const f = quickCreateForm.value;
    if (!f.name.trim()) { addMessage('ai', '请填写用例名称'); return; }

    const nextId = `TC-${String(midsceneParsedCases.value.length + 1).padStart(3, '0')}`;
    const steps = f.steps.filter(s => s.trim());
    const expectedResults = f.expectedResults.filter(e => e.trim());
    const scenario = f.scenario.trim() || (steps.length > 0 ? steps.join('，然后') : f.name);

    const newCase: MidsceneTestCase = {
        id: nextId,
        name: f.name.trim(),
        scenario,
        expectedResults,
        steps: steps.length > 0 ? steps : undefined,
    };

    midsceneParsedCases.value.push(newCase);
    midsceneSelectedCases.value.add(nextId);

    // 同步回原始文档
    projectState.documents.testCases = serializeCasesToYaml(midsceneParsedCases.value);
    projectState.documents.midsceneCasesJson = JSON.stringify(midsceneParsedCases.value, null, 2);

    quickCreateVisible.value = false;
    resetQuickCreateForm();
    addMessage('ai', `已创建用例 ${nextId}: ${newCase.name}，正在同步到知识库...`);

    // 自动保存到知识库
    autoSaveTestCasesToKnowledge('快速创建用例').then(() => {
        addMessage('ai', `✅ 用例 ${nextId} 已同步到知识库`);
    });
};

// ===================== Step 4 模板插入 =====================

const testCaseTemplates: Record<string, { label: string; content: string }> = {
    yaml: {
        label: 'YAML 格式',
        content: `- id: TC-001
  name: 登录功能测试
  scenario: 验证用户可以正常登录系统
  preconditions: 已有注册账号
  priority: P0
  steps:
    - 点击登录按钮
    - 在用户名输入框中输入 admin
    - 在密码输入框中输入 123456
    - 点击提交按钮
  expectedResults:
    - 页面跳转到首页
    - 页面显示欢迎信息

- id: TC-002
  name: 搜索功能测试
  scenario: 验证搜索功能返回正确结果
  priority: P1
  steps:
    - 点击搜索框
    - 在搜索框中输入 测试关键词
    - 点击搜索按钮
  expectedResults:
    - 页面显示搜索结果列表`,
    },
    table: {
        label: '表格格式',
        content: `| ID | Module | Test Point | Scenario | Preconditions | Steps | Expected Results | Priority |
|---|---|---|---|---|---|---|---|
| TC-001 | 登录模块 | 用户登录 | 验证正常登录流程 | 已注册账号 | 1.点击登录按钮 2.输入用户名admin 3.输入密码123456 4.点击提交 | 跳转到首页 | P0 |
| TC-002 | 搜索模块 | 关键词搜索 | 验证搜索功能 | - | 1.点击搜索框 2.输入关键词 3.点击搜索按钮 | 显示搜索结果列表 | P1 |`,
    },
};

/** 将模板插入编辑器 */
const insertTestCaseTemplate = (format: string) => {
    const tpl = testCaseTemplates[format];
    if (!tpl) return;
    projectState.documents.testCases = tpl.content;
    manualGuideVisible.value = false;
    viewMode.value = 'edit';
    activeRightTab.value = 'main';
    activeMainDocType.value = 'testCases';

    // 同步解析用例列表（用户编辑模板后可直接在 Step 5 看到）
    const parsed = parseTestCases(tpl.content, testCaseOutputFormat.value);
    if (parsed.length > 0) {
        midsceneParsedCases.value = parsed;
        midsceneSelectedCases.value = new Set(parsed.map(c => c.id));
        projectState.documents.midsceneCasesJson = JSON.stringify(parsed, null, 2);
    }

    addMessage('ai', `已插入 ${tpl.label} 模板，请在右侧编辑器中修改内容后点击「💾 保存」同步到知识库`);
};

// Get assertion status for a specific case's expected result
const getAssertionStatus = (caseId: string, assertIdx: number): string => {
    const result = getCaseResult(caseId);
    if (!result?.assertions) return '';
    const a = result.assertions[assertIdx];
    if (!a) return '';
    return a.success ? 'PASS' : 'FAIL';
};

const renderedMidsceneReport = computed(() => {
    const md = projectState.documents.midsceneReport;
    if (!md) return '<div class="midscene-empty">暂无执行结果。请先执行测试用例。</div>';
    return renderMarkdown(md);
});

// ================= Midscene Engine Functions =================

const switchUiEngine = async () => {
    uiEngine.value = uiEngine.value === 'legacy' ? 'midscene' : 'legacy';
    if (uiEngine.value === 'midscene') {
        await initMidsceneView();
    }
};

const initMidsceneView = async () => {
    // 1. Check Sidecar health
    midsceneSidecarReady.value = await checkMidsceneHealth();

    // 2. 解析测试用例（每次进入时重新解析，确保手动编辑的内容生效）
    const rawCases = projectState.documents.testCases;
    if (rawCases) {
        const parsed = parseTestCases(rawCases, testCaseOutputFormat.value);
        if (parsed.length > 0) {
            midsceneParsedCases.value = parsed;
            midsceneSelectedCases.value = new Set(parsed.map(c => c.id));
            projectState.documents.midsceneCasesJson = JSON.stringify(parsed, null, 2);
        }
    }

    const casesCount = midsceneParsedCases.value.length;
    const sidecarStatus = midsceneSidecarReady.value ? 'Sidecar OK (Port 3100)' : 'Sidecar 未启动 - 请运行: cd agent-server/midscene-sidecar && npm start';

    const casesGuide = casesCount > 0
      ? `已解析 **${casesCount}** 条测试用例，勾选后点击 ▶️ 执行`
      : `暂无测试用例，可通过以下方式添加：
  1. 点击左侧 **「手动编写用例」** 返回 Step 4 编辑
  2. 点击右侧 **「知识库」** 选择已保存的测试用例文档`;

    addMessage('ai', `**Midscene VLM UI 自动化引擎**

${casesGuide}

**服务状态:** ${sidecarStatus}`);

    midsceneViewType.value = 'cases';
    viewMode.value = 'preview';
    rightPanelTab.value = 'midscene';
};

// Helper: get current tab URL
const getCurrentTabUrl = async (): Promise<string> => {
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        return tab?.url || '';
    } catch {
        return '';
    }
};

// Toggle case selection
const toggleCaseSelection = (id: string) => {
    const s = new Set(midsceneSelectedCases.value);
    if (s.has(id)) s.delete(id); else s.add(id);
    midsceneSelectedCases.value = s;
};
const selectAllCases = () => {
    midsceneSelectedCases.value = new Set(midsceneParsedCases.value.map(c => c.id));
};
const deselectAllCases = () => {
    midsceneSelectedCases.value = new Set();
};

// 停止 Midscene 批量执行：取消当前请求 + 阻止后续用例
const stopMidsceneExecution = () => {
    midsceneExecuting.value = false;
    // 中止当前正在进行的 HTTP 请求
    if (midsceneAbortController.value) {
        midsceneAbortController.value.abort();
        midsceneAbortController.value = null;
    }
};

// ★ 缓存管理方法
/** 加载缓存列表 */
const loadMidsceneCacheList = async () => {
    midsceneCacheLoading.value = true;
    try {
        const data = await getMidsceneCacheList();
        midsceneCacheList.value = data.caches;
        midsceneCacheTotalSize.value = data.totalSize;
    } catch (e: any) {
        console.error('[cache] 加载缓存列表失败:', e);
    } finally {
        midsceneCacheLoading.value = false;
    }
};

/** 删除单个缓存 */
const handleDeleteCache = async (cacheId: string) => {
    const result = await deleteMidsceneCache(cacheId);
    if (result.success) {
        addMessage('ai', `已删除缓存: ${cacheId}`);
        await loadMidsceneCacheList();
    }
};

/** 清空全部缓存 */
const handleClearAllCache = async () => {
    const result = await clearAllMidsceneCache();
    if (result.success) {
        addMessage('ai', `已清空全部缓存 (${result.deleted} 个文件)`);
        midsceneCacheList.value = [];
        midsceneCacheTotalSize.value = 0;
    }
};

/** 切换设置面板 */
const toggleSettingsPanel = () => {
    midsceneSettingsVisible.value = !midsceneSettingsVisible.value;
};
/** 切换缓存管理面板可见性 */
const toggleCachePanel = async () => {
    midsceneCachePanelVisible.value = !midsceneCachePanelVisible.value;
    if (midsceneCachePanelVisible.value) {
        await loadMidsceneCacheList();
    }
};

/** 格式化文件大小 */
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// ===================== 回归基线管理 =====================

// 切换到回归模式时自动加载基线映射
watch(midsceneExecutionMode, (newMode) => {
    if (newMode === 'regression') {
        loadRegressionBaselines();
    }
});

/** 切换回归基线管理面板 */
const toggleRegressionPanel = async () => {
    regressionPanelVisible.value = !regressionPanelVisible.value;
    if (regressionPanelVisible.value) {
        await loadRegressionBaselines();
    }
};

/** 加载回归基线列表（同时更新 caseId → baseline 映射） */
const loadRegressionBaselines = async () => {
    regressionLoading.value = true;
    try {
        const data = await listRegressionBaselines();
        regressionBaselines.value = data.baselines;
        // 更新映射
        const map = new Map<string, any>();
        for (const bl of data.baselines) {
            map.set(bl.caseId, bl);
        }
        regressionBaselineMap.value = map;
    } catch (e: any) {
        console.error('[regression] 加载基线列表失败:', e);
    } finally {
        regressionLoading.value = false;
    }
};

/** 删除回归基线 */
const handleDeleteBaseline = async (id: string) => {
    await deleteRegressionBaseline(id);
    await loadRegressionBaselines();
    addMessage('ai', '回归基线已删除');
};

/** 加载回归基线到步骤编辑器 */
const handleEditBaseline = async (id: string) => {
    const detail = await getRegressionBaseline(id);
    if (detail) {
        stepEditorSteps.value = detail.parsed.steps.map((s: any) => ({ ...s }));
        stepEditorAssertions.value = detail.parsed.assertions;
        stepEditorUrl.value = detail.parsed.url;
        stepEditorCaseId.value = detail.baseline.caseId;
        stepEditorCaseName.value = detail.baseline.caseName;
        stepEditorVisible.value = true;
        regressionPanelVisible.value = false;
    }
};

/** 执行回归基线 */
const handleRunBaseline = async (baseline: RegressionBaseline) => {
    addMessage('ai', `开始回归执行: ${baseline.caseName}...`);
    try {
        const result = await midsceneRunYaml({
            regressionId: baseline.id,
            options: {
                useCDP: !isHeadlessMode.value,
                headless: isHeadlessMode.value,
                cacheStrategy: 'read-only',
            },
        });
        addMessage('ai', `回归执行${result.status === 'passed' ? '通过 ✓' : '失败 ✗'} (${result.durationMs}ms)`);
        await loadRegressionBaselines();
    } catch (e: any) {
        addMessage('ai', `回归执行失败: ${e.message}`);
    }
};

// ===================== 步骤编辑器函数 =====================

/** 修改步骤操作类型 */
const changeStepType = (index: number, newType: string) => {
    if (stepEditorSteps.value[index]) {
        stepEditorSteps.value[index].type = newType;
    }
};

/** 删除步骤 */
const removeStep = (index: number) => {
    stepEditorSteps.value.splice(index, 1);
};

/** 上移步骤 */
const moveStepUp = (index: number) => {
    if (index > 0) {
        const temp = stepEditorSteps.value[index];
        stepEditorSteps.value[index] = stepEditorSteps.value[index - 1];
        stepEditorSteps.value[index - 1] = temp;
    }
};

/** 下移步骤 */
const moveStepDown = (index: number) => {
    if (index < stepEditorSteps.value.length - 1) {
        const temp = stepEditorSteps.value[index];
        stepEditorSteps.value[index] = stepEditorSteps.value[index + 1];
        stepEditorSteps.value[index + 1] = temp;
    }
};

/** 添加新步骤 */
const addNewStep = () => {
    stepEditorSteps.value.push({
        type: 'tap',
        target: '',
        value: '',
        original: '',
        confidence: 1,
    });
};

/** 保存步骤编辑器中的步骤为回归基线 */
const saveStepsAsBaseline = async () => {
    if (!stepEditorCaseId.value || !stepEditorCaseName.value) {
        addMessage('ai', '请先填写用例 ID 和名称');
        return;
    }
    try {
        await saveRegressionBaseline({
            steps: stepEditorSteps.value,
            assertions: stepEditorAssertions.value,
            caseId: stepEditorCaseId.value,
            caseName: stepEditorCaseName.value,
            url: stepEditorUrl.value,
        });
        addMessage('ai', `回归基线已保存: ${stepEditorCaseName.value}`);
        stepEditorVisible.value = false;
    } catch (e: any) {
        addMessage('ai', `保存基线失败: ${e.message}`);
    }
};

/** 从步骤编辑器中的某一步开始执行 */
const runFromStep = async (startIndex: number) => {
    const currentUrl = stepEditorUrl.value;
    if (!currentUrl) {
        addMessage('ai', '缺少执行 URL');
        return;
    }
    addMessage('ai', `从步骤 ${startIndex + 1} 开始执行...`);
    instantStepResults.value = [];

    try {
        await midsceneRunInstantStream(
            {
                url: currentUrl,
                steps: stepEditorSteps.value,
                assertions: stepEditorAssertions.value,
                caseId: stepEditorCaseId.value,
                caseName: stepEditorCaseName.value,
                options: {
                    useCDP: !isHeadlessMode.value,
                    headless: isHeadlessMode.value,
                    cache: midsceneCacheStrategy.value !== 'false'
                        ? { strategy: midsceneCacheStrategy.value, id: stepEditorCaseId.value }
                        : undefined,
                    startFromStep: startIndex,
                },
            },
            (event, data) => {
                if (event === 'step_done') {
                    instantStepResults.value.push(data);
                } else if (event === 'done') {
                    addMessage('ai', `执行完成: ${data.status} (${data.passedSteps}/${data.totalSteps} 步通过, ${data.durationMs}ms)`);
                    // 如果成功且有 regressionYaml，自动更新基线
                    if (data.status === 'passed' && data.regressionYaml) {
                        addMessage('ai', '执行成功，可保存为回归基线');
                    }
                } else if (event === 'error') {
                    addMessage('ai', `执行出错: ${data.message}`);
                }
            },
        );
    } catch (e: any) {
        addMessage('ai', `执行失败: ${e.message}`);
    }
};

// Get result for a specific case
const getCaseResult = (id: string) => midsceneResults.value.find(r => r.testcaseId === id);
const getCaseResultClass = (id: string) => {
    const r = getCaseResult(id);
    if (!r) return '';
    return r.status;
};

// Update a case result
const updateCaseResult = (id: string, data: Partial<typeof midsceneResults.value[0]>) => {
    const idx = midsceneResults.value.findIndex(r => r.testcaseId === id);
    if (idx >= 0) {
        midsceneResults.value[idx] = { ...midsceneResults.value[idx], ...data };
    } else {
        const tc = midsceneParsedCases.value.find(c => c.id === id);
        midsceneResults.value.push({
            testcaseId: id,
            testcaseName: tc?.name || id,
            status: 'pending',
            ...data,
        } as any);
    }
};

// Computed: results summary
const midscenePassedCount = computed(() => midsceneResults.value.filter(r => r.status === 'passed').length);
const midsceneFailedCount = computed(() => midsceneResults.value.filter(r => r.status === 'failed').length);
const midsceneTotalDuration = computed(() => {
    const total = midsceneResults.value.reduce((sum, r) => sum + (r.durationMs || 0), 0);
    return total > 0 ? (total / 1000).toFixed(1) : '';
});

/**
 * 创建统一的混合模式 SSE 事件处理函数
 * 消除混合模式执行、回归降级执行之间的事件处理代码重复
 */
const createMixedModeEventHandler = (
    tc: MidsceneTestCase,
    opts: {
        timelinePrefix?: string;
        parentCardId?: string;
        autoSaveBaseline?: boolean;
    } = {},
) => {
    const prefix = opts.timelinePrefix || 'mixed';
    const parentId = opts.parentCardId || `${tc.id}-${prefix}`;
    const autoSave = opts.autoSaveBaseline !== false;

    return (event: string, data: any) => {
        if (event === 'step_start') {
            // 使用后端推断的真实类型，并映射友好标签
            const realType = data.type || 'aiAct';
            const typeInfo = stepTypeMap[realType] || stepTypeMap['aiAct'];
            midsceneTimeline.value.push({
                id: `${tc.id}-step-${data.stepIndex}`,
                type: realType as TimelineCard['type'],
                description: `[${typeInfo.label}] ${data.original || data.description}`,
                status: 'running',
            });
        } else if (event === 'step_progress') {
            // 长时间 aiAct 操作的中间进度更新
            const card = midsceneTimeline.value.find(t => t.id === `${tc.id}-step-${data.stepIndex}`);
            if (card) {
                card.description = `[AI执行中] ${data.message || card.description}`;
            }
        } else if (event === 'step_done') {
            instantStepResults.value.push(data);
            const card = midsceneTimeline.value.find(t => t.id === `${tc.id}-step-${data.stepIndex}`);
            if (card) {
                card.status = data.success ? 'success' : 'failed';
                card.durationMs = data.durationMs;
                if (data.error) card.error = data.error;
            }
        } else if (event === 'step_fallback') {
            addMessage('ai', `步骤 ${data.stepIndex + 1}: ${data.message}`);
        } else if (event === 'assert_done') {
            midsceneTimeline.value.push({
                id: `${tc.id}-assert-${data.assertIndex}`,
                type: 'aiAssert',
                description: data.expected,
                status: data.success ? 'success' : 'failed',
                error: data.reason,
            });
        } else if (event === 'done') {
            const parentCard = midsceneTimeline.value.find(t => t.id === parentId);
            if (parentCard) {
                parentCard.status = data.status === 'passed' ? 'success' : 'failed';
                parentCard.durationMs = data.durationMs;
            }
            updateCaseResult(tc.id, {
                status: data.status === 'passed' ? 'passed' : 'failed',
                durationMs: data.durationMs,
            });
            if (data.status === 'passed') {
                const stepInfo = `${data.passedSteps || '?'}/${data.totalSteps || '?'} 步`;
                if (autoSave && data.regressionYaml) {
                    getCurrentTabUrl().then(url => {
                        saveRegressionBaseline({
                            caseId: tc.id,
                            caseName: tc.name,
                            url: url || '',
                            yamlContent: data.regressionYaml,
                        }).then(() => {
                            addMessage('ai', `✓ 执行通过 (${stepInfo})，已自动保存回归基线`);
                            loadRegressionBaselines();
                        }).catch((saveErr: any) => {
                            addMessage('ai', `✓ 执行通过 (${stepInfo})，保存基线失败: ${saveErr.message}`);
                        });
                    });
                } else if (!autoSave) {
                    addMessage('ai', `✓ 回归执行通过 (${stepInfo})`);
                } else {
                    addMessage('ai', `✓ 执行通过 (${stepInfo})，未生成回归基线`);
                }
            }
        } else if (event === 'error') {
            updateCaseResult(tc.id, { status: 'error' });
            addMessage('ai', `执行出错: ${data.message}`);
        }
    };
};

// Execute single case（signal 参数用于外部取消请求）
const runSingleCase = async (tc: MidsceneTestCase, signal?: AbortSignal) => {
    const currentUrl = await getCurrentTabUrl();
    if (!currentUrl) {
        addMessage('ai', '请先打开一个页面');
        return;
    }

    midsceneCurrentCase.value = tc.name;
    midsceneSelectedCaseId.value = tc.id;
    updateCaseResult(tc.id, { status: 'running' });

    // Clear timeline for this case
    midsceneTimeline.value = [];
    instantStepResults.value = [];

    const mode = midsceneExecutionMode.value;

    // ★ 混合模式：逐步即时操作执行
    if (mode === 'mixed' && tc.steps && tc.steps.length > 0) {
        // 智能路由：检查步骤是否包含具体操作动词
        // 如果全是场景描述（如"通过文本输入框提交数学问题"），自动路由到自由模式引擎（更快）
        const actionPattern = /点击|click|tap|输入|input|type|fill|选择|select|滚动|scroll|悬停|hover|双击|右键|按键|press|拖拽|drag|上传|upload|等待|wait|切换|switch|打开|open|关闭|close|勾选|check|取消勾选|uncheck/i;
        const hasActionableSteps = tc.steps.some((s: string) => actionPattern.test(s));

        if (!hasActionableSteps) {
            // 步骤全是场景描述，跳过混合模式，落入下方自由模式执行路径
            console.log(`[smart-route] 步骤无具体操作动词，智能路由到自由模式引擎: ${tc.name}`);
            addMessage('ai', `⚡ 智能路由: 步骤为场景描述，自动使用自由模式引擎执行（更快）`);
        } else {
            // 有具体操作步骤 → 正常走混合模式
            midsceneTimeline.value.push({
                id: `${tc.id}-mixed`,
                type: 'aiAct',
                description: `[混合模式] ${tc.scenario}`,
                status: 'running',
            });
            try {
                await midsceneRunInstantStream(
                    {
                        url: currentUrl,
                        rawSteps: tc.steps,
                        assertions: tc.expectedResults,
                        caseId: tc.id,
                        caseName: tc.name,
                        options: {
                            useCDP: !isHeadlessMode.value,
                            headless: isHeadlessMode.value,
                            cache: midsceneCacheStrategy.value !== 'false'
                                ? { strategy: midsceneCacheStrategy.value, id: tc.id }
                                : undefined,
                        },
                    },
                    createMixedModeEventHandler(tc, {
                        timelinePrefix: 'mixed',
                        parentCardId: `${tc.id}-mixed`,
                        autoSaveBaseline: true,
                    }),
                    signal,
                );
            } catch (e: any) {
                if (e.name !== 'AbortError') {
                    updateCaseResult(tc.id, { status: 'error' });
                }
            }
            refreshMidsceneReport();
            return;
        }
    }

    // ★ 回归模式：从基线执行，无基线时自动降级为混合模式
    if (mode === 'regression') {
        // 先查找是否有匹配的回归基线
        let baseline: any = null;
        try {
            const baselines = await listRegressionBaselines();
            baseline = baselines.baselines.find(b => b.caseId === tc.id);
        } catch (e: any) {
            console.warn(`[regression] 查询基线失败: ${e.message}`);
        }

        if (baseline) {
            // 有基线 → 解析 YAML 步骤后用 run-instant/stream 执行（步骤级进度）
            let baselineDetail: any = null;
            try {
                baselineDetail = await getRegressionBaseline(baseline.id);
            } catch (e: any) {
                console.warn(`[regression] 获取基线详情失败: ${e?.message}`);
            }

            // 判断基线步骤质量：全是 aiAct+confidence=0 说明是粗粒度场景描述，不适合走 run-instant
            const parsedSteps = baselineDetail?.parsed?.steps || [];
            const hasQualitySteps = parsedSteps.length > 0 &&
                !parsedSteps.every((s: any) => s.type === 'aiAct' && (s.confidence === 0 || s.confidence === undefined));

            if (hasQualitySteps) {
                // 有高质量步骤 → 使用混合模式 SSE 执行
                midsceneTimeline.value.push({
                    id: `${tc.id}-reg`,
                    type: 'aiAct',
                    description: `[回归模式] ${tc.name}`,
                    status: 'running',
                });
                try {
                    await midsceneRunInstantStream(
                        {
                            url: baselineDetail.parsed.url || currentUrl,
                            steps: baselineDetail.parsed.steps,
                            assertions: baselineDetail.parsed.assertions,
                            caseId: tc.id,
                            caseName: tc.name,
                            options: {
                                useCDP: !isHeadlessMode.value,
                                headless: isHeadlessMode.value,
                                cache: { strategy: 'read-only', id: tc.id },
                            },
                        },
                        createMixedModeEventHandler(tc, {
                            timelinePrefix: 'reg',
                            parentCardId: `${tc.id}-reg`,
                            autoSaveBaseline: false,
                        }),
                        signal,
                    );
                    // 更新基线执行状态
                    try {
                        await fetch(`${(window as any).__MIDSCENE_SIDECAR_URL || 'http://localhost:3100'}/regression/${baseline.id}/update-run-status`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: caseResults.value[tc.id]?.status === 'passed' ? 'passed' : 'failed' }),
                        });
                    } catch {}
                } catch (e: any) {
                    if (e.name !== 'AbortError') {
                        updateCaseResult(tc.id, { status: 'error' });
                        addMessage('ai', `回归执行失败: ${e.message}`);
                    }
                }
                refreshMidsceneReport();
                return;
            }

            // 基线无法解析步骤时，降级为 runYaml
            midsceneTimeline.value.push({
                id: `${tc.id}-reg`,
                type: 'aiAct',
                description: `[回归模式] ${tc.name}`,
                status: 'running',
            });
            try {
                const result = await midsceneRunYaml({
                    regressionId: baseline.id,
                    options: {
                        useCDP: !isHeadlessMode.value,
                        headless: isHeadlessMode.value,
                        cacheStrategy: 'read-only',
                    },
                });
                const regCard = midsceneTimeline.value.find(t => t.id === `${tc.id}-reg`);
                if (regCard) {
                    regCard.status = result.status === 'passed' ? 'success' : 'failed';
                    regCard.durationMs = result.durationMs;
                }
                updateCaseResult(tc.id, {
                    status: result.status === 'passed' ? 'passed' : 'failed',
                    durationMs: result.durationMs,
                });
            } catch (e: any) {
                if (e.name !== 'AbortError') {
                    updateCaseResult(tc.id, { status: 'error' });
                    addMessage('ai', `回归执行失败: ${e.message}`);
                }
            }
            refreshMidsceneReport();
            return;
        }

        // 无基线 → 自动降级为混合模式执行，成功后自动保存基线
        addMessage('ai', `用例 ${tc.id} 暂无回归基线，自动降级为混合模式执行。成功后将自动保存为基线。`);
        if (tc.steps && tc.steps.length > 0) {
            midsceneTimeline.value.push({
                id: `${tc.id}-mixed-fallback`,
                type: 'aiAct',
                description: `[回归降级→混合模式] ${tc.scenario}`,
                status: 'running',
            });
            try {
                await midsceneRunInstantStream(
                    {
                        url: currentUrl,
                        rawSteps: tc.steps,
                        assertions: tc.expectedResults,
                        caseId: tc.id,
                        caseName: tc.name,
                        options: {
                            useCDP: !isHeadlessMode.value,
                            headless: isHeadlessMode.value,
                            cache: midsceneCacheStrategy.value !== 'false'
                                ? { strategy: midsceneCacheStrategy.value, id: tc.id }
                                : undefined,
                        },
                    },
                    createMixedModeEventHandler(tc, {
                        timelinePrefix: 'mixed-fallback',
                        parentCardId: `${tc.id}-mixed-fallback`,
                        autoSaveBaseline: true,
                    }),
                    signal,
                );
            } catch (e: any) {
                if (e.name !== 'AbortError') {
                    updateCaseResult(tc.id, { status: 'error' });
                }
            }
            refreshMidsceneReport();
            return;
        }

        // 无基线且无步骤 → 降级为自由模式
        addMessage('ai', `用例 ${tc.id} 无回归基线且无步骤定义，降级为自由模式执行`);
        // 不 return，继续向下走自由模式逻辑
    }

    // ★ 自由模式（默认）：整段 scenario 丢给 aiAct，传 steps 供自动降级

    // Add timeline card for this case
    midsceneTimeline.value.push({
        id: `${tc.id}-act`,
        type: 'aiAct',
        description: tc.scenario,
        status: 'running',
    });

    try {
        const result = await midsceneAgent({
            sessionId: midsceneSessionId.value,
            url: currentUrl,
            testCases: [{
                ...tc,
                // ★ 传入独立步骤列表，供自由模式失败后自动降级
                steps: tc.steps,
            }],
            headless: isHeadlessMode.value,
            useCDP: !isHeadlessMode.value,
            cacheStrategy: midsceneCacheStrategy.value,
            signal,
        });

        // Update timeline card
        const actCard = midsceneTimeline.value.find(t => t.id === `${tc.id}-act`);

        if (result.status === 'success' && result.midsceneResult) {
            const mr = result.midsceneResult;

            // Update act card
            if (actCard) {
                actCard.status = mr.results?.steps?.[0]?.success !== false ? 'success' : 'failed';
                actCard.durationMs = mr.durationMs;
            }

            // Add assertion cards
            if (mr.results?.assertions) {
                for (const a of mr.results.assertions) {
                    midsceneTimeline.value.push({
                        id: `${tc.id}-assert-${midsceneTimeline.value.length}`,
                        type: 'aiAssert',
                        description: a.expected,
                        status: a.success ? 'success' : 'failed',
                        error: a.reason,
                    });
                }
            }

            // 从报告路径提取文件名，构建报告 URL
            let caseReportUrl: string | undefined;
            const reportFilePath = mr.report?.filePath || result.report?.filePath;
            if (reportFilePath) {
                const fileName = reportFilePath.split('/').pop() || reportFilePath.split('\\').pop();
                if (fileName) {
                    caseReportUrl = `http://localhost:3100/report/${fileName}`;
                }
            }

            updateCaseResult(tc.id, {
                status: mr.status === 'passed' ? 'passed' : 'failed',
                durationMs: mr.durationMs,
                assertions: mr.results?.assertions,
                reportUrl: caseReportUrl,
            });

            // 自由模式成功后，尝试保存回归基线
            if (mr.status === 'passed') {
                if (mr.regressionYaml) {
                    try {
                        await saveRegressionBaseline({
                            yamlContent: mr.regressionYaml,
                            caseId: tc.id,
                            caseName: tc.name,
                            url: currentUrl,
                        } as any);
                        addMessage('ai', `✓ 执行通过，已自动保存回归基线 (可在设置→基线管理中查看)`);
                        loadRegressionBaselines();
                    } catch (saveErr: any) {
                        console.warn('[free-mode] 保存基线失败:', saveErr.message);
                        addMessage('ai', `✓ 执行通过。保存基线失败: ${saveErr.message}`);
                    }
                } else if (!tc.steps || tc.steps.length === 0) {
                    addMessage('ai', `✓ 执行通过。该用例无细化步骤，未生成回归基线。如需回归能力，请在用例中添加具体步骤。`);
                } else {
                    addMessage('ai', `✓ 执行通过。步骤粒度不足，未生成回归基线。请提供更详细的步骤（如"点击X"、"输入Y"）。`);
                }
            }
        } else {
            if (actCard) actCard.status = 'failed';
            updateCaseResult(tc.id, { status: 'error' });
        }
    } catch (e: any) {
        // 用户主动停止时 fetch 会抛出 AbortError，标记为已停止而非错误
        const isAborted = e.name === 'AbortError';
        console.error('runSingleCase error:', isAborted ? '(用户停止)' : e);
        updateCaseResult(tc.id, { status: isAborted ? 'pending' : 'error' });
        const actCard = midsceneTimeline.value.find(t => t.id === `${tc.id}-act`);
        if (actCard) {
            actCard.status = 'failed';
            actCard.error = isAborted ? '已停止' : e.message;
        }
    }

    refreshMidsceneReport();
};

// Single case execution (from play button)
const runOneCaseOnly = async (tc: MidsceneTestCase) => {
    midsceneTimeline.value = [];
    midsceneResults.value = [];
    midsceneReportUrl.value = '';
    midsceneReportUrls.value = [];
    midsceneExecuting.value = true;

    // 创建 AbortController，支持单条执行也能被停止
    const controller = new AbortController();
    midsceneAbortController.value = controller;

    await runSingleCase(tc, controller.signal);

    midsceneAbortController.value = null;
    midsceneExecuting.value = false;

    // 获取 HTML 报告链接
    try {
        const reports = await listMidsceneReports();
        if (reports.length > 0) {
            midsceneReportUrl.value = `http://localhost:3100/report/${reports[0].name}`;
        }
    } catch {
        console.warn('[runOneCaseOnly] 获取报告列表失败');
    }

    // 添加完成消息
    const result = midsceneResults.value.find(r => r.testcaseId === tc.id);
    const statusText = result?.status === 'passed' ? '通过' : result?.status === 'failed' ? '失败' : '出错';
    const durationInfo = result?.durationMs ? ` | 耗时 ${(result.durationMs / 1000).toFixed(1)}s` : '';
    addMessage('ai', `**执行完成** | ${tc.name}: ${statusText}${durationInfo}${midsceneReportUrl.value ? ' | 可查看 HTML 可视化报告' : ''}`);

    // 切换到结果视图
    midsceneViewType.value = 'results';
    rightPanelTab.value = 'midscene';
};

// Batch execute selected cases
const runSelectedCases = async () => {
    const selectedCases = midsceneParsedCases.value
        .filter(tc => midsceneSelectedCases.value.has(tc.id));

    if (selectedCases.length === 0) return;

    // Reset results and session for new batch run
    midsceneResults.value = [];
    midsceneTimeline.value = [];
    midsceneReportUrl.value = '';
    midsceneReportUrls.value = [];
    midsceneSessionId.value = `midscene-session-${Date.now()}`;
    midsceneExecuting.value = true;  // ★ Must set BEFORE loop

    addMessage('ai', `**开始执行 ${selectedCases.length} 条测试用例...**`);

    for (const tc of selectedCases) {
        if (!midsceneExecuting.value) break;  // 停止按钮已按下，不再执行后续用例

        // 每个用例创建独立的 AbortController，停止时可立即取消当前请求
        const controller = new AbortController();
        midsceneAbortController.value = controller;

        await runSingleCase(tc, controller.signal);

        midsceneAbortController.value = null;

        // runSingleCase 完成后再次检查，处理在执行期间按下停止的情况
        if (!midsceneExecuting.value) break;
    }

    midsceneExecuting.value = false;
    midsceneAbortController.value = null;

    // 收集本次批量执行中每条用例的报告 URL
    midsceneReportUrls.value = midsceneResults.value
        .filter(r => r.reportUrl)
        .map(r => ({ testcaseId: r.testcaseId, testcaseName: r.testcaseName, url: r.reportUrl! }));

    // 取最新一条作为默认报告 URL（兼容旧逻辑）
    if (midsceneReportUrls.value.length > 0) {
        midsceneReportUrl.value = midsceneReportUrls.value[midsceneReportUrls.value.length - 1].url;
    } else {
        // 降级：从 sidecar 报告列表中获取
        try {
            const reports = await listMidsceneReports();
            if (reports.length > 0) {
                midsceneReportUrl.value = `http://localhost:3100/report/${reports[0].name}`;
            }
        } catch {}
    }

    const passed = midscenePassedCount.value;
    const total = midsceneResults.value.length;
    const reportCount = midsceneReportUrls.value.length;
    const stopped = !midsceneResults.value.every(r => r.status !== 'pending');
    addMessage('ai', `**执行${stopped ? '已停止' : '完成'}** | ${passed}/${total} 通过${reportCount > 0 ? ` | ${reportCount} 份 HTML 可视化报告` : ''}`);
    midsceneViewType.value = 'results';
    rightPanelTab.value = 'midscene';
};

// Build Markdown report from results
const refreshMidsceneReport = () => {
    if (midsceneResults.value.length === 0) return;

    let md = `## Midscene 测试报告\n\n`;
    md += `**通过:** ${midscenePassedCount.value} | **失败:** ${midsceneFailedCount.value} | **总计:** ${midsceneResults.value.length}`;
    if (midsceneTotalDuration.value) md += ` | **耗时:** ${midsceneTotalDuration.value}s`;
    md += `\n\n`;

    md += `| # | 用例 | 状态 | 耗时 | 断言 |\n`;
    md += `|---|------|------|------|------|\n`;
    for (const r of midsceneResults.value) {
        const statusIcon = r.status === 'passed' ? 'PASS' : r.status === 'failed' ? 'FAIL' : r.status === 'running' ? '...' : r.status;
        const dur = r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '-';
        const assertInfo = r.assertions ? `${r.assertions.filter(a => a.success).length}/${r.assertions.length}` : '-';
        md += `| ${r.testcaseId} | ${r.testcaseName} | ${statusIcon} | ${dur} | ${assertInfo} |\n`;
    }

    // Detailed assertion results for failed cases
    const failedResults = midsceneResults.value.filter(r => r.status === 'failed' && r.assertions?.length);
    if (failedResults.length > 0) {
        md += `\n### 失败详情\n\n`;
        for (const r of failedResults) {
            md += `**${r.testcaseName}:**\n`;
            for (const a of (r.assertions || [])) {
                md += `- ${a.success ? 'PASS' : 'FAIL'} ${a.expected}${a.reason ? ` (${a.reason})` : ''}\n`;
            }
            md += '\n';
        }
    }

    projectState.documents.midsceneReport = md;
};

// ★ Smart Command — 智能路由，任意 Step 可用
const sendMidsceneSmartCommand = async (userInput: string) => {
    if (!userInput || isProcessing.value) return;

    addMessage('user', userInput);
    isProcessing.value = true;
    statusText.value = 'AI 分析意图中...';

    // 1. Get current tab info + screenshot
    const currentUrl = await getCurrentTabUrl();
    let screenshot: string | undefined;
    try {
        screenshot = await browser.tabs.captureVisibleTab(undefined, { format: 'png' });
    } catch {}

    try {
        // 2. Call smart router
        const result = await midsceneAgentSmart({
            sessionId: midsceneSessionId.value,
            instruction: userInput,
            url: currentUrl,
            screenshot,
            outputFormat: testCaseOutputFormat.value,
        });

        // 3. Route based on intent
        if (result.type === 'cases_generated' && result.cases) {
            // Store formatted text for Step 4 display
            projectState.documents.testCases = result.formattedCases || JSON.stringify(result.cases, null, 2);
            // ★ Also directly store parsed cases for Midscene Step 5 (bypass parser)
            midsceneParsedCases.value = result.cases.map((c: any, i: number) => ({
                id: c.id || `TC-${String(i + 1).padStart(3, '0')}`,
                name: c.name || '',
                scenario: c.scenario || '',
                expectedResults: c.expectedResults || [],
                preconditions: c.preconditions || '',
                priority: c.priority || '',
            }));
            midsceneSelectedCases.value = new Set(midsceneParsedCases.value.map(c => c.id));
            projectState.documents.midsceneCasesJson = JSON.stringify(midsceneParsedCases.value, null, 2);

            projectState.currentStep = 'test_case';
            viewMode.value = 'preview';
            // 智能命名：基于 URL 或用户输入
            autoNameTestCases({ url: currentUrl, instruction: userInput });
            addMessage('ai', `已生成 ${result.cases.length} 条测试用例，已跳转到「用例」步骤`);
        } else if (result.type === 'execute') {
            // Jump to Step 5
            projectState.currentStep = 'auto_test';
            await initMidsceneView();
            addMessage('ai', result.response || '已切换到自动化测试步骤');
        } else if (result.type === 'analysis') {
            addMessage('ai', result.response);
        } else if (result.type === 'free_action') {
            // Execute via aiAct (CDP)
            projectState.currentStep = 'auto_test';
            statusText.value = 'Midscene 执行操作中...';
            const execResult = await midsceneAgent({
                sessionId: midsceneSessionId.value,
                instruction: result.response || userInput,
                url: currentUrl,
                headless: false,
                useCDP: true,
            });
            if (execResult.status === 'success') {
                addMessage('ai', `**操作完成**: ${execResult.response}`);
            } else {
                addMessage('ai', `**操作失败**: ${execResult.response}`);
            }
        } else if (result.type === 'passthrough') {
            // Fall through to original agent
            const frozenSelected = [...selectedRefDocs.value];
            const frozenAdditionalPrds = buildAdditionalPrdsForRequest({
                selected: frozenSelected,
                pickedOnce: pendingAdditionalPrds.value,
            });
            await sendQaAskMessage({ selected: frozenSelected, additionalPrds: frozenAdditionalPrds });
        } else {
            addMessage('ai', result.response || 'Unknown response');
        }
    } catch (e: any) {
        addMessage('ai', `**Smart router 连接失败:** ${e.message}`);
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

// Freeform mode handler (legacy, kept for direct Midscene execution)
const sendMidsceneFreeform = async (userInput: string) => {
    if (!userInput || isProcessing.value) return;
    const currentUrl = await getCurrentTabUrl();

    addMessage('user', userInput);
    isProcessing.value = true;
    statusText.value = 'Midscene VLM 执行中...';

    try {
        const result = await midsceneAgent({
            sessionId: midsceneSessionId.value,
            instruction: userInput,
            url: currentUrl,
            headless: isHeadlessMode.value,
        });

        if (result.status === 'success') {
            if (result.type === 'report_generated') {
                const mr = result.midsceneResult;
                const assertions = mr?.results?.assertions || [];
                const passed = assertions.filter((a: any) => a.success).length;
                const total = assertions.length;
                addMessage('ai', `**Midscene 执行完成** | ${mr?.status} | ${passed}/${total} 断言通过\n\n${result.response}`);
            } else {
                addMessage('ai', result.response);
            }
        } else {
            addMessage('ai', `**Midscene 执行失败**\n\n${result.response}`);
        }
    } catch (e: any) {
        addMessage('ai', `**Midscene 连接失败:** ${e.message}`);
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

// Open HTML report in new tab
const openMidsceneHtmlReport = async () => {
    if (midsceneReportUrl.value) {
        await browser.tabs.create({ url: midsceneReportUrl.value });
    } else {
        try {
            const reports = await listMidsceneReports();
            if (reports.length > 0) {
                const url = `http://localhost:3100/report/${reports[0].name}`;
                midsceneReportUrl.value = url;
                await browser.tabs.create({ url });
            } else {
                addMessage('ai', '暂无 Midscene HTML 报告。请先执行测试用例。');
            }
        } catch {
            addMessage('ai', 'Midscene Sidecar 未运行，无法获取报告。');
        }
    }
};

// 打开指定 URL 的报告
const openReportByUrl = async (url: string) => {
    try {
        await browser.tabs.create({ url });
    } catch (e: any) {
        console.error('打开报告失败:', e);
    }
};

// 打开所有报告（批量执行时用）
const openAllReports = async () => {
    for (const rpt of midsceneReportUrls.value) {
        try {
            await browser.tabs.create({ url: rpt.url });
        } catch {}
    }
};

// Export Midscene results
const exportMidsceneResults = () => {
    if (!projectState.documents.midsceneReport) return;
    const blob = new Blob([projectState.documents.midsceneReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Midscene测试报告_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
};

// 将 Markdown 表格转换为 CSV
const markdownTableToCsv = (markdown: string): string => {
  const lines = markdown.split('\n');
  const csvRows: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过空行和分隔行（如 |---|---|）
    if (!trimmed || /^\|[-:\s|]+\|$/.test(trimmed)) continue;
    // 检测是否是表格行
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // 解析表格单元格
      const cells = trimmed
        .slice(1, -1) // 去掉首尾的 |
        .split('|')
        .map(cell => {
          // 处理 CSV 特殊字符：包含逗号、引号、换行的需要用引号包裹
          const cleaned = cell.trim().replace(/"/g, '""');
          return cleaned.includes(',') || cleaned.includes('"') || cleaned.includes('\n')
            ? `"${cleaned}"`
            : cleaned;
        });
      csvRows.push(cells.join(','));
    }
  }

  // 添加 BOM 以支持 Excel 中文显示
  return '\uFEFF' + csvRows.join('\n');
};

// ================= 质量评估 =================
const runQualityEvaluation = async () => {
  const testcasesText = projectState.documents.testCases;
  if (!testcasesText) {
    addMessage('ai', '⚠️ 暂无测试用例，请先生成测试用例后再进行质量评估');
    return;
  }

  qualityLoading.value = true;
  qualityError.value = '';
  qualityReport.value = null;
  rightPanelTab.value = 'quality';

  try {
    // 收集 PRD 文本：优先内存 → 再尝试从 DocStore 获取
    let prdText = projectState.documents.optimizedPrd || projectState.documents.prd || '';

    if (!prdText) {
      // 内存中没有 PRD，尝试从 DocStore 获取上传的主文档内容
      // 查找顺序：优化PRD → 上传的PDF/图片 → URL提取的主文档
      const prdDocRef = generatedDocRefs.optimizedPrd
        || generatedDocRefs.uploadedPrd
        || urlDocs.value.find(d => d.isMainPrd && (d as any).docRef)
        || null;

      const docId = prdDocRef
        ? ((prdDocRef as any).docId || (prdDocRef as any).docRef?.docId)
        : null;

      if (docId) {
        try {
          const docRes = await getDocContent(docId);
          if (docRes.status === 'success' && docRes.content) {
            prdText = docRes.content;
          }
        } catch (e) {
          console.warn('[runQualityEvaluation] 从 DocStore 获取 PRD 失败:', e);
        }
      }
    }

    if (!prdText) {
      prdText = '（无 PRD 文档，仅评估用例自身质量）';
    }

    const report = await evaluateTestCases(prdText, testcasesText);
    qualityReport.value = report;
    addMessage('ai', `✅ 质量评估完成，综合评分：${report.score} 分。请在右侧「质量评估」面板查看详细报告。`);
  } catch (e: any) {
    qualityError.value = e?.message || '评估失败';
    addMessage('ai', `❌ 质量评估失败：${e?.message || '未知错误'}`);
  } finally {
    qualityLoading.value = false;
  }
};

// 根据评估反馈补充用例
const handleSupplementFromEvaluation = async (report: EvaluationReport) => {
  const parts: string[] = [];
  parts.push('请根据以下质量评估反馈，在现有测试用例基础上补充完善（保留全部原有用例，仅在末尾新增缺失的测试用例）：\n');

  if (report.coverage_gap.length > 0) {
    parts.push(`【漏测点】（共 ${report.coverage_gap.length} 项）`);
    report.coverage_gap.forEach(g => parts.push(`- ${g}`));
    parts.push('');
  }
  if (report.logic_issues.length > 0) {
    parts.push(`【逻辑问题】（共 ${report.logic_issues.length} 项）`);
    report.logic_issues.forEach(i => {
      const sev: Record<string, string> = { high: '高', medium: '中', low: '低' };
      parts.push(`- [${sev[i.severity] || i.severity}] ${i.issue}`);
    });
    parts.push('');
  }
  if (report.suggestions.length > 0) {
    parts.push(`【改进建议】（共 ${report.suggestions.length} 项）`);
    report.suggestions.forEach(s => parts.push(`- ${s}`));
    parts.push('');
  }

  unifiedInput.value = parts.join('\n');
  projectState.currentStep = 'test_case';
  rightPanelTab.value = 'docs';

  await sendUnifiedMessage();
};

const exportResults = () => {
  const content = projectState.documents.testCases;
  const timestamp = new Date().toISOString().slice(0, 10);
  let blob: Blob;
  let filename: string;
  let message: string;

  switch (testCaseOutputFormat.value) {
    case 'table':
      // 表格格式导出为 CSV
      const csvContent = markdownTableToCsv(content);
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      filename = `测试用例_${timestamp}.csv`;
      message = '📥 CSV 文件已下载，可直接导入 Excel/飞书表格。';
      break;
    case 'yaml':
      // YAML 格式导出为 .yaml 文件
      // 提取 yaml 代码块内容（如果有的话）
      const yamlMatch = content.match(/```ya?ml\n([\s\S]*?)```/);
      const yamlContent = yamlMatch ? yamlMatch[1] : content;
      blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
      filename = `测试用例_${timestamp}.yaml`;
      message = '📥 YAML 文件已下载。';
      break;
    default:
      // XMind 格式导出为 Markdown
      blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      filename = `测试用例_${timestamp}.md`;
      message = '📥 Markdown 文件已下载，可导入 XMind。';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  addMessage('ai', message);
};

const openFeishu = () => {
  // 打开飞书文档（可根据实际需求修改 URL）
  window.open('https://www.feishu.cn/docs', '_blank');
};

const runAutoTest = async () => {
    // Deprecated
};

// ================= PRD 智能体 =================

// URL 检测正则
/**
 * URL 提取正则（只匹配 RFC3986 合法字符）
 *
 * 修复问题：
 * - “URL 后面紧跟中文/文字”会被旧正则当成 URL 一部分（因为旧规则是 [^\\s]）
 * - 新规则会在遇到中文、空格、引号、括号、中文标点等字符时自动截断
 */
const URL_REGEX = /(https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+)/;

// ========== 优化方案：复用"开始全页分析"链路 ==========
// 流程：打开新标签页 → 滚动截图 → DOM提取 → 图片上传入库 → 拼接内容 → 返回内容+CDN URL
// 这样可以保证图片也被处理，AI 能看到完整的页面信息
interface ExtractResult {
    content: string;      // 提取的文本内容（Markdown）
    cdnUrl: string;       // 上传后的截图 CDN URL（用于兼容旧逻辑：第一张）
    cdnUrls: string[];    // 上传后的截图 CDN URL 列表（多张）
    screenshot: string;   // 拼接后的截图 base64
}

const extractContentFromUrlWithFullAnalysis = async (url: string): Promise<ExtractResult> => {
    let tabId: number | null = null;
    let originalTabId: number | null = null;
    
    try {
        // 记录当前活动标签页，提取完成后切回
        try {
            const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
            originalTabId = activeTab?.id || null;
        } catch {}
        
        addMessage('ai', `🔗 正在新标签页打开: ${url}`);
        addMessage('ai', `💡 将自动执行：滚动页面 → 截图 → 提取内容 → 上传图片`);
        
        // 1. 创建新标签页（用户可见，确保 JS 正常执行）
        const tab = await browser.tabs.create({ 
            url, 
            active: true
        });
        tabId = tab.id || null;
        
        if (!tabId) {
            throw new Error('标签页创建失败');
        }
        
        console.log(`[extractFromUrl] 创建可见标签页: tabId=${tabId}`);
        
        // 2. 等待页面加载完成
        statusText.value = "等待页面加载...";
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('页面加载超时 (60s)')), 60000);
            const listener = (updatedTabId: number, changeInfo: any) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    browser.tabs.onUpdated.removeListener(listener);
                    clearTimeout(timeout);
                    resolve();
                }
            };
            browser.tabs.onUpdated.addListener(listener);
        });
        
        // 3. 等待 SPA 初始渲染
        addMessage('ai', `📄 页面已加载，等待动态内容渲染...`);
        await new Promise(r => setTimeout(r, 3000));
        
        // 4. ========== 复用 captureFullPageAndDOM 的核心逻辑 ==========
        statusText.value = "正在获取页面信息...";
        await browser.tabs.sendMessage(tabId, { type: 'PREPARE_PAGE_FOR_SCREENSHOT' });
        const pageInfo: any = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_SCROLL_INFO' });
        const { totalHeight, viewportHeight } = pageInfo;
        const scrollSteps = Math.ceil(totalHeight / viewportHeight);
        
        const screenshots: string[] = [];
        let domSegments: { markdown: string, images: { url: string, base64: string }[] }[] = [];
        
        // 确保从顶部开始
        await browser.tabs.sendMessage(tabId, { type: 'SCROLL_TO_POSITION', position: 0 });
        await new Promise(r => setTimeout(r, 300));
        
        addMessage('ai', `🔄 开始全页滚动分析 (共 ${scrollSteps} 屏)...`);
        
        try {
            let lastScrollY = -1;
            for (let i = 0; i < scrollSteps; i++) {
                statusText.value = `正在处理第 ${i + 1}/${scrollSteps} 屏...`;
                progress.value = ((i + 1) / scrollSteps) * 100;
                
                // 滚动到位置
                await browser.tabs.sendMessage(tabId, { 
                    type: 'SCROLL_TO_POSITION', 
                    position: i * viewportHeight 
                });
                
                // 等待渲染（稍微延长等待时间，确保页面内容加载）
                await new Promise(r => setTimeout(r, 700));

                // 重新获取滚动信息，判断是否已到底部，避免继续截图
                const curInfo: any = await browser.tabs.sendMessage(tabId, { type: 'GET_PAGE_SCROLL_INFO' });
                const curScrollY = Number(curInfo?.currentScrollY ?? 0);
                const curViewportH = Number(curInfo?.viewportHeight ?? viewportHeight);
                const curTotalH = Number(curInfo?.totalHeight ?? totalHeight);

                if (i > 0 && curScrollY === lastScrollY) {
                    console.log('[extractFromUrl] 已到达底部（scrollY不再变化），停止截图', { i, curScrollY, curTotalH, curViewportH });
                    break;
                }
                
                // 提取当前视口的 DOM
                const domRes: any = await browser.tabs.sendMessage(tabId, { 
                    type: 'GET_DOM',
                    onlyInViewport: true
                });
                const segment = domRes.markdown || '';
                const images = domRes.images || [];
                domSegments.push({ markdown: segment, images });

                // 截图
                const dataUrl = await browser.tabs.captureVisibleTab(undefined, { format: 'png' });
                screenshots.push(dataUrl);

                lastScrollY = curScrollY;
                const isAtBottom = curScrollY + curViewportH >= curTotalH - 10;
                if (isAtBottom) {
                    console.log('[extractFromUrl] 已到达底部（拍完最后一屏停止）', { i, curScrollY, curTotalH, curViewportH });
                    break;
                }
            }
        } finally {
            await browser.tabs.sendMessage(tabId, { type: 'RESTORE_SCROLL_POSITION', originalPosition: pageInfo.currentScrollY || 0 });
            await browser.tabs.sendMessage(tabId, { type: 'RESTORE_PAGE_AFTER_SCREENSHOT' });
        }
        
        // 5. 合并 DOM 片段（先下载图片上传 CDN，再用 CDN URL 替换占位符，最后合并）
        statusText.value = "正在处理图片...";
        const replacedSegments = await processAndReplaceImages(domSegments, (done, total) => {
            statusText.value = `正在处理图片 ${done}/${total}...`;
        });
        let fullDOM = '';
        for (const replaced of replacedSegments) {
            fullDOM = mergeTextSegments(fullDOM, replaced);
        }

        // 7. 处理截图拼接（分组拼接，每10张一组）
        statusText.value = "正在处理截图...";
        let stitchedScreenshots: string[] = [];
        
        if (screenshots.length > 0) {
            try {
                if (screenshots.length === 1) {
                    stitchedScreenshots = [screenshots[0]];
                } else {
                    // 复用原有的截图处理流程：去除重复header + 去除最后一屏重叠
                    let processed = await removeRepeatedHeaders(screenshots);
                    processed = await removeFinalOverlap(processed, pageInfo);
                    
                    statusText.value = "正在拼接截图...";
                    // 分组拼接（每10张一组）
                    stitchedScreenshots = await imageProcessor.stitchScreenshotsInGroups(processed);
                    console.log(`[extractFromUrl] 拼接完成：${processed.length} 张 → ${stitchedScreenshots.length} 组`);
                }
            } catch (imgErr) {
                console.warn('[extractFromUrl] 截图拼接失败，使用第一张:', imgErr);
                stitchedScreenshots = [screenshots[0] || ''];
            }
        }

        // 8. 上传拼接后的截图到云端（传入所有分组拼接的截图）
        statusText.value = "正在上传上下文...";
        const uploadRes = await postRetrieve({
            pictures: stitchedScreenshots,
            dom: fullDOM
        });
        
        // 最终内容检查
        if (fullDOM.length < 100) {
            throw new Error(`提取内容过少 (${fullDOM.length} 字符)，可能页面需要登录或内容为空`);
        }
        
        addMessage('ai', `✅ 全页分析完成：${fullDOM.length} 字符，${stitchedScreenshots.length} 张截图`);
        
        return {
            content: fullDOM,
            cdnUrl: uploadRes.cdnUrl,
            cdnUrls: uploadRes.cdnUrls || (uploadRes.cdnUrl ? [uploadRes.cdnUrl] : []),
            screenshot: stitchedScreenshots[0] || ''  // 返回第一张用于预览
        };
        
    } catch (e: any) {
        console.error("[extractFromUrl] 提取失败:", e);
        // 处理各种错误类型（Error, Event, string 等）
        const errMsg = e?.message || e?.type || (typeof e === 'string' ? e : '未知错误');
        throw new Error(`无法提取页面内容: ${errMsg}`);
    } finally {
        // 清理：关闭提取用的标签页
        if (tabId) {
            try {
                await browser.tabs.remove(tabId);
                console.log(`[extractFromUrl] 已关闭标签页: ${tabId}`);
            } catch (closeErr) {
                console.warn('[extractFromUrl] 关闭标签页失败:', closeErr);
            }
        }
        
        // 切回原来的标签页
        if (originalTabId) {
            try {
                await browser.tabs.update(originalTabId, { active: true });
            } catch {}
        }
        
        progress.value = 0;
        statusText.value = '';
    }
};

// PRD Agent 会话 ID（保持上下文连续性）
const prdAgentSessionId = ref(`prd-session-${Date.now()}`);

// 检测是否为"优化PRD"类请求
const isOptimizePrdRequest = (input: string): boolean => {
    const optimizeKeywords = ['优化', '整理', '完善', '优化需求', '优化prd', '优化文档', '整理结构', '规范化'];
    const lowerInput = input.toLowerCase();
    return optimizeKeywords.some(k => lowerInput.includes(k));
};

// 检测是否为"生成测试用例"类请求（用于 URL + 文本输入的分流）
const isGenerateTestCaseRequest = (input: string): boolean => {
    const keywords = [
        '生成测试用例', '生成用例', '测试用例', '写测试用例', '出用例',
        'generate testcase', 'testcase'
    ];
    const lowerInput = (input || '').toLowerCase();
    return keywords.some(k => lowerInput.includes(k));
};

// 检测是否为修改类命令（删除、修改、优化、更新等）
const isModifyCommand = (input: string): boolean => {
    const modifyKeywords = ['删除', '修改', '优化', '更新', '调整', '完善', '补充', '添加', '移除', '去掉', '改', '删', '修'];
    const lowerInput = input.toLowerCase();
    return modifyKeywords.some(k => lowerInput.includes(k));
};

// 根据当前Tab获取要修改的内容
const getCurrentTabContent = (): { content: string; type: string } => {
    if (activeRightTab.value === 'additional' && activeAdditionalPrdId.value) {
        const prd = additionalPrds.value.find(p => p.id === activeAdditionalPrdId.value);
        return { content: prd?.content || '', type: 'additionalPrd' };
    }
    if (activeRightTab.value === 'figma' && activeFigmaDocId.value) {
        const figma = figmaDocs.value.find(f => f.id === activeFigmaDocId.value);
        return { content: figma?.content || '', type: 'figma' };
    }
    // main tab
    switch (activeMainDocType.value) {
        case 'prd':
            return { content: projectState.documents.prd, type: 'prd' };
        case 'optimizedPrd':
            // 优化后的PRD（独立存储）
            return { content: projectState.documents.optimizedPrd, type: 'optimizedPrd' };
        case 'testPoints':
            return { content: projectState.documents.testPoints, type: 'testPoints' };
        case 'testCases':
            return { content: projectState.documents.testCases, type: 'testCases' };
        default:
            return { content: projectState.documents.prd, type: 'prd' };
    }
};

const sendPrdAgentMessage = async (frozenSelected?: RefDoc[], frozenAdditionalPrds?: Array<{ title: string; content: string }>) => {
    if (!prdAgentInput.value || isProcessing.value) return;
    
    const userInput = prdAgentInput.value;
    const urlMatch = userInput.match(URL_REGEX);
    const hasUrl = !!urlMatch;
    const currentStep = projectState.currentStep;
    
    // 根据当前Tab获取要修改的内容
    const currentTab = getCurrentTabContent();
    const isModify = isModifyCommand(userInput);
    
    // 如果是修改类命令，且当前Tab不是PRD相关，则提示用户切换到正确的Tab
    if (isModify && currentTab.type !== 'prd' && currentTab.type !== 'additionalPrd') {
        addMessage('ai', `⚠️ 当前Tab是"${editorHeaderTitle.value}"，修改类命令将作用于当前Tab内容。如需修改PRD，请先切换到PRD Tab。`);
        // 继续执行，修改当前Tab的内容
    }
    
    // 根据当前Tab决定使用哪个内容
    let contextText = currentTab.content;
    let currentPrd = currentTab.content;
    
    // 如果当前Tab不是PRD，但用户输入的是PRD相关命令，则使用主PRD
    if (currentTab.type !== 'prd' && currentTab.type !== 'additionalPrd' && !isModify) {
        contextText = projectState.documents.prd;
        currentPrd = projectState.documents.prd;
    }
    
    // 空状态检查
    if (!contextText && !hasUrl) {
        addMessage('ai', '⚠️ 上下文为空。请先在首页点击"开始分析"，或在输入中包含目标网址 (http/https) 以便自动提取。');
        return;
    }
    
    prdAgentInput.value = '';
    
    if (currentPrd && currentTab.type === 'prd') {
        prdHistory.value.push(currentPrd);
    }
    
    addMessage('user', userInput);
    isProcessing.value = true;
    
    try {
        let cdnUrls = projectState.assets.cdnUrls || (projectState.assets.cdnUrl ? [projectState.assets.cdnUrl] : []);
        
        // ========== URL 模式：复用全页分析链路提取内容 ==========
        if (hasUrl) {
            const targetUrl = urlMatch[0];
            
            // 打开新标签页，执行全页分析（滚动+截图+DOM提取+图片上传）
            const extractResult = await extractContentFromUrlWithFullAnalysis(targetUrl);
            
            if (!extractResult.content || extractResult.content.length < 100) {
                throw new Error(`提取内容过少 (${extractResult.content?.length || 0} 字符)`);
            }
            
            // 更新项目状态
            contextText = extractResult.content;
            cdnUrls = extractResult.cdnUrls || (extractResult.cdnUrl ? [extractResult.cdnUrl] : []);
            
            projectState.assets.domMarkdown = extractResult.content;
            projectState.assets.cdnUrl = extractResult.cdnUrl;
            projectState.assets.cdnUrls = extractResult.cdnUrls || (extractResult.cdnUrl ? [extractResult.cdnUrl] : []);
            projectState.assets.screenshotUrl = extractResult.screenshot;
            projectState.documents.prd = extractResult.content;
            currentPrd = extractResult.content;
        }
        
        // ========== 步骤1（分析）+ 优化请求 → 调用 ask 接口优化 PRD ==========
        const shouldUseAskOptimize = (currentStep === 'content_review' || hasUrl) && isOptimizePrdRequest(userInput);
        
        if (shouldUseAskOptimize) {
            statusText.value = "AI 正在优化需求文档...";
            const selected = frozenSelected ?? selectedRefDocs.value;
            const additionalPrdParams = frozenAdditionalPrds ?? buildAdditionalPrdsForRequest();
            // 规则：若用户用 @ 选择了文档，则把选中文档作为 params.text；否则用当前上下文
            const askText = buildPrimaryTextFromAtSelection(selected, contextText);

            const aiRes = await ask({
                code: 'plugin_test_testprd',
                type: 'testprd',
                sessionId: ensureSessionId() || `prd-optimize-${Date.now()}`,
                instruction: userInput, // 输入框文字作为 instruction（后端会放进 [补充说明]）
                additionalPrds: additionalPrdParams,
                params: {
                    text: askText,
                    pictureKeyList: cdnUrls,
                    isImageSolve: true,
                    isImageByte64: true
                }
            });
            
            projectState.assets.sessionId = aiRes.sessionId;
            // 存储到优化后PRD（不覆盖原始PRD）
            projectState.documents.optimizedPrd = aiRes.answer;
            cachedPRD.value = aiRes.answer;
            hasGeneratedPRD.value = true;
            projectState.currentStep = 'prd_review';
            viewMode.value = 'preview';
            activeRightTab.value = 'main';
            activeMainDocType.value = 'optimizedPrd';  // 切换到优化后PRD Tab
            
            // 提取PRD标题
            const firstLine = aiRes.answer.split('\n').find((l: string) => l.trim().startsWith('#'));
            currentPrdTitle.value = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : '需求文档';
            
            // 显示引导对话和多PRD面板
            showAdditionalPrdPanel.value = true;
            additionalPrds.value = [];
            
            messages.value.push({
                role: 'ai',
                content: `✅ 我已解析《${currentPrdTitle.value}》。\n\n为了让用例更贴合业务逻辑，**是否需要参考其他PRD？**\n\n👇 点击下方 **+** 添加关联文档`,
                actionType: 'edit',
                canUndo: true,
                undoData: currentPrd
            });
        } 
        // ========== 其他情况：调用 prdAgent 对话式处理 ==========
        else {
            if (hasUrl) {
            projectState.currentStep = 'prd_review';
            viewMode.value = 'preview';
        }
        
        statusText.value = "PRD 智能助手分析中...";
        
        // 调用 Agent（带图片上下文）
        const refinedInstruction = hasUrl 
            ? `(系统提示：已完成全页分析，内容和截图已准备就绪) ${userInput}`
            : userInput;
        
        const result = await prdAgent({
            sessionId: prdAgentSessionId.value,
            text: contextText,
            instruction: refinedInstruction,
                pictureKeyList: cdnUrls,
            isImageSolve: true,
            isImageByte64: true,
            additionalPrds: frozenAdditionalPrds ?? buildAdditionalPrdsForRequest()
        });
        pendingAdditionalPrds.value = [];
        
        if (result.type === 'delete' || result.type === 'modify' || result.type === 'add') {
            if (result.newPrd) {
                // 根据当前Tab更新对应的内容
                if (currentTab.type === 'prd') {
                projectState.documents.prd = result.newPrd;
                cachedPRD.value = result.newPrd;
                } else if (currentTab.type === 'optimizedPrd') {
                    projectState.documents.optimizedPrd = result.newPrd;
                    cachedPRD.value = result.newPrd;
                } else if (currentTab.type === 'testPoints') {
                    projectState.documents.testPoints = result.newPrd;
                } else if (currentTab.type === 'testCases') {
                    projectState.documents.testCases = result.newPrd;
                } else if (currentTab.type === 'additionalPrd' && activeAdditionalPrdId.value) {
                    const prd = additionalPrds.value.find(p => p.id === activeAdditionalPrdId.value);
                    if (prd) prd.content = result.newPrd;
                } else if (currentTab.type === 'figma' && activeFigmaDocId.value) {
                    const figma = figmaDocs.value.find(f => f.id === activeFigmaDocId.value);
                    if (figma) figma.content = result.newPrd;
                }
                viewMode.value = 'preview';
            }
            
            messages.value.push({
                role: 'ai',
                content: `✅ ${result.response}\n\n*${editorHeaderTitle.value} 已更新，点击"撤回"可恢复*`,
                actionType: result.type as 'edit' | 'delete' | 'add',
                canUndo: true,
                undoData: currentPrd
            });
        } else {
            addMessage('ai', result.response);
        }
        }
        
        nextTick(() => {
            if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        });
        
    } catch (e: any) {
        console.error("PRD Agent Error", e);
        if (e.message?.includes('fetch') || e.name === 'TypeError') {
            addMessage('ai', `⚠️ **服务连接失败**\n\n${e.message || e}`);
        } else {
            addMessage('ai', `❌ 执行失败：${e.message || e}`);
        }
        if (currentPrd && currentTab.type === 'prd') prdHistory.value.pop();
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

// 撤回 PRD 编辑操作
const undoPrdEdit = (msgIndex: number) => {
    const msg = messages.value[msgIndex];
    if (!msg || !msg.canUndo || !msg.undoData) return;
    
    // 恢复 PRD
    projectState.documents.prd = msg.undoData;
    cachedPRD.value = msg.undoData;
    
    // 标记该消息已撤回，不可再次撤回
    msg.canUndo = false;
    msg.content = msg.content.replace('*PRD 已更新，点击"撤回"可恢复*', '*（已撤回）*');
    
    addMessage('ai', '↩️ 操作已撤回，PRD 已恢复到修改前的状态。');
};

// ================= Test Case 智能体 =================

const testCaseAgentSessionId = ref(`testcase-session-${Date.now()}`);

const sendTestCaseAgentMessage = async (frozenSelected?: RefDoc[], frozenAdditionalPrds?: Array<{ title: string; content: string }>) => {
    if (!testCaseAgentInput.value || isProcessing.value) return;
    
    const userInput = testCaseAgentInput.value;
    const urlMatch = userInput.match(URL_REGEX);
    const hasUrl = !!urlMatch;
    const currentTestCase = projectState.documents.testCases;
    
    // 空状态检查：无现有用例且无 URL
    if (!currentTestCase && !hasUrl) {
        addMessage('ai', '⚠️ 暂无测试用例上下文。请先通过工作流生成用例，或在输入中包含需求文档网址 (http/https) 以便一键生成。');
        return;
    }
    
    testCaseAgentInput.value = '';
    
    // 仅当有内容时保存历史（用于撤回）
    if (currentTestCase) {
        testCaseHistory.value.push(currentTestCase);
    }
    
    addMessage('user', userInput);
    isProcessing.value = true;
    
    try {
        // ========== URL 模式：一键生成测试用例（复用全页分析链路）==========
        if (hasUrl) {
            const targetUrl = urlMatch[0];
            
            // 1. 打开新标签页，执行全页分析（滚动+截图+DOM提取+图片上传）
            const extractResult = await extractContentFromUrlWithFullAnalysis(targetUrl);
            
            if (!extractResult.content || extractResult.content.length < 100) {
                throw new Error(`提取内容过少 (${extractResult.content?.length || 0} 字符)，页面可能需要登录或内容为空`);
            }
            
            // 保存到项目状态（方便后续使用）
            projectState.assets.domMarkdown = extractResult.content;
            projectState.assets.cdnUrl = extractResult.cdnUrl;
            projectState.assets.screenshotUrl = extractResult.screenshot;
            
            statusText.value = "AI 正在生成测试用例...";
            
            // 2. 调用 ask 接口生成测试用例（带图片上下文）
            const additionalPrdParams = frozenAdditionalPrds ?? buildAdditionalPrdsForRequest();
            const selected = frozenSelected ?? selectedRefDocs.value;
            const askText = buildPrimaryTextFromAtSelection(selected, extractResult.content);

            const aiRes = await ask({
                code: 'plugin_test_testcase',
                type: 'testcase',
                sessionId: `url-testcase-${Date.now()}`,
                instruction: userInput, // 输入框文字作为 instruction（后端会放进 [补充说明]）
                additionalPrds: additionalPrdParams,
                outputFormat: testCaseOutputFormat.value,
                params: {
                    text: askText,
                    pictureKeyList: extractResult.cdnUrls || (extractResult.cdnUrl ? [extractResult.cdnUrl] : []),  // 携带截图 CDN URL 列表
                    isImageSolve: true,
                    isImageByte64: true
                }
            });
            
            // 3. 设置测试用例并渲染思维导图
            if (aiRes.answer) {
                projectState.documents.testCases = aiRes.answer;
                cachedTestCases.value = aiRes.answer;
                hasGeneratedTestCases.value = true;
                projectState.currentStep = 'test_case';
                viewMode.value = 'preview';
                activeRightTab.value = 'main';
                activeMainDocType.value = 'testCases';  // 切换到测试用例Tab
                // 智能命名：基于目标 URL
                autoNameTestCases({ url: targetUrl, instruction: userInput });
                
                addMessage('ai', `🎉 **测试用例已生成！**\n\n已完成全页分析（截图+图片入库），右侧已渲染思维导图，共 ${aiRes.answer.length} 字符。`);
            } else {
                throw new Error('AI 返回内容为空');
            }
        } 
        // ========== 普通模式：基于现有用例进行修改/分析 ==========
        else {
            // 根据当前Tab获取要修改的内容
            const currentTab = getCurrentTabContent();
            const isModify = isModifyCommand(userInput);
            
            // 如果是修改类命令，根据当前Tab决定修改哪个内容
            let targetContent = currentTestCase;
            let targetType = currentTab.type || 'testCases';
            
            if (isModify) {
                targetContent = currentTab.content || currentTestCase;
            }
            
            const statusMap: Record<string, string> = {
                'prd': 'PRD 智能助手分析中...',
                'optimizedPrd': '优化PRD 智能助手分析中...',
                'testPoints': '测试点 智能助手分析中...',
                'testCases': 'Test Case 智能助手分析中...',
                'additionalPrd': '辅助PRD 智能助手分析中...',
                'figma': 'Figma 智能助手分析中...'
            };
            statusText.value = statusMap[targetType] || "智能助手分析中...";
            
            const result = await testCaseAgent({
                sessionId: testCaseAgentSessionId.value,
                text: targetContent,
                instruction: userInput,  // 输入框文字作为 instruction
                additionalPrds: frozenAdditionalPrds ?? buildAdditionalPrdsForRequest()
            });
            pendingAdditionalPrds.value = [];
            
            if (result.type === 'delete' || result.type === 'modify' || result.type === 'add') {
                if (result.newTestcase) {
                    // 根据当前Tab更新对应的内容
                    if (targetType === 'prd') {
                        projectState.documents.prd = result.newTestcase;
                        cachedPRD.value = result.newTestcase;
                    } else if (targetType === 'optimizedPrd') {
                        projectState.documents.optimizedPrd = result.newTestcase;
                        cachedPRD.value = result.newTestcase;
                    } else if (targetType === 'testPoints') {
                        projectState.documents.testPoints = result.newTestcase;
                        cachedTestPoints.value = result.newTestcase;
                    } else if (targetType === 'testCases') {
                    projectState.documents.testCases = result.newTestcase;
                    cachedTestCases.value = result.newTestcase;
                    } else if (targetType === 'additionalPrd' && activeAdditionalPrdId.value) {
                        const prd = additionalPrds.value.find(p => p.id === activeAdditionalPrdId.value);
                        if (prd) prd.content = result.newTestcase;
                    } else if (targetType === 'figma' && activeFigmaDocId.value) {
                        const figma = figmaDocs.value.find(f => f.id === activeFigmaDocId.value);
                        if (figma) figma.content = result.newTestcase;
                    }
                    viewMode.value = 'preview';
                }
                
                messages.value.push({
                    role: 'ai',
                    content: `✅ ${result.response}\n\n*${editorHeaderTitle.value}已更新，点击"撤回"可恢复*`,
                    actionType: 'testcase_edit' as any,
                    canUndo: true,
                    undoData: targetContent
                });
            } else {
                addMessage('ai', result.response);
            }
        }
        
        nextTick(() => {
            if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        });
        
    } catch (e: any) {
        console.error("Test Case Agent Error", e);
        addMessage('ai', `❌ 执行失败：${e.message || e}`);
        if (currentTestCase) testCaseHistory.value.pop();
    } finally {
        isProcessing.value = false;
        statusText.value = '';
    }
};

const undoTestCaseEdit = (msgIndex: number) => {
    const msg = messages.value[msgIndex];
    if (!msg || !msg.canUndo || !msg.undoData) return;
    
    projectState.documents.testCases = msg.undoData;
    cachedTestCases.value = msg.undoData;
    
    msg.canUndo = false;
    msg.content = msg.content.replace('*测试用例已更新，点击"撤回"可恢复*', '*（已撤回）*');
    
    addMessage('ai', '↩️ 操作已撤回，测试用例已恢复到修改前的状态。');
};

const reset = async () => {
  if(confirm("确定重置所有进度吗？")) {
      // 清除会话上下文
      await clearPrdSession(prdAgentSessionId.value);
      await clearTestCaseSession(testCaseAgentSessionId.value);
      await clearUiSession(uiAgentSessionId.value);
      
      // 生成新的会话 ID
      prdAgentSessionId.value = `prd-session-${Date.now()}`;
      testCaseAgentSessionId.value = `testcase-session-${Date.now()}`;
      uiAgentSessionId.value = `ui-session-${Date.now()}`;
      
      // 重置状态
      projectState.currentStep = '';
      projectState.documents = { prd: '', optimizedPrd: '', testPoints: '', testCases: '', uiPlan: '', uiReport: '', uiPlanJson: '', midsceneReport: '', midsceneCasesJson: '' };
      projectState.assets = { screenshotUrl: '', domMarkdown: '', cdnUrl: '', cdnUrls: [], sessionId: '' };
      messages.value = [];
      projectState.inputs.figmaUrl = '';
      prdHistory.value = [];
      testCaseHistory.value = [];
      hasGeneratedPRD.value = false;
      hasGeneratedTestPoints.value = false;
      hasGeneratedTestCases.value = false;
      cachedPRD.value = '';
      cachedTestPoints.value = '';
      cachedTestCases.value = '';
      uiViewType.value = 'plan';

      // Reset Midscene state（如果正在执行，先停止）
      if (midsceneAbortController.value) {
          midsceneAbortController.value.abort();
          midsceneAbortController.value = null;
      }
      midsceneSessionId.value = `midscene-session-${Date.now()}`;
      midsceneParsedCases.value = [];
      midsceneSelectedCases.value = new Set();
      midsceneResults.value = [];
      midsceneTimeline.value = [];
      midsceneReportUrl.value = '';
      midsceneReportUrls.value = [];
      midsceneExecuting.value = false;
      midsceneSelectedCaseId.value = '';
      rightPanelTab.value = 'docs';
  }
};
</script>

<!-- 全局样式（非 scoped）：CSS 变量必须放这里才能生效 -->
<style>
/* ============================================
   新粗野主义 (Neo-Brutalism) 设计系统 - 全局变量
   色号: #D8BDD1 #A2A3D1 #CFA6C5 #E6D3D8 #5D6AB4
   ============================================ */
:root {
  --neo-pink-light: #D8BDD1;
  --neo-purple: #A2A3D1;
  --neo-rose: #CFA6C5;
  --neo-cream: #E6D3D8;
  --neo-primary: #5D6AB4;
  --neo-black: #1a1a1a;
  --neo-white: #FFFEF9;
  --neo-border: 3px solid var(--neo-black);
  --neo-shadow: 4px 4px 0 var(--neo-black);
  --neo-shadow-sm: 2px 2px 0 var(--neo-black);
  --neo-radius: 4px;
}

/* 全局 body 样式 */
body {
  background: var(--neo-cream);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  margin: 0;
  padding: 0;
}

/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--neo-cream);
}

::-webkit-scrollbar-thumb {
  background: var(--neo-purple);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--neo-primary);
}
</style>

<!-- 组件局部样式 -->
<style scoped>
.role-select-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: var(--neo-cream);
  background-image: 
    linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px),
    linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px);
  background-size: 20px 20px;
  text-align: center;
}

.role-select-box {
  padding: 28px;
  background: var(--neo-white);
  border-radius: var(--neo-radius);
  border: var(--neo-border);
  box-shadow: var(--neo-shadow);
  width: 86%;
  max-width: 520px;
}

.role-select-title {
  margin: 0 0 8px 0;
  color: var(--neo-black);
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.5px;
  text-transform: uppercase;
}

.role-select-desc {
  margin: 0 0 18px 0;
  color: #555;
  font-size: 13px;
  font-weight: 500;
}

.role-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.role-card {
  appearance: none;
  border: var(--neo-border);
  background: var(--neo-pink-light);
  border-radius: var(--neo-radius);
  padding: 14px 10px 12px;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
  text-align: center;
  box-shadow: var(--neo-shadow-sm);
}

.role-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--neo-black);
}

.role-card:nth-child(2) {
  background: var(--neo-purple);
}

.role-card:nth-child(3) {
  background: var(--neo-rose);
}

.role-card:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.role-card-avatar {
  width: 52px;
  height: 52px;
  border-radius: var(--neo-radius);
  border: 2px solid var(--neo-black);
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #f6f7ff;
}

.role-card-name {
  margin-top: 10px;
  font-size: 14px;
  font-weight: 700;
  color: #222;
}

.role-card-tip {
  margin-top: 6px;
  font-size: 11px;
  color: #777;
  line-height: 1.35;
}

.landing-role-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 12px 0 18px 0;
}

.landing-role-label {
  color: #777;
  font-size: 12px;
}

.landing-role-value {
  color: #222;
  font-size: 12px;
  font-weight: 700;
}

.landing-role-btn {
  border: none;
  background: #eef0ff;
  color: #646cff;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
}

.landing-role-btn:hover {
  background: #e4e7ff;
}

/* ============================================
   PM/DEV 聊天模式 - Neo-Brutalism 风格
   ============================================ */
.chat-only-layout {
  position: relative;
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  background: var(--neo-cream);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.chat-only-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--neo-white);
  border-bottom: 3px solid var(--neo-black);
  box-shadow: 0 2px 0 var(--neo-black);
}

.chat-only-title-main {
  font-size: 16px;
  font-weight: 900;
  color: var(--neo-black);
  line-height: 1.1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chat-only-title-sub {
  margin-top: 4px;
  font-size: 11px;
  color: var(--neo-primary);
  font-weight: 600;
}

.chat-only-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--neo-cream);
}

.chat-only-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--neo-white);
  margin: 8px;
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.chat-only-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: var(--neo-cream);
  border-top: 2px solid var(--neo-black);
}

.chat-only-input-row {
  display: flex;
  gap: 8px;
}

.chat-only-textarea {
  flex: 1;
  min-height: 44px;
  max-height: 160px;
  padding: 10px 12px;
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  font-size: 14px;
  background: var(--neo-white);
  box-shadow: 2px 2px 0 var(--neo-black);
}

.chat-only-textarea:focus {
  outline: none;
  box-shadow: 3px 3px 0 var(--neo-black);
}

/* 快捷操作按钮组 */
.chat-only-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chat-action-btn {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  background: var(--neo-purple);
  color: var(--neo-black);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  cursor: pointer;
  transition: all 0.1s;
  box-shadow: 2px 2px 0 var(--neo-black);
}

.chat-action-btn:hover {
  background: var(--neo-primary);
  color: var(--neo-white);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.chat-action-btn:active {
  transform: translate(1px, 1px);
  box-shadow: none;
}

.chat-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 链接输入区域 */
.chat-only-url-input {
  display: flex;
  gap: 6px;
  padding: 8px;
  background: var(--neo-pink-light);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  box-shadow: 2px 2px 0 var(--neo-black);
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-only-send {
  padding: 10px 16px;
  border-radius: var(--neo-radius);
  border: 2px solid var(--neo-black);
  box-shadow: 2px 2px 0 var(--neo-black);
}

/* ============================================
   统一布局样式（PM/DEV/QA共用）
   ============================================ */
.unified-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--neo-cream);
}

.unified-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--neo-primary);
  border-bottom: 3px solid var(--neo-black);
  box-shadow: 0 2px 0 var(--neo-black);
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 2px solid rgba(255,255,255,0.4);
  border-radius: var(--neo-radius);
  background: rgba(255,255,255,0.12);
  color: var(--neo-white);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: auto;
  margin-right: 8px;
}
.new-chat-btn:hover {
  background: rgba(255,255,255,0.25);
  border-color: rgba(255,255,255,0.6);
}

.unified-header .header-title {
  font-size: 14px;
  font-weight: 900;
  color: var(--neo-white);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.unified-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* 统一输入区域样式 */
.unified-input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: var(--neo-cream);
  border-top: 2px solid var(--neo-black);
  position: relative;
}

/* ================= @ 引用右侧文档 ================= */
.ref-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ref-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 3px solid var(--neo-border);
  background: var(--neo-pink-light);
  box-shadow: 2px 2px 0 var(--neo-border);
  font-weight: 800;
  max-width: 260px;
}

.ref-chip-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ref-chip-remove {
  border: 3px solid var(--neo-border);
  background: var(--neo-cream);
  width: 22px;
  height: 22px;
  line-height: 16px;
  font-weight: 900;
  cursor: pointer;
}

.ref-chip-clear {
  border: 3px solid var(--neo-border);
  background: var(--neo-cream);
  padding: 6px 10px;
  font-weight: 900;
  box-shadow: 2px 2px 0 var(--neo-border);
  cursor: pointer;
}

.ref-picker {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 122px;
  border: 4px solid var(--neo-black);
  background: var(--neo-purple);
  box-shadow: 8px 8px 0 var(--neo-black);
  z-index: 20;
}

.ref-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 4px solid var(--neo-black);
  font-weight: 900;
  color: var(--neo-black);
  background: var(--neo-cream);
}

.ref-picker-close {
  border: 3px solid var(--neo-black);
  background: var(--neo-pink-light);
  width: 26px;
  height: 26px;
  line-height: 18px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: var(--neo-shadow-sm);
}

.ref-picker-close:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--neo-black);
}

.ref-picker-empty {
  padding: 12px;
  color: var(--neo-black);
  font-weight: 700;
  background: var(--neo-cream);
  border-top: 3px solid var(--neo-black);
}

.ref-picker-list {
  max-height: 220px;
  overflow: auto;
  padding: 8px;
}

.ref-picker-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 3px solid var(--neo-black);
  background: var(--neo-white);
  box-shadow: 3px 3px 0 var(--neo-black);
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  font-weight: 900;
  text-align: left;
}

.ref-picker-item:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 6px 6px 0 var(--neo-black);
  background: var(--neo-rose);
}

.ref-picker-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ref-picker-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.ref-picker-meta {
  font-weight: 800;
  font-size: 12px;
  color: var(--neo-primary);
  border: 2px solid var(--neo-black);
  padding: 2px 6px;
  background: var(--neo-cream);
  box-shadow: 2px 2px 0 var(--neo-black);
}

/* 未入库文档警告样式 */
.ref-picker-item.unsaved {
  border-color: var(--neo-orange, #f39c12);
}

.ref-picker-unsaved {
  font-size: 14px;
  margin-left: 4px;
  flex-shrink: 0;
}

.ref-chip-remove,
.ref-chip-clear {
  border: 3px solid var(--neo-black);
}

.ref-chip-remove:hover,
.ref-chip-clear:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--neo-black);
}
.unified-input-area .input-row {
  display: flex;
  gap: 8px;
}

.unified-input-area .unified-textarea {
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: 10px 12px;
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  font-size: 14px;
  font-family: inherit;
  resize: none;
  background: var(--neo-white);
  box-shadow: 2px 2px 0 var(--neo-black);
}

.unified-input-area .unified-textarea:focus {
  outline: none;
  box-shadow: 3px 3px 0 var(--neo-black);
}

.unified-input-area .send-btn {
  padding: 10px 16px;
  border-radius: var(--neo-radius);
  border: 2px solid var(--neo-black);
  box-shadow: 2px 2px 0 var(--neo-black);
}

.unified-input-area .action-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.unified-input-area .action-btn {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  background: var(--neo-purple);
  color: var(--neo-black);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  cursor: pointer;
  transition: all 0.1s ease;
  box-shadow: 2px 2px 0 var(--neo-black);
}

.unified-input-area .action-btn:hover {
  background: var(--neo-primary);
  color: var(--neo-white);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.unified-input-area .action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.unified-input-area .url-input-row {
  display: flex;
  gap: 8px;
}

/* 提示词弹窗 */
.hints-popup {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  box-shadow: 4px 4px 0 var(--neo-black);
  margin-bottom: 8px;
  z-index: 100;
  max-height: 320px;
  overflow-y: auto;
}

.hints-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--neo-pink-light);
  border-bottom: 2px solid var(--neo-black);
  font-weight: 700;
  font-size: 12px;
  position: sticky;
  top: 0;
  z-index: 1;
}

.hints-close {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--neo-black);
}

.hints-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
}

/* 提示词分类标题 */
.hints-category {
  width: 100%;
  font-size: 11px;
  font-weight: 800;
  color: var(--neo-primary);
  margin-top: 8px;
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--neo-purple);
}

.hints-category:first-child {
  margin-top: 0;
}

.hint-item {
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  background: var(--neo-cream);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  cursor: pointer;
  transition: all 0.1s ease;
}

.hint-item:hover {
  background: var(--neo-purple);
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0 var(--neo-black);
}

/* 步骤操作按钮区域 */
.step-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.step-action-btn {
  padding: 8px 12px;
  font-size: 11px;
  flex: 1;
  min-width: 100px;
}

/* 角色菜单步骤项 */
.role-menu-item.workflow-step {
  font-size: 12px;
  padding: 8px 12px;
}

.role-menu-item.workflow-step.active {
  background: var(--neo-primary);
  color: var(--neo-white);
}

.role-menu-divider {
  height: 2px;
  background: var(--neo-black);
  margin: 8px 0;
}

/* 编辑/预览切换按钮 */
.btn-toggle {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 700;
  background: var(--neo-white);
  color: var(--neo-black);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  cursor: pointer;
  transition: all 0.1s ease;
  box-shadow: 2px 2px 0 var(--neo-black);
}

.btn-toggle:hover {
  background: var(--neo-purple);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.btn-upload-img {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  border: 2px solid var(--neo-black);
  border-radius: 6px;
  background: var(--neo-green, #90EE90);
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--neo-black);
  transition: all 0.15s;
}
.btn-upload-img:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}
.btn-upload-img:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.landing-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #f9f9f9;
  text-align: center;
}

.welcome-box {
  padding: 40px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 80%;
  max-width: 400px;
}

.landing-title {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 24px;
}

.landing-desc {
  margin: 0 0 30px 0;
  color: #666;
  font-size: 14px;
}

.start-btn {
  width: 100%;
  padding: 16px;
  font-size: 18px;
  font-weight: bold;
}

.main-layout,
.workflow-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--neo-cream);
}

.workflow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--neo-white);
  border-bottom: 3px solid var(--neo-black);
  box-shadow: 0 2px 0 var(--neo-black);
}

.workflow-title-main {
  font-size: 16px;
  font-weight: 900;
  color: var(--neo-black);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.workflow-title-sub {
  margin-top: 2px;
  font-size: 11px;
  color: var(--neo-primary);
  font-weight: 600;
}

.workflow-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* Left Panel */
.left-panel {
  flex-shrink: 0;
  min-width: 250px;
  max-width: 600px;
  border-right: var(--neo-border);
  display: flex;
  flex-direction: column;
  background: var(--neo-cream);
}

/* Panel Resizer */
.panel-resizer {
  width: 8px;
  background: var(--neo-purple);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.2s;
  border-left: 2px solid var(--neo-black);
  border-right: 2px solid var(--neo-black);
}

.panel-resizer:hover {
  background: var(--neo-primary);
}

.header {
  padding: 15px;
  background: var(--neo-primary);
  border-bottom: var(--neo-border);
}
.header-top { display: flex; align-items: center; margin-bottom: 10px; }
.header h2 { 
  margin: 0;
  font-size: 16px;
  color: var(--neo-white);
  flex: 1;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.back-btn { 
  background: var(--neo-rose);
  border: 2px solid var(--neo-black);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  color: var(--neo-black);
  border-radius: var(--neo-radius);
  font-weight: 900;
}

.role-area {
  position: relative;
  display: flex;
  align-items: center;
}

.role-avatar-btn {
  border: 2px solid var(--neo-black);
  background: var(--neo-white);
  width: 38px;
  height: 38px;
  border-radius: var(--neo-radius);
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 2px 2px 0 var(--neo-black);
  transition: all 0.1s;
}

.role-avatar-btn:hover {
  background: var(--neo-pink-light);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.role-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--neo-radius);
  object-fit: cover;
}

.role-menu {
  position: absolute;
  top: 46px;
  right: 0;
  width: 180px;
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  box-shadow: 4px 4px 0 var(--neo-black);
  padding: 8px;
  z-index: 20;
}

.role-menu-title {
  font-size: 10px;
  color: var(--neo-primary);
  font-weight: 800;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--neo-radius);
  border: 2px solid transparent;
  background: var(--neo-white);
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--neo-black);
  transition: all 0.1s;
}

.role-menu-item:hover {
  background: var(--neo-pink-light);
  border-color: var(--neo-black);
  box-shadow: 2px 2px 0 var(--neo-black);
  transform: translate(-1px, -1px);
}

.role-menu-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--neo-radius);
  object-fit: cover;
  border: 2px solid var(--neo-black);
}

/* 格式选择器（内联在角色菜单中） */
.format-selector-inline {
  display: flex;
  gap: 4px;
  padding: 4px;
}

.format-option-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  background: var(--neo-white);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  color: var(--neo-black);
  transition: all 0.15s ease;
  box-shadow: 1px 1px 0 var(--neo-black);
}

.format-option-btn:hover {
  background: var(--neo-pink-light);
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0 var(--neo-black);
}

.format-option-btn.active {
  background: var(--neo-primary);
  color: var(--neo-white);
  box-shadow: 0 0 0 var(--neo-black);
  transform: translate(1px, 1px);
}

.format-option-btn .format-icon {
  font-size: 12px;
}

.format-option-btn .format-label {
  font-size: 10px;
}

/* Glassmorphism Step Indicator */
/* 步骤指示器 - 新粗野主义风格（紧凑版） */
.step-indicator.glass-container {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    padding: 6px 8px;
    background: var(--neo-cream);
    border-radius: var(--neo-radius);
    margin-top: 6px;
    border: 2px solid var(--neo-black);
    box-shadow: 2px 2px 0 var(--neo-black);
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
}

.step-indicator.glass-container::-webkit-scrollbar {
  height: 4px;
}
.step-indicator.glass-container::-webkit-scrollbar-thumb {
  background: var(--neo-purple);
  border-radius: 2px;
}

.glass-btn {
    flex: 0 0 auto;
    padding: 4px 8px;
    border-radius: var(--neo-radius);
    background: var(--neo-white);
    border: 2px solid var(--neo-black);
    box-shadow: 1px 1px 0 var(--neo-black);
    color: var(--neo-black);
    font-size: 9px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.1s;
    white-space: nowrap;
    user-select: none;
    text-transform: uppercase;
}

.glass-btn:hover {
    background: var(--neo-purple);
    transform: translate(-1px, -1px);
    box-shadow: 2px 2px 0 var(--neo-black);
}

.glass-btn.active {
    background: var(--neo-primary);
    color: var(--neo-white);
    font-weight: 800;
}

.glass-separator {
    color: var(--neo-black);
    font-size: 8px;
    font-weight: 900;
    font-weight: 300;
    opacity: 0.8;
    flex: 0 0 auto;
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.msg {
  padding: 12px;
  border-radius: var(--neo-radius);
  border: var(--neo-border);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  max-width: 90%;
  word-break: break-word;
  overflow-wrap: break-word;
  box-shadow: var(--neo-shadow-sm);
}

.msg.user {
  background: var(--neo-purple);
  align-self: flex-end;
}

.msg.ai {
  background: var(--neo-white);
  align-self: flex-start;
}

/* 代码块样式：固定高度，可滚动 */
.msg :deep(pre) {
  max-height: 200px;
  overflow: auto;
  background: var(--neo-cream);
  border: 2px solid var(--neo-black);
  padding: 8px;
  border-radius: var(--neo-radius);
  font-size: 12px;
}

.msg :deep(code) {
  word-break: break-all;
}
.typing-indicator {
    font-style: italic;
    color: var(--neo-primary);
    margin-bottom: 5px;
    font-weight: 600;
}

.progress-bar { height: 4px; background: #eee; margin-top: 5px; border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: #646cff; transition: width 0.3s; }

.controls {
  padding: 15px;
  background: white;
  border-top: 1px solid #eee;
}
.control-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-field {
  padding: 10px 12px;
  border: var(--neo-border);
  border-radius: var(--neo-radius);
  font-size: 14px;
  background: var(--neo-white);
  font-weight: 500;
  box-shadow: inset 2px 2px 0 rgba(0,0,0,0.05);
}
.input-field:focus {
  outline: none;
  box-shadow: inset 2px 2px 0 var(--neo-primary);
}

/* Buttons */
button {
  appearance: none;
  -webkit-appearance: none;
}
.btn-primary {
  background: var(--neo-primary) !important;
  color: var(--neo-white) !important;
  border: var(--neo-border) !important;
  padding: 10px 16px;
  border-radius: var(--neo-radius);
  cursor: pointer;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.5px;
  box-shadow: var(--neo-shadow-sm);
  transition: transform 0.1s, box-shadow 0.1s;
}
.btn-primary:hover { 
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
}
.btn-primary:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
.btn-primary:disabled { 
  background: var(--neo-purple);
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: var(--neo-shadow-sm);
}

.btn-secondary {
  background: var(--neo-pink-light) !important;
  color: var(--neo-black) !important;
  border: var(--neo-border) !important;
  padding: 10px 16px;
  border-radius: var(--neo-radius);
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  box-shadow: var(--neo-shadow-sm);
  transition: transform 0.1s, box-shadow 0.1s;
}
.btn-secondary:hover { 
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
  background: var(--neo-rose);
}
.btn-secondary:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.btn-success {
  background: #2d7d32 !important;
  color: var(--neo-white) !important;
  border: var(--neo-border) !important;
  padding: 10px 16px;
  border-radius: var(--neo-radius);
  cursor: pointer;
  font-weight: 700;
  box-shadow: var(--neo-shadow-sm);
}
.btn-success:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
}
.btn-evaluate {
  background: var(--neo-primary, #5D6AB4) !important;
  color: var(--neo-white) !important;
  border: var(--neo-border) !important;
  padding: 10px 16px;
  border-radius: var(--neo-radius);
  cursor: pointer;
  font-weight: 700;
  box-shadow: var(--neo-shadow-sm);
}
.btn-evaluate:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
  filter: brightness(1.1);
}
.btn-evaluate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: var(--neo-shadow-sm);
}
.btn-text {
  background: none;
  border: none;
  color: var(--neo-primary);
  cursor: pointer;
  padding: 5px;
  font-weight: 600;
}

/* PRD Agent 输入区域 */
.prd-agent-input {
  position: relative;
  background: var(--neo-cream);
  padding: 10px;
  border-radius: var(--neo-radius);
  margin-bottom: 10px;
  border: 2px solid var(--neo-black);
  box-shadow: 2px 2px 0 var(--neo-black);
}

.agent-hints {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.agent-hints span {
  font-size: 10px;
  font-weight: 700;
  color: var(--neo-black);
  background: var(--neo-purple);
  padding: 4px 10px;
  border-radius: var(--neo-radius);
  border: 2px solid var(--neo-black);
  cursor: pointer;
  transition: transform 0.1s;
}

.agent-hints span:hover {
  background: var(--neo-primary);
  color: var(--neo-white);
  transform: translate(-1px, -1px);
}

/* 输入框右下角添加参考资料按钮 */
.input-add-reference-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  background: var(--neo-purple);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  font-size: 16px;
  font-weight: 900;
  color: var(--neo-black);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: 2px 2px 0 var(--neo-black);
  z-index: 10;
}

.input-add-reference-btn:hover {
  background: var(--neo-primary);
  color: var(--neo-white);
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
}

.input-add-reference-btn:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.agent-hints span:hover {
  background: #646cff;
  color: white;
}

/* 撤回按钮 */
.undo-btn {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 10px;
  font-size: 12px;
  background: #fff3e0;
  border: 1px solid #ffb74d;
  border-radius: 4px;
  color: #e65100;
  cursor: pointer;
  transition: all 0.2s;
}

.undo-btn:hover {
  background: #ffe0b2;
}

/* Right Panel */
.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--neo-white);
  min-width: 0; /* Allows flex child to shrink below content size, enabling scroll */
  min-height: 0;
  overflow: hidden;
  position: relative; /* 用于文档列表侧边栏定位 */
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--neo-white);
}

/* Phase 4: 知识库面板覆盖样式 */
.knowledge-panel-overlay {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--neo-white);
}

/* P1: 历史记录面板覆盖样式 */
.history-panel-overlay {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--neo-white);
}

/* 质量评估面板覆盖样式 */
.quality-panel-overlay {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  background: var(--neo-white);
}

.editor-header {
  padding: 12px 16px;
  border-bottom: var(--neo-border);
  background: var(--neo-pink-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 0 var(--neo-black);
}

.editor-header-title {
  font-weight: 900;
  font-size: 14px;
  color: var(--neo-black);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.editor-header-actions {
  display: flex;
  gap: 6px;
}

/* 空状态样式 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--neo-primary);
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state-text {
  font-size: 16px;
  font-weight: 800;
  color: var(--neo-black);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.empty-state-hint {
  font-size: 12px;
  color: var(--neo-primary);
  font-weight: 600;
}

.tabs {
  display: flex;
  background: #f0f0f0;
  border-radius: 4px;
  padding: 2px;
}
.tabs button {
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: var(--neo-radius);
}
.tabs button.active {
  background: var(--neo-primary);
  color: var(--neo-white);
}
.tabs button:hover:not(.active) {
  background: var(--neo-purple);
}

.editor-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: var(--neo-white);
}

.markdown-editor {
  width: 100%;
  background: var(--neo-white);
  border: none;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  height: 100%;
  border: none;
  padding: 15px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.markdown-preview {
  width: 100%;
  height: 100%;
  padding: 15px;
  overflow-y: auto;
  overflow-x: auto;
  box-sizing: border-box;
}

/* 思维导图容器样式 */
.mindmap-wrapper {
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: var(--neo-white);
  border-radius: var(--neo-radius);
}

/* Markdown Styles */
.markdown-preview :deep(h1) { font-size: 1.5em; margin-bottom: 0.5em; font-weight: bold; }
.markdown-preview :deep(h2) { font-size: 1.3em; margin-bottom: 0.5em; font-weight: bold; }
.markdown-preview :deep(h3) { font-size: 1.1em; margin-bottom: 0.5em; font-weight: bold; }
.markdown-preview :deep(h4) { font-size: 1em; margin-bottom: 0.5em; font-weight: bold; }
.markdown-preview :deep(h5) { font-size: 0.9em; margin-bottom: 0.5em; font-weight: bold; color: #555; }
.markdown-preview :deep(p) { margin-bottom: 1em; line-height: 1.6; }
.markdown-preview :deep(ul), .markdown-preview :deep(ol) { padding-left: 20px; margin-bottom: 1em; }
.markdown-preview :deep(li) { margin-bottom: 0.5em; }

/* Images */
.markdown-preview :deep(img) {
  max-width: 100%;
  border-radius: 4px;
  margin: 10px 0;
  display: block;
}

/* Links */
.markdown-preview :deep(a) {
  color: #646cff;
  word-break: break-all;
  text-decoration: none;
}
.markdown-preview :deep(a):hover {
  text-decoration: underline;
}

/* Tables */
.markdown-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1em;
  display: block;
  overflow-x: auto;
}
.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}
.markdown-preview :deep(th) {
  background-color: #f5f5f5;
  font-weight: bold;
}
.markdown-preview :deep(tr:nth-child(even)) {
  background-color: #fafafa;
}

/* Code Blocks */
.markdown-preview :deep(pre) {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 1em;
}
.markdown-preview :deep(code) {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  background: rgba(0,0,0,0.05);
  padding: 2px 4px;
  border-radius: 3px;
}
.markdown-preview :deep(pre) :deep(code) {
  background: none;
  padding: 0;
}

/* Flow Editor Overlay */
.flow-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f8f9fa;
  z-index: 999;
  display: flex;
  flex-direction: column;
}

/* Screenshot Modal */
.screenshot-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.screenshot-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.screenshot-modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.screenshot-modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.screenshot-modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.no-screenshots {
  text-align: center;
  color: #999;
  padding: 40px;
}

.screenshot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
}

.screenshot-item {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.screenshot-item:hover {
  border-color: #646cff;
  box-shadow: 0 2px 8px rgba(100,108,255,0.2);
}

.screenshot-item img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
}

.screenshot-label {
  padding: 8px;
  font-size: 11px;
  color: #666;
  background: #f9f9f9;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Screenshot Preview */
.screenshot-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1001;
  cursor: zoom-out;
}

.screenshot-preview-overlay img {
  max-width: 90%;
  max-height: 80%;
  object-fit: contain;
  border-radius: 4px;
}

.preview-label {
  color: white;
  margin-top: 15px;
  font-size: 14px;
}

/* UI Agent Mode Indicator */
.mode-indicator {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.mode-indicator.document {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.mode-indicator.action {
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffcc80;
}

/* Agent Hints Group */
.agent-hints-group {
  margin-bottom: 6px;
}

.hints-label {
  font-size: 10px;
  color: #888;
  margin-bottom: 3px;
}

.agent-hints-group .agent-hints {
  margin-bottom: 0;
}

/* 多PRD引用面板 - 新粗野主义风格 */
.additional-prd-panel {
  background: var(--neo-cream);
  border: var(--neo-border);
  border-radius: var(--neo-radius);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--neo-shadow-sm);
}

.additional-prd-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 900;
  color: var(--neo-black);
  text-transform: uppercase;
}

.additional-prd-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.additional-prd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--neo-white);
  border-radius: var(--neo-radius);
  border: 2px solid var(--neo-black);
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: 2px 2px 0 var(--neo-black);
}

.additional-prd-item:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
}

.additional-prd-item.loading {
  background: var(--neo-purple);
}

.additional-prd-item.success {
  background: #c8e6c9;
}

.additional-prd-item.error {
  background: #ffcdd2;
}

.prd-item-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.loading-spinner {
  animation: spin 1s linear infinite;
  display: inline-block;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.prd-item-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.prd-item-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prd-item-url {
  font-size: 10px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prd-item-remove {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  background: transparent;
  border-radius: var(--neo-radius);
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.1s;
}

.prd-item-remove:hover {
  background: #ff5252;
  border-color: var(--neo-black);
  color: white;
}

/* PM/DEV弹窗中的辅助PRD和Figma区域样式 */
.assist-prd-section,
.assist-figma-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--neo-black);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.prd-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  margin-bottom: 6px;
  background: var(--neo-cream);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  box-shadow: 2px 2px 0 var(--neo-black);
}

.prd-item-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.prd-status {
  font-size: 14px;
  flex-shrink: 0;
}

.prd-status.loading {
  animation: spin 1s linear infinite;
}

.prd-url {
  font-size: 11px;
  color: var(--neo-black);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prd-remove {
  width: 24px;
  height: 24px;
  border: 2px solid var(--neo-black);
  background: var(--neo-white);
  border-radius: var(--neo-radius);
  cursor: pointer;
  font-size: 16px;
  font-weight: 900;
  color: var(--neo-black);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.1s;
  box-shadow: 2px 2px 0 var(--neo-black);
}

.prd-remove:hover {
  background: #ff5252;
  color: white;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.add-prd-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
}

.btn-add-prd {
  width: 36px;
  height: 36px;
  border: var(--neo-border);
  background: var(--neo-purple);
  border-radius: var(--neo-radius);
  font-size: 20px;
  font-weight: 900;
  color: var(--neo-black);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, box-shadow 0.1s;
  flex-shrink: 0;
  box-shadow: var(--neo-shadow-sm);
}

.btn-add-prd:hover:not(:disabled) {
  background: var(--neo-primary);
  color: var(--neo-white);
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
}

.btn-add-prd:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.btn-add-prd:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #ccc;
  transform: none;
  box-shadow: none;
}

/* 文档列表侧边栏（参考图片设计） */
.doc-list-sidebar {
  position: absolute;
  top: 0;
  left: 0;
  width: 280px;
  height: 100%;
  background: var(--neo-white);
  border-right: var(--neo-border);
  box-shadow: 4px 0 0 var(--neo-black);
  z-index: 100;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.doc-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: var(--neo-primary);
  color: var(--neo-white);
  font-weight: 800;
  font-size: 13px;
  text-transform: uppercase;
  border-bottom: var(--neo-border);
}

.doc-list-close {
  width: 24px;
  height: 24px;
  background: var(--neo-rose);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-list-close:hover {
  background: #ff5252;
  color: white;
}

.doc-list-items {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.doc-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--neo-cream);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: 2px 2px 0 var(--neo-black);
}

.doc-list-item:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
}

.doc-list-item.active {
  background: var(--neo-purple);
  border-color: var(--neo-primary);
}

.doc-list-item.main-doc {
  background: var(--neo-pink-light);
}

.doc-list-item.main-doc.is-url-main {
  background: linear-gradient(135deg, #fff8e1 0%, #ffe082 100%);
  border-color: #ffa000;
}

.doc-list-item.optimized-doc {
  background: #fff3cd;
}

.doc-list-item.testpoint-doc {
  background: #d1ecf1;
}

.doc-list-item.testcase-doc {
  background: #d4edda;
}

.doc-list-item.figma-doc {
  background: var(--neo-rose);
}

.doc-list-item.loading {
  opacity: 0.7;
}

.doc-list-item.error {
  background: #ffcdd2;
}

.doc-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--neo-black);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-meta {
  font-size: 10px;
  color: #666;
  margin-top: 2px;
}

.doc-delete {
  width: 22px;
  height: 22px;
  background: transparent;
  border: 2px solid transparent;
  border-radius: var(--neo-radius);
  font-size: 14px;
  font-weight: 900;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.doc-list-item:hover .doc-delete {
  opacity: 1;
}

.doc-delete:hover {
  background: #ff5252;
  border-color: var(--neo-black);
  color: white;
}

.loading-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 右侧多Tab导航 - 新粗野主义风格 */
.right-panel-tabs {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  background: var(--neo-cream);
  border-bottom: var(--neo-border);
  overflow-x: auto;
  align-items: center;
  position: relative;
  flex-wrap: wrap;
}

.panel-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  background: var(--neo-white);
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: 2px 2px 0 var(--neo-black);
  min-width: 80px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.panel-tab:hover {
  background: var(--neo-purple);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.panel-tab.active {
  background: var(--neo-primary);
  color: var(--neo-white);
}

/* Tab折叠菜单 */
.tab-overflow-wrapper {
  position: relative;
}

.panel-tab.overflow-tab {
  background: var(--neo-cream);
  border-color: var(--neo-black);
}

.panel-tab.overflow-tab:hover {
  background: var(--neo-purple);
}

.panel-tab.overflow-tab.active {
  background: var(--neo-primary);
  color: var(--neo-white);
}

.tab-overflow-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 180px;
  max-width: 280px;
  background: var(--neo-white);
  border: 3px solid var(--neo-black);
  border-radius: var(--neo-radius);
  box-shadow: 6px 6px 0 var(--neo-black);
  padding: 8px;
  z-index: 100;
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overflow-tab-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  background: var(--neo-white);
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: 2px 2px 0 var(--neo-black);
  text-align: left;
  min-width: 80px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overflow-tab-item:hover {
  background: var(--neo-purple);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.overflow-tab-item.active {
  background: var(--neo-primary);
  color: var(--neo-white);
}

/* 优化后PRD Tab - 金色 */
.panel-tab.optimized-tab {
  background: #fff3cd;
  border-color: #ffc107;
}

.panel-tab.optimized-tab:hover {
  background: #ffe69c;
}

.panel-tab.optimized-tab.active {
  background: #ffc107;
  color: var(--neo-black);
  border-color: var(--neo-black);
}

/* 测试点 Tab - 青色 */
.panel-tab.testpoint-tab {
  background: #d1ecf1;
  border-color: #17a2b8;
}

.panel-tab.testpoint-tab:hover {
  background: #bee5eb;
}

.panel-tab.testpoint-tab.active {
  background: #17a2b8;
  color: var(--neo-white);
  border-color: var(--neo-black);
}

/* 测试用例 Tab - 绿色 */
.panel-tab.testcase-tab {
  background: #d4edda;
  border-color: #28a745;
}

.panel-tab.testcase-tab:hover {
  background: #c3e6cb;
}

.panel-tab.testcase-tab.active {
  background: #28a745;
  color: var(--neo-white);
  border-color: var(--neo-black);
}

/* URL Tab - 蓝色 */
.panel-tab.url-tab {
  background: #e3f2fd;
  border-color: #2196f3;
}

.panel-tab.url-tab:hover {
  background: #bbdefb;
}

.panel-tab.url-tab.active {
  background: #2196f3;
  color: var(--neo-white);
  border-color: var(--neo-black);
}

/* URL Tab 主PRD 醒目边框 */
.panel-tab.url-tab.is-main {
  border-width: 4px;
  border-color: #ff9800;
  box-shadow: 4px 4px 0 var(--neo-black);
  background: #fff3e0;
}

.panel-tab.url-tab.is-main:hover {
  background: #ffe0b2;
}

.panel-tab.url-tab.is-main.active {
  background: #ff9800;
  color: var(--neo-white);
}

/* 辅助PRD Tab - 浅紫 */
.panel-tab.additional-tab {
  background: var(--neo-purple);
}

.panel-tab.additional-tab:hover {
  background: var(--neo-pink-light);
}

.panel-tab.additional-tab.active {
  background: var(--neo-primary);
  color: var(--neo-white);
}

/* Figma Tab - 玫瑰色 */
.panel-tab.figma-tab {
  background: var(--neo-rose);
}

.panel-tab.figma-tab:hover {
  background: var(--neo-pink-light);
}

.panel-tab.figma-tab.active {
  background: var(--neo-primary);
  color: var(--neo-white);
}

/* Tab控制按钮区域 */
.tab-controls {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.tab-control-btn {
  width: 28px;
  height: 28px;
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: 2px 2px 0 var(--neo-black);
}

.tab-control-btn:hover {
  background: var(--neo-purple);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.tab-control-btn.close:hover {
  background: #ff5252;
  color: white;
}

.tab-control-btn.add:hover {
  background: var(--neo-primary);
  color: var(--neo-white);
}

.tab-control-btn.active {
  background: var(--neo-purple);
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--neo-black);
}

/* 文档列表分隔标题（自定义文档） */
.doc-list-divider {
  margin: 10px 0 6px;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 900;
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  background: var(--neo-cream);
  box-shadow: 2px 2px 0 var(--neo-black);
}

/* 弹窗遮罩层 */
/* 参考确认弹窗样式 */
.reference-confirm-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  background: var(--neo-white);
  border: var(--neo-border);
  border-radius: var(--neo-radius);
  padding: 20px;
  width: 90%;
  max-width: 320px;
  box-shadow: 6px 6px 0 var(--neo-black);
  animation: popIn 0.2s ease;
  text-align: center;
}

.confirm-modal-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.confirm-modal-icon {
  font-size: 24px;
}

.confirm-modal-title {
  font-size: 16px;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--neo-black);
}

.confirm-modal-body {
  margin-bottom: 20px;
}

.confirm-modal-body p {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--neo-black);
}

.confirm-modal-body .confirm-hint {
  font-size: 12px;
  color: #666;
  font-weight: 400;
}

.confirm-modal-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.confirm-modal-actions .confirm-btn {
  flex: 1;
  padding: 10px 16px;
  font-size: 12px;
  min-width: 100px;
}

/* 参考确认弹窗 - 文档选择列表 */
.confirm-refpick {
  margin-top: 16px;
  padding: 12px;
  background: var(--neo-cream);
  border: 3px solid var(--neo-black);
  border-radius: var(--neo-radius);
  text-align: left;
}

.confirm-refpick-title {
  font-size: 12px;
  font-weight: 900;
  margin-bottom: 10px;
  color: var(--neo-black);
}

.confirm-refpick-list {
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.confirm-refpick-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s ease;
}

.confirm-refpick-item:hover {
  background: var(--neo-purple);
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0 var(--neo-black);
}

.confirm-refpick-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.confirm-refpick-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.confirm-refpick-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--neo-purple);
  border: 1px solid var(--neo-black);
  border-radius: 3px;
  font-weight: 600;
}

.confirm-refpick-empty {
  text-align: center;
  color: #999;
  font-size: 12px;
  padding: 16px 0;
}

/* 统一提取弹窗 */
.extract-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  background: var(--neo-white);
  border: var(--neo-border);
  border-radius: var(--neo-radius);
  width: 94%;
  max-width: 480px;
  max-height: 85vh;
  box-shadow: 8px 8px 0 var(--neo-black);
  animation: popIn 0.2s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.extract-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--neo-cream);
  border-bottom: 3px solid var(--neo-black);
  font-weight: 900;
  font-size: 15px;
}

.extract-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.extract-section {
  margin-bottom: 12px;
}

.extract-divider {
  height: 2px;
  background: var(--neo-black);
  margin: 14px 0;
}

.extract-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: 4px;
  margin-bottom: 6px;
}

.extract-item.is-main {
  border-color: #ff9800;
  border-width: 3px;
  background: #fff3e0;
  cursor: pointer;
}

.extract-item.is-main:hover {
  background: #ffe0b2;
}

.extract-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--neo-purple-light);
  border: 1px solid var(--neo-black);
  border-radius: 3px;
  color: var(--neo-black);
  font-weight: 600;
}

.extract-empty {
  padding: 10px;
  text-align: center;
  color: #888;
  font-size: 12px;
  font-style: italic;
}

.main-prd-section {
  background: #fff9e6;
  padding: 10px;
  border-radius: 6px;
  border: 2px dashed #ff9800;
}

.extract-status {
  font-size: 14px;
}

.extract-status.loading { color: #ffc107; }
.extract-status.success { color: #28a745; }
.extract-status.error { color: #dc3545; }

.extract-url {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extract-set-main {
  background: none;
  border: 2px solid var(--neo-black);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.1s ease;
}

.extract-set-main:hover {
  background: #ff9800;
  color: white;
  transform: scale(1.1);
}

.extract-remove {
  background: none;
  border: 2px solid var(--neo-black);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition: all 0.1s ease;
}

.extract-remove:hover {
  background: #dc3545;
  color: white;
}

.extract-input-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.extract-modal-footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 3px solid var(--neo-black);
  background: var(--neo-cream);
}

/* URL 文档列表项样式 */
.doc-list-item.url-doc {
  background: #e3f2fd;
}

.doc-list-item.url-doc.is-main {
  border-color: #ff9800;
  border-width: 3px;
  background: #fff3e0;
}

.doc-list-item.url-doc.active {
  background: #bbdefb;
}

.doc-set-main {
  background: none;
  border: 2px solid var(--neo-black);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.1s ease;
}

.doc-set-main:hover {
  background: #ff9800;
  color: white;
  transform: scale(1.1);
}

/* 有头/无头模式切换按钮 */
.btn-mode-toggle {
  background: var(--neo-purple) !important;
  color: var(--neo-black) !important;
  border: var(--neo-border) !important;
  padding: 6px 12px;
  border-radius: var(--neo-radius);
  cursor: pointer;
  font-weight: 700;
  font-size: 11px;
  box-shadow: 2px 2px 0 var(--neo-black);
  transition: all 0.15s ease;
}

.btn-mode-toggle:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.btn-mode-toggle.headless {
  background: var(--neo-primary) !important;
  color: var(--neo-white) !important;
}

.assist-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popIn {
  from { 
    opacity: 0; 
    transform: translate(-50%, -50%) scale(0.9);
  }
  to { 
    opacity: 1; 
    transform: translate(-50%, -50%) scale(1);
  }
}

/* 辅助优化面板 - 弹窗式（新粗野主义风格） */
.assist-optimize-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  background: var(--neo-white);
  border: var(--neo-border);
  border-radius: var(--neo-radius);
  padding: 16px;
  width: 90%;
  max-width: 380px;
  max-height: 70vh;
  overflow-y: auto;
  box-shadow: 6px 6px 0 var(--neo-black);
  animation: popIn 0.2s ease;
}

.assist-optimize-panel .assist-panel-title {
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  margin-bottom: 12px;
  color: var(--neo-black);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.assist-optimize-panel .assist-panel-close {
  width: 24px;
  height: 24px;
  background: var(--neo-rose);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.assist-optimize-panel .assist-panel-close:hover {
  background: #ff5252;
  color: white;
}

.assist-section {
  margin-bottom: 12px;
}

.assist-section.figma-section {
  background: var(--neo-rose);
  padding: 10px;
  border-radius: var(--neo-radius);
  border: 2px solid var(--neo-black);
}

.assist-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 800;
  color: var(--neo-black);
  text-transform: uppercase;
}

.assist-hint {
  font-size: 10px;
  font-weight: 600;
  color: #666;
  text-transform: none;
}

.assist-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.assist-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--neo-white);
  border-radius: var(--neo-radius);
  border: 2px solid var(--neo-black);
  font-size: 12px;
  font-weight: 600;
}

.assist-item.loading {
  background: var(--neo-purple);
}

.assist-item.success {
  background: #c8e6c9;
}

.assist-item.error {
  background: #ffcdd2;
}

.item-status {
  font-size: 12px;
  flex-shrink: 0;
}

.item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-remove {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.item-remove:hover {
  background: #ff5252;
  color: white;
}

.assist-add-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.btn-add {
  width: 36px;
  height: 36px;
  border: var(--neo-border);
  background: var(--neo-purple);
  border-radius: var(--neo-radius);
  font-size: 20px;
  font-weight: 900;
  color: var(--neo-black);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, box-shadow 0.1s;
  flex-shrink: 0;
  box-shadow: var(--neo-shadow-sm);
}

.btn-add:hover:not(:disabled) {
  background: var(--neo-primary);
  color: var(--neo-white);
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
}

.btn-add:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.btn-add.figma {
  background: var(--neo-rose);
}

.btn-add.figma:hover:not(:disabled) {
  background: var(--neo-primary);
  color: var(--neo-white);
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.assist-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0e4ff;
}

/* 圆形图标按钮 - 新粗野主义风格 */
.btn-icon {
  position: relative;
  width: 36px;
  height: 36px;
  min-width: 36px;
  border: var(--neo-border);
  background: var(--neo-purple);
  border-radius: var(--neo-radius);
  font-size: 16px;
  font-weight: 900;
  color: var(--neo-black);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, box-shadow 0.1s;
  flex-shrink: 0;
  box-shadow: var(--neo-shadow-sm);
}

.btn-icon:hover:not(:disabled) {
  background: var(--neo-primary);
  color: var(--neo-white);
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--neo-black);
}

.btn-icon:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Tooltip hover 效果 */
.btn-icon::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  pointer-events: none;
  z-index: 100;
}

.btn-icon::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.8);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  pointer-events: none;
  z-index: 100;
}

.btn-icon:hover::after,
.btn-icon:hover::before {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) scale(1);
}

/* 小圆形按钮变体 */
.btn-icon-sm {
  width: 24px;
  height: 24px;
  min-width: 24px;
  font-size: 12px;
}

.btn-icon-primary {
  background: #646cff;
  border-color: #646cff;
  color: white;
}

.btn-icon-primary:hover:not(:disabled) {
  background: #5254cc;
  border-color: #5254cc;
}

.btn-icon-danger:hover:not(:disabled) {
  background: #ff5252;
  border-color: #ff5252;
}

/* ================= Midscene Full Panel (Step 5) ================= */

.midscene-full-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--neo-white);
  overflow: hidden;
}

.midscene-topbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: var(--neo-primary);
  color: white;
  font-size: 12px;
  flex-shrink: 0;
  position: relative;
}

.midscene-topbar-title { font-weight: 700; font-size: 13px; letter-spacing: 0.3px; }
.midscene-topbar-status {
  font-size: 9px; padding: 1px 6px; border-radius: 8px;
  background: rgba(255,255,255,0.18); font-weight: 500; letter-spacing: 0.5px;
}
.midscene-topbar-status.ok { background: #43a047; }
.midscene-topbar-spacer { flex: 1; }
.midscene-topbar-btn {
  background: rgba(255,255,255,0.12); border: none; border-radius: 4px; color: white;
  width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.midscene-topbar-btn:hover { background: rgba(255,255,255,0.25); }
.midscene-topbar-btn.active { background: rgba(255,255,255,0.3); }

/* 模式标签 */
.midscene-mode-tag {
  font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600;
  line-height: 16px; letter-spacing: 0.3px; white-space: nowrap;
}
.midscene-mode-tag.free { background: rgba(76,175,80,0.25); color: #c8e6c9; }
.midscene-mode-tag.mixed { background: rgba(255,193,7,0.25); color: #fff8e1; }
.midscene-mode-tag.regression { background: rgba(33,150,243,0.25); color: #bbdefb; }

/* 基线标签 */
.midscene-baseline-tag {
  font-size: 9px; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.1);
  border-radius: 8px; padding: 1px 6px; white-space: nowrap; line-height: 16px; font-weight: 500;
}

.midscene-baseline-badge {
  font-size: 10px; color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.12);
  border-radius: 8px; padding: 1px 6px; white-space: nowrap; line-height: 18px;
}

.midscene-stop-btn { background: #ef5350 !important; }
.midscene-stop-btn:hover { background: #d32f2f !important; }

/* ★ 设置按钮容器 */
.midscene-settings-wrap { position: relative; }

/* ★ 设置下拉面板 */
.midscene-settings-dropdown {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 1000;
  width: 260px; background: #fff; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08);
  border: 1px solid #e8e8e8; overflow: hidden;
}

.settings-section { padding: 10px 12px; }
.settings-label {
  font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase;
  letter-spacing: 0.5px; margin-bottom: 6px;
}
.settings-desc {
  font-size: 10px; color: var(--neo-primary); margin-bottom: 6px;
  background: rgba(100, 108, 255, 0.06); padding: 3px 6px; border-radius: 4px;
}
.settings-divider { height: 1px; background: #f0f0f0; margin: 0; }

/* 模式按钮组 */
.settings-mode-group {
  display: flex; gap: 4px;
}
.settings-mode-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 6px 0; border: 1.5px solid #e0e0e0; border-radius: 6px;
  background: #fafafa; color: #555; font-size: 11px; font-weight: 500;
  cursor: pointer; transition: all 0.15s;
}
.settings-mode-btn:hover:not(:disabled) { border-color: var(--neo-primary); color: var(--neo-primary); background: #f5f5ff; }
.settings-mode-btn.active {
  border-color: var(--neo-primary); background: var(--neo-primary); color: #fff;
}
.settings-mode-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* 缓存按钮组 */
.settings-cache-group {
  display: flex; gap: 3px; flex-wrap: wrap;
}
.settings-cache-btn {
  padding: 4px 8px; border: 1px solid #e0e0e0; border-radius: 4px;
  background: #fafafa; color: #666; font-size: 10px; cursor: pointer; transition: all 0.15s;
}
.settings-cache-btn:hover:not(:disabled) { border-color: var(--neo-primary); color: var(--neo-primary); }
.settings-cache-btn.active {
  border-color: var(--neo-primary); background: var(--neo-primary); color: #fff;
}
.settings-cache-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* 浏览器行 */
.settings-row {
  display: flex; gap: 4px; align-items: center;
}
.settings-row-spacer { flex: 1; }
.settings-toggle-btn {
  display: flex; align-items: center; gap: 3px;
  padding: 4px 8px; border: 1px solid #e0e0e0; border-radius: 4px;
  background: #fafafa; color: #666; font-size: 10px; cursor: pointer; transition: all 0.15s;
}
.settings-toggle-btn:hover { border-color: var(--neo-primary); color: var(--neo-primary); }
.settings-toggle-btn.active { border-color: var(--neo-primary); background: var(--neo-primary); color: #fff; }

/* 数据管理按钮 */
.settings-action-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 6px 0; border: 1px solid #e8e8e8; border-radius: 6px;
  background: #fafafa; color: #555; font-size: 11px; cursor: pointer; transition: all 0.15s;
}
.settings-action-btn:hover { background: #f0f0ff; border-color: var(--neo-primary); color: var(--neo-primary); }

/* 覆盖率条 */
.settings-coverage {
  padding: 8px 12px; background: #fafafa;
}
.settings-coverage-bar {
  height: 3px; background: #e8e8e8; border-radius: 2px; overflow: hidden; margin-bottom: 4px;
}
.settings-coverage-fill {
  height: 100%; background: var(--neo-primary); border-radius: 2px; transition: width 0.3s;
}
.settings-coverage-text { font-size: 10px; color: #888; }

/* 设置面板进入/退出动画 */
.settings-fade-enter-active { transition: opacity 0.15s, transform 0.15s; }
.settings-fade-leave-active { transition: opacity 0.1s, transform 0.1s; }
.settings-fade-enter-from { opacity: 0; transform: translateY(-4px); }
.settings-fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* ★ 缓存策略选择器样式（保留兼容） */
.midscene-cache-select {
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;
  color: white; font-size: 10px; padding: 2px 4px; cursor: pointer; height: 24px; outline: none;
}
.midscene-cache-select option { background: #333; color: white; }

/* ★ 缓存管理面板样式 */
.midscene-cache-panel {
  background: #f8f9fa; border-bottom: 1px solid #e0e0e0; padding: 8px; max-height: 200px; overflow-y: auto;
}
.midscene-cache-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
}
.midscene-cache-title { font-size: 12px; font-weight: 600; color: #333; }
.midscene-cache-size { font-size: 10px; color: #888; flex: 1; }
.midscene-cache-clear-btn {
  font-size: 10px; padding: 2px 8px; background: #f44336; color: white;
  border: none; border-radius: 3px; cursor: pointer;
}
.midscene-cache-clear-btn:hover { background: #d32f2f; }
.midscene-cache-clear-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.midscene-cache-loading, .midscene-cache-empty {
  font-size: 11px; color: #888; text-align: center; padding: 8px;
}
.midscene-cache-list { display: flex; flex-direction: column; gap: 3px; }
.midscene-cache-item {
  display: flex; align-items: center; justify-content: space-between;
  background: white; border: 1px solid #e8e8e8; border-radius: 4px; padding: 4px 8px;
}
.midscene-cache-item-info { display: flex; flex-direction: column; overflow: hidden; flex: 1; }
.midscene-cache-item-id {
  font-size: 11px; font-weight: 500; color: #333; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.midscene-cache-item-meta { font-size: 10px; color: #999; }
.midscene-cache-item-del {
  background: none; border: none; color: #999; cursor: pointer; font-size: 14px; padding: 0 4px;
  line-height: 1;
}
.midscene-cache-item-del:hover { color: #f44336; }

/* ★ 步骤编辑器样式 */
.midscene-step-editor {
  background: #f8f9fa; border-bottom: 1px solid #e0e0e0; padding: 8px;
}
.midscene-step-editor-meta {
  display: flex; gap: 4px; margin-bottom: 6px;
}
.midscene-step-input {
  font-size: 11px; padding: 3px 6px; border: 1px solid #ddd; border-radius: 3px;
  background: white; color: #333; outline: none;
}
.midscene-step-input:focus { border-color: #1976d2; }
.midscene-step-list {
  display: flex; flex-direction: column; gap: 3px; max-height: 250px; overflow-y: auto;
}
.midscene-step-item {
  display: flex; align-items: center; gap: 3px; padding: 3px 4px;
  background: white; border: 1px solid #e8e8e8; border-radius: 4px; font-size: 11px;
}
.midscene-step-item.step-passed { border-left: 3px solid #4caf50; }
.midscene-step-item.step-failed { border-left: 3px solid #f44336; }
.midscene-step-index {
  width: 18px; text-align: center; font-size: 10px; color: #888; font-weight: 600; flex-shrink: 0;
}
.midscene-step-type-select {
  font-size: 10px; padding: 2px 3px; border: 1px solid #ddd; border-radius: 3px;
  background: white; color: #333; outline: none; width: 50px; flex-shrink: 0;
}
.midscene-step-method {
  font-size: 9px; color: #888; padding: 1px 4px; background: #f0f0f0; border-radius: 2px;
  white-space: nowrap; flex-shrink: 0;
}
.midscene-step-editor-actions {
  display: flex; gap: 4px; margin-top: 6px;
}
.midscene-step-btn {
  font-size: 10px; padding: 3px 8px; background: #f5f5f5; color: #333;
  border: 1px solid #ddd; border-radius: 3px; cursor: pointer;
}
.midscene-step-btn:hover { background: #eee; }
.midscene-step-btn-primary {
  background: #1976d2; color: white; border-color: #1976d2;
}
.midscene-step-btn-primary:hover { background: #1565c0; }

/* ★ 逐步执行结果样式 */
.midscene-instant-results {
  background: #f8f9fa; border-bottom: 1px solid #e0e0e0; padding: 8px;
  max-height: 200px; overflow-y: auto;
}
.midscene-instant-step {
  display: flex; align-items: center; gap: 4px; padding: 3px 4px; font-size: 11px;
  background: white; border: 1px solid #e8e8e8; border-radius: 4px; margin-bottom: 2px;
  flex-wrap: wrap;
}
.midscene-instant-step.step-passed { border-left: 3px solid #4caf50; }
.midscene-instant-step.step-failed { border-left: 3px solid #f44336; }
.midscene-step-status {
  font-size: 12px; flex-shrink: 0;
}
.midscene-step-desc {
  flex: 1; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.midscene-step-time {
  font-size: 10px; color: #888; flex-shrink: 0;
}
.midscene-step-error {
  width: 100%; font-size: 10px; color: #f44336; padding: 2px 0 0 22px;
}
.midscene-step-suggestion {
  width: 100%; font-size: 10px; color: #ff9800; padding: 2px 0 0 22px;
}

.midscene-case-section {
  padding: 8px 10px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.midscene-timeline-section {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
  border-top: 2px solid var(--neo-black);
}

.midscene-timeline-header {
  font-size: 11px; font-weight: 600; color: #888;
  padding: 8px 0 4px; text-transform: uppercase; letter-spacing: 0.5px;
}

.midscene-timeline-list { display: flex; flex-direction: column; gap: 4px; }

.timeline-card {
  border: 2px solid #e0e0e0; border-radius: var(--neo-radius);
  overflow: hidden; font-size: 12px; transition: border-color 0.2s;
}
.timeline-card.running { border-color: #ff9800; background: #fff8e1; }
.timeline-card.success { border-color: #4caf50; }
.timeline-card.failed { border-color: #f44336; }

.timeline-card-header {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px;
}
.timeline-card-type {
  font-family: monospace; font-size: 10px; font-weight: 700;
  color: var(--neo-primary); flex-shrink: 0;
}
.timeline-card-desc { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.timeline-card-duration { color: #888; font-size: 10px; flex-shrink: 0; }
.timeline-card-icon { font-weight: 700; font-size: 10px; flex-shrink: 0; }
.timeline-card.success .timeline-card-icon { color: #4caf50; }
.timeline-card.failed .timeline-card-icon { color: #f44336; }
.timeline-card.running .timeline-card-icon { color: #ff9800; }

.timeline-card-screenshot {
  width: 100%; max-height: 120px; object-fit: cover; border-top: 1px solid #eee;
}
.timeline-card-error {
  font-size: 11px; color: #f44336; padding: 4px 8px; background: #fff5f5; border-top: 1px solid #fdd;
}

.midscene-summary-bar {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  background: var(--neo-cream); border-top: 2px solid var(--neo-black);
  font-size: 12px; font-weight: 600; flex-shrink: 0;
}

/* Case detail card (right panel) */
.case-detail-card { padding: 4px 0; }
.case-detail-id { font-family: monospace; font-size: 11px; color: var(--neo-primary); margin-bottom: 2px; display: flex; align-items: center; gap: 6px; }
.case-detail-name { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
.case-detail-section { margin-bottom: 10px; }
.case-detail-label { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
.case-detail-value { font-size: 13px; line-height: 1.5; }
.case-detail-assertion { font-size: 12px; padding: 3px 0; display: flex; gap: 6px; align-items: flex-start; }
.assertion-status { font-weight: 700; font-size: 10px; flex-shrink: 0; padding: 1px 4px; border-radius: 2px; }

/* ★ 用例 steps 内联编辑 */
.case-detail-edit-btn {
  font-size: 10px; padding: 2px 8px; border-radius: 3px;
  border: 1px solid #ddd; background: #fff; cursor: pointer;
  display: inline-flex; align-items: center; gap: 3px; color: #555;
}
.case-detail-edit-btn:hover { background: #f0f0f0; border-color: #bbb; }
.case-detail-save-btn { background: #e8f5e9; border-color: #4caf50; color: #2e7d32; }
.case-detail-save-btn:hover { background: #c8e6c9; }

.case-steps-editor { margin-top: 4px; }
.case-step-row {
  display: flex; align-items: center; gap: 4px; margin-bottom: 3px;
}
.case-step-num {
  font-size: 10px; color: #999; width: 16px; text-align: center; flex-shrink: 0;
  font-weight: 600;
}
.case-step-input {
  flex: 1; padding: 4px 6px; border: 1px solid #ddd; border-radius: 3px;
  font-size: 12px; outline: none;
}
.case-step-input:focus { border-color: var(--neo-primary); box-shadow: 0 0 0 1px var(--neo-primary, #6366f1) inset; }
.case-step-action {
  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
  border: 1px solid #e0e0e0; border-radius: 3px; background: #fff; cursor: pointer;
  padding: 0; flex-shrink: 0;
}
.case-step-action:hover { background: #f0f0f0; }
.case-step-action:disabled { opacity: 0.3; cursor: default; }
.case-step-del:hover { background: #ffebee; border-color: #ef5350; color: #e53935; }
.case-step-add-btn {
  font-size: 11px; padding: 3px 8px; border: 1px dashed #ccc; border-radius: 3px;
  background: transparent; cursor: pointer; color: #666; margin-top: 3px;
  display: inline-flex; align-items: center; gap: 3px;
}
.case-step-add-btn:hover { border-color: var(--neo-primary); color: var(--neo-primary); background: #f5f3ff; }
.case-steps-hint {
  font-size: 10px; color: #999; margin-top: 6px; display: flex; align-items: flex-start; gap: 4px;
  padding: 4px 6px; background: #fffde7; border-radius: 3px; border: 1px solid #fff9c4;
}
.step-type-badge {
  font-size: 9px; padding: 1px 5px; border-radius: 3px; flex-shrink: 0;
  border: 1px solid; font-weight: 600; white-space: nowrap; letter-spacing: 0.3px;
  cursor: help; line-height: 1.4;
}
.step-type-badge-ro { margin-left: auto; }
.case-steps-list { margin-top: 2px; }
.case-step-item {
  font-size: 12px; padding: 3px 0; display: flex; gap: 6px; align-items: center;
  line-height: 1.4;
}
.case-steps-empty {
  font-size: 11px; color: #aaa; font-style: italic; padding: 6px 0;
}

/* ★ 快速创建用例 */
.quick-create-panel {
  padding: 10px; background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px;
  margin: 4px 0;
}
.quick-create-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.quick-create-title {
  font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 4px;
}
.quick-create-field { margin-bottom: 8px; }
.quick-create-field label {
  font-size: 11px; font-weight: 600; color: #555; display: flex; align-items: center; gap: 4px; margin-bottom: 3px;
}
.quick-create-field .required { color: #e53935; }
.quick-create-tip { font-size: 9px; color: #999; font-weight: 400; }
.quick-create-input {
  width: 100%; padding: 5px 8px; border: 1px solid #ddd; border-radius: 4px;
  font-size: 12px; outline: none; box-sizing: border-box;
}
.quick-create-input:focus { border-color: var(--neo-primary); }
.quick-create-list-row {
  display: flex; align-items: center; gap: 4px; margin-bottom: 3px;
}
.quick-create-list-row .quick-create-input { flex: 1; }
.quick-create-actions { margin-top: 10px; text-align: right; }
.quick-create-submit {
  background: var(--neo-primary, #6366f1) !important; color: #fff !important; border-color: var(--neo-primary, #6366f1) !important;
  font-weight: 600;
}
.quick-create-submit:hover { opacity: 0.9; }
.quick-create-mode-info {
  margin-top: 10px; padding: 6px 8px; background: #fffde7; border: 1px solid #fff9c4;
  border-radius: 4px; font-size: 10px; color: #666; display: flex; gap: 6px; align-items: flex-start;
  line-height: 1.5;
}

/* ★ 手动编写引导面板 */
.manual-guide-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10;
  background: #fff; overflow-y: auto; padding: 12px;
}
.manual-guide-card { max-width: 500px; margin: 0 auto; }
.manual-guide-header {
  display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700;
  margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--neo-black, #1a1a2e);
}
.manual-guide-section { margin-bottom: 16px; }
.manual-guide-label {
  font-size: 12px; font-weight: 600; color: #555; margin-bottom: 8px;
  display: flex; align-items: center; gap: 4px;
}
.manual-guide-format-btns { display: flex; gap: 8px; }
.manual-guide-format-btn {
  flex: 1; padding: 12px 10px; border: 2px solid #e0e0e0; border-radius: 8px;
  background: #fff; cursor: pointer; text-align: center;
  display: flex; flex-direction: column; gap: 4px; align-items: center;
  transition: all 0.15s;
}
.manual-guide-format-btn:hover {
  border-color: var(--neo-primary, #6366f1); background: #f5f3ff;
  transform: translateY(-1px); box-shadow: 0 2px 8px rgba(99,102,241,0.15);
}
.format-icon {
  width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 14px; color: #fff;
  background: var(--neo-primary, #6366f1);
}
.format-desc { font-size: 10px; color: #999; }
.manual-guide-rules { font-size: 12px; }
.guide-rule {
  padding: 8px; margin-bottom: 6px; background: #f8f9fa; border-radius: 6px;
  border: 1px solid #eee;
}
.guide-rule-title { font-weight: 700; font-size: 12px; margin-bottom: 3px; }
.guide-rule-desc { color: #666; line-height: 1.5; }
.guide-rule-desc code { background: #e8eaf6; padding: 1px 4px; border-radius: 2px; font-size: 11px; }
.guide-examples { margin-top: 5px; }
.guide-example {
  font-size: 11px; padding: 3px 6px; margin-bottom: 2px; border-radius: 3px;
  display: flex; align-items: center; gap: 4px;
}
.guide-example.good { background: #e8f5e9; color: #2e7d32; }
.guide-example.bad { background: #ffebee; color: #c62828; }
.guide-example code { background: rgba(0,0,0,0.06); padding: 1px 3px; border-radius: 2px; }
.guide-mode-table { margin-top: 4px; }
.guide-mode-row {
  display: flex; gap: 8px; padding: 4px 0; font-size: 11px; border-bottom: 1px solid #eee;
  align-items: center;
}
.guide-mode-row:last-child { border-bottom: none; }
.guide-mode-name {
  font-weight: 700; min-width: 60px; font-size: 11px;
  padding: 1px 6px; background: #e8eaf6; border-radius: 3px; text-align: center;
}

/* ================= Midscene Panel Styles (legacy) ================= */

.midscene-panel {
  border-top: 2px solid var(--neo-black);
  background: var(--neo-white);
  max-height: 45vh;
  overflow-y: auto;
  padding: 8px;
  flex-shrink: 0;
}

.midscene-cases-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.midscene-empty {
  padding: 16px;
  text-align: center;
  color: #888;
  font-size: 12px;
}

.midscene-empty-guide {
  padding: 20px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.midscene-empty-title {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}
.midscene-empty-desc {
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}
.midscene-guide-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  transition: all 0.15s;
  width: 160px;
  justify-content: center;
}
.midscene-guide-btn:hover {
  background: #f0f4ff;
  border-color: #5b7cfa;
  color: #5b7cfa;
}
.midscene-empty-hint {
  font-size: 10px;
  color: #aaa;
  margin-top: 4px;
  line-height: 1.4;
}

.midscene-case-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: var(--neo-white);
  font-size: 12px;
  transition: all 0.15s;
  cursor: pointer;
}
.midscene-case-item:hover { background: #f8f9ff; border-color: #d0d0e0; }

.midscene-case-item.passed {
  background: #f1f8f1;
  border-color: #a5d6a7;
  border-left: 3px solid #4caf50;
}

.midscene-case-item.failed {
  background: #fef5f5;
  border-color: #ef9a9a;
  border-left: 3px solid #f44336;
}

.midscene-case-item.running {
  background: #fff8f0;
  border-color: #ffcc80;
  border-left: 3px solid #ff9800;
}

.midscene-case-item.selected {
  outline: 2px solid var(--neo-primary);
  outline-offset: -1px;
  background: #f5f5ff;
}

.midscene-case-item input[type="checkbox"] {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  accent-color: var(--neo-primary);
}

.midscene-case-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

/* 回归基线徽章 */
.midscene-baseline-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: #7c3aed;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  flex-shrink: 0;
  line-height: 1;
}

/* 无基线提示 */
.status-no-baseline {
  font-size: 10px;
  color: #9e9e9e;
  white-space: nowrap;
}

/* 回归模式覆盖率摘要 */
.midscene-regression-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #f5f0ff;
  border: 1px solid #d4bfff;
  border-radius: 6px;
  font-size: 11px;
  margin: 0 0 4px 0;
}
.midscene-regression-summary-text {
  font-weight: 700;
  color: #7c3aed;
}
.midscene-regression-summary-hint {
  color: #9e9e9e;
  font-size: 10px;
}
.midscene-regression-summary-ok {
  color: #4caf50;
  font-weight: 700;
}

.midscene-case-id {
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  font-size: 10px;
  color: var(--neo-primary);
  flex-shrink: 0;
  font-weight: 600;
}

.midscene-case-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #333;
}

.midscene-case-priority {
  flex-shrink: 0;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 8px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.midscene-case-priority.p0 { background: #ffebee; color: #d32f2f; }
.midscene-case-priority.p1 { background: #fff3e0; color: #e65100; }
.midscene-case-priority.p2 { background: #e3f2fd; color: #1565c0; }
.midscene-case-priority.p3 { background: #f5f5f5; color: #757575; }

.midscene-case-status {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
}

.status-pass { color: #4caf50; font-weight: 600; font-size: 10px; }
.status-fail { color: #f44336; font-weight: 600; font-size: 10px; }
.status-running { color: #ff9800; font-weight: 600; font-size: 10px; }

.midscene-btn-run {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fafafa;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.midscene-btn-run:hover:not(:disabled) {
  background: var(--neo-primary);
  color: white;
  border-color: var(--neo-primary);
}

.midscene-btn-run:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.midscene-batch-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
}

.midscene-batch-btn {
  padding: 5px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fafafa;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
  color: #555;
}

.midscene-batch-btn:hover:not(:disabled) {
  border-color: var(--neo-primary);
  color: var(--neo-primary);
  background: #f5f5ff;
}

.midscene-batch-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.midscene-btn-primary {
  background: var(--neo-primary) !important;
  color: white !important;
  border-color: var(--neo-primary) !important;
  font-weight: 600;
}

.midscene-btn-primary:hover:not(:disabled) {
  background: #4a55a0 !important;
  border-color: #4a55a0 !important;
}

.midscene-btn-secondary {
  background: var(--neo-bg-secondary, #f0f0f3);
  color: var(--neo-text, #333);
  font-weight: 500;
  border: 1px solid var(--neo-border, #ddd);
  border-radius: 6px;
  padding: 3px 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
}
.midscene-btn-secondary:hover {
  background: var(--neo-bg-hover, #e4e4e8);
}

.midscene-executing-label {
  font-size: 10px;
  color: #ff9800;
  font-weight: 500;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.midscene-executing-label::before {
  content: '';
  width: 6px; height: 6px; border-radius: 50%; background: #ff9800;
  animation: pulse-dot 1.2s infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Results Dashboard */
.midscene-results {
  margin-top: 8px;
  border-top: 2px solid var(--neo-black);
  padding-top: 8px;
}

.midscene-results-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--neo-cream);
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}

.summary-passed { color: #4caf50; }
.summary-failed { color: #f44336; }
.summary-total { color: #666; }
.summary-duration { color: #888; }

.midscene-result-card {
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  margin-bottom: 4px;
  overflow: hidden;
}

.midscene-result-card.passed { border-color: #4caf50; }
.midscene-result-card.failed { border-color: #f44336; }

.midscene-result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  background: var(--neo-white);
}

.midscene-result-icon {
  font-weight: 700;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
}

.midscene-result-card.passed .midscene-result-icon { background: #e8f5e9; color: #4caf50; }
.midscene-result-card.failed .midscene-result-icon { background: #ffebee; color: #f44336; }

.midscene-result-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.midscene-result-duration {
  color: #888;
  font-size: 11px;
  flex-shrink: 0;
}

.midscene-assertions {
  padding: 4px 8px 6px;
  background: #fafafa;
  border-top: 1px solid #eee;
}

.midscene-assertion {
  font-size: 11px;
  padding: 2px 0;
}

.midscene-assertion.pass { color: #4caf50; }
.midscene-assertion.fail { color: #f44336; }

.midscene-assertion-reason {
  color: #999;
  font-style: italic;
}

.midscene-result-actions {
  display: flex;
  gap: 6px;
  padding: 8px 0;
}

/* Midscene 面板（与知识库等面板同级，不覆盖导航栏） */
.midscene-report-overlay {
  flex: 1;
  background: var(--neo-white);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.midscene-report-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-bottom: 1px solid var(--neo-border, #e0e0e0);
  background: var(--neo-cream);
  flex-shrink: 0;
}

.midscene-report-tabs {
  display: flex;
  gap: 4px;
  align-items: center;
}

.midscene-panel-close {
  margin-left: 4px;
  padding: 3px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #888;
}
.midscene-panel-close:hover {
  background: #f0f0f0;
  color: #333;
}

.midscene-report-tabs button {
  padding: 4px 10px;
  border: 2px solid var(--neo-black);
  border-radius: var(--neo-radius);
  background: var(--neo-white);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.midscene-report-tabs button.active {
  background: var(--neo-primary);
  color: white;
}

.midscene-report-close {
  background: var(--neo-white) !important;
  color: var(--neo-black) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px !important;
  margin-left: 4px;
}

.midscene-report-close:hover {
  background: var(--neo-red, #E86F68) !important;
  color: white !important;
}

.midscene-report-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.midscene-report-body {
  font-size: 13px;
  line-height: 1.6;
}

.midscene-json-view {
  font-family: monospace;
  font-size: 11px;
  background: #f5f5f5;
  padding: 12px;
  border-radius: var(--neo-radius);
  border: 2px solid var(--neo-black);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}

.midscene-report-footer {
  padding: 8px 12px;
  border-top: 2px solid var(--neo-black);
  background: var(--neo-cream);
  flex-shrink: 0;
}

/* 报告列表样式 */
.midscene-report-list {
  margin-bottom: 4px;
}
.midscene-report-list-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--neo-text, #333);
  margin-bottom: 4px;
  display: block;
}
.midscene-report-list-item {
  margin: 2px 0;
}
.midscene-btn-report-link {
  background: none;
  border: none;
  color: var(--neo-primary, #5b63d3);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  border-radius: 4px;
  text-decoration: underline;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.midscene-btn-report-link:hover {
  background: rgba(91, 99, 211, 0.08);
}

/* 每条执行结果中的报告按钮 */
.midscene-result-report-btn {
  background: none;
  border: 1px solid var(--neo-primary, #5b63d3);
  color: var(--neo-primary, #5b63d3);
  font-size: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: auto;
  flex-shrink: 0;
}
.midscene-result-report-btn:hover {
  background: var(--neo-primary, #5b63d3);
  color: white;
}
</style>
