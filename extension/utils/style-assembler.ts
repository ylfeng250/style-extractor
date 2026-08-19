/**
 * 样式组装器
 * 将 CDP 返回的样式数据组装成可用的 CSS 文本
 */

import type { MatchedStylesForNode, PlatformFont, MatchedCSSRule } from './cdp-client';
import { narrowSelectorList, type HtmlTokens } from './css-filter';

export interface StyleExtractionResult {
  html: string;
  css: string;
  inlineCSS: string;
  matchedCSS: string;
  inheritedCSS: string;
  pseudoElementCSS: string;
  cssVariables: string;
  fontInfo: string;
  styleSheetIds: string[];
  metadata: {
    selector: string;
    timestamp: number;
    pseudoStates: string[];
    hasPseudoElements: boolean;
    inheritedDepth: number;
    descendantCount: number;
  };
}

/**
 * 组装样式数据为最终的 CSS 文本
 * @param computedStyles 可选的计算样式，用于策略 D 替换未解析的变量
 * @param externalVarDefinitions 从外部样式表预先提取的 CSS 变量定义
 */
export function assembleStyles(
  stylesData: MatchedStylesForNode,
  fonts: PlatformFont[],
  selector: string,
  pseudoStates: string[] = [],
  rootStyles?: MatchedStylesForNode,
  computedStyles?: Record<string, string>,
  externalVarDefinitions?: Map<string, string>,
  htmlTokens?: HtmlTokens
): Omit<StyleExtractionResult, 'html' | 'metadata'> & {
  styleSheetIds: string[];
  hasPseudoElements: boolean;
  inheritedDepth: number;
} {
  const parts: string[] = [];
  const styleSheetIds = new Set<string>();
  let hasPseudoElements = false;
  let inheritedDepth = 0;

  // 0. 添加标题头
  parts.push(`/* ============================================ */`);
  parts.push(`/* Style Extractor - Extracted Styles          */`);
  parts.push(`/* Selector: ${selector} */`);
  if (pseudoStates.length > 0) {
    parts.push(`/* Active pseudo-classes: ${pseudoStates.join(', ')} */`);
  }
  parts.push(`/* ============================================ */\n`);

  // 1. 处理 CSS 变量
  let cssVariables = '';
  const cssVarParts: string[] = [];

  // 从元素样式中提取使用的 CSS 变量
  const usedVariables = extractUsedCSSVariables(stylesData);

  // 收集所有变量定义
  const allVarDefinitions = new Map<string, string>();

  // 优先使用外部预先提取的 CSS 变量定义（策略 B：从所有样式表遍历）
  if (externalVarDefinitions) {
    externalVarDefinitions.forEach((value, key) => {
      allVarDefinitions.set(key, value);
    });
  }

  // 从 rootStyles 获取变量定义
  if (rootStyles?.matchedCSSRules) {
    for (const rule of rootStyles.matchedCSSRules) {
      const styleText = rule.rule.style.cssText;
      if (!styleText) continue;

      parseVariableDefinitions(styleText, allVarDefinitions);

      if (rule.rule.styleSheetId) {
        styleSheetIds.add(rule.rule.styleSheetId);
      }
    }
  }

  // 从匹配的 CSS 规则中提取变量定义
  if (stylesData.matchedCSSRules) {
    for (const rule of stylesData.matchedCSSRules) {
      const styleText = rule.rule.style.cssText;
      if (!styleText) continue;
      parseVariableDefinitions(styleText, allVarDefinitions);
    }
  }

  // 从继承样式中获取变量定义
  if (stylesData.inherited) {
    for (const inherited of stylesData.inherited) {
      if (inherited.matchedCSSRules) {
        for (const rule of inherited.matchedCSSRules) {
          const styleText = rule.rule.style.cssText;
          if (!styleText) continue;
          parseVariableDefinitions(styleText, allVarDefinitions);
        }
      }
    }
  }

  // 递归解析变量依赖
  const { resolved, unresolved } = resolveVariableDependencies(allVarDefinitions, usedVariables);

  // 策略 D: 如果有未解析的变量且有计算样式，用计算值填充
  if (unresolved.size > 0 && computedStyles) {
    const computedValues = extractComputedVariableValues(computedStyles);
    computedValues.forEach((value, varName) => {
      if (unresolved.has(varName) && !allVarDefinitions.has(varName)) {
        allVarDefinitions.set(varName, value);
        unresolved.delete(varName);
      }
    });
  }

  // 生成 CSS 变量输出
  const allResolvedVars = new Set([...resolved, ...unresolved]);
  if (allResolvedVars.size > 0 && allVarDefinitions.size > 0) {
    const varDeclarations: string[] = [];
    allResolvedVars.forEach(varName => {
      const value = allVarDefinitions.get(varName);
      if (value !== undefined) {
        if (unresolved.has(varName)) {
          varDeclarations.push(`  ${varName}: ${value}; /* From computed styles */`);
        } else {
          varDeclarations.push(`  ${varName}: ${value};`);
        }
      }
    });

    if (varDeclarations.length > 0) {
      cssVarParts.push(`:root {\n${varDeclarations.join('\n')}\n}`);
    }
  }

  if (cssVarParts.length > 0) {
    cssVariables = `/* ========== CSS Variables ========== */\n${cssVarParts.join('\n\n')}\n`;
    parts.push(cssVariables);
  }

  // 2. 处理内联样式
  let inlineCSS = '';
  if (stylesData.inlineStyle?.cssText) {
    inlineCSS = `/* Inline Styles */\n${selector} { ${stylesData.inlineStyle.cssText} }\n`;
    parts.push(inlineCSS);
  }

  // 3. 处理匹配的 CSS 规则（按优先级顺序）
  let matchedCSS = '';
  if (stylesData.matchedCSSRules && stylesData.matchedCSSRules.length > 0) {
    const seenRules = new Set<string>();
    const rulesText: string[] = [];

    for (const rule of stylesData.matchedCSSRules) {
      const rawSelector = rule.rule.selectorList.text;
      const selectorText = htmlTokens
        ? narrowSelectorList(rawSelector, htmlTokens, true)
        : rawSelector;
      let styleText = rule.rule.style.cssText;

      if (!selectorText || !styleText) continue;

      // 跳过 :root 和 html 选择器
      if (selectorText === ':root' || selectorText === 'html') continue;

      // 记录样式表 ID 用于后续获取完整内容
      if (rule.rule.styleSheetId) {
        styleSheetIds.add(rule.rule.styleSheetId);
      }

      // 去重
      const ruleKey = `${selectorText}{${styleText}}`;
      if (seenRules.has(ruleKey)) continue;
      seenRules.add(ruleKey);

      if (!isUserAgentRule(rule)) {
        rulesText.push(`${selectorText} {\n  ${formatStyleText(styleText)}\n}`);
      }
    }

    if (rulesText.length > 0) {
      matchedCSS = `/* ========== Matched CSS Rules ========== */\n${rulesText.join('\n\n')}\n`;
      parts.push('\n' + matchedCSS);
    }
  }

  // 4. 处理伪元素样式 (::before, ::after 等)
  let pseudoElementCSS = '';
  if (stylesData.pseudoElements && stylesData.pseudoElements.length > 0) {
    hasPseudoElements = true;
    const pseudoParts: string[] = [];

    for (const pseudoEl of stylesData.pseudoElements as Array<{
      pseudoType: string;
      matches?: MatchedCSSRule[];
      style?: { cssText: string };
    }>) {
      const pseudoType = pseudoEl.pseudoType;
      const pseudoSelector = `${selector}::${pseudoType}`;

      // 处理伪元素的匹配规则
      if (pseudoEl.matches && pseudoEl.matches.length > 0) {
        for (const rule of pseudoEl.matches) {
          let styleText = rule.rule.style.cssText;
          if (!styleText) continue;

          if (!isUserAgentRule(rule)) {
            pseudoParts.push(`${pseudoSelector} {\n  ${formatStyleText(styleText)}\n}`);
            if (rule.rule.styleSheetId) {
              styleSheetIds.add(rule.rule.styleSheetId);
            }
          }
        }
      }

      // 处理伪元素的内联样式
      if (pseudoEl.style?.cssText) {
        pseudoParts.push(`${pseudoSelector} {\n  ${formatStyleText(pseudoEl.style.cssText)}\n}`);
      }
    }

    if (pseudoParts.length > 0) {
      pseudoElementCSS = `/* ========== Pseudo Elements (::before, ::after) ========== */\n${pseudoParts.join('\n\n')}\n`;
      parts.push('\n' + pseudoElementCSS);
    }
  }

  // 5. 处理继承的样式
  let inheritedCSS = '';
  if (stylesData.inherited && stylesData.inherited.length > 0) {
    const inheritedParts: string[] = [];
    inheritedDepth = stylesData.inherited.length;

    for (let i = stylesData.inherited.length - 1; i >= 0; i--) {
      const inherited = stylesData.inherited[i];
      const depth = stylesData.inherited.length - i;
      const depthLabel = depth === 1 ? 'Parent' : depth === 2 ? 'Grandparent' : `Ancestor Level ${depth}`;

      // 处理继承的内联样式
      if (inherited.inlineStyle?.cssText) {
        inheritedParts.push(`/* ${depthLabel} Inline Styles */\n${selector} {\n  /* Inherited from ${depthLabel} */\n  ${formatStyleText(filterInheritedProperties(inherited.inlineStyle.cssText))}\n}`);
      }

      // 处理继承的匹配规则
      if (inherited.matchedCSSRules && inherited.matchedCSSRules.length > 0) {
        const parentRules: string[] = [];
        for (const rule of inherited.matchedCSSRules) {
          const ruleSelectorText = rule.rule.selectorList.text;
          let styleText = rule.rule.style.cssText;

          if (!styleText) continue;

          // 跳过 :root 和 html
          if (ruleSelectorText === ':root' || ruleSelectorText === 'html') continue;

          if (!isUserAgentRule(rule)) {
            // 只保留可继承的属性
            const inheritedProps = filterInheritedProperties(styleText);
            if (inheritedProps.trim()) {
              parentRules.push(`${ruleSelectorText} {\n  /* Affects ${depthLabel} */\n  ${formatStyleText(inheritedProps)}\n}`);
            }

            if (rule.rule.styleSheetId) {
              styleSheetIds.add(rule.rule.styleSheetId);
            }
          }
        }

        if (parentRules.length > 0) {
          inheritedParts.push(`/* ${depthLabel} Style Rules */\n${parentRules.join('\n\n')}`);
        }
      }
    }

    if (inheritedParts.length > 0) {
      inheritedCSS = `/* ========== Inherited Styles (from parent elements) ========== */\n${inheritedParts.join('\n\n')}\n`;
      parts.push('\n' + inheritedCSS);
    }
  }

  // 6. 添加字体信息注释
  let fontInfo = '';
  if (fonts.length > 0) {
    fontInfo = '/* ========== Fonts Used ========== */\n';
    for (const font of fonts) {
      fontInfo += `/* ${font.familyName}${font.isCustomFont ? ' (Custom Font)' : ' (System Font)'} - ${font.glyphCount} glyphs */\n`;
    }
    parts.push('\n' + fontInfo);
  }

  return {
    css: parts.join(''),
    inlineCSS,
    matchedCSS,
    inheritedCSS,
    pseudoElementCSS,
    cssVariables,
    fontInfo,
    styleSheetIds: [...styleSheetIds],
    hasPseudoElements,
    inheritedDepth,
  };
}

