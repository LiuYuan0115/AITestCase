import fs from 'fs'
import path from 'path'

// 静态文件目录(生成的dist或.output/public目录)
const distDir = path.resolve(process.cwd(), '.output/public')

// 处理目录
function processDirectory(dir) {
  const files = fs.readdirSync(dir)

  files.forEach((file) => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      // 检查是否有index.html
      const indexPath = path.join(filePath, 'index.html')
      if (fs.existsSync(indexPath)) {
        // 创建非斜杠版本的HTML文件
        const newPath = dir + '/' + file + '.html'
        fs.copyFileSync(indexPath, newPath)
        console.log(`Created: ${newPath}`)
      }

      // 递归处理子目录
      processDirectory(filePath)
    }
  })
}

// 开始处理
processDirectory(distDir)
console.log('Post-build processing completed!')
