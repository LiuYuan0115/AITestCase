/** @type {import('tailwindcss').Config} */
import { zIndex } from 'html2canvas/dist/types/css/property-descriptors/z-index'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: ['./src/entrypoints/**/*.{html,vue,ts}', './src/components/**/*.{html,vue,ts}'],
  darkMode: 'class', // 启用 class 策略的暗黑模式
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        // 如果需要特别指定 Inter
        inter: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // 主题色
        primary: '#007aff',
        'primary-dark': '#A0CEFF',
        secondary: '#E2EDFF',
        'secondary-dark': '#27333F',
        tertiary: '#ECF5FF',
        'tertiary-dark': '#29303E',
        white: '#FFFFFF',
        'white-dark': '#1B212D',

        // =====================================<<<<< 新的主题色表，以后以这个为准 >>>>>=========================================
        // 📅 更新时间: 2024.10.31
        // 👤 更新人: Corcky
        // 📋 命名规则:
        //    • _dis = disable (禁用状态)
        //    • _hov  = hover (悬停状态)
        //    • _dk   = dark (暗黑模式)
        //    • _1   = primary (主要)
        //    • _2   = secondary (次要)
        //    • _3   = tertiary (第三级)

        // 🎨 Background Colors (背景色) - b_ 开头
        b_brand: '#007AFF',
        b_brand_dk: '#007AFF',
        b_brand_hov: '#0060C8',
        b_brand_hov_dk: '#0060C8',

        b_1: '#FFFFFF',
        b_1_dk: '#1B212D',
        b_1_hov: '#ECF5FF',
        b_1_hov_dk: '#29303E',
        b_2: '#F6F8FA',
        b_2_dk: '#1B212D',

        b_card: '#FFFFFF',
        b_card_dk: '#222A38',
        b_card_hov: '#ECF5FF',
        b_card_hov_dk: '#303A52',

        b_panel: '#F6F8FA',
        b_panel_dk: '#252D3E',

        b_btn_dis: '#EEEEEE',
        b_btn_dis_dk: '#2F3543',
        b_btn_2: '#ECF5FF',
        b_btn_2_dk: '#324B68',

        b_step: '#F8FBFF',
        b_step_dk: '#163257',
        b_final: '#F8FFF8',
        b_final_dk: '#34453D',
        b_tip: '#1B212D',
        b_tip_dk: '#4A5466',

        b_blue99: '#DDEEFF',
        b_blue99_dk: '#1F4266',

        b_iap_1: '#FFCE4F',
        b_iap_1_dk: '#FFCE4F',

        // 🎨 Frame Colors (线框色) - f_ 开头
        f_card_2: '#E2EDFF',
        // ⭐️ 如果是bg_card，默认是有边框的，亮色边框是>> border-white <<，暗色>> border-f_card_2_dk <<，要记得预留border位置预防抖动
        f_card_2_dk: '#2C3649',

        // 🎨 Text Colors (文本色) - t_ 开头
        t_1: '#111111',
        t_1_dk: '#F1F3F5',
        t_2: '#595C60',
        t_2_dk: '#D1D3D5',
        t_3: '#989B9E',
        t_3_dk: '#A4A6AB',

        t_brand: '#007AFF',
        t_brand_dk: '#51A9FE',

        t_btn: '#FFFFFF',
        t_btn_dk: '#FFFFFF',
        t_btn_dis: '#C4C6C9',
        t_btn_dis_dk: '#767A81',
        t_dis: '#B4B8BC',
        t_dis_dk: '#595C60',

        t_iap: '#461702',
        t_iap_dk: '#FFF1C6',
        t_iap_btn: '#461702',
        t_iap_btn_dk: '#461702',

        // 🎨 Divider Colors (分割线色) - d_ 开头
        d_1: '#E6E8EA',
        d_1_dk: '#474C58',
        d_2: '#EEEEEE',
        d_2_dk: '#2F3543',

        // =====================================<<<<< 旧的色表，慢慢替换 >>>>>=========================================

        // Solvely==============Text==============
        's-text-high-emphasis': '#111111',
        's-text-high-emphasis-dark': '#FFFFFF',
        's-text-medium-emphasis': '#595C60',
        's-text-medium-emphasis-dark': '#D1D3D5',
        's-text-low-emphasis': '#989B9E',
        's-text-low-emphasis-dark': '#A4A6AB',
        's-text-disabled-label': '#C4C6C9',
        's-text-disabled-label-dark': '#767A81',
        's-text-brand': '#007AFF',
        's-text-brand-dark': '#1D8EFF',
        // Solvely==============Foundation==============
        's-foundation-primary': '#51A9FE',
        's-foundation-primary-dark': '#1D8EFF',
        's-foundation-white': '#FFFFFF',
        's-foundation-white-dark': '#111111',
        's-foundation-tertiary': '#EDFAFF',
        's-foundation-tertiary-dark': '#0C3F81',
        's-foundation-iap-primary': '#FFCE4F',
        's-foundation-iap-primary-dark': '#795305',
        // Solvely==============Component Hover==============
        's-hover-primary': '#51A9FE',
        's-hover-primary-dark': '#007AFF',
        's-hover-on-white': '#F5FDFF',
        's-hover-on-white-dark': '#001936',
        's-hover-on-erro': '#F64262',
        's-hover-on-erro-dark': '#F30A34',
        // Solvely==============Component Border==============
        's-border': '#E6E8EA',
        's-border-dark': '#474C58',
        's-border-secondary': '#F0F2F4',
        's-border-secondary-dark': '#2F3543',
        's-border-warning': '#FFCE4F',
        's-border-warning-dark': '#795305',
        's-border-complementary': '#92AAFF',
        's-border-complementary-dark': '#514ABD',
        's-border-error': '#F97A8F',
        's-border-error-dark': '#8E162C',
        's-border-success': '#8BE16B',
        's-border-success-dark': '#317711',
        // Solvely==============Component Background==============
        's-panel-bg': '#E7EBEF',
        's-panel-bg-dark': '#212836',
        's-input-bg': '#F9FBFF',
        's-input-bg-dark': '#283142',
        's-disable-bg': '#E6E8EA',
        's-disable-bg-dark': '#474C58',
        's-interface-bg': '#FFFFFF',
        's-interface-bg-dark': '#161B26',
        's-hover-bg': '#EDFAFF',
        's-hover-bg-dark': '#122E57',
        // Solvely==============Function==============
        's-function-erro': '#F30A34',
        's-function-erro-dark': '#FF6269',
        's-function-erro-bg': '#FFE9EA',
        's-function-erro-bg-dark': '#4A1D26',
        's-function-success': '#40C700',
        's-function-success-dark': '#65D435',
        's-function-success-bg': '#E2FFD7',
        's-function-success-bg-dark': '#25341E',
        's-function-warning': '#F6A507',
        's-function-warning-dark': '#F5A407',
        's-function-warning-bg': '#FFF1C6',
        's-function-warning-bg-dark': '#332500',
        // Solvely==============Click==============
        's-click-warning': '#CF8300',
        's-click-warning-dark': '#FACA4E',
        's-click-erro': '#CC002C',
        's-click-erro-dark': '#FFA1A5',
        's-click-success': '#00A400',
        's-click-success-dark': '#C3F1A6',
        's-click-complementary': '#3832D1',
        's-click-complementary-dark': '#B2C0F2',
        's-click-foundation': '#0060C9',
        's-click-foundation-dark': '#90C0E8',

        // status
        'status-error': '#F30A34',
        'status-error-dark': '#FF6269',
        'status-success': '#40C700',
        'status-success-dark': '#40C700',
        'status-warning': '#F6A507',
        'status-warning-dark': '#F6A507',
        'status-error-secondary': '#FFE9EA',
        'status-error-secondary-dark': '#32353F',
        'status-success-secondary': '#D5FBD5',
        'status-success-secondary-dark': '#2D373D',
        'status-warning-secondary': '#FFE79E',
        'status-warning-secondary-dark': '#474742',

        // text color
        'emph-1': '#111111',
        'emph-1-dark': '#FFFFFF',
        'emph-2': '#555555',
        'emph-2-dark': '#999999',
        'emph-3': '#999999',
        'emph-3-dark': '#686868',
        'emph-disabled': '#CCCCCC',
        'emph-disabled-dark': '#485162',

        // background color
        'panel-bg': '#F6F8FA',
        'panel-bg-dark': '#141821',
        'input-bg': '#F0F2F4',
        'input-bg-dark': '#2F3543',
        'disabled-bg': '#EEEEEE',
        'disabled-bg-dark': '#2F3543',
        's-bg-btn-secondary': '#ECF5FF',
        's-bg-btn-secondary-dark': '#324B68',
        's-bg-panel': '#F6F8FA',
        's-bg-panel-dark': '#252D3E',

        // border color
        'custom-border': '#CCCCCC',
        'custom-border-dark': '#485162',
        'custom-border-2': '#EEEEEE',
        'custom-border-2-dark': '#2F3543',
        'custom-border-3': '#E3E3E3',
        'custom-border-3-dark': '#C4C6C9',
        'custom-border-4': '#E0E0E0',

        // hover color
        'hover-on-primary': '#0060C9',
        'hover-on-primary-dark': '#136DD0',
        'hover-on-white': '#F5FDFF',
        'hover-on-white-dark': '#001936',
        'hover-on-gray': '#E2EDFF',
        'hover-on-gray-dark': '#27333F',

        //unknown 这些没有对应的，后续待处理
        'iap-1': '#FFCE4F',
        'iap-2': '#291709',
        'iap-3': '#FFF1C6',
        'iap-4': '#AECAF8',
        'green-1': '#40C700',
        'green-2': '#AEE78B',
        'green-3': '#ECFFDD',
        'green-4': '#328300',
        'green-5': '#00C100',
        'green-6': '#DFFFE1',
        'red-1': '#E50000',
        'red-2': '#EC9999',
        'red-3': '#DC3B63',
        'red-4': '#FFDBDB',
        'red-5': '#FDA581',
        'red-6': '#FA59F4',
        'red-7': '#FFCEC5',
        'red-8': '#DAB600',
        'red-9': '#D900CA',
        'red-10': '#FFF5F5',
      },
      transitionProperty: {
        width: 'width',
        height: 'height',
        size: ['width', 'height'],
      },
      boxShadow: {
        'main-editor': '0px 2px 10px 0px #D7DCE680',
        'custom-4': '0px 8px 18px 0px #00000026',
        dropdown: '0px 8px 16px 0px rgba(0,0,0,0.15)',
      },
      'text-shadow-blur': {
        textShadow: '0 0 5px rgba(0, 0, 0, 0.5)',
      },
      'text-shadow-dark': {
        textShadow: '0 0 5px rgba(255, 255, 255, 0.5)',
      },
      keyframes: {
        overlayShow: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        contentShow: {
          from: {
            opacity: '0',
            transform: 'translate(-50%, -48%) scale(0.96)',
          },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
      },
      animation: {
        overlayShow: 'overlayShow 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        contentShow: 'contentShow 500ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      zIndex: {
        max: 2147483646,
      },
    },
  },
  presets: [
    require('tailwindcss-rem2px-preset').createPreset({
      fontSize: 16,
      unit: 'px',
    }),
  ],
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.color-transition': {
          'transition-property': 'color, background-color, border-color, text-decoration-color, fill, stroke',
          'transition-duration': '200ms',
        },
      })
    },
  ],
}
