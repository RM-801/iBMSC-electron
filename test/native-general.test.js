import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const dirname = fileURLToPath(new URL("../electron", import.meta.url));
const root = path.parse(dirname).root;
const executable = path.join(root, "iBMSC.exe");
const scores = path.join(root, "scores");
const otherScores = path.join(root, "other");

async function mainHarness({ argv = [executable], lock = true } = {}) {
  const handlers = new Map(),
    events = new Map(),
    notices = [],
    associations = [],
    reads = [];
  let beeps = 0,
    focused = 0,
    quit = 0,
    locked = 0;
  const mainFrame = {
    url: pathToFileURL(path.join(dirname, "../index.html")).href,
  };
  const webContents = { mainFrame, send: (...args) => notices.push(args) };
  const window = {
    webContents,
    isDestroyed: () => false,
    isMinimized: () => false,
    show() {},
    focus() {
      focused++;
    },
  };
  const context = vm.createContext({
    __dirname: dirname,
    console,
    setTimeout,
    Uint8Array,
    process: {
      platform: process.platform === "win32" ? "win32" : "linux",
      argv,
      execPath: executable,
      cwd: () => scores,
    },
    testWindow: window,
    require(name) {
      if (name === "electron")
        return {
          app: {
            whenReady: () => ({ then() {} }),
            on: (name, fn) => events.set(name, fn),
            isPackaged: true,
            getPath: () => dirname,
            setPath() {},
            requestSingleInstanceLock: () => {
              locked++;
              return lock;
            },
            quit: () => {
              quit++;
            },
          },
          ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
          shell: {
            beep: () => {
              beeps++;
            },
            openExternal: async () => {},
          },
          Menu: { setApplicationMenu() {} },
        };
      if (name === "node:fs/promises")
        return {
          stat: async () => ({ isFile: () => true, size: 20 }),
          readFile: async (filename) => {
            reads.push(filename);
            return Buffer.from("#TITLE launch\n");
          },
        };
      if (name === "./file-association.cjs")
        return {
          associateFile: async (...args) => {
            associations.push(args);
            return { registered: true };
          },
        };
      if (name.startsWith("./")) return require(path.join(dirname, name));
      return require(name);
    },
  });
  vm.runInContext(
    await readFile(path.join(dirname, "main.cjs"), "utf8"),
    context,
  );
  vm.runInContext(
    "win = testWindow; initialized = true; recent = { remember: async () => {} };",
    context,
  );
  const event = { sender: webContents, senderFrame: mainFrame };
  return {
    handlers,
    events,
    notices,
    associations,
    reads,
    context,
    event,
    counts: () => ({ beeps, focused, quit, locked }),
  };
}

test("association and beep IPC are inert at startup and only accept the trusted editor frame", async () => {
  const app = await mainHarness();
  assert.equal(
    [...app.handlers.keys()].some((name) => name.startsWith("player:")),
    false,
  );
  assert.equal(app.associations.length, 0);
  assert.equal(app.counts().beeps, 0);
  assert.equal(app.counts().locked, 1);
  await assert.rejects(
    app.handlers.get("app:associateFile")({ sender: {} }, ".bms"),
    /拒绝/,
  );
  await assert.rejects(
    app.handlers.get("app:beep")({
      sender: app.event.sender,
      senderFrame: { url: app.event.senderFrame.url },
    }),
    /拒绝/,
  );
  assert.equal(app.associations.length, 0);
  assert.equal(app.counts().beeps, 0);
  await app.handlers.get("app:associateFile")(app.event, ".pms");
  assert.equal(app.associations.length, 1);
  assert.equal(app.associations[0][0], ".pms");
  assert.equal(app.associations[0][1].isPackaged, true);
  assert.equal(await app.handlers.get("app:beep")(app.event), true);
  assert.equal(app.counts().beeps, 1);
});

