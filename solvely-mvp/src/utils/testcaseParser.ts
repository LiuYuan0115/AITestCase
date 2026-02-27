/**
 * 测试用例解析器 — 打通 Step 4 → Step 5 (Midscene) 管道
 *
 * 将 Step 4 生成的 YAML / Table / XMind 格式测试用例
 * 解析为结构化的 MidsceneTestCase[] 供 Midscene 引擎直接执行。
 */

import type { MidsceneTestCase } from '@/api';

export type TestCaseFormat = 'xmind' | 'table' | 'yaml';

/**
 * 根据格式自动解析测试用例文本为 MidsceneTestCase[]
 *
 * 解析策略：先按指定格式解析，若结果为空则自动尝试其他所有格式（含简单 YAML）
 */
export function parseTestCases(rawContent: string, format: TestCaseFormat): MidsceneTestCase[] {
    if (!rawContent || !rawContent.trim()) return [];

    // 先按用户选择的格式解析
    let result: MidsceneTestCase[] = [];
    switch (format) {
        case 'yaml':
            result = parseYamlTestCases(rawContent);
            break;
        case 'table':
            result = parseTableTestCases(rawContent);
            break;
        case 'xmind':
        default:
            result = parseXmindTestCases(rawContent);
            break;
    }

    // 若指定格式解析为空，自动尝试其他格式（兼容手动输入）
    if (result.length === 0) {
        const fallbackParsers = [
            parseSimpleYamlTestCases,  // 简单 YAML（手动输入友好）
            parseYamlTestCases,
            parseTableTestCases,
            parseXmindTestCases,
        ];
        for (const parser of fallbackParsers) {
            result = parser(rawContent);
            if (result.length > 0) break;
        }
    }

    return result;
}

// ==================== 简单 YAML 格式（手动输入友好） ====================
// 用户直接手写的平铺格式，支持多种字段名：
//   - id: TC-001
//     name: 登录测试           （或 title）
//     scenario: 测试登录流程     （可选）
//     steps:
//       - 在用户名输入框中输入admin
//       - 在密码输入框中输入123456
//       - 点击登录按钮
//     expectedResults:          （或 expected / assertions）
//       - 页面跳转到首页
//     preconditions: 已注册账号  （可选）
//     priority: P0              （可选）

