/**
 * 元素选择器 UI 核心逻辑
 * 整合工具栏、高亮、面包屑功能
 */

import { theme } from "./theme";
import { createSVGIcon } from "./icons";
import {
  createToolbar,
  destroyToolbar,
  createIconButton,
  createCloseButton,
  createDivider,
  isToolbarElement,
  getToolbarElements,
} from "./toolbar";
import {
  initHighlight,
  destroyHighlight,
  highlightElement,
  getHighlightElements,
} from "./highlight";
import {
  initBreadcrumb,
  destroyBreadcrumb,
  updateBreadcrumb,
  hideBreadcrumb,
  getBreadcrumbElement,
} from "./breadcrumb";

// 状态变量
let isSelectionMode = false;
let isConfirmMode = false;
let selectedElement: Element | null = null;
let hoverElement: Element | null = null;
let currentSelector: string = "";
let selectionAbortController: AbortController | null = null;

// 回调函数
let onSelectCallback: ((element: Element, selector: string) => void) | null =
  null;
let onCancelCallback: (() => void) | null = null;

/** 设置元素样式 */
function setStyle(el: HTMLElement, styles: Record<string, string>): void {
  Object.assign(el.style, styles);
}

/** 选择器 UI 选项 */
export interface SelectorUIOptions {
  /** 主题配置 */
  theme?: Partial<typeof theme>;
  /** 元素选择回调 */
  onSelect?: (element: Element, selector: string) => void;
  /** 取消选择回调 */
  onCancel?: () => void;
  /** 是否显示面包屑 */
  showBreadcrumb?: boolean;
}

/** 启动元素选择模式 */
export function startElementSelection(options?: SelectorUIOptions): void {
  if (isSelectionMode) return;
  isSelectionMode = true;

  // 保存回调
  onSelectCallback = options?.onSelect || null;
  onCancelCallback = options?.onCancel || null;

  // 创建工具栏
  createToolbar();
  const { toolbarEl, toolbarShadow } = getToolbarElements();

  // 初始化高亮和面包屑
  initHighlight();
  initBreadcrumb(handleBreadcrumbClick);

  // 更新工具栏为选择模式
  updateToolbarForSelection();

  // 绑定事件
  selectionAbortController = new AbortController();
  const signal = selectionAbortController.signal;
  document.addEventListener("mousemove", handleMouseMove, {
    signal,
    capture: true,
  });
  document.addEventListener("click", handleClick, { signal, capture: true });
  document.addEventListener("keydown", handleKeyDown, {
    signal,
    capture: true,
  });
}

/** 停止元素选择模式 */
export function stopElementSelection(): void {
  if (!isSelectionMode) return;
  isSelectionMode = false;
  isConfirmMode = false;

  // 使用 AbortController 一次性移除所有事件监听
  selectionAbortController?.abort();
  selectionAbortController = null;

  // 清理 UI
  destroyHighlight();
  destroyBreadcrumb();
  destroyToolbar();

  // 重置状态
  selectedElement = null;
  hoverElement = null;
  currentSelector = "";
  onSelectCallback = null;
  onCancelCallback = null;
}

