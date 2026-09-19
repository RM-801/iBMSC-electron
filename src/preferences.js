export const preferenceFields = {
  zoom: ["Grid", "gxHeight", "decimal", 0.25, 99],
  wavelock: ["WaveForm", "wLock", "boolean"],
  waveposition: ["WaveForm", "wPosition", "number", 0, 192000],
  waveleft: ["WaveForm", "wLeft", "number", 0, 800],
  wavewidth: ["WaveForm", "wWidth", "number", 0, 1000],
  waveprecision: ["WaveForm", "wPrecision", "number", 0, 50],
  pageunits: ["Grid", "gPgUpDn", "number", 1, 100000],
  slashgrid: ["Grid", "gSlash", "number", 1, 65536],
  snap: ["Grid", "gSnap", "boolean"],
  showgrid: ["Grid", "gShow", "boolean"],
  showbpm: ["Grid", "gBPM", "boolean"],
  showstop: ["Grid", "gSTOP", "boolean"],
  showbga: ["Grid", "gBLP", "boolean"],
  bgmcount: ["Grid", "gCol", "number", 1, 999],
  grid: ["Grid", "gDivide", "number", 1, 65536],
  showfilename: ["Edit", "ShowFileName", "boolean"],
  previewclick: ["Edit", "PreviewOnClick", "boolean"],
  wavmulti: ["WAV", "WAVMultiSelect", "boolean"],
  wavsync: ["WAV", "WAVChangeLabel", "boolean"],
  "split-left": ["ShowHide", "showLSplit", "boolean"],
  "split-right": ["ShowHide", "showRSplit", "boolean"],
};
export function readPreferenceAttributes(elements) {
  const result = {};
  for (const [id, [tag, key, type, min, max]] of Object.entries(
    preferenceFields,
  )) {
    const value = elements[tag]?.[key];
    if (value === undefined) continue;
    if (type === "boolean") {
      if (!/^(true|false|0|1)$/i.test(value))
        throw Error("无效布尔设置 " + key);
      result[id] = /^(true|1)$/i.test(value);
    } else {
      const number = Number(value);
      if (
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
  return result;
}
export function writePreferenceAttributes(values, base = {}) {
  const elements = structuredClone(base);
  for (const [id, [tag, key, type]] of Object.entries(preferenceFields)) {
    if (values[id] === undefined) continue;
    elements[tag] ??= {};
    elements[tag][key] =
      type === "boolean" ? (values[id] ? "True" : "False") : String(values[id]);
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
  readPreferenceAttributes(elements);
  return elements;
}
export const xmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

// Clone the original document so nested player/theme settings and unknown fields survive.
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
