import {
  generalDefaults,
  validateGeneralSettings,
} from "./general-settings.js";

export const preferenceFields = {
  editorzoom: ["Grid", "EditorZoom", "number", 50, 300],
  zoom: ["Grid", "gxHeight", "decimal", 0.25, 99],
  widthzoom: ["Grid", "gxWidth", "decimal", 0.25, 99],
  subgrid: ["Grid", "gSub", "number", 1, 65536],
  showsubgrid: ["Grid", "gShowS", "boolean"],
  wavelock: ["WaveForm", "wLock", "boolean"],
  waveposition: ["WaveForm", "wPosition", "number", 0, 192000],
  waveleft: ["WaveForm", "wLeft", "number", 0, 800],
  wavewidth: ["WaveForm", "wWidth", "number", 0, 1000],
  waveprecision: ["WaveForm", "wPrecision", "number", 0, 50],
  pageunits: ["Grid", "gPgUpDn", "number", 1, 100000],
  wheelunits: ["Grid", "gWheel", "number", 1, 100000],
  middlemove: ["Edit", "MiddleButtonMoveMethod", "number", 0, 1],
  autofocus: ["Edit", "AutoFocusMouseEnter", "boolean"],
  firstclick: ["Edit", "FirstClickDisabled", "boolean"],
  clickstop: ["Edit", "ClickStopPreview", "boolean"],
  beepsaved: ["Save", "BeepWhileSaved", "boolean"],
  bpmextended: ["Save", "BPMx1296", "boolean"],
  stopextended: ["Save", "STOPx1296", "boolean"],
  snap: ["Grid", "gSnap", "boolean"],
  showgrid: ["Grid", "gShow", "boolean"],
  showbackground: ["Grid", "gShowBG", "boolean"],
  showmeasureindex: ["Grid", "gShowM", "boolean"],
  showmeasureline: ["Grid", "gShowMB", "boolean"],
  showvertical: ["Grid", "gShowV", "boolean"],
  showcolumncaption: ["Grid", "gShowC", "boolean"],
  showbpm: ["Grid", "gBPM", "boolean"],
  showstop: ["Grid", "gSTOP", "boolean"],
  showbga: ["Grid", "gBLP", "boolean"],
  bgmcount: ["Grid", "gCol", "number", 1, 999],
  grid: ["Grid", "gDivide", "number", 1, 65536],
  showfilename: ["Edit", "ShowFileName", "boolean"],
  previewclick: ["Edit", "PreviewOnClick", "boolean"],
  wavmulti: ["WAV", "WAVMultiSelect", "boolean"],
  wavsync: ["WAV", "WAVChangeLabel", "boolean"],
  "show-menu": ["ShowHide", "showMenu", "boolean"],
  "show-toolbar": ["ShowHide", "showTB", "boolean"],
  "show-options": ["ShowHide", "showOpPanel", "boolean"],
  "show-status": ["ShowHide", "showStatus", "boolean"],
  "split-left": ["ShowHide", "showLSplit", "boolean"],
  "split-right": ["ShowHide", "showRSplit", "boolean"],
};

function readAutosaveInterval(value) {
  const interval = Number(value);
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "") ||
    !Number.isInteger(interval) ||
    interval < 0
  )
    throw Error("自动保存间隔无效");
  if (interval === 0) return { autosave: false };
  const settings = validateGeneralSettings({
    autosaveminutes: interval / 60000,
  });
  return { autosave: true, autosaveminutes: settings.autosaveminutes };
}

function readSaveEncoding(value) {
  if (typeof value !== "string") throw Error("无效保存编码设置");
  const name = value.replace(/[\s_-]/g, "").toUpperCase();
  if (["SHIFTJIS", "SJIS", "CP932", "WINDOWS31J"].includes(name))
    return "shift_jis";
  // Older iBMSC defaulted to the system ANSI code page. Importing that preference
  // must not change the port's UTF-8 default or reintroduce legacy save choices.
  if (
    [
      "UTF8",
      "ANSI",
      "UNICODE",
      "ASCII",
      "BIGENDIAN",
      "BIGENDIANUNICODE",
      "UTF16",
      "UTF16LE",
      "UTF16BE",
      "UTF32",
      "UTF7",
    ].includes(name)
  )
    return "utf8";
  throw Error("无效保存编码设置");
}

export function readPreferenceAttributes(elements) {
  const result = {};
  for (const [id, [tag, key, type, min, max]] of Object.entries(
    preferenceFields,
  )) {
    const value = elements[tag]?.[key];
    if (value === undefined) continue;
    if (type === "boolean") {
      if (!/^(true|false|0|1)$/i.test(value))
        throw Error(
          Object.hasOwn(generalDefaults, id)
            ? "常规设置无效"
            : "无效布尔设置 " + key,
        );
      result[id] = /^(true|1)$/i.test(value);
    } else {
      if (Object.hasOwn(generalDefaults, id)) {
        result[id] = validateGeneralSettings({ [id]: value })[id];
        continue;
      }
      const number = Number(value);
      if (
        (typeof value !== "number" && typeof value !== "string") ||
        (typeof value === "string" && value.trim() === "") ||
        !Number.isFinite(number) ||
        (type !== "decimal" && !Number.isInteger(number)) ||
        number < min ||
        number > max
      )
        throw Error("设置超出范围 " + key);
      result[id] = number;
    }
  }
  if (elements.Edit?.NTInput !== undefined) {
    if (!/^(true|false|0|1)$/i.test(elements.Edit.NTInput))
      throw Error("无效 NT 输入设置");
    result.lnstyle = /^(true|1)$/i.test(elements.Edit.NTInput) ? "nt" : "bmse";
  }
  if (elements.WAV?.BeatChangeMode !== undefined) {
    const mode = ["absolute", "measure", "cut", "scale"][
      Number(elements.WAV.BeatChangeMode)
    ];
    if (!mode) throw Error("无效变拍模式");
    result.beatmode = mode;
  }
  if (elements.Edit?.AutoSaveInterval !== undefined)
    Object.assign(result, readAutosaveInterval(elements.Edit.AutoSaveInterval));
  if (elements.Edit?.AutoSaveMinutes !== undefined)
    result.autosaveminutes = validateGeneralSettings({
      autosaveminutes: elements.Edit.AutoSaveMinutes,
    }).autosaveminutes;
  if (elements.Save?.BMSGridLimit !== undefined) {
    const value = elements.Save.BMSGridLimit;
    const limit = Number(value),
      partition = 192 / limit;
    if (
      (typeof value !== "number" && typeof value !== "string") ||
      (typeof value === "string" && value.trim() === "") ||
      !Number.isFinite(limit) ||
      limit <= 0 ||
      !Number.isFinite(partition) ||
      Math.abs(partition - Math.round(partition)) > 1e-7
    )
      throw Error("BMS 最大格线设置无效");
    result.maxgrid = Math.round(partition);
  }
  if (elements.Save?.TextEncoding !== undefined)
    result.defaultencoding = readSaveEncoding(elements.Save.TextEncoding);
  validateGeneralSettings(result);
  return result;
}
export function writePreferenceAttributes(values, base = {}) {
  const general = validateGeneralSettings(values);
  const elements = structuredClone(base);
  for (const [id, [tag, key, type]] of Object.entries(preferenceFields)) {
    if (values[id] === undefined) continue;
    const value = Object.hasOwn(generalDefaults, id) ? general[id] : values[id];
    elements[tag] ??= {};
    elements[tag][key] =
      type === "boolean" ? (value ? "True" : "False") : String(value);
  }
  if (values.lnstyle !== undefined) {
    if (!["nt", "bmse"].includes(values.lnstyle))
      throw Error("无效长音符输入模式");
    elements.Edit ??= {};
    elements.Edit.NTInput = values.lnstyle === "nt" ? "True" : "False";
  }
  if (values.beatmode !== undefined) {
    const index = ["absolute", "measure", "cut", "scale"].indexOf(
      values.beatmode,
    );
    if (index < 0) throw Error("无效变拍模式");
    elements.WAV ??= {};
    elements.WAV.BeatChangeMode = String(index);
  }
  if (values.autosave !== undefined || values.autosaveminutes !== undefined) {
    const prior =
      elements.Edit?.AutoSaveInterval === undefined
        ? {}
        : readAutosaveInterval(elements.Edit.AutoSaveInterval);
    if (elements.Edit?.AutoSaveMinutes !== undefined)
      prior.autosaveminutes = validateGeneralSettings({
        autosaveminutes: elements.Edit.AutoSaveMinutes,
      }).autosaveminutes;
    const merged = validateGeneralSettings({
      ...prior,
      ...(values.autosave === undefined ? {} : { autosave: general.autosave }),
      ...(values.autosaveminutes === undefined
        ? {}
        : { autosaveminutes: general.autosaveminutes }),
    });
    elements.Edit ??= {};
    elements.Edit.AutoSaveInterval = String(
      merged.autosave ? Math.round(merged.autosaveminutes * 60000) : 0,
    );
    if (values.autosaveminutes !== undefined)
      elements.Edit.AutoSaveMinutes = String(merged.autosaveminutes);
  }
  if (values.maxgrid !== undefined || values.defaultencoding !== undefined) {
    elements.Save ??= {};
    if (values.maxgrid !== undefined)
      elements.Save.BMSGridLimit = String(192 / general.maxgrid);
    if (values.defaultencoding !== undefined)
      elements.Save.TextEncoding =
        general.defaultencoding === "shift_jis" ? "ShiftJIS" : "UTF8";
  }
  readPreferenceAttributes(elements);
  return elements;
}
export const xmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

// Clone the original document so nested theme settings and unknown fields survive.
export function updateSettingsDocument(original, values) {
  const doc = original.cloneNode(true);
  if (doc.documentElement.tagName !== "iBMSC")
    throw Error("不是 iBMSC 配置文件");
  const changes = writePreferenceAttributes(values);
  for (const [tag, attributes] of Object.entries(changes)) {
    let element = [...doc.documentElement.children].find(
      (node) => node.tagName === tag,
    );
    if (!element) {
      element = doc.createElement(tag);
      doc.documentElement.appendChild(element);
    }
    for (const [name, value] of Object.entries(attributes))
      element.setAttribute(name, value);
  }
  return doc;
}

// One-time correction of the early port's expanded BGA default.
export function migrateLayoutPreferences(stored) {
  const result = structuredClone(stored);
  if (result.layoutVersion !== 1) {
    result.Grid = { ...result.Grid, gBLP: "False" };
    result.layoutVersion = 1;
  }
  return result;
}
