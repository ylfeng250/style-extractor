/**
 * 内容脚本 - 注入到页面中
 * 负责元素选择、高亮和与后台通信
 */

import {
  startElementSelection,
  stopElementSelection,
} from '../ui/selector-ui';
import {
  hideExtractLoading,
  showExtractLoading,
  updateExtractLoading,
} from '../ui/loading-overlay';
import {
  createExtractId,
  markElement,
  unmarkElement,
} from '../utils/extract-marker';
import { pruneCssAgainstHtml } from '../utils/css-filter';

let isSelecting = false;

interface Message {
  type: string;
  message?: string;
  ratio?: number;
  [key: string]: unknown;
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  const { type } = message;

  switch (type) {
    case 'START_PICKING': {
      if (isSelecting) {
        sendResponse({ status: 'already_started' });
        return false;
      }

      startElementSelection({
        onSelect: (element, selector, pseudoStates) => {
          stopElementSelection();
          isSelecting = false;

          const extractId = createExtractId();
          markElement(element, extractId);
          showExtractLoading('Connecting to page…');

          chrome.runtime.sendMessage({
            type: 'ELEMENT_SELECTED',
            selector,
            extractId,
            pseudoStates,
          }).then(() => {
            updateExtractLoading('Opening results…', 1);
            window.setTimeout(() => hideExtractLoading(), 240);
          }).catch(err => {
            hideExtractLoading();
            console.error('Failed to extract styles:', err);
            showToast('Extraction failed: ' + (err instanceof Error ? err.message : 'Please try again'), 'error');
          }).finally(() => {
            unmarkElement(element);
          });
        },
        onCancel: () => {
          stopElementSelection();
          isSelecting = false;
          hideExtractLoading();
          showToast('Selection cancelled', 'info');
        },
      });

      isSelecting = true;
      sendResponse({ status: 'started' });
      return false;
    }

    case 'STOP_PICKING': {
      if (isSelecting) {
        stopElementSelection();
        isSelecting = false;
      }
      hideExtractLoading();
      sendResponse({ status: 'stopped' });
      return false;
    }

    case 'GET_SELECTION_STATUS': {
      sendResponse({ isSelecting });
      return false;
    }

    case 'EXTRACT_PROGRESS': {
      updateExtractLoading(
        typeof message.message === 'string' ? message.message : 'Extracting styles…',
        typeof message.ratio === 'number' ? message.ratio : undefined
      );
      return false;
    }

    case 'PRUNE_CSS': {
      const html = typeof message.html === 'string' ? message.html : '';
      const css = typeof message.css === 'string' ? message.css : '';
      try {
        sendResponse({ css: pruneCssAgainstHtml(html, css) });
      } catch (err) {
        console.warn('Failed to prune CSS:', err);
        sendResponse({ css });
      }
      return false;
    }
  }

  return false;
});

function showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#1a1a1a';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';

  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: ${bgColor};
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideUp 0.3s ease-out;
  `;

  const iconEl = document.createElement('span');
  iconEl.style.fontSize = '16px';
  iconEl.textContent = icon;

  const textEl = document.createElement('span');
  textEl.textContent = message;

  toast.append(iconEl, textEl);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes fadeOut {
      to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
  `;
  toast.appendChild(style);

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
