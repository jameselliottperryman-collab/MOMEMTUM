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
contextBridge.exposeInMainWorld("relayworkDesktop", {
  platform: process.platform,
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