/** 更新工具栏为选择模式 */
function updateToolbarForSelection(): void {
  const { toolbarEl } = getToolbarElements();
  if (!toolbarEl) return;

  const children: Element[] = [];

  // 步骤指示器
  const stepIndicator = document.createElement("div");
  stepIndicator.innerHTML = `
    <span style="color:${theme.textSecondary};font-size:10px;margin-right:8px;">STEP 1/2</span>
    <span style="color:${theme.text};font-size:12px;font-weight:500;">Select Element</span>
  `;
  setStyle(stepIndicator, {
    display: "flex",
    alignItems: "center",
    background: theme.bg,
    padding: "2px 8px",
    borderRadius: theme.buttonBorderRadius,
    marginRight: "8px",
    border: `1px solid ${theme.border}`,
  });
  children.push(stepIndicator);

  // 分隔线
  children.push(createDivider());

  // 图标
  const icon = createSVGIcon("icon.24.interaction.click", theme.text);
  children.push(icon);

  // 提示文字
  const msg = document.createElement("span");
  msg.textContent = "Click an element to select, ESC to cancel";
  setStyle(msg, {
    flexGrow: "1",
    textAlign: "left",
    padding: "0 10px",
    color: theme.textSecondary,
    whiteSpace: "nowrap",
    fontSize: "12px",
  });
  children.push(msg);

  // 取消按钮
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  setStyle(cancelBtn, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: theme.buttonHeight,
    padding: "0 10px",
    border: `1px solid ${theme.border}`,
    borderRadius: theme.buttonBorderRadius,
    background: "transparent",
    color: theme.text,
    fontFamily: "inherit",
    fontSize: "11px",
    fontWeight: "500",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.15s ease",
  });
  cancelBtn.onmouseenter = () => {
    cancelBtn.style.background = theme.secondaryHover;
  };
  cancelBtn.onmouseleave = () => {
    cancelBtn.style.background = "transparent";
  };
  cancelBtn.onclick = () => {
    stopElementSelection();
    onCancelCallback?.();
  };
  children.push(cancelBtn);

  toolbarEl.replaceChildren(...children);
}

/** 进入确认模式 */
function enterConfirmMode(): void {
  isConfirmMode = true;

  // 隐藏面包屑
  hideBreadcrumb();

  // 隐藏 tooltip
  const { tooltipEl } = getHighlightElements();
  if (tooltipEl) {
    tooltipEl.style.display = "none";
  }

  // 创建确认工具栏
  createConfirmToolbar();

  // 保持高亮
  if (selectedElement) {
    highlightElement(selectedElement);
  }
}

/** 创建元素路径选择器 */
function createElementPathSelector(): HTMLElement {
  const { toolbarShadow, toolbarWrapper } = getToolbarElements();

  const container = document.createElement("div");
  setStyle(container, {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  });

  // 获取元素路径
  const path = getElementPath(selectedElement);

  // 当前元素显示（可点击展开）
  const currentBtn = document.createElement("button");
  currentBtn.type = "button";
  const currentTag = selectedElement?.tagName.toLowerCase() || "element";
  const currentId = selectedElement?.id ? `#${selectedElement.id}` : "";
  const currentClass = selectedElement?.className && typeof selectedElement.className === "string"
    ? `.${selectedElement.className.split(" ")[0]}`
    : "";
  currentBtn.textContent = currentTag + currentId + currentClass;
  setStyle(currentBtn, {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "28px",
    padding: "0 8px",
    border: `1px solid ${theme.brand}`,
    borderRadius: theme.buttonBorderRadius,
    background: theme.brandBg,
    color: theme.brand,
    fontFamily: "monospace",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.15s",
  });

  // 下拉箭头
  const arrow = document.createElement("span");
  arrow.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
  currentBtn.appendChild(arrow);

  // 下拉菜单
  let dropdown: HTMLElement | null = null;
  let isOpen = false;

  const closeDropdown = () => {
    if (dropdown) {
      dropdown.remove();
      dropdown = null;
      isOpen = false;
    }
  };

  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown();
      return;
    }

    // 创建下拉菜单 - 添加到 shadow root 的 wrapper 层级
    dropdown = document.createElement("div");
    setStyle(dropdown, {
      position: "fixed",
      background: theme.bg,
      border: `1px solid ${theme.border}`,
      borderRadius: "6px",
      boxShadow: theme.shadow,
      zIndex: "2147483647",
      minWidth: "200px",
      maxHeight: "300px",
      overflowY: "auto",
    });

    // 计算位置
    const btnRect = currentBtn.getBoundingClientRect();
    dropdown.style.top = `${btnRect.bottom + 4}px`;
    dropdown.style.left = `${btnRect.left}px`;

    // 添加路径项
    path.forEach((item, index) => {
      const itemEl = document.createElement("div");
      itemEl.textContent = item.label;
      const isCurrent = index === 0;
      setStyle(itemEl, {
        padding: "8px 12px",
        fontSize: "12px",
        fontFamily: "monospace",
        color: isCurrent ? theme.brand : theme.text,
        background: isCurrent ? theme.brandBg : "transparent",
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        borderBottom: index < path.length - 1 ? `1px solid ${theme.border}` : "none",
      });

      itemEl.onmouseenter = () => {
        if (!isCurrent) itemEl.style.background = theme.secondaryHover;
      };
      itemEl.onmouseleave = () => {
        itemEl.style.background = isCurrent ? theme.brandBg : "transparent";
      };

      itemEl.onclick = (e) => {
        e.stopPropagation();
        // 选择该元素
        if (item.element) {
          selectedElement = item.element;
          currentSelector = generateSelector(selectedElement);
          highlightElement(selectedElement);
          closeDropdown();
          createConfirmToolbar();
        }
      };

      dropdown!.appendChild(itemEl);
    });

    // 添加到 shadow root
    if (toolbarShadow) {
      toolbarShadow.appendChild(dropdown);
    }
    isOpen = true;

    // 点击外部关闭
    const closeOnClickOutside = (e: MouseEvent) => {
      if (dropdown && !dropdown.contains(e.target as Node) && !container.contains(e.target as Node)) {
        closeDropdown();
        document.removeEventListener("click", closeOnClickOutside, true);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", closeOnClickOutside, true);
    }, 0);
  };

  currentBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleDropdown();
  };

  container.appendChild(currentBtn);
  return container;
}

