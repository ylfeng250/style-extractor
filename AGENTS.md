# AGENTS.md

AI agent instructions for the Style Extractor Chrome extension project.

## Project Overview

Style Extractor is a Chrome extension (Manifest V3) that extracts HTML and CSS from any web element using Chrome DevTools Protocol (CDP). It enables developers to inspect and copy styles with precision.

## Tech Stack

- **Language**: TypeScript
- **Framework**: React 18 (popup/options pages)
- **Build**: esbuild (see `build.mjs`)
- **Extension**: Chrome Manifest V3
- **API**: Chrome Debugger API / CDP

## Project Structure

```
style-extractor/
├── extension/
│   ├── manifest.json           # Extension manifest (Manifest V3)
│   ├── background/
│   │   └── service-worker.ts   # Background script, handles CDP operations
│   ├── content/
│   │   └── content-script.ts   # Injected into pages, handles element selection
│   ├── popup/
│   │   ├── popup.tsx           # Popup UI entry
│   │   ├── options.tsx         # Options page (shows extraction results)
│   │   └── components/         # React components
│   ├── ui/                     # UI components for content script
│   │   ├── selector-ui.ts      # Element selection logic
│   │   ├── highlight.ts        # Element highlighting overlay
│   │   ├── toolbar.ts          # Selection toolbar
│   │   └── breadcrumb.ts       # Element path breadcrumb
│   └── utils/
│       ├── cdp-client.ts       # CDP client wrapper
│       └── style-assembler.ts  # CSS assembly and processing
├── build.mjs                   # Build script (esbuild)
└── dist/                       # Build output (load this in Chrome)
```

## Architecture

### Message Flow

```
Popup → Content Script → Background (CDP) → Options Page
```

1. **Popup** sends `START_PICKING` to content script
2. **Content Script** handles element selection, sends `ELEMENT_SELECTED` to background
3. **Background** uses CDP to extract styles, saves to `chrome.storage.local`
4. **Options Page** opens automatically to display results

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| CDP Client | `extension/utils/cdp-client.ts` | Wraps `chrome.debugger` API |
| Style Assembler | `extension/utils/style-assembler.ts` | Processes CDP style data into CSS |
| Selector UI | `extension/ui/selector-ui.ts` | Element picker with highlighting |
| Service Worker | `extension/background/service-worker.ts` | Coordinates CDP operations |

## Build Commands

```bash
npm run build      # Production build
npm run dev        # Development build with watch mode
npm run clean      # Remove dist/
```

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- No comments unless explaining non-obvious behavior
- Prefer functional components with hooks for React
- Keep functions small and focused

### Extension APIs Used

- `chrome.debugger` - CDP communication (requires `debugger` permission)
- `chrome.storage.local` - Persist extraction results
- `chrome.runtime.sendMessage` - Cross-context communication
- `chrome.scripting` - Content script injection

### CDP Commands Used

```typescript
DOM.enable, DOM.getDocument, DOM.querySelector, DOM.getOuterHTML
CSS.enable, CSS.getMatchedStylesForNode, CSS.forcePseudoState, CSS.getPlatformFontsForNode, CSS.getStyleSheetText, CSS.getComputedStyleForNode
```

## Common Tasks

### Adding a new style extraction feature

1. Update `cdp-client.ts` if new CDP commands needed
2. Modify `style-assembler.ts` to process new data
3. Update `service-worker.ts` to fetch and pass new data
4. Update `OptionsPage.tsx` to display new results

### Modifying element selection behavior

1. Edit `extension/ui/selector-ui.ts` for selection logic
2. Edit `extension/ui/highlight.ts` for visual feedback
3. Update `content-script.ts` if message handling changes

### Adding new UI controls

1. Create component in `extension/popup/components/`
2. Import in `popup.tsx` or `options.tsx`
3. Rebuild with `npm run build`

## Testing

Load the extension in Chrome:

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" → select `dist/` folder

Test on any non-restricted page (not `chrome://` URLs).

## Important Constraints

- **Debugger permission**: Required for CDP; shows warning banner to users
- **Single debugger**: Only one debugger can attach to a tab at a time
- **Restricted pages**: Cannot work on `chrome://`, `chrome-extension://`, or Chrome Web Store
- **Async message handling**: Always return `true` from message listeners that respond asynchronously

## Git Workflow

- **Development branch**: `dev` - All feature development happens here
- **Main branch**: `master` - Stable release branch, updated via merge from `dev`
- Build artifacts (`dist/`) are not committed
- GitHub Actions builds release zip on push to `master`

### Workflow

1. Create or switch to `dev` branch for development
2. Implement features and commit changes
3. Merge `dev` into `master` when ready for release
4. GitHub Actions automatically builds and uploads release zip

### Documentation

- **README.md** and **README-ZH.md** must reflect the current state of the project
- After any feature update, check if README documentation is outdated
- Update README files if there are discrepancies between code behavior and documentation
