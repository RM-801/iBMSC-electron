import { normalizeId, validId } from "./identifiers.js";
import { events, longPairs, measureStarts } from "./bms.js";
import { eventId, captureNotes, putCaptured } from "./commands.js";

export function noteGroup(chart, note, nt = true) {
  return (
    ((nt || note.bgmLong) &&
      longPairs(chart).pairs.find((pair) =>
        pair.some((n) => eventId(n) === eventId(note)),
      )) || [note]
  );
}
export function removeNoteGroup(chart, note, nt = true) {
  for (const n of noteGroup(chart, note, nt))
    chart.rows[n.row].cells[n.index] = "00";
}
export function relabelNote(chart, note, value, nt = true) {
  const group = noteGroup(chart, note, nt);
  const notes = captureNotes(chart, new Set(group.map(eventId)));
  if (notes[0].column > 2) {
    value = normalizeId(chart, value).padStart(2, "0");
    if (!validId(chart, value)) throw Error("编号超出当前 BASE 范围");
    if (
      group.length === 2 &&
      group[1].value === chart.headers.LNOBJ &&
      /^[12]/.test(group[1].channel)
    ) {
      if (value === chart.headers.LNOBJ)
        throw Error("起点不能使用 LNOBJ 结束编号");
      // The release marker is structural, not a sound label.
      putCaptured(
        chart,
        [notes.find((n) => eventId(n) === eventId(group[0]))],
        { value },
      );
      return;
    }
  }
  putCaptured(chart, notes, { value });
}

// NT Shift-drag changes the same end of each selected note. Clamp the group
// together, so no note inverts or leaves the chart (Form1.vb 2840–2940).
export function planNoteResize(chart, ids, upper, delta) {
  if (!Number.isFinite(delta)) throw Error("无效的长音符长度");
  const pairs = longPairs(chart).pairs;
  const used = new Set();
  const groups = [];
  for (const note of events(chart)) {
    if (!ids.has(eventId(note)) || used.has(eventId(note))) continue;
    const group = pairs.find((p) =>
      p.some((n) => eventId(n) === eventId(note)),
    ) || [note];
    group.forEach((n) => used.add(eventId(n)));
    groups.push(captureNotes(chart, new Set(group.map(eventId))));
  }
  if (!groups.length) return { plans: [], expectedPairs: [], groups: [] };
  const maximum = measureStarts(chart).at(-1) - 1 / 48;
  let low = -Infinity,
    high = Infinity;
  for (const g of groups) {
    const a = g[0].beat,
      b = g.at(-1).beat;
    low = Math.max(low, upper ? a - b : -a);
    high = Math.min(high, upper ? maximum - b : b - a);
  }
  delta = Math.max(low, Math.min(high, delta));
  const plans = [],
    expectedPairs = [];
  for (const g of groups) {
    const a = { ...g[0], beat: g[0].beat + (upper ? 0 : delta) };
    const b = { ...g.at(-1), beat: g.at(-1).beat + (upper ? delta : 0) };

    if (Math.abs(b.beat - a.beat) < 1e-9) {
      plans.push({
        ...a,
        bgmLong: false,
        pairedLong: false,
        channel:
          String(
            Number(a.channel[0]) >= 5 ? Number(a.channel[0]) - 4 : a.channel[0],
          ) + a.channel[1],
      });
    } else {
      if (g.length === 1) {
        if (!/^[1-4][1-9]$/.test(a.channel)) throw Error("该轨道不支持长音符");
        a.channel = b.channel = String(Number(a.channel[0]) + 4) + a.channel[1];
      }
      plans.push(a, b);
      expectedPairs.push([a, b]);
    }
  }
  return { plans, expectedPairs, groups };
}
export function resizeNotes(chart, ids, upper, delta) {
  const { plans, expectedPairs, groups } = planNoteResize(
    chart,
    ids,
    upper,
    delta,
  );
  for (const group of groups)
    for (const note of group) chart.rows[note.row].cells[note.index] = "00";
  putCaptured(chart, plans, { copy: true });
  const actualPairs = longPairs(chart).pairs;
  for (const [a, b] of expectedPairs)
    if (
      !actualPairs.some(
        ([x, y]) =>
          x.channel === a.channel &&
          Math.abs(x.beat - a.beat) < 1e-9 &&
          Math.abs(y.beat - b.beat) < 1e-9,
      )
    )
      throw Error("调节后长音符会与同轨道其他音符交叉，操作已取消");
  return plans;
}
