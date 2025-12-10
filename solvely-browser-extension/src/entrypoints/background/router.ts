import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import axios from 'axios'
import {
  gotoSolvelyToSolveQuestion,
  gotoSolvelyToSolveQuestionWithoutLogin,
} from '~/entrypoints/background/service/screenshot'
import {
  getUserAndSubscriptionInfo,
  isLogin,
  saveDataFromSolvely,
  getSubscriptionStatus,
  getUserBalance,
  getUserExtendInfo,
  getToken,
  getUser,
  getUserId,
} from '~/entrypoints/background/service/datasync'
import { getPluginUuid } from '~/utils/pluginUuid'
import { uploadService } from '~/entrypoints/background/service/upload'
import {
  fetchStreamService,
  type FetchStreamEvent,
} from '~/entrypoints/background/service/fetchStream'
import type {
  UserAndSubscriptions,
  User,
  UserBalance,
  UserExtendInfo,
} from '~/types'
import EVENT from '~/utils/event'
import { point, pointError } from '~/entrypoints/background/service/point'
import { observable } from '@trpc/server/observable'
import { sendVerificationCodeFromApi } from '~/api'
import {
  loginWithEmailPassword,
  signupWithEmailPassword,
  loginWithProvider,
  verifyLoginMethod,
  initLoginService,
  loginWithEmailLink,
  loginWithVerificationCode,
  closeOffscreenDocument,
  getUserFirebaseIdToken,
} from '~/entrypoints/background/service/login'
import { logout } from '~/entrypoints/background/service/logout'
import sidepanelService from '~/entrypoints/background/service/sidepanel'
import {
  getYouTubeOutline,
  getYouTubeDetails,
  youtubeRequestManager,
} from '~/entrypoints/background/service/youtube'
import {
  getSubtitleUrlByVideoId,
  processSubtitleData,
  storeSubtitleUrlToCache,
} from '~/entrypoints/background/service/youtubeSubtitleService'
import {
  createPricingCheckout,
  getPricingProducts,
} from '~/entrypoints/background/service/pricing'

const t = initTRPC.create({
  isDev: false,
  allowOutsideOfServer: true,
})

const p = t.procedure
/**
 * @description
 *  1. query 用于读取数据的操作，幂等的，可以被缓存，类似于http的GET，典型场景如下：
 *     1.1. 获取数据/状态
 *     1.2. 查询数据/状态
 *  2. mutation 用于修改数据的操作，非幂等，不可被缓存，类似于http的POST/PUT/DELETE，典型场景如下：
 *     2.1. 创建数据
 *     2.2. 更新数据
 *     2.3. 删除数据
 *     2.4. 任何需要修改状态的操作
 *     2.5. 任何非query的操作
 * 虽然写代码的时候两者可以替换，而不会发生任何错误，但是要注意语义的区别，不要乱用
 */
