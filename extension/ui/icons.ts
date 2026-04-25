/**
 * SVG 图标定义
 */

export interface IconDefinition {
  path: string;
  fillRule?: string;
}

export const icons: Record<string, IconDefinition> = {
  'icon.24.spinner': {
    path: 'M15.333 7.011a6 6 0 0 0-2.834-.99A.534.534 0 0 1 12 5.5c0-.276.224-.502.5-.482A7 7 0 1 1 5.017 12.5.473.473 0 0 1 5.5 12c.276 0 .498.224.52.5a6 6 0 1 0 9.313-5.489',
    fillRule: 'evenodd',
  },
  'icon.24.check': {
    path: 'M15.584 7.722a.5.5 0 0 1 .832.555l-5 7.5a.502.502 0 0 1-.77.076l-3-3a.5.5 0 0 1 .708-.707l2.568 2.569z',
  },
  'icon.24.warning': {
    path: 'm10.257 6.059-5.04 8.96C4.467 16.352 5.43 18 6.96 18h10.08c1.53 0 2.493-1.646 1.743-2.98l-5.04-8.96c-.764-1.36-2.722-1.36-3.486 0m.871.49-5.04 8.96A1 1 0 0 0 6.96 17h10.08a1 1 0 0 0 .872-1.49l-5.04-8.96a1 1 0 0 0-1.744 0M12 8.5a.5.5 0 0 1 .5.5v3.5a.5.5 0 1 1-1 0V9a.5.5 0 0 1 .5-.5m.75 6.254a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0',
    fillRule: 'evenodd',
  },
  'icon.24.close.large': {
    path: 'M17.354 6.646a.5.5 0 0 1 0 .708L12.707 12l4.647 4.646a.5.5 0 0 1-.708.708L12 12.707l-4.646 4.647a.5.5 0 0 1-.708-.708L11.293 12 6.646 7.354a.5.5 0 0 1 .708-.707L12 11.293l4.646-4.647a.5.5 0 0 1 .708 0',
    fillRule: 'evenodd',
  },
  'icon.24.browser': {
    path: 'M17 6a2 2 0 0 1 2 2v8l-.01.204a2 2 0 0 1-1.786 1.785L17 18H7l-.204-.01a2 2 0 0 1-1.785-1.786L5 16V8a2 2 0 0 1 2-2zM6 16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5H6zm1-9a1 1 0 0 0-.995.897L6 8v2h12V8a1 1 0 0 0-1-1zm.5 1a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1m2 0a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1',
  },
  'icon.24.interaction.click': {
    path: 'M9.321 5.532a.5.5 0 0 1 .653.27l.777 1.876c.102.245-.039.524-.285.626s-.537.002-.639-.244L9.05 6.186a.5.5 0 0 1 .271-.654m-1.26 4.295L6.186 9.05a.5.5 0 0 0-.383.924l1.875.777c.246.101.524-.04.626-.285.102-.246.003-.537-.243-.64m-.383 3.422-1.875.776a.5.5 0 1 0 .383.924l1.875-.777c.246-.102.345-.393.243-.639s-.38-.386-.626-.284m2.149 2.69-.777 1.874a.5.5 0 0 0 .924.383l.777-1.875c.102-.245-.04-.524-.285-.626s-.537-.002-.639.244m6.495-5.188 1.874-.777a.5.5 0 1 0-.382-.924l-1.875.777c-.246.101-.346.393-.244.639s.381.386.627.285m-2.15-2.69.777-1.875a.5.5 0 1 0-.924-.383l-.776 1.875c-.102.245.039.524.284.626.246.102.538.002.64-.244m-1.82 3.002a1 1 0 0 0-1.288 1.288l2.25 6a1 1 0 0 0 1.906-.109l.605-2.418 2.418-.604a1 1 0 0 0 .108-1.907zm3.94 3.614L15 15l-.323 1.29L14.25 18l-.618-1.65-1.166-3.108L12 12l1.243.466 3.108 1.165L18 14.25z',
    fillRule: 'evenodd',
  },
};

/**
 * 创建 SVG 图标元素
 * @param name 图标名称
 * @param color 图标颜色
 * @param isSpinner 是否为旋转动画图标
 * @returns SVG 元素
 */
export function createSVGIcon(name: string, color: string, isSpinner = false): SVGElement {
  const iconDef = icons[name];
  if (!iconDef) throw new Error(`Unknown icon: ${name}`);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  (svg as unknown as HTMLElement).style.cssText = `
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    animation: ${isSpinner ? 'spin 1s linear infinite' : ''};
  `;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', iconDef.path);
  path.setAttribute('fill', color);
  if (iconDef.fillRule) {
    path.setAttribute('fill-rule', iconDef.fillRule);
    path.setAttribute('clip-rule', iconDef.fillRule);
  }

  svg.appendChild(path);
  return svg;
}
