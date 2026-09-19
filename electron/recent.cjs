const fs = require("node:fs/promises");
const path = require("node:path");
const { atomicWrite } = require("./files.cjs");
class RecentFiles {
  constructor(filename) {
    this.filename = filename;
    this.items = [];
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      const items = JSON.parse(await fs.readFile(this.filename, "utf8"));
      if (!Array.isArray(items)) throw Error("最近文件列表格式无效");
      this.items = [
        ...new Set(
          items.filter(
            (item) =>
              typeof item === "string" &&
              path.isAbsolute(item) &&
              !item.includes("\0"),
          ),
        ),
      ].slice(0, 5);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  list() {
    return [...this.items];
  }
  resolve(filename) {
    if (!this.items.includes(filename)) throw Error("文件不在最近打开列表中");
    return filename;
  }
  async remember(filename) {
    if (!path.isAbsolute(filename)) throw Error("最近文件需要绝对路径");
    this.items = [
      filename,
      ...this.items.filter((item) => item !== filename),
    ].slice(0, 5);
    const bytes = Buffer.from(JSON.stringify(this.items));
    this.queue = this.queue
      .catch(() => {})
      .then(() => atomicWrite(this.filename, bytes));
    await this.queue;
  }
}
module.exports = { RecentFiles };