export function mergeDescendantStyles(
  root: MatchedStylesForNode,
  descendants: MatchedStylesForNode[]
): MatchedStylesForNode {
  if (descendants.length === 0) return root;

  const matchedCSSRules = [...(root.matchedCSSRules || [])];
  const pseudoElements = [...(root.pseudoElements || [])];

  for (const descendant of descendants) {
    if (descendant.matchedCSSRules) {
      matchedCSSRules.push(...descendant.matchedCSSRules);
    }
    if (descendant.pseudoElements) {
      pseudoElements.push(...descendant.pseudoElements);
    }
  }

  return {
    ...root,
    matchedCSSRules,
    pseudoElements,
  };
}

export function collectStyleSheetIds(styles: MatchedStylesForNode, ids: Set<string>): void {
  for (const rule of styles.matchedCSSRules || []) {
    if (rule.rule.styleSheetId) {
      ids.add(rule.rule.styleSheetId);
    }
  }

  for (const inherited of styles.inherited || []) {
    for (const rule of inherited.matchedCSSRules || []) {
      if (rule.rule.styleSheetId) {
        ids.add(rule.rule.styleSheetId);
      }
    }
  }

  for (const pseudoEl of (styles.pseudoElements || []) as Array<{
    matches?: Array<{ rule: { styleSheetId?: string } }>;
  }>) {
    for (const rule of pseudoEl.matches || []) {
      if (rule.rule.styleSheetId) {
        ids.add(rule.rule.styleSheetId);
      }
    }
  }
}

