import { events, longPairs } from "./bms.js";
import {
  eventColumn,
  numericValue,
  originalColumns,
  maxBGM,
} from "./columns.js";
import { eventId, captureNotes, putCaptured } from "./commands.js";
import {
  chartBase,
  normalizeId,
  validId,
  decodeId,
  encodeId,
} from "./identifiers.js";

const switches = [
  "selected",
  "unselected",
  "short",
  "long",
  "hidden",
  "visible",
];
const numeric = (value) =>
  (typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "")) &&
  Number.isFinite(Number(value));
const integer = (value) => numeric(value) && Number.isInteger(Number(value));
const editableColumn = (value) =>
  Number.isInteger(value) &&
  ((value >= 1 && value <= 2) ||
    (value >= 4 && value <= 11) ||
    (value >= 13 && value <= 20) ||
    (value >= 22 && value <= 24) ||
    (value >= 26 && value <= 1024));

export function createFindCriteria(chart, bgmCount = 15) {
  if (!integer(bgmCount) || Number(bgmCount) < 1 || Number(bgmCount) > 999)
    throw Error("查找轨道范围无效");
  return {
    selected: true,
    unselected: true,
    short: true,
    long: true,
    hidden: true,
    visible: true,
    measureFrom: 0,
    measureTo: 999,
    labelFrom: "01",
    labelTo: encodeId(chart, chartBase(chart) ** 2 - 1),
    valueFrom: 0.0001,
    valueTo: 65535.9999,
    columns: originalColumns({
      bgm: Math.min(999, Math.max(Number(bgmCount), maxBGM(chart))),
    })
      .filter((column) => column.channel)
      .map((column) => column.id),
  };
}

function label(chart, value, message) {
  const normalized = normalizeId(chart, value).padStart(2, "0");
  if (!validId(chart, normalized)) throw Error(message);
  return normalized;
}

function numberValue(value) {
  if (
    !numeric(value) ||
    Number(value) < 0.0001 ||
    Number(value) > 65535.9999 ||
    Math.abs(Number(value) * 10000 - Math.round(Number(value) * 10000)) > 1e-6
  )
    throw Error("查找数值必须为 0.0001–65535.9999，最多四位小数");
  return Number(value);
}

function columnSet(values) {
  if (
    !(Array.isArray(values) || values instanceof Set) ||
    [...values].some(
      (value) => !integer(value) || !editableColumn(Number(value)),
    )
  )
    throw Error("查找轨道范围无效");
  return new Set([...values].map(Number));
}

export function validateFindCriteria(chart, criteria = {}) {
  const result = { ...createFindCriteria(chart), ...criteria };
  for (const key of switches)
    if (typeof result[key] !== "boolean") throw Error("查找类型选项无效");
  for (const key of ["measureFrom", "measureTo"]) {
    if (
      !integer(result[key]) ||
      Number(result[key]) < 0 ||
      Number(result[key]) > 999
    )
      throw Error("小节范围必须在 000–999 内，且起点不大于终点");
    result[key] = Number(result[key]);
  }
  if (result.measureFrom > result.measureTo)
    throw Error("小节范围必须在 000–999 内，且起点不大于终点");
  result.labelFrom = label(
    chart,
    result.labelFrom,
    "查找编号超出当前 BASE 范围",
  );
  result.labelTo = label(chart, result.labelTo, "查找编号超出当前 BASE 范围");
  if (decodeId(chart, result.labelFrom) > decodeId(chart, result.labelTo))
    throw Error("查找编号范围起点不能大于终点");
  result.valueFrom = numberValue(result.valueFrom);
  result.valueTo = numberValue(result.valueTo);
  if (result.valueFrom > result.valueTo)
    throw Error("查找数值范围起点不能大于终点");
  result.columns = [...columnSet(result.columns)];
  return result;
}

function search(
  chart,
  criteria,
  { selectedIds = new Set(), nt = true, enabledColumns = null } = {},
) {
  const settings = validateFindCriteria(chart, criteria);
  const enabled = enabledColumns === null ? null : columnSet(enabledColumns);
  const searched = new Set(settings.columns);
  const selected = new Set(selectedIds);
  const pairById = new Map();
  for (const pair of longPairs(chart).pairs) {
    if (nt || pair.some((note) => note.bgmLong))
      for (const note of pair) pairById.set(eventId(note), pair);
  }
  const visited = new Set();
  const eligible = [];
  const from = decodeId(chart, settings.labelFrom),
    to = decodeId(chart, settings.labelTo);
  for (const event of events(chart)) {
    if (visited.has(eventId(event))) continue;
    const group = pairById.get(eventId(event)) || [event];
    group.forEach((note) => visited.add(eventId(note)));
    const note = group[0],
      column = eventColumn(chart, note);
    if (!editableColumn(column) || (enabled && !enabled.has(column))) continue;
    const isSelected = group.some((note) => selected.has(eventId(note)));
    const isLong = nt
      ? group.length > 1
      : !!note.bgmLong || /^[5-8]/.test(note.channel);
    const hidden = /^[3478]/.test(note.channel);
    if (
      !(isSelected ? settings.selected : settings.unselected) ||
      !(isLong ? settings.long : settings.short) ||
      !(hidden ? settings.hidden : settings.visible)
    )
      continue;
    const isNumeric = column <= 2;
    const value = isNumeric
      ? numericValue(chart, note)
      : decodeId(chart, note.value);
    const matches =
      note.measure >= settings.measureFrom &&
      note.measure <= settings.measureTo &&
      searched.has(column) &&
      (isNumeric
        ? value >= settings.valueFrom && value <= settings.valueTo
        : value >= from && value <= to);
    eligible.push({
      ...note,
      column,
      group,
      numeric: isNumeric,
      long: isLong,
      hidden,
      selected: isSelected,
      matches,
    });
  }
  return { eligible, selected };
}

