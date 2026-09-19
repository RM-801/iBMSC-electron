import { rationalFraction } from "./project.js";
import { events, measureStarts, longPairs } from "./bms.js";
import { captureNotes, putCaptured, eventId } from "./commands.js";
import { eventColumn } from "./columns.js";
export function changeMeasureRatio(
  chart,
  measure,
  ratio,
  mode = "absolute",
  { nt = true } = {},
) {
  if (
    !Number.isInteger(measure) ||
    measure < 0 ||
    measure > 999 ||
    !Number.isFinite(ratio) ||
    ratio <= 0 ||
    ratio >= 1000
  )
    throw Error("无效小节或长度比");
  if (!["absolute", "measure", "cut", "scale"].includes(mode))
    throw Error("无效变拍模式");
  const starts = measureStarts(chart),
    bottom = starts[measure],
    oldEnd = starts[measure + 1],
    newEnd = bottom + ratio * 4,
    delta = newEnd - oldEnd;
  const all = events(chart).filter((e) => eventColumn(chart, e) >= 0),
    notes = captureNotes(chart, new Set(all.map(eventId))),
    byId = new Map(notes.map((e) => [eventId(e), e]));
  const removed = new Set();
  if (mode === "cut" && delta < 0) {
    if (nt)
      for (const [a, b] of longPairs(chart).pairs) {
        const head = byId.get(eventId(a)),
          tail = byId.get(eventId(b));
        if (!head || !tail) continue;
        if (head.beat < newEnd && tail.beat >= newEnd && tail.beat < oldEnd)
          tail.beat = Math.max(head.beat, newEnd - 1 / 48);
        else if (
          head.beat >= newEnd &&
          head.beat < oldEnd &&
          tail.beat >= oldEnd
        )
          head.beat = oldEnd;
      }
    for (const e of notes)
      if (e.beat >= newEnd && e.beat < oldEnd) removed.add(eventId(e));
  }
  const adjusted = notes
    .filter((e) => !removed.has(eventId(e)))
    .map((e) => ({
      ...e,
      beat:
        mode === "absolute"
          ? e.beat
          : e.beat >= oldEnd
            ? e.beat + delta
            : mode === "scale" && e.beat >= bottom
              ? bottom +
                ((e.beat - bottom) * (newEnd - bottom)) / (oldEnd - bottom)
              : e.beat,
    }));
  // In NT a hold clipped to zero duration becomes a normal note. Two equal
  // BMSE endpoints cannot represent that state and would otherwise collide.
  if (nt) {
    const adjustedById = new Map(adjusted.map((e) => [eventId(e), e]));
    const collapsedTails = new Set();
    for (const [a, b] of longPairs(chart).pairs) {
      const head = adjustedById.get(eventId(a)),
        tail = adjustedById.get(eventId(b));
      if (head && tail && Math.abs(head.beat - tail.beat) < 1e-10) {
        if (/^[5678]/.test(head.channel))
          head.channel = String(Number(head.channel[0]) - 4) + head.channel[1];
        collapsedTails.add(eventId(tail));
      }
    }
    for (let i = adjusted.length - 1; i >= 0; i--)
      if (collapsedTails.has(eventId(adjusted[i]))) adjusted.splice(i, 1);
  }
  // Mutate only after planning. Caller records a single undo transaction.
  for (const e of all) chart.rows[e.row].cells[e.index] = "00";
  chart.ratios[measure] = ratio;
  putCaptured(chart, adjusted, { copy: true });
}

export function changeMeasureRatios(
  chart,
  measures,
  ratio,
  mode = "absolute",
  options = {},
) {
  if (
    !measures.length ||
    measures.some((m) => !Number.isInteger(m) || m < 0 || m > 999)
  )
    throw Error("请选择 000–999 范围内的小节");
  const staged = structuredClone(chart);
  for (const measure of [...new Set(measures)].sort((a, b) => a - b))
    changeMeasureRatio(staged, measure, ratio, mode, options);
  Object.assign(chart, staged);
}

// Form1 initializes LBeat with "000: 1 ( 4 / 4 )"; imported/edited
// ratios additionally show their fraction when its denominator is <= 10000.
export function measureLabel(measure, ratio = 1) {
  const prefix = `${String(measure).padStart(3, "0")}: ${ratio}`;
  if (ratio === 1) return prefix + " ( 4 / 4 )";
  try {
    const [n, d] = rationalFraction(ratio);
    return d <= 10000 ? `${prefix} ( ${n} / ${d} )` : prefix;
  } catch { return prefix; }
}
