export interface HtmlTokens {
  classes: Set<string>;
  ids: Set<string>;
  attrs: Set<string>;
  tags: Set<string>;
}

const GLOBAL_ATTRS = new Set([
  'hidden',
  'open',
  'disabled',
  'data-color-mode',
  'data-light-theme',
  'data-dark-theme',
]);

export function collectHtmlTokens(html: string): HtmlTokens {
  const classes = new Set<string>();
  const ids = new Set<string>();
  const attrs = new Set<string>();
  const tags = new Set<string>();

  const tagRe = /<([a-zA-Z][\w-]*)([^>]*)>/g;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagRe.exec(html)) !== null) {
    tags.add(tagMatch[1].toLowerCase());
    const attrsText = tagMatch[2];

    const classMatch = attrsText.match(/class\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (classMatch) {
      for (const name of (classMatch[1] || classMatch[2] || '').split(/\s+/)) {
        if (name) classes.add(name);
      }
    }

    const idMatch = attrsText.match(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (idMatch?.[1] || idMatch?.[2]) {
      ids.add(idMatch[1] || idMatch[2]);
    }

    const attrNameRe = /([a-zA-Z_:][\w:.-]*)\s*=/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrNameRe.exec(attrsText)) !== null) {
      attrs.add(attrMatch[1].toLowerCase());
    }

    if (/\shidden(?:\s|>|$)/i.test(attrsText) || /\shidden=""/i.test(attrsText)) {
      attrs.add('hidden');
    }
  }

  return { classes, ids, attrs, tags };
}

export function narrowSelectorList(
  selectorList: string,
  tokens: HtmlTokens,
  allowTagOnly = false
): string | null {
  const kept = splitSelectors(selectorList).filter((selector) =>
    isSubjectUsedInHtml(selector, tokens) || (allowTagOnly && isTagSubjectInHtml(selector, tokens))
  );
  return kept.length > 0 ? kept.join(', ') : null;
}

export function filterStylesheet(cssText: string, tokens: HtmlTokens): string {
  return filterBlock(cssText, (selector) => isSubjectUsedInHtml(selector, tokens)).trim();
}

export function pruneCssByMatcher(
  cssText: string,
  matches: (selector: string) => boolean
): string {
  return filterBlock(cssText, (selector) => selectorCanMatch(selector, matches)).trim();
}

export function pruneCssAgainstHtml(html: string, cssText: string): string {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    'text/html'
  );
  const root = doc.body;

  return pruneCssByMatcher(cssText, (selector) => {
    if (root.querySelector(selector)) return true;
    return Array.from(root.children).some((el) => el.matches(selector));
  });
}

function filterBlock(css: string, keepSelector: (selector: string) => boolean): string {
  const out: string[] = [];
  let i = 0;

  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }

    const nextBrace = css.indexOf('{', i);
    if (nextBrace === -1) break;

    const prelude = css.slice(i, nextBrace).trim();
    const close = findMatchingBrace(css, nextBrace);
    if (close === -1) break;

    const body = css.slice(nextBrace + 1, close);
    i = close + 1;

    if (!prelude) continue;

    if (prelude.startsWith('@')) {
      const atName = prelude.match(/^@([a-zA-Z-]+)/)?.[1];
      if (atName === 'media' || atName === 'supports' || atName === 'layer' || atName === 'container') {
        const inner = filterBlock(body, keepSelector);
        if (inner) {
          out.push(`${prelude} {\n${inner}\n}`);
        }
      }
      continue;
    }

    const kept = splitSelectors(prelude).filter((selector) => keepSelector(selector.trim()));
    if (kept.length > 0) {
      out.push(`${kept.join(', ')} {\n${body.trim()}\n}`);
    }
  }

  return out.join('\n\n');
}

function isTagSubjectInHtml(selector: string, tokens: HtmlTokens): boolean {
  const subject = lastCompound(selector.trim());
  const identity = readIdentity(subject);
  if (identity.classes.length > 0 || identity.ids.length > 0 || identity.attrs.length > 0) {
    return false;
  }
  const tag = subject.match(/^([a-zA-Z][\w-]*)/)?.[1]?.toLowerCase();
  return Boolean(tag && tokens.tags.has(tag));
}

function isSubjectUsedInHtml(selector: string, tokens: HtmlTokens): boolean {
  const trimmed = selector.trim();
  if (!trimmed) return false;
  if (/^(:root|html|body|\*)$/.test(trimmed)) return false;

  const subject = lastCompound(trimmed);
  const identity = readIdentity(subject);

  if (identity.classes.length === 0 && identity.ids.length === 0 && identity.attrs.length === 0) {
    return false;
  }

  if (identity.ids.some((id) => !tokens.ids.has(id))) return false;
  if (identity.classes.some((className) => !tokens.classes.has(className))) return false;
  if (identity.attrs.some((attr) => !tokens.attrs.has(attr) && !GLOBAL_ATTRS.has(attr))) return false;

  return true;
}

function selectorCanMatch(
  selector: string,
  matches: (selector: string) => boolean
): boolean {
  const variants = [
    selector,
    relaxInteractivePseudos(selector),
    stripDocumentPrefix(selector),
    relaxInteractivePseudos(stripDocumentPrefix(selector)),
  ];

  for (const variant of variants) {
    const candidate = variant.trim();
    if (!candidate) continue;
    try {
      if (matches(candidate)) return true;
    } catch {
      // 非法或当前 DOM 不支持的选择器
    }
  }

  return false;
}

function relaxInteractivePseudos(selector: string): string {
  return selector.replace(
    /:(hover|focus|focus-visible|focus-within|active|visited)/g,
    ''
  );
}

function stripDocumentPrefix(selector: string): string {
  return selector
    .replace(/^(?:(?:html|body|:root)(?:\[[^\]]*\])?\s+)+/i, '')
    .replace(/^(?:html|body|:root)(?:\[[^\]]*\])?/i, '')
    .trim();
}

function lastCompound(selector: string): string {
  let depth = 0;
  let lastStart = 0;

  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (ch === '[' || ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ']' || ch === ')') {
      depth -= 1;
      continue;
    }
    if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) {
      let j = i;
      while (j < selector.length && /[\s>+~]/.test(selector[j])) j += 1;
      lastStart = j;
      i = j - 1;
    }
  }

  return selector.slice(lastStart).trim();
}

function readIdentity(compound: string): { classes: string[]; ids: string[]; attrs: string[] } {
  return {
    classes: [...compound.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]),
    ids: [...compound.matchAll(/#(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]),
    attrs: [...compound.matchAll(/\[([a-zA-Z_:][\w:.-]*)/g)].map((match) => match[1].toLowerCase()),
  };
}

function splitSelectors(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < prelude.length; i += 1) {
    const ch = prelude[i];
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(prelude.slice(start, i).trim());
      start = i + 1;
    }
  }

  parts.push(prelude.slice(start).trim());
  return parts.filter(Boolean);
}

function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  let i = openIndex;
  let quote: string | null = null;

  while (i < text.length) {
    const ch = text[i];

    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      i += 1;
      continue;
    }

    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }

    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }

    i += 1;
  }

  return -1;
}
