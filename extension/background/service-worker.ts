/**
 * Service Worker - 后台脚本
 * 管理 chrome.debugger 和 CDP 命令执行
 */

import { createCDPClient } from '../utils/cdp-client';
import { collectHtmlTokens, filterStylesheet } from '../utils/css-filter';
import { extractMarkerSelector, stripExtractMarker } from '../utils/extract-marker';
import {
  assembleStyles,
  collectStyleSheetIds,
  mergeDescendantStyles,
  type StyleExtractionResult
} from '../utils/style-assembler';
import type { MatchedStylesForNode } from '../utils/cdp-client';

const MAX_DESCENDANTS = 400;
const DESCENDANT_CONCURRENCY = 12;
const DESCENDANT_SELECTOR = '[class], button, a, img, svg, [role]';

// 当前活动的标签页 ID
let activeTabId: number | null = null;

/**
 * 消息类型定义
 */
interface Message {
  type: string;
  selector?: string;
  extractId?: string;
  tabId?: number;
  pseudoStates?: string[];
}

/**
 * 监听来自 content script 和 popup 的消息
 */
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  const { type } = message;

  switch (type) {
    case 'ELEMENT_SELECTED': {
      const { selector, extractId, pseudoStates } = message;
      const tabId = sender.tab?.id;
      if (tabId && (extractId || selector)) {
        handleElementSelected(selector || '', tabId, pseudoStates || [], extractId)
          .then(() => sendResponse({ success: true }))
          .catch(err => {
            console.error('Extraction failed:', err);
            sendResponse({ success: false, error: err.message });
          });
        return true;
      }
      break;
    }

    case 'EXTRACT_REQUEST': {
      const { selector, extractId, tabId, pseudoStates } = message;
      if (tabId && (extractId || selector)) {
        handleElementSelected(selector || '', tabId, pseudoStates || [], extractId)
          .then(() => sendResponse({ success: true }))
          .catch(err => {
            console.error('Extraction failed:', err);
            sendResponse({ success: false, error: err.message });
          });
        return true;
      }
      break;
    }

    case 'GET_RESULT': {
      chrome.storage.local.get('extractResult')
        .then(result => sendResponse(result.extractResult))
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }

    case 'CLEAR_RESULT': {
      chrome.storage.local.remove(['extractResult', 'extractError', 'extractProgress'])
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }
  }

  return false;
});

/**
 * 处理元素选择事件
 */
