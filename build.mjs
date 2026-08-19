#!/usr/bin/env node
/**
 * 扩展构建脚本 - 使用 esbuild
 */

import { build, context } from "esbuild";
import {
  copyFileSync,
  mkdirSync,
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

function ensureIcons() {
  const iconsDir = join(ROOT, "extension", "icons");
  const iconSizes = [16, 32, 48, 128];
  const hasAllIcons = iconSizes.every((size) =>
    existsSync(join(iconsDir, `icon${size}.png`)),
  );

  if (!hasAllIcons) {
    console.log("Generating icons...");
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

function copyDir(src, dest) {
  try {
    cpSync(src, dest, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to copy ${src} to ${dest}:`, err);
  }
}

function copyStaticFiles() {
  copyFileSync(
    join(ROOT, "extension", "manifest.json"),
    join(DIST, "manifest.json"),
  );
  copyFileSync(
    join(ROOT, "extension", "popup", "popup.html"),
    join(DIST, "popup.html"),
  );
  copyFileSync(
    join(ROOT, "extension", "popup", "options.html"),
    join(DIST, "options.html"),
  );

  const iconsDir = join(ROOT, "extension", "icons");
  try {
    const iconsDest = join(DIST, "icons");
    mkdirSync(iconsDest, { recursive: true });
    copyDir(iconsDir, iconsDest);
  } catch {
    console.log("No icons directory found");
  }
}

function getBundleConfigs(commonConfig) {
  return [
    {
      name: "Content script",
      options: {
        ...commonConfig,
        entryPoints: [join(ROOT, "extension", "content", "content-script.ts")],
        outfile: join(DIST, "content-script.js"),
        format: "iife",
      },
    },
    {
      name: "Service worker",
      options: {
        ...commonConfig,
        entryPoints: [join(ROOT, "extension", "background", "service-worker.ts")],
        outfile: join(DIST, "background.js"),
        format: "esm",
      },
    },
    {
      name: "Popup",
      options: {
        ...commonConfig,
        entryPoints: [join(ROOT, "extension", "popup", "popup.tsx")],
        outfile: join(DIST, "popup.js"),
        format: "esm",
      },
    },
    {
      name: "Options page",
      options: {
        ...commonConfig,
        entryPoints: [join(ROOT, "extension", "popup", "options.tsx")],
        outfile: join(DIST, "options.js"),
        format: "esm",
      },
    },
  ];
}

async function main() {
  console.log(WATCH ? "Watching for changes..." : "Building extension...");

  mkdirSync(DIST, { recursive: true });
  ensureIcons();
  copyStaticFiles();

  const commonConfig = {
    bundle: true,
    target: "es2020",
    platform: "browser",
    sourcemap: WATCH,
    minify: !WATCH,
    define: {
      "process.env.NODE_ENV": WATCH ? '"development"' : '"production"',
    },
    jsx: "automatic",
    external: ["chrome"],
  };

  const bundles = getBundleConfigs(commonConfig);

  try {
    if (WATCH) {
      for (const { name, options } of bundles) {
        const ctx = await context(options);
        await ctx.watch();
        console.log(`Watching ${name}`);
      }
      console.log(`\nWatching. Output: ${DIST}`);
      console.log("To load the extension:");
      console.log("1. Open chrome://extensions");
      console.log('2. Enable "Developer mode"');
      console.log('3. Click "Load unpacked" and select the dist folder');
      return;
    }

    for (const { name, options } of bundles) {
      await build(options);
      console.log(`${name} built`);
    }

    console.log("\nBuild complete!");
    console.log(`Output: ${DIST}`);
    console.log("\nTo load the extension:");
    console.log("1. Open chrome://extensions");
    console.log('2. Enable "Developer mode"');
    console.log('3. Click "Load unpacked" and select the dist folder');
  } catch (err) {
    console.error("Build failed:", err);
    process.exit(1);
  }
}

main();
