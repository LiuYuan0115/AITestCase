// https://nuxt.com/docs/api/configuration/nuxt-config
import { minify as terserMinify } from 'terser'

const isProductionBuild = process.env.NODE_ENV === 'production'
const isTestMode = process.env.NUXT_ENV_MODE === 'test'
const shouldDropConsole = isProductionBuild && !isTestMode

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  imports: {
    dirs: ['types']
  },
  modules: ['@nuxtjs/tailwindcss'],
  runtimeConfig: {
    public: {
      mode: process.env.NUXT_ENV_MODE || 'production',
      apiBase:
        process.env.NUXT_ENV_MODE === 'test'
          ? 'https://dev-webserver.solvely.ai'
          : 'https://api-web.solvely.ai'
    }
  },
  css: ['~/assets/css/font-face-declare.min.css'],
  app: {
    head: {
      link: [
        {
          rel: 'icon',
          href: '/favicon.ico?v=1.1'
        }
      ],
      meta: [
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0,user-scalable=no'
        }
      ]
    }
  },
  vite: {
    esbuild: {
      drop: shouldDropConsole ? ['console'] : []
    },
    plugins: [
      {
        name: 'minify-onboarding-innerhtml',
        apply: 'build',
        async transform(code, id) {
          if (
            !(
              id.endsWith('extension-onboarding.vue') ||
              id.includes('/pages/app/extension-onboarding.vue')
            )
          ) {
            return null
          }
          const pattern = /innerHTML:\s*`([\s\S]*?)`,/m
          const match = code.match(pattern)
          if (!match) return null
          const original = match[1]
          const { code: mini } = await terserMinify(original, {
            compress: { drop_console: shouldDropConsole },
            mangle: false,
            format: { comments: false }
          })
          if (!mini) return null
          const next = code.replace(pattern, () => `innerHTML: \`${mini}\`,`)
          return { code: next, map: null }
        }
      }
    ],
    server: {
      proxy: {
        '/api-web/v1': {
          target: 'https://dev.solvely.ai',
          changeOrigin: true
        }
      }
    }
  },
  nitro: {
    routeRules: {
      '/**': { cors: true }
    }
  }
})
