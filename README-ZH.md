# Style Extractor

基于 Chrome Debugger API 的网页样式精准提取扩展，支持对任意网页元素的 HTML 和 CSS 进行精准提取。
![](./image.png)

## 功能特性

- 🎯 **精准元素选择** - 可视化元素选取，实时高亮显示，支持父/子元素导航
- 🎨 **完整样式提取** - 提取匹配 CSS 规则、内联样式、继承样式
- 👻 **伪元素支持** - 自动提取 `::before`、`::after` 等伪元素样式
- 🔤 **字体信息** - 获取实际渲染的字体信息
- ⚡ **伪类激活** - 强制激活 `:hover`、`:active`、`:focus` 等状态
- 📋 **一键复制** - 支持 HTML/CSS 代码复制到剪贴板
- 💾 **导出下载** - 生成完整 HTML 文件下载

## 安装

### 从源码构建

```bash
# 安装依赖
npm install

# 开发模式（监听文件变更）
npm run dev

# 生产构建
npm run build
```

### 加载到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展」
4. 选择项目的 `dist/` 目录
5. 扩展图标会显示在工具栏

## 使用方法

### 步骤 1：启动选择模式

1. 点击扩展图标打开弹窗
2. 点击「选取元素」按钮
3. 页面进入选择模式，鼠标变为十字准星
4. 移动鼠标查看元素高亮预览

### 步骤 2：选择元素

1. 在页面上移动鼠标，预览高亮效果
2. 点击目标元素
3. 使用元素路径选择器导航祖先元素
4. 工具栏显示当前选择器路径

### 步骤 3：提取样式

点击「提取」按钮，自动提取：
- 完整 HTML（outerHTML）
- 所有匹配的 CSS 规则
- 内联样式
- 继承样式
- 伪元素样式（`::before`、`::after`）
- 渲染字体信息

### 步骤 4：查看与导出

Options 页面自动打开，显示：
- 选择器路径
- 应用的伪类状态
- 提取时间戳
- 分页查看不同样式类别
- 复制和下载按钮

## 元素选择控制

| 控制 | 操作 |
|-----|------|
| 元素路径选择器 | 点击展开祖先列表，选择任意父元素 |
| ✓ 提取 | 确认并提取样式 |
| ✕ 取消 | 返回选择模式（ESC） |
| ↑ 父级 | 导航到父元素 |

## 快捷键

- `ESC` - 取消选择模式

## 技术栈

- React 18 + TypeScript
- Chrome Extension Manifest V3
- Chrome DevTools Protocol (CDP)
- esbuild 构建工具

## 项目结构

```
style-extractor/
├── extension/
│   ├── manifest.json           # 扩展清单
│   ├── background/             # Service Worker
│   │   └── service-worker.ts
│   ├── content/                # 内容脚本
│   │   └── content-script.ts
│   ├── popup/                  # Popup UI (React)
│   │   ├── popup.tsx
│   │   ├── options.tsx
│   │   └── components/
│   ├── ui/                     # UI 组件
│   │   ├── selector-ui.ts
│   │   ├── highlight.ts
│   │   ├── toolbar.ts
│   │   └── breadcrumb.ts
│   └── utils/                  # 工具函数
│       ├── cdp-client.ts
│       └── style-assembler.ts
├── build.mjs                   # 构建脚本
└── dist/                       # 构建输出
```

## 核心 CDP 命令

```typescript
// 启用域
DOM.enable()
CSS.enable()
Runtime.enable()

// 获取文档根节点
DOM.getDocument()

// 查询元素节点
DOM.querySelector({ nodeId, selector })

// 强制伪类状态
CSS.forcePseudoState({ nodeId, forcedPseudoClasses: ['hover'] })

// 获取匹配样式
CSS.getMatchedStylesForNode({ nodeId })

// 获取字体信息
CSS.getPlatformFontsForNode({ nodeId })

// 获取 outer HTML
DOM.getOuterHTML({ nodeId })
```

## 限制说明

- **权限要求** - 需要 `debugger` 权限，首次使用会有权限提示
- **页面限制** - 无法在 `chrome://` 或 `chrome-extension://` 页面使用
- **调试器连接** - 同一时间只能连接一个调试器
- **动态内容** - 选择过程中 DOM 变化时需重新选择元素

## 故障排除

| 问题 | 解决方案 |
|-----|---------|
| 无法定位元素 | 页面 DOM 可能已变化，重新选择元素 |
| 样式不完整 | 部分样式需要特定状态，工具会自动激活常见伪类 |
| 调试器连接失败 | 刷新页面或重启 Chrome |

## 许可证

MIT
