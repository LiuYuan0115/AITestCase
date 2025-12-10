import { getTrpc } from '~/lib/trpc/client'
import { QUIZLET_AB_TEST } from '~/types/content'

export const getPricingPath = async () => {
  return '/pricing-plugin'
}

export async function isQuizletABTestOn(): Promise<boolean> {
  try {
    const userExtendInfo = await getTrpc().getUserExtendInfo.query()
    const hasTestTag = userExtendInfo?.abTestTags?.includes(
      QUIZLET_AB_TEST.TAG_NAME
    )
    return !!hasTestTag
  } catch (err) {
    return false
  }
}