test("startup and second-instance charts wait for the renderer and use the existing file acceptance flow", async () => {
  const app = await mainHarness({
    argv: [executable, "startup song.bms"],
  });
  assert.deepEqual(app.notices, []);
  assert.deepEqual(app.reads, []);
  await app.handlers.get("file:readyForOpen")(app.event);
  assert.equal(app.notices.length, 1);
  const [channel, token] = app.notices[0];
  assert.equal(channel, "file:openRequested");
  const file = await app.handlers.get("file:openRequested")(app.event, token);
  assert.equal(file.name, "startup song.bms");
  assert.equal(Buffer.from(file.bytes).toString(), "#TITLE launch\n");
  await app.handlers.get("file:accept")(app.event, file.token);
  assert.equal(
    vm.runInContext("currentPath", app.context),
    path.join(scores, "startup song.bms"),
  );
  assert.equal(vm.runInContext("root", app.context), scores);
  app.events.get("second-instance")({}, [executable, "next.pms"], otherScores);
  assert.equal(app.notices.length, 1);
  await app.handlers.get("file:finishOpenRequest")(app.event, token);
  assert.equal(app.notices.length, 2);
  const nextToken = app.notices[1][1];
  const next = await app.handlers.get("file:openRequested")(
    app.event,
    nextToken,
  );
  assert.equal(next.name, "next.pms");
  assert.equal(app.reads.at(-1), path.join(otherScores, "next.pms"));
  await app.handlers.get("file:cancelOpen")(app.event, next.token);
  await app.handlers.get("file:finishOpenRequest")(app.event, nextToken);
  await assert.rejects(
    app.handlers.get("file:openRequested")(app.event, nextToken),
    /已失效/,
  );
  assert.equal(
    vm.runInContext("currentPath", app.context),
    path.join(scores, "startup song.bms"),
  );
  assert.equal(app.counts().focused, 1);
});

test("a secondary process quits and package verification neither takes the user lock nor queues charts", async () => {
  const secondary = await mainHarness({
    lock: false,
    argv: ["iBMSC.exe", "song.bms"],
  });
  assert.equal(secondary.counts().quit, 1);
  await secondary.handlers.get("file:readyForOpen")(secondary.event);
  assert.deepEqual(secondary.notices, []);
  const verify = await mainHarness({
    argv: ["iBMSC.exe", "song.bms", "--verify-package=C:\\tmp\\report.json"],
  });
  assert.equal(verify.counts().locked, 0);
  await verify.handlers.get("file:readyForOpen")(verify.event);
  assert.deepEqual(verify.notices, []);
  assert.deepEqual(verify.associations, []);
});

test("preload exposes platform capabilities and waits for the open callback before clearing its token", async () => {
  const source = await readFile(path.join(dirname, "preload.cjs"), "utf8");
  for (const platform of ["win32", "darwin", "linux"]) {
    const listeners = new Map(),
      calls = [];
    let desktop;
    vm.runInNewContext(source, {
      process: { platform },
      require(name) {
        assert.equal(name, "electron");
        return {
          contextBridge: {
            exposeInMainWorld: (_name, api) => {
              desktop = api;
            },
          },
          webUtils: {},
          ipcRenderer: {
            on: (name, listener) => listeners.set(name, listener),
            removeListener: (name) => listeners.delete(name),
            invoke: async (...args) => {
              calls.push(args);
            },
          },
        };
      },
    });
    assert.equal(desktop.nativePlatform, platform);
    assert.equal(desktop.capabilities.fileAssociation, platform === "win32");
    assert.equal(desktop.capabilities.beep, true);
    for (const removed of [
      "choosePlayer",
      "importPlayers",
      "players",
      "updatePlayer",
      "selectPlayer",
      "removePlayer",
      "runPlayer",
    ])
      assert.equal(Object.hasOwn(desktop, removed), false, removed);
    assert.deepEqual(calls, []);
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const unsubscribe = desktop.onOpenFile(async (token) => {
      assert.equal(token, "token-one");
      await pending;
    });
    assert.deepEqual(calls, [["file:readyForOpen"]]);
    listeners.get("file:openRequested")({}, "token-one");
    await Promise.resolve();
    assert.equal(calls.length, 1);
    release();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls.at(-1), ["file:finishOpenRequest", "token-one"]);
    unsubscribe();
    assert.equal(listeners.has("file:openRequested"), false);
    desktop.onOpenFile(() => {
      throw Error("Discard canceled before reading");
    });
    listeners.get("file:openRequested")({}, "token-two");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls.at(-1), ["file:finishOpenRequest", "token-two"]);
    await desktop.beep();
    assert.deepEqual(calls.at(-1), ["app:beep"]);
    await desktop.associateFile(".bme");
    assert.deepEqual(calls.at(-1), ["app:associateFile", ".bme"]);
  }
});
