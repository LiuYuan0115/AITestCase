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
      <div class="role-area" @click.stop>
        <button class="role-avatar-btn" @click="toggleRoleMenu" :title="`当前角色：${userRoleLabel}`">
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
          </template>
        </div>
        </div>
      </div>

    <!-- 主体区域 -->
    <div class="unified-body">
      <!-- 左侧面板：聊天 + 输入 -->
      <div class="left-panel" :style="{ width: leftPanelWidth + 'px' }">
        <!-- 聊天消息区 -->
      <div class="chat-container" ref="chatContainer">
        <div v-for="(msg, idx) in messages" :key="idx" :class="['msg', msg.role]">
          <div class="msg-content" v-html="renderMarkdown(msg.content)"></div>
          <button 
            v-if="msg.canUndo && msg.role === 'ai'" 
            @click="msg.actionType === 'testcase_edit' ? undoTestCaseEdit(idx) : undoPrdEdit(idx)" 
            class="undo-btn"
            title="撤回此操作"
          >
            ↩️ 撤回
          </button>
        </div>
        <div v-if="isProcessing" class="msg ai">
          <div class="typing-indicator">{{ statusText || 'AI 正在思考...' }}</div>
          <div class="progress-bar" v-if="progress > 0">
             <div :style="{width: progress + '%'}" class="progress-fill"></div>
          </div>
        </div>
      </div>

        <!-- 统一输入区（固定底部） -->
        <div class="unified-input-area">
          <!-- 已引用文档（通过 @ 选择） -->
          <div v-if="selectedRefDocs.length > 0" class="ref-chip-row">
            <div class="ref-chip" v-for="d in selectedRefDocs" :key="d.id" :title="d.title">
              <span class="ref-chip-title">@{{ d.title }}</span>
              <button class="ref-chip-remove" @click="removeRefDoc(d.id)" title="移除">×</button>
            </div>
            <button class="ref-chip-clear" @click="clearAllRefDocs" title="清空引用">清空</button>
          </div>

          <div class="input-row">
            <textarea
              v-model="unifiedInput"
              class="unified-textarea"
              :placeholder="unifiedInputPlaceholder"
              :disabled="isProcessing"
              @keydown="handleUnifiedKeydown"
            ></textarea>
            <button class="btn-primary send-btn" :disabled="isProcessing || !unifiedInput.trim()" @click="sendUnifiedMessage">
              发送
          </button>
        </div>

          <!-- @ 引用弹窗：展示右侧文档列表（按标题搜索） -->
          <div v-if="showAtDocPicker" class="ref-picker" @mousedown.prevent>
            <div class="ref-picker-header">
              <span>引用右侧文档（输入 @ 后可按标题搜索）</span>
              <button class="ref-picker-close" @click="clearAtPicker">×</button>
            </div>
            <div v-if="filteredRightDocsForAt.length === 0" class="ref-picker-empty">
              暂无可引用文档
            </div>
            <div v-else class="ref-picker-list">
              <button
                v-for="doc in filteredRightDocsForAt"
                :key="doc.id"
                class="ref-picker-item"
                :disabled="selectedRefDocs.some(d => d.id === doc.id)"
                @mousedown.prevent="addRefDoc(doc)"
              >
                <span class="ref-picker-title">{{ doc.title }}</span>
                <span class="ref-picker-meta">{{ doc.kind }}</span>
              </button>
            </div>
        </div>

          <!-- 操作按钮行（精简） -->
          <div class="action-row">
            <button class="action-btn" @click="showExtractModal = true" title="提取文档（链接/参考/Figma）">
              📚 提取
            </button>
            <button class="action-btn" @click="startFullPageAnalysis" :disabled="isProcessing" title="一键滑动提取当前页面">
              📸 当前页
            </button>
            <button class="action-btn hints-btn" @click="showHintsPopup = !showHintsPopup" title="快捷提示词">
              💡 提示
            </button>
          </div>
          
          <!-- 提示词弹窗 -->
          <div v-if="showHintsPopup" class="hints-popup">
            <div class="hints-popup-header">
              <span>💡 {{ currentHintsTitle }}</span>
              <button class="hints-close" @click="showHintsPopup = false">×</button>
            </div>
            <div class="hints-list">
              <!-- PM 产品经理提示词 -->
              <template v-if="userRole === 'pm'">
                <div class="hints-category">📋 需求分析</div>
                <span class="hint-item" @click="setHint('梳理需求范围和优先级')">梳理范围</span>
                <span class="hint-item" @click="setHint('拆解功能模块，列出核心功能和子功能')">拆解模块</span>
                <span class="hint-item" @click="setHint('补充边界条件和约束')">边界条件</span>
                <span class="hint-item" @click="setHint('明确用户角色和使用场景')">用户场景</span>
                <div class="hints-category">⚠️ 风险识别</div>
                <span class="hint-item" @click="setHint('识别需求风险点和潜在问题')">识别风险</span>
                <span class="hint-item" @click="setHint('分析需求依赖和影响范围')">依赖分析</span>
                <span class="hint-item" @click="setHint('评估需求优先级和排期建议')">优先级排期</span>
                <div class="hints-category">📝 文档优化</div>
                <span class="hint-item" @click="setHint('优化需求文档结构和表述')">优化文档</span>
                <span class="hint-item" @click="setHint('补充验收标准和成功指标')">验收标准</span>
              </template>
              
              <!-- DEV 开发者提示词 -->
              <template v-else-if="userRole === 'dev'">
                <div class="hints-category">💻 技术分析</div>
                <span class="hint-item" @click="setHint('分析技术方案和实现思路')">技术方案</span>
                <span class="hint-item" @click="setHint('识别技术风险和难点')">技术风险</span>
                <span class="hint-item" @click="setHint('评估技术可行性')">可行性分析</span>
                <div class="hints-category">⏱️ 工时估算</div>
                <span class="hint-item" @click="setHint('评估开发工时和里程碑')">工时评估</span>
                <span class="hint-item" @click="setHint('拆分开发任务和子任务')">任务拆分</span>
                <div class="hints-category">📡 接口设计</div>
                <span class="hint-item" @click="setHint('设计接口规范和参数定义')">接口设计</span>
                <span class="hint-item" @click="setHint('分析数据模型和表结构')">数据模型</span>
                <span class="hint-item" @click="setHint('梳理系统架构和模块划分')">架构设计</span>
              </template>
              
              <!-- QA 测试角色提示词 - 根据步骤分类 -->
              <template v-else-if="userRole === 'qa'">
                <!-- 1. 分析步骤 -->
                <template v-if="['setup', 'analyzing', 'content_review'].includes(projectState.currentStep) || !projectState.currentStep">
                  <div class="hints-category">📋 内容分析</div>
                  <span class="hint-item" @click="setHint('提取核心功能点和业务逻辑')">提取功能点</span>
                  <span class="hint-item" @click="setHint('整理文档结构，按模块分类')">整理结构</span>
                  <span class="hint-item" @click="setHint('识别文档中缺失的信息')">缺失信息</span>
                  <div class="hints-category">🔍 深度分析</div>
                  <span class="hint-item" @click="setHint('分析业务流程和状态流转')">业务流程</span>
                  <span class="hint-item" @click="setHint('提取关键数据和约束条件')">数据约束</span>
                  <span class="hint-item" @click="setHint('识别边界情况和异常场景')">边界场景</span>
                </template>
                
                <!-- 2. 优化步骤 -->
                <template v-else-if="['optimizing', 'prd_review'].includes(projectState.currentStep)">
                  <div class="hints-category">🔍 PRD评审</div>
                  <span class="hint-item" @click="setHint('检测当前PRD的逻辑冲突和矛盾')">检测冲突</span>
                  <span class="hint-item" @click="setHint('识别潜在风险点和遗漏')">识别风险</span>
                  <span class="hint-item" @click="setHint('检查需求完整性和一致性')">完整性检查</span>
                  <div class="hints-category">📝 优化建议</div>
                  <span class="hint-item" @click="setHint('结构化输出功能点清单')">功能点清单</span>
                  <span class="hint-item" @click="setHint('补充测试相关的验收标准')">验收标准</span>
                  <span class="hint-item" @click="setHint('优化需求描述的清晰度')">优化描述</span>
                </template>
                
                <!-- 3. 测试点步骤 -->
                <template v-else-if="projectState.currentStep === 'test_point'">
                  <div class="hints-category">📊 测试点分析</div>
                  <span class="hint-item" @click="setHint('补充边界值测试点')">边界测试点</span>
                  <span class="hint-item" @click="setHint('检查测试点覆盖率是否完整')">覆盖率检查</span>
                  <span class="hint-item" @click="setHint('补充异常和错误场景测试点')">异常场景</span>
                  <div class="hints-category">🔧 测试点优化</div>
                  <span class="hint-item" @click="setHint('按功能模块重新组织测试点')">重组测试点</span>
                  <span class="hint-item" @click="setHint('补充兼容性测试点')">兼容性测试</span>
                  <span class="hint-item" @click="setHint('补充性能相关测试点')">性能测试点</span>
                </template>
                
                <!-- 4. 测试用例步骤 -->
                <template v-else-if="projectState.currentStep === 'test_case'">
                  <div class="hints-category">📊 用例评审</div>
                  <span class="hint-item" @click="setHint('评审当前用例的覆盖率和完整性')">评审用例</span>
                  <span class="hint-item" @click="setHint('检查测试步骤和预期结果是否清晰')">检查步骤</span>
                  <span class="hint-item" @click="setHint('识别用例中的逻辑漏洞')">检查漏洞</span>
                  <div class="hints-category">➕ 用例补充</div>
                  <span class="hint-item" @click="setHint('补充异常和边界测试用例')">补充异常</span>
                  <span class="hint-item" @click="setHint('补充回归测试用例')">回归用例</span>
                  <span class="hint-item" @click="setHint('优化用例优先级和分类')">优化分类</span>
                </template>
                
                <!-- 5. 自动化测试步骤 -->
                <template v-else-if="projectState.currentStep === 'auto_test'">
                  <div class="hints-category">🔍 页面分析</div>
                  <span class="hint-item" @click="setHint('分析当前页面结构和元素')">分析页面</span>
                  <span class="hint-item" @click="setHint('识别页面中的可交互元素')">识别元素</span>
                  <span class="hint-item" @click="setHint('截取当前页面截图')">截图</span>
                  <div class="hints-category">📋 测试计划</div>
                  <span class="hint-item" @click="setHint('生成UI自动化测试计划')">生成计划</span>
                  <span class="hint-item" @click="setHint('执行测试计划并生成报告')">执行测试</span>
                  <div class="hints-category">👆 操作指令</div>
                  <span class="hint-item" @click="setHint('点击登录按钮')">点击按钮</span>
                  <span class="hint-item" @click="setHint('在用户名输入框输入admin')">输入文本</span>
                  <span class="hint-item" @click="setHint('跳转到首页')">页面跳转</span>
                  <span class="hint-item" @click="setHint('验证页面包含指定文本')">验证文本</span>
                </template>
              </template>
            </div>
          </div>
          
          <!-- QA特有的步骤操作按钮 -->
          <div v-if="userRole === 'qa'" class="step-actions">
            <!-- 分析步骤 -->
            <template v-if="['setup', 'analyzing', 'content_review'].includes(projectState.currentStep)">
              <template v-if="!projectState.documents.prd">
                <!-- 无PRD时，不显示额外按钮（用户可通过"提取当前页"按钮开始） -->
              </template>
              <template v-else-if="!hasGeneratedPRD">
                <button @click="startOptimizePRD" class="btn-primary step-action-btn" :disabled="isProcessing">✨ 优化需求文档</button>
              </template>
              <template v-else>
                <button @click="forwardToPRDReview" class="btn-secondary step-action-btn" :disabled="isProcessing">查看优化PRD →</button>
              </template>
            </template>
            <!-- PRD步骤 -->
            <template v-else-if="['optimizing', 'prd_review'].includes(projectState.currentStep)">
              <button @click="backToContentReview" class="btn-secondary step-action-btn" :disabled="isProcessing">← 返回分析</button>
              <button @click="regeneratePRD" class="btn-secondary step-action-btn" :disabled="isProcessing">重新优化</button>
              <button @click="proceedToTestPoints" class="btn-secondary step-action-btn" :disabled="isProcessing">生成测试点</button>
              <button @click="startGenerateTestCases" class="btn-primary step-action-btn" :disabled="isProcessing">直接生成用例</button>
            </template>
            <!-- 测试点步骤 -->
            <template v-else-if="projectState.currentStep === 'test_point'">
              <button @click="backToPRD" class="btn-secondary step-action-btn" :disabled="isProcessing">← 返回PRD</button>
              <button @click="proceedToTestCases" class="btn-primary step-action-btn" :disabled="isProcessing">确认并生成用例</button>
            </template>
            <!-- 测试用例步骤 -->
            <template v-else-if="projectState.currentStep === 'test_case'">
              <button @click="backToTestPoints" class="btn-secondary step-action-btn" :disabled="isProcessing">← 返回测试点</button>
              <button @click="exportResults" class="btn-success step-action-btn">导出结果</button>
              <button @click="projectState.currentStep = 'auto_test'" class="btn-primary step-action-btn">进入自动化测试</button>
            </template>
            <!-- 自动化测试步骤 -->
            <template v-else-if="projectState.currentStep === 'auto_test'">
              <button @click="projectState.currentStep = 'test_case'" class="btn-secondary step-action-btn">← 返回测试用例</button>
              <button @click="showScreenshots" class="btn-secondary step-action-btn">📸 查看截图</button>
              <button v-if="projectState.documents.uiPlan" @click="toggleUiDoc('plan')" class="btn-secondary step-action-btn">📋 测试计划</button>
              <button v-if="projectState.documents.uiReport" @click="toggleUiDoc('report')" class="btn-secondary step-action-btn">📊 测试报告</button>
              <!-- 有头/无头模式切换 -->
              <button 
                @click="isHeadlessMode = !isHeadlessMode" 
                class="btn-mode-toggle step-action-btn"
                :class="{ 'headless': isHeadlessMode }"
                :title="isHeadlessMode ? '无头模式：后台运行，不显示浏览器界面' : '有头模式：显示浏览器界面'"
              >
                {{ isHeadlessMode ? '👻 无头' : '🖥️ 有头' }}
              </button>
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
            <span>📚 文档列表</span>
            <button class="doc-list-close" @click="showDocList = false">×</button>
          </div>
          <div class="doc-list-items">
            <!-- QA角色的主文档 -->
            <template v-if="userRole === 'qa'">
              <div class="doc-list-item main-doc" :class="{ active: activeRightTab === 'main' && activeMainDocType === 'prd', 'is-url-main': !!urlDocs.find(d => d.isMainPrd) }" @click="activeRightTab = 'main'; activeMainDocType = 'prd'" @dblclick.stop="renameQaMainDocTitle('prd')">
                <span class="doc-icon">{{ urlDocs.find(d => d.isMainPrd) ? '⭐' : '📄' }}</span>
                <div class="doc-info">
                  <div class="doc-title">{{ currentPrdTitle || '主需求文档' }}</div>
                  <div class="doc-meta">主PRD · {{ urlDocs.find(d => d.isMainPrd) ? 'URL文档' : '可编辑' }}</div>
                </div>
              </div>
              <div v-if="hasGeneratedPRD" class="doc-list-item optimized-doc" :class="{ active: activeRightTab === 'main' && activeMainDocType === 'optimizedPrd' }" @click="activeRightTab = 'main'; activeMainDocType = 'optimizedPrd'" @dblclick.stop="renameQaMainDocTitle('optimizedPrd')">
                <span class="doc-icon">✨</span>
                <div class="doc-info">
                  <div class="doc-title">{{ optimizedPrdTitle }}</div>
                  <div class="doc-meta">优化PRD · 可编辑</div>
                </div>
              </div>
              <div v-if="hasGeneratedTestPoints" class="doc-list-item testpoint-doc" :class="{ active: activeRightTab === 'main' && activeMainDocType === 'testPoints' }" @click="activeRightTab = 'main'; activeMainDocType = 'testPoints'" @dblclick.stop="renameQaMainDocTitle('testPoints')">
                <span class="doc-icon">🎯</span>
                <div class="doc-info">
                  <div class="doc-title">{{ testPointsTitle }}</div>
                  <div class="doc-meta">测试点 · 可编辑</div>
                </div>
              </div>
              <div v-if="hasGeneratedTestCases" class="doc-list-item testcase-doc" :class="{ active: activeRightTab === 'main' && activeMainDocType === 'testCases' }" @click="activeRightTab = 'main'; activeMainDocType = 'testCases'" @dblclick.stop="renameQaMainDocTitle('testCases')">
                <span class="doc-icon">📋</span>
                <div class="doc-info">
                  <div class="doc-title">{{ testCasesTitle }}</div>
                  <div class="doc-meta">测试用例 · 可编辑</div>
                </div>
              </div>
            </template>
            <!-- PM/DEV角色的提取文档 -->
            <template v-else>
              <div v-for="(doc, idx) in chatOnlyDocuments" :key="doc.id" class="doc-list-item main-doc" :class="{ active: activeRightTab === 'chatDoc' && activeChatDocId === doc.id }" @click="activeRightTab = 'chatDoc'; activeChatDocId = doc.id" @dblclick.stop="renameChatDocTitle(doc.id)">
                <span class="doc-icon">📄</span>
                <div class="doc-info">
                  <div class="doc-title">{{ doc.title || `文档 ${idx + 1}` }}</div>
                  <div class="doc-meta">{{ doc.type }} · 可编辑</div>
                </div>
                <button class="doc-delete" @click.stop="removeChatOnlyDoc(doc.id)" title="删除">×</button>
              </div>
            </template>
            
            <!-- URL 文档列表（QA角色：链接提取/提取当前页/输入框URL，排除已设为主PRD的） -->
            <template v-if="userRole === 'qa' && urlDocs.filter(d => !d.isMainPrd).length > 0">
              <div class="doc-list-divider">🔗 URL 文档</div>
              <div v-for="doc in urlDocs.filter(d => !d.isMainPrd)" :key="doc.id" class="doc-list-item url-doc" :class="{ active: activeRightTab === 'url' && activeUrlDocId === doc.id }" @click="doc.status === 'success' && (activeRightTab = 'url', activeUrlDocId = doc.id)" @dblclick.stop="doc.status === 'success' && renameUrlDocTitle(doc.id)">
                <span class="doc-icon">
                  <span v-if="doc.status === 'loading'" class="loading-spinner">⏳</span>
                  <span v-else-if="doc.status === 'error'">❌</span>
                  <span v-else>🔗</span>
                </span>
                <div class="doc-info">
                  <div class="doc-title">{{ doc.title || 'URL文档' }}</div>
                  <div class="doc-meta">URL · 可编辑</div>
                </div>
                <button v-if="doc.status === 'success'" class="doc-set-main" @click.stop="setAsMainPrd(doc.id)" title="设为主PRD">⭐</button>
                <button class="doc-delete" @click.stop="removeUrlDoc(doc.id)" title="删除">×</button>
              </div>
            </template>
            
            <!-- 辅助PRD列表（通用） -->
            <div v-for="prd in additionalPrds" :key="prd.id" class="doc-list-item" :class="{ active: activeRightTab === 'additional' && activeAdditionalPrdId === prd.id, loading: prd.status === 'loading', error: prd.status === 'error' }" @click="prd.status === 'success' && (activeRightTab = 'additional', activeAdditionalPrdId = prd.id)" @dblclick.stop="prd.status === 'success' && renameAdditionalPrdTitle(prd.id)">
              <span class="doc-icon">
                <span v-if="prd.status === 'loading'" class="loading-spinner">⏳</span>
                <span v-else-if="prd.status === 'error'">❌</span>
                <span v-else>📑</span>
              </span>
              <div class="doc-info">
                <div class="doc-title">{{ formatPrdTitle(prd, 22) }}</div>
                <div class="doc-meta">辅助PRD · {{ prd.status === 'success' ? '只读' : prd.status === 'loading' ? '加载中' : '失败' }}</div>
              </div>
              <button class="doc-delete" @click.stop="removeAdditionalPrd(prd.id)" title="删除">×</button>
            </div>
            <!-- Figma文档列表 -->
            <div v-for="figma in figmaDocs" :key="figma.id" class="doc-list-item figma-doc" :class="{ active: activeRightTab === 'figma' && activeFigmaDocId === figma.id, loading: figma.status === 'loading', error: figma.status === 'error' }" @click="figma.status === 'success' && (activeRightTab = 'figma', activeFigmaDocId = figma.id)" @dblclick.stop="figma.status === 'success' && renameFigmaTitle(figma.id)">
              <span class="doc-icon">
                <span v-if="figma.status === 'loading'" class="loading-spinner">⏳</span>
                <span v-else-if="figma.status === 'error'">❌</span>
                <span v-else>🎨</span>
              </span>
              <div class="doc-info">
                <div class="doc-title">{{ formatPrdTitle(figma, 22) }}</div>
                <div class="doc-meta">Figma · {{ figma.status === 'success' ? '交互文档' : figma.status === 'loading' ? '解析中' : '失败' }}</div>
              </div>
              <button class="doc-delete" @click.stop="removeFigmaDoc(figma.id)" title="删除">×</button>
        </div>

            <!-- 自定义文档列表 -->
            <div v-if="customDocs.length > 0" class="doc-list-divider">📝 自定义文档</div>
            <div v-for="doc in customDocs" :key="doc.id" class="doc-list-item custom-doc" :class="{ active: activeRightTab === 'custom' && activeCustomDocId === doc.id }" @click="activeRightTab = 'custom'; activeCustomDocId = doc.id" @dblclick.stop="renameCustomDocTitle(doc.id)">
              <span class="doc-icon">📝</span>
              <div class="doc-info">
                <div class="doc-title">{{ doc.title || '自定义文档' }}</div>
                <div class="doc-meta">自定义 · 可编辑</div>
              </div>
              <button class="doc-delete" @click.stop="removeCustomDoc(doc.id)" title="删除">×</button>
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
            <button v-if="hasAnyDocument" class="tab-control-btn" @click="showDocList = !showDocList" :title="showDocList ? '隐藏列表' : '显示列表'">
              ☰
            </button>
            <!-- 新建自定义文档 -->
            <button class="tab-control-btn add" @click="createCustomDoc" title="新建自定义文档">
              +
            </button>
            <button v-if="activeRightTab !== 'main' && activeRightTab !== 'chatDoc'" class="tab-control-btn close" @click="closeCurrentTab" title="关闭当前Tab">
              ×
              </button>
            </div>
        </div>
        
        <!-- 文档内容区域 -->
        <div class="editor-container">
          <div class="editor-header">
            <span class="editor-header-title">{{ currentEditorTitle }}</span>
            <div class="editor-header-actions">
              <button class="btn-toggle" @click="viewMode = viewMode === 'edit' ? 'preview' : 'edit'" :title="viewMode === 'edit' ? '预览' : '编辑'">
                {{ viewMode === 'edit' ? '预览' : '编辑' }}
              </button>
            </div>
          </div>

          <!-- QA角色的主文档内容 -->
          <template v-if="userRole === 'qa' && activeRightTab === 'main'">
            <textarea 
              v-show="viewMode === 'edit'"
              v-model="activeMainDocContent" 
              class="markdown-editor"
              :placeholder="editorPlaceholder"
            ></textarea>
            <!-- PRD内容使用 Markdown 预览 -->
            <div 
              v-show="viewMode === 'preview' && !['testPoints', 'testCases'].includes(activeMainDocType)"
              class="markdown-preview"
              v-html="renderMarkdown(activeMainDocContent)"
            ></div>
            <!-- 测试点和测试用例使用思维导图预览 -->
            <MindMapPreview
              v-if="viewMode === 'preview' && activeMainDocType === 'testPoints'"
              :content="activeMainDocContent"
              type="test_point"
              class="mindmap-wrapper"
            />
            <MindMapPreview
              v-if="viewMode === 'preview' && activeMainDocType === 'testCases'"
              :content="activeMainDocContent"
              type="test_case"
              class="mindmap-wrapper"
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
              <div class="empty-state-icon">📄</div>
              <div class="empty-state-text">等待开始</div>
              <div class="empty-state-hint">使用左侧输入框开始分析</div>
          </div>
          </template>
        </div>
      </div>
        </div>

    <!-- 参考确认弹窗（增强：当无参考和引用时弹出，可选择tab列表内容） -->
    <div v-if="showReferenceConfirmModal" class="assist-modal-overlay" @click.self="showReferenceConfirmModal = false"></div>
    <div v-if="showReferenceConfirmModal" class="reference-confirm-modal">
      <div class="confirm-modal-header">
        <span class="confirm-modal-icon">📎</span>
        <span class="confirm-modal-title">{{ referenceConfirmAction === 'optimize' ? '优化需求文档' : '生成测试用例' }}</span>
      </div>
      <div class="confirm-modal-body">
        <p>是否需要添加辅助参考资料？</p>
        <p class="confirm-hint">添加辅助PRD或Figma设计可以提高{{ referenceConfirmAction === 'optimize' ? '优化' : '生成' }}质量</p>
        
        <!-- 当无任何"参考/引用"时：允许从右侧 Tab 文档中勾选引用 -->
        <div class="confirm-refpick" v-if="shouldShowRefPickInConfirm">
          <div class="confirm-refpick-title">📋 从右侧文档列表选择引用（可多选）</div>
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
          ✅ 引用并继续
        </button>
        <button @click="openReferencePanel" class="btn-primary confirm-btn">
          📎 添加参考
        </button>
        <button @click="skipReference" class="btn-secondary confirm-btn">
          ⏭️ 跳过
        </button>
      </div>
    </div>
    
    <!-- 统一提取弹窗（主PRD / 辅助PRD / Figma / URL 四区） -->
    <div v-if="showExtractModal" class="assist-modal-overlay" @click.self="showExtractModal = false"></div>
    <div v-if="showExtractModal" class="extract-modal">
      <div class="extract-modal-header">
        <span>📚 提取文档</span>
        <button class="assist-panel-close" @click="showExtractModal = false">×</button>
      </div>
      
      <div class="extract-modal-body">
        <!-- 主PRD区域（与文档列表结构一致） -->
        <div class="extract-section main-prd-section" v-if="userRole === 'qa'">
          <div class="section-label">⭐ 主PRD</div>
          <div v-if="urlDocs.find(d => d.isMainPrd)" class="extract-item is-main" @dblclick="renameQaMainDocTitle('prd')">
            <span class="extract-status success">⭐</span>
            <span class="extract-url">{{ currentPrdTitle || '主需求文档' }}</span>
            <span class="extract-tag">URL文档</span>
          </div>
          <div v-else-if="projectState.documents.prd" class="extract-item is-main" @dblclick="renameQaMainDocTitle('prd')">
            <span class="extract-status success">📄</span>
            <span class="extract-url">{{ currentPrdTitle || '主需求文档' }}</span>
            <span class="extract-tag">可编辑</span>
          </div>
          <div v-else class="extract-empty">暂无主PRD，请从下方URL列表添加</div>
        </div>
        
        <div class="extract-divider" v-if="userRole === 'qa'"></div>
        
        <!-- 辅助PRD区域 -->
        <div class="extract-section">
          <div class="section-label">📑 辅助PRD</div>
          <div v-for="prd in additionalPrds" :key="prd.id" class="extract-item" @dblclick="prd.status === 'success' && renameAdditionalPrdTitle(prd.id)">
            <span class="extract-status" :class="prd.status">
              {{ prd.status === 'loading' ? '⏳' : prd.status === 'success' ? '✅' : '❌' }}
            </span>
            <span class="extract-url">{{ prd.title || prd.url.slice(0, 30) }}</span>
            <button class="extract-remove" @click="removeAdditionalPrd(prd.id)">×</button>
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
          <div class="section-label">🎨 Figma</div>
          <div v-for="figma in figmaDocs" :key="figma.id" class="extract-item" @dblclick="figma.status === 'success' && renameFigmaTitle(figma.id)">
            <span class="extract-status" :class="figma.status">
              {{ figma.status === 'loading' ? '⏳' : figma.status === 'success' ? '✅' : '❌' }}
            </span>
            <span class="extract-url">{{ figma.title || figma.url.slice(0, 30) }}</span>
            <button class="extract-remove" @click="removeFigmaDoc(figma.id)">×</button>
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
        
        <!-- URL区域（排除已设为主PRD的） -->
        <div class="extract-section">
          <div class="section-label">🔗 URL</div>
          <div v-for="doc in urlDocs.filter(d => !d.isMainPrd)" :key="doc.id" class="extract-item" @dblclick="doc.status === 'success' && renameUrlDocTitle(doc.id)">
            <span class="extract-status" :class="doc.status">
              {{ doc.status === 'loading' ? '⏳' : doc.status === 'success' ? '✅' : '❌' }}
            </span>
            <span class="extract-url">{{ doc.title || doc.url.slice(0, 30) }}</span>
            <button v-if="doc.status === 'success'" class="extract-set-main" @click="setAsMainPrd(doc.id)" title="设为主PRD">⭐</button>
            <button class="extract-remove" @click="removeUrlDoc(doc.id)">×</button>
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
        <div class="section-label">📄 辅助PRD链接</div>
        <div v-for="prd in additionalPrds" :key="prd.id" class="prd-item">
          <div class="prd-item-content">
            <span class="prd-status" :class="prd.status">
              {{ prd.status === 'loading' ? '⏳' : prd.status === 'success' ? '✅' : '❌' }}
            </span>
            <span class="prd-url">{{ prd.url.substring(0, 40) }}{{ prd.url.length > 40 ? '...' : '' }}</span>
          </div>
          <button class="prd-remove" @click="removeAdditionalPrd(prd.id)">×</button>
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
        <div class="section-label">🎨 Figma 设计链接</div>
        <div v-for="figma in figmaDocs" :key="figma.id" class="prd-item">
          <div class="prd-item-content">
            <span class="prd-status" :class="figma.status">
              {{ figma.status === 'loading' ? '⏳' : figma.status === 'success' ? '✅' : '❌' }}
            </span>
            <span class="prd-url">{{ figma.url.substring(0, 40) }}{{ figma.url.length > 40 ? '...' : '' }}</span>
          </div>
          <button class="prd-remove" @click="removeFigmaDoc(figma.id)">×</button>
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
            
    <!-- 截图弹窗（QA自动化测试用） -->
        <div v-if="showScreenshotModal" class="screenshot-modal-overlay" @click.self="showScreenshotModal = false">
            <div class="screenshot-modal">
                <div class="screenshot-modal-header">
                    <h3>📸 测试截图</h3>
                    <div style="display:flex; gap:8px;">
                        <button @click="refreshScreenshots" class="btn-secondary" style="font-size:12px; padding:4px 8px;">🔄 刷新</button>
                        <button @click="clearAllScreenshots" class="btn-secondary" style="font-size:12px; padding:4px 8px;">🗑️ 清空</button>
                        <button @click="showScreenshotModal = false" class="btn-text" style="font-size:18px;">×</button>
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
import { ImageProcessor } from '@/utils/imageProcessor';
import { postRetrieve, ask, uploadImage, prdAgent, clearPrdSession, testCaseAgent, clearTestCaseSession, uiAgent, clearUiSession, getUiScreenshots, clearUiScreenshots, chatAgent } from '@/api';
import MindMapPreview from '@/components/MindMapPreview.vue';
import { getLocalAgentUrl } from '@/utils/agentUrl';
import { browser } from 'wxt/browser';

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
  documents: { prd: '', optimizedPrd: '', testPoints: '', testCases: '', uiPlan: '', uiReport: '' }
});

