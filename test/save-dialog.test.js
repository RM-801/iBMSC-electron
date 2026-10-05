import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("Windows save dialog chooses output encoding; cancel and unrepresentable text never write", async () => {
  const dirname = fileURLToPath(new URL("../electron", import.meta.url));
  const handlers = new Map(),
    writes = [],
    choices = [],
    seen = [];
  const source = await readFile(path.join(dirname, "main.cjs"), "utf8");
  const mainFrame = {
    url: pathToFileURL(path.join(dirname, "../index.html")).href,
  };
  const webContents = { mainFrame };
  const context = vm.createContext({
    __dirname: dirname,
    console,
    setTimeout,
    Uint8Array,
    process: { platform: "win32", argv: [], cwd: () => dirname },
    testWindow: { webContents },
    require(name) {
      if (name === "electron")
        return {
          app: {
            whenReady: () => ({ then() {} }),
            on() {},
            getPath: () => dirname,
            isPackaged: true,
            requestSingleInstanceLock: () => true,
          },
          ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
          Menu: { setApplicationMenu() {} },
          dialog: {
            showSaveDialog: () => {
              throw Error("Unexpected second save dialog");
            },
          },
        };
      if (name === "./files.cjs")
        return { atomicWrite: async (...args) => writes.push(args) };
      if (name === "./windows-save-dialog.cjs")
        return {
          showWindowsSaveDialog: async (_win, options) => {
            seen.push(options);
            return choices.shift();
          },
        };
      if (name === "./save-data.cjs")
        return require("../electron/save-data.cjs");
      if (name.startsWith("./")) return require(path.join(dirname, name));
      return require(name);
    },
  });
  vm.runInContext(source, context);
  vm.runInContext(
    "win = testWindow; recent = { remember: async () => {} };",
    context,
  );
  const event = { sender: webContents, senderFrame: mainFrame };
  const request = {
    format: "bms",
    name: "日本語.bms",
    text: "#TITLE 日本語\r\n#00011:01\r\n",
    encoding: "utf8",
    saveAs: true,
  };
  choices.push({ canceled: true });
  assert.equal(await handlers.get("file:save")(event, request), null);
  assert.equal(writes.length, 0);
  choices.push({
    filePath: path.join(dirname, "sjis.bms"),
    encoding: "shift_jis",
  });
  const saved = await handlers.get("file:save")(event, request);
  assert.equal(seen[0].encoding, "utf8");
  assert.equal(saved.encoding, "shift_jis");
  assert.equal(
    require("iconv-lite").decode(writes[0][1], "shift_jis"),
    request.text,
  );
  assert.notDeepEqual(writes[0][1], Buffer.from(request.text));
  choices.push({
    filePath: path.join(dirname, "invalid.bms"),
    encoding: "shift_jis",
  });
  await assert.rejects(
    handlers.get("file:save")(event, { ...request, text: "#TITLE 看上她" }),
    /她.*UTF-8/,
  );
  assert.equal(writes.length, 1);
  assert.equal(
    vm.runInContext("currentPath", context),
    path.join(dirname, "sjis.bms"),
  );
  const count = seen.length;
  await handlers.get("file:save")(event, {
    ...request,
    saveAs: false,
    encoding: saved.encoding,
  });
  assert.equal(seen.length, count);
  assert.deepEqual(writes[1][1], writes[0][1]);
  choices.push({ filePath: path.join(dirname, "utf8.bms"), encoding: "utf8" });
  await handlers.get("file:save")(event, { ...request, text: "#TITLE 看上她" });
  assert.equal(writes[2][1].toString("utf8"), "#TITLE 看上她");
});
