export function copyMeasures(chart, from, to, visibleChannels) {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to > 999 ||
    from > to
  )
    throw Error("小节范围必须在 000–999 内，且起点不大于终点");
  return chart.rows
    .filter(
      (r) =>
        r.measure >= from &&
        r.measure <= to &&
        visibleChannels.includes(baseChannel(r.channel)),
    )
    .map((r) => ({ ...structuredClone(r), measure: r.measure - from }));
}
function baseChannel(ch) {
  return /^[5-8]/.test(ch) ? String(Number(ch[0]) - 4) + ch[1] : ch;
}
export function pasteMeasures(chart, rows, at) {
  if (!Number.isInteger(at) || at < 0 || rows.some((r) => r.measure + at > 999))
    throw Error("粘贴位置超出 000–999 小节");
  const added = rows.map((r) => ({
    ...structuredClone(r),
    measure: r.measure + at,
    cells: [...r.cells],
  }));
  for (const r of added) {
    if (r.channel === "01") continue;
    for (const old of chart.rows.filter(
      (o) => o.measure === r.measure && o.channel === r.channel,
    )) {
      for (let i = 0; i < r.cells.length; i++) {
        if (r.cells[i] === "00") continue;
        const j = (i * old.cells.length) / r.cells.length;
        if (Number.isInteger(j) && old.cells[j] !== "00")
          throw Error("粘贴会覆盖已有事件，请先清除目标区域");
      }
    }
  }
  chart.rows.push(...added);
}
export function mirrorMeasures(chart, from, to, visibleChannels, keyChannels = null) {
  copyMeasures(chart, from, to, visibleChannels);
  const keys = ["1", "2", "3", "4", "5", "8", "9"];
  for (const r of chart.rows) {
    if (
      r.measure < from ||
      r.measure > to ||
      !visibleChannels.includes(baseChannel(r.channel)) ||
      !/^[1-8]/.test(r.channel)
    )
      continue;
    if (keyChannels) {
      const group = Math.floor((Number(r.channel[0]) - 1) / 2) * 2;
      const base = String(Number(r.channel[0]) - group) + r.channel[1];
      const index = keyChannels.indexOf(base);
      if (index >= 0) {
        const target = keyChannels.at(-1 - index);
        r.channel = String(Number(target[0]) + group) + target[1];
      }
      continue;
    }
    const i = keys.indexOf(r.channel[1]);
    if (i >= 0) r.channel = r.channel[0] + keys[6 - i];
  }
}
export function deleteMeasures(chart, from, to, visibleChannels) {
  copyMeasures(chart, from, to, visibleChannels);
  chart.rows = chart.rows.filter(
    (r) =>
      r.measure < from ||
      r.measure > to ||
      !visibleChannels.includes(baseChannel(r.channel)),
  );
}
export function insertMeasure(chart, at) {
  if (!Number.isInteger(at) || at < 0 || at > 999)
    throw Error("小节必须在 000–999");
  if (
    chart.rows.some(
      (r) => r.measure === 999 && r.cells.some((v) => v !== "00"),
    ) ||
    chart.ratios[999] !== undefined
  )
    throw Error("第 999 小节有内容，插入将使其溢出");
  for (const r of chart.rows) if (r.measure >= at) r.measure++;
  chart.rows = chart.rows.filter((r) => r.measure <= 999);
  const ratios = {};
  for (const [m, v] of Object.entries(chart.ratios))
    ratios[Number(m) >= at ? Number(m) + 1 : m] = v;
  chart.ratios = ratios;
}
export function removeMeasure(chart, at) {
  if (!Number.isInteger(at) || at < 0 || at > 999)
    throw Error("小节必须在 000–999");
  chart.rows = chart.rows.filter((r) => r.measure !== at);
  for (const r of chart.rows) if (r.measure > at) r.measure--;
  const ratios = {};
  for (const [m, v] of Object.entries(chart.ratios)) {
    if (Number(m) === at) continue;
    ratios[Number(m) > at ? Number(m) - 1 : m] = v;
  }
  chart.ratios = ratios;
}
