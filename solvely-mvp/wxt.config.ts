import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: 'src',
  outDir: '.output',
  zip: {
    artifactTemplate: 'AITestCase-{{version}}-{{browser}}.zip'
  },
  manifest: {
    name: "AI Test Case",
    description: "Automated PRD & Test Case Analysis",
    version: "0.0.4",
    // 插件图标（占位资源：可用图四同名覆盖 `public/icons/logo.svg`）
    icons: {
      "16": "icons/logo.svg",
      "32": "icons/logo.svg",
      "48": "icons/logo.svg",
      "128": "icons/logo.svg"
    },
    permissions: [
      "activeTab",
      "scripting", 
      "sidePanel",
      "storage",
      "tabs"
    ],
    host_permissions: [
      "<all_urls>"
    ],
    action: {
      // 工具栏图标（与 `icons` 保持一致）
      default_icon: {
        "16": "icons/logo.svg",
        "32": "icons/logo.svg",
        "48": "icons/logo.svg",
        "128": "icons/logo.svg"
      }
    },
    side_panel: {
      default_path: "sidepanel/index.html"
    }
  }
});

