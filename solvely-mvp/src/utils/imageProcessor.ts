/**
 * Image Processor Utility (Simplified for MVP)
 * Handles stitching of screenshot segments.
 */

// 每组最多拼接的图片数量（避免 canvas 过大或解码失败）
const MAX_IMAGES_PER_GROUP = 10;

export class ImageProcessor {
  /**
   * 检查 data URL 是否有效
   */
  private isValidDataUrl(url: string): boolean {
    if (!url || !url.startsWith('data:image')) return false;
    if (!url.includes(',')) return false;
    const content = url.split(',')[1] || '';
    return content.length >= 100; // 至少 100 字符的 base64 内容
  }

  /**
   * Stitches multiple screenshots into groups of long images.
   * Each group contains at most MAX_IMAGES_PER_GROUP screenshots.
   * @param screenshots Array of base64 encoded screenshot strings
   * @returns Promise resolving to an array of base64 strings (one per group)
   */
  async stitchScreenshotsInGroups(screenshots: string[]): Promise<string[]> {
    // 先过滤掉无效的图片
    const validScreenshots = screenshots.filter(s => this.isValidDataUrl(s));
    
    if (!validScreenshots || validScreenshots.length === 0) {
      console.warn('[ImageProcessor] 没有有效的截图可拼接');
      return [];
    }

    if (validScreenshots.length === 1) {
      return [validScreenshots[0]];
    }

    console.log(`[ImageProcessor] 有效截图：${validScreenshots.length}/${screenshots.length}`);

    // 分组
    const groups: string[][] = [];
    for (let i = 0; i < validScreenshots.length; i += MAX_IMAGES_PER_GROUP) {
      groups.push(validScreenshots.slice(i, i + MAX_IMAGES_PER_GROUP));
    }

    console.log(`[ImageProcessor] 分组拼接：${validScreenshots.length} 张图片 → ${groups.length} 组`);

    // 并行拼接各组，收集成功的结果
    const settledResults = await Promise.allSettled(
      groups.map((group, idx) => this.stitchSingleGroup(group, idx))
    );

    const results: string[] = [];
    for (let i = 0; i < settledResults.length; i++) {
      const result = settledResults[i];
      if (result.status === 'fulfilled' && this.isValidDataUrl(result.value)) {
        results.push(result.value);
      } else if (result.status === 'rejected') {
        console.warn(`[ImageProcessor] 组 ${i} 拼接失败:`, result.reason);
      }
    }

    return results;
  }

  /**
   * 拼接单组图片
   */
  private async stitchSingleGroup(screenshots: string[], groupIndex: number): Promise<string> {
    if (screenshots.length === 1) {
      return screenshots[0];
    }

    // 过滤无效的图片（空字符串或格式错误）
    const validScreenshots = screenshots.filter(s => s && s.startsWith('data:image'));
    if (validScreenshots.length === 0) {
      throw new Error(`Group ${groupIndex}: No valid screenshots`);
    }

    // 加载所有图片，跳过加载失败的
    const loadResults = await Promise.allSettled(
      validScreenshots.map((screenshot) => this.loadImage(screenshot))
    );

    const images: HTMLImageElement[] = [];
    for (let i = 0; i < loadResults.length; i++) {
      const result = loadResults[i];
      if (result.status === 'fulfilled') {
        images.push(result.value);
      } else {
        console.warn(`[ImageProcessor] Group ${groupIndex}: 图片 ${i} 加载失败，跳过`);
      }
    }

    if (images.length === 0) {
      throw new Error(`Group ${groupIndex}: All images failed to load`);
    }

    // 使用第一张有效图片的宽度
    const totalWidth = images[0].width;
    const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

    // 检查 canvas 尺寸限制（大多数浏览器限制在 32767 像素）
    const MAX_CANVAS_SIZE = 30000;
    if (totalHeight > MAX_CANVAS_SIZE) {
      console.warn(`[ImageProcessor] Group ${groupIndex}: 高度 ${totalHeight} 超过限制，截断到 ${MAX_CANVAS_SIZE}`);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = totalWidth;
    canvas.height = Math.min(totalHeight, MAX_CANVAS_SIZE);

    let currentY = 0;
    for (const img of images) {
      if (currentY + img.height > canvas.height) {
        // 超出 canvas 高度，停止绘制
        break;
      }
      ctx.drawImage(img, 0, currentY);
      currentY += img.height;
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * 兼容旧接口：拼接为单张图（内部调用分组，返回第一组）
   * @deprecated 建议使用 stitchScreenshotsInGroups
   */
  async stitchScreenshots(screenshots: string[]): Promise<string> {
    const groups = await this.stitchScreenshotsInGroups(screenshots);
    return groups[0] || '';
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`The source image could not be decoded: ${src.substring(0, 50)}...`));
      img.src = src;
    });
  }
}