/** 获取元素路径（从当前元素到 body） */
function getElementPath(el: Element | null): Array<{ element: Element; label: string }> {
  const path: Array<{ element: Element; label: string }> = [];

  if (!el) return path;

  let current: Element | null = el;
  while (current && current !== document.documentElement) {
    const tagName = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : "";
    const className = current.className && typeof current.className === "string"
      ? `.${current.className.split(" ")[0]}`
      : "";

    let label = tagName + id + className;
    // 如果没有 id 和 class，添加 nth-child
    if (!id && !className && current.parentElement) {
      const siblings = Array.from(current.parentElement.children);
      const index = siblings.indexOf(current) + 1;
      label = `${tagName}:nth-child(${index})`;
    }

    path.push({ element: current, label });

    if (current === document.body) break;
    current = current.parentElement;
  }

  return path;
}

/** 创建确认工具栏 */
function createConfirmToolbar(): void {
  const { toolbarHost, toolbarWrapper, toolbarEl } = getToolbarElements();

  if (!toolbarHost || !selectedElement) return;

  // 清除工具栏内容
  if (toolbarEl) {
    toolbarEl.innerHTML = "";
  }

  // 创建确认工具栏内容
  const children: Element[] = [];

  // 步骤指示器
  const stepIndicator = document.createElement("div");
  stepIndicator.innerHTML = `
    <span style="color:${theme.textSecondary};font-size:10px;margin-right:8px;">STEP 2/2</span>
    <span style="color:${theme.brand};font-size:12px;font-weight:500;">Selected</span>
  `;
  setStyle(stepIndicator, {
    display: "flex",
    alignItems: "center",
    background: theme.bg,
    padding: "2px 8px",
    borderRadius: theme.buttonBorderRadius,
    marginRight: "8px",
    border: `1px solid ${theme.border}`,
  });
  children.push(stepIndicator);

  children.push(createDivider());

  // 1. 元素路径选择器（下拉菜单）
  const pathSelector = createElementPathSelector();
  children.push(pathSelector);

  children.push(createDivider());

  // 2. 提取按钮（蓝色主按钮）
  const extractBtn = createIconButton("icon.24.check", "Extract", () => {
    if (selectedElement && currentSelector && onSelectCallback) {
      const element = selectedElement;
      const selector = currentSelector;
      const callback = onSelectCallback;
      stopElementSelection();
      callback(element, selector);
    }
  }, "primary");
  children.push(extractBtn);

  // 4. 取消按钮
  const cancelBtn = createIconButton("icon.24.close.large", "", () => {
    isConfirmMode = false;
    selectedElement = null;
    currentSelector = "";

    // 恢复选择模式 UI
    updateToolbarForSelection();

    // 恢复 tooltip 显示
    const { tooltipEl: tooltip } = getHighlightElements();
    if (tooltip && hoverElement) {
      tooltip.style.display = "block";
    }
  });
  children.push(cancelBtn);

  if (toolbarEl) {
    toolbarEl.replaceChildren(...children);
  }

  // 定位工具栏在元素上方
  const rect = selectedElement.getBoundingClientRect();
  const gap = 8;

  // 测量宽度
  if (toolbarWrapper) {
    toolbarWrapper.style.visibility = "hidden";
    const actualWidth = toolbarWrapper.offsetWidth || 280;

    // 水平居中
    let left = rect.left + rect.width / 2 - actualWidth / 2;
    if (left < 8) left = 8;
    if (left + actualWidth > window.innerWidth - 8) {
      left = window.innerWidth - actualWidth - 8;
    }

    // 垂直位置
    const toolbarHeight = 40;
    let top = rect.top - toolbarHeight - gap;
    if (top < 8) {
      top = rect.bottom + gap;
    }

    setStyle(toolbarWrapper, {
      top: `${top}px`,
      left: `${left}px`,
      transform: "translateX(0)",
      visibility: "visible",
    });
  }
}

