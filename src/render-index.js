import { events, longPairs } from "./bms.js";
import { eventColumn } from "./columns.js";
export function renderIndex(chart) {
  const all = events(chart),
    counts = new Map(),
    rowBgm = new Map();
  chart.rows.forEach((r, i) => {
    if (r.channel === "01") {
      const n = counts.get(r.measure) || 0;
      rowBgm.set(i, n);
      counts.set(r.measure, n + 1);
    }
  });
  const columnById = new Map(
    all.map((e) => [
      `${e.row}:${e.index}`,
      e.channel === "01" ? 26 + rowBgm.get(e.row) : eventColumn(chart, e),
    ]),
  );
  const pairs = longPairs(chart).pairs;
  const lower = (beat) => {
    let lo = 0,
      hi = all.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (all[mid].beat < beat) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return {
    all,
    pairs,
    column: (e) => columnById.get(`${e.row}:${e.index}`) ?? -1,
    visible(from, to) {
      return all.slice(lower(from), lower(to + 1e-8));
    },
    visiblePairs(from, to) {
      return pairs.filter(([a, b]) => a.beat <= to && b.beat >= from);
    },
  };
}
