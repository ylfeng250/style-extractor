/**
 * Options 页面 - 提取结果工作台
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { generateFullHTML, type StyleExtractionResult } from '../../utils/style-assembler';

type CodeTab = 'html' | 'css' | 'variables' | 'inline' | 'matched' | 'inherited' | 'pseudo' | 'fonts';
type PreviewWidth = 'fluid' | 'tablet' | 'phone';
type CopiedKey = 'html' | 'css' | 'snippet' | 'section' | null;

interface ExtractProgress {
  message: string;
  ratio: number;
}

const PREVIEW_WIDTH: Record<PreviewWidth, string> = {
  fluid: '100%',
  tablet: '768px',
  phone: '390px',
};

function hasContent(text: string | undefined): boolean {
  return Boolean(text && text.replace(/\/\*[\s\S]*?\*\//g, '').trim());
}

export const OptionsPage: React.FC = () => {
  const [result, setResult] = useState<StyleExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExtractProgress | null>(null);
  const [codeTab, setCodeTab] = useState<CodeTab>('css');
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>('fluid');
  const [copied, setCopied] = useState<CopiedKey>(null);

  useEffect(() => {
    loadResult();

    const handleMessage = (message: { type: string; error?: string; message?: string; ratio?: number }) => {
      if (message.type === 'EXTRACT_PROGRESS') {
        setError(null);
        setResult(null);
        setProgress({
          message: message.message || 'Extracting styles…',
          ratio: typeof message.ratio === 'number' ? message.ratio : 0.1,
        });
      }
      if (message.type === 'EXTRACT_COMPLETE') {
        setProgress(null);
        setError(null);
        loadResult();
      }
      if (message.type === 'EXTRACT_ERROR') {
        setProgress(null);
        setError(message.error || 'Extraction failed');
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const loadResult = async () => {
    try {
      const data = await chrome.storage.local.get(['extractResult', 'extractError', 'extractProgress']);
      setResult(data.extractResult || null);
      setError(typeof data.extractError === 'string' ? data.extractError : null);
      setProgress(
        data.extractProgress && typeof data.extractProgress.message === 'string'
          ? {
              message: data.extractProgress.message,
              ratio: typeof data.extractProgress.ratio === 'number' ? data.extractProgress.ratio : 0.1,
            }
          : null
      );
    } catch (err) {
      console.error('Failed to load result:', err);
    }
  };

  const flashCopied = (key: CopiedKey) => {
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
  };

  const copyText = useCallback(async (text: string, key: CopiedKey) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(key);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!result) return;

    const fullHTML = generateFullHTML(
      result.html,
      result.css,
      `Extracted Style - ${result.metadata.selector}`
    );
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const filename = `extracted-${result.metadata.selector.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleClear = useCallback(async () => {
    await chrome.storage.local.remove(['extractResult', 'extractError', 'extractProgress']);
    setResult(null);
    setError(null);
    setProgress(null);
  }, []);

  const sections = useMemo(() => {
    if (!result) return [];
    return [
      { key: 'html' as const, label: 'HTML', code: result.html },
      { key: 'css' as const, label: 'CSS', code: result.css },
      { key: 'variables' as const, label: 'Variables', code: result.cssVariables },
      { key: 'inline' as const, label: 'Inline', code: result.inlineCSS },
      { key: 'matched' as const, label: 'Matched', code: result.matchedCSS },
      { key: 'inherited' as const, label: 'Inherited', code: result.inheritedCSS },
      { key: 'pseudo' as const, label: 'Pseudo', code: result.pseudoElementCSS },
      { key: 'fonts' as const, label: 'Fonts', code: result.fontInfo },
    ];
  }, [result]);

  const activeSection = sections.find((section) => section.key === codeTab);
  const previewHTML = result
    ? generateFullHTML(result.html, result.css, result.metadata.selector)
    : '';
  const snippet = result ? `${result.html}\n\n<style>\n${result.css}\n</style>` : '';

  if (progress && !result) {
    const width = `${Math.max(8, Math.min(100, Math.round(progress.ratio * 100)))}%`;
    return (
      <div className="empty">
        <div className="loading-card">
          <div className="loading-row">
            <div className="spinner" />
            <div>
              <p className="loading-title">Extracting styles</p>
              <p className="loading-message">{progress.message}</p>
            </div>
          </div>
          <div className="loading-track">
            <div className="loading-bar" style={{ width }} />
          </div>
        </div>
      </div>
    );
  }

  if (!result && error) {
    return (
      <div className="empty is-error">
        <div className="empty-card">
          <div className="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1>Extraction failed</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="empty">
        <div className="empty-card">
          <div className="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="M13 13l6 6" />
            </svg>
          </div>
          <h1>No extraction yet</h1>
          <p>Open the extension popup and click Pick Element to capture HTML and CSS from a page.</p>
        </div>
      </div>
    );
  }

  const extractedAt = new Date(result.metadata.timestamp).toLocaleString();
  const descendantCount = result.metadata.descendantCount ?? 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="M13 13l6 6" />
            </svg>
          </div>
          <span className="brand-name">Style Extractor</span>
        </div>

        <div className="meta">
          <code className="chip" title={result.metadata.selector}>{result.metadata.selector}</code>
          {result.metadata.pseudoStates.length > 0 && (
            <span className="pill">{result.metadata.pseudoStates.map((state) => `:${state}`).join(' ')}</span>
          )}
          {descendantCount > 0 && (
            <span className="pill">{descendantCount} descendants</span>
          )}
          <span className="pill">{extractedAt}</span>
        </div>

        <div className="top-actions">
          <button className="btn" onClick={() => copyText(result.html, 'html')}>
            {copied === 'html' ? 'Copied HTML' : 'Copy HTML'}
          </button>
          <button className="btn" onClick={() => copyText(result.css, 'css')}>
            {copied === 'css' ? 'Copied CSS' : 'Copy CSS'}
          </button>
          <button className="btn" onClick={() => copyText(snippet, 'snippet')}>
            {copied === 'snippet' ? 'Copied snippet' : 'Copy snippet'}
          </button>
          <button className="btn btn-primary" onClick={handleDownload}>
            Download
          </button>
          <button className="btn btn-ghost" onClick={handleClear}>
            Clear
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="pane">
          <div className="pane-bar">
            <span className="pane-title">Preview</span>
            <div className="segment" role="group" aria-label="Preview width">
              {([
                ['fluid', 'Full'],
                ['tablet', '768'],
                ['phone', '390'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={previewWidth === key}
                  onClick={() => setPreviewWidth(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="preview-stage">
            <div className="preview-frame-wrap" style={{ width: PREVIEW_WIDTH[previewWidth] }}>
              <iframe
                srcDoc={previewHTML}
                title="Style preview"
                sandbox=""
              />
            </div>
          </div>
        </section>

        <section className="pane">
          <div className="pane-bar">
            <span className="pane-title">Source</span>
          </div>
          <div className="code-layout">
            <nav className="section-list" aria-label="Extracted sections">
              {sections.map((section) => {
                const empty = !hasContent(section.code);
                return (
                  <button
                    key={section.key}
                    type="button"
                    className={empty ? 'is-empty' : undefined}
                    aria-current={codeTab === section.key}
                    onClick={() => setCodeTab(section.key)}
                  >
                    <span>{section.label}</span>
                    {!empty && <span className="count">has data</span>}
                  </button>
                );
              })}
            </nav>
            <div className="code-main">
              <div className="code-toolbar">
                <span className="code-label">{activeSection?.label}</span>
                <button
                  className="btn"
                  disabled={!hasContent(activeSection?.code)}
                  onClick={() => copyText(activeSection?.code || '', 'section')}
                >
                  {copied === 'section' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="code-view">
                <code>{activeSection?.code || '/* No content */'}</code>
              </pre>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
