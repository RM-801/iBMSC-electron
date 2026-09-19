import { resourceIds } from "./identifiers.js";
import { putNote } from "./bms.js";
// Form1.vb ni* constants (105–134), IdentifiertoColumnIndex (949–977).
export const keyOrder = [
  "16",
  "11",
  "12",
  "13",
  "14",
  "15",
  "18",
  "19",
  "21",
  "22",
  "23",
  "24",
  "25",
  "28",
  "29",
  "26",
];
export function keyBase(ch) {
  if (!/^[1-8][1-9]$/.test(ch)) return ch;
  return String(((Number(ch[0]) - 1) % 2) + 1) + ch[1];
}
export function bgmOrdinal(chart, rowIndex) {
  const r = chart.rows[rowIndex];
  return chart.rows
    .slice(0, rowIndex)
    .filter((x) => x.measure === r.measure && x.channel === "01").length;
}
export function maxBGM(chart) {
  const counts = {};
  for (const r of chart.rows)
    if (r.channel === "01") counts[r.measure] = (counts[r.measure] || 0) + 1;
  return Math.max(1, ...Object.values(counts));
}
export function originalColumns({
  double = true,
  bpm = true,
  stop = true,
  bga = true,
  bgm = 15,
  zoom = 1,
} = {}) {
  const out = [];
  let x = 0;
  const add = (id, title, width, channel = null, extra = {}) => {
    out.push({ id, title, width: width * zoom, left: x, channel, ...extra });
    x += width * zoom;
  };
  add(0, "Measure", 50);
  if (bpm) add(1, "BPM", 60, "08");
  if (stop) add(2, "STOP", 50, "09");
  add(3, "", 5);
  keyOrder.forEach((ch, i) => {
    if (i === 8) {
      add(12, "", 5);
      if (!double) return;
    }
    if (i >= 8 && !double) return;
    const index = i < 8 ? 4 + i : 13 + i - 8;
    const scratch = ch === "16" || ch === "26";
    add(
      index,
      i < 8 ? "A" + (i + 1) : "D" + (i - 7),
      scratch ? 42 : [2, 4, 6].includes(i % 8) ? 30 : 42,
      ch,
      { scratch },
    );
  });
  if (double) add(21, "", 5);
  if (bga) {
    add(22, "BGA", 40, "04");
    add(23, "LAYER", 40, "07");
    add(24, "POOR", 40, "06");
    add(25, "", 5);
  }
  for (let b = 0; b < bgm; b++)
    add(26 + b, "B" + (b + 1), 40, "01", { bgm: b });
  return out;
}
export function eventColumn(chart, event) {
  if (event.channel === "01") return 26 + bgmOrdinal(chart, event.row);
  if (["03", "08"].includes(event.channel)) return 1;
  if (event.channel === "09") return 2;
  if (event.channel === "04") return 22;
  if (event.channel === "07") return 23;
  if (event.channel === "06") return 24;
  const i = keyOrder.indexOf(keyBase(event.channel));
  return i < 0 ? -1 : i < 8 ? 4 + i : 13 + i - 8;
}
export function numericValue(chart, e) {
  if (e.channel === "03") return parseInt(e.value, 16);
  if (e.channel === "08") return Number(chart.resources.BPM[e.value]);
  if (e.channel === "09") return Number(chart.resources.STOP[e.value]);
  return e.value;
}
export function defineNumber(chart, kind, value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n >= 65536)
    throw Error(kind + " 必须大于 0 且小于 65536");
  let id = Object.keys(chart.resources[kind]).find(
    (k) => Number(chart.resources[kind][k]) === n,
  );
  if (!id) {
    for (const candidate of resourceIds(chart)) {
      if (!chart.resources[kind][candidate]) {
        id = candidate;
        break;
      }
    }
    if (!id) throw Error("定义编号已满");
    chart.resources[kind][id] = String(n);
  }
  return id;
}
export function writeColumn(
  chart,
  column,
  measure,
  slot,
  division,
  value,
  { long = false, hidden = false } = {},
) {
  let channel = column.channel;
  if (!channel) throw Error("不能在分隔列写入");
  if (column.id === 1) {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0 && n < 256) {
      channel = "03";
      value = n.toString(16).toUpperCase().padStart(2, "0");
    } else {
      channel = "08";
      value = defineNumber(chart, "BPM", n);
    }
  } else if (column.id === 2) value = defineNumber(chart, "STOP", value);
  else if (/^[12]/.test(channel))
    channel =
      String(Number(channel[0]) + (hidden ? 2 : 0) + (long ? 4 : 0)) +
      channel[1];
  if (channel === "01") {
    const rows = chart.rows.filter(
      (r) => r.measure === measure && r.channel === "01",
    );
    while (rows.length <= column.bgm) {
      const r = { measure, channel, cells: ["00"] };
      chart.rows.push(r);
      rows.push(r);
    }
    const target = rows[column.bgm];
    const temp = { headers: chart.headers, rows: [target] };
    putNote(temp, measure, channel, slot, division, value);
    const index = (slot * target.cells.length) / division;
    if (long) {
      target.longCells ??= {};
      target.longCells[index] = true;
    } else if (target.longCells) delete target.longCells[index];
  } else putNote(chart, measure, channel, slot, division, value);
}

// Add editable display lanes without creating chart rows or changing the saved minimum.
export function fillBGMColumns(columns, viewportWidth) {
  const out = [...columns];
  const last = out.at(-1);
  if (!last || last.channel !== "01" || last.width <= 0) return out;
  const extra = Math.min(
    999 - (last.bgm + 1),
    Math.max(
      0,
      Math.ceil((viewportWidth - last.left - last.width) / last.width),
    ),
  );
  for (let i = 1; i <= extra; i++)
    out.push({
      ...last,
      id: last.id + i,
      bgm: last.bgm + i,
      title: last.title.replace(/\d+$/, String(last.bgm + i + 1)),
      left: last.left + last.width * i,
    });
  return out;
}
