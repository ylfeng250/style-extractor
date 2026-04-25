/**
 * 内容脚本 - 注入到页面中
 * 负责元素选择、高亮和与后台通信
 */

// 复用现有的 UI 组件
import {
  startElementSelection,
  stopElementSelection,
} from '../ui/selector-ui';

// 当前选择状态
let isSelecting = false;

/**
 * 消息类型定义
 */
interface Message {
  type: string;
  [key: string]: unknown;
}

/**
 * 监听来自 popup 和 background 的消息
 */
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  const { type } = message;

  switch (type) {
    case 'START_PICKING': {
      if (isSelecting) {
        sendResponse({ status: 'already_started' });
        return false;
      }

      startElementSelection({
        onSelect: (_element, selector) => {
          // 立即停止选择模式
          stopElementSelection();
          isSelecting = false;

          // 显示正在提取的提示
          showToast('正在提取样式...', 'info');

          // 发送选中的选择器给 background
          chrome.runtime.sendMessage({
            type: 'ELEMENT_SELECTED',
            selector,
            pseudoStates: ['hover'], // 默认提取 hover 状态
          }).then(() => {
            showToast('样式提取完成！请查看扩展弹窗', 'success');
          }).catch(err => {
            console.error('Failed to extract styles:', err);
            showToast('提取失败: ' + (err.message || '请重试'), 'error');
          });
        },
        onCancel: () => {
          stopElementSelection();
          isSelecting = false;
          showToast('已取消选择', 'info');
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
      sendResponse({ status: 'stopped' });
      return false;
    }

    case 'GET_SELECTION_STATUS': {
      sendResponse({ isSelecting });
      return false;
    }
  }

  return false;
});

/**
 * 监听键盘快捷键
 */
document.addEventListener('keydown', (e) => {
  // Alt+Shift+S 启动选择
  if (e.altKey && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    if (!isSelecting) {
      chrome.runtime.sendMessage({ type: 'START_PICKING_FROM_SHORTCUT' });
    }
  }
});

console.log('[Style Extractor] Content script loaded');

/**
 * 显示 Toast 提示
 */
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

  toast.innerHTML = `
    <span style="font-size:16px;">${icon}</span>
    <span>${message}</span>
  `;

  // 添加动画样式
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

  // 3秒后自动移除
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
