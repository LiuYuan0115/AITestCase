var fs = require('fs');
var path = require('path');

// 1. 目标 index.mjs 文件路径（可根据实际路径调整）
var indexMjsPath = path.resolve(
  __dirname,
  '../node_modules/wxt/dist/core/builders/vite/index.mjs'
);

try {
  // 2. 读取文件内容
  var content = fs.readFileSync(indexMjsPath, 'utf-8');

  // 3. 替换所有 -[hash]（包括 .js、.[ext] 等场景）
  //    例如：chunks/[name]-[hash].js => chunks/[name].js
  //          assets/[name]-[hash].[ext] => assets/[name].[ext]
  content = content.replace(/-\[hash\]/g, '');

  // 4. 写回原文件
  fs.writeFileSync(indexMjsPath, content, 'utf-8');
  console.log('已成功移除 index.mjs 中的 -[hash]');
} catch (err) {
  console.error('处理 index.mjs 时出错:', err.message);
  process.exit(1);
} 