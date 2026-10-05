import { locales } from "./locales.js";
import { uiTranslations } from "./ui-translations.js";
import { formatMessage } from "./messages.js";

const clean = (text) => text.replaceAll("&", "").replace(/\s+/g, " ").trim();
function parts(text) {
  const match = clean(text).match(
    /^([→↶↷■▶]\s*)?(.*?)(\s*[（(](?:[A-Z]|F\d+)[)）])?([.…]*)$/,
  );
  return {
    prefix: match[1] || "",
    label: match[2].trim(),
    suffix: (match[3] || "") + (match[4] || ""),
  };
}
const originalKeys = new Map();
for (const [key, value] of Object.entries(locales.chs.values)) {
  const label = parts(value).label;
  if (!originalKeys.has(label)) originalKeys.set(label, key);
}
originalKeys.set("另存为", "Menu/File/SaveAs");
// The port uses clearer captions while retaining the original language XML keys.
for (const [label, key] of [
  ["视图", "Title"],
  ["显示 / 隐藏", "ToolTip"],
  ["菜单栏", "Menu"],
  ["工具栏", "ToolBar"],
  ["操作面板", "OptionsPanel"],
  ["状态栏", "StatusBar"],
  ["左分屏", "LSplit"],
  ["右分屏", "RSplit"],
  ["主网格", "Grid"],
  ["副网格", "Sub"],
  ["轨道背景", "BG"],
  ["小节编号", "MeasureIndex"],
  ["小节线", "MeasureLine"],
  ["垂直线", "Vertical"],
  ["列标题", "ColumnCaption"],
])
  originalKeys.set(label, "SubMenu/ShowHide/" + key);

export function createTranslator(language = "chs", custom = null) {
  if (!locales[language]) language = "chs";
  const locale = locales[language] || locales.chs;
  return (source, ...values) => {
    const message = formatMessage(source, language, values);
    if (message !== null) return message;
    const { prefix, label, suffix } = parts(String(source));
    const key = originalKeys.get(label);
    const imported = custom?.[key];
    const extra =
      uiTranslations[clean(source)]?.[language] ||
      uiTranslations[label]?.[language];
    const original = locale.values[key] || locales.eng.values[key];
    let result = String(source);
    if (imported) result = prefix + parts(imported).label + suffix;
    else if (language !== "chs") {
      if (uiTranslations[clean(source)]?.[language]) result = extra;
      else if (extra || original)
        result = prefix + (extra || parts(original).label) + suffix;
    }
    return result.replace(/\{(\d+)\}/g, (match, index) =>
      values[index] === undefined ? match : String(values[index]),
    );
  };
}

// Capture only UI nodes present at startup (and explicitly registered dynamic UI).
// Never scan runtime chart titles, paths, resource lists, or editor text for words.
export function createLocalization(root) {
  let language = "chs",
    custom = null,
    translate = createTranslator();
  const bindings = new Map();
  let writes = 0;
  function write(target, property, value) {
    if (property.startsWith("@")) target.setAttribute(property.slice(1), value);
    else target[property] = value;
  }
  function prune() {
    for (const target of bindings.keys())
      if ((target.ownerElement || target).isConnected === false)
        bindings.delete(target);
  }
  function bind(target, property, source, values = []) {
    // A newly built select may not have been attached yet. Sweep only after
    // the current construction/refresh has completed.
    if (++writes % 256 === 0) queueMicrotask(prune);
    let properties = bindings.get(target);
    if (!properties) bindings.set(target, (properties = new Map()));
    properties.set(property, { source, values });
    write(target, property, translate(source, ...values));
  }
  function render(binding) {
    return binding.rows
      ? binding.rows
          .map(
            ({ prefix = "", source, values = [] }) =>
              prefix + translate(source, ...values),
          )
          .join("\n")
      : translate(binding.source, ...binding.values);
  }
  function capture(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      if (node.nodeValue.trim()) bind(node, "nodeValue", node.nodeValue);
      return;
    }
    for (const attribute of ["title", "aria-label", "placeholder"]) {
      const source = node.getAttribute?.(attribute);
      if (source) {
        // Attribute nodes let us update accessibility text without replacing controls.
        const target = node.getAttributeNode(attribute);
        bind(target, "value", source);
      }
    }
    if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(node.tagName)) return;
    for (const child of node.childNodes || []) capture(child);
  }
  capture(root);
  return {
    t: (source, ...values) => translate(source, ...values),
    text: (element, source, ...values) =>
      bind(element, "textContent", source, values),
    title: (element, source, ...values) =>
      bind(element, "title", source, values),
    attribute: (element, name, source, ...values) =>
      bind(element, "@" + name, source, values),
    raw(element, value) {
      bindings.get(element)?.delete("textContent");
      element.textContent = value;
    },
    rows(element, rows) {
      bind(element, "textContent", "");
      const binding = { rows };
      bindings.get(element).set("textContent", binding);
      element.textContent = render(binding);
    },
    copyText(element, from) {
      const binding = bindings.get(from)?.get("textContent");
      if (!binding) {
        this.raw(element, from.textContent);
        return;
      }
      bind(element, "textContent", "");
      bindings.get(element).set("textContent", binding);
      element.textContent = render(binding);
    },
    capture,
    get language() {
      return language;
    },
    setLanguage(next, imported = null) {
      language = locales[next] ? next : "chs";
      custom = imported;
      translate = createTranslator(language, custom);
      prune();
      for (const [target, properties] of bindings) {
        for (const [property, binding] of properties)
          write(target, property, render(binding));
      }
    },
  };
}
