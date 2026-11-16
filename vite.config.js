import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 版本号唯一来源：package.json。界面里一律用 __APP_VERSION__，禁止再硬编码版本字符串
// （历史上界面写死的版本号与安装包版本长期不一致）。三处配置文件用 sync-version.mjs 对齐。
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// `vite --mode browser`（npm run dev:browser）：把 Tauri API 换成 dev/browser-shim 里的
// localStorage 垫片，方便在普通浏览器里调 UI。tauri dev / tauri build 不走这个 mode。
const browserShim = (mode) => mode === "browser" ? {
  "@tauri-apps/api/core": fileURLToPath(new URL("./dev/browser-shim/core.js", import.meta.url)),
  "@tauri-apps/api/window": fileURLToPath(new URL("./dev/browser-shim/window.js", import.meta.url)),
  "@tauri-apps/plugin-notification": fileURLToPath(new URL("./dev/browser-shim/notification.js", import.meta.url)),
} : {};

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: { alias: browserShim(mode) },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
