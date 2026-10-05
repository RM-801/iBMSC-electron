import { createThemeDraft, partsToARGB } from "./theme-editor.js";
import { originalColumns } from "./columns.js";

// Materialize the canvas fallbacks before editing, so changing one property
// does not also switch every unspecified property to a preset's appearance.
export function editableTheme(theme) {
  const draft = createThemeDraft(theme);
  if (!theme) {
    for (const col of originalColumns({ bgm: 1 })) {
      const style = draft.columns[col.id];
      style.Width = String(col.width);
      style.Title = col.id === 26 ? "B" : col.title;
      const color = !col.channel
        ? "#101010"
        : col.scratch
          ? "#301919"
          : col.channel[0] === "0"
            ? "#0a0a0a"
            : Number(col.title.slice(1)) % 2
              ? "#0c1620"
              : "#181818";
      style.BG = partsToARGB(color, 255);
    }
    draft.columns[0].TextColor = partsToARGB("#dddddd", 255);
  }
  const colors = {
    ColumnTitle: "#dddddd",
    Bg: "#000000",
    Grid: "#222222",
    Sub: "#404040",
    MLine: "#808080",
    VLine: "#000000",
    BGMWav: "#50a0dc",
    SelBox: "#ffda50",
    TSCursor: "#ffda50",
    TSHalf: "#000000",
    TSSel: "#ffda50",
    kSelected: "#ff0000",
    kMouseOver: "#63ffff",
    kMouseOverE: "#ff0000",
    kError: "#ff0000",
  };
  for (const [key, color] of Object.entries(colors)) {
    if (draft.visual[key]?.Value !== undefined) continue;
    const alpha = ["VLine", "TSHalf"].includes(key)
      ? 0
      : key === "TSSel"
        ? 32
        : 255;
    draft.visual[key] = {
      ...draft.visual[key],
      Value: partsToARGB(color, alpha),
    };
  }
  for (const [key, value] of Object.entries({
    kHeight: 10,
    kOpacity: 0.5,
    kLabelVShift: 0,
    kLabelHShift: 0,
    kLabelHShiftL: 0,
  }))
    draft.visual[key] = { Value: String(value), ...draft.visual[key] };
  for (const key of ["ColumnTitleFont", "kFont", "kMFont"])
    draft.visual[key] = {
      Name: key === "ColumnTitleFont" ? "Tahoma" : "monospace",
      Size: "7.5",
      Style: "0",
      ...draft.visual[key],
    };
  return draft;
}
