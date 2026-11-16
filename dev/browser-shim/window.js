const noop = async () => {};
const win = new Proxy({}, { get: (_, p) => (p === "then" ? undefined : p === "listen" || p.startsWith("on") ? async () => () => {} : noop) });
export const getCurrentWindow = () => win;
export const Window = { getCurrent: () => win };
