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
    version: "0.0.3",
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
    action: {},
    side_panel: {
      default_path: "sidepanel/index.html"
    }
  }
});

