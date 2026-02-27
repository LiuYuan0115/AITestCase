<template>
  <div class="mindmap-container">
    <svg ref="svgRef" class="mindmap-svg"></svg>
    <div class="custom-controls">
        <button class="copy-root-btn" @click="copyRoot" v-tooltip="'复制完整思维导图'">
           <span v-if="isCopied">✅ 已复制</span>
           <span v-else>📋 复制全部</span>
        </button>
    </div>
    <div class="toolbar" ref="toolbarRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { Toolbar } from 'markmap-toolbar';
import 'markmap-toolbar/dist/style.css';
// 注意：已通过使用空插件列表的 Transformer 来避免 CSP 问题
// 不再需要覆盖 markmap-common 的 loadJS/loadCSS 函数

const props = defineProps<{
  content: string;
  type: 'test_point' | 'test_case';
}>();

const svgRef = ref<SVGElement | null>(null);
const toolbarRef = ref<HTMLElement | null>(null);
let markmapInstance: Markmap | null = null;

// 创建 Transformer 时使用空插件列表，避免 CSP 阻止 KaTeX/hljs 等 CDN 资源加载
// 对于测试用例思维导图，我们不需要数学公式和代码高亮功能
const transformer = new Transformer([]);

// Selection State
const selectedNodeData = ref<any>(null);
let selectedNodeElement: Element | null = null;
const currentRoot = ref<any>(null);
const isCopied = ref(false);

const handleSvgClick = (e: MouseEvent) => {
    const target = e.target as Element;
    // Attempt to find the node group
    const nodeGroup = target.closest('.markmap-node');
    
    if (nodeGroup) {
        // Clicked a node
        // D3 binds data to the DOM element property `__data__`
        const data = (nodeGroup as any).__data__; 
        selectNode(nodeGroup, data);
    } else {
        // Clicked background (if not clicking toolbar)
        if (!target.closest('.mm-toolbar') && !target.closest('.custom-controls')) {
            deselectNode();
        }
    }
};

// Keep track of original styles to restore
const originalStyles = new Map<Element, string>();

const selectNode = (el: Element, data: any) => {
    // Deselect previous
    if (selectedNodeElement) {
        restoreNodeStyle(selectedNodeElement);
    }
    
    // Select new
    selectedNodeElement = el;
    selectedNodeData.value = data;
    
    if (selectedNodeElement) {
        highlightNode(selectedNodeElement);
    }
};

const highlightNode = (el: Element) => {
    const shape = el.querySelector('rect, circle, path'); // Node shape is usually a rect, circle or path
    if (shape) {
        // Save original stroke
        const originalStroke = shape.getAttribute('stroke') || '';
        const originalWidth = shape.getAttribute('stroke-width') || '';
        originalStyles.set(el, JSON.stringify({ stroke: originalStroke, width: originalWidth }));
        
        // Apply Highlight
        // We use setAttribute to override D3 styles or CSS
        shape.setAttribute('stroke', '#409eff');
        shape.setAttribute('stroke-width', '4');
        // Optional: Add filter for glow if we can manage definitions, but stroke is safer for now
        (shape as HTMLElement).style.stroke = '#409eff';
        (shape as HTMLElement).style.strokeWidth = '4px';
    }
};

const restoreNodeStyle = (el: Element) => {
    const shape = el.querySelector('rect, circle, path');
    if (shape && originalStyles.has(el)) {
        const styleData = JSON.parse(originalStyles.get(el)!);
        
        if (styleData.stroke) {
            shape.setAttribute('stroke', styleData.stroke);
            (shape as HTMLElement).style.stroke = styleData.stroke;
        } else {
            shape.removeAttribute('stroke');
            (shape as HTMLElement).style.stroke = '';
        }
        
        if (styleData.width) {
            shape.setAttribute('stroke-width', styleData.width);
            (shape as HTMLElement).style.strokeWidth = styleData.width;
        } else {
            shape.removeAttribute('stroke-width');
            (shape as HTMLElement).style.strokeWidth = '';
        }
        
        originalStyles.delete(el);
    }
};

const deselectNode = () => {
    if (selectedNodeElement) {
        restoreNodeStyle(selectedNodeElement);
        selectedNodeElement = null;
    }
    selectedNodeData.value = null;
};

