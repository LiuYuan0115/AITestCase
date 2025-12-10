/**
 * Image Processor Utility (Simplified for MVP)
 * Handles stitching of screenshot segments.
 */
export class ImageProcessor {
  /**
   * Stitches multiple screenshots into a single long image.
   * @param screenshots Array of base64 encoded screenshot strings
   * @returns Promise resolving to the base64 string of the stitched image
   */
  async stitchScreenshots(screenshots: string[]): Promise<string> {
    if (!screenshots || screenshots.length === 0) {
      throw new Error('No screenshots provided for stitching');
    }

    if (screenshots.length === 1) {
      return screenshots[0];
    }

    // Load all images to get dimensions
    const images = await Promise.all(
      screenshots.map((screenshot) => this.loadImage(screenshot))
    );

    // Assume consistent width (viewport width)
    const totalWidth = images[0].width;
    
    // Calculate total height. 
    const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    let currentY = 0;
    for (const img of images) {
      ctx.drawImage(img, 0, currentY);
      currentY += img.height;
    }

    return canvas.toDataURL('image/png');
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}
