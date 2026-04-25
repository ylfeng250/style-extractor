/**
 * 元素高亮和覆盖层组件
 */

import { theme } from './theme';
import { getToolbarElements } from './toolbar';

// DOM 元素引用
let highlightOverlay: HTMLElement | null = null;
let tooltipEl: HTMLElement | null = null;
let cursorStyleEl: HTMLStyleElement | null = null;

/** 设置元素样式 */
function setStyle(el: HTMLElement, styles: Record<string, string>): void {
  Object.assign(el.style, styles);
}

/** 初始化高亮组件 */
export function initHighlight(): void {
  const { toolbarShadow } = getToolbarElements();
  if (!toolbarShadow) return;

  // 创建高亮覆盖层
  highlightOverlay = document.createElement('div');
  setStyle(highlightOverlay, {
    position: 'fixed',
    pointerEvents: 'none',
    border: `2px dashed ${theme.brand}`,
    background: theme.brandBg,
    borderRadius: theme.highlightBorderRadius,
    zIndex: '2147483645',
    display: 'none',
    boxSizing: 'border-box',
  });
  toolbarShadow.appendChild(highlightOverlay);

  // 创建提示框
  tooltipEl = document.createElement('div');
  setStyle(tooltipEl, {
    position: 'fixed',
    pointerEvents: 'none',
    background: theme.text,
    color: theme.bg,
    padding: '4px 8px',
    borderRadius: theme.tooltipBorderRadius,
    fontSize: theme.fontSize,
    fontFamily: theme.fontFamily,
    fontWeight: theme.fontWeight,
    zIndex: '2147483646',
    display: 'none',
    whiteSpace: 'nowrap',
    boxShadow: theme.tooltipShadow,
  });
  toolbarShadow.appendChild(tooltipEl);

  // 添加全局光标样式
  cursorStyleEl = document.createElement('style');
  cursorStyleEl.id = '__se_cursor_style__';
  cursorStyleEl.textContent = '* { cursor: crosshair !important; }';
  document.head.appendChild(cursorStyleEl);
}

/** 销毁高亮组件 */
export function destroyHighlight(): void {
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
  if (cursorStyleEl) {
    cursorStyleEl.remove();
    cursorStyleEl = null;
  }
}

/** 高亮元素 */
export function highlightElement(el: Element): void {
  if (!highlightOverlay || !tooltipEl) return;

  const rect = el.getBoundingClientRect();

  setStyle(highlightOverlay, {
    display: 'block',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });

  // 生成标签文本
  const tagName = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const className = el.className && typeof el.className === 'string'
    ? `.${el.className.split(' ').slice(0, 2).join('.')}`
    : '';
  const text = `${tagName}${id}${className}`;
  const displayText = text.length > 40 ? text.slice(0, 37) + '...' : text;

  tooltipEl.textContent = displayText;
  setStyle(tooltipEl, { display: 'block' });

  // 定位提示框
  const tooltipRect = tooltipEl.getBoundingClientRect();
  let top = rect.bottom + 8;
  let left = rect.left;

  // 边界检查
  if (top + tooltipRect.height > window.innerHeight - 8) {
    top = rect.top - tooltipRect.height - 8;
  }
  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  if (left < 8) left = 8;

  setStyle(tooltipEl, { top: `${top}px`, left: `${left}px` });
}

/** 隐藏高亮 */
export function hideHighlight(): void {
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }
  if (tooltipEl) {
    tooltipEl.style.display = 'none';
  }
}

/** 获取高亮元素 */
export function getHighlightElements() {
  return { highlightOverlay, tooltipEl };
}
