const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  session,
  shell,
  utilityProcess,
} = require("electron");
const { join } = require("node:path");
const {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
  statSync,
} = require("node:fs");
const { createServer } = require("node:net");
const http = require("node:http");
const { randomBytes } = require("node:crypto");

app.setName("Relaywork");
app.setPath(
  "userData",
  process.env.RELAYWORK_DESKTOP_PROFILE ||
    join(app.getPath("appData"), "Relaywork"),
);
const profile = app.getPath("userData");
mkdirSync(profile, { recursive: true });
const dataDir = join(profile, "data");
const logPath = join(profile, "desktop.log");
if (existsSync(logPath) && statSync(logPath).size > 1024 * 1024)
  writeFileSync(logPath, "");
let win,
  backend,
  origin,
  quitting = false;
const token = randomBytes(32).toString("hex");
const appRoot = app.isPackaged
  ? app.getAppPath()
  : join(__dirname, "..", ".desktop", "app");
const iconPath = join(__dirname, "assets", "icon.png");
function log(message) {
  appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
}
function fatal(message) {
  log(message);
  dialog.showErrorBox(
    "Relaywork couldn’t start",
    `${message}\n\nYour data is preserved. Diagnostic log: ${logPath}`,
  );
  app.quit();
}
function choosePort() {
  let preferred = 0;
  try {
    preferred = JSON.parse(
      readFileSync(join(profile, "server-port.json"), "utf8"),
    ).port;
  } catch {}
  if (!Number.isInteger(preferred) || preferred < 1024 || preferred > 65535)
    preferred = 0;
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (preferred && error.code === "EADDRINUSE") {
        preferred = 0;
        server.listen(0, "127.0.0.1");
      } else reject(error);
    });
    server.listen(preferred, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => {
        writeFileSync(
          join(profile, "server-port.json"),
          JSON.stringify({ port }),
        );
        resolve(port);
      });
    });
  });
}
function readyRequest() {
  return new Promise((resolve) => {
    const request = http.get(
      `${origin}/api/state`,
      { headers: { "x-relaywork-desktop-token": token }, timeout: 1200 },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => {
          try {
            const s = JSON.parse(body);
            resolve(
              response.statusCode === 200 &&
                s.demo === true &&
                Array.isArray(s.tasks),
            );
          } catch {
            resolve(false);
          }
        });
      },
    );
    request.on("error", () => resolve(false));
    request.on("timeout", () => request.destroy());
  });
}
async function startBackend() {
  const entry = join(appRoot, "server", "server.js");
  if (!existsSync(entry))
    throw Error(
      "Desktop assets are missing. Run npm run desktop:build before launching from source.",
    );
  const port = await choosePort();
  origin = `http://127.0.0.1:${port}`;
  backend = utilityProcess.fork(join(__dirname, "server.cjs"), [entry], {
    serviceName: "Relaywork local server",
    cwd: join(appRoot, "server"),
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      RELAYWORK_DEMO: "1",
      RELAYWORK_DATA_DIR: dataDir,
      RELAYWORK_DESKTOP_TOKEN: token,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  backend.stdout?.on("data", (chunk) => log(chunk.toString().trim()));
  backend.stderr?.on("data", (chunk) => log(chunk.toString().trim()));
  let exitCode;
  backend.once("exit", (code) => {
    exitCode = code;
    if (!quitting)
      fatal(
        "The local workspace service stopped. Restart Relaywork to reconnect.",
      );
  });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline && exitCode === undefined && !quitting) {
    if (await readyRequest()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error(
    "The local workspace service did not become ready. Check the diagnostic log and restart the app.",
  );
}
function send(action) {
  if (win && !win.isDestroyed()) {
    win.focus();
    win.webContents.send("desktop:action", action);
  }
}
function openExternal(url) {
  try {
    if (new URL(url).protocol === "https:") shell.openExternal(url);
  } catch {}
}
function configureSession() {
  const desktopSession = session.fromPartition("persist:relaywork");
  desktopSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  desktopSession.setPermissionCheckHandler(() => false);
  desktopSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) =>
      callback({ cancel: !details.url.startsWith(origin + "/") }),
  );
  desktopSession.webRequest.onBeforeSendHeaders(
    { urls: [origin + "/*"] },
    (details, callback) =>
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          "x-relaywork-desktop-token": token,
        },
      }),
  );
  desktopSession.webRequest.onHeadersReceived(
    { urls: [origin + "/*"] },
    (details, callback) =>
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
          ],
        },
      }),
  );
  desktopSession.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({
      title: "Export Relaywork tasks",
      defaultPath: join(app.getPath("documents"), item.getFilename()),
      filters: [{ name: "CSV files", extensions: ["csv"] }],
    });
  });
  return desktopSession;
}
function createWindow(desktopSession) {
  win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    title: "Relaywork",
    backgroundColor: "#fbfafc",
    icon: iconPath,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      session: desktopSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) {
      event.preventDefault();
      openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
  win.on("closed", () => {
    win = null;
  });
  win.loadURL(origin).catch(() => {
    if (!quitting)
      fatal(
        "The workspace window could not load. Restart Relaywork to try again.",
      );
  });
}
function buildMenu() {
  const mac = process.platform === "darwin";
  const template = [
    ...(mac
      ? [
          {
            label: "Relaywork",
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New task",
          accelerator: "CmdOrCtrl+N",
          click: () => send("new-task"),
        },
        {
          label: "Search tasks…",
          accelerator: "CmdOrCtrl+K",
          click: () => send("search"),
        },
        { type: "separator" },
        {
          label: "Show local data folder",
          click: () => shell.openPath(dataDir),
        },
        ...(mac
          ? [{ role: "close" }]
          : [{ type: "separator" }, { role: "quit" }]),
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "My work",
          accelerator: "CmdOrCtrl+1",
          click: () => send("my-work"),
        },
        {
          label: "Inbox",
          accelerator: "CmdOrCtrl+2",
          click: () => send("inbox"),
        },
        { type: "separator" },
        { label: "Board", click: () => send("board") },
        { label: "List", click: () => send("list") },
        { type: "separator" },
        { role: "reload" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(mac ? [{ role: "front" }] : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Getting started", click: () => send("help") },
        {
          label: "About Relaywork",
          click: () =>
            dialog.showMessageBox(win, {
              type: "info",
              title: "About Relaywork",
              message: `Relaywork ${require("../package.json").version}`,
              detail:
                "A little more in sync.\n\nLocal desktop demonstration with sample accounts. Data stays on this device. Production sign-in, cloud sync, email invitations and attachments are not connected.",
              buttons: ["Done"],
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  app.on("before-quit", () => {
    quitting = true;
    backend?.kill();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.whenReady().then(async () => {
    try {
      await startBackend();
      if (quitting) return;
      const s = configureSession();
      buildMenu();
      createWindow(s);
      app.on("activate", () => {
        if (!BrowserWindow.getAllWindows().length) createWindow(s);
      });
    } catch (e) {
      if (!quitting) fatal(e.message);
    }
  });
}
