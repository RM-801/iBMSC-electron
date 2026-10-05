import { defaultColumns } from "./default-columns.js";
import { validateVisual } from "./visual-settings.js";

export const columnColorFields = [
  "NoteColor",
  "TextColor",
  "LongNoteColor",
  "LongTextColor",
  "BG",
];
export const visualColorFields = [
  "ColumnTitle",
  "Bg",
  "Grid",
  "Sub",
  "VLine",
  "MLine",
  "BGMWav",
  "SelBox",
  "TSCursor",
  "TSHalf",
  "TSMouseOver",
  "TSSel",
  "TSBPM",
  "kMouseOver",
  "kMouseOverE",
  "kSelected",
  "kError",
];
const visualNumberFields = [
  "TSDeltaMouseOver",
  "MiddleDeltaRelease",
  "kHeight",
  "kLabelVShift",
  "kLabelHShift",
  "kLabelHShiftL",
  "kOpacity",
];
const visualFontFields = ["ColumnTitleFont", "TSBPMFont", "kFont", "kMFont"];
const columnFields = new Set(["Index", "Width", "Title", ...columnColorFields]);
const scalarVisualFields = new Set([
  ...visualColorFields,
  ...visualNumberFields,
]);
const isRecord = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isNumber = (value) =>
  (typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "")) &&
  Number.isFinite(Number(value));
const isInteger = (value) => isNumber(value) && Number.isInteger(Number(value));
const isPlayableColumn = (index) =>
  (index >= 4 && index <= 11) || (index >= 13 && index <= 20) || index === 26;

function indexedColumns(columns) {
  if (!Array.isArray(columns)) throw Error("主题列定义无效");
  const indexed = new Map();
  for (const column of columns) {
    if (
      !isRecord(column) ||
      !isInteger(column.Index) ||
      Number(column.Index) < 0 ||
      Number(column.Index) > 26 ||
      indexed.has(Number(column.Index))
    )
      throw Error("主题列定义无效");
    indexed.set(Number(column.Index), column);
  }
  return indexed;
}

/** Make a full, independent editor draft. Renderer fallbacks remain the UI's choice. */
export function createThemeDraft(currentTheme = null) {
  if (currentTheme !== null && !isRecord(currentTheme))
    throw Error("主题列定义无效");
  const source = structuredClone(currentTheme || {});
  const columns = indexedColumns(
    source.columns === undefined ? [] : source.columns,
  );
  const visual = source.visual === undefined ? {} : source.visual;
  if (!isRecord(visual)) throw Error("主题视觉设置无效");
  return {
    ...source,
    columns: defaultColumns.map((column) => ({
      ...column,
      ...columns.get(Number(column.Index)),
    })),
    visual,
  };
}

function argbValue(value) {
  if (
    !isInteger(value) ||
    Number(value) < -2147483648 ||
    Number(value) > 4294967295
  )
    throw Error("主题颜色必须为 32 位 ARGB 整数");
  return Number(value) >>> 0;
}

export function argbToParts(value) {
  const argb = argbValue(value);
  return {
    color: "#" + (argb & 0xffffff).toString(16).padStart(6, "0"),
    alpha: argb >>> 24,
  };
}

export function partsToARGB(color, alpha) {
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))
    throw Error("颜色必须为 #RRGGBB 格式");
  if (!isInteger(alpha) || Number(alpha) < 0 || Number(alpha) > 255)
    throw Error("颜色不透明度必须为 0–255 的整数");
  return String(Number(alpha) * 0x1000000 + parseInt(color.slice(1), 16));
}

/** Validate without normalizing or mutating the draft or its source XML. */
export function validateTheme(theme) {
  if (!isRecord(theme)) throw Error("主题列定义无效");
  const columns = indexedColumns(theme.columns);
  if (columns.size !== 27) throw Error("主题列定义无效");
  let playable = false;
  for (const [index, column] of columns) {
    if (
      !isInteger(column.Width) ||
      Number(column.Width) < 0 ||
      Number(column.Width) > 999
    )
      throw Error("主题列宽必须为 0–999 的整数");
    if (typeof column.Title !== "string") throw Error("主题列定义无效");
    for (const field of columnColorFields) argbValue(column[field]);
    playable ||= isPlayableColumn(index) && Number(column.Width) > 0;
  }
  if (!playable) throw Error("主题至少需要一条可见的 A/D 或 BGM 轨道");
  const visual = theme.visual === undefined ? {} : theme.visual;
  if (
    !isRecord(visual) ||
    Object.values(visual).some((attrs) => !isRecord(attrs))
  )
    throw Error("主题视觉设置无效");
  for (const key of visualColorFields) {
    if (visual[key]?.Value !== undefined) argbValue(visual[key].Value);
  }
  for (const key of visualNumberFields) {
    if (visual[key]?.Value !== undefined && !isNumber(visual[key].Value))
      throw Error("无效视觉设置：" + key);
  }
  for (const key of ["kLabelVShift", "kLabelHShift", "kLabelHShiftL"]) {
    const value = visual[key]?.Value;
    if (
      value !== undefined &&
      (!isInteger(value) || Math.abs(Number(value)) > 999)
    )
      throw Error("无效视觉设置：" + key);
  }
  validateVisual(visual);
  return theme;
}

function elementChildren(node) {
  return Array.from(node.childNodes).filter((child) => child.nodeType === 1);
}

function namedChildren(node, tag) {
  return elementChildren(node).filter(
    (child) =>
      (child.localName || child.tagName) === tag &&
      (child.namespaceURI || null) === (node.namespaceURI || null),
  );
}

function createChild(doc, parent, tag) {
  const child = parent.namespaceURI
    ? doc.createElementNS(
        parent.namespaceURI,
        parent.prefix ? `${parent.prefix}:${tag}` : tag,
      )
    : doc.createElement(tag);
  parent.appendChild(child);
  return child;
}

function singleChild(doc, parent, tag) {
  const matches = namedChildren(parent, tag);
  if (matches.length > 1) throw Error("主题 XML 无效");
  return matches[0] || createChild(doc, parent, tag);
}

const xmlNamespace = "http://www.w3.org/XML/1998/namespace";
const xmlnsNamespace = "http://www.w3.org/2000/xmlns/";
const attributeName = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/;

function mergeNamespaceDeclarations(element, values) {
  for (const [name, value] of Object.entries(values)) {
    if (name !== "xmlns" && !name.startsWith("xmlns:")) continue;
    const prefix = name === "xmlns" ? null : name.slice(6);
    if (
      !attributeName.test(name) ||
      typeof value !== "string" ||
      (prefix && !value) ||
      prefix === "xmlns" ||
      value === xmlnsNamespace ||
      (prefix === "xml") !== (value === xmlNamespace)
    )
      throw Error("主题 XML 无效");
    // A model's declaration must not retarget the source's existing elements or
    // attributes. Preserve inherited bindings, and reject conflicting metadata.
    const bound =
      prefix === "xml" ? xmlNamespace : element.lookupNamespaceURI(prefix);
    if (
      (bound && bound !== value) ||
      (!prefix && value !== (element.namespaceURI || ""))
    )
      throw Error("主题 XML 无效");
    if (!element.hasAttribute(name))
      element.setAttributeNS(xmlnsNamespace, name, value);
  }
}

function mergeAttributes(element, values, known) {
  mergeNamespaceDeclarations(element, values);
  for (const [name, value] of Object.entries(values)) {
    // Existing unknown XML attributes belong to the source document. Keep them;
    // copy additional scalar metadata when the model has no source counterpart.
    if (!known.has(name) && element.hasAttribute(name)) continue;
    if (name === "xmlns" || name.startsWith("xmlns:")) continue;
    if (!attributeName.test(name)) {
      if (name.includes(":")) throw Error("主题 XML 无效");
      continue;
    }
    if (value === null || value === undefined || typeof value === "object")
      continue;
    const prefix = name.includes(":") ? name.split(":")[0] : null;
    if (prefix) {
      const namespace =
        prefix === "xml" ? xmlNamespace : element.lookupNamespaceURI(prefix);
      if (!namespace || namespace === xmlnsNamespace)
        throw Error("主题 XML 无效");
      element.setAttributeNS(namespace, name, String(value));
    } else element.setAttribute(name, String(value));
  }
}

/** Patch a cloned XML document, retaining unknown elements, attributes and children. */
export function updateThemeDocument(original, theme) {
  validateTheme(theme);
  if (
    !original?.documentElement ||
    (original.documentElement.localName || original.documentElement.tagName) !==
      "iBMSC"
  )
    throw Error("主题 XML 无效");
  const doc = original.cloneNode(true);
  const root = doc.documentElement;
  const columns = singleChild(doc, root, "Columns");
  const indexed = new Map();
  for (const node of namedChildren(columns, "Column")) {
    const index = node.getAttribute("Index");
    if (
      !isInteger(index) ||
      Number(index) < 0 ||
      Number(index) > 26 ||
      indexed.has(Number(index))
    )
      throw Error("主题 XML 无效");
    indexed.set(Number(index), node);
  }
  for (const column of theme.columns) {
    const node =
      indexed.get(Number(column.Index)) || createChild(doc, columns, "Column");
    mergeAttributes(node, column, columnFields);
  }
  const entries = Object.entries(theme.visual || {});
  if (entries.length) {
    const visual = singleChild(doc, root, "VisualSettings");
    for (const [tag, attrs] of entries) {
      if (!/^[A-Za-z_][\w.-]*$/.test(tag)) continue;
      const matches = namedChildren(visual, tag);
      const known = scalarVisualFields.has(tag)
        ? new Set(["Value"])
        : visualFontFields.includes(tag)
          ? new Set(["Name", "Size", "Style"])
          : new Set();
      if (matches.length > 1 && known.size) throw Error("主题 XML 无效");
      const element = matches[0] || createChild(doc, visual, tag);
      mergeAttributes(element, attrs, known);
    }
  }
  return doc;
}

/** Read the same namespace-scoped sections that the exporter updates. */
export function readThemeDocument(doc, sourceXml) {
  const root = doc?.documentElement;
  if (
    !root ||
    (root.localName || root.tagName) !== "iBMSC" ||
    doc.getElementsByTagName("parsererror").length
  )
    throw Error("主题 XML 无效");
  const columns = namedChildren(root, "Columns"),
    sections = namedChildren(root, "VisualSettings");
  if (columns.length !== 1 || sections.length > 1) throw Error("主题 XML 无效");
  const attrs = (node) =>
    Object.fromEntries(
      Array.from(node.attributes).map((a) => [a.name, a.value]),
    );
  const entries = namedChildren(columns[0], "Column").map(attrs);
  if (!entries.length) throw Error("主题列定义无效");
  const visual = {};
  if (sections[0])
    for (const node of elementChildren(sections[0])) {
      if ((node.namespaceURI || null) !== (root.namespaceURI || null)) continue;
      const key = node.localName || node.tagName;
      if (
        visual[key] &&
        (scalarVisualFields.has(key) || visualFontFields.includes(key))
      )
        throw Error("主题 XML 无效");
      if (!visual[key]) visual[key] = attrs(node);
    }
  return validateTheme(
    createThemeDraft({ columns: entries, visual, sourceXml }),
  );
}

/** Browser-native XML services can be injected for testing without a runtime dependency. */
export function serializeTheme(
  theme,
  {
    DOMParser = globalThis.DOMParser,
    XMLSerializer = globalThis.XMLSerializer,
  } = {},
) {
  const draft = createThemeDraft(theme);
  validateTheme(draft);
  let original;
  try {
    const source = draft.sourceXml || '<iBMSC Major="3" Minor="0" Build="5" />';
    if (typeof source !== "string") throw Error("主题 XML 无效");
    original = new DOMParser().parseFromString(source, "application/xml");
    if (original.getElementsByTagName("parsererror").length)
      throw Error("主题 XML 无效");
  } catch {
    throw Error("主题 XML 无效");
  }
  const updated = updateThemeDocument(original, draft);
  const body = new XMLSerializer()
    .serializeToString(updated)
    .replace(/^\uFEFF?\s*<\?xml\s[^?]*\?>\s*/i, "");
  return '<?xml version="1.0" encoding="utf-8"?>\n' + body;
}
