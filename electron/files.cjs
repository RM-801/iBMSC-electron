const fs = require("node:fs/promises");
const path = require("node:path");
function within(root, target) {
  const relative = path.relative(root, target);
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  )
    throw Error("音源不在已打开的谱面目录中");
}
const fold = (name) => name.normalize("NFC").toLowerCase();
async function resolveAsset(root, name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.includes("\0") ||
    path.isAbsolute(name) ||
    /^[a-zA-Z]:/.test(name)
  )
    throw Error("无效音源路径");
  const actualRoot = await fs.realpath(root);
  const requested = path.resolve(actualRoot, name.replaceAll("\\", "/"));
  within(actualRoot, requested);
  // Resolve each component inside the chart directory, including on case-sensitive
  // Linux. Validate symlinks before descending into a directory.
  const parts = path.relative(actualRoot, requested).split(path.sep);
  let current = actualRoot;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i],
      candidate = path.join(current, part);
    let actual;
    try {
      actual = await fs.realpath(candidate);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const entries = await fs.readdir(current);
      let matches = entries.filter((n) => fold(n) === fold(part));
      if (
        !matches.length &&
        i === parts.length - 1 &&
        [".wav", ".ogg", ".mp3"].includes(path.extname(part).toLowerCase())
      ) {
        const stem = fold(path.basename(part, path.extname(part)));
        for (const extension of [".wav", ".ogg", ".mp3"]) {
          matches = entries.filter((n) => fold(n) === stem + extension);
          if (matches.length) break;
        }
      }
      if (matches.length > 1) throw Error("音源路径存在大小写歧义：" + name);
      if (!matches.length) throw error;
      actual = await fs.realpath(path.join(current, matches[0]));
    }
    within(actualRoot, actual);
    current = actual;
  }
  return current;
}
async function readAsset(root, name) {
  const actual = await resolveAsset(root, name);
  const stat = await fs.stat(actual);
  if (!stat.isFile() || stat.size > 256 * 1024 * 1024)
    throw Error("音源过大或不是文件");
  return new Uint8Array(await fs.readFile(actual));
}
async function atomicWrite(target, bytes) {
  const temporary =
    target + ".ibmsc-" + process.pid + "-" + Date.now() + ".tmp";
  try {
    await fs.writeFile(temporary, bytes, { flag: "wx" });
    await fs.rename(temporary, target);
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}
module.exports = { readAsset, resolveAsset, atomicWrite };
