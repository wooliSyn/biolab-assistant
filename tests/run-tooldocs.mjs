// 构建 tooldocs 冒烟测试：esbuild 插件处理 vite 风格的 ?raw 导入与 css 导入（node 环境不需要样式）
import esbuild from "esbuild";
import path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const rawPlugin = {
  name: "raw-and-css",
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({
      path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, "")),
      namespace: "raw-file",
    }));
    b.onLoad({ filter: /.*/, namespace: "raw-file" }, async (a) => ({
      contents: await readFile(a.path, "utf8"),
      loader: "text",
    }));
    b.onLoad({ filter: /\.css$/ }, () => ({ contents: "", loader: "js" }));
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "tests/tooldocs-smoke.jsx")],
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  alias: { "@tauri-apps/api/core": path.join(root, "tests/stub-tauri.js") },
  outfile: path.join(root, ".test-tooldocs.cjs"),
  plugins: [rawPlugin],
  logLevel: "error",
});
console.log("tooldocs test bundled");