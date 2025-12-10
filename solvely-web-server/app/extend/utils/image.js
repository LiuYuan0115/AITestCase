const sharp = require('sharp');
const path = require('path');

/**
 * @typedef {Object} FileObject
 * @property {string} filepath - 文件的完整路径
 * @property {string} mime - 文件的 MIME 类型
 */

/**
 * @typedef {Object} RotateImageResult
 * @property {boolean} success - 操作是否成功
 * @property {FileObject} result - 旋转后的文件对象
 */

/**
 * 旋转图片并保存到临时目录
 *
 * @param {FileObject} file - 包含原始图片信息的文件对象
 * @param {number} rotationDegrees - 旋转角度（正数为顺时针旋转，负数为逆时针旋转）
 * @return {Promise<RotateImageResult>} 返回一个 Promise，其解析值为包含操作状态和旋转后文件信息的对象
 */
const rotateImage = async (file, rotationDegrees) => {
  const filename = path.basename(file.filepath);
  const rotatedFilename = `rotated-${rotationDegrees}-${Date.now()}-${filename}`;
  const rotatedFilePath = path.join('/tmp', rotatedFilename);
  try {
    await sharp(file.filepath).rotate(rotationDegrees).toFile(rotatedFilePath);
    return {
      success: true,
      result: { filepath: rotatedFilePath, mime: file.mime },
    };
  } catch (error) {
    throw error;
  }
};

/**
 * @typedef {Object} MathpixElement
 * @property {string} type - Mathpix 识别出的元素类型 (例如 'diagram', 'chart', 'image')
 * @property {Array<Array<number>>} cnt - 元素的轮廓坐标，格式为一系列 [x, y] 坐标点
 *                                         例如：[[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
 */

/**
 * @typedef {Object} CroppedImageResult
 * @property {string} filepath - 裁剪后生成的图片文件的路径
 * @property {string} originalType - 元素在 Mathpix 中的原始类型 ('diagram', 'chart', 'image')
 * @property {number} index - 元素在源数组中的索引
 */

/**
 * @typedef {Object} CropImageResult
 * @property {boolean} success - 操作是否成功
 * @property {Array<CroppedImageResult>} results - 裁剪结果数组
 */

/**
 * 根据 Mathpix 返回的坐标数据裁剪图片
 * 此函数会筛选出类型为 'diagram', 'chart', 'image' 的元素进行处理
 *
 * @param {FileObject} originalFile - 包含待裁剪图片信息的文件对象 (注意：应传入旋转校正后的图片)
 * @param {Array<MathpixElement>} elementsToCrop - 从 Mathpix API 响应中获取的 'data' 数组过滤后的元素
 * @param {string} [outputDir='/tmp'] - 裁剪后图片的输出目录
 * @return {Promise<CropImageResult>} 返回一个 Promise，其解析值为包含操作状态和裁剪结果数组的对象
 */
const cropImageFromMathpix = async (originalFile, elementsToCrop, outputDir = '/tmp') => {
  try {
    // 1. 创建一个基础的 sharp 实例，它只加载一次图片
    const image = sharp(originalFile.filepath);

    const metadata = await image.metadata();
    const imageWidth = metadata.width;
    const imageHeight = metadata.height;

    if (!imageWidth || !imageHeight) {
      throw new Error(`无法获取图片 '${originalFile.filepath}' 的尺寸，已终止裁剪操作。`);
    }
    console.log(`开始处理图片，实际尺寸: ${imageWidth}w x ${imageHeight}h`);

    if (!elementsToCrop.length) {
      console.log('未找到需要裁剪的元素。');
      return { success: true, results: [] };
    }

    const croppedImageResults = [];
    for (let i = 0; i < elementsToCrop.length; i++) {
      const element = elementsToCrop[i];
      // ... 坐标计算和边界检查逻辑保持不变，因为它们是正确的 ...
      const coordinates = element.cnt;
      if (!coordinates || coordinates.length < 1) {
        console.log(`跳过索引为 ${i} 的元素 (${element.type})：坐标数据缺失或无效。`);
        continue;
      }
      const allX = coordinates.map((p) => p[0]);
      const allY = coordinates.map((p) => p[1]);
      const left = Math.round(Math.min(...allX));
      const top = Math.round(Math.min(...allY));
      let width = Math.round(Math.max(...allX) - left);
      let height = Math.round(Math.max(...allY) - top);

      console.log(`正在处理索引 ${i} (${element.type})，API返回的计算区域:`, {
        left,
        top,
        width,
        height,
      });

      // 边界检查和修正逻辑仍然保留，因为它非常重要
      if (left >= imageWidth || top >= imageHeight) {
        console.log(
          `跳过索引 ${i}：裁剪起始点 (${left}, ${top}) 已在图片边界 (${imageWidth}, ${imageHeight}) 之外。`,
        );
        continue;
      }
      if (left + width > imageWidth) {
        const originalWidth = width;
        width = imageWidth - left;
        console.log(
          `索引 ${i} 的裁剪宽度超出右边界。已将宽度从 ${originalWidth} 修正为 ${width}。`,
        );
      }
      if (top + height > imageHeight) {
        const originalHeight = height;
        height = imageHeight - top;
        console.log(
          `索引 ${i} 的裁剪高度超出下边界。已将高度从 ${originalHeight} 修正为 ${height}。`,
        );
      }
      if (width <= 0 || height <= 0) {
        console.log(`跳过索引 ${i}：修正后的宽度或高度无效 (w:${width}, h:${height})，无法裁剪。`);
        continue;
      }

      const originalFilename = path.basename(originalFile.filepath);
      const croppedFilename = `cropped-${element.type}-${i}-${Date.now()}-${originalFilename}`;
      const croppedFilePath = path.join(outputDir, croppedFilename);

      console.log(`正在执行裁剪，最终区域:`, { left, top, width, height });

      // 2. 【核心修正】: 在每次裁剪前，克隆基础实例以获得一个全新的处理管道
      await image
        .clone() // <---  在这里添加 .clone()，否则在多次切割之后会导致错误
        .extract({ left, top, width, height })
        .toFile(croppedFilePath);

      croppedImageResults.push({
        filepath: croppedFilePath,
        originalType: element.type,
        index: i,
      });

      console.log(`成功将元素 ${i} 裁剪并保存到: ${croppedFilePath}`);
    }

    return croppedImageResults;
  } catch (error) {
    console.log('cropImageFromMathpix 错误:', error);
    return [];
  }
};

module.exports = {
  rotateImage,
  cropImageFromMathpix,
};
