<script setup lang="ts">
import { ref, onMounted } from 'vue'
import logo from '@/assets/app/lp1/logo.svg'
const { $firebaseLogEvent, $pageViewEvent } = useNuxtApp()

const isExpand = ref(false)

useSeoMeta({
  robots: 'noindex'
})

const toggleExpand = () => {
  isExpand.value = !isExpand.value
  $firebaseLogEvent('LP_CLICK_EXPAND_LP1')
}

onMounted(() => {
  $pageViewEvent('LP_VIEW_LP1')
})
</script>
<template>
  <div
    class="mx-auto flex max-w-[1440px] flex-col items-center justify-center gap-5 bg-white px-4 py-[60px] font-['Inter'] lg:px-[56px]"
  >
    <img :src="logo" alt="logo" class="h-[130px] w-[130px]" />
    <div class="flex flex-col items-center justify-center gap-2">
      <h1 class="text-[28px] font-[700]">Solvely-AI math solver</h1>
      <p class="text-[16px] font-[400]">Math Solver & Homework Helper</p>
    </div>
    <div class="inline-flex h-[58.11px] items-center justify-between self-stretch">
      <div
        class="h-0 w-[37px] -rotate-90 opacity-10 outline outline-1 outline-offset-[-0.50px] outline-black/0"
      ></div>
      <div class="inline-flex w-[51px] flex-col items-center justify-start">
        <div
          class="justify-start font-['Inter'] text-xl font-semibold leading-normal text-[#0d0d0d]"
        >
          4.7
        </div>
        <div class="inline-flex h-[22px] items-center justify-start">
          <img src="@/assets/app/lp1/star.webp" alt="star" class="w-[52px]" />
        </div>
      </div>
      <div
        class="h-0 w-[37px] -rotate-90 opacity-10 outline outline-1 outline-offset-[-0.50px] outline-black"
      ></div>
      <div class="inline-flex w-[137px] flex-col items-center justify-start">
        <div
          class="justify-start font-['Inter'] text-xl font-semibold leading-normal text-[#0d0d0d]"
        >
          18K
        </div>
        <div
          class="justify-center whitespace-nowrap font-['Inter'] text-[16px] font-[400] leading-snug text-black opacity-50"
        >
          Number of ratings
        </div>
      </div>
      <div
        class="h-0 w-[37px] -rotate-90 opacity-10 outline outline-1 outline-offset-[-0.50px] outline-black"
      ></div>
    </div>
    <div class="w-full">
      <a
        href="https://app.adjust.com/1oito7jy?campaign={campaignid}&adgroup={adgroupid}&creative={keyword}_{matchtype}&lpurl={lpurl}&wbraid={wbraid}&external_click_id={gclid}&engagement_type=fallback_click"
        class="text-5 flex h-[44px] w-full items-center justify-center border-none bg-[#FE2D55] font-[600] text-white no-underline outline-none"
      >
        Go to App Store
      </a>
    </div>
    <section
      class="flex w-full gap-[14px] overflow-x-auto border-b border-b-[rgba(0,0,0,0.1)] py-5 md:flex-row md:items-center md:justify-between"
    >
      <img
        src="@/assets/app/lp1/1242_2208_01.webp"
        alt="image"
        class="w-[156px] md:w-[200px] lg:w-[250px]"
      />
      <img
        src="@/assets/app/lp1/1242_2208_02.webp"
        alt="image"
        class="w-[156px] md:w-[200px] lg:w-[250px]"
      />
      <img
        src="@/assets/app/lp1/1242_2208_03.webp"
        alt="image"
        class="w-[156px] md:w-[200px] lg:w-[250px]"
      />
      <img
        src="@/assets/app/lp1/1242_2208_04.webp"
        alt="image"
        class="w-[156px] md:w-[200px] lg:w-[250px]"
      />
      <img
        src="@/assets/app/lp1/1242_2208_05.webp"
        alt="image"
        class="w-[156px] md:w-[200px] lg:w-[250px]"
      />
    </section>
    <section class="flex flex-col gap-[10px] pt-5">
      <p class="text-5 font-[600]">Description</p>
      <p
        class="line-clamp-3 text-[16px] font-[400] leading-normal"
        :class="{ 'line-clamp-none': isExpand }"
      >
        Solvely: Your AI Study BFF Stuck on a problem? Snap a pic or type it in—no judgment here—and
        let Solvely break it down step by step so you actually understand. Perfect for any level,
        from Baby Math 101 to those advanced courses you pretend don't exist. Ditch the stress,
        level up your grades, and get more time for, well… everything else.
        <br />
        <br />
        Why You'll Love It
        <br />
        - Stress-free Zone – Save yourself those 2 A.M. panic attacks
        <br />
        - No More Guesswork – We guide you through every step
        <br />
        - All Subjects, All Levels – Math, science, whatever's on your plate
        <br />
        - Smart Live Notes – transcribing everything, spotlighting the juicy stuff, and freeing you
        from frantic note-taking.
        <br />
        - Unlock Real Understanding – Because grades are nice, but knowing is cooler
        <br />
        - Flexibility – Study help that fits your vibe (and schedule)
        <br />
        <br />
        Download Solvely now and say goodbye to late-night homework meltdowns. Let's make learning
        click!
        <br />
        ► SMART AI SOLUTIONS THAT TEACH Stuck on that tricky assignment? Our AI doesn't just spit
        out answers—it walks you through every step so you actually get the "why" behind the
        solution. Say goodbye to blank stares and hello to real understanding.
        <br />
        ► AI LIVE NOTES Let AI Live Notes handle the heavy lifting in class by transcribing every
        word and extracting the need-to-know highlights, so you can actually pay attention (or
        daydream—no judgment). Perfect for those days when the professor talks at light speed! Say
        goodbye to note-taking FOMO, and hello to easier studying!
        <br />
        ► ADVANCED LEARNING ENGINE Powered by next-level AI that meets you where you are—elementary,
        college, or even PhD. Get custom-tailored explanations that match your vibe and help you
        lock in long-term knowledge.
        <br />
        ► COMPREHENSIVE SUBJECT COVERAGE Crush it in Math, Science, Humanities—you name it. Whether
        it's basic algebra or advanced calculus, physics or philosophy, our expert guidance keeps
        you ahead of the game.
        <br />
        ► INSTANT PHOTO SOLUTIONS Snap a pic of any question—textbooks, handwritten notes, or even
        whiteboards—and get a detailed breakdown in seconds. No more waiting. No more guesswork.
        <br />
        ► SEAMLESS LEARNING EXPERIENCE Sync your studying across iPhone and iPad like a pro. Whether
        it's late-night cramming or a quick homework check between classes, Solvely's got your back.
        <br />
        ► ALL-IN-ONE STUDY COMPANION One app to rule them all: Smart Reader, Writing Assistant, AI
        Note-Taking, Focus Mode, and Calculator. Everything you need to knock out assignments and
        boost those grades.
        <br />
        ► SUBJECTS WE CRUSH: • Mathematics (Elementary to Advanced) • Sciences (Physics, Chemistry,
        Biology) • Humanities (English, Literature, History) • Test Prep (SAT®, ACT®, AP®, GRE®)
        <br />
        ► PROVEN RESULTS 8 out of 10 students see their grades climb within 30 days. Join 5M+
        learners rocking smarter study habits with Solvely!
        <br />
        ► UPGRADE TO PRO: • Unlimited, in-depth explanations • Advanced problem-solving superpowers
        • Interactive learning support • AI-powered lecture notes • Tons of practice materials •
        Priority support (because you're VIP)
        <br />
        ► PAYMENT DETAILS • Payment charged to your Apple ID at purchase confirmation • Subscription
        renews automatically unless you cancel at least 24 hours before the current period ends •
        Your account is charged for renewal within 24 hours before the end of the current period •
        Manage or cancel your subscription in your App Store account settings • Prices and offers
        may change without notice
        <br />
        ► STAY CONNECTED • Official Website: https://solvely.ai • TikTok:
        https://www.tiktok.com/@solvely.ai • Instagram: https://www.instagram.com/solvely.ai/ Got
        suggestions or questions? • Email us at support@solvelyapp.com • Terms of Service:
        https://solvely.ai/term • Privacy Policy: https://solvely.ai/privacy-policy Need Last-Minute
        Help? Download Solvely → Snap Your Question → Get Expert Solutions in Seconds!
      </p>
      <p
        class="text-4 cursor-pointer text-end font-[600] text-black transition-all"
        @click="toggleExpand"
      >
        <span v-if="!isExpand">Expand</span>
        <span v-else>Collapse</span>
        <span :class="{ 'rotate-180': isExpand }" class="inline-block transition-transform">▾</span>
      </p>
    </section>
  </div>
  <footer class="flex flex-col items-center justify-center gap-5 bg-[#F8F8F8] px-4 py-5 pb-[100px]">
    <img src="@/assets/app/lp1/logo.svg" alt="logo" class="h-[82px] w-[82px]" />
    <p class="text-5 font-[700] text-black">Solvely-AI math solver</p>
    <a
      href="https://app.adjust.com/1ofyw3ka?campaign={campaignid}&adgroup={adgroupid}&creative={keyword}_{matchtype}&lpurl={lpurl}&wbraid={wbraid}&external_click_id={gclid}&engagement_type=fallback_click"
      class="text-6 flex h-[44px] w-[174px] items-center justify-center bg-[#fe2d55] font-[600] text-white no-underline"
    >
      Go to App Store
    </a>
  </footer>
</template>
