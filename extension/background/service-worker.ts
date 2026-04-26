/**
 * Service Worker - 后台脚本
 * 管理 chrome.debugger 和 CDP 命令执行
 */

import { createCDPClient } from '../utils/cdp-client';
import {
  assembleStyles,
  type StyleExtractionResult
} from '../utils/style-assembler';

// 当前活动的标签页 ID
let activeTabId: number | null = null;

/**
 * 消息类型定义
 */
interface Message {
  type: string;
  selector?: string;
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
      const { selector, pseudoStates } = message;
      const tabId = sender.tab?.id;
      if (tabId && selector) {
        handleElementSelected(selector, tabId, pseudoStates || ['hover'])
          .then(() => sendResponse({ success: true }))
          .catch(err => {
            console.error('Extraction failed:', err);
            sendResponse({ success: false, error: err.message });
          });
        return true; // 异步响应
      }
      break;
    }

    case 'EXTRACT_REQUEST': {
      const { selector, tabId, pseudoStates } = message;
      if (selector && tabId) {
        handleElementSelected(selector, tabId, pseudoStates || ['hover'])
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
      chrome.storage.local.remove('extractResult')
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }

    case 'START_PICKING_FROM_SHORTCUT': {
      const tabId = sender.tab?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'START_PICKING' })
          .then(() => sendResponse({ success: true }))
          .catch(err => sendResponse({ error: err.message }));
        return true;
      }
      break;
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
  pseudoStates: string[]
): Promise<void> {
  activeTabId = tabId;
  const client = createCDPClient(tabId);
  let nodeId: number | null = null;

  try {
    // 1. Attach debugger
    await client.attach();

    // 2. Wait briefly for DOM to stabilize, then query node ID
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. Get document root node, then query from root
    const documentNodeId = await client.getDocument();
    if (!documentNodeId) {
      throw new Error('Unable to get document root node');
    }

    // 4. Query node ID (with retry)
    let retries = 3;
    while (retries > 0) {
      nodeId = await client.querySelector(selector, documentNodeId);
      if (nodeId) break;
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (!nodeId) {
      throw new Error(`Unable to locate element: ${selector}. Please try re-selecting.`);
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

    // 6. Get matched styles
    const stylesData = await client.getMatchedStylesForNode(nodeId);

    // 7. Get html element styles (for extracting CSS variables from :root)
    let rootStyles = null;
    try {
      const htmlNodeId = await client.querySelector('html', documentNodeId);
      if (htmlNodeId) {
        rootStyles = await client.getMatchedStylesForNode(htmlNodeId);
      }
    } catch (err) {
      console.warn('Failed to get html styles:', err);
    }

    // 8. Collect all related stylesheet IDs
    const styleSheetIds = new Set<string>();

    // 从匹配规则中收集
    if (stylesData.matchedCSSRules) {
      for (const rule of stylesData.matchedCSSRules) {
        if (rule.rule.styleSheetId) {
          styleSheetIds.add(rule.rule.styleSheetId);
        }
      }
    }

    // 从 rootStyles 中收集
    if (rootStyles?.matchedCSSRules) {
      for (const rule of rootStyles.matchedCSSRules) {
        if (rule.rule.styleSheetId) {
          styleSheetIds.add(rule.rule.styleSheetId);
        }
      }
    }

    // 从继承样式中收集
    if (stylesData.inherited) {
      for (const inherited of stylesData.inherited) {
        if (inherited.matchedCSSRules) {
          for (const rule of inherited.matchedCSSRules) {
            if (rule.rule.styleSheetId) {
              styleSheetIds.add(rule.rule.styleSheetId);
            }
          }
        }
      }
    }

    // 从伪元素中收集
    if (stylesData.pseudoElements) {
      for (const pseudoEl of stylesData.pseudoElements as Array<{
        matches?: Array<{ rule: { styleSheetId?: string } }>;
      }>) {
        if (pseudoEl.matches) {
          for (const rule of pseudoEl.matches) {
            if (rule.rule.styleSheetId) {
              styleSheetIds.add(rule.rule.styleSheetId);
            }
          }
        }
      }
    }

    // 9. Get all stylesheet texts, extract CSS variable definitions
    const allStylesheetTexts: string[] = [];
    const allCSSVariableDefinitions = new Map<string, string>();

    for (const styleSheetId of styleSheetIds) {
      try {
        const text = await client.getStyleSheetText(styleSheetId);
        if (text) {
          allStylesheetTexts.push(text);
          // 从样式表文本中提取所有 CSS 变量定义
          extractAllCSSVariables(text, allCSSVariableDefinitions);
        }
      } catch (err) {
        console.warn(`Failed to fetch stylesheet ${styleSheetId}:`, err);
      }
    }

    // 10. Get font information
    const fonts = await client.getPlatformFontsForNode(nodeId);

    // 11. Get element HTML
    const outerHTML = await client.getOuterHTML(nodeId);

    // 12. Get computed styles (for Strategy D: replacing unresolved CSS variables)
    let computedStyles: Record<string, string> | undefined;
    try {
      computedStyles = await client.getComputedStyleForNode(nodeId);
    } catch (err) {
      console.warn('Failed to get computed styles:', err);
    }

    // 13. Assemble styles, passing all CSS variable definitions
    const assembled = assembleStyles(
      stylesData,
      fonts,
      selector,
      pseudoStates,
      rootStyles || undefined,
      computedStyles,
      allCSSVariableDefinitions  // 新增：传入预先提取的所有 CSS 变量
    );

    // 14. Build final result
    const externalCSS = allStylesheetTexts.map((text, i) => `/* Stylesheet ${i + 1} */\n${text}`).join('\n\n');

    const result: StyleExtractionResult = {
      html: outerHTML,
      css: assembled.css + (externalCSS ? '\n\n/* ========== External Stylesheets ========== */\n' + externalCSS : ''),
      inlineCSS: assembled.inlineCSS,
      matchedCSS: assembled.matchedCSS,
      inheritedCSS: assembled.inheritedCSS,
      pseudoElementCSS: assembled.pseudoElementCSS,
      cssVariables: assembled.cssVariables,
      fontInfo: assembled.fontInfo,
      styleSheetIds: styleSheetIds,
      metadata: {
        selector,
        timestamp: Date.now(),
        pseudoStates,
        hasPseudoElements: assembled.pseudoElementCSS.length > 0,
        inheritedDepth: assembled.inheritedCSS.length > 0 ? 1 : 0,
      },
    };

    // 15. Save to storage
    await chrome.storage.local.set({ extractResult: result });

    // 16. Notify popup of completion (may fail, ignore errors)
    try {
      await chrome.runtime.sendMessage({ type: 'EXTRACT_COMPLETE' });
    } catch {
      // Popup 可能已关闭，忽略
    }

    // 17. Automatically open options page to display results
    try {
      await chrome.runtime.openOptionsPage();
    } catch (e) {
      console.log('Could not open options page:', e);
    }

  } catch (error) {
    console.error('Extraction error:', error);
    // 发送错误通知（可能失败，忽略错误）
    try {
      await chrome.runtime.sendMessage({
        type: 'EXTRACT_ERROR',
        error: error instanceof Error ? error.message : 'Extraction failed',
      });
    } catch {
      // 忽略
    }
    throw error; // 重新抛出以便外层处理

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
        // 只保存第一次出现的定义（CSS 层级优先级）
        if (!definitions.has(varName)) {
          definitions.set(varName, varValue);
        }
      }
    }
  }
}
