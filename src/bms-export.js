import { events } from "./bms.js";
import { chartBase } from "./identifiers.js";
import { expansionLines, isEditorChannel } from "./expansion.js";

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function compactRow(chart, row, maxGrid) {
  const length = row.cells.length;
  let divisor = length;
  let hasOffset = false;
  row.cells.forEach((value, index) => {
    if (value === "00") return;
    divisor = gcd(divisor, index);
    hasOffset ||= index > 0;
  });
  if (!length) return;
  const division = length / divisor;
  const ratio = chart.ratios[row.measure] ?? 1;
  // Upstream stores a minimum step of 192 / maxGrid, in absolute chart units.
  // A row containing only its measure-start event requires no subdivision at all.
  const required = division / ratio;
  if (hasOffset && required > maxGrid + 1e-9 * Math.max(1, required)) {
    const minimum = Math.ceil(required - 1e-9 * Math.max(1, required));
    throw Error(
      `第 ${String(row.measure).padStart(3, "0")} 小节的 ${row.channel} 通道需要至少 ${minimum} 格线，请增大 BMS 最大格线`,
    );
  }
  if (divisor === 1) return;
  const cells = Array(division).fill("00");
  row.cells.forEach((value, index) => {
    if (value !== "00") cells[index / divisor] = value;
  });
  // Preserve the serializer's BGM-long warning even when this helper is called
  // before the application asks whether to flatten a temporary BGM hold.
  if (row.longCells) {
    const flags = {};
    for (const [index, value] of Object.entries(row.longCells))
      if (row.cells[index] && row.cells[index] !== "00")
        flags[Number(index) / divisor] = value;
    row.longCells = flags;
  }
  row.cells = cells;
}

function definitionValue(chart, kind, id) {
  const source = chart.resources[kind]?.[id];
  const value = Number(source);
  if (
    source === undefined || String(source).trim() === "" ||
    !Number.isFinite(value) || (kind === "BPM" ? value <= 0 : value < 0)
  )
    throw Error(`${kind} 定义缺失或无效：${id}`);
  return value;
}

function sameDefinitions(before, after) {
  const keys = Object.keys(before);
  return keys.length === Object.keys(after).length &&
    keys.every((id) => Object.hasOwn(after, id) && Number(before[id]) === Number(after[id]));
}

function reindexDefinitions(chart, sourceEvents, kind, extended, base) {
  const channel = kind === "BPM" ? "08" : "09";
  // These are definition labels, not a change to the chart's global #BASE.
  // Classic base-36 labels remain valid in BASE 62; BASE 16 cannot use G–Z.
  const radix = extended && base !== 16 ? 36 : 16;
  const limit = radix * radix - 1;
  const byValue = new Map(), byId = new Map(), definitions = {};
  for (const note of sourceEvents) {
    if (note.channel !== channel) continue;
    const value = definitionValue(chart, kind, note.value);
    let id = byValue.get(value);
    if (id === undefined) {
      const ordinal = byValue.size + 1;
      if (ordinal > limit)
        throw Error(`${kind} 定义数量超过当前导出上限 ${limit}，请减少不同数值或调整扩展编号设置`);
      id = ordinal.toString(radix).toUpperCase().padStart(2, "0");
      byValue.set(value, id);
      definitions[id] = String(value);
    }
    byId.set(note.value, id);
  }
  const rawReference = new RegExp(`^\\s*#(?:BASE\\b|${kind}[0-9a-z]{2}(?:\\s|$)|\\d{3}${channel}\\s*:)`, "i");
  const changesDefinitions = !sameDefinitions(chart.resources[kind] || {}, definitions);
  const changesReferences = [...byId].some(([before, after]) => before !== after);
  // Conditional/unknown expansion code stays opaque. Removing an apparently
  // unused definition can break it just as surely as changing a visible row ID.
  if ((changesDefinitions || changesReferences) && expansionLines(chart).some((line) => rawReference.test(line)))
    throw Error(`条件分支可能引用重新编号的 ${kind} 定义，无法安全导出`);
  chart.resources[kind] = definitions;
  for (const row of chart.rows)
    if (row.channel === channel)
      row.cells = row.cells.map((id) => id === "00" ? id : byId.get(id));
}

/** Build a lossless BMS-only save snapshot; project/recovery data stays exact. */
export function prepareBMSExport(
  source,
  { maxGrid = 192, bpmExtended = false, stopExtended = false } = {},
) {
  if (!Number.isInteger(maxGrid) || maxGrid < 8 || maxGrid > 10000)
    throw Error("BMS 最大格线必须为 8–10000 的整数");
  if (typeof bpmExtended !== "boolean" || typeof stopExtended !== "boolean")
    throw Error("BMS 扩展编号设置必须为布尔值");
  const base = chartBase(source);
  const chart = structuredClone(source);
  const sourceEvents = events(chart);
  reindexDefinitions(chart, sourceEvents, "BPM", bpmExtended, base);
  reindexDefinitions(chart, sourceEvents, "STOP", stopExtended, base);
  // Keep separate rows (especially BGM ordinals) separate: combining them could
  // overwrite an overlapping event or change which background lane it belongs to.
  for (const row of chart.rows)
    if (isEditorChannel(row.channel)) compactRow(chart, row, maxGrid);
  return chart;
}
