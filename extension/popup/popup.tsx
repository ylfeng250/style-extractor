/**
 * Popup 入口文件
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';

// 创建根元素并渲染
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Root element not found');
}