// Helper to unwrap D3 node if necessary (Markmap view wraps data in D3 hierarchy)
const unwrapNode = (node: any) => {
    // Check if it's a D3 node (has data property) or raw Markmap node
    return (node && node.data && typeof node.data.content !== 'undefined') ? node.data : node;
};

const serializeNodeToMarkdown = (node: any, depth = 0): string => {
    const actualNode = unwrapNode(node);
    if (!actualNode) return '';

    const div = document.createElement('div');
    div.innerHTML = actualNode.content || '';
    const text = (div.textContent || actualNode.content || '').trim();
    
    // Format as markdown list item
    let output = `${'  '.repeat(depth)}- ${text}\n`;
    
    // Check children on both d3 node structure and raw node structure
    const children = node.children || actualNode.children;
    if (children && children.length > 0) {
        children.forEach((child: any) => {
            output += serializeNodeToMarkdown(child, depth + 1);
        });
    }
    return output;
};

// Helper to create HTML format (for rich text editors like Feishu)
const serializeNodeToHtml = (node: any): string => {
    const actualNode = unwrapNode(node);
    if (!actualNode) return '';

    const div = document.createElement('div');
    div.innerHTML = actualNode.content || '';
    const text = (div.textContent || actualNode.content || '').trim();
    
    let html = `<ul><li>${text}`;
    
    const children = node.children || actualNode.children;
    if (children && children.length > 0) {
        children.forEach((child: any) => {
            html += serializeNodeToHtml(child); 
        });
    }
    html += `</li></ul>`;
    return html;
};

// Helper for plain text (indentation based)
const serializeNodeToPlainText = (node: any, depth = 0): string => {
    const actualNode = unwrapNode(node);
    if (!actualNode) return '';

    const div = document.createElement('div');
    div.innerHTML = actualNode.content || '';
    const text = (div.textContent || actualNode.content || '').trim();
    
    let output = `${'\t'.repeat(depth)}${text}\n`;
    
    const children = node.children || actualNode.children;
    if (children && children.length > 0) {
        children.forEach((child: any) => {
            output += serializeNodeToPlainText(child, depth + 1);
        });
    }
    return output;
};

const performCopy = async (data: any, visualElement: Element | null = null) => {
    if (!data) return;
    const markdown = serializeNodeToMarkdown(data);
    const html = serializeNodeToHtml(data);
    const plainText = serializeNodeToPlainText(data);
    
    try {
        // Create ClipboardItem with multiple formats
        const clipboardItem = new ClipboardItem({
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
        });
        
        await navigator.clipboard.write([clipboardItem]);
        console.log('Node copied with multiple formats');
        
        // Visual feedback (flash)
        if (visualElement) {
            const shape = visualElement.querySelector('rect, circle, path') as HTMLElement;
            if (shape) {
                const original = shape.style.stroke;
                shape.style.stroke = '#52c41a'; // Success Green
                setTimeout(() => {
                    if (visualElement === selectedNodeElement) { // If still selected
                        shape.style.stroke = '#409eff';
                    } else {
                        shape.style.stroke = original;
                    }
                }, 200);
            }
        }
    } catch (err) {
        console.error('Failed to copy node', err);
        // Fallback to text only
        navigator.clipboard.writeText(plainText);
    }
};

const copyRoot = async () => {
    if (!currentRoot.value) return;
    
    await performCopy(currentRoot.value);
    
    // Show Copied State on Button
    isCopied.value = true;
    setTimeout(() => {
        isCopied.value = false;
    }, 2000);
};

const handleKeyDown = async (e: KeyboardEvent) => {
    // Check for Ctrl+C or Cmd+C
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedNodeData.value) {
            e.preventDefault();
            await performCopy(selectedNodeData.value, selectedNodeElement);
        }
    }
};

