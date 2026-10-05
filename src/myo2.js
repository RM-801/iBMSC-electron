import { events, longPairs, measureStarts } from "./bms.js";
import { captureNotes, putCaptured, eventId } from "./commands.js";
import { eventColumn, originalColumns } from "./columns.js";

// Form1.vb MyO2ConstBPM / MyO2GridCheck / MyO2GridAdjust.
const evenRound = (n) => {
  const lo = Math.floor(n);
  return Math.abs(n - lo - 0.5) < 1e-9 ? lo + (lo % 2) : Math.round(n);
};
function gcd(a, b) {
  let hi = Math.max(a, b),
    lo = Math.min(a, b);
  while (lo >= 1 - 1e-9) {
    const rem = hi - Math.floor(hi / lo + 1e-10) * lo;
    hi = lo;
    lo = rem;
  }
  return hi;
}
function notes(c) {
  return captureNotes(c, new Set(events(c).map(eventId)));
}
function rebuild(c, planned) {
  const next = structuredClone(c);
  next.rows = [];
  putCaptured(next, planned, { copy: true });
  return next;
}
export function constantBPM(c, bpm) {
  if (!Number.isFinite(bpm) || bpm < 0.0001 || bpm > 65535.9999)
    throw Error("BPM 范围为 0.0001–65535.9999");
  // A piecewise BPM clock maps both LN endpoints. STOP remains a STOP event;
  // rescale its value to preserve its real duration under the new BPM.
  let previous = 0,
    elapsed = 0,
    current = Number(c.headers.BPM);
  const points = [{ beat: 0, elapsed: 0, bpm: current }];
  for (const e of events(c).filter((e) => ["03", "08"].includes(e.channel))) {
    elapsed += (e.beat - previous) / current;
    current =
      e.channel === "03"
        ? parseInt(e.value, 16)
        : Number(c.resources.BPM[e.value]);
    if (!(current > 0) || !Number.isFinite(current))
      throw Error("BPM 定义无效");
    previous = e.beat;
    points.push({ beat: previous, elapsed, bpm: current });
  }
  const planned = notes(c)
    .filter((n) => n.column !== 1)
    .map((n) => {
      const p = points.findLast((p) => p.beat <= n.beat);
      return {
        ...n,
        beat: bpm * (p.elapsed + (n.beat - p.beat) / p.bpm),
        number: n.column === 2 ? (n.number * bpm) / p.bpm : n.number,
      };
    });
  const next = rebuild(c, planned);
  next.headers.BPM = String(bpm);
  next.resources.BPM = {};
  return next;
}
function groupedNotes(c, nt) {
  const list = events(c),
    long = new Set();
  if (nt)
    for (const pair of longPairs(c).pairs)
      for (const e of pair) long.add(eventId(e));
  return list.map((e) => ({
    ...e,
    column: eventColumn(c, e),
    long: nt ? long.has(eventId(e)) : !!(e.bgmLong || /^[5-8]/.test(e.channel)),
    hidden: /^[3478]/.test(e.channel),
  }));
}
export function checkMyO2Grid(c, { nt = true, titles = {} } = {}) {
  const starts = measureStarts(c),
    groups = new Map();
  for (const e of groupedNotes(c, nt)) {
    // Upstream assumes 192-unit measures. Use the actual measure origin here.
    const column = e.column >= 26 ? 26 : e.column;
    const key = [e.measure, column, e.long, e.hidden].join(":");
    if (!groups.has(key))
      groups.set(key, {
        measure: e.measure,
        column,
        long: e.long,
        hidden: e.hidden,
        positions: [],
      });
    groups.get(key).positions.push((e.beat - starts[e.measure]) * 48);
  }
  const names = originalColumns({ bgm: 1 });
  return [...groups.values()]
    .sort((a, b) => a.measure - b.measure || a.column - b.column)
    .flatMap((g) => {
      let divisor = 192;
      for (const pos of g.positions)
        if (pos > 1e-9) divisor = gcd(divisor, pos);
      if (divisor >= 3 - 1e-9) return [];
      const distance = (step) =>
        g.positions.reduce(
          (sum, pos) =>
            evenRound(sum + Math.abs(pos - evenRound(pos / step) * step)),
          0,
        );
      const d64 = distance(3),
        d48 = distance(4);
      return [
        {
          measure: g.measure,
          column: g.column,
          long: g.long,
          hidden: g.hidden,
          title:
            g.column === 26
              ? "BGM"
              : titles[g.column] ||
                names.find((n) => n.id === g.column)?.title ||
                "?",
          grid: evenRound(192 / divisor),
          d64,
          d48,
          to64: d48 > d64,
        },
      ];
    });
}
export function adjustMyO2Grid(c, adjustments, { nt = true } = {}) {
  const groups = groupedNotes(c, nt);
  const planned = notes(c).map((n) => {
    const g = groups.find((e) => eventId(e) === eventId(n));
    const a = adjustments.find(
      (a) =>
        a.measure === n.measure &&
        a.column === (g.column >= 26 ? 26 : g.column) &&
        a.long === g.long &&
        a.hidden === g.hidden,
    );
    if (!a) return n;
    const step = a.to64 ? 3 : 4;
    return { ...n, beat: (evenRound((n.beat * 48) / step) * step) / 48 };
  });
  for (const [start, end] of longPairs(c).pairs) {
    const a = planned.find((n) => eventId(n) === eventId(start));
    const b = planned.find((n) => eventId(n) === eventId(end));
    if (a.beat >= b.beat) throw Error("调整会使长音符长度归零，未修改谱面");
  }
  return rebuild(c, planned);
}