/** 鼠标移动处理 */
function handleMouseMove(e: MouseEvent): void {
  // 点击后已选中，不再响应悬停
  if (selectedElement) return;

  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  const target = elements.find((el) => !isToolbarElement(el));

  if (target && target !== hoverElement) {
    hoverElement = target;
    highlightElement(target);
  }
}

/** 点击处理 */
function handleClick(e: MouseEvent): void {
  // 如果点击的是工具栏或面包屑，忽略
  if (isToolbarElement(e.target as Element)) return;
  const breadcrumbEl = getBreadcrumbElement();
  if (breadcrumbEl && breadcrumbEl.contains(e.target as Element)) return;

  e.preventDefault();
  e.stopPropagation();

  if (hoverElement) {
    selectedElement = hoverElement;
    currentSelector = generateSelector(selectedElement);

    // 进入确认模式
    enterConfirmMode();
  }
}

/** 键盘处理 */
function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    stopElementSelection();
    onCancelCallback?.();
  }
}

/** 面包屑点击处理 */
function handleBreadcrumbClick(depth: number): void {
  if (depth === -1) {
    // 提取按钮点击
    if (selectedElement && currentSelector && onSelectCallback) {
      stopElementSelection();
      onSelectCallback(selectedElement, currentSelector);
    }
    return;
  }

  // 选择祖先元素
  let target: Element | null = selectedElement || hoverElement;
  let currentDepth = 0;
  while (target && currentDepth < depth) {
    target = target.parentElement;
    if (!target || target === document.body) break;
    currentDepth++;
  }

  if (target) {
    selectedElement = target;
    currentSelector = generateSelector(target);
    highlightElement(target);
  }
}

/** 生成元素选择器 */
function generateSelector(el: Element): string {
  if (el === document.body) return "body";
  if (el === document.documentElement) return "html";

  // 优先使用 ID
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }

  // 尝试使用唯一类名
  if (el.classList.length > 0) {
    for (const cls of el.classList) {
      const selector = `.${CSS.escape(cls)}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }

  // 构建层级路径
  const path: string[] = [];
  let current: Element | null = el;

  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName,
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(" > ");
}

/** 显示提示 Toast */
function showToast(message: string): void {
  const toast = document.createElement("div");
  setStyle(toast, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: theme.brand,
    color: theme.textOnBrand,
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: theme.fontFamily,
    fontWeight: "500",
    zIndex: "2147483647",
    boxShadow: theme.shadow,
    animation: "pop .3s ease-out",
  });
  toast.textContent = message;

  // 添加动画样式
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pop { from { opacity: 0; transform: translateX(-50%) scale(0.8); } to { opacity: 1; transform: translateX(-50%) scale(1); } }
    @keyframes fade { to { opacity: 0; transform: translateX(-50%) scale(0.8); } }
  `;
  toast.appendChild(style);

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "fade .3s ease-out forwards";
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// 导出状态查询函数
export function isInSelectionMode(): boolean {
  return isSelectionMode;
}
export function isInConfirmMode(): boolean {
  return isConfirmMode;
}
export function getSelectedElement(): Element | null {
  return selectedElement;
}
export function getCurrentSelector(): string {
  return currentSelector;
}
