#!/usr/bin/env node
/**
 * 简单的 PNG 图标生成脚本
 * 生成基本的 1x1 PNG 图标作为占位符
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ICONS_DIR = join(process.cwd(), 'extension', 'icons');

// 简单的 1x1 透明 PNG (base64)
// 实际上这是一个最小的有效 PNG 文件
function createMinimalPNG(width, height, r, g, b, a = 255) {
  // PNG 签名
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR 块
  const ihdr = Buffer.alloc(17);
  ihdr.writeUInt32BE(13, 0); // 长度
  ihdr.write('IHDR', 4); // 类型
  ihdr.writeUInt32BE(width, 8); // width
  ihdr.writeUInt32BE(height, 12); // height
  ihdr[16] = 0x08; // bit depth
  ihdr[17] = 0x02; // color type (RGB)
  ihdr[18] = 0x00; // compression
  ihdr[19] = 0x00; // filter
  ihdr[20] = 0x00; // interlace

  // 计算 IHDR CRC
  const ihdrData = ihdr.slice(4, 17);
  const ihdrCrc = crc32(ihdrData);
  const ihdrCrcBuf = Buffer.alloc(4);
  ihdrCrcBuf.writeUInt32BE(ihdrCrc, 0);

  // IDAT 块 (压缩的图像数据)
  // 对于纯色图像，每行是: filter byte (0) + RGB 数据
  const rowSize = 1 + width * 3;
  const imageData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    imageData[rowOffset] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      imageData[pixelOffset] = r;
      imageData[pixelOffset + 1] = g;
      imageData[pixelOffset + 2] = b;
    }
  }

  // 简单的压缩（不压缩，使用无压缩块）
  const compressed = zlibDeflate(imageData);
  const idat = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IDAT'),
    compressed
  ]);
  idat.writeUInt32BE(compressed.length, 0);

  const idatCrc = crc32(idat.slice(4, 4 + 4 + compressed.length));
  const idatCrcBuf = Buffer.alloc(4);
  idatCrcBuf.writeUInt32BE(idatCrc, 0);

  // IEND 块
  const iend = Buffer.alloc(12);
  iend.writeUInt32BE(0, 0); // length
  iend.write('IEND', 4); // type
  const iendCrc = crc32(Buffer.from('IEND'));
  iend.writeUInt32BE(iendCrc, 8);

  return Buffer.concat([
    signature,
    ihdr,
    ihdrCrcBuf,
    idat,
    idatCrcBuf,
    iend
  ]);
}

// 简化的 CRC32 计算
function crc32(data) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// 简化的 deflate (不压缩)
function zlibDeflate(data) {
  const chunkSize = 65535;
  const chunks = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
    const isLast = i + chunkSize >= data.length;

    const header = Buffer.alloc(5);
    header[0] = isLast ? 0x01 : 0x00; // BFINAL + BTYPE
    header.writeUInt16LE(chunk.length, 1);
    header.writeUInt16LE(~chunk.length & 0xFFFF, 3);

    chunks.push(header);
    chunks.push(chunk);
  }

  // adler32 checksum
  const adler = adler32(data);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(adler, 0);

  // zlib header
  const zlibHeader = Buffer.from([0x78, 0x9C]);

  return Buffer.concat([zlibHeader, ...chunks, checksum]);
}

function adler32(data) {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

// 主函数
function main() {
  mkdirSync(ICONS_DIR, { recursive: true });

  const sizes = [16, 32, 48, 128];
  const color = { r: 13, g: 153, b: 255 }; // #0d99ff - 品牌蓝色

  for (const size of sizes) {
    const png = createMinimalPNG(size, size, color.r, color.g, color.b);
    writeFileSync(join(ICONS_DIR, `icon${size}.png`), png);
    console.log(`Created icon${size}.png (${size}x${size})`);
  }

  console.log('\n✅ All icons created!');
}

main();