// 消息类型扩展：支持撤回操作
interface Message {
  role: 'user' | 'ai';
  content: string;
  actionType?: 'edit' | 'delete' | 'add' | 'query' | 'testcase_edit'; // 操作类型
  canUndo?: boolean; // 是否可撤回
  undoData?: string; // 撤回前的 PRD 内容
}

const messages = ref<Message[]>([]);
const isProcessing = ref(false);
const statusText = ref('');
const progress = ref(0);
const viewMode = ref<'edit' | 'preview'>('preview');
const chatContainer = ref<HTMLElement|null>(null);
const hasGeneratedPRD = ref(false); // Track if PRD has been generated at least once
const cachedPRD = ref('');
const hasGeneratedTestPoints = ref(false);
const cachedTestPoints = ref('');
const hasGeneratedTestCases = ref(false);
const cachedTestCases = ref('');
const imageProcessor = new ImageProcessor();
const uiAgentInput = ref('');
const prdAgentInput = ref(''); // PRD 智能体输入
const prdHistory = ref<string[]>([]); // PRD 历史记录，用于撤回
const testCaseAgentInput = ref(''); // Test Case 智能体输入
const testCaseHistory = ref<string[]>([]); // Test Case 历史记录
const uiAgentSessionId = ref(`ui-session-${Date.now()}`);
const isHeadlessMode = ref(false); // UI自动化测试：有头/无头模式

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
}

