import { chartBase, normalizeId, validId } from "./identifiers.js";
import {
  isEditorHeader,
  isEditorChannel,
  expansionLines,
} from "./expansion.js";
// Behavioral reference: iBMSC Form1.vb OpenBMS / SaveBMS (upstream commit in README).
export const channels = ["16", "11", "12", "13", "14", "15", "18", "19"];
export function parseBMS(text) {
  const chart = {
    headers: {},
    resources: { WAV: {}, BMP: {}, BPM: {}, STOP: {} },
    ratios: {},
    rows: [],
    raw: [],
    warnings: [],
  };
  // Resolve the global base before reading indices, even when #BASE follows notes.
  let baseDepth = 0;
  for (const line of text.split(/\r\n|\n|\r/)) {
    const s = line.trim();
    if (/^#(?:IF|SWITCH|SETSWITCH)\b/i.test(s)) {
      baseDepth++;
      continue;
    }
    if (baseDepth) {
      if (/^#(?:ENDIF|ENDSW)\b/i.test(s)) baseDepth--;
      continue;
    }
    const m = s.match(/^#BASE\s+(.*)$/i);
    if (m) chart.headers.BASE = m[1].trim();
  }
  chartBase(chart);
  // Like upstream Expansion Code, keep conditional blocks opaque and outside the editable note model.
  let depth = 0;
  for (const line of text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)) {
    const s = line.trim();
    if (!s.startsWith("#")) continue;
    let m;
    if (/^#(?:RANDOM|SETRANDOM|ENDRANDOM)\b/i.test(s)) {
      chart.raw.push(line);
      continue;
    }
    if (/^#(?:IF|SWITCH|SETSWITCH)\b/i.test(s)) {
      depth++;
      chart.raw.push(line);
      continue;
    }
    if (depth) {
      chart.raw.push(line);
      if (/^#(?:ENDIF|ENDSW)\b/i.test(s)) depth--;
      continue;
    }
    if ((m = s.match(/^#(\d{3})([0-9a-z]{2}):(.*)$/i))) {
      const measure = +m[1],
        channel = m[2].toUpperCase(),
        data = m[3].trim();
      if (channel === "02") {
        const n = Number(data);
        if (!Number.isFinite(n) || n <= 0) throw Error("无效的小节长度：" + s);
        chart.ratios[measure] = n;
        continue;
      }
      if (!isEditorChannel(channel)) {
        chart.raw.push(line);
        continue;
      }
      if (!/^(?:[0-9a-z]{2})+$/i.test(data))
        throw Error("无效的通道数据：" + s);
      if (channel === "03" && !/^[0-9a-f]+$/i.test(data))
        throw Error("BPM 03 通道必须为十六进制");
      chart.rows.push({
        measure,
        channel,
        cells: (channel === "03"
          ? data.toUpperCase()
          : normalizeId(chart, data)
        ).match(/../g),
      });
    } else if ((m = s.match(/^#(WAV|BPM|STOP)([0-9a-z]{2})\s+(.+)$/i))) {
      chart.resources[m[1].toUpperCase()][normalizeId(chart, m[2])] = m[3];
    } else if ((m = s.match(/^#([a-z][a-z0-9]*)\s+(.*)$/i))) {
      const key = m[1].toUpperCase();
      if (!isEditorHeader(key)) chart.raw.push(line);
      else if (key !== "BASE") chart.headers[key] = m[2];
    } else chart.raw.push(line);
  }
  if (depth) throw Error("条件分支未闭合");
  if (!chart.headers.BPM) chart.headers.BPM = "120";
  if (
    !(Number(chart.headers.BPM) > 0) ||
    !Number.isFinite(Number(chart.headers.BPM))
  )
    throw Error("初始 BPM 必须为正数");
  for (const items of Object.values(chart.resources))
    for (const id of Object.keys(items))
      if (!validId(chart, id, true)) throw Error("无效资源编号：" + id);
  for (const row of chart.rows)
    if (
      row.channel !== "03" &&
      row.cells.some((id) => !validId(chart, id, true))
    )
      throw Error("通道数据超出当前 BASE 范围");
  if (chart.headers.LNOBJ) {
    chart.headers.LNOBJ = normalizeId(chart, chart.headers.LNOBJ);
    if (!validId(chart, chart.headers.LNOBJ, true))
      throw Error("无效 LNOBJ 编号");
  }
  if (chart.headers.LNTYPE && chart.headers.LNTYPE !== "1")
    throw Error("暂不支持 LNTYPE 2");
  return chart;
}
export function bgmLongEvents(c) {
  return events(c).filter((e) => e.channel === "01" && e.bgmLong);
}
export function flattenBGMLongs(c) {
  const copy = structuredClone(c);
  for (const [, end] of longPairs(copy).pairs) {
    if (end.channel === "01" && end.bgmLong)
      copy.rows[end.row].cells[end.index] = "00";
  }
  for (const row of copy.rows) delete row.longCells;
  return copy;
}
export function serializeBMS(c) {
  if (bgmLongEvents(c).length)
    throw Error("BGM 区存有长音符，请先确认保存时仅保留起点");
  const lines = Object.entries(c.headers)
    .filter(([key]) => isEditorHeader(key))
    .map(([k, v]) => `#${k} ${v}`);
  for (const [kind, items] of Object.entries(c.resources).filter(
    ([kind]) => kind !== "BMP",
  ))
    for (const [id, v] of Object.entries(items))
      lines.push(`#${kind}${id} ${v}`);
  lines.push(...expansionLines(c));
  for (const [m, r] of Object.entries(c.ratios))
    lines.push(`#${m.padStart(3, "0")}02:${r}`);
  for (const row of c.rows.filter((row) => isEditorChannel(row.channel)))
    lines.push(
      `#${String(row.measure).padStart(3, "0")}${row.channel}:${row.cells.join("")}`,
    );
  return lines.join("\r\n") + "\r\n";
}
export function measureStarts(c, count = 1000) {
  const a = [0];
  for (let m = 0; m < count; m++) a.push(a[m] + 4 * (c.ratios[m] ?? 1));
  return a;
}
export function events(c) {
  const starts = measureStarts(c);
  const out = [];
  c.rows.forEach((r, row) =>
    r.cells.forEach((value, index) => {
      if (value !== "00")
        out.push({
          row,
          index,
          ...(r.channel === "01" && r.longCells?.[index]
            ? { bgmLong: true }
            : {}),
          value,
          channel: r.channel,
          measure: r.measure,
          fraction: index / r.cells.length,
          beat:
            starts[r.measure] +
            (index / r.cells.length) * 4 * (c.ratios[r.measure] ?? 1),
        });
    }),
  );
  return out.sort((a, b) => a.beat - b.beat || a.row - b.row);
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function putNote(c, measure, channel, slot, division, value) {
  value =
    channel === "03" ? String(value).toUpperCase() : normalizeId(c, value);
  if (
    !Number.isInteger(measure) ||
    measure < 0 ||
    measure > 999 ||
    !Number.isInteger(division) ||
    division < 1 ||
    division > 65536 ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= division ||
    !(channel === "03" ? /^[0-9A-F]{2}$/.test(value) : validId(c, value)) ||
    value === "00"
  )
    throw Error("无效的音符位置或音源编号");
  if (
    channel === "03" &&
    (!/^[0-9A-F]{2}$/.test(value) || parseInt(value, 16) === 0)
  )
    throw Error("03 通道 BPM 必须为 01–FF 十六进制");
  if (!/^[0-9A-Z]{2}$/.test(channel) || channel === "02")
    throw Error("无效音符通道");
  let row = c.rows.find((r) => r.measure === measure && r.channel === channel);
  if (!row) {
    row = { measure, channel, cells: Array(division).fill("00") };
    c.rows.push(row);
  }
  const n = (row.cells.length / gcd(row.cells.length, division)) * division;
  if (n > 65536) throw Error("该网格组合分辨率过高");
  const cells = Array(n).fill("00");
  row.cells.forEach((v, i) => (cells[(i * n) / row.cells.length] = v));
  if (cells[(slot * n) / division] !== "00")
    throw Error("目标位置已有事件，操作未覆盖原音符");
  cells[(slot * n) / division] = value;
  if (row.longCells) {
    const flags = {};
    for (const [index, flag] of Object.entries(row.longCells))
      if (row.cells[index] !== "00" && flag)
        flags[(Number(index) * n) / row.cells.length] = true;
    row.longCells = flags;
  }
  row.cells = cells;
}
export function longPairs(c) {
  const pending = new Map(),
    pairs = [],
    ends = new Set();
  const bgmRows = new Map(),
    counts = new Map();
  c.rows.forEach((r, i) => {
    if (r.channel === "01") {
      const n = counts.get(r.measure) || 0;
      bgmRows.set(i, n);
      counts.set(r.measure, n + 1);
    }
  });
  for (const e of events(c)) {
    if (e.bgmLong) {
      const key = "bgm:" + bgmRows.get(e.row);
      if (pending.has(key)) {
        pairs.push([pending.get(key), e]);
        ends.add(`${e.row}:${e.index}`);
        pending.delete(key);
      } else pending.set(key, e);
    } else if (/^[5-8][1-9]$/.test(e.channel)) {
      if (pending.has(e.channel)) {
        pairs.push([pending.get(e.channel), e]);
        ends.add(`${e.row}:${e.index}`);
        pending.delete(e.channel);
      } else pending.set(e.channel, e);
    } else if (/^[12][1-9]$/.test(e.channel)) {
      if (e.value === c.headers.LNOBJ) {
        if (pending.has(e.channel)) {
          pairs.push([pending.get(e.channel), e]);
          ends.add(`${e.row}:${e.index}`);
        }
        pending.delete(e.channel);
      } else pending.set(e.channel, e);
    }
  }
  return { pairs, ends };
}
export function timeline(c) {
  let bpm = Number(c.headers.BPM),
    beat = 0,
    time = 0;
  const output = [];
  const ends = longPairs(c).ends;
  const list = events(c);
  let i = 0;
  while (i < list.length) {
    const at = list[i].beat;
    time += ((at - beat) * 60) / bpm;
    beat = at;
    const group = [];
    while (i < list.length && list[i].beat === at) group.push(list[i++]);
    for (const e of group.filter((e) => ["03", "08"].includes(e.channel))) {
      const next =
        e.channel === "03"
          ? parseInt(e.value, 16)
          : Number(c.resources.BPM[e.value]);
      if (!Number.isFinite(next) || next <= 0)
        throw Error("BPM 定义缺失或无效：" + e.value);
      bpm = next;
    }
    for (const e of group) {
      if (
        (e.channel === "01" || /^[1256][1-9]$/.test(e.channel)) &&
        !ends.has(`${e.row}:${e.index}`)
      )
        output.push({ ...e, time });
    }
    for (const e of group.filter((e) => e.channel === "09")) {
      const stop = Number(c.resources.STOP[e.value]);
      if (!Number.isFinite(stop) || stop < 0)
        throw Error("STOP 定义缺失或无效：" + e.value);
      time += ((stop / 48) * 60) / bpm;
    }
  }
  return output;
}
export function decodeBMS(bytes, encoding = "auto") {
  if (encoding !== "auto") {
    if (!["utf8", "utf-8", "shift_jis", "gbk"].includes(encoding))
      throw Error("不支持的谱面编码");
    return new TextDecoder(encoding === "utf8" ? "utf-8" : encoding, {
      fatal: true,
    }).decode(bytes);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("shift-jis", { fatal: true }).decode(bytes);
  }
}
