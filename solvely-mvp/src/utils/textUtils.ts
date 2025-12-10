/**
 * 文本处理工具
 */

/**
 * 合并两个可能有重叠内容的文本片段
 * @param previous 上一段文本
 * @param current 当前段文本
 * @param overlapCheckLength 检查重叠的窗口大小
 */
export function mergeTextSegments(previous: string, current: string, overlapCheckLength: number = 500): string {
    if (!previous) return current;
    if (!current) return previous;

    const pLen = previous.length;
    // 取前一段的末尾
    const checkLen = Math.min(pLen, overlapCheckLength);
    const tail = previous.slice(-checkLen);

    // 我们尝试在 current 的开头找到 tail 的后缀
    // 即：tail 的某一部分 === current 的开头某一部分
    
    // 暴力匹配：从 tail 的第一个字符开始，看它是否是 current 的开头
    // 为了效率和准确度，我们要求至少匹配一定长度（比如 20 个字符，或者更少如果本身很短）
    const minMatch = 10; 

    for (let i = 0; i < checkLen - minMatch; i++) {
        const sub = tail.slice(i);
        if (current.startsWith(sub)) {
            // 找到了重叠：previous 的结尾与 current 的开头重叠了 sub
            // 结果是 previous + current 去掉重叠部分
            return previous + current.slice(sub.length);
        }
    }

    // 如果没找到明显的重叠，直接拼接（假设是连续的但没有重复字符，或者是断开的）
    // 为了防止两个段落直接粘连，加换行
    return previous + '\n\n' + current;
}



