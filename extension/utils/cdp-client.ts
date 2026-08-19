/**
 * CDP (Chrome DevTools Protocol) 客户端封装
 * 用于与 chrome.debugger API 交互
 */

export interface CDPResponse<T = unknown> {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

export interface MatchedCSSRule {
  rule: {
    selectorList: {
      text: string;
    };
    style: {
      cssText: string;
    };
    styleSheetId?: string;
    origin?: string;
  };
  matchingSelectors: number[];
}

export interface InheritedStyleEntry {
  inlineStyle?: CSSStyle;
  matchedCSSRules?: MatchedCSSRule[];
}

export interface CSSStyle {
  cssText: string;
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface MatchedStylesForNode {
  inlineStyle?: CSSStyle;
  attributesStyle?: CSSStyle;
  matchedCSSRules?: MatchedCSSRule[];
  inherited?: InheritedStyleEntry[];
  cssKeyframesRules?: unknown[];
  pseudoElements?: unknown[];
}

export interface PlatformFont {
  familyName: string;
  isCustomFont: boolean;
  glyphCount: number;
}

export interface PlatformFontsForNode {
  fonts: PlatformFont[];
}

/**
 * CDP 客户端类
 */
export class CDPClient {
  private tabId: number;
  private attached = false;
  private detachListener: ((source: chrome.debugger.Debuggee) => void) | null = null;

  constructor(tabId: number) {
    this.tabId = tabId;
  }

  /**
   * 附加调试器到标签页
   */
  async attach(): Promise<void> {
    if (this.attached) return;

    await chrome.debugger.attach({ tabId: this.tabId }, "1.3");
    this.attached = true;

    // 启用必要的域
    await this.sendCommand("DOM.enable");
    await this.sendCommand("CSS.enable");
    await this.sendCommand("Runtime.enable");

    this.detachListener = (source) => {
      if (source.tabId === this.tabId) {
        this.attached = false;
      }
    };
    chrome.debugger.onDetach.addListener(this.detachListener);
  }

  /**
   * 分离调试器
   */
  async detach(): Promise<void> {
    if (this.detachListener) {
      chrome.debugger.onDetach.removeListener(this.detachListener);
      this.detachListener = null;
    }

    if (!this.attached) return;

    await chrome.debugger.detach({ tabId: this.tabId });
    this.attached = false;
  }

  /**
   * 发送 CDP 命令
   */
  async sendCommand<T = unknown>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const response = await chrome.debugger.sendCommand(
      { tabId: this.tabId },
      method,
      params
    );
    return response as T;
  }

  /**
   * 通过选择器查询节点 ID
   */
  async querySelector(selector: string, nodeId = 0): Promise<number> {
    const result = await this.sendCommand<{ nodeId: number }>("DOM.querySelector", {
      nodeId,
      selector,
    });
    return result.nodeId;
  }

  /**
   * 通过节点 ID 查询选择器
   */
  async querySelectorAll(selector: string, nodeId = 0): Promise<number[]> {
    const result = await this.sendCommand<{ nodeIds: number[] }>("DOM.querySelectorAll", {
      nodeId,
      selector,
    });
    return result.nodeIds;
  }

  /**
   * 获取节点的匹配样式
   */
  async getMatchedStylesForNode(nodeId: number): Promise<MatchedStylesForNode> {
    return await this.sendCommand<MatchedStylesForNode>("CSS.getMatchedStylesForNode", {
      nodeId,
    });
  }

  /**
   * 强制设置伪类状态
   */
  async forcePseudoState(
    nodeId: number,
    states: { hover?: boolean; active?: boolean; focus?: boolean; visited?: boolean }
  ): Promise<void> {
    const forcedPseudoClasses: string[] = [];
    if (states.hover) forcedPseudoClasses.push("hover");
    if (states.active) forcedPseudoClasses.push("active");
    if (states.focus) forcedPseudoClasses.push("focus");
    if (states.visited) forcedPseudoClasses.push("visited");

    await this.sendCommand("CSS.forcePseudoState", {
      nodeId,
      forcedPseudoClasses,
    });
  }

  /**
   * 获取平台字体信息
   */
  async getPlatformFontsForNode(nodeId: number): Promise<PlatformFont[]> {
    const result = await this.sendCommand<PlatformFontsForNode>("CSS.getPlatformFontsForNode", {
      nodeId,
    });
    return result.fonts || [];
  }

  /**
   * 获取元素外部 HTML
   */
  async getOuterHTML(nodeId: number): Promise<string> {
    const result = await this.sendCommand<{ outerHTML: string }>("DOM.getOuterHTML", {
      nodeId,
    });
    return result.outerHTML;
  }

  /**
   * 获取样式表文本
   */
  async getStyleSheetText(styleSheetId: string): Promise<string> {
    const result = await this.sendCommand<{ text: string }>("CSS.getStyleSheetText", {
      styleSheetId,
    });
    return result.text;
  }

  /**
   * 获取元素的计算样式
   * 用于策略 D: 获取 CSS 变量的实际渲染值
   */
  async getComputedStyleForNode(nodeId: number): Promise<Record<string, string>> {
    const result = await this.sendCommand<{ computedStyle: Array<{ name: string; value: string }> }>(
      "CSS.getComputedStyleForNode",
      { nodeId }
    );

    // 转换为键值对格式
    const computedStyles: Record<string, string> = {};
    if (result.computedStyle) {
      for (const prop of result.computedStyle) {
        computedStyles[prop.name] = prop.value;
      }
    }
    return computedStyles;
  }

  /**
   * 获取文档根节点
   */
  async getDocument(): Promise<number> {
    const result = await this.sendCommand<{ root: { nodeId: number } }>("DOM.getDocument");
    return result.root.nodeId;
  }

  /**
   * 描述节点信息
   */
  async describeNode(nodeId: number): Promise<unknown> {
    return await this.sendCommand("DOM.describeNode", { nodeId });
  }
}

/**
 * 创建 CDP 客户端实例
 */
export function createCDPClient(tabId: number): CDPClient {
  return new CDPClient(tabId);
}