const parseTableToTree = (markdown: string): string => {
    const lines = markdown.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 3) return markdown;

    // Identify headers
    const headerLine = lines.find(l => l.includes('|') && !l.includes('---'));
    if (!headerLine) return markdown;

    // Clean headers: remove empty first/last if they exist due to | border
    const rawHeaders = headerLine.split('|').map(h => h.trim());
    // If split gives ["", "ID", "Module", "", ""]
    const headers = rawHeaders.filter(h => h !== '');
    
    const moduleIdx = headers.findIndex(h => h.includes('模块') || h.includes('Module'));
    const titleIdx = headers.findIndex(h => h.includes('标题') || h.includes('Title') || h.includes('用例'));

    if (moduleIdx === -1 || titleIdx === -1) return markdown;

    const dataLines = lines.filter(l => l.includes('|') && !l.includes('---') && l !== headerLine);
    
    // Group by Module
    const tree: Record<string, string[]> = {};

    dataLines.forEach(line => {
        const rawCols = line.split('|').map(c => c.trim());
        const cleanCols = rawCols.filter((_, i) => {
             return true; 
        });
        
        let cols = [...cleanCols];
        if (cols[0] === '') cols.shift();
        if (cols[cols.length-1] === '') cols.pop();
        
        if (cols.length !== headers.length) {
             return;
        }

        const moduleName = cols[moduleIdx] || '通用模块';
        const title = cols[titleIdx] || '未命名用例';
        
        const details: string[] = [];
        headers.forEach((h, i) => {
            if (i !== moduleIdx && i !== titleIdx) {
                const val = (cols[i] || '-').replace(/\n/g, ' ');
                details.push(`- **${h}**: ${val}`);
            }
        });

        if (!tree[moduleName]) tree[moduleName] = [];
        tree[moduleName].push(`### ${title}\n${details.join('\n')}`);
    });

    if (Object.keys(tree).length === 0) return markdown;

    let mdList = `# 测试用例思维导图\n`;
    for (const mod in tree) {
        mdList += `## ${mod}\n`;
        tree[mod].forEach(child => {
            mdList += `${child}\n`;
        });
    }
    
    return mdList;
};

const updateMarkmap = () => {
  if (!svgRef.value || !props.content) return;

  try {
    let markdown = props.content.trim();

    // Clean up: Remove markdown code block wrappers if AI returned them
    if (markdown.startsWith('```')) {
        markdown = markdown.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/, '');
    }

    // Pre-processing
    if (props.type === 'test_case' && markdown.includes('|')) {
        markdown = parseTableToTree(markdown);
    }

    // Fallback for non-table test_case AND test_point
    if (!markdown.startsWith('#')) {
        const title = props.type === 'test_case' ? '测试用例' : '测试点拆解';
        markdown = `# ${title}\n${markdown}`;
    }

    const { root } = transformer.transform(markdown);
    currentRoot.value = root;

    if (markmapInstance) {
      markmapInstance.setData(root);
      markmapInstance.fit();
    } else {
      // 禁用外部资源加载，避免 CSP 阻止 KaTeX CDN
      markmapInstance = Markmap.create(svgRef.value, {
          autoFit: true,
          // fitRatio: 0.95,
          duration: 500,
          embedGlobalCSS: false,  // 不嵌入全局 CSS
      }, root);
    
    if (toolbarRef.value) {
        const { el } = Toolbar.create(markmapInstance);
        el.style.position = 'absolute';
        el.style.bottom = '20px';
        el.style.right = '20px';
        toolbarRef.value.appendChild(el);
    }
  }
  } catch (error) {
    // 忽略 CSP 相关错误（如 KaTeX CDN 加载失败）
    // 思维导图仍然可以正常渲染，只是没有数学公式支持
    console.warn('[MindMapPreview] 渲染时出现非致命错误:', error);
  }
};

watch(() => props.content, updateMarkmap);

onMounted(() => {
    setTimeout(updateMarkmap, 100); // Slight delay to ensure container size
    
    if (svgRef.value) {
        svgRef.value.addEventListener('click', handleSvgClick);
    }
    document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    if (markmapInstance) {
        markmapInstance.destroy();
        markmapInstance = null;
    }
    if (svgRef.value) {
        svgRef.value.removeEventListener('click', handleSvgClick);
    }
    document.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.mindmap-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #fff;
  overflow: hidden;
}
.mindmap-svg {
  width: 100%;
  height: 100%;
}
/* Allow text selection in the mind map */
.mindmap-svg :deep(text), .mindmap-svg :deep(foreignObject) {
    user-select: text;
    cursor: text;
    pointer-events: all; /* Re-enable pointer events so we can select text, but click event bubbles to group */
}

.custom-controls {
    position: absolute;
    bottom: 20px;
    left: 20px;
    z-index: 10;
}

.copy-root-btn {
    background: #fff;
    border: 1px solid #ddd;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
}

.copy-root-btn:hover {
    background: #f5f5f5;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.copy-root-btn:active {
    transform: translateY(1px);
}

/* Removed CSS-based node-selected styling in favor of JS manipulation for reliability */
</style>