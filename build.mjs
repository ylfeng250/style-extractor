#!/usr/bin/env node
/**
 * 扩展构建脚本 - 使用 esbuild
 */

import { build } from "esbuild";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  cpSync,
  existsSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = join(ROOT, "dist");

const WATCH = process.argv.includes("--watch");

/**
 * 生成图标（如果不存在）
 */
function ensureIcons() {
  const iconsDir = join(ROOT, "extension", "icons");
  const iconSizes = [16, 32, 48, 128];
  const hasAllIcons = iconSizes.every((size) =>
    existsSync(join(iconsDir, `icon${size}.png`)),
  );

  if (!hasAllIcons) {
    console.log("🎨 Generating icons...");
    try {
      execSync("node scripts/generate-icons.mjs", {
        cwd: ROOT,
        stdio: "inherit",
      });
    } catch (err) {
      console.warn("Failed to generate icons:", err.message);
    }
  }
}

/**
 * 递归复制目录
 */
function copyDir(src, dest) {
  try {
    cpSync(src, dest, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to copy ${src} to ${dest}:`, err);
  }
}

/**
 * 复制静态文件
 */
function copyStaticFiles() {
  // 复制 manifest.json
  copyFileSync(
    join(ROOT, "extension", "manifest.json"),
    join(DIST, "manifest.json"),
  );

  // 复制 popup.html
  copyFileSync(
    join(ROOT, "extension", "popup", "popup.html"),
    join(DIST, "popup.html"),
  );

  // 复制 options.html
  copyFileSync(
    join(ROOT, "extension", "popup", "options.html"),
    join(DIST, "options.html"),
  );

  // 复制图标（如果有）
  const iconsDir = join(ROOT, "extension", "icons");
  try {
    const iconsDest = join(DIST, "icons");
    mkdirSync(iconsDest, { recursive: true });
    copyDir(iconsDir, iconsDest);
  } catch {
    // 图标可选
    console.log("No icons directory found");
  }
}

/**
 * 主构建函数
 */
async function main() {
  console.log(
    WATCH ? "👀 Watching for changes..." : "🔨 Building extension...",
  );

  // 确保 dist 目录存在
  mkdirSync(DIST, { recursive: true });

  // 确保图标存在
  ensureIcons();

  // 复制静态文件
  copyStaticFiles();

  const commonConfig = {
    bundle: true,
    target: "es2020",
    platform: "browser",
    sourcemap: false,
    minify: !WATCH,
    define: {
      "process.env.NODE_ENV": WATCH ? '"development"' : '"production"',
    },
    jsx: "automatic",
    external: ["chrome"],
  };

  try {
    // 构建 Content Script
    await build({
      ...commonConfig,
      entryPoints: [join(ROOT, "extension", "content", "content-script.ts")],
      outfile: join(DIST, "content-script.js"),
      format: "iife",
    });
    console.log("✅ Content script built");

    // 构建 Service Worker
    await build({
      ...commonConfig,
      entryPoints: [join(ROOT, "extension", "background", "service-worker.ts")],
      outfile: join(DIST, "background.js"),
      format: "esm",
    });
    console.log("✅ Service worker built");

    // 构建 Popup
    await build({
      ...commonConfig,
      entryPoints: [join(ROOT, "extension", "popup", "popup.tsx")],
      outfile: join(DIST, "popup.js"),
      format: "esm",
    });
    console.log("✅ Popup built");

    // 构建 Options Page
    await build({
      ...commonConfig,
      entryPoints: [join(ROOT, "extension", "popup", "options.tsx")],
      outfile: join(DIST, "options.js"),
      format: "esm",
    });
    console.log("✅ Options page built");

    console.log("\n🎉 Build complete!");
    console.log(`📦 Output: ${DIST}`);
    console.log("\nTo load the extension:");
    console.log("1. Open chrome://extensions");
    console.log('2. Enable "Developer mode"');
    console.log('3. Click "Load unpacked" and select the dist folder');
  } catch (err) {
    console.error("❌ Build failed:", err);
    process.exit(1);
  }
}

main();
