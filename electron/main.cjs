const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { readAsset, atomicWrite } = require("./files.cjs");
const { launchFiles, FileOpenRequests } = require("./launch-files.cjs");
const entry = path.join(__dirname, "../index.html");
// Packaged startup verification uses isolated settings and never opens user files.
const verificationArg = process.argv.find(arg => arg.startsWith("--verify-package="));
const verificationReport = verificationArg?.slice("--verify-package=".length);
if (verificationReport) app.setPath("userData", path.join(path.dirname(verificationReport), "ibmsc-verify-profile"));
let currentPath = null,
  root = null,
  win,
  initialized = false,
  pendingPath = null,
  pendingToken = null;
let recent;
const fileOpenRequests = new FileOpenRequests(token => {
  if (win && !win.isDestroyed()) win.webContents.send("file:openRequested", token);
});
function focusWindow() {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } else if (initialized) create();
}
function requestLaunchFiles(argv, cwd) {
  for (const filename of launchFiles(argv, { cwd, isPackaged: app.isPackaged, platform: process.platform }))
    fileOpenRequests.add(filename);
  focusWindow();
}
const ownsInstance = verificationReport || app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
if (ownsInstance && !verificationReport) {
  requestLaunchFiles(process.argv, process.cwd());
  app.on("second-instance", (_event, argv, cwd) => requestLaunchFiles(argv, cwd));
  app.on("open-file", (event, filename) => {
    event.preventDefault();
    for (const file of launchFiles([process.execPath, filename], { isPackaged: true, platform: process.platform }))
      fileOpenRequests.add(file);
    focusWindow();
  });
}
async function stageFile(filename) {
  const stat = await fs.stat(filename);
  if (!stat.isFile() || stat.size > 32 * 1024 * 1024)
    throw Error("谱面过大或不是文件");
  const bytes = new Uint8Array(await fs.readFile(filename));
  pendingPath = filename;
  pendingToken = require("node:crypto").randomUUID();
  return { name: path.basename(filename), bytes, token: pendingToken };
}
async function rememberFile(filename) {
  try {
    await recent.remember(filename);
    installMenu();
    return null;
  } catch (e) {
    return "最近文件列表保存失败：" + e.message;
  }
}
function checked(handler) {
  return async (event, ...args) => {
    if (
      event.sender !== win?.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !== pathToFileURL(entry).href
    )
      throw Error("拒绝未知页面的文件请求");
    return handler(...args);
  };
}
ipcMain.handle(
  "file:open",
  checked(async (kind) => {
    const choice = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [
        {
          name: "BMS / iBMSC",
          extensions: kind === "sm" ? ["sm"] : kind === "ibmsc" ? ["ibmsc"] : ["bms", "bme", "bml", "pms", "ibmsc", "ibmscx", "sm"],
        },
      ],
    });
    if (choice.canceled) return null;
    return stageFile(choice.filePaths[0]);
  }),
);
ipcMain.handle("app:website", checked(() => shell.openExternal("https://github.com/RM-801/iBMSC-electron/releases")));
ipcMain.handle("app:beep", checked(() => { shell.beep(); return true; }));
ipcMain.handle("app:associateFile", checked(extension => require("./file-association.cjs").associateFile(extension, {
  isPackaged: app.isPackaged, openExternal: url => shell.openExternal(url),
})));
ipcMain.handle("file:readyForOpen", checked(() => fileOpenRequests.setReady(true)));
ipcMain.handle("file:openRequested", checked(token => stageFile(fileOpenRequests.resolve(token))));
ipcMain.handle("file:finishOpenRequest", checked(token => fileOpenRequests.finish(token)));
ipcMain.handle(
  "file:accept",
  checked(async (token) => {
    if (!pendingPath || token !== pendingToken) throw Error("没有待打开文件");
    currentPath = pendingPath;
    root = path.dirname(currentPath);
    pendingPath = null;
    pendingToken = null;
    return { warning: await rememberFile(currentPath) };
  }),
);
ipcMain.handle(
  "file:recent",
  checked(async () => recent.list()),
);
ipcMain.handle(
  "file:openRecent",
  checked(async (filename) => stageFile(recent.resolve(filename))),
);
ipcMain.handle(
  "file:cancelOpen",
  checked(async (token) => {
    if (token === pendingToken) {
      pendingPath = null;
      pendingToken = null;
    }
  }),
);
ipcMain.handle(
  "file:new",
  checked(async () => {
    currentPath = null;
    root = null;
    pendingPath = null;
    pendingToken = null;
  }),
);
ipcMain.handle(
  "file:save",
  checked(async (request) => {
    let encoding = request.encoding || "utf8";
    const project = request.format === "ibmsc", portable = request.format === "ibmscx", pms = request.format === "pms";
    let target = request.saveAs ? null : currentPath;
    const compatible = portable ? /\.ibmscx$/i : project ? /\.ibmsc$/i : pms ? /\.pms$/i : /\.(bms|bme|bml)$/i;
    if (!target || !compatible.test(target)) {
      const options = {
        defaultPath: currentPath && compatible.test(currentPath) ? currentPath : path.join(currentPath ? path.dirname(currentPath) : app.getPath("documents"), path.basename(
          request.name || (portable ? "untitled.ibmscx" : project ? "untitled.ibmsc" : pms ? "untitled.pms" : "untitled.bms"),
        )),
        filters: [
          portable ? { name: "IBMSCX", extensions: ["ibmscx"] } : project
            ? { name: "IBMSC", extensions: ["ibmsc"] }
            : pms ? { name: "PMS", extensions: ["pms"] }
            : { name: "BMS", extensions: ["bms", "bme", "bml"] },
        ],
      };
      const choice = process.platform === "win32" && !project && !portable
        ? await require("./windows-save-dialog.cjs").showWindowsSaveDialog(win, {
          defaultPath: options.defaultPath, format: pms ? "pms" : "bms", encoding,
          title: translateUI("另存为"), encodingLabel: translateUI("保存编码") + " (&E):",
        }, app.isPackaged)
        : await dialog.showSaveDialog(win, options);
      if (choice.canceled) return null;
      encoding = choice.encoding || encoding;
      target = choice.filePath;
      if (!compatible.test(target))
        throw Error("文件扩展名与所选保存格式不一致");
    }
    const bytes = require("./save-data.cjs").saveBytes({ ...request, encoding });
    await atomicWrite(target, bytes);
    currentPath = target;
    root = path.dirname(target);
    return { name: path.basename(target), encoding, warning: await rememberFile(target) };
  }),
);
async function relativeSoundPaths(filenames) {
  if (!root) throw Error("请先打开或保存谱面");
  if (
    !Array.isArray(filenames) ||
    filenames.length > 1295 ||
    filenames.some(
      (name) =>
        typeof name !== "string" ||
        !path.isAbsolute(name) ||
        !/\.(wav|ogg|mp3)$/i.test(name),
    )
  )
    throw Error("无效音源文件列表");
  const actualRoot = await fs.realpath(root),
    names = [];
  for (const filename of filenames) {
    const actual = await fs.realpath(filename),
      relative = path.relative(actualRoot, actual);
    if (
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)
    )
      throw Error("所选音源不在谱面目录中，请先将音源放入谱面目录或其子文件夹");
    names.push(relative.split(path.sep).join("\\"));
  }
  return names;
}
ipcMain.handle("file:dropSounds", checked(relativeSoundPaths));
ipcMain.handle(
  "file:openDropped",
  checked(async (filename) => {
    if (
      typeof filename !== "string" ||
      !path.isAbsolute(filename) ||
      !/\.(bms|bme|bml|pms|ibmsc|ibmscx|sm)$/i.test(filename)
    )
      throw Error("无效谱面文件");
    return stageFile(filename);
  }),
);
ipcMain.handle(
  "file:chooseSounds",
  checked(async (multiple = true) => {
    if (!root) throw Error("请先打开或保存谱面，再浏览对应目录的音源");
    const choice = await dialog.showOpenDialog(win, {
      defaultPath: root,
      properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
      filters: [{ name: "音源", extensions: ["wav", "ogg", "mp3"] }],
    });
    if (choice.canceled) return null;
    return relativeSoundPaths(choice.filePaths);
  }),
);
ipcMain.handle(
  "file:asset",
  checked(async (name) => {
    if (!root) throw Error("请先打开谱面");
    return readAsset(root, name);
  }),
);
ipcMain.handle(
  "file:autosave",
  checked(async (text) => {
    if (typeof text !== "string" || text.length > 32 * 1024 * 1024)
      throw Error("自动保存数据无效");
    await atomicWrite(
      path.join(app.getPath("userData"), "recovery.bms"),
      Buffer.from(text),
    );
    return true;
  }),
);
ipcMain.handle(
  "file:recover",
  checked(async () => {
    try {
      return await fs.readFile(
        path.join(app.getPath("userData"), "recovery.bms"),
        "utf8",
      );
    } catch {
      return null;
    }
  }),
);
let menuState = {};
let translateUI = text => text;
ipcMain.handle("menu:state", checked(async (state) => {
  if (["chs", "jpn", "eng", "kor"].includes(state?.language)) {
    const { createTranslator } = await import("../src/localization.js");
    translateUI = createTranslator(state.language);
  }
  for (const key of ["nt", "previewclick", "showfilename"])
    if (typeof state?.[key] === "boolean") menuState[key] = state[key];
  installMenu();
}));
function installMenu() {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(require("./menu.cjs").menuTemplate(
    (action, payload) => {
      const target = BrowserWindow.getFocusedWindow();
      if (target && !target.isDestroyed()) target.webContents.send("menu:action", action, payload);
    }, recent?.list() || [], menuState, translateUI,
  )));
}
ipcMain.handle("menu:edit", checked((action) => {
  const methods = { undo: "undo", redo: "redo", cutnotes: "cut", copynotes: "copy", pastenotes: "paste", selectall: "selectAll", deletenotes: "delete" };
  if (!Object.hasOwn(methods, action)) throw Error("未知编辑命令");
  win.webContents[methods[action]]();
}));

