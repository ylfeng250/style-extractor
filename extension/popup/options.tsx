/**
 * Options 页面入口 - 显示提取结果
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { OptionsPage } from './components/OptionsPage';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <OptionsPage />
    </React.StrictMode>
  );
}
