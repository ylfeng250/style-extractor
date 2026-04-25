/**
 * 面包屑导航组件
 */

import { theme } from "./theme";
import { getToolbarElements } from "./toolbar";

// DOM 元素引用
let breadcrumbEl: HTMLElement | null = null;

/** 设置元素样式 */
function setStyle(el: HTMLElement, styles: Record<string, string>): void {
  Object.assign(el.style, styles);
}

/** 面包屑点击回调 */
export type BreadcrumbClickHandler = (depth: number) => void;

let clickHandler: BreadcrumbClickHandler | null = null;

/** 初始化面包屑 */
export function initBreadcrumb(onClick?: BreadcrumbClickHandler): void {
  const { toolbarShadow } = getToolbarElements();
  if (!toolbarShadow) return;

  clickHandler = onClick || null;

  breadcrumbEl = document.createElement("div");
  setStyle(breadcrumbEl, {
    position: "fixed",
    pointerEvents: "auto",
    background: theme.bg,
    color: theme.text,
    padding: "4px 8px",
    borderRadius: theme.tooltipBorderRadius,
    fontSize: theme.fontSize,
    fontFamily: theme.fontFamily,
    fontWeight: theme.fontWeight,
    zIndex: "2147483646",
    display: "none",
    whiteSpace: "nowrap",
    boxShadow: theme.tooltipShadow,
    border: `1px solid ${theme.border}`,
    marginTop: "4px",
  });
  toolbarShadow.appendChild(breadcrumbEl);
}

/** 销毁面包屑 */
export function destroyBreadcrumb(): void {
  if (breadcrumbEl) {
    breadcrumbEl.remove();
    breadcrumbEl = null;
  }
  clickHandler = null;
}

/** 更新面包屑显示 */
export function updateBreadcrumb(el: Element, extractButton?: boolean): void {
  if (!breadcrumbEl) return;

  // 生成面包屑元素
  const breadcrumbElements = generateBreadcrumbElements(el);

  // 清空现有内容并添加面包屑元素
  breadcrumbEl.innerHTML = "";
  breadcrumbElements.forEach((child) => breadcrumbEl!.appendChild(child));

  // 添加提取按钮
  if (extractButton) {
    const extractBtn = document.createElement("span");
    extractBtn.className = "se-extract-btn";
    extractBtn.style.cssText = `background:${theme.brand};color:${theme.textOnBrand};padding:2px 8px;border-radius:3px;cursor:pointer;font-weight:600;margin-left:8px;`;
    extractBtn.textContent = "提取";
    extractBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (clickHandler) clickHandler(-1); // -1 表示提取当前
    });
    extractBtn.addEventListener("mouseenter", () => {
      extractBtn.style.background = theme.brandHover;
    });
    extractBtn.addEventListener("mouseleave", () => {
      extractBtn.style.background = theme.brand;
    });
    breadcrumbEl.appendChild(extractBtn);
  }

  setStyle(breadcrumbEl, { display: "flex", gap: "4px", alignItems: "center" });

  // 绑定面包屑点击事件
  setupBreadcrumbListeners();

  // 定位
  const rect = el.getBoundingClientRect();
  const breadcrumbRect = breadcrumbEl.getBoundingClientRect();
  let top = rect.bottom + 8 + 28; // 28px 是 tooltip 高度估计值
  let left = rect.left;

  // 边界检查
  if (left + breadcrumbRect.width > window.innerWidth - 8) {
    left = window.innerWidth - breadcrumbRect.width - 8;
  }
  if (left < 8) left = 8;

  setStyle(breadcrumbEl, { top: `${top}px`, left: `${left}px` });
}

/** 隐藏面包屑 */
export function hideBreadcrumb(): void {
  if (breadcrumbEl) {
    breadcrumbEl.style.display = "none";
  }
}

/** 设置面包屑点击监听 */
function setupBreadcrumbListeners(): void {
  if (!breadcrumbEl || !clickHandler) return;

  const spans = breadcrumbEl.querySelectorAll("span[data-depth]");
  spans.forEach((span) => {
    const htmlSpan = span as HTMLElement;
    // 移除旧的事件监听器（通过克隆）
    const newSpan = htmlSpan.cloneNode(true) as HTMLElement;
    htmlSpan.parentNode?.replaceChild(newSpan, htmlSpan);

    newSpan.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const depth = parseInt(newSpan.getAttribute("data-depth") || "0");
      clickHandler!(depth);
    });

    newSpan.addEventListener("mouseenter", () => {
      if (newSpan.getAttribute("data-depth") !== "0") {
        newSpan.style.background = theme.secondaryHover;
      }
    });

    newSpan.addEventListener("mouseleave", () => {
      if (newSpan.getAttribute("data-depth") !== "0") {
        newSpan.style.background = "transparent";
      }
    });
  });
}

/** 生成元素路径面包屑 */
function generateBreadcrumbElements(el: Element): HTMLElement[] {
  const elements: HTMLElement[] = [];
  let current: Element | null = el;
  const maxDepth = 5;
  let depth = 0;

  while (
    current &&
    current !== document.body &&
    current !== document.documentElement &&
    depth < maxDepth
  ) {
    const tagName = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : "";
    const className =
      current.className && typeof current.className === "string"
        ? `.${current.className.split(" ").slice(0, 1).join(".")}`
        : "";
    const label = tagName + (id || className ? "" : "");

    if (label || depth === 0) {
      const span = document.createElement("span");
      span.setAttribute("data-depth", (depth + 1).toString());
      span.style.cssText = "cursor:pointer;padding:2px 4px;border-radius:2px;";
      span.textContent = label || tagName;
      elements.unshift(span);
    }
    current = current.parentElement;
    depth++;
  }

  // 添加当前元素到最前面
  const currentTag = el.tagName.toLowerCase();
  const currentId = el.id ? `#${el.id}` : "";
  const currentClass =
    el.className && typeof el.className === "string"
      ? `.${el.className.split(" ").slice(0, 1).join(".")}`
      : "";
  const currentLabel = currentTag + (currentId || currentClass ? "" : "");

  const currentSpan = document.createElement("span");
  currentSpan.setAttribute("data-depth", "0");
  currentSpan.style.cssText = `cursor:pointer;padding:2px 4px;border-radius:2px;background:${theme.brand};color:${theme.textOnBrand};font-weight:600;`;
  currentSpan.textContent = currentLabel || currentTag;
  elements.unshift(currentSpan);

  // 添加分隔符
  const result: HTMLElement[] = [];
  elements.forEach((span, index) => {
    result.push(span);
    if (index < elements.length - 1) {
      const sep = document.createElement("span");
      sep.style.cssText = `color:${theme.textSecondary};padding:0 2px;`;
      sep.textContent = "›";
      result.push(sep);
    }
  });

  return result;
}

/** 获取面包屑元素 */
export function getBreadcrumbElement(): HTMLElement | null {
  return breadcrumbEl;
}