function create() {
  fileOpenRequests.setReady(false);
  installMenu();
  win = new BrowserWindow({
    ...(process.platform === "win32" ? { icon: path.join(__dirname, "../assets/app/ibmsc.ico") } : {}),
    show: false,
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#202020",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.on("closed", () => fileOpenRequests.setReady(false));
  win.webContents.on("did-start-loading", () => fileOpenRequests.setReady(false));
  if (!verificationReport) win.once("ready-to-show", () => win.show());
  win.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: "warning", title: translateUI("尚未保存"), message: translateUI("谱面有未保存的修改。"),
      detail: translateUI("返回编辑器保存，或放弃修改并关闭窗口。"),
      buttons: [translateUI("返回编辑器"), translateUI("放弃修改并关闭")], defaultId: 0, cancelId: 0,
    });
    if (choice === 1) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  if (verificationReport) {
    const errors = [];
    win.webContents.on("console-message", (details) => {
      if (details.level === "error" || details.level === 3) errors.push(details.message);
    });
    const finish = async (loaded, reason) => {
      await fs.writeFile(verificationReport, JSON.stringify({ loaded, reason, errors,
        menuLabels: Menu.getApplicationMenu()?.items.map(item => item.label),
        packaged: app.isPackaged, arch: process.arch, version: app.getVersion() }, null, 2));
      app.exit(loaded && !errors.length ? 0 : 1);
    };
    win.webContents.once("did-fail-load", (_event, code, description) => finish(false, `${code}: ${description}`));
    win.webContents.once("did-finish-load", () => setTimeout(() => finish(true), 1500));
    setTimeout(() => finish(false, "startup timeout"), 20000).unref();
  }
  win.loadFile(entry);
}
app.whenReady().then(async () => {
  if (!ownsInstance) return;
  recent = new (require("./recent.cjs").RecentFiles)(
    path.join(app.getPath("userData"), "recent-files.json"),
  );
  try {
    await recent.load();
  } catch (e) {
    console.error(e.message);
  }
  initialized = true;
  create();
});
app.on("activate", () => {
  if (ownsInstance && initialized && !BrowserWindow.getAllWindows().length) create();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
