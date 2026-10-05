import { parseBMS, serializeBMS, flattenBGMLongs } from "./bms.js";
import { migrateExpansion } from "./expansion.js";
import { validId } from "./identifiers.js";
import { editorMode } from "./chart-mode.js";
export function validateProjectChart(c) {
  if (
    !c ||
    typeof c !== "object" ||
    !c.headers ||
    !c.resources ||
    !c.ratios ||
    !Array.isArray(c.rows) ||
    !Array.isArray(c.raw)
  )
    throw Error("工程结构无效");
  if (c.editorMode !== undefined && editorMode(c) !== c.editorMode)
    throw Error("无效谱面类型");
  for (const [k, v] of Object.entries(c.headers))
    if (
      !/^[A-Z][A-Z0-9]*$/.test(k) ||
      typeof v !== "string" ||
      /[\r\n]/.test(v)
    )
      throw Error("工程头信息无效");
  for (const kind of ["WAV", "BMP", "BPM", "STOP"]) {
    if (!c.resources[kind] || typeof c.resources[kind] !== "object")
      throw Error("工程资源定义无效");
    for (const [id, value] of Object.entries(c.resources[kind]))
      if (
        !validId(c, id, true) ||
        typeof value !== "string" ||
        /[\r\n]/.test(value)
      )
        throw Error("工程资源编号或值无效");
  }
  if (c.raw.some((x) => typeof x !== "string")) throw Error("工程扩展文本无效");
  for (const [m, ratio] of Object.entries(c.ratios))
    if (!/^\d{1,3}$/.test(m) || !(ratio > 0) || !Number.isFinite(ratio))
      throw Error("工程小节长度无效");
  let cells = 0;
  if (c.rows.length > 200000) throw Error("工程行数过多");
  for (const row of c.rows) {
    if (
      !Number.isInteger(row.measure) ||
      row.measure < 0 ||
      row.measure > 999 ||
      !/^[0-9A-Z]{2}$/.test(row.channel) ||
      row.channel === "02" ||
      !Array.isArray(row.cells) ||
      !row.cells.length ||
      row.cells.length > 65536
    )
      throw Error("工程通道无效");
    cells += row.cells.length;
    if (
      cells > 4000000 ||
      row.cells.some(
        (id) =>
          typeof id !== "string" ||
          (row.channel === "03"
            ? !/^[0-9A-F]{2}$/.test(id)
            : !validId(c, id, true)),
      )
    )
      throw Error("工程音符数据无效或过大");
    if (row.longCells)
      for (const [index, flag] of Object.entries(row.longCells))
        if (
          row.channel !== "01" ||
          !/^\d+$/.test(index) ||
          Number(index) >= row.cells.length ||
          flag !== true
        )
          throw Error("暂存长音符标记无效");
  }
  parseBMS(serializeBMS(flattenBGMLongs(c)));
  return c;
}
export function writePortableProject(chart) {
  validateProjectChart(chart);
  return JSON.stringify({ format: "ibmsc-node-project", version: 1, chart });
}
export function readPortableProject(text) {
  if (typeof text !== "string" || text.length > 32 * 1024 * 1024)
    throw Error("工程过大");
  const data = JSON.parse(text);
  if (data.format !== "ibmsc-node-project" || data.version !== 1)
    throw Error("不支持的移植版工程版本");
  return migrateExpansion(validateProjectChart(data.chart));
}