export const appRouter = t.router({
  // 数据埋点，用于统计用户行为
  point: p
    .input(
      z.object({
        name: z.string(),
        params: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => await point(input.name, input.params)),
  pointError: p
    .input(
      z.object({
        type: z.string(),
        error: z.any(),
        params: z.any().optional(),
      })
    )
    .mutation(
      async ({ input }) =>
        await pointError(input.type, input.error, input.params)
    ),
  // 截图
  screenShot: p.query(async () => await browser.tabs.captureVisibleTab()),
  // 判断是否是登录态
  isLogin: p.query(async () => await isLogin()),
  // 获取用户和订阅信息
  getUserAndSubscriptionInfo: p.query(
    async (): Promise<UserAndSubscriptions> =>
      await getUserAndSubscriptionInfo()
  ),
  // 获取用户信息
  getUser: p.query(async (): Promise<User> => await getUser()),

  // 获取用户的剩余次数和钻石数量
  getUserBalance: p.query(async (): Promise<UserBalance> => {
    const res = await getUserBalance()
    return res
  }),
  // 获取用户订阅状态
  getSubscriptionStatus: p.query(
    async (): Promise<boolean> => await getSubscriptionStatus()
  ),
  // 获取用户扩展信息
  getUserExtendInfo: p.query(async (): Promise<UserExtendInfo> => {
    const res = await getUserExtendInfo()
    return res
  }),
  // 获取用户 token
  getAuthToken: p.query(async (): Promise<string> => await getToken()),
  // 获取用户 ID
  getUserId: p.query(async (): Promise<string> => await getUserId()),
  // 获取插件版本号
  getAppVersion: p.query(async (): Promise<string> => {
    const manifest = chrome.runtime.getManifest()
    return manifest.version
  }),
  // 监听主站发过来的用户信息和订阅状态发生改变的事件
  messageListenerFromSolvely: p.input(z.any()).mutation(({ input }) => {
    const { type, data, api } = input
    switch (type) {
      case EVENT.SOLVELY_DATA_SYNC:
        saveDataFromSolvely({ data, api })
        break
    }
  }),
  // 跳转到主站
  goToSolvely: p
    .input(z.string().optional())
    .query(({ input }) => goToSolvely(input || '/home')),
  // 跳转到登录页
  goToLogin: p.query(() => goToLogin()),
  // 跳转到主站，并通知主站解题（已登录）
  gotoSolvelyToSolveQuestion: p
    .input(z.string())
    .mutation(({ input }) => gotoSolvelyToSolveQuestion(input)),
  // 跳转到主站，并通知主站解题（未登录）
  gotoSolvelyToSolveQuestionWithoutLogin: p
    .input(z.string())
    .mutation(({ input }) => gotoSolvelyToSolveQuestionWithoutLogin(input)),
  // 获取 S3 上传 URL
  getUploadUrl: p
    .input(
      z.object({
        deviceId: z.string().optional(),
        files: z.array(
          z.object({
            fileName: z.string(),
            contentMD5: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => await uploadService.getUploadUrl(input)),
  // 上传 S3
  uploadS3: p
    .input(
      z.object({
        url: z.string(),
        fileBase64: z.string(), // Base64 编码的文件内容
        fileType: z.string(), // 文件类型
        md5: z.string(),
      })
    )
    .mutation(
      async ({ input }) =>
        await uploadService.uploadS3(
          input.url,
          input.fileBase64,
          input.fileType,
          input.md5
        )
    ),
  
  // 新增：获取 PDF CDN 预签名 URL
  getPdfUploadUrl: p
    .input(
      z.object({
        files: z.array(
          z.object({
            fileName: z.string(),
            contentMD5: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => await uploadService.getPdfUploadUrl(input)),
  
  // 新增：获取 Quiz CDN 预签名 URL
  getQuizUploadUrl: p
    .input(
      z.object({
        files: z.array(
          z.object({
            fileName: z.string(),
            fileType: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => await uploadService.getQuizUploadUrl(input)),

  // 修改为 subscription 路由
  fetchStream: p
    .input(
      z.object({
        url: z.string(),
        method: z.string().optional(),
        headers: z.record(z.string()).optional(),
        body: z.any().optional(),
        retries: z.number().optional(),
        retryDelay: z.number().optional(),
        requestId: z.string(),
      })
    )
    // 使用 .subscription 替代 .mutation
    .subscription(({ input, ctx }) => {
      // 创建一个 observable 来推送事件
      return observable<FetchStreamEvent>((observer) => {
        const { requestId, ...options } = input

        try {
          // 调用 service，传入 observer
          // startStream 会在内部处理 fetchEventSource
          // 并返回一个清理函数
          const cleanup = fetchStreamService.startStream(
            options,
            requestId,
            observer
          )

          // 返回清理函数，当客户端取消订阅时 tRPC 会调用它
          return () => {
            console.log(
              `[${input.requestId}] tRPC subscription stopped. Cleaning up.`
            )
            if (typeof cleanup === 'function') {
              cleanup()
            }
          }
        } catch (error) {
          console.error(
            `[${input.requestId}] Failed to start stream service:`,
            error
          )
          // 如果启动服务时出错，通知 observer
          observer.error(
            new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to initialize stream',
              cause: error,
            })
          )
          // 不需要返回清理函数，因为服务未成功启动
          return
        }
      })
    }),

  // 取消流式请求 (mutation 保持不变)
  cancelFetchStream: p
    .input(
      z.object({
        requestId: z.string(),
      })
    )
    .mutation(({ input }) => {
      return fetchStreamService.cancelStream(input.requestId)
    }),

  // 通用 fetch 请求（在 background 执行，避免 CORS）
  fetch: p
    .input(
      z.object({
        url: z.string(),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
        headers: z.record(z.string()).optional(),
        body: z.any().optional(),
        autoAuth: z.boolean().optional(), // 是否自动添加 Authorization header
      })
    )
    .mutation(async ({ input }) => {
      const { url, method = 'GET', headers = {}, body, autoAuth = true } = input

      // 如果需要自动添加认证
      if (autoAuth) {
        const token = await getToken()
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        // 添加插件 UUID 请求头
        try {
          const uuid = await getPluginUuid()
          if (uuid) {
            headers['x-plugin-uuid'] = uuid
          }
        } catch (error) {
          console.warn('[Router] 获取 UUID 失败:', error)
        }
      }

      try {
        const response = await axios({
          url,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          data: body,
        })

        return response.data
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.response 
              ? `HTTP ${error.response.status}: ${error.response.statusText}`
              : error.message,
          })
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Request failed',
        })
      }
    }),

  /**
   *  认证相关的方法
   */
  // 初始化登录服务
  initLoginService: p.mutation(async () => {
    await initLoginService()
  }),

  // 验证邮箱登录方式
  verifyLoginMethod: p
    .input(z.string().email('Please enter a valid email address'))
    .mutation(async ({ input }) => {
      return await verifyLoginMethod(input)
    }),

  // 使用邮箱链接登录
  loginWithEmailLink: p
    .input(z.string().email('Please enter a valid email address'))
    .mutation(async ({ input }) => {
      return await loginWithEmailLink(input)
    }),

  // 发送验证码
  sendVerificationCode: p
    .input(z.string().email('Please enter a valid email address'))
    .mutation(async ({ input }) => {
      return await sendVerificationCodeFromApi(input)
    }),

  // 验证码登录
  loginWithVerificationCode: p
    .input(z.object({
      email: z.string().email('Please enter a valid email address'),
      code: z.string().length(4, 'Please enter 4-digit verification code')
    }))
    .mutation(async ({ input }) => {
      return await loginWithVerificationCode(input.email, input.code)
    }),

  // 邮箱密码登录
  loginWithEmailPassword: p
    .input(
      z.object({
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await loginWithEmailPassword(input.email, input.password)
        return { success: true, data: result }
      } catch (error) {
        console.error('邮箱登录失败:', error)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            error instanceof Error
              ? error.message
              : 'Login failed, please check your credentials',
        })
      }
    }),

  // 邮箱密码注册
  signupWithEmailPassword: p
    .input(
      z.object({
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await signupWithEmailPassword(
          input.email,
          input.password
        )
        return { success: true, data: result }
      } catch (error) {
        console.error('邮箱注册失败:', error)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            error instanceof Error ? error.message : 'Registration failed, please try again later',
        })
      }
    }),

  // 第三方登录
  loginWithProvider: p
    .input(
      z.object({
        provider: z
          .string()
          .refine((val) => ['google', 'apple', 'facebook'].includes(val), {
            message: 'Provider must be one of google, apple, or facebook',
          }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await loginWithProvider(
          input.provider as 'google' | 'apple' | 'facebook'
        )
        return { success: true, data: result }
      } catch (error) {
        console.error('第三方登录失败:', error)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Third-party login failed',
        })
      }
    }),

  // 关闭 offscreen 文档
  closeOffscreenDocument: p.mutation(async () => {
    await closeOffscreenDocument()
  }),

  // 退出登录
  logout: p.mutation(async () => {
    try {
      await logout()
      return { success: true }
    } catch (error) {
      console.error('退出登录失败:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Logout failed',
      })
    }
  }),

  // 获取用户 firebase idToken
  getUserFirebaseIdToken: p.mutation(async () => {
    return await getUserFirebaseIdToken()
  }),

  // 获取 sidepanel 状态
  getSidepanelStatus: p.query(async (): Promise<boolean> => {
    return sidepanelService.getSidepanelStatusByContexts()
  }),

  // 获取 youtube 视频字幕 URL
  getSubtitleUrlByVideoId: p.input(z.string()).query(async ({ input }) => {
    return await getSubtitleUrlByVideoId(input)
  }),

  // 新增：处理字幕数据
  processSubtitleData: p
    .input(
      z.object({
        rawData: z.string(),
        videoId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return await processSubtitleData(input.rawData, input.videoId)
    }),

  // 新增：手动存储字幕URL到缓存
  storeSubtitleUrlToCache: p
    .input(
      z.object({
        videoId: z.string(),
        url: z.string(),
      })
    )
    .query(async ({ input }) => {
      return storeSubtitleUrlToCache(input.videoId, input.url)
    }),

  // 获取 youtube 视频摘要
  getYouTubeOutline: p
    .input(
      z.object({
        subtitles: z.any(),
        videoId: z.string(),
        lang: z.string().optional().default('en'),
      })
    )
    .query(async ({ input }) => {
      return await getYouTubeOutline(input.subtitles, input.videoId, input.lang)
    }),

  // 获取 youtube 视频详细信息
  getYouTubeDetails: p
    .input(
      z.object({
        subtitles: z.any(),
        videoId: z.string(),
        lang: z.string().optional().default('en'),
      })
    )
    .query(async ({ input }) => {
      return await getYouTubeDetails(input.subtitles, input.videoId, input.lang)
    }),

  // 新增：取消 YouTube 任务（同时取消摘要和详情请求）
  cancelYouTubeTask: p
    .input(
      z.object({
        taskId: z.string(),
      })
    )
    .mutation(({ input }) => {
      const cancelled = youtubeRequestManager.cancelTask(input.taskId)
      return { success: cancelled, taskId: input.taskId }
    }),

  // 新增：取消所有 YouTube 任务
  cancelAllYouTubeTasks: p.mutation(() => {
    youtubeRequestManager.cancelAllTasks()
    return { success: true }
  }),

  // 创建付款链接
  createPricingCheckout: p.input(z.any()).mutation(async ({ input }) => {
    return await createPricingCheckout(input)
  }),

  // 获取订阅商品列表
  getPricingProducts: p.query(async () => {
    return await getPricingProducts()
  }),
})

export type AppRouter = typeof appRouter