/**
 * 从外链样式表文本中提取 CSS 变量
 * 策略 B: 从所有规则中提取变量定义，不限于 :root 和 html
 */
export function extractCSSVariablesFromStylesheetText(
  stylesheetText: string,
  usedVariables: Set<string>
): Map<string, string> {
  const definitions = new Map<string, string>();

  // 策略 B: 从所有规则中提取变量定义
  // 匹配任意选择器的规则块，提取其中的 CSS 变量
  const rulePattern = /[^{}]+\{([^}]+)\}/g;
  let match;
  while ((match = rulePattern.exec(stylesheetText)) !== null) {
    const ruleContent = match[1];
    // 只提取包含 CSS 变量定义的内容
    if (ruleContent.includes('--')) {
      parseVariableDefinitions(ruleContent, definitions);
    }
  }

  // 过滤出被使用的变量（只取已解析的，外链样式表无法获取计算值）
  const result = new Map<string, string>();
  const { resolved } = resolveVariableDependencies(definitions, usedVariables);
  resolved.forEach(varName => {
    const value = definitions.get(varName);
    if (value !== undefined) {
      result.set(varName, value);
    }
  });

  return result;
}

/**
 * 从样式数据中提取使用的 CSS 变量
 */
function extractUsedCSSVariables(stylesData: MatchedStylesForNode): Set<string> {
  const variables = new Set<string>();
  const varPattern = /var\s*\(\s*(--[a-zA-Z0-9_-]+)/g;

  const extractFromText = (text: string) => {
    let match;
    while ((match = varPattern.exec(text)) !== null) {
      variables.add(match[1]);
    }
  };

  // 从内联样式提取
  if (stylesData.inlineStyle?.cssText) {
    extractFromText(stylesData.inlineStyle.cssText);
  }

  // 从匹配规则提取
  if (stylesData.matchedCSSRules) {
    for (const rule of stylesData.matchedCSSRules) {
      if (rule.rule.style.cssText) {
        extractFromText(rule.rule.style.cssText);
      }
    }
  }

  // 从伪元素提取
  if (stylesData.pseudoElements) {
    for (const pseudoEl of stylesData.pseudoElements as Array<{
      matches?: MatchedCSSRule[];
      style?: { cssText: string };
    }>) {
      if (pseudoEl.style?.cssText) {
        extractFromText(pseudoEl.style.cssText);
      }
      if (pseudoEl.matches) {
        for (const rule of pseudoEl.matches) {
          if (rule.rule.style.cssText) {
            extractFromText(rule.rule.style.cssText);
          }
        }
      }
    }
  }

  // 从继承样式提取
  if (stylesData.inherited) {
    for (const inherited of stylesData.inherited) {
      if (inherited.inlineStyle?.cssText) {
        extractFromText(inherited.inlineStyle.cssText);
      }
      if (inherited.matchedCSSRules) {
        for (const rule of inherited.matchedCSSRules) {
          if (rule.rule.style.cssText) {
            extractFromText(rule.rule.style.cssText);
          }
        }
      }
    }
  }

  return variables;
}

/**
 * 递归提取 CSS 变量依赖
 * 返回 { resolved: 已解析的变量, unresolved: 未找到定义的变量 }
 */
function resolveVariableDependencies(
  varDefinitions: Map<string, string>,
  usedVars: Set<string>
): { resolved: Set<string>; unresolved: Set<string> } {
  const resolved = new Set<string>();
  const unresolved = new Set<string>();
  const toResolve = new Set(usedVars);
  const varRefPattern = /var\s*\(\s*(--[a-zA-Z0-9_-]+)/g;

  while (toResolve.size > 0) {
    const current = toResolve.values().next().value;
    if (!current) break;
    toResolve.delete(current);

    if (resolved.has(current) || unresolved.has(current)) continue;

    // 检查这个变量是否有定义
    const definition = varDefinitions.get(current);
    if (definition) {
      resolved.add(current);

      // 从定义中提取它依赖的其他变量
      let match;
      varRefPattern.lastIndex = 0; // 重置正则
      while ((match = varRefPattern.exec(definition)) !== null) {
        if (!resolved.has(match[1]) && !unresolved.has(match[1])) {
          toResolve.add(match[1]);
        }
      }
    } else {
      // 变量没有定义，标记为未解析
      unresolved.add(current);
    }
  }

  return { resolved, unresolved };
}

/**
 * 用计算值替换 CSS 变量引用
 * 策略 D: 当变量无法解析时，使用元素的计算样式值替换
 */
export function replaceVariablesWithComputed(
  cssText: string,
  computedStyles: Record<string, string>
): string {
  // 匹配 var(--name) 或 var(--name, fallback)
  const varPattern = /var\s*\(\s*(--[a-zA-Z0-9_-]+)(\s*,\s*([^)]+))?\)/g;

  return cssText.replace(varPattern, (match, varName, _comma, fallback) => {
    // 尝试从计算样式获取值
    const computedValue = computedStyles[varName];
    if (computedValue && computedValue !== '') {
      return computedValue;
    }
    // 如果有 fallback 值，使用 fallback
    if (fallback) {
      return fallback.trim();
    }
    // 无法解析，保留原始引用并添加注释
    return match;
  });
}

/**
 * 从计算样式中提取 CSS 变量的实际值
 */
export function extractComputedVariableValues(
  computedStyles: Record<string, string>
): Map<string, string> {
  const values = new Map<string, string>();

  // 遍历计算样式，提取 CSS 变量值
  for (const [prop, value] of Object.entries(computedStyles)) {
    if (prop.startsWith('--')) {
      values.set(prop, value);
    }
  }

  return values;
}

/**
 * 解析 CSS 文本中的所有变量定义
 */
function parseVariableDefinitions(cssText: string, definitions: Map<string, string>): void {
  const props = cssText.split(';');
  for (const prop of props) {
    const trimmed = prop.trim();
    if (!trimmed) continue;

    // 匹配 CSS 变量定义: --name: value
    const match = trimmed.match(/^(--[a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (match) {
      definitions.set(match[1], match[2].trim());
    }
  }
}

function isUserAgentRule(rule: MatchedCSSRule): boolean {
  if (rule.rule.origin) {
    return rule.rule.origin === 'user-agent';
  }
  return !rule.rule.styleSheetId;
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 过滤出可继承的 CSS 属性
 */
function filterInheritedProperties(cssText: string): string {
  const inheritableProps = [
    'color', 'font', 'font-family', 'font-size', 'font-style', 'font-weight',
    'line-height', 'letter-spacing', 'text-align', 'text-indent', 'text-transform',
    'white-space', 'word-spacing', 'direction', 'visibility', 'cursor',
    'list-style', 'list-style-type', 'list-style-position', 'list-style-image',
    'quotes', 'orphans', 'widows', 'tab-size', 'hyphens', 'word-break',
    'word-wrap', 'overflow-wrap', 'text-decoration-skip', 'text-emphasis',
    'text-emphasis-color', 'text-emphasis-style', 'text-emphasis-position',
    'text-rendering', 'image-rendering', 'writing-mode', 'ruby-position',
  ];

  const props = cssText.split(';').filter(prop => {
    const propName = prop.split(':')[0]?.trim().toLowerCase();
    if (!propName) return false;

    // 检查是否是可继承属性
    return inheritableProps.some(inheritable =>
      propName === inheritable || propName.startsWith(inheritable + '-')
    );
  });

  return props.map(p => p.trim()).filter(p => p).join('; ');
}

/**
 * 格式化样式文本，每行一个属性
 */
function formatStyleText(cssText: string): string {
  return cssText
    .split(';')
    .filter(s => s.trim())
    .map(s => s.trim() + ';')
    .join('\n  ');
}

/**
 * 提取外链样式表内容
 */
export async function fetchExternalStylesheets(
  styleSheetIds: Set<string>,
  getStyleSheetText: (id: string) => Promise<string>
): Promise<string> {
  const parts: string[] = [];

  for (const styleSheetId of styleSheetIds) {
    try {
      const text = await getStyleSheetText(styleSheetId);
      if (text) {
        parts.push(`/* Stylesheet: ${styleSheetId} */\n${text}`);
      }
    } catch (err) {
      console.warn(`Failed to fetch stylesheet ${styleSheetId}:`, err);
    }
  }

  return parts.join('\n\n');
}

/**
 * 清理 HTML，移除脚本和事件处理器
 */
export function sanitizeHTML(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // 移除所有 script 标签
  const scripts = temp.querySelectorAll('script');
  scripts.forEach(s => s.remove());

  // 移除事件属性
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    const attrs = el.attributes;
    for (let i = attrs.length - 1; i >= 0; i--) {
      const attr = attrs[i];
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return temp.innerHTML;
}

/**
 * 生成完整的 HTML 文档
 */
export function generateFullHTML(
  elementHTML: string,
  css: string,
  title = 'Extracted Style'
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>
html, body { margin: 0; }
body { padding: 24px; }
[hidden] { display: none !important; }

/* Extracted styles */
${css}
  </style>
</head>
<body>
${sanitizeHTML(elementHTML)}
</body>
</html>`;
}
