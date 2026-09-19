import { noteColor } from "./note-render.js";
export function validateVisual(visual = {}) {
  const known = new Set([
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
    "TSDeltaMouseOver",
    "TSMouseOver",
    "TSSel",
    "TSBPM",
    "MiddleDeltaRelease",
    "kHeight",
    "kLabelVShift",
    "kLabelHShift",
    "kLabelHShiftL",
    "kMouseOver",
    "kMouseOverE",
    "kSelected",
    "kOpacity",
    "ColumnTitleFont",
    "TSBPMFont",
    "kFont",
    "kMFont",
  ]);
  for (const [key, attrs] of Object.entries(visual)) {
    if (!known.has(key)) continue;
    if (attrs.Value !== undefined) {
      const n = Number(attrs.Value);
      if (!Number.isFinite(n)) throw Error("无效视觉设置：" + key);
      if (key === "kHeight" && (!Number.isInteger(n) || n < 1 || n > 100))
        throw Error("音符高度必须为 1–100");
      if (key === "kOpacity" && (n < 0 || n > 1))
        throw Error("音符透明度必须为 0–1");
    }
    if (
      attrs.Size !== undefined &&
      (!(Number(attrs.Size) > 0) || Number(attrs.Size) > 100)
    )
      throw Error("无效字体大小：" + key);
  }
  return visual;
}
export function visualNumber(theme, key, fallback) {
  const value = theme?.visual?.[key]?.Value;
  return value === undefined ? fallback : Number(value);
}
export function visualColor(theme, key, fallback) {
  const value = theme?.visual?.[key]?.Value;
  return value === undefined ? fallback : noteColor(value);
}
export function visualFont(theme, key, fallback) {
  const font = theme?.visual?.[key];
  if (!font?.Name || !font.Size) return fallback;
  // Original XML persists Font.Size in points, matching Canvas CSS pt units.
  const style = Number(font.Style) || 0;
  return `${style & 2 ? "italic " : ""}${style & 1 ? "bold " : ""}${Number(font.Size)}pt ${JSON.stringify(font.Name)}, sans-serif`;
}
