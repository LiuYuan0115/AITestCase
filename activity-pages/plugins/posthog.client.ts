import posthog from 'posthog-js'

export default defineNuxtPlugin(() => {
  const posthogClient = posthog.init('phc_IofVNxKGWFkcL6P285Civb6CPmt7pubWSb7dCrHUton', {
    api_host: 'https://us.i.posthog.com',
    loaded: (posthog) => {
      if (import.meta.env.MODE === 'development') posthog.debug()
    }
  })

  return {
    provide: {
      posthog: posthogClient
    }
  }
})
