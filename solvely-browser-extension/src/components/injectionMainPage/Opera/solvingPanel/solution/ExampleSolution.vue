<template>
  <div
    class="self-stretch pt-[8px] bg-[#F3F6FF] rounded-[16px] border-[1px] border-white flex flex-col justify-start items-start gap-[8px] overflow-hidden"
  >
    <div
      class="self-stretch px-[16px] inline-flex justify-between items-center"
    >
      <span
        class="justify-center text-[#474A7E] text-[16px] font-bold font-['Inter'] leading-[20px]"
      >
        Solution
      </span>
    </div>

    <div
      :class="[
        'relative overflow-hidden',
        'h-[307px]',
        'inline-flex justify-center items-start gap-[10px]',
        'self-stretch  bg-white rounded-[16px]',
      ]"
    >
      <div
        class="answer-info-wrapper w-full p-[16px] self-stretch justify-start text-emph-1 text-[16px] font-normal font-['Inter'] leading-[24px] overflow-hidden"
      >
        <img src="@/assets/images/onboarding/example-answers.webp" class="w-[350px] h-[278px]" />
      </div>
      <div
        class="absolute bottom-0 w-full h-[32px] bg-gradient-to-t from-white/80 to-transparent pointer-events-none"
      ></div>
    </div>
  </div>
</template>
