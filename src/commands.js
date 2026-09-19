import { events, measureStarts, longPairs } from "./bms.js";
import {
  originalColumns,
  eventColumn,
  numericValue,
  writeColumn,
} from "./columns.js";
import { rationalFraction } from "./project.js";
export const eventId = (e) => `${e.row}:${e.index}`;
export function captureNotes(chart, ids) {
  const paired = new Set(longPairs(chart).pairs.flat().map(eventId));
  return events(chart)
    .filter((e) => ids.has(eventId(e)))
    .map((e) => ({
      ...e,
      pairedLong: paired.has(eventId(e)),
      column: eventColumn(chart, e),
      number: numericValue(chart, e),
    }));
}
export function putCaptured(
  chart,
  notes,
  { deltaBeat = 0, deltaColumn = 0, copy = false, long, hidden, value } = {},
) {
  const starts = measureStarts(chart),
    cols = originalColumns({ bgm: 999 }),
    plans = [];
  for (const e of notes) {
    const col = cols.find((c) => c.id === e.column + deltaColumn);
    if (!col?.channel) throw Error("目标列是分隔列或超出轨道范围");
    if ((e.column <= 2 || col.id <= 2) && col.id !== e.column)
      throw Error("BPM / STOP 不可转换为其他类型轨道");
    const beat = e.beat + deltaBeat,
      m = starts.findIndex(
        (b, i) => beat >= b - 1e-9 && beat < starts[i + 1] - 1e-9,
      );
    if (m < 0) throw Error("移动超出 000–999 小节");
    const [slot, division] = rationalFraction(
      (beat - starts[m]) / (starts[m + 1] - starts[m]),
    );
    plans.push({
      col,
      m,
      slot,
      division,
      value: value ?? e.number,
      long: long ?? (e.bgmLong || (col.channel === "01" && e.pairedLong) || /^[5-8]/.test(e.channel)),
      hidden: hidden ?? /^[3478]/.test(e.channel),
    });
  }
  if (!copy) for (const e of notes) chart.rows[e.row].cells[e.index] = "00";
  for (const p of plans)
    writeColumn(chart, p.col, p.m, p.slot, p.division, p.value, {
      long: p.long,
      hidden: p.hidden,
    });
}
export function mirrorCaptured(chart, notes) {
  const maps = {
    5: 11,
    6: 10,
    7: 9,
    8: 8,
    9: 7,
    10: 6,
    11: 5,
    13: 19,
    14: 18,
    15: 17,
    16: 16,
    17: 15,
    18: 14,
    19: 13,
  };
  const plans = notes.map((e) => ({
    ...e,
    column: maps[e.column] ?? e.column,
  }));
  for (const e of notes) chart.rows[e.row].cells[e.index] = "00";
  putCaptured(chart, plans, { copy: true });
}
// Original arrows move by one grid step (Ctrl: one 1/48-beat unit).
export function nudgeCaptured(
  chart,
  notes,
  key,
  grid = 16,
  fine = false,
  visibleColumns = originalColumns({ bgm: 999 }),
) {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key))
    throw Error("无效移动方向");
  if (!Number.isInteger(grid) || grid < 1 || grid > 65536)
    throw Error("无效网格");
  if (!notes.length) return [];
  let delta = 0;
  const vertical = key === "ArrowUp" || key === "ArrowDown";
  if (vertical) {
    delta = (fine ? 1 / 48 : 4 / grid) * (key === "ArrowUp" ? 1 : -1);
    const maximum = measureStarts(chart).at(-1) - 1 / 48;
    delta = Math.max(
      -Math.min(...notes.map((n) => n.beat)),
      Math.min(delta, maximum - Math.max(...notes.map((n) => n.beat))),
    );
  }
  const columns = visibleColumns.filter((c) => c.channel);
  const plans = notes.map((n) => {
    let column = n.column;
    if (!vertical) {
      const index = columns.findIndex((c) => c.id === column);
      const next = columns[index + (key === "ArrowRight" ? 1 : -1)];
      if (index < 0 || !next || column <= 2 || next.id <= 2)
        throw Error("无法移往该轨道");
      column = next.id;
    }
    return { ...n, beat: n.beat + delta, column };
  });
  putCaptured(chart, plans);
  return plans;
}
