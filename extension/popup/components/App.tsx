/**
 * App 组件 - Popup 主应用
 * 简洁科技风格
 */

import React, { useState, useCallback } from 'react';

export const App: React.FC = () => {
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickElement = useCallback(async () => {
    setError(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        setError('Unable to get current tab');
        return;
      }

      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        setError('Cannot use on this page');
        return;
      }

      await chrome.tabs.sendMessage(tab.id, { type: 'START_PICKING' });
      setIsPicking(true);
      window.close();
    } catch (err) {
      console.error('Failed to start picking:', err);
      setError('Failed to start. Please refresh the page and try again');
    }
  }, []);

  return (
    <div style={styles.container}>
      {/* Logo 区域 */}
      <div style={styles.logoSection}>
        <div style={styles.logoIcon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="M13 13l6 6" />
          </svg>
        </div>
        <div style={styles.logoText}>
          <span style={styles.title}>Style Extractor</span>
        </div>
      </div>

      {/* 分隔线 */}
      <div style={styles.divider} />

      {/* 错误提示 */}
      {error && (
        <div style={styles.error}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* 主按钮 */}
      <button
        onClick={handlePickElement}
        disabled={isPicking}
        style={isPicking ? styles.buttonDisabled : styles.button}
        onMouseEnter={(e) => {
          if (!isPicking) e.currentTarget.style.background = '#3db8ff';
        }}
        onMouseLeave={(e) => {
          if (!isPicking) e.currentTarget.style.background = '#0d99ff';
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        <span>{isPicking ? 'Selecting...' : 'Pick Element'}</span>
      </button>

      {/* 快捷键提示 */}
      <div style={styles.hint}>
        <kbd style={styles.kbd}>Alt</kbd>
        <span style={styles.plus}>+</span>
        <kbd style={styles.kbd}>Shift</kbd>
        <span style={styles.plus}>+</span>
        <kbd style={styles.kbd}>S</kbd>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '260px',
    padding: '16px',
    background: '#2c2c2c',
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(13, 153, 255, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0d99ff',
  },
  logoText: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: '-0.01em',
  },
  divider: {
    height: '1px',
    background: 'rgba(255, 255, 255, 0.1)',
    marginBottom: '16px',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: 'rgba(242, 72, 34, 0.15)',
    borderRadius: '6px',
    color: '#f24822',
    fontSize: '12px',
    marginBottom: '12px',
  },
  button: {
    width: '100%',
    padding: '12px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#fff',
    background: '#0d99ff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background 0.15s ease',
  },
  buttonDisabled: {
    width: '100%',
    padding: '12px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.5)',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    marginTop: '14px',
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '22px',
    height: '20px',
    padding: '0 5px',
    fontSize: '10px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.5)',
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  plus: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '10px',
  },
};
