declare module 'nuxt/app' {
  interface NuxtApp {
    // firebase
    $firebaseLogEvent: (eventName: string, eventParams?: Record<string, any>) => void
    $pageViewEvent: (pageName: string) => void
    // api
    $api: (path: string, options?: any) => Promise<any>
  }
}
