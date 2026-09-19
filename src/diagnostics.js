import { decodeId } from "./identifiers.js";
import { events, longPairs } from "./bms.js";
import { eventColumn, numericValue } from "./columns.js";
export function diagnose(chart) {
  const all = events(chart),
    issues = [],
    seen = new Set(),
    paired = new Set();
  for (const pair of longPairs(chart).pairs)
    for (const e of pair) paired.add(`${e.row}:${e.index}`);
  for (const e of all) {
    const key = `${eventColumn(chart, e)}:${e.beat}`;
    if (seen.has(key) && eventColumn(chart, e) >= 0)
      issues.push({ event: e, message: "同轨同位置重叠" });
    seen.add(key);
    const kind =
      e.channel === "08"
        ? "BPM"
        : e.channel === "09"
          ? "STOP"
          : ["04", "06", "07"].includes(e.channel)
            ? "BMP"
            : /^[1-8]/.test(e.channel) || e.channel === "01"
              ? "WAV"
              : null;
    if (
      kind &&
      !chart.resources[kind][e.value] &&
      e.value !== chart.headers.LNOBJ
    )
      issues.push({ event: e, message: `缺少 #${kind}${e.value} 定义` });
    if ((e.bgmLong || /^[5-8]/.test(e.channel)) && !paired.has(`${e.row}:${e.index}`))
      issues.push({ event: e, message: "长音符端点未配对" });
  }
  return issues;
}
// Form1.vb 6570–6608 and UpdatePairing 3585–3690.
export function statistics(chart, { nt = false } = {}) {
  const lnobj = chart.headers.LNOBJ ? decodeId(chart, chart.headers.LNOBJ) : -1;
  let notes = events(chart).map(e => ({ ...e, column: eventColumn(chart, e),
    long: e.bgmLong || /^[5-8]/.test(e.channel), hidden: /^[3478]/.test(e.channel),
    lnobj: (eventColumn(chart, e) <= 2 ? Number(numericValue(chart, e)) : decodeId(chart, e.value)) === lnobj,
    length: 0, error: false, pair: null,
  })).filter(n => n.column >= 0);
  // ConvertBMSE2NT: pair long flags in the physical column, stopping at LNOBJ.
  if (nt) {
    const removed = new Set();
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (!n.long || removed.has(n)) continue;
      for (let j = i + 1; j < notes.length; j++) {
        const next = notes[j];
        if (next.column !== n.column || removed.has(next)) continue;
        if (next.long) { n.length = next.beat - n.beat; removed.add(next); break; }
        if (next.lnobj) break;
      }
    }
    notes = notes.filter(n => !removed.has(n));
  }
  const lanes = new Map();
  for (const n of notes) {
    if (!lanes.has(n.column)) lanes.set(n.column, []);
    lanes.get(n.column).push(n);
  }
  for (const lane of lanes.values()) for (let i = 0; i < lane.length; i++) {
    const n = lane[i], prev = lane[i-1], next = lane[i+1];
    if (nt) {
      for (let j = i+1; j < lane.length && lane[j].beat <= n.beat+n.length; j++) lane[j].error = true;
      if (!n.length && n.lnobj && n.column > 2) {
        let j = i-1;
        while (j >= 0 && lane[j].hidden) j--;
        if (j < 0 || lane[j].length || lane[j].lnobj) n.error = true;
        else { n.pair = lane[j]; lane[j].pair = n; }
      }
    } else if (n.long) {
      if (prev?.beat === n.beat) n.error = true;
      else if (prev?.long && prev.pair === n) n.pair = prev;
      else if (next) {
        n.pair = next; next.pair = n;
        if (!next.long && !next.lnobj) next.error = true;
      } else n.error = true;
    } else if (n.lnobj) {
      if (!prev) n.error = true;
      else {
        if (prev.pair && prev.pair !== n) prev.error = true;
        n.pair = prev; prev.pair = n;
        if (prev.beat === n.beat) n.error = true;
        if (prev.lnobj) prev.error = true;
      }
    } else if (prev?.beat === n.beat) n.error = true;
  }
  const data = Array.from({ length: 6 }, () => Array(6).fill(0));
  const aLanes = Array.from({ length: 8 }, () => Array(6).fill(0));
  const dLanes = Array.from({ length: 8 }, () => Array(6).fill(0));
  for (const n of notes) {
    const row = n.column === 1 ? 0 : n.column === 2 ? 1 :
      n.column >= 4 && n.column <= 11 ? 2 : n.column >= 13 && n.column <= 20 ? 3 :
      n.column >= 26 ? 4 : 5;
    const long = nt ? n.length !== 0 : n.long;
    const unit = nt && long ? 2 : 1;
    const counts = [long ? 0 : unit, long ? unit : 0, n.lnobj ? unit : 0,
      n.hidden ? unit : 0, n.error ? unit : 0, unit];
    for (const r of row === 5 ? [5] : [row, 5])
      counts.forEach((value, i) => data[r][i] += value);
    if (row === 2) counts.forEach((value, i) => aLanes[n.column - 4][i] += value);
    if (row === 3) counts.forEach((value, i) => dLanes[n.column - 13][i] += value);
  }
  return { rows: ["BPM", "STOP", "A1–A8", "D1–D8", "BGM", "总计"],
    columns: ["短音符", "长音符", "LNOBJ", "隐藏", "错误", "总数"], data,
    showD: [2, 3].includes(Number(chart.headers.PLAYER)) || data[3][5] > 0,
    dLanes: dLanes.map((counts, i) => ({ name: `D${i+1}`, counts })),
    aLanes: aLanes.map((counts, i) => ({ name: `A${i+1}`, counts })) };
}
