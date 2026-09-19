import {
  normalizeId,
  validId,
  decodeId,
  encodeId,
  resourceIds,
} from "./identifiers.js";
export function renameWAV(chart, from, to, synchronize = true) {
  from = normalizeId(chart, from);
  to = normalizeId(chart, to);
  for (const id of [from, to])
    if (!validId(chart, id)) throw Error("WAV 编号超出当前 BASE 范围");
  if (from === to) return;
  const a = chart.resources.WAV[from];
  if (a === undefined) throw Error("源编号没有音源");
  swapWAV(chart, from, to, synchronize);
}
function swapWAV(chart, from, to, synchronize) {
  const a = chart.resources.WAV[from],
    b = chart.resources.WAV[to];
  if (a === undefined) delete chart.resources.WAV[to];
  else chart.resources.WAV[to] = a;
  if (b === undefined) delete chart.resources.WAV[from];
  else chart.resources.WAV[from] = b;
  if (synchronize && chart.headers.LNOBJ) {
    if (chart.headers.LNOBJ === from) chart.headers.LNOBJ = to;
    else if (chart.headers.LNOBJ === to) chart.headers.LNOBJ = from;
  }
  if (synchronize)
    for (const row of chart.rows) {
      if (row.channel !== "01" && !/^[1-8][1-9]$/.test(row.channel)) continue;
      row.cells = row.cells.map((v) => (v === from ? to : v === to ? from : v));
    }
  // Move LNOBJ together with its references when label synchronization is requested.
}
export function wavUsage(chart, id) {
  let count = 0;
  for (const r of chart.rows)
    if (r.channel === "01" || /^[1-8][1-9]$/.test(r.channel))
      for (const value of r.cells) if (value === id) count++;
  return count;
}

export const wavIds = Array.from({ length: 1295 }, (_, i) =>
  (i + 1).toString(36).toUpperCase().padStart(2, "0"),
);
// BWAVUp/BWAVDown traverse in movement order; blocks touching a boundary stay put.
export function shiftWAV(chart, ids, direction, synchronize = true) {
  if (![-1, 1].includes(direction)) throw Error("无效移动方向");
  const selected = new Set([...ids].map((id) => normalizeId(chart, id)));
  for (const id of selected)
    if (!validId(chart, id)) throw Error("无效 WAV 编号");
  const ordered = [...selected].sort((a, b) =>
    direction === -1
      ? decodeId(chart, a) - decodeId(chart, b)
      : decodeId(chart, b) - decodeId(chart, a),
  );
  for (const from of ordered) {
    const next = decodeId(chart, from) + direction;
    if (next < 1 || next >= resourceIds(chart).length + 1) continue;
    const to = encodeId(chart, next);
    if (selected.has(to)) continue;
    swapWAV(chart, from, to, synchronize);
    selected.delete(from);
    selected.add(to);
  }
  return [...selected].sort((a, b) => decodeId(chart, a) - decodeId(chart, b));
}
export function assignWAV(chart, selectedIds, filenames) {
  if (
    !Array.isArray(filenames) ||
    filenames.some(
      (name) => typeof name !== "string" || !name || name.includes("\0"),
    )
  )
    throw Error("无效音源文件名");
  const ids = [
    ...new Set([...selectedIds].map((id) => normalizeId(chart, id))),
  ].sort((a, b) => decodeId(chart, a) - decodeId(chart, b));
  if (!ids.length || ids.some((id) => !validId(chart, id)))
    throw Error("请先选择 WAV 编号");
  let next = decodeId(chart, ids.at(-1)) + 1;
  while (ids.length < filenames.length && next <= resourceIds(chart).length)
    ids.push(encodeId(chart, next++));
  if (filenames.length > ids.length)
    throw Error("剩余 WAV 编号不足，未更改定义");
  filenames.forEach((name, i) => (chart.resources.WAV[ids[i]] = name));
  return ids.slice(0, filenames.length);
}