// 自定义文档（用户新增）
interface CustomDoc {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

// Figma文档
interface FigmaDoc {
  id: string;
  url: string;
  title: string;
  status: 'loading' | 'success' | 'error';
  content: string;  // 生成的交互补充文档
  error?: string;
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

const clearAtPicker = () => {
  showAtDocPicker.value = false;
  atQuery.value = '';
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

const buildAdditionalPrdsForRequest = (): Array<{ title: string; content: string }> => {
  const result: Array<{ title: string; content: string }> = [];
  
  // 1) 全局引用：辅助PRD（additionalPrds）和 Figma 文档（始终带上）
  const successfulPrds = additionalPrds.value.filter(p => p.status === 'success');
  const successfulFigmas = figmaDocs.value.filter(f => f.status === 'success');
  
  for (const prd of successfulPrds) {
    result.push({ title: `[辅助PRD] ${prd.title}`, content: prd.content });
  }
  for (const figma of successfulFigmas) {
    result.push({ title: `[Figma交互补充] ${figma.title}`, content: figma.content });
  }
  
  // 2) 输入框 @ 引用：只包含 URL 和自定义文档（主PRD 不应该出现在这里）
  if (selectedRefDocs.value.length > 0) {
    for (const doc of selectedRefDocs.value) {
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
  
  // 3) 本次发送/弹窗选择的引用（一次性，优先级最高）
  if (pendingAdditionalPrds.value.length > 0) {
    for (const picked of pendingAdditionalPrds.value) {
      result.push(picked);
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
    if (step === 'auto_test') return '输入指令（如：点击登录按钮 / 输入admin到用户名）';
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
    // QA主文档Tabs - 主PRD（如果是URL文档则显示⭐）
    tabs.push({
      key: 'main:prd',
      label: `${mainUrlPrd ? '⭐' : '📄'} ${truncateTabLabel(currentPrdTitle.value || '主PRD')}`,
      type: 'main',
      mainDocType: 'prd',
      onClick: () => { activeRightTab.value = 'main'; activeMainDocType.value = 'prd'; },
      onDblClick: () => renameQaMainDocTitle('prd')
    });
    
    if (projectState.documents.optimizedPrd) {
      tabs.push({
        key: 'main:optimizedPrd',
        label: `✨ ${truncateTabLabel(optimizedPrdTitle.value)}`,
        type: 'main',
        mainDocType: 'optimizedPrd',
        onClick: () => { activeRightTab.value = 'main'; activeMainDocType.value = 'optimizedPrd'; },
        onDblClick: () => renameQaMainDocTitle('optimizedPrd')
      });
    }
    
    if (projectState.documents.testPoints) {
      tabs.push({
        key: 'main:testPoints',
        label: `🎯 ${truncateTabLabel(testPointsTitle.value)}`,
        type: 'main',
        mainDocType: 'testPoints',
        onClick: () => { activeRightTab.value = 'main'; activeMainDocType.value = 'testPoints'; },
        onDblClick: () => renameQaMainDocTitle('testPoints')
      });
    }
    
    if (projectState.documents.testCases) {
      tabs.push({
        key: 'main:testCases',
        label: `📋 ${truncateTabLabel(testCasesTitle.value)}`,
        type: 'main',
        mainDocType: 'testCases',
        onClick: () => { activeRightTab.value = 'main'; activeMainDocType.value = 'testCases'; },
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
        onClick: () => { activeRightTab.value = 'url'; activeUrlDocId.value = doc.id; },
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
        onClick: () => { activeRightTab.value = 'chatDoc'; activeChatDocId.value = doc.id; },
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
      onClick: () => { activeRightTab.value = 'additional'; activeAdditionalPrdId.value = prd.id; },
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
      onClick: () => { activeRightTab.value = 'figma'; activeFigmaDocId.value = figma.id; },
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
      onClick: () => { activeRightTab.value = 'custom'; activeCustomDocId.value = doc.id; },
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
const sendUnifiedMessage = async () => {
  if (!unifiedInput.value.trim() || isProcessing.value) return;
  
  const msg = unifiedInput.value.trim();
  unifiedInput.value = '';

  // 固化本次发送需要的引用文档（避免发送中用户继续操作导致引用变化）
  pendingAdditionalPrds.value = buildAdditionalPrdsForRequest();
  // 发送后默认清空引用（避免误带到下一次对话）
  clearAllRefDocs();
  clearAtPicker();
  
  if (userRole.value === 'pm' || userRole.value === 'dev') {
    // PM/DEV角色：使用chatAgent
    chatOnlyInput.value = msg;
    await sendChatOnlyMessage();
  } else if (userRole.value === 'qa') {
    // QA角色：根据当前步骤调用不同的agent
    const step = projectState.currentStep;
    if (['setup', 'analyzing', 'content_review', 'optimizing', 'prd_review'].includes(step)) {
      prdAgentInput.value = msg;
      await sendPrdAgentMessage();
    } else if (['test_point', 'test_case'].includes(step)) {
      testCaseAgentInput.value = msg;
      await sendTestCaseAgentMessage();
    } else if (step === 'auto_test') {
      uiAgentInput.value = msg;
      await sendUiAgentMessage();
    }
  }
};

// 保存 URL 提取结果到 URL 区域（首次提取默认设为主PRD）
const saveUrlDoc = (url: string, content: string, title: string) => {
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
    const docId = saveUrlDoc(url, content, title);
    
    extractModalUrlInput.value = '';
    addMessage('ai', `✅ 已提取并加入 URL 区域：《${title}》${urlDocs.value.find(d => d.id === docId)?.isMainPrd ? '（已设为主PRD）' : ''}`);
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
  // 点击空白处自动收起菜单
  if (isRoleMenuOpen.value) isRoleMenuOpen.value = false;
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

const sendChatOnlyMessage = async () => {
  if (!chatOnlyInput.value.trim() || isProcessing.value) return;
  if (!userRole.value || !isChatOnlyRole.value) return;

  const userText = chatOnlyInput.value.trim();
  chatOnlyInput.value = '';

  messages.value.push({ role: 'user', content: userText });
  const aiMsg: Message = { role: 'ai', content: '' };
  messages.value.push(aiMsg);
  scrollChatOnlyToBottom();

  isProcessing.value = true;
  statusText.value = 'AI 正在思考...';

  try {
    const role = userRole.value === 'pm' ? 'pm' : 'dev';
    const additionalPrdsToSend = buildAdditionalPrdsForRequest();
    pendingAdditionalPrds.value = [];
    const result = await chatAgent({
      sessionId: chatOnlySessionId.value,
      role,
      message: userText,  // 输入框文字作为 message
      additionalPrds: additionalPrdsToSend
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
  
  try {
    // 获取当前标签页
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab?.url) {
      throw new Error('无法获取当前页面');
    }
    
    const tabId = tab.id;
    
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
    
    // 合并DOM内容
    const fullMarkdown = domSegments.map(s => s.markdown).join('\n\n');
    
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
    isProcessing.value = false;
    statusText.value = '';
    scrollChatOnlyToBottom();
  }
};

// ... (Computed)

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
      case 'auto_test': return uiViewType.value === 'report' ? projectState.documents.uiReport : projectState.documents.uiPlan;
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
         else projectState.documents.uiPlan = val;
         break;
    }
  }
});

const editorPlaceholder = computed(() => {
  if (!projectState.currentStep || projectState.currentStep === 'setup') return '请点击左侧开始分析...';
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
const activeMainDocContent = computed({
  get: () => {
    switch (activeMainDocType.value) {
      case 'prd': 
        // 原始提取的PRD
        return projectState.documents.prd;
      case 'optimizedPrd':
        // 优化后的PRD（独立存储）
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
const addMessage = (role: 'user' | 'ai', content: string) => {
  messages.value.push({ role, content });
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
        viewMode.value = 'preview';
        if (hasGeneratedTestCases.value) {
            projectState.documents.testCases = cachedTestCases.value;
        }
    } else if (step === 'auto_test') {
        enterAutoTest();
    }
};

const enterWorkflow = () => {
  // QA角色进入后，直接进入分析步骤（与PM/DEV一致的输入界面）
  projectState.currentStep = 'content_review';
};

const enterAutoTest = () => {
  projectState.currentStep = 'auto_test';
  uiViewType.value = 'plan';
  addMessage('ai', `🤖 **UI 自动化测试智能体**

欢迎使用 UI 自动化测试功能！

**工作流程：**
1. 📋 **生成测试计划** - 分析当前页面，生成结构化测试计划
2. 🚀 **执行测试** - 根据计划自动执行测试并截图
3. 📊 **生成报告** - 汇总测试结果，生成详细报告

**快速开始：**
- 点击下方"分析页面"了解页面结构
- 点击"生成计划"创建测试计划
- 有计划后，点击"执行测试"开始自动化

**前置条件：**
\`\`\`
✅ 本地 Agent 服务 (Port 8000)
✅ Chrome 调试模式 (Port 9222)
\`\`\``);
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
    
    // Merge DOM Segments
    statusText.value = "正在合并文本...";
    let fullDOM = '';

    for (const seg of domSegments) {
        fullDOM = mergeTextSegments(fullDOM, seg.markdown);
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
    statusText.value = "初始化...";
    addMessage('user', '开始分析页面...');
    projectState.currentStep = 'analyzing';

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) throw new Error("No active tab");

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
    
    // 3. 保存到 URL 区域（首次提取默认为主PRD）
    const tabUrl = tabs[0]?.url || 'current_page';
    const title = deriveDocTitle(projectState.assets.domMarkdown, tabUrl, '当前页');
    saveUrlDoc(tabUrl, projectState.assets.domMarkdown, title);
    
    // 如果是首次提取，进入 content_review 步骤
    projectState.currentStep = 'content_review';
    viewMode.value = 'edit';
    addMessage('ai', `✅ 内容提取完成，已保存到【URL区域】：《${title}》${urlDocs.value[0]?.isMainPrd ? '（已设为主PRD）' : ''}\n\n您可以直接编辑原始数据（剔除无关内容），然后点击"优化需求文档"。`);

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
        // New Ask Interface for PRD
        const aiRes = await ask({
            code: 'plugin_test_testprd',
            type: 'testprd',
            sessionId: projectState.assets.sessionId,
            params: {
                text: projectState.documents.prd, // User edited DOM content
                pictureKeyList: projectState.assets.cdnUrls || (projectState.assets.cdnUrl ? [projectState.assets.cdnUrl] : []), // Screenshot URL 列表
                isImageSolve: true,
                isImageByte64: true
            },
            additionalPrds: additionalPrdParams
        });
        
        projectState.assets.sessionId = aiRes.sessionId;
        // 存储到优化后PRD（不覆盖原始PRD）
        projectState.documents.optimizedPrd = aiRes.answer;
        
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
        
        addMessage('ai', `✅ PRD优化完成！${contextInfo.length > 0 ? `\n\n📚 已参考：${contextInfo.join('、')}` : ''}\n\n📝 您可以继续修改，或点击「生成测试用例」`);
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
            sessionId: projectState.assets.sessionId || `prd-optimize-${Date.now()}`,
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
        // 构建辅助PRD列表参数（包含PRD和Figma）
        const additionalPrdParams: Array<{ title: string; content: string }> = [];
        for (const prd of successfulPrds) {
            additionalPrdParams.push({ title: `[辅助PRD] ${prd.title}`, content: prd.content });
        }
        for (const figma of successfulFigmas) {
            additionalPrdParams.push({ title: `[Figma交互补充] ${figma.title}`, content: figma.content });
        }
        
        const aiRes = await ask({
            code: 'plugin_test_testcase',
            type: 'testcase',
            sessionId: `mvp-${Date.now()}`,
            params: {
                text: projectState.documents.prd,
                pictureKeyList: projectState.assets.cdnUrls || [],
                isImageSolve: true,
                isImageByte64: true
            },
            additionalPrds: additionalPrdParams
        });
        
        projectState.documents.testCases = aiRes.answer;
        cachedTestCases.value = aiRes.answer;
        hasGeneratedTestCases.value = true;
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
          sessionId: projectState.assets.sessionId,
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
      const aiRes = await ask({
          code: 'plugin_test_testpoint',
          type: 'testpoint',
          sessionId: `mvp-${Date.now()}`, // New session
          params: {
              text: projectState.documents.prd, // Send PRD as context
              pictureKeyList: projectState.assets.cdnUrls || (projectState.assets.cdnUrl ? [projectState.assets.cdnUrl] : []), // Optional: keep screenshot context
              isImageSolve: true,
              isImageByte64: true
          }
      });
      
      projectState.documents.testPoints = aiRes.answer;
      cachedTestPoints.value = aiRes.answer;
      hasGeneratedTestPoints.value = true;

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
      const aiRes = await ask({
          code: 'plugin_test_testcase',
          type: 'testcase',
          sessionId: `mvp-${Date.now()}`, 
          params: {
              text: projectState.documents.prd, // PRD as input
              pictureKeyList: projectState.assets.cdnUrls || (projectState.assets.cdnUrl ? [projectState.assets.cdnUrl] : []),
              isImageSolve: true,
              isImageByte64: true
          }
      });
      
      projectState.documents.testCases = aiRes.answer;
      cachedTestCases.value = aiRes.answer;
      hasGeneratedTestCases.value = true;

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
      const aiRes = await ask({
          code: 'plugin_test_testcase',
          type: 'testcase',
          sessionId: `mvp-${Date.now()}`, // New session
          params: {
              text: projectState.documents.testPoints, // Send Test Points as context
              pictureKeyList: projectState.assets.cdnUrls || (projectState.assets.cdnUrl ? [projectState.assets.cdnUrl] : []), // Optional
              isImageSolve: true,
              isImageByte64: true,
              // Figma link might be useful here if backend supports it, 
              // but standard params only show text/pictureKeyList.
              // I'll append it to text if it exists just in case, or ignore if backend is strict.
              // User instructions say: "modified PRD or Test Points as text".
              // So I will stick to just testPoints.
          }
      });
      
      projectState.documents.testCases = aiRes.answer;
      cachedTestCases.value = aiRes.answer;
      hasGeneratedTestCases.value = true;

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

const uiViewType = ref<'plan' | 'report'>('plan');
const showScreenshotModal = ref(false);
const screenshotList = ref<{filename: string; step: string; base64: string}[]>([]);
const screenshotCount = ref(0);
const previewingScreenshot = ref<{step: string; base64: string} | null>(null);

const toggleUiDoc = (type: 'plan' | 'report') => {
    uiViewType.value = type;
    viewMode.value = 'preview';
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

const sendUiAgentMessage = async () => {
    if (!uiAgentInput.value || isProcessing.value) return;

    // 1. 获取当前标签页 URL
    let currentUrl = '';
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab?.url || '';
    } catch (e) {
        console.warn("无法获取标签页信息");
    }

    const userInput = uiAgentInput.value;
    uiAgentInput.value = '';

    addMessage('user', userInput);
    isProcessing.value = true;
    statusText.value = "🤖 UI 自动化智能体运行中...";

    try {
        // 若用户明确要“执行测试计划/生成报告”，并且右侧计划区有内容，则强制把右侧内容作为 plan 传入
        // 注意：右侧在 auto_test 步骤里通过 activeMainDocContent 绑定 plan/report；这里仅取 plan（避免把 report 误当 plan）
        let planToSend = projectState.documents.uiPlan || '';
        const additionalPrdsToSend = buildAdditionalPrdsForRequest();
        pendingAdditionalPrds.value = [];

        if (shouldExecutePlan(userInput)) {
            // 如果用户显式引用了文档，则优先把“第一个引用文档”作为 plan 执行
            if (additionalPrdsToSend.length > 0) {
                planToSend = additionalPrdsToSend[0].content;
            } else {
                const rightPlan = (uiViewType.value === 'plan' ? (activeMainDocContent.value || '') : (projectState.documents.uiPlan || '')).trim();
                if (rightPlan) planToSend = rightPlan;
            }
        }

        const result = await uiAgent({
            sessionId: uiAgentSessionId.value,
            instruction: userInput,
            url: currentUrl,
            plan: planToSend,
            report: projectState.documents.uiReport,
            headless: isHeadlessMode.value,
            additionalPrds: additionalPrdsToSend
        });

        if (result.status === 'success') {
            // 更新截图数量
            if (result.screenshotCount && result.screenshotCount > 0) {
                screenshotCount.value = result.screenshotCount;
            }
            
            // 更新文档（注意：执行测试计划可能同时返回 plan + report）
            if (result.type === 'report_generated' && result.report) {
                if (result.plan) projectState.documents.uiPlan = result.plan;
                projectState.documents.uiReport = result.report;
                uiViewType.value = 'report';

                const ssInfo = result.screenshotCount ? `\n\n📸 已捕获 ${result.screenshotCount} 张测试截图，点击左侧"查看截图"按钮查看` : '';
                addMessage('ai', `✅ **测试报告已生成！**\n\n${result.response}${ssInfo}\n\n*右侧可查看完整报告*`);
            } else if (result.type === 'plan_generated' && result.plan) {
                projectState.documents.uiPlan = result.plan;
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
            if (result.type === 'plan_generated' || result.type === 'report_generated') {
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

const exportResults = () => {
  const blob = new Blob([projectState.documents.testCases], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solvely-test-cases-${Date.now()}.md`;
  a.click();
  addMessage('ai', '文件已下载。');
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
const URL_REGEX = /(https?:\/\/[^\s]+)/;

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
            const timeout = setTimeout(() => reject(new Error('页面加载超时 (45s)')), 45000);
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
        
        // 5. 合并 DOM 片段
        statusText.value = "正在合并文本...";
        let fullDOM = '';

        for (const seg of domSegments) {
            fullDOM = mergeTextSegments(fullDOM, seg.markdown);
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

const sendPrdAgentMessage = async () => {
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
            
            const aiRes = await ask({
                code: 'plugin_test_testprd',
                type: 'testprd',
                sessionId: projectState.assets.sessionId || `prd-optimize-${Date.now()}`,
                params: {
                    text: contextText,
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
            additionalPrds: buildAdditionalPrdsForRequest()
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

const sendTestCaseAgentMessage = async () => {
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
            const aiRes = await ask({
                code: 'plugin_test_testcase',
                type: 'testcase',
                sessionId: `url-testcase-${Date.now()}`,
                params: {
                    text: extractResult.content,
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
                additionalPrds: buildAdditionalPrdsForRequest()
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
      projectState.documents = { prd: '', optimizedPrd: '', testPoints: '', testCases: '', uiPlan: '', uiReport: '' };
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
  position: relative; /* 用于文档列表侧边栏定位 */
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
</style>
