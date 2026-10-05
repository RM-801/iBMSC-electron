export const generalDefaults = Object.freeze({
  defaultencoding: "utf8",
  maxgrid: 192,
  autosave: true,
  autosaveminutes: 2,
  beepsaved: true,
  bpmextended: false,
  stopextended: false,
  wheelunits: 96,
  pageunits: 384,
  middlemove: 0,
  autofocus: false,
  firstclick: true,
  clickstop: true,
});

export const generalPreferenceIds = Object.freeze(Object.keys(generalDefaults));

const numericFields = {
  maxgrid: [8, 10000, 1],
  autosaveminutes: [0.1, 60, 0.1],
  wheelunits: [1, 100000, 1],
  pageunits: [1, 100000, 1],
  middlemove: [0, 1, 1],
};
const numericErrors = {
  maxgrid: "BMS 最大格线必须为 8–10000 的整数",
  autosaveminutes: "自动保存间隔必须为 0.1–60 分钟",
  wheelunits: "滚轮步长必须为 1–100000 的整数",
  pageunits: "翻页步长必须为 1–100000 的整数",
  middlemove: "请选择有效的中键滚动方式",
};

// Return a new complete value object; callers decide when to commit the draft.
export function validateGeneralSettings(values = {}) {
  if (!values || typeof values !== "object" || Array.isArray(values))
    throw Error("常规设置无效");
  const result = { ...generalDefaults };
  for (const id of generalPreferenceIds) {
    const value = values[id];
    if (value === undefined) continue;
    if (id === "defaultencoding") {
      if (!["utf8", "shift_jis"].includes(value))
        throw Error("保存编码只能是 UTF-8 或 Shift-JIS");
      result[id] = value;
    } else if (numericFields[id]) {
      const [min, max, step] = numericFields[id];
      const number = Number(value);
      if (
        (typeof value !== "number" && typeof value !== "string") ||
        (typeof value === "string" && value.trim() === "") ||
        !Number.isFinite(number) ||
        number < min ||
        number > max ||
        Math.abs(number / step - Math.round(number / step)) > 1e-7
      )
        throw Error(numericErrors[id]);
      result[id] = number;
    } else {
      if (typeof value !== "boolean") throw Error("常规设置无效");
      result[id] = value;
    }
  }
  return result;
}
