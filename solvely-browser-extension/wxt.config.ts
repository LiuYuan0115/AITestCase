// wxt.config.ts
import { defineConfig, defineRunnerConfig } from 'wxt'
import svgLoader from 'vite-svg-loader'
import strip from '@rollup/plugin-strip'

// 从环境变量获取 zip 文件名前缀（如果设置了 ZIP_PREFIX）
const zipPrefix = process.env.ZIP_PREFIX || ''

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  publicDir: 'static',
  zip: {
    // 自定义 zip 文件名模板
    // 如果设置了 ZIP_PREFIX 环境变量，会在文件名前添加前缀
    // 模板变量：{{name}}, {{browser}}, {{version}}, {{mode}}, {{manifestVersion}}
    artifactTemplate: zipPrefix ? `${zipPrefix}-{{version}}-{{browser}}.zip` : '{{name}}-{{version}}-{{browser}}.zip',
  },
  hooks: {
    // 生产构建时过滤掉调试工具 entrypoint
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.mode === 'production') {
        // 就地过滤，移除 abtest-debug
        const index = entrypoints.findIndex((e) => e.name.includes('abtest-debug'))
        if (index !== -1) {
          entrypoints.splice(index, 1)
        }
      }
    },
  },
  manifest: {
    name: 'SolvelyAI - AI Homework Tutor &  Study Helper',
    description:
      'SolvelyAI is your AI Homework Helper—instant screenshot solving, step-by-step AI Answers, AI Summary, and Study Helper tools.',
    host_permissions: ['<all_urls>'],
    permissions: [
      'storage',
      'activeTab',
      'tabs',
      'offscreen',
      'scripting',
      'webRequest',
      // 'webRequestBlocking'
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: ['sandbox.html', 'sandbox/*', 'offscreen.html', 'offscreen/*'],
        matches: ['<all_urls>'],
      },
    ],
  },
  vite: (env) => ({
    plugins: [
      svgLoader({
        svgo: false,
      }),
    ],
    server: {
      host: '0.0.0.0',
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      proxy: {
        '/api-web/v1': {
          target: 'https://dev.solvely.ai',
          changeOrigin: true,
        },
      },
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: env.mode === 'production',
        },
      },
    },
  }),
})
export const runner = defineRunnerConfig({
  disabled: true,
  // 设置chrome数据目录，目前只有基于Chromium的浏览器支持
  // BUG：当指定了下面的配置，会引发 Error: connect ECONNREFUSED 127.0.0.1:50118 at TCPConnectWrap.afterConnect [as oncomplete]
  // chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  startUrls: ['https://www.baidu.com'],
  openDevtools: true,
  // binaries: {
  //   edge: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  //   chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // },
})
