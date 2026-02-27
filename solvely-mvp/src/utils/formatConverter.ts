/**
 * 格式转换工具 - 将 Markdown 测试用例转换为其他格式
 */

export interface TestCaseItem {
  module: string;
  feature: string;
  checkpoint: string;
  scenario: string;
  expectedResults: string[];
}

/**
 * 解析 Markdown H1-H6 结构为结构化数据
 */
export function parseMarkdownToStructure(
  content: string,
  contentType: 'testcase' | 'testpoint' | 'prd' = 'testcase'
): TestCaseItem[] {
  const items: TestCaseItem[] = [];
  let current: Partial<TestCaseItem> = {};
  let currentModule = '';
  let currentFeature = '';
  let currentCheckpoint = '';

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      currentModule = trimmed.slice(3).trim();
    } else if (trimmed.startsWith('### ')) {
      currentFeature = trimmed.slice(4).trim();
    } else if (trimmed.startsWith('#### ')) {
      currentCheckpoint = trimmed.slice(5).trim();
    } else if (trimmed.startsWith('##### ')) {
      if (current.scenario) {
        items.push(current as TestCaseItem);
      }
      current = {
        module: currentModule,
        feature: currentFeature,
        checkpoint: currentCheckpoint,
        scenario: trimmed.slice(6).trim(),
        expectedResults: [],
      };
    } else if (trimmed.startsWith('- ') && current.scenario) {
      current.expectedResults = current.expectedResults || [];
      current.expectedResults.push(trimmed.slice(2).trim());
    }
  }

  if (current.scenario) {
    items.push(current as TestCaseItem);
  }

  return items;
}

/**
 * 转换为 Markdown 表格
 */
export function convertToTable(
  content: string,
  contentType: 'testcase' | 'testpoint' | 'prd' = 'testcase'
): string {
  const items = parseMarkdownToStructure(content, contentType);

  if (items.length === 0) {
    return '| 无数据 |\n|---|';
  }

  const headers = ['模块', '功能点', '验证点', '用例场景', '预期结果'];
  let table = `| ${headers.join(' | ')} |\n`;
  table += `| ${headers.map(() => '---').join(' | ')} |\n`;

  for (const item of items) {
    const expected = item.expectedResults.join('; ');
    const row = [
      item.module,
      item.feature,
      item.checkpoint,
      item.scenario,
      expected,
    ].map((cell) => cell.replace(/\|/g, '\\|').replace(/\n/g, ' '));
    table += `| ${row.join(' | ')} |\n`;
  }

  return table;
}

/**
 * 转换为 YAML
 */
export function convertToYaml(
  content: string,
  contentType: 'testcase' | 'testpoint' | 'prd' = 'testcase'
): string {
  const items = parseMarkdownToStructure(content, contentType);

  let yaml = 'testcases:\n';
  for (const item of items) {
    yaml += `  - module: "${escapeYamlString(item.module)}"\n`;
    yaml += `    feature: "${escapeYamlString(item.feature)}"\n`;
    yaml += `    checkpoint: "${escapeYamlString(item.checkpoint)}"\n`;
    yaml += `    scenario: "${escapeYamlString(item.scenario)}"\n`;
    yaml += `    expected_results:\n`;
    for (const result of item.expectedResults) {
      yaml += `      - "${escapeYamlString(result)}"\n`;
    }
  }

  return yaml;
}

/**
 * 转换为 JSON
 */
export function convertToJson(
  content: string,
  contentType: 'testcase' | 'testpoint' | 'prd' = 'testcase'
): string {
  const items = parseMarkdownToStructure(content, contentType);
  return JSON.stringify({ testcases: items }, null, 2);
}

/**
 * 转换为 CSV（Excel 兼容）
 * 使用 UTF-8 BOM 确保中文在 Excel 中正确显示
 */
export function convertToCSV(
  content: string,
  contentType: 'testcase' | 'testpoint' | 'prd' = 'testcase'
): string {
  const items = parseMarkdownToStructure(content, contentType);

  if (items.length === 0) {
    return '\uFEFF模块,功能点,验证点,用例场景,预期结果\n';
  }

  const headers = ['模块', '功能点', '验证点', '用例场景', '预期结果'];
  // 添加 UTF-8 BOM 以确保 Excel 正确识别编码
  let csv = '\uFEFF' + headers.join(',') + '\n';

  for (const item of items) {
    const row = [
      item.module,
      item.feature,
      item.checkpoint,
      item.scenario,
      item.expectedResults.join('; '),
    ].map((cell) => escapeCsvCell(cell));
    csv += row.join(',') + '\n';
  }

  return csv;
}

/**
 * 转义 CSV 单元格内容
 * - 包含逗号、双引号、换行符的内容需要用双引号包裹
 * - 双引号需要转义为两个双引号
 */
function escapeCsvCell(cell: string): string {
  if (!cell) return '""';
  // 如果包含特殊字符，需要用双引号包裹并转义内部双引号
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return `"${cell}"`;
}

/**
 * 转义 YAML 字符串
 */
function escapeYamlString(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * 根据格式类型转换内容
 */
export function formatContent(
  content: string,
  format: 'markdown' | 'table' | 'yaml' | 'json' | 'mindmap',
  contentType: 'testcase' | 'testpoint' | 'prd' = 'testcase'
): string {
  switch (format) {
    case 'table':
      return convertToTable(content, contentType);
    case 'yaml':
      return convertToYaml(content, contentType);
    case 'json':
      return convertToJson(content, contentType);
    case 'markdown':
    case 'mindmap':
    default:
      return content;
  }
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(format: string): string {
  const extMap: Record<string, string> = {
    yaml: 'yaml',
    json: 'json',
    table: 'md',
    markdown: 'md',
    mindmap: 'md',
    csv: 'csv',
  };
  return extMap[format] || 'txt';
}

/**
 * 获取 MIME 类型
 */
export function getMimeType(format: string): string {
  const mimeMap: Record<string, string> = {
    yaml: 'application/x-yaml',
    json: 'application/json',
    table: 'text/markdown',
    markdown: 'text/markdown',
    mindmap: 'text/markdown',
    csv: 'text/csv;charset=utf-8',
  };
  return mimeMap[format] || 'text/plain';
}