function parseSimpleYamlTestCases(raw: string): MidsceneTestCase[] {
    const cases: MidsceneTestCase[] = [];

    // 去掉 code block 包裹
    let content = raw;
    const codeBlockMatch = raw.match(/```(?:ya?ml)?\s*\n([\s\S]*?)```/);
    if (codeBlockMatch) content = codeBlockMatch[1];

    // 按 "- id:" 或 "- name:" 或 "- title:" 拆分为独立块
    const blockPattern = /^[\t ]*-\s+(?:id|name|title)\s*:/m;
    if (!blockPattern.test(content)) return cases;

    const lines = content.split('\n');
    const blocks: string[][] = [];
    let currentBlock: string[] = [];

    for (const line of lines) {
        // 检测新用例块的开始
        if (/^\s*-\s+(?:id|name|title)\s*:/.test(line)) {
            if (currentBlock.length > 0) blocks.push(currentBlock);
            currentBlock = [line];
        } else if (currentBlock.length > 0) {
            currentBlock.push(line);
        }
    }
    if (currentBlock.length > 0) blocks.push(currentBlock);

    for (const blockLines of blocks) {
        const block = blockLines.join('\n');

        // 提取字段（支持 YAML 列表项前缀 "- "）
        const getField = (names: string[]): string => {
            for (const name of names) {
                // 匹配 "  name: value" 或 "- name: value"
                const match = block.match(new RegExp(`(?:^|\\n)\\s*-?\\s*${name}\\s*:\\s*(.+)`, 'i'));
                if (match) return match[1].trim().replace(/^["']|["']$/g, '');
            }
            return '';
        };

        // 提取列表字段
        const getList = (names: string[]): string[] => {
            const items: string[] = [];
            for (const name of names) {
                const listMatch = block.match(new RegExp(`${name}\\s*:\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\w+\\s*:|$)`, 'i'));
                if (listMatch) {
                    const listContent = listMatch[1];
                    for (const m of listContent.matchAll(/^\s*-\s+["']?(.+?)["']?\s*$/gm)) {
                        items.push(m[1].trim());
                    }
                    if (items.length > 0) break;
                }
            }
            return items;
        };

        const id = getField(['id']) || `TC-${String(cases.length + 1).padStart(3, '0')}`;
        const name = getField(['name', 'title']);
        const scenario = getField(['scenario']);
        const preconditions = getField(['preconditions', 'precondition']);
        const priority = getField(['priority']);
        const steps = getList(['steps', 'step']);
        const expectedResults = getList(['expectedResults', 'expected', 'assertions', 'expectedresults']);

        if (!name && steps.length === 0) continue;

        cases.push({
            id,
            name: name || id,
            scenario: scenario || (steps.length > 0 ? steps.join(', then ') : name),
            expectedResults,
            preconditions,
            priority,
            steps: steps.length > 0 ? steps : undefined,
        });
    }

    return cases;
}


// ==================== YAML 格式（AI 生成的嵌套结构） ====================
// 结构: metadata → modules[] → test_points[] → checkpoints[] → scenarios[]

function parseYamlTestCases(raw: string): MidsceneTestCase[] {
    const cases: MidsceneTestCase[] = [];

    // 提取 YAML code block content if wrapped in ```yaml
    let content = raw;
    const yamlBlockMatch = raw.match(/```ya?ml\s*\n([\s\S]*?)```/);
    if (yamlBlockMatch) {
        content = yamlBlockMatch[1];
    }

    // Simple YAML parser for our specific structure
    // Parse scenarios by finding id/title/priority/steps/expected/preconditions patterns
    const scenarioBlocks = splitYamlScenarios(content);

    for (const block of scenarioBlocks) {
        const id = extractYamlField(block, 'id') || `TC-${String(cases.length + 1).padStart(3, '0')}`;
        const title = extractYamlField(block, 'title') || '';
        const priority = extractYamlField(block, 'priority') || '';
        const preconditions = extractYamlList(block, 'preconditions');
        const steps = extractYamlSteps(block);
        const expected = extractYamlList(block, 'expected');

        if (!title && !steps.length) continue;

        // 清理步骤文本（去掉编号前缀）
        const cleanedSteps = steps.map(s => s.replace(/^\d+\.\s*/, ''));

        // Build scenario from steps (natural language for aiAct)
        const scenario = cleanedSteps.length > 0
            ? cleanedSteps.join(', then ')
            : title;

        cases.push({
            id,
            name: title || id,
            scenario,
            expectedResults: expected,
            preconditions: preconditions.join('; '),
            priority,
            // ★ 新增：保留独立步骤列表（供混合模式和自由模式降级使用）
            steps: cleanedSteps.length > 0 ? cleanedSteps : undefined,
        });
    }

    return cases;
}

function splitYamlScenarios(content: string): string[] {
    const blocks: string[] = [];
    const lines = content.split('\n');
    let currentBlock: string[] = [];
    let inScenario = false;

    for (const line of lines) {
        // Detect scenario start: "- id:" or indented "id:" after "scenarios:"
        if (/^\s*-\s+id:\s/.test(line) || (/^\s+id:\s/.test(line) && inScenario)) {
            if (currentBlock.length > 0 && inScenario) {
                blocks.push(currentBlock.join('\n'));
            }
            currentBlock = [line];
            inScenario = true;
        } else if (inScenario) {
            currentBlock.push(line);
        }
        // Detect scenarios section start
        if (/^\s*scenarios:\s*$/.test(line)) {
            inScenario = true;
        }
    }
    if (currentBlock.length > 0 && inScenario) {
        blocks.push(currentBlock.join('\n'));
    }

    return blocks;
}

function extractYamlField(block: string, field: string): string {
    const match = block.match(new RegExp(`${field}:\\s*"?([^"\\n]+)"?`));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
}

function extractYamlList(block: string, field: string): string[] {
    const items: string[] = [];
    const fieldMatch = block.match(new RegExp(`${field}:\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\w+:|$)`));
    if (!fieldMatch) return items;

    const listContent = fieldMatch[1];
    const listMatches = listContent.matchAll(/^\s*-\s+"?([^"\\n]+)"?\s*$/gm);
    for (const m of listMatches) {
        items.push(m[1].trim().replace(/^["']|["']$/g, ''));
    }
    return items;
}

function extractYamlSteps(block: string): string[] {
    const steps: string[] = [];
    const stepsMatch = block.match(/steps:\s*\n([\s\S]*?)(?=\n\s*expected:|\n\s*tags:|\n\s*-\s+id:|\n\s*$)/);
    if (!stepsMatch) return steps;

    const stepsContent = stepsMatch[1];
    // 按 "- step:" 拆分为独立 step block，同时提取 action 和 data
    const stepBlocks = stepsContent.split(/(?=^\s*-\s+step\s*:)/m).filter(b => b.trim());

    for (const stepBlock of stepBlocks) {
        const actionMatch = stepBlock.match(/action:\s*"?([^"\n]+)"?/);
        if (!actionMatch) continue;
        const action = actionMatch[1].trim().replace(/^["']|["']$/g, '');

        // 提取 data 字段（向后兼容旧格式 YAML）
        const dataMatch = stepBlock.match(/data:\s*"?([^"\n]+)"?/);
        const data = dataMatch ? dataMatch[1].trim().replace(/^["']|["']$/g, '') : '';

        steps.push(data ? mergeActionAndData(action, data) : action);
    }
    return steps;
}

/**
 * 将 YAML 的 action + data 合并为 step-inference 可识别的格式（向后兼容）
 *
 * 输入动词: "输入X" + "Y" → "在X中输入\"Y\""  (命中 step-inference Pattern A1, confidence 0.95)
 * 非输入动词: 保持 action 原文（data 是上下文，不影响操作）
 */
function mergeActionAndData(action: string, data: string): string {
    const inputWithTarget = /^(?:在|到)(.+?)(?:中|里|内)?(?:输入|填写|填入|键入|录入|写入)/;
    const inputVerbsCN = /^(输入|填写|填入|键入|录入|写入)/;
    const inputVerbsEN = /^(type|enter|input|fill)\b/i;

    // 已有"在X中输入Y"格式 → 用 data 替换 Y
    const targetMatch = action.match(inputWithTarget);
    if (targetMatch) {
        return `在${targetMatch[1].trim()}中输入"${data}"`;
    }

    // "输入X" → "在X中输入\"data\""
    if (inputVerbsCN.test(action)) {
        const target = action.replace(inputVerbsCN, '').trim();
        return target ? `在${target}中输入"${data}"` : `输入"${data}"`;
    }

    // "type X" → "type \"data\" in X"
    if (inputVerbsEN.test(action)) {
        const rest = action.replace(inputVerbsEN, '').trim();
        return rest ? `type "${data}" in ${rest}` : `type "${data}"`;
    }

    // 非输入动词（点击/滚动等），data 是上下文，不改 action
    return action;
}


// ==================== Table 格式 ====================
// 列: ID | Module | Functional Test Point | Verification Point | Test Case Scenario | Preconditions | Operation Steps | Expected Results | Priority

function parseTableTestCases(raw: string): MidsceneTestCase[] {
    const cases: MidsceneTestCase[] = [];
    const lines = raw.split('\n');

    // Find header row and determine column indices
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && (
            line.includes('ID') || line.includes('id') ||
            line.includes('场景') || line.includes('模块')
        )) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx === -1) return cases;

    const headerCells = parseTableRow(lines[headerIdx]);
    const colMap = detectTableColumns(headerCells);

    // Parse data rows (skip header and separator)
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('|') || /^\|[\s-:|]+\|$/.test(line)) continue;

        const cells = parseTableRow(line);
        if (cells.length < 3) continue;

        const cell = (idx: number) => idx < cells.length ? cells[idx] : '';
        const id = cell(colMap.id) || `TC-${String(cases.length + 1).padStart(3, '0')}`;
        const name = cell(colMap.scenario) || cell(colMap.checkpoint) || '';
        const stepsRaw = cell(colMap.steps) || '';
        const expectedRaw = cell(colMap.expected) || '';
        const preconditions = cell(colMap.preconditions) || '';
        const priority = cell(colMap.priority) || '';

        if (!name && !stepsRaw) continue;

        // ★ 解析独立步骤列表：支持 "1.xxx 2.xxx" 或 "xxx;xxx" 格式
        const stepsList = stepsRaw
            ? stepsRaw.split(/[;；]|\d+\.\s*/).map(s => s.trim()).filter(Boolean)
            : [];

        // Parse operation steps for scenario (拼接版本，自由模式兜底用)
        const scenario = stepsList.length > 0
            ? stepsList.join(', then ')
            : name;

        // Parse expected results: semicolon-separated
        const expectedResults = expectedRaw
            ? expectedRaw.split(/[;；]/).map(s => s.trim()).filter(Boolean)
            : [];

        cases.push({
            id: id.trim(),
            name: name.trim(),
            scenario: scenario.trim(),
            expectedResults,
            preconditions: preconditions.trim(),
            priority: priority.trim(),
            // ★ 新增：保留独立步骤列表
            steps: stepsList.length > 0 ? stepsList : undefined,
        });
    }

    return cases;
}

function parseTableRow(line: string): string[] {
    return line.split('|')
        .map(cell => cell.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1); // Remove empty first/last
}

function detectTableColumns(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {
        id: 0, module: 1, testpoint: 2, checkpoint: 3,
        scenario: 4, preconditions: 5, steps: 6, expected: 7, priority: 8
    };

    for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase();
        if (h.includes('id') || h === '编号') map.id = i;
        else if (h.includes('模块') || h.includes('module')) map.module = i;
        else if (h.includes('测试点') || h.includes('test point')) map.testpoint = i;
        else if (h.includes('验证点') || h.includes('checkpoint') || h.includes('verification')) map.checkpoint = i;
        else if (h.includes('场景') || h.includes('scenario') || h.includes('用例')) map.scenario = i;
        else if (h.includes('前置') || h.includes('precondition')) map.preconditions = i;
        else if (h.includes('步骤') || h.includes('step') || h.includes('操作')) map.steps = i;
        else if (h.includes('预期') || h.includes('expected') || h.includes('结果')) map.expected = i;
        else if (h.includes('优先') || h.includes('priority') || h.includes('级别')) map.priority = i;
    }

    return map;
}


// ==================== XMind 格式 ====================
// H1-H6 层级 Markdown:
//   # Title (H1)
//   ## Module (H2)
//   ### Feature (H3)
//   #### Checkpoint (H4)
//   ##### Scenario (H5)
//   ###### Expected Results (H6) + bullet points

function parseXmindTestCases(raw: string): MidsceneTestCase[] {
    const cases: MidsceneTestCase[] = [];
    const lines = raw.split('\n');

    let currentModule = '';
    let currentFeature = '';
    let currentCheckpoint = '';
    let currentScenario = '';
    let collectingExpected = false;
    let expectedResults: string[] = [];
    let caseCounter = 0;

    const flushCase = () => {
        if (currentScenario) {
            caseCounter++;
            const id = `TC-${String(caseCounter).padStart(3, '0')}`;
            // Build scenario from context path
            const contextParts = [currentModule, currentFeature, currentCheckpoint].filter(Boolean);
            const scenario = contextParts.length > 0
                ? `${contextParts.join(' > ')}: ${currentScenario}`
                : currentScenario;

            cases.push({
                id,
                name: currentScenario,
                scenario,
                expectedResults: [...expectedResults],
                preconditions: '',
                priority: '',
                // ★ XMind 格式通常只有 scenario 没有分步，steps 为 [scenario]
                steps: [currentScenario],
            });
        }
        expectedResults = [];
        collectingExpected = false;
    };

    for (const line of lines) {
        const trimmed = line.trim();

        // H2: Module
        if (/^##\s+(?!#)/.test(trimmed)) {
            flushCase();
            currentModule = trimmed.replace(/^##\s+/, '').trim();
            currentFeature = '';
            currentCheckpoint = '';
            currentScenario = '';
        }
        // H3: Feature
        else if (/^###\s+(?!#)/.test(trimmed)) {
            flushCase();
            currentFeature = trimmed.replace(/^###\s+/, '').trim();
            currentCheckpoint = '';
            currentScenario = '';
        }
        // H4: Checkpoint
        else if (/^####\s+(?!#)/.test(trimmed)) {
            flushCase();
            currentCheckpoint = trimmed.replace(/^####\s+/, '').trim();
            currentScenario = '';
        }
        // H5: Scenario (test case name)
        else if (/^#####\s+(?!#)/.test(trimmed)) {
            flushCase();
            currentScenario = trimmed.replace(/^#####\s+/, '').trim();
        }
        // H6: Expected Results header
        else if (/^######\s+/.test(trimmed)) {
            collectingExpected = true;
        }
        // Bullet points under H6
        else if (collectingExpected && /^[-*]\s+/.test(trimmed)) {
            const result = trimmed.replace(/^[-*]\s+/, '').trim();
            if (result) expectedResults.push(result);
        }
        // Non-header, non-bullet: stop collecting expected results
        else if (collectingExpected && trimmed !== '' && !/^[-*]\s/.test(trimmed)) {
            collectingExpected = false;
        }
    }

    // Flush last case
    flushCase();

    return cases;
}
