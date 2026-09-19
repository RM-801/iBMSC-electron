import { parseBMS, putNote } from "./bms.js";
import { writeColumn, originalColumns } from "./columns.js";
import { rationalFraction } from "./project.js";
function tags(text) {
  return [
    ...text.replace(/\/\/[^\r\n]*/g, "").matchAll(/#([A-Z0-9]+)\s*:([^;]*);/gi),
  ].map((m) => [m[1].toUpperCase(), m[2].trim()]);
}
export function smDifficulties(text) {
  return tags(text)
    .filter(([key]) => key === "NOTES")
    .map(([, v]) => {
      const parts = v.split(":");
      return {
        style: parts[0]?.trim(),
        name: parts[2]?.trim(),
        level: parts[3]?.trim(),
      };
    });
}
export function importSM(text, index = 0) {
  const all = tags(text),
    notes = all.filter(([k]) => k === "NOTES")[index];
  if (!notes) throw Error("没有该难度的 SM 谱面");
  const parts = notes[1].split(":");
  if (parts.length !== 6) throw Error("SM NOTES 字段无效");
  if (parts[0].trim() !== "dance-single")
    throw Error("原版 SM 导入映射仅适用于 dance-single 四列");
  const c = parseBMS("#LNTYPE 1");
  for (const [k, v] of all)
    if (["TITLE", "ARTIST", "GENRE", "SUBTITLE"].includes(k)) c.headers[k] = v;
  c.headers.PLAYLEVEL = parts[3].trim();
  const measures = parts[5].split(",");
  if (measures.length > 1000) throw Error("SM 超过 1000 小节");
  const mapped = ["16", "11", "12", "13"];
  measures.forEach((m, measure) => {
    const rows = m.trim().split(/\s+/).filter(Boolean);
    if (rows.some((r) => r.length !== 4)) throw Error("SM 行长度不是四列");
    rows.forEach((line, slot) =>
      [...line].forEach((v, lane) => {
        if (v === "0") return;
        const channel = ["2", "3"].includes(v)
          ? "5" + mapped[lane][1]
          : mapped[lane];
        putNote(c, measure, channel, slot, rows.length, "01");
      }),
    );
  });
  const bpmData = all.find(([k]) => k === "BPMS")?.[1];
  if (bpmData)
    for (const pair of bpmData.split(",")) {
      const [beat, bpm] = pair.split("=").map(Number);
      if (
        !Number.isFinite(beat) ||
        beat < 0 ||
        !Number.isFinite(bpm) ||
        bpm <= 0
      )
        throw Error("SM BPM 数据无效");
      if (beat === 0) c.headers.BPM = String(bpm);
      else {
        const m = Math.floor(beat / 4),
          [slot, division] = rationalFraction(beat / 4 - m);
        writeColumn(
          c,
          originalColumns().find((c) => c.id === 1),
          m,
          slot,
          division,
          bpm,
        );
      }
    }
  return c;
}
