/**
 * Options 页面 - 显示提取结果
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { StyleExtractionResult } from '../../utils/style-assembler';

type TabType = 'preview' | 'html' | 'css' | 'variables' | 'inline' | 'matched' | 'inherited' | 'pseudo' | 'fonts';

export const OptionsPage: React.FC = () => {
  const [result, setResult] = useState<StyleExtractionResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('html');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Load result
    loadResult();

    // Listen for updates
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'EXTRACT_COMPLETE') {
        loadResult();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const loadResult = async () => {
    try {
      const data = await chrome.storage.local.get('extractResult');
      setResult(data.extractResult || null);
    } catch (err) {
      console.error('Failed to load result:', err);
    }
  };

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!result) return;

    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extracted Style - ${result.metadata.selector}</title>
  <style>
/* Reset */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; background: #f5f5f5; }

/* Extracted styles */
${result.css}
  </style>
</head>
<body>
${result.html}
</body>
</html>`;

    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const filename = `extracted-${result.metadata.selector.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;

    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleClear = useCallback(async () => {
    await chrome.storage.local.remove('extractResult');
    setResult(null);
  }, []);

  const getCode = (): string => {
    if (!result) return '';
    switch (activeTab) {
      case 'preview': return '';
      case 'html': return result.html;
      case 'css': return result.css;
      case 'variables': return result.cssVariables;
      case 'inline': return result.inlineCSS;
      case 'matched': return result.matchedCSS;
      case 'inherited': return result.inheritedCSS;
      case 'pseudo': return result.pseudoElementCSS;
      case 'fonts': return result.fontInfo;
      default: return '';
    }
  };

  const getPreviewHTML = (): string => {
    if (!result) return '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; background: #f5f5f5; min-height: 100vh; }
    ${result.css}
  </style>
</head>
<body>
${result.html}
</body>
</html>`;
  };

  if (!result) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d="M15 9l-3-3-3 3" />
          </svg>
        </div>
        <h2 style={styles.emptyTitle}>No Results</h2>
        <p style={styles.emptyText}>Use the "Pick Element" button in the extension popup to extract styles</p>
      </div>
    );
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'preview', label: 'Preview' },
    { key: 'html', label: 'HTML' },
    { key: 'css', label: 'Full CSS' },
    { key: 'variables', label: 'CSS Variables' },
    { key: 'inline', label: 'Inline Styles' },
    { key: 'matched', label: 'Matched Rules' },
    { key: 'inherited', label: 'Inherited' },
    { key: 'pseudo', label: 'Pseudo Elements' },
    { key: 'fonts', label: 'Fonts' },
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Style Extractor</h1>
        <p style={styles.subtitle}>Extraction Results</p>
      </div>

      {/* Metadata */}
      <div style={styles.metadata}>
        <div style={styles.metaItem}>
          <span style={styles.metaLabel}>Selector</span>
          <code style={styles.metaValue}>{result.metadata.selector}</code>
        </div>
        <div style={styles.metaItem}>
          <span style={styles.metaLabel}>Pseudo States</span>
          <span style={styles.metaValue}>{result.metadata.pseudoStates.join(', ') || 'None'}</span>
        </div>
        <div style={styles.metaItem}>
          <span style={styles.metaLabel}>Pseudo Elements</span>
          <span style={styles.metaValue}>{result.pseudoElementCSS ? 'Yes (::before/::after)' : 'None'}</span>
        </div>
        <div style={styles.metaItem}>
          <span style={styles.metaLabel}>Extracted At</span>
          <span style={styles.metaValue}>{new Date(result.metadata.timestamp).toLocaleString()}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.tabActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Code Section */}
      <div style={styles.codeSection}>
        <div style={styles.codeHeader}>
          <span style={styles.codeTitle}>{tabs.find(t => t.key === activeTab)?.label}</span>
          {activeTab !== 'preview' && (
            <div style={styles.codeActions}>
              <button style={styles.codeBtn} onClick={() => handleCopy(getCode())}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
        {activeTab === 'preview' ? (
          <iframe
            srcDoc={getPreviewHTML()}
            style={styles.previewFrame}
            title="Style Preview"
            sandbox="allow-same-origin"
          />
        ) : (
          <pre style={styles.codeContent}>
            <code>{getCode() || '/* No content */'}</code>
          </pre>
        )}
      </div>

      {/* Action Buttons */}
      <div style={styles.actions}>
        <button style={styles.downloadBtn} onClick={handleDownload}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download HTML File
        </button>
        <button style={styles.clearBtn} onClick={handleClear}>
          Clear Results
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1a1a1a',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
  },
  metadata: {
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  metaLabel: {
    fontSize: '12px',
    color: '#666',
    fontWeight: 500,
  },
  metaValue: {
    fontSize: '14px',
    color: '#333',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    borderBottom: '1px solid #e5e5e5',
    paddingBottom: '12px',
  },
  tab: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#666',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#0d99ff',
    background: '#e0f2fe',
    borderColor: '#bae6fd',
  },
  codeSection: {
    background: '#1e1e1e',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '24px',
  },
  previewFrame: {
    width: '100%',
    height: '400px',
    border: 'none',
    background: '#fff',
  },
  codeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#2d2d2d',
    borderBottom: '1px solid #3d3d3d',
  },
  codeTitle: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
  },
  codeActions: {
    display: 'flex',
    gap: '8px',
  },
  codeBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    color: '#fff',
    background: '#3d3d3d',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  codeContent: {
    padding: '16px',
    margin: 0,
    overflow: 'auto',
    maxHeight: '500px',
    fontSize: '13px',
    fontFamily: 'Consolas, Monaco, monospace',
    lineHeight: 1.5,
    color: '#d4d4d4',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  actions: {
    display: 'flex',
    gap: '12px',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    background: '#0d99ff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  clearBtn: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#666',
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center' as const,
  },
  emptyIcon: {
    color: '#ccc',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#666',
  },
};
