const path = require("node:path");
const { randomUUID } = require("node:crypto");

function launchFiles(
  argv,
  { cwd = process.cwd(), isPackaged = true, platform = process.platform } = {},
) {
  const paths = platform === "win32" ? path.win32 : path.posix;
  return argv
    .slice(isPackaged ? 1 : 2)
    .filter(
      (value) =>
        typeof value === "string" &&
        !value.startsWith("-") &&
        !value.includes("\0") &&
        /\.(?:bms|bme|bml|pms|ibmsc|ibmscx|sm)$/i.test(value) &&
        !/^[a-z][a-z\d+.-]*:\/\//i.test(value),
    )
    .map((value) => paths.resolve(cwd, value));
}

class FileOpenRequests {
  constructor(notify, token = randomUUID) {
    this.notify = notify;
    this.token = token;
    this.queue = [];
    this.active = null;
    this.ready = false;
  }
  add(filename) {
    this.queue.push({ token: this.token(), filename });
    this.dispatch();
  }
  setReady(ready) {
    this.ready = ready;
    if (!ready && this.active) {
      this.queue.unshift({ ...this.active, token: this.token() });
      this.active = null;
    }
    this.dispatch();
  }
  dispatch() {
    if (!this.ready || this.active || !this.queue.length) return;
    this.active = this.queue.shift();
    this.notify(this.active.token);
  }
  resolve(token) {
    if (typeof token !== "string" || token !== this.active?.token)
      throw Error("文件打开请求已失效");
    return this.active.filename;
  }
  finish(token) {
    if (token !== this.active?.token) return;
    this.active = null;
    this.dispatch();
  }
}

module.exports = { launchFiles, FileOpenRequests };
