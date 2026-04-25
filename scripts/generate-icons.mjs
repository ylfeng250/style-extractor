/**
 * 生成扩展图标
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sizes = [16, 32, 48, 128];

// 选取箭头图标 SVG (cursor with arrow)
const iconSVG = `
<svg width="128" height="128" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" fill="none"/>
  <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" fill="#0d99ff"/>
  <path d="M13 13l6 6" stroke="#0d99ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

async function generateIcons() {
  const iconsDir = new URL('../extension/icons/', import.meta.url);

  // 确保目录存在
  if (!existsSync(iconsDir.pathname)) {
    mkdirSync(iconsDir.pathname, { recursive: true });
  }

  for (const size of sizes) {
    const outputPath = new URL(`icon${size}.png`, iconsDir);

    await sharp(Buffer.from(iconSVG))
      .resize(size, size)
      .png()
      .toFile(outputPath.pathname);

    console.log(`Generated icon${size}.png`);
  }

  console.log('\n✅ All icons generated!');
}

generateIcons().catch(console.error);
