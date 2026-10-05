const modernModes = ["SINGLE", "DOUBLE", "PMS"];
const legacyModes = {
  2: ["legacy-couple", "Couple Play"],
  4: ["legacy-battle", "Battle Play"],
};

// Editor layout is separate from the original PLAYER header. Reading a chart
// must never normalize a legacy value or invent a PLAYER declaration.
export function editorMode(chart) {
  if (modernModes.includes(chart.editorMode)) return chart.editorMode;
  return [2, 3].includes(Number(chart.headers?.PLAYER)) ? "DOUBLE" : "SINGLE";
}

export function initializeEditorMode(chart, { pms = false } = {}) {
  chart.editorMode = pms ? "PMS" : editorMode(chart);
  return chart;
}

export function editorModeChoices(chart) {
  const choices = modernModes.map((mode) => [mode, mode]);
  const legacy = legacyModes[Number(chart.headers?.PLAYER)];
  if (editorMode(chart) !== "PMS" && legacy) choices.push([...legacy]);
  return choices;
}

export function editorModeSelection(chart) {
  const mode = editorMode(chart);
  if (mode === "PMS") return mode;
  return legacyModes[Number(chart.headers?.PLAYER)]?.[0] || mode;
}

// Only an explicit user choice updates PLAYER to its compatible modern value.
export function setEditorMode(chart, mode) {
  if (!modernModes.includes(mode)) throw Error("无效谱面类型");
  chart.editorMode = mode;
  chart.headers.PLAYER = mode === "SINGLE" ? "1" : "3";
  return chart;
}
