# Style Extractor

## Extension Name
Style Extractor

## Short Description (max 132 characters)
Precisely extract HTML and CSS styles from web elements. Supports CSS variables, pseudo-elements, and inherited styles.

## Detailed Description

**Style Extractor** is a powerful web style extraction tool that helps developers, designers, and frontend engineers quickly and accurately extract style code from any web element.

### 🎯 Key Features

- **Precise Element Selection** - Visual element picker with real-time highlighting and parent element navigation
- **Complete Style Extraction** - Extract matched CSS rules, inline styles, and inherited styles
- **CSS Variable Support** - Automatically identify and extract related CSS custom properties (variables)
- **Pseudo-element Styles** - Automatically extract ::before, ::after, and other pseudo-element styles
- **Pseudo-class States** - Force activate :hover, :active, :focus states
- **Font Information** - Get the list of fonts actually rendered for the element
- **Live Preview** - Instantly preview extracted styles in the extension
- **One-click Copy/Download** - Support HTML/CSS code copying, generate complete HTML file for download

### 📋 How to Use

1. Click the extension icon to open the panel
2. Click the "Pick Element" button
3. Move your mouse over the page - elements will be highlighted
4. Click on the target element to confirm selection
5. Use the dropdown menu to select parent elements
6. Click the "Extract" button to get styles
7. View, copy, or download the extracted code in the results page

### 🔧 Technical Features

- Based on Chrome DevTools Protocol for precise and reliable extraction
- Works with modern frameworks like React, Vue, etc.
- Automatically filters browser default styles
- Intelligently generates CSS selectors

### 📦 Extracted Content

| Type | Description |
|------|-------------|
| HTML | Complete outerHTML of the element |
| Full CSS | All extracted styles merged |
| CSS Variables | Related variables extracted from :root |
| Inline Styles | Element's style attribute |
| Matched Rules | CSS rules directly matching the element |
| Inherited Styles | Inheritable properties from parent elements |
| Pseudo Elements | ::before, ::after pseudo-element styles |
| Font Info | List of fonts actually used |

### ⚠️ Notes

- First use requires granting debugger permission
- Cannot work on chrome:// and chrome-extension:// pages
- Some dynamic styles may require specific interaction states for correct extraction

### 🔒 Privacy

- Extension only runs when actively used
- Does not collect or upload any user data
- All extracted content is processed locally

---

**Keywords**: CSS extraction, style extraction, element inspector, frontend development, web design, CSS variables, style copy

## Category
Developer Tools

## Language
English, Chinese (Simplified)

## Screenshot Requirements
Prepare screenshots in these sizes:
- 1280x800 or 640x400
- Minimum 1, maximum 5 screenshots

Recommended screenshot content:
1. Extension Popup interface
2. Page element selection highlighting
3. Confirmation toolbar and parent element selection
4. Extraction results page (preview and code)

## Promotional Images

### Small Promotional Image
- Size: 440x280
- Usage: Chrome Store listing thumbnail

### Large Promotional Image
- Size: 1400x560
- Usage: Chrome Store detail page banner

### Marquee Promotional Image
- Size: 1400x560
- Usage: Chrome Store homepage display
