const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { readAsset, atomicWrite } = require("./files.cjs");
const entry = path.join(__dirname, "../index.html");
// Packaged startup verification uses isolated settings and never opens user files.
const verificationArg = process.argv.find(arg => arg.startsWith("--verify-package="));
const verificationReport = verificationArg?.slice("--verify-package=".length);
if (verificationReport) app.setPath("userData", path.join(path.dirname(verificationReport), "ibmsc-verify-profile"));
let currentPath = null,
  root = null,
  win,
  pendingPath = null,
  pendingToken = null;
let recent;
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
  checked(async () => {
    const choice = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [
        {
          name: "BMS / iBMSC",
          extensions: ["bms", "bme", "bml", "pms", "ibmsc", "ibmscx", "sm"],
        },
      ],
    });
    if (choice.canceled) return null;
    return stageFile(choice.filePaths[0]);
  }),
);
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
    const bytes = require("./save-data.cjs").saveBytes(request);
    const project = request.format === "ibmsc", portable = request.format === "ibmscx", pms = request.format === "pms";
    let target = request.saveAs ? null : currentPath;
    const compatible = portable ? /\.ibmscx$/i : project ? /\.ibmsc$/i : pms ? /\.pms$/i : /\.(bms|bme|bml)$/i;
    if (!target || !compatible.test(target)) {
      const choice = await dialog.showSaveDialog(win, {
        defaultPath: path.basename(
          request.name || (portable ? "untitled.ibmscx" : project ? "untitled.ibmsc" : pms ? "untitled.pms" : "untitled.bms"),
        ),
        filters: [
          portable ? { name: "IBMSCX", extensions: ["ibmscx"] } : project
            ? { name: "IBMSC", extensions: ["ibmsc"] }
            : pms ? { name: "PMS", extensions: ["pms"] }
            : { name: "BMS", extensions: ["bms", "bme", "bml"] },
        ],
      });
      if (choice.canceled) return null;
      target = choice.filePath;
      if (!compatible.test(target))
        throw Error("文件扩展名与所选保存格式不一致");
    }
    await atomicWrite(target, bytes);
    currentPath = target;
    root = path.dirname(target);
    return { name: path.basename(target), warning: await rememberFile(target) };
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
let playerProfiles;
ipcMain.handle("player:import", checked(async settings => playerProfiles.importSettings(settings)));
ipcMain.handle(
  "player:list",
  checked(async () => playerProfiles.snapshot()),
);
ipcMain.handle(
  "player:update",
  checked(async (id, templates) => playerProfiles.update(id, templates)),
);
ipcMain.handle(
  "player:select",
  checked(async (id) => playerProfiles.select(id)),
);
ipcMain.handle(
  "player:remove",
  checked(async (id) => playerProfiles.remove(id)),
);
const previewFiles = new Set();
ipcMain.handle(
  "player:choose",
  checked(async (id = null) => {
    const choice = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      title: "选择外部 BMS 播放器",
    });
    if (choice.canceled) return null;
    return playerProfiles.choose(choice.filePaths[0], id);
  }),
);
ipcMain.handle(
  "player:run",
  checked(async (request) => {
    const profile = playerProfiles.get(request?.playerId);
    const chosenPlayer = profile.path;
    if (!path.isAbsolute(chosenPlayer) || (process.platform !== "win32" && /\.exe$/i.test(chosenPlayer))) throw Error("这是其他平台的播放器路径，请先重新选择本机播放器程序");
    if (!root) throw Error("请先保存谱面，以确定音源目录");
    if (
      !request ||
      !["begin", "here", "stop"].includes(request.mode) ||
      typeof request.text !== "string" ||
      request.text.length > 32 * 1024 * 1024 ||
      !Number.isInteger(request.measure) ||
      request.measure < 0 ||
      request.measure > 999
    )
      throw Error("无效预览请求");
    let filename = currentPath;
    if (request.mode !== "stop") {
      filename = path.join(
        root,
        ".ibmsc-preview-" + require("node:crypto").randomUUID() + ".bms",
      );
      await fs.writeFile(filename, request.text, { flag: "wx" });
      previewFiles.add(filename);
    }
    const args = require("./player.cjs").playerArguments(
      profile[request.mode],
      {
        filename,
        measure: request.measure,
        apppath: app.getAppPath(),
      },
    );
    const spawn = require("node:child_process").spawn;
    const isMacBundle =
      process.platform === "darwin" && chosenPlayer.endsWith(".app");
    const child = spawn(
      isMacBundle ? "/usr/bin/open" : chosenPlayer,
      isMacBundle ? ["-a", chosenPlayer, "--args", ...args] : args,
      { shell: false, cwd: root, stdio: "ignore" },
    );
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    return true;
  }),
);
app.on("will-quit", () => {
  for (const file of previewFiles) {
    try {
      require("node:fs").unlinkSync(file);
    } catch {}
  }
});

function installMenu() {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(require("./menu.cjs").menuTemplate(
    (action, payload) => {
      const target = BrowserWindow.getFocusedWindow();
      if (target && !target.isDestroyed()) target.webContents.send("menu:action", action, payload);
    }, recent?.list() || [],
  )));
}
ipcMain.handle("menu:edit", checked((action) => {
  const methods = { undo: "undo", redo: "redo", cutnotes: "cut", copynotes: "copy", pastenotes: "paste", selectall: "selectAll", deletenotes: "delete" };
  if (!Object.hasOwn(methods, action)) throw Error("未知编辑命令");
  win.webContents[methods[action]]();
}));

function create() {
  installMenu();
  win = new BrowserWindow({
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
  if (!verificationReport) win.once("ready-to-show", () => win.show());
  win.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: "warning", title: "尚未保存", message: "谱面有未保存的修改。",
      detail: "返回编辑器保存，或放弃修改并关闭窗口。",
      buttons: ["返回编辑器", "放弃修改并关闭"], defaultId: 0, cancelId: 0,
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
  recent = new (require("./recent.cjs").RecentFiles)(
    path.join(app.getPath("userData"), "recent-files.json"),
  );
  try {
    await recent.load();
  } catch (e) {
    console.error(e.message);
  }
  playerProfiles = new (require("./player-profiles.cjs").PlayerProfiles)(
    path.join(app.getPath("userData"), "players.json"),
  );
  try {
    await playerProfiles.load();
  } catch (e) {
    console.error(e.message);
  }
  create();
});
app.on("activate", () => {
  if (!BrowserWindow.getAllWindows().length) create();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
