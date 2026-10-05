const audioExtensions = [".wav", ".ogg", ".mp3"];

function normalizedPath(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\0") ||
    /^[\\/]|^[a-z]:/i.test(value)
  )
    return null;
  const parts = [];
  for (const part of value.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part.normalize("NFC").toLowerCase());
  }
  return parts.length ? parts.join("/") : null;
}

function alternatives(path) {
  const extension = path.match(/\.[^/.]+$/)?.[0];
  return audioExtensions.includes(extension)
    ? [
        path,
        ...audioExtensions
          .filter((ext) => ext !== extension)
          .map((ext) => path.slice(0, -extension.length) + ext),
      ]
    : [path];
}

function add(index, path, file) {
  if (!index.has(path)) index.set(path, new Set());
  index.get(path).add(file);
}

function match(index, path) {
  for (const candidate of alternatives(path)) {
    const files = index.get(candidate);
    if (files?.size)
      return files.size === 1
        ? { file: files.values().next().value }
        : { error: "音源路径存在歧义" };
  }
}

// Folder picking exposes relative paths, not the device's absolute filesystem
// paths. Preserve directory names when rebasing a selection onto WAV references.
export function resolveBrowserSoundFiles(files, names) {
  const relative = new Map(),
    full = new Map(),
    suffixes = new Map();
  for (const file of files) {
    const path = normalizedPath(file.webkitRelativePath || file.name);
    if (!path) continue;
    const parts = path.split("/");
    add(relative, parts.length > 1 ? parts.slice(1).join("/") : path, file);
    add(full, path, file);
    for (let i = 0; i < parts.length; i++)
      add(suffixes, parts.slice(i).join("/"), file);
  }
  return [...new Set(names)].map((name) => {
    const path = normalizedPath(name);
    if (!path) return { name, error: "无效音源路径" };
    let result = match(relative, path);
    // A user may select the referenced sound subfolder itself. Its name must
    // still match the reference: never discard a directory to match a basename.
    const parts = path.split("/");
    for (let i = 0; !result && i < parts.length - 1; i++)
      result = match(full, parts.slice(i).join("/"));
    // Selecting a parent of the chart folder also works when the complete
    // reference suffix identifies exactly one file within that selection.
    result ??= match(suffixes, path);
    return { name, ...(result || { error: "未找到音源文件" }) };
  });
}
