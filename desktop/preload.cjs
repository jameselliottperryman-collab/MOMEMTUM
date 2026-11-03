const { contextBridge, ipcRenderer } = require("electron");
const actions = new Set([
  "new-task",
  "search",
  "my-work",
  "inbox",
  "board",
  "list",
  "help",
]);
const flushers = new Set();
ipcRenderer.on("desktop:flush", async (_event, id) => {
  let ok = true;
  try {
    const results = await Promise.all(
      [...flushers].map((callback) => callback()),
    );
    ok = results.every((result) => result !== false);
  } catch {
    ok = false;
  }
  ipcRenderer.send("desktop:flushed", id, ok);
});
contextBridge.exposeInMainWorld("relayworkDesktop", {
  platform: process.platform,
  onBeforeQuit(callback) {
    if (typeof callback !== "function")
      throw new TypeError("Expected a callback");
    flushers.add(callback);
    return () => flushers.delete(callback);
  },
  onAction(callback) {
    if (typeof callback !== "function")
      throw new TypeError("Expected a callback");
    const listener = (_event, action) => {
      if (actions.has(action)) callback(action);
    };
    ipcRenderer.on("desktop:action", listener);
    return () => ipcRenderer.removeListener("desktop:action", listener);
  },
});
