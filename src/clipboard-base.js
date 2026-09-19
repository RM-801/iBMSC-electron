import { decodeId, encodeId, resourceIds } from "./identifiers.js";
const kindOf = (channel) =>
  channel === "08"
    ? "BPM"
    : channel === "09"
      ? "STOP"
      : ["04", "06", "07"].includes(channel)
        ? "BMP"
        : channel === "01" || /^[1-8][1-9]$/.test(channel)
          ? "WAV"
          : null;
// Called inside an editor transaction, so allocation/overflow and paste are atomic.
function mapper(target, source) {
  const used = Object.fromEntries(
    ["WAV", "BMP", "BPM", "STOP"].map((k) => [
      k,
      new Set(Object.keys(target.resources[k])),
    ]),
  );
  for (const row of target.rows) {
    const kind = kindOf(row.channel);
    if (kind) for (const id of row.cells) if (id !== "00") used[kind].add(id);
  }
  if (target.headers.LNOBJ) used.WAV.add(target.headers.LNOBJ);
  const ids = resourceIds(target),
    mappings = new Map();
  const allocate = (kind, preferred) => {
    const free =
      preferred && ids.includes(preferred) && !used[kind].has(preferred)
        ? preferred
        : ids.find((id) => !used[kind].has(id));
    if (!free) throw Error("目标 " + kind + " 编号已满，未粘贴");
    used[kind].add(free);
    return free;
  };
  return (channel, value) => {
    if (value === "00" || channel === "03") return value;
    const kind = kindOf(channel);
    if (!kind) throw Error("无法安全转换未知通道 " + channel + " 的进制");
    if (/^[12][1-9]$/.test(channel) && value === source.headers.LNOBJ) {
      target.headers.LNOBJ ||= allocate("WAV");
      return target.headers.LNOBJ;
    }
    const key = kind + ":" + value;
    if (mappings.has(key)) return mappings.get(key);
    const definition = source.resources[kind][value];
    let id =
      definition === undefined
        ? null
        : Object.keys(target.resources[kind]).find(
            (id) =>
              target.resources[kind][id] === definition &&
              !(kind === "WAV" && id === target.headers.LNOBJ),
          );
    if (!id) {
      const number = decodeId(source, value);
      const preferred = number <= ids.length ? encodeId(target, number) : null;
      id = allocate(kind, preferred);
      if (definition !== undefined) target.resources[kind][id] = definition;
    }
    mappings.set(key, id);
    return id;
  };
}
export function remapClipboardNotes(target, source, notes) {
  const map = mapper(target, source);
  return notes.map((note) => {
    if (note.column <= 2) return { ...note }; // Numeric BPM/STOP values allocate at writeColumn.
    const value = map(note.channel, note.value);
    return { ...note, value, number: value };
  });
}
export function remapClipboardRows(target, source, rows) {
  const map = mapper(target, source);
  return rows.map((row) => ({
    ...structuredClone(row),
    cells: row.cells.map((value) => map(row.channel, value)),
  }));
}
