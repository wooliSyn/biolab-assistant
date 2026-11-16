// 仅供 `npm run dev:browser`：在普通浏览器里用 localStorage 模拟 Rust 侧的 IPC 命令，
// 方便做 UI 迭代。不会进入 tauri build（那条路径不走 browser 模式）。
const K = (k) => `biolab:${k}`;
const store = {
  get: (k) => { try { return localStorage.getItem(K(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(K(k), v); } catch { /* ignore */ } },
};
const handlers = {
  load_data: ({ key }) => store.get(key),
  load_many: ({ keys }) => Object.fromEntries(keys.map((k) => [k, store.get(k)]).filter(([, v]) => v != null)),
  save_data: ({ key, value }) => { store.set(key, value); },
  data_dir_path: () => "(浏览器预览：localStorage)",
  clear_all_data: () => { try { Object.keys(localStorage).filter((k) => k.startsWith("biolab:")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } },
  save_text_file: ({ content, filename, name, defaultName }) => {
    const blob = new Blob([content ?? ""], { type: "text/plain" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename || name || defaultName || "export.txt" });
    a.click();
    return a.download;
  },
  save_attachment: () => null,
  open_file: () => null,
  reveal_file: () => null,
  send_notification: ({ title, body }) => { console.info("[通知]", title, body); },
  request_attention: () => null,
  minimize_window: () => null,
  close_window: () => null,
  quit_app: () => null,
  set_mini_mode: () => null,
};
export const invoke = async (cmd, args = {}) => {
  const h = handlers[cmd];
  if (!h) { console.warn("[browser-shim] 未模拟的命令", cmd, args); return null; }
  return h(args);
};
export const convertFileSrc = (p) => p;
