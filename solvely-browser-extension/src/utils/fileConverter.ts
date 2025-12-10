/**
 * 文件转换工具
 * 用于处理各种文件格式之间的转换
 */
import SparkMD5 from 'spark-md5'

// 定义哈希结果接口
export interface HashResult {
  combinedHash: string // 十六进制格式的MD5哈希
  base64Hash: string // Base64格式的MD5哈希
}

/**
 * 将base64字符串转换为File对象
 * @param base64Data - base64编码的字符串
 * @param filename - 文件名，默认为"solvely-plugin-image.webp"
 * @param mimeType - 文件MIME类型，默认为"image/webp"
 * @returns 返回转换后的File对象
 */
export function base64ToFile(
  base64Data: string,
  filename: string = 'solvely-plugin-image.webp',
  mimeType: string = 'image/webp'
): File {
  // 移除base64数据URL前缀（如果存在）
  const base64Content = base64Data.replace(/^data:.*;base64,/, '')

  // 将base64解码为二进制字符串
  const binaryString = atob(base64Content)

  // 创建Uint8Array来存储二进制数据
  const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0))

  // 创建Blob并转换为File
  return new File([bytes], filename, { type: mimeType })
}

/**
 * 将File对象转换为base64字符串
 * @param file - 需要转换的File对象
 * @returns 返回base64编码的字符串Promise
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 生成文件的 MD5 哈希值
 * @param file - 需要生成哈希值的文件
 * @returns {Promise<HashResult>} 返回哈希结果
 */
export function generateHashesFromFile(file: File): Promise<HashResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const spark = new SparkMD5.ArrayBuffer() // 初始化 spark-md5

    reader.onload = (e) => {
      try {
        // 一次性计算整个文件的 MD5
        spark.append(e.target?.result as ArrayBuffer)
        const combinedHash = spark.end() // 得到十六进制字符串

        // 手动转换十六进制 -> Base64
        const hexPairs = combinedHash.match(/\w{2}/g) || []
        const bytes = new Uint8Array(hexPairs.map((b) => parseInt(b, 16)))
        const base64Hash = btoa(String.fromCharCode(...bytes))

        resolve({ combinedHash, base64Hash })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = reject
    reader.readAsArrayBuffer(file) // 直接读取整个文件
  })
}

/**
 * 直接从base64字符串生成哈希
 * @param base64String - base64编码的字符串
 * @returns {Promise<HashResult>} 返回哈希结果
 */
export function generateHashesFromBase64(base64String: string): Promise<HashResult> {
  return new Promise((resolve, reject) => {
    try {
      // 验证输入参数
      if (!base64String || typeof base64String !== 'string') {
        throw new Error('Invalid base64String: must be a non-empty string')
      }

      // 处理可能的data URL格式
      const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String

      // 解码base64为二进制字符串
      const binaryString = atob(base64Data)

      // 创建二进制数组
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // 计算MD5哈希
      const spark = new SparkMD5.ArrayBuffer()
      spark.append(bytes.buffer)
      const combinedHash = spark.end() // 十六进制哈希

      // 转换为Base64格式
      const hexPairs = combinedHash.match(/\w{2}/g) || []
      const hashBytes = new Uint8Array(hexPairs.map((b) => parseInt(b, 16)))
      const base64Hash = btoa(
        Array.from(hashBytes)
          .map((b) => String.fromCharCode(b))
          .join('')
      )

      resolve({ combinedHash, base64Hash })
    } catch (error) {
      console.error('生成哈希失败', error)
      reject(error)
    }
  })
}

/**
 * 将base64字符串转换为Blob对象
 * @param base64String - base64编码的字符串
 * @param fileType - 文件类型，例如"image/webp"
 * @returns 返回转换后的Blob对象
 */
export function convertBase64ToBlob(base64String: string, fileType: string = 'image/webp'): Blob {
  // 将 base64 转换为 Blob
  const base64Content = base64String.replace(/^data:image\/\w+;base64,/, '')
  const binaryString = atob(base64Content)
  const bytes = new Uint8Array(binaryString.length)

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  // 创建 Blob
  return new Blob([bytes], { type: fileType })
}

/**
 * 根据文件头（魔术字节）推断图片类型
 * @param arrayBuffer - 文件的 ArrayBuffer
 * @returns MIME 类型
 */
function detectImageTypeFromBytes(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer)

  // PNG: 89 50 4E 47
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  // GIF: 47 49 46
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif'
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  // 默认返回 PNG
  return 'image/png'
}

// 下载图片并转换为base64
export async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl)
    const blob = await response.blob()

    // 获取响应的 Content-Type
    let contentType = response.headers.get('Content-Type') || blob.type

    // 如果 Content-Type 不是有效的图片类型，通过文件头推断
    if (!contentType || contentType === 'application/octet-stream' || !contentType.startsWith('image/')) {
      // 读取文件头来推断类型
      const arrayBuffer = await blob.arrayBuffer()
      contentType = detectImageTypeFromBytes(arrayBuffer)

      // 使用正确的 MIME 类型创建新的 Blob
      const correctBlob = new Blob([arrayBuffer], { type: contentType })

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(correctBlob)
      })
    }

    // 如果 Content-Type 已经是有效的图片类型，直接使用
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('下载图片失败:', error)
    throw error
  }
}
