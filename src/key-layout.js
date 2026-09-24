// Upstream Pomu.xml: five left keys and four right keys form ONE 9-key field.
// Physical BMS channel IDs are storage addresses, not player assignments here.
export const pomuColumns = [5, 6, 7, 8, 9, 14, 15, 16, 17];
export const pomuChannels = [
  "11",
  "12",
  "13",
  "14",
  "15",
  "22",
  "23",
  "24",
  "25",
];
export function isPomuTheme(theme) {
  if (!theme?.columns) return false;
  const visible = theme.columns
    .filter(
      (c) => +c.Index >= 4 && +c.Index <= 20 && +c.Index !== 12 && +c.Width > 0,
    )
    .map((c) => +c.Index)
    .sort((a, b) => a - b);
  // Match the layout, so XML imports and restored themes work without a name.
  return (
    visible.length === 9 && visible.every((id, i) => id === pomuColumns[i])
  );
}
export function shiftVisibleNotes(notes, from, to, columns) {
  const ids = columns.filter((c) => c.channel && c.width > 0).map((c) => c.id);
  const start = ids.indexOf(from),
    end = ids.indexOf(to);
  if (start < 0 || end < 0) throw Error("不能移往分隔列");
  return notes.map((note) => {
    const index = ids.indexOf(note.column);
    const target = ids[index + end - start];
    if (
      index < 0 ||
      target === undefined ||
      ((note.column <= 2 || target <= 2) && note.column !== target)
    )
      throw Error("移动超出可用轨道范围");
    return { ...note, column: target };
  });
}
export function pomuStatisticsRows(stats, theme) {
  const all = new Map([
    ...stats.aLanes.map((lane, i) => [4 + i, lane.counts]),
    ...stats.dLanes.map((lane, i) => [13 + i, lane.counts]),
  ]);
  const keys = pomuColumns.map((id, i) => ({
    name: `${i + 1} ${theme.columns.find((c) => +c.Index === id)?.Title || ""}`.trim(),
    counts: all.get(id),
  }));
  const sum = (rows) =>
    rows.reduce(
      (out, counts) => out.map((n, i) => n + counts[i]),
      Array(6).fill(0),
    );
  const other = sum(
    [...all]
      .filter(([id]) => !pomuColumns.includes(id))
      .map(([, counts]) => counts),
  );
  return [
    { name: "BPM", counts: stats.data[0] },
    { name: "STOP", counts: stats.data[1] },
    ...keys,
    {
      name: "9 键小计",
      counts: sum(keys.map((k) => k.counts)),
      subtotal: true,
    },
    ...(other.some(Boolean) ? [{ name: "其他键位", counts: other }] : []),
    { name: "BGM", counts: stats.data[4] },
    { name: "总计", counts: stats.data[5], subtotal: true },
  ];
}
