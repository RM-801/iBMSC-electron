const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const execute = promisify(execFile);
const executable = path.join(__dirname, "native", "SaveDialog.exe");
let building;

async function buildWindowsSaveDialog() {
  const source = path.join(__dirname, "native", "SaveDialog.cs");
  const [input, output] = await Promise.all([fs.stat(source), fs.stat(executable).catch(() => null)]);
  if (output && output.mtimeMs >= input.mtimeMs) return executable;
  const compiler = path.join(process.env.WINDIR || "C:\\Windows",
    "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
  await execute(compiler, ["/nologo", "/target:winexe", "/platform:anycpu",
    "/reference:System.Web.Extensions.dll", `/out:${executable}`, source], { windowsHide: true });
  return executable;
}

async function showWindowsSaveDialog(win, options, packaged = false) {
  const binary = packaged
    ? executable.replace(/app\.asar([\\/])/, "app.asar.unpacked$1")
    : await (building ||= buildWindowsSaveDialog().catch(error => { building = null; throw error; }));
  const handle = win.getNativeWindowHandle();
  const owner = (handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE())).toString();
  win.setEnabled(false);
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(binary, [], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      const onClosed = () => child.kill();
      win.once("closed", onClosed);
      const cleanup = () => win.removeListener("closed", onClosed);
      child.stdout.setEncoding("utf8").on("data", data => { stdout += data; });
      child.stderr.setEncoding("utf8").on("data", data => { stderr += data; });
      child.once("error", error => { cleanup(); reject(error); });
      child.stdin.on("error", () => {}); // Exit/error below reports a failed helper.
      child.once("close", code => {
        cleanup();
        if (code !== 0) return reject(Error(stderr || "无法打开保存窗口"));
        try {
          const result = JSON.parse(stdout.replace(/^\uFEFF/, ""));
          if (!result.canceled && (typeof result.filePath !== "string" ||
            !path.isAbsolute(result.filePath) || !["utf8", "shift_jis"].includes(result.encoding)))
            throw Error("保存窗口返回了无效结果");
          resolve(result);
        } catch (error) { reject(error); }
      });
      child.stdin.end(JSON.stringify({ ...options, owner }));
    });
  } finally {
    if (!win.isDestroyed()) { win.setEnabled(true); win.focus(); }
  }
}
module.exports = { buildWindowsSaveDialog, showWindowsSaveDialog };
