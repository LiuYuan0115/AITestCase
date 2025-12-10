import { defineNuxtPlugin } from '#app'
import { $fetch } from 'ofetch'
import { STORAGE_KEYS } from '~/config/storage'

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig()
  const apiBase = runtimeConfig.public.apiBase

  const api = $fetch.create({
    baseURL: apiBase,
    // 设置默认 headers
    headers: {
      'Content-Type': 'application/json'
    },
    // 可以添加请求拦截器，用于处理动态的 Token 或其他逻辑
    onRequest({ request, options }) {
      console.log('[fetch request]', request, options)
      // 每次请求时动态获取最新的 token
      const token = process.client ? window.localStorage.getItem(STORAGE_KEYS.TOKEN) : null

      if (token) {
        // 正确的方式是直接设置到 headers 对象上
        options.headers = new Headers(options.headers)
        options.headers.set('Authorization', `Bearer ${token}`)
      }
    },
    onResponse({ request, response }) {
      console.log('[fetch response]', request, response.status, response._data)
    },
    onResponseError({ request, response }) {
      console.error('[fetch response error]', request, response.status, response._data)
    }
  })

  nuxtApp.provide('api', api)
})
