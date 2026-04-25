/**
 * UI 模块入口
 * 导出所有 UI 相关功能
 */

// 主题
export { theme, type ThemeConfig } from './theme';

// 图标
export { icons, createSVGIcon, type IconDefinition } from './icons';

// 工具栏
export {
  createToolbar,
  destroyToolbar,
  createIconButton,
  createCloseButton,
  createDivider,
  isToolbarElement,
  getToolbarElements,
  TOOLBAR_HOST_ID,
  type ToolbarButton,
} from './toolbar';

// 高亮
export {
  initHighlight,
  destroyHighlight,
  highlightElement,
  hideHighlight,
  getHighlightElements,
} from './highlight';

// 面包屑
export {
  initBreadcrumb,
  destroyBreadcrumb,
  updateBreadcrumb,
  hideBreadcrumb,
  getBreadcrumbElement,
  type BreadcrumbClickHandler,
} from './breadcrumb';

// 选择器核心
export {
  startElementSelection,
  stopElementSelection,
  isInSelectionMode,
  isInConfirmMode,
  getSelectedElement,
  getCurrentSelector,
  type SelectorUIOptions,
} from './selector-ui';