async function handleElementSelected(
  selector: string,
  tabId: number,
  pseudoStates: string[],
  extractId?: string
): Promise<void> {
  activeTabId = tabId;
  const client = createCDPClient(tabId);
  let nodeId: number | null = null;

  try {
    await chrome.storage.local.remove(['extractResult', 'extractError']);
    await reportProgress(tabId, 'Connecting to page…', 0.06);
    try {
      await chrome.runtime.openOptionsPage();
    } catch (e) {
      console.log('Could not open options page:', e);
    }

    await client.attach();
    await new Promise(resolve => setTimeout(resolve, 80));
    await reportProgress(tabId, 'Locating selected element…', 0.14);

    // 3. Get document root node, then query from root
    const documentNodeId = await client.getDocument();
    if (!documentNodeId) {
      throw new Error('Unable to get document root node');
    }

    const lookupSelector = extractId ? extractMarkerSelector(extractId) : selector;

    let retries = 3;
    while (retries > 0) {
      nodeId = await client.querySelector(lookupSelector, documentNodeId);
      if (nodeId) break;
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (!nodeId && extractId && selector) {
      nodeId = await client.querySelector(selector, documentNodeId);
    }

    if (!nodeId) {
      throw new Error(`Unable to locate element: ${selector || lookupSelector}. Please try re-selecting.`);
    }

    // 5. Force pseudo-class states
    try {
      await client.forcePseudoState(nodeId, {
        hover: pseudoStates.includes('hover'),
        active: pseudoStates.includes('active'),
        focus: pseudoStates.includes('focus'),
        visited: pseudoStates.includes('visited'),
      });
    } catch (err) {
      console.warn('Force pseudo state failed:', err);
      // 继续执行，不强制退出
    }

    await reportProgress(tabId, 'Reading HTML…', 0.22);
    const outerHTML = stripExtractMarker(await client.getOuterHTML(nodeId));

    const rootMatched = await client.getMatchedStylesForNode(nodeId);

    let descendantIds: number[] = [];
    try {
      descendantIds = uniqueIds(
        await client.querySelectorAll(DESCENDANT_SELECTOR, nodeId)
      ).slice(0, MAX_DESCENDANTS);
    } catch (err) {
      console.warn('Failed to list descendant nodes:', err);
    }

    await reportProgress(tabId, `Collecting descendant styles (0/${descendantIds.length})…`, 0.28);

    let completed = 0;
    const descendantStyles = await mapPool(
      descendantIds,
      DESCENDANT_CONCURRENCY,
      async (id) => {
        try {
          const styles = await client.getMatchedStylesForNode(id);
          completed += 1;
          if (completed === descendantIds.length || completed % 20 === 0) {
            const ratio = 0.28 + (completed / Math.max(descendantIds.length, 1)) * 0.4;
            await reportProgress(
              tabId,
              `Collecting descendant styles (${completed}/${descendantIds.length})…`,
              ratio
            );
          }
          return styles;
        } catch (err) {
          console.warn(`Failed to get styles for descendant ${id}:`, err);
          completed += 1;
          return null;
        }
      }
    );

    const stylesData = mergeDescendantStyles(
      rootMatched,
      descendantStyles.filter((styles): styles is MatchedStylesForNode => styles !== null)
    );

    let rootStyles = null;
    try {
      const htmlNodeId = await client.querySelector('html', documentNodeId);
      if (htmlNodeId) {
        rootStyles = await client.getMatchedStylesForNode(htmlNodeId);
      }
    } catch (err) {
      console.warn('Failed to get html styles:', err);
    }

    const styleSheetIds = new Set<string>();
    collectStyleSheetIds(stylesData, styleSheetIds);
    if (rootStyles) {
      collectStyleSheetIds(rootStyles, styleSheetIds);
    }

    await reportProgress(tabId, 'Filtering matching stylesheet rules…', 0.78);

    const allCSSVariableDefinitions = new Map<string, string>();
    const tokens = collectHtmlTokens(outerHTML);
    const relevantSheets: string[] = [];

    for (const styleSheetId of styleSheetIds) {
      try {
        const text = await client.getStyleSheetText(styleSheetId);
        if (text) {
          extractAllCSSVariables(text, allCSSVariableDefinitions);
          const filtered = filterStylesheet(text, tokens);
          if (filtered) relevantSheets.push(filtered);
        }
      } catch (err) {
        console.warn(`Failed to fetch stylesheet ${styleSheetId}:`, err);
      }
    }

    await reportProgress(tabId, 'Assembling CSS…', 0.9);

    const fonts = await client.getPlatformFontsForNode(nodeId);

    let computedStyles: Record<string, string> | undefined;
    try {
      computedStyles = await client.getComputedStyleForNode(nodeId);
    } catch (err) {
      console.warn('Failed to get computed styles:', err);
    }

    const assembled = assembleStyles(
      stylesData,
      fonts,
      selector,
      pseudoStates,
      rootStyles || undefined,
      computedStyles,
      allCSSVariableDefinitions,
      tokens
    );

    await reportProgress(tabId, 'Pruning unused CSS…', 0.94);
    let relevantCSS = relevantSheets.join('\n\n');
    if (relevantCSS) {
      try {
        const pruned = await chrome.tabs.sendMessage(tabId, {
          type: 'PRUNE_CSS',
          html: outerHTML,
          css: relevantCSS,
        }) as { css?: string } | undefined;
        if (typeof pruned?.css === 'string') {
          relevantCSS = pruned.css;
        }
      } catch (err) {
        console.warn('DOM prune failed, using token filter only:', err);
      }
    }

    const css = relevantCSS
      ? `${assembled.css}\n\n/* ========== Stylesheet rules used by this subtree ========== */\n${relevantCSS}`
      : assembled.css;

    const result: StyleExtractionResult = {
      html: outerHTML,
      css,
      inlineCSS: assembled.inlineCSS,
      matchedCSS: assembled.matchedCSS,
      inheritedCSS: assembled.inheritedCSS,
      pseudoElementCSS: assembled.pseudoElementCSS,
      cssVariables: assembled.cssVariables,
      fontInfo: assembled.fontInfo,
      styleSheetIds: assembled.styleSheetIds,
      metadata: {
        selector,
        timestamp: Date.now(),
        pseudoStates,
        hasPseudoElements: assembled.hasPseudoElements,
        inheritedDepth: assembled.inheritedDepth,
        descendantCount: descendantIds.length,
      },
    };

    await chrome.storage.local.remove(['extractError', 'extractProgress']);
    await chrome.storage.local.set({ extractResult: result });

    try {
      await chrome.runtime.sendMessage({ type: 'EXTRACT_COMPLETE' });
    } catch {
      // Options 可能尚未就绪，忽略
    }

  } catch (error) {
    console.error('Extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Extraction failed';
    try {
      await chrome.storage.local.remove(['extractResult', 'extractProgress']);
      await chrome.storage.local.set({ extractError: errorMessage });
    } catch {
      // 忽略
    }
    try {
      await chrome.runtime.sendMessage({
        type: 'EXTRACT_ERROR',
        error: errorMessage,
      });
    } catch {
      // 忽略
    }
    throw error;

  } finally {
    // 取消伪类状态（如果 nodeId 有效）
    if (nodeId) {
      try {
        await client.forcePseudoState(nodeId, {
          hover: false,
          active: false,
          focus: false,
          visited: false,
        });
      } catch {
        // 忽略清理错误
      }
    }

    // 分离调试器
    try {
      await client.detach();
    } catch {
      // 忽略分离错误
    }
  }
}

/**
 * 监听标签页关闭事件，清理调试器
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    activeTabId = null;
  }
});

/**
 * 监听扩展安装/更新事件
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Style Extractor installed:', details.reason);
});

async function reportProgress(tabId: number, message: string, ratio: number): Promise<void> {
  const extractProgress = { message, ratio };
  try {
    await chrome.storage.local.set({ extractProgress });
  } catch {
    // 忽略
  }
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PROGRESS', message, ratio });
  } catch {
    // 页面可能已关闭
  }
  try {
    await chrome.runtime.sendMessage({ type: 'EXTRACT_PROGRESS', message, ratio });
  } catch {
    // Options 可能尚未打开
  }
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => id > 0))];
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * 从 CSS 文本中提取所有 CSS 变量定义
 * 用于策略 B：从所有样式表中遍历提取变量
 */
function extractAllCSSVariables(cssText: string, definitions: Map<string, string>): void {
  // 匹配所有规则块
  const rulePattern = /[^{}]+\{([^}]+)\}/g;
  let match;

  while ((match = rulePattern.exec(cssText)) !== null) {
    const ruleContent = match[1];
    // 解析规则中的 CSS 变量定义
    const props = ruleContent.split(';');
    for (const prop of props) {
      const trimmed = prop.trim();
      if (!trimmed) continue;

      // 匹配 CSS 变量定义: --name: value
      const varMatch = trimmed.match(/^(--[a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
      if (varMatch) {
        const varName = varMatch[1];
        const varValue = varMatch[2].trim();
        definitions.set(varName, varValue);
      }
    }
  }
}
