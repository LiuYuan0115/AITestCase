import type { Directive, DirectiveBinding } from 'vue';

interface TooltipHTMLElement extends HTMLElement {
  _tooltipEl?: HTMLDivElement;
  _tooltipShowTimer?: ReturnType<typeof setTimeout>;
  _tooltipHandlers?: {
    mouseenter: (e: MouseEvent) => void;
    mouseleave: () => void;
  };
}

function createTooltipEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'v-tooltip';
  el.setAttribute('role', 'tooltip');
  el.innerHTML = '<div class="v-tooltip__content"></div><div class="v-tooltip__arrow"></div>';
  return el;
}

function positionTooltip(trigger: HTMLElement, tooltip: HTMLDivElement, position: string) {
  const rect = trigger.getBoundingClientRect();
  const gap = 8;

  // Reset for measurement
  tooltip.style.visibility = 'hidden';
  tooltip.style.display = 'block';
  document.body.appendChild(tooltip);

  const tRect = tooltip.getBoundingClientRect();

  let top = 0;
  let left = 0;

  switch (position) {
    case 'top':
      top = rect.top - tRect.height - gap;
      left = rect.left + rect.width / 2 - tRect.width / 2;
      break;
    case 'bottom':
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tRect.width / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - tRect.height / 2;
      left = rect.left - tRect.width - gap;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - tRect.height / 2;
      left = rect.right + gap;
      break;
  }

  // Clamp to viewport
  const padding = 6;
  if (left < padding) left = padding;
  if (left + tRect.width > window.innerWidth - padding) {
    left = window.innerWidth - padding - tRect.width;
  }
  if (top < padding) {
    // Flip to bottom if top overflows
    if (position === 'top') {
      top = rect.bottom + gap;
      tooltip.dataset.pos = 'bottom';
    }
  } else {
    tooltip.dataset.pos = position;
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.style.visibility = '';
}

function show(el: TooltipHTMLElement, binding: DirectiveBinding) {
  const text = typeof binding.value === 'string' ? binding.value : String(binding.value ?? '');
  if (!text) return;

  const position = (binding.arg as string) || 'bottom';

  if (!el._tooltipEl) {
    el._tooltipEl = createTooltipEl();
  }

  const tooltip = el._tooltipEl;
  const content = tooltip.querySelector('.v-tooltip__content') as HTMLDivElement;
  content.textContent = text;

  positionTooltip(el, tooltip, position);

  // Trigger animation
  requestAnimationFrame(() => {
    tooltip.classList.add('v-tooltip--visible');
  });
}

function hide(el: TooltipHTMLElement) {
  if (el._tooltipEl) {
    el._tooltipEl.classList.remove('v-tooltip--visible');
    // Remove after transition
    setTimeout(() => {
      el._tooltipEl?.remove();
    }, 150);
  }
}

// Inject global styles once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .v-tooltip {
      position: fixed;
      z-index: 10000;
      pointer-events: none;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 0.15s ease-out, transform 0.15s ease-out;
    }
    .v-tooltip--visible {
      opacity: 1;
      transform: translateY(0);
    }
    .v-tooltip[data-pos="top"] {
      transform: translateY(4px);
    }
    .v-tooltip[data-pos="top"].v-tooltip--visible {
      transform: translateY(0);
    }
    .v-tooltip__content {
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
      color: #FFFEF9;
      background: #1a1a1a;
      border-radius: 6px;
      white-space: nowrap;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .v-tooltip__arrow {
      position: absolute;
      width: 0;
      height: 0;
    }
    .v-tooltip[data-pos="bottom"] .v-tooltip__arrow {
      top: -5px;
      left: 50%;
      transform: translateX(-50%);
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 5px solid #1a1a1a;
    }
    .v-tooltip[data-pos="top"] .v-tooltip__arrow {
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #1a1a1a;
    }
    .v-tooltip[data-pos="left"] .v-tooltip__arrow {
      right: -5px;
      top: 50%;
      transform: translateY(-50%);
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-left: 5px solid #1a1a1a;
    }
    .v-tooltip[data-pos="right"] .v-tooltip__arrow {
      left: -5px;
      top: 50%;
      transform: translateY(-50%);
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-right: 5px solid #1a1a1a;
    }
  `;
  document.head.appendChild(style);
}

export const vTooltip: Directive<TooltipHTMLElement> = {
  mounted(el, binding) {
    injectStyles();

    // Remove native title to prevent double tooltip
    el.removeAttribute('title');

    const handlers = {
      mouseenter: () => {
        el._tooltipShowTimer = setTimeout(() => {
          show(el, binding);
        }, 200);
      },
      mouseleave: () => {
        if (el._tooltipShowTimer) {
          clearTimeout(el._tooltipShowTimer);
          el._tooltipShowTimer = undefined;
        }
        hide(el);
      },
    };

    el._tooltipHandlers = handlers;
    el.addEventListener('mouseenter', handlers.mouseenter);
    el.addEventListener('mouseleave', handlers.mouseleave);
  },

  updated(el, binding) {
    // If the value changes while tooltip is visible, update content
    if (el._tooltipEl) {
      const content = el._tooltipEl.querySelector('.v-tooltip__content') as HTMLDivElement;
      if (content) {
        content.textContent = typeof binding.value === 'string' ? binding.value : String(binding.value ?? '');
      }
    }
  },

  beforeUnmount(el) {
    if (el._tooltipShowTimer) {
      clearTimeout(el._tooltipShowTimer);
    }
    if (el._tooltipHandlers) {
      el.removeEventListener('mouseenter', el._tooltipHandlers.mouseenter);
      el.removeEventListener('mouseleave', el._tooltipHandlers.mouseleave);
    }
    el._tooltipEl?.remove();
  },
};