/** NT notes are logical holds; BMSE endpoints remain independently searchable. */
export function findMatches(chart, criteria = {}, options = {}) {
  return search(chart, criteria, options).eligible.filter(
    (note) => note.matches,
  );
}

function selectionPosition(chart, note) {
  const column = eventColumn(chart, note);
  // 03 and 08 share the BPM lane and may switch representation during a write.
  // Other channel variants (hidden/LN) remain distinct at the same position.
  return (
    `${column}:${column <= 2 && column >= 1 ? "numeric" : note.channel}:` +
    `${note.measure}:${note.fraction.toPrecision(12)}`
  );
}

/** Data edits commit atomically; callers own History.commit and UI refresh. */
export function applyFindOperation(chart, criteria, operation, options = {}) {
  operation =
    {
      "replace-label": "replaceLabel",
      "replace-value": "replaceValue",
      "delete-selected": "deleteSelected",
    }[operation] || operation;
  if (
    ![
      "select",
      "unselect",
      "delete",
      "deleteSelected",
      "replaceLabel",
      "replaceValue",
    ].includes(operation)
  )
    throw Error("无效查找操作");
  const deleteSelected = operation === "deleteSelected";
  const { eligible, selected } = search(
    chart,
    deleteSelected ? { selected: true, unselected: false } : criteria,
    deleteSelected ? { ...options, enabledColumns: null } : options,
  );
  if (deleteSelected) {
    operation = "delete";
    // Selection deletion also handles undefined BPM/STOP values, whose default
    // numeric range would otherwise exclude them from an ordinary search.
    for (const note of eligible) note.matches = true;
  }
  if (operation === "select" || operation === "unselect") {
    // Form1.fdrSelect/fdrUnselect assign the predicate (or its inverse) to all
    // type-eligible notes, including notes outside the measure/label/column range.
    // Test eligibility against the original selection, never a partially changed Set.
    for (const note of eligible) {
      const keep = operation === "select" ? note.matches : !note.matches;
      for (const member of note.group) {
        if (keep) selected.add(eventId(member));
        else selected.delete(eventId(member));
      }
    }
    return {
      count: eligible.filter((note) => note.matches).length,
      selectedIds: selected,
    };
  }
  let replacement;
  if (operation === "replaceLabel")
    replacement = label(chart, options.value, "替换编号超出当前 BASE 范围");
  else if (operation === "replaceValue")
    replacement = numberValue(options.value);
  const matches = eligible.filter(
    (note) =>
      note.matches &&
      (operation === "replaceLabel"
        ? !note.numeric
        : operation === "replaceValue"
          ? note.numeric
          : true),
  );
  if (!matches.length) return { count: 0, selectedIds: selected };
  const changed = structuredClone(chart);
  let resultingSelection = selected;
  if (operation === "replaceValue") {
    // Batch the captured events: rewriting 03 into 08 can otherwise invalidate
    // later row/cell addresses while allocating the replacement BPM definition.
    const ids = new Set(matches.flatMap((note) => note.group.map(eventId)));
    const selectedPositions = new Set(
      events(chart)
        .filter((note) => selected.has(eventId(note)))
        .map((note) => selectionPosition(chart, note)),
    );
    putCaptured(changed, captureNotes(changed, ids), { value: replacement });
    resultingSelection = new Set(
      events(changed)
        .filter((note) =>
          selectedPositions.has(selectionPosition(changed, note)),
        )
        .map(eventId),
    );
  } else {
    for (const note of matches) {
      let group = note.group;
      if (
        operation === "replaceLabel" &&
        group.length === 2 &&
        group[1].value === chart.headers.LNOBJ &&
        /^[12]/.test(group[1].channel)
      ) {
        if (replacement === chart.headers.LNOBJ)
          throw Error("起点不能使用 LNOBJ 结束编号");
        group = [group[0]];
      }
      for (const member of group) {
        changed.rows[member.row].cells[member.index] =
          operation === "delete" ? "00" : replacement;
        if (operation === "delete") resultingSelection.delete(eventId(member));
      }
    }
  }
  Object.assign(chart, changed);
  return { count: matches.length, selectedIds: resultingSelection };
}
