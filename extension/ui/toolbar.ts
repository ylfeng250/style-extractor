/**
 * 工具栏组件
 */

import { theme } from './theme';
import { createSVGIcon } from './icons';

export const TOOLBAR_HOST_ID = '__se_toolbar_host__';

// DOM 元素引用
let toolbarHost: HTMLElement | null = null;
let toolbarShadow: ShadowRoot | null = null;
let toolbarEl: HTMLElement | null = null;
let toolbarWrapper: HTMLElement | null = null;

/** 设置元素样式 */
function setStyle(el: HTMLElement, styles: Record<string, string>): void {
  Object.assign(el.style, styles);
}

/** 工具栏按钮选项 */
export interface ToolbarButton {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary';
}

/** 创建工具栏 */
export function createToolbar(): { host: HTMLElement; shadowRoot: ShadowRoot; toolbar: HTMLElement } {
  if (toolbarHost && toolbarShadow && toolbarEl) {
    toolbarEl.style.animation = 'none';
    return { host: toolbarHost, shadowRoot: toolbarShadow, toolbar: toolbarEl };
  }

  // 创建宿主元素
  toolbarHost = document.createElement('div');
  toolbarHost.id = TOOLBAR_HOST_ID;
  toolbarShadow = toolbarHost.attachShadow({ mode: 'closed' });

  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pop { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    @keyframes fade { to { opacity: 0; transform: scale(0.8); } }
  `;
  toolbarShadow.appendChild(style);

  // 创建包装器
  toolbarWrapper = document.createElement('div');
  setStyle(toolbarWrapper, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    userSelect: 'none',
  });

  // 创建工具栏
  toolbarEl = document.createElement('div');
  setStyle(toolbarEl, {
    display: 'flex',
    alignItems: 'center',
    width: 'max-content',
    minWidth: '280px',
    height: theme.toolbarHeight,
    padding: '0 8px',
    borderRadius: theme.toolbarBorderRadius,
    background: theme.bg,
    boxShadow: theme.shadow,
    boxSizing: 'border-box',
    position: 'relative',
    animation: 'pop .3s ease-out',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fontWeight: theme.fontWeight,
    lineHeight: theme.lineHeight,
    letterSpacing: theme.letterSpacing,
  });

  toolbarWrapper.appendChild(toolbarEl);
  toolbarShadow.appendChild(toolbarWrapper);

  // 添加到 body
  if (document.body) {
    document.body.appendChild(toolbarHost);
  } else {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        document.body.appendChild(toolbarHost!);
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }

  return { host: toolbarHost, shadowRoot: toolbarShadow, toolbar: toolbarEl };
}

/** 创建图标按钮 */
export function createIconButton(iconName: string, label: string, onClick: () => void, variant: 'default' | 'primary' = 'default'): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';

  const icon = createSVGIcon(iconName, variant === 'primary' ? theme.textOnBrand : theme.text);
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  setStyle(labelSpan, { marginLeft: '4px' });

  btn.appendChild(icon);
  btn.appendChild(labelSpan);

  const isPrimary = variant === 'primary';
  setStyle(btn, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: theme.buttonHeight,
    padding: '0 8px 0 4px',
    border: 'none',
    borderRadius: theme.buttonBorderRadius,
    background: isPrimary ? theme.brand : 'transparent',
    color: isPrimary ? theme.textOnBrand : theme.text,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background .1s',
  });

  btn.onmouseenter = () => { btn.style.background = isPrimary ? theme.brandHover : theme.secondaryHover; };
  btn.onmouseleave = () => { btn.style.background = isPrimary ? theme.brand : 'transparent'; };
  btn.onmousedown = () => { btn.style.background = isPrimary ? theme.brandPressed : theme.secondaryPressed; };
  btn.onmouseup = () => { btn.style.background = isPrimary ? theme.brandHover : theme.secondaryHover; };
  btn.onclick = onClick;

  return btn;
}

/** 创建关闭按钮 */
export function createCloseButton(onClick: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', '关闭');

  const icon = createSVGIcon('icon.24.close.large', theme.text);
  btn.appendChild(icon);

  setStyle(btn, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.buttonHeight,
    height: theme.buttonHeight,
    padding: '0',
    border: 'none',
    borderRadius: theme.buttonBorderRadius,
    background: 'transparent',
    color: theme.text,
    cursor: 'pointer',
    transition: 'background .1s',
    marginLeft: '8px',
  });

  btn.onmouseenter = () => { btn.style.background = theme.secondaryHover; };
  btn.onmouseleave = () => { btn.style.background = 'transparent'; };
  btn.onmousedown = () => { btn.style.background = theme.secondaryPressed; };
  btn.onmouseup = () => { btn.style.background = theme.secondaryHover; };
  btn.onclick = onClick;

  return btn;
}

/** 创建分隔线 */
export function createDivider(): HTMLElement {
  const div = document.createElement('div');
  setStyle(div, {
    width: '1px',
    alignSelf: 'stretch',
    background: theme.border,
    flexShrink: '0',
  });
  return div;
}

/** 获取工具栏元素 */
export function getToolbarElements() {
  return { toolbarHost, toolbarShadow, toolbarEl, toolbarWrapper };
}

/** 销毁工具栏 */
export function destroyToolbar(): void {
  if (toolbarHost) {
    toolbarHost.remove();
    toolbarHost = null;
    toolbarShadow = null;
    toolbarEl = null;
    toolbarWrapper = null;
  }
}

/** 检查元素是否在工具栏内 */
export function isToolbarElement(el: Element): boolean {
  return !!toolbarHost && (toolbarHost.contains(el) || el === toolbarHost);
}
