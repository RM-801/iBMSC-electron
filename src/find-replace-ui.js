const switches = [
  ["selected", "已选中"],
  ["unselected", "未选中"],
  ["short", "短音符"],
  ["long", "长音符"],
  ["hidden", "隐藏音符"],
  ["visible", "可见音符"],
];
const ranges = [
  ["measure", "小节范围", "小节起点", "小节终点", 0, 999, 1, "0", "999"],
  ["label", "编号范围", "编号起点", "编号终点", null, null, null, "01", "ZZ"],
  [
    "value",
    "数值范围",
    "数值起点",
    "数值终点",
    0.0001,
    65535.9999,
    0.0001,
    "0.0001",
    "65535.9999",
  ],
];

export const findReplaceLabels = [
  "音符范围",
  ...switches.map(([, label]) => label),
  ...ranges.flatMap(([, ...labels]) => labels.slice(0, 3)),
  "至",
  "列",
  "全选",
  "反选",
  "全不选",
  "操作",
  "替换编号",
  "替换数值",
  "选择",
  "取消选择",
  "删除已选中",
  "按条件删除",
];

// Layout and defaults follow diagFind.Designer.vb; matching lives in find-replace.js.
export function createFindReplace({ root, ui, onAction, onError }) {
  const document = root.ownerDocument || globalThis.document;
  const rangeInputs = new Map(),
    toggleButtons = new Map(),
    columnButtons = new Map();
  const flags = Object.fromEntries(switches.map(([key]) => [key, true]));
  let selectedColumns = new Set(),
    base = 36;
  const element = (tag, className) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  };
  const text = (tag, source) => {
    const el = element(tag);
    ui.text(el, source);
    return el;
  };
  const button = (id, source, handler) => {
    const el = text("button", source);
    el.type = "button";
    el.id = "find-" + id;
    el.onclick = handler;
    return el;
  };
  const pressed = (control, checked) => {
    control.setAttribute("aria-pressed", String(checked));
    control.classList.toggle("selected", checked);
  };
  const fieldset = (source) => {
    const el = element("fieldset", "find-group");
    el.append(text("legend", source));
    root.append(el);
    return el;
  };
  const input = (id, label, value, min, max, step) => {
    const el = element("input");
    el.id = "find-" + id;
    el.type = min === null ? "text" : "number";
    if (min === null) {
      el.maxLength = 2;
      el.spellcheck = false;
    } else {
      el.min = String(min);
      el.max = String(max);
      el.step = String(step);
    }
    el.value = value;
    ui.attribute(el, "aria-label", label);
    return el;
  };

  const rangeGroup = fieldset("音符范围");
  const rangeSwitches = element("div", "find-note-ranges");
  for (let index = 0; index < switches.length; index += 2) {
    const pair = element("div", "find-range-pair");
    for (const [key, label] of switches.slice(index, index + 2)) {
      const control = button(key, label, () => {
        flags[key] = !flags[key];
        pressed(control, flags[key]);
      });
      pressed(control, true);
      toggleButtons.set(key, control);
      pair.append(control);
    }
    rangeSwitches.append(pair);
  }
  rangeGroup.append(rangeSwitches);
  for (const [
    key,
    label,
    fromLabel,
    toLabel,
    min,
    max,
    step,
    start,
    end,
  ] of ranges) {
    const row = element("div", "find-range-row");
    const name = text("label", label);
    const from = input(key + "-from", fromLabel, start, min, max, step);
    const to = input(key + "-to", toLabel, end, min, max, step);
    name.htmlFor = from.id;
    row.append(name, from, text("span", "至"), to);
    rangeInputs.set(key + "From", from);
    rangeInputs.set(key + "To", to);
    rangeGroup.append(row);
  }

  const columnsGroup = fieldset("列");
  const columnActions = element("div", "find-column-actions");
  const changeColumns = (mode) => {
    for (const [id, control] of columnButtons) {
      const active =
        mode === "all" || (mode === "inverse" && !selectedColumns.has(id));
      if (active) selectedColumns.add(id);
      else selectedColumns.delete(id);
      pressed(control, active);
    }
  };
  for (const [mode, label] of [
    ["all", "全选"],
    ["inverse", "反选"],
    ["none", "全不选"],
  ])
    columnActions.append(
      button("columns-" + mode, label, () => changeColumns(mode)),
    );
  const columnsGrid = element("div", "find-columns-grid");
  columnsGroup.append(columnActions, columnsGrid);

  const operations = fieldset("操作");
  operations.className += " find-operations";
  const labelReplacement = input("label-replacement", "替换编号", "01", null);
  const valueReplacement = input(
    "value-replacement",
    "替换数值",
    "120",
    0.0001,
    65535.9999,
    0.0001,
  );
  function perform(action, value) {
    try {
      onAction?.(action, read(), value);
    } catch (error) {
      if (onError) onError(error);
      else throw error;
    }
  }
  for (const [action, label, control] of [
    ["replace-label", "替换编号", labelReplacement],
    ["replace-value", "替换数值", valueReplacement],
  ]) {
    const row = element("div", "find-replace-row");
    row.append(
      button(action, label, () => perform(action, control.value)),
      control,
    );
    operations.append(row);
  }
  const actions = element("div", "find-selection-actions");
  for (const [action, label] of [
    ["select", "选择"],
    ["unselect", "取消选择"],
    ["delete-selected", "删除已选中"],
    ["delete", "按条件删除"],
  ])
    actions.append(button(action, label, () => perform(action)));
  operations.append(actions);

  function setColumns(columns) {
    const previous = new Set(columnButtons.keys());
    columnButtons.clear();
    columnsGrid.replaceChildren();
    const rows = new Map();
    for (const column of [...columns].sort(
      (a, b) => Number(a.id ?? a.Index) - Number(b.id ?? b.Index),
    )) {
      const id = Number(column.id ?? column.Index);
      if (
        !Number.isInteger(id) ||
        id < 1 ||
        [3, 12, 21, 25].includes(id) ||
        columnButtons.has(id)
      )
        continue;
      const group =
        id < 3
          ? "timing"
          : id < 12
            ? "a"
            : id < 21
              ? "d"
              : id < 26
                ? "bga"
                : "bgm";
      let row = rows.get(group);
      if (!row) {
        row = element(
          "div",
          "find-column-row" + (group === "bgm" ? " find-bgm-columns" : ""),
        );
        rows.set(group, row);
        columnsGrid.append(row);
      }
      if (!previous.has(id)) selectedColumns.add(id);
      const control = button("column-" + id, "", () => {
        if (selectedColumns.has(id)) selectedColumns.delete(id);
        else selectedColumns.add(id);
        pressed(control, selectedColumns.has(id));
      });
      const defaultTitle =
        id === 1
          ? "BPM"
          : id === 2
            ? "STOP"
            : id < 12
              ? "A" + (id - 3)
              : id < 21
                ? "D" + (id - 12)
                : id === 22
                  ? "BGA"
                  : id === 23
                    ? "LAYER"
                    : id === 24
                      ? "POOR"
                      : "B" + (id - 25);
      ui.raw(control, column.title ?? column.Title ?? defaultTitle);
      control.disabled = column.enabled === false;
      pressed(control, selectedColumns.has(id));
      columnButtons.set(id, control);
      row.append(control);
    }
    selectedColumns = new Set(
      [...selectedColumns].filter((id) => columnButtons.has(id)),
    );
  }
  function read() {
    const result = {
      ...flags,
      columns: [...selectedColumns].sort((a, b) => a - b),
    };
    for (const [key, control] of rangeInputs) {
      const value = control.value;
      // Keep empty numeric input invalid instead of turning it into zero.
      result[key] =
        key.startsWith("label") || value.trim() === "" ? value : Number(value);
    }
    return result;
  }
  return {
    read,
    setColumns,
    setBase(next) {
      const last = (value) =>
        value === 16 ? "FF" : value === 62 ? "zz" : "ZZ";
      const input = rangeInputs.get("labelTo");
      if (input.value === last(base)) input.value = last(Number(next));
      base = Number(next);
    },
    load(criteria) {
      for (const [key, control] of toggleButtons) {
        flags[key] = criteria[key] !== false;
        pressed(control, flags[key]);
      }
      for (const [key, control] of rangeInputs)
        if (criteria[key] !== undefined) control.value = String(criteria[key]);
      if (criteria.columns) {
        selectedColumns = new Set(criteria.columns.map(Number));
        for (const [id, control] of columnButtons)
          pressed(control, selectedColumns.has(id));
      }
    },
  };
}
