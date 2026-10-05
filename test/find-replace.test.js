import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS, events, longPairs } from "../src/bms.js";
import { eventId } from "../src/commands.js";
import { numericValue } from "../src/columns.js";
import { resourceIds } from "../src/identifiers.js";
import { History } from "../src/history.js";
import {
  createFindCriteria,
  validateFindCriteria,
  findMatches,
  applyFindOperation,
} from "../src/find-replace.js";

const sample = () =>
  parseBMS(
    "#BPM01 300.25\n#STOP01 48\n#00003:78\n#00108:01\n#00209:01\n" +
      "#00011:01\n#00131:02\n#00251:0303\n#00371:0404\n#00421:05\n#00404:06\n#00501:07\n#00501:08",
  );
const values = (notes) => notes.map((note) => note.value);

test("find defaults expose all editable columns, BGM lanes, and the chart's BASE range", () => {
  for (const [base, upper] of [
    [16, "FF"],
    [36, "ZZ"],
    [62, "zz"],
  ]) {
    const chart = parseBMS(`#BASE ${base}`);
    const criteria = createFindCriteria(chart, 3);
    assert.equal(criteria.labelTo, upper);
    assert.deepEqual(
      criteria.columns,
      [
        1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23,
        24, 26, 27, 28,
      ],
    );
  }
  assert.ok(
    createFindCriteria(
      parseBMS("#00001:01\n#00001:02\n#00001:03"),
      1,
    ).columns.includes(28),
  );
});

test("find applies six independent switches, inclusive measures, and separate BGM columns", () => {
  const chart = sample();
  assert.equal(findMatches(chart).length, 11);
  assert.deepEqual(
    values(findMatches(chart, { columns: [5], short: false, hidden: false })),
    ["03"],
  );
  assert.deepEqual(
    values(findMatches(chart, { columns: [5], long: false, visible: false })),
    ["02"],
  );
  assert.deepEqual(values(findMatches(chart, { columns: [27] })), ["08"]);
  assert.deepEqual(
    values(findMatches(chart, { measureFrom: "2", measureTo: "2" })),
    ["01", "03"],
  );
  for (const off of [
    { selected: false, unselected: false },
    { short: false, long: false },
    { hidden: false, visible: false },
    { columns: [] },
  ])
    assert.deepEqual(findMatches(chart, off), []);
  const one = events(chart).find((note) => note.channel === "11");
  const ids = new Set([eventId(one)]);
  assert.deepEqual(
    values(findMatches(chart, { unselected: false }, { selectedIds: ids })),
    ["01"],
  );
  assert.equal(
    findMatches(chart, { selected: false }, { selectedIds: ids }).length,
    10,
  );
});

test("find uses actual BPM and STOP values rather than their resource IDs", () => {
  const chart = sample();
  assert.deepEqual(
    findMatches(chart, {
      columns: [1, 2],
      valueFrom: 120,
      valueTo: 300.25,
      labelFrom: "ZZ",
      labelTo: "ZZ",
    }).map((note) => numericValue(chart, note)),
    [120, 300.25],
  );
  assert.deepEqual(
    values(
      findMatches(chart, {
        columns: [5],
        labelFrom: "02",
        labelTo: "04",
        valueFrom: 65535,
        valueTo: 65535.9999,
      }),
    ),
    ["02", "03", "04"],
  );
});

test("find honors BASE62 case and accepts normalized one-character BASE16 labels", () => {
  const chart = parseBMS("#BASE 62\n#00011:AAaaAZaz");
  assert.deepEqual(
    values(findMatches(chart, { labelFrom: "AA", labelTo: "AZ" })),
    ["AA", "AZ"],
  );
  const hex = parseBMS("#BASE 16\n#00011:0A0F");
  assert.deepEqual(values(findMatches(hex, { labelFrom: "a", labelTo: "a" })), [
    "0A",
  ]);
});

test("find validation rejects reversed ranges, invalid precision, switches and separator columns", () => {
  const chart = parseBMS("");
  for (const invalid of [
    { measureFrom: -1 },
    { measureTo: 1000 },
    { measureFrom: "" },
    { measureFrom: 1.5 },
    { measureFrom: 2, measureTo: 1 },
    { labelFrom: "00" },
    { labelFrom: "?" },
    { labelFrom: "ZZ", labelTo: "01" },
    { valueFrom: 0 },
    { valueTo: 65536 },
    { valueFrom: "" },
    { valueFrom: 0.00011 },
    { valueFrom: 100, valueTo: 99 },
    { columns: [3] },
    { columns: [1025] },
    { selected: "true" },
  ])
    assert.throws(() => validateFindCriteria(chart, invalid));
  assert.throws(
    () => findMatches(parseBMS("#BASE 16"), { labelTo: "ZZ" }),
    /当前 BASE/,
  );
  const supplied = { measureFrom: "1", labelFrom: "a", columns: new Set([5]) };
  const before = structuredClone(supplied);
  assert.equal(validateFindCriteria(chart, supplied).labelFrom, "0A");
  assert.deepEqual(supplied, before);
});

test("find Select replaces eligible selection, preserving hidden or disabled types", () => {
  const chart = parseBMS("#00011:01\n#00111:02\n#00231:03\n#00321:04");
  const notes = events(chart),
    before = structuredClone(chart);
  const selectedIds = new Set([
    eventId(notes[0]),
    eventId(notes[2]),
    eventId(notes[3]),
  ]);
  const result = applyFindOperation(
    chart,
    { measureFrom: 1, measureTo: 1, hidden: false },
    "select",
    { selectedIds, enabledColumns: [5] },
  );
  assert.equal(result.count, 1);
  assert.deepEqual(
    result.selectedIds,
    new Set([eventId(notes[1]), eventId(notes[2]), eventId(notes[3])]),
  );
  assert.deepEqual(
    selectedIds,
    new Set([eventId(notes[0]), eventId(notes[2]), eventId(notes[3])]),
  );
  assert.deepEqual(chart, before);
});

test("find Unselect uses the original inverse-predicate semantics outside the range", () => {
  const chart = parseBMS("#00011:01\n#00111:02\n#00211:03");
  const notes = events(chart);
  const result = applyFindOperation(
    chart,
    { measureFrom: 1, measureTo: 1 },
    "unselect",
  );
  assert.deepEqual(
    result.selectedIds,
    new Set([eventId(notes[0]), eventId(notes[2])]),
  );
  const original = new Set([eventId(notes[0])]);
  const selectedOnly = applyFindOperation(
    chart,
    { unselected: false, columns: [] },
    "select",
    { selectedIds: original },
  );
  assert.deepEqual(selectedOnly.selectedIds, new Set());
  assert.equal(original.size, 1);
  assert.deepEqual(
    applyFindOperation(chart, { columns: [] }, "unselect").selectedIds,
    new Set(notes.map(eventId)),
  );
});

test("NT long notes search by their start while BMSE endpoints remain independent", () => {
  const chart = parseBMS("#00051:03\n#00151:04");
  const notes = events(chart);
  assert.equal(findMatches(chart, { measureFrom: 1, measureTo: 1 }).length, 0);
  assert.deepEqual(
    values(findMatches(chart, { measureFrom: 1, measureTo: 1 }, { nt: false })),
    ["04"],
  );
  const found = findMatches(
    chart,
    { unselected: false },
    { selectedIds: new Set([eventId(notes[1])]) },
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].group.length, 2);
  assert.deepEqual(
    applyFindOperation(chart, {}, "select").selectedIds,
    new Set(notes.map(eventId)),
  );
  const bmse = structuredClone(chart);
  applyFindOperation(bmse, { measureFrom: 1, measureTo: 1 }, "delete", {
    nt: false,
  });
  assert.deepEqual(values(events(bmse)), ["03"]);
  applyFindOperation(chart, { measureFrom: 0, measureTo: 0 }, "delete");
  assert.deepEqual(events(chart), []);
});

test("label replacement preserves NT LNOBJ releases and leaves numeric tracks unchanged", () => {
  const chart = parseBMS(
    "#LNOBJ ZZ\n#00011:01ZZ\n#00103:78\n#STOP01 48\n#00109:01",
  );
  const result = applyFindOperation(chart, {}, "replaceLabel", { value: "a" });
  assert.equal(result.count, 1);
  assert.equal(result.selectedIds.size, 0);
  assert.deepEqual(values(events(chart)), ["0A", "ZZ", "78", "01"]);
  assert.equal(longPairs(chart).pairs.length, 1);
  assert.equal(findMatches(chart, { short: false }).length, 1);
  assert.equal(findMatches(chart, { short: false }, { nt: false }).length, 0);
  const before = structuredClone(chart);
  assert.throws(
    () => applyFindOperation(chart, {}, "replaceLabel", { value: "ZZ" }),
    /LNOBJ/,
  );
  assert.deepEqual(chart, before);
});

test("BGM long groups remain paired during find operations in either input mode", () => {
  for (const nt of [false, true]) {
    const chart = parseBMS("#00001:0101");
    chart.rows[0].longCells = { 0: true, 1: true };
    assert.equal(findMatches(chart, { short: false }, { nt }).length, 1);
    applyFindOperation(chart, {}, "replace-label", { nt, value: "02" });
    assert.deepEqual(values(events(chart)), ["02", "02"]);
    assert.equal(longPairs(chart).pairs.length, 1);
    applyFindOperation(chart, {}, "delete", { nt });
    assert.deepEqual(events(chart), []);
  }
});

test("numeric replacement batches row changes and allocates independent BPM/STOP definitions", () => {
  const chart = parseBMS(
    "#BPM01 140.5\n#BPM02 150.5\n#STOP01 48\n#00003:78\n#00008:00010002\n#00109:01\n#00211:0A",
  );
  const result = applyFindOperation(chart, {}, "replaceValue", {
    value: "150.25",
  });
  assert.equal(result.count, 4);
  assert.deepEqual(
    events(chart)
      .filter((n) => n.channel === "08" || n.channel === "09")
      .map((n) => numericValue(chart, n)),
    [150.25, 150.25, 150.25, 150.25],
  );
  assert.equal(events(chart).filter((n) => n.channel === "08").length, 3);
  assert.equal(events(chart).find((n) => n.channel === "11").value, "0A");
  applyFindOperation(chart, {}, "replace-value", { value: 200 });
  assert.equal(events(chart).filter((n) => n.channel === "03").length, 3);
  assert.equal(chart.headers.BPM, "120");
});

test("find mutations are atomic on late errors and can commit as one undo step", () => {
  const chart = parseBMS("#BASE 16\n#00003:78\n#00109:01");
  chart.resources.STOP = Object.fromEntries(
    resourceIds(chart).map((id, i) => [id, String(1000 + i)]),
  );
  const before = structuredClone(chart);
  assert.throws(
    () => applyFindOperation(chart, {}, "replaceValue", { value: 500.5 }),
    /定义编号已满/,
  );
  assert.deepEqual(chart, before);
  const ln = parseBMS("#LNOBJ ZZ\n#00012:03\n#00111:01ZZ");
  const original = structuredClone(ln);
  assert.throws(
    () => applyFindOperation(ln, {}, "replaceLabel", { value: "ZZ" }),
    /LNOBJ/,
  );
  assert.deepEqual(ln, original);
  const history = new History(ln);
  applyFindOperation(ln, {}, "replaceLabel", { value: "02" });
  assert.equal(history.commit(original, ln), true);
  assert.deepEqual(history.undo(ln), original);
  assert.deepEqual(history.redo(original), ln);
});

test("find replacement retains selection and deletion removes only deleted selection IDs", () => {
  const chart = parseBMS("#00011:01\n#00111:02");
  const selectedIds = new Set(events(chart).map(eventId));
  const changed = applyFindOperation(chart, { labelTo: "01" }, "replaceLabel", {
    selectedIds,
    value: "03",
  });
  assert.deepEqual(changed.selectedIds, selectedIds);
  const deleted = applyFindOperation(
    chart,
    { labelFrom: "03", labelTo: "03" },
    "delete",
    { selectedIds },
  );
  assert.deepEqual(deleted.selectedIds, new Set(events(chart).map(eventId)));
  assert.equal(selectedIds.size, 2);
});

test("numeric replacement restores selected positions after changing BPM row and cell addresses", () => {
  const chart = parseBMS(
    "#BPM01 140.5\n#BPM02 150.5\n#00003:78\n#00008:00010002\n#00211:0A",
  );
  const selectedIds = new Set(
    events(chart)
      .filter((n) => [0, 3, 8].includes(n.beat))
      .map(eventId),
  );
  const result = applyFindOperation(chart, {}, "replaceValue", {
    selectedIds,
    value: "160.125",
  });
  const selectedNotes = events(chart).filter((n) =>
    result.selectedIds.has(eventId(n)),
  );
  assert.deepEqual(
    selectedNotes.map((n) => [n.beat, n.channel]),
    [
      [0, "08"],
      [3, "08"],
      [8, "11"],
    ],
  );
  assert.equal(selectedIds.size, 3);
});

test("no matches and invalid operations never modify the chart", () => {
  const chart = sample(),
    before = structuredClone(chart);
  assert.equal(applyFindOperation(chart, { columns: [] }, "delete").count, 0);
  assert.equal(
    applyFindOperation(chart, {}, "delete", { enabledColumns: [] }).count,
    0,
  );
  assert.throws(() => applyFindOperation(chart, {}, "unknown"), /无效查找操作/);
  assert.throws(
    () => applyFindOperation(chart, {}, "replaceLabel", { value: "00" }),
    /替换编号/,
  );
  assert.throws(
    () => applyFindOperation(chart, {}, "replaceValue", { value: 0 }),
    /查找数值/,
  );
  assert.deepEqual(chart, before);
});

test("delete selected acts on an unselected-only search result while conditional delete stays live", () => {
  const chart = parseBMS("#00011:01\n#00111:02");
  const criteria = { selected: false };
  const selected = applyFindOperation(chart, criteria, "select");
  assert.equal(selected.count, 2);
  const before = structuredClone(chart);
  const conditional = applyFindOperation(chart, criteria, "delete", {
    selectedIds: selected.selectedIds,
  });
  assert.deepEqual(conditional, {
    count: 0,
    selectedIds: selected.selectedIds,
  });
  assert.deepEqual(chart, before);
  const deleted = applyFindOperation(chart, criteria, "deleteSelected", {
    selectedIds: selected.selectedIds,
  });
  assert.deepEqual(deleted, { count: 2, selectedIds: new Set() });
  assert.deepEqual(events(chart), []);
});

test("delete-selected also deletes notes selected before opening the find dialog", () => {
  const chart = parseBMS("#00011:01\n#00111:02\n#00211:03");
  const notes = events(chart),
    originalSelection = new Set([eventId(notes[0])]);
  const criteria = { selected: false, measureFrom: 1, measureTo: 1 };
  const selected = applyFindOperation(chart, criteria, "select", {
    selectedIds: originalSelection,
  });
  assert.deepEqual(
    selected.selectedIds,
    new Set([eventId(notes[0]), eventId(notes[1])]),
  );
  const deleted = applyFindOperation(chart, criteria, "delete-selected", {
    selectedIds: selected.selectedIds,
  });
  assert.equal(deleted.count, 2);
  assert.deepEqual(deleted.selectedIds, new Set());
  assert.deepEqual(values(events(chart)), ["03"]);
  assert.deepEqual(originalSelection, new Set([eventId(notes[0])]));
  assert.equal(selected.selectedIds.size, 2);
});

test("delete selected ignores all criteria and lane filters, including invalid ranges and undefined BPM", () => {
  const chart = parseBMS(
    "#00031:01\n#00151:02\n#00251:02\n#00308:03",
  );
  const selectedIds = new Set(events(chart).map(eventId));
  const criteria = {
    selected: "invalid",
    unselected: false,
    short: false,
    long: false,
    hidden: false,
    visible: false,
    measureFrom: 1000,
    measureTo: -1,
    labelFrom: "ZZ",
    labelTo: "00",
    valueFrom: -1,
    valueTo: "invalid",
    columns: [3],
  };
  assert.throws(() =>
    applyFindOperation(chart, criteria, "delete", { selectedIds }),
  );
  const deleted = applyFindOperation(chart, criteria, "deleteSelected", {
    selectedIds,
    enabledColumns: [3],
  });
  assert.equal(deleted.count, 3);
  assert.deepEqual(events(chart), []);
  assert.deepEqual(deleted.selectedIds, new Set(events(chart).map(eventId)));
  assert.equal(selectedIds.size, 4);
});

test("delete selected with no selection is a no-op even when the criteria are invalid", () => {
  const chart = sample(),
    before = structuredClone(chart);
  for (const operation of ["deleteSelected", "delete-selected"]) {
    assert.deepEqual(
      applyFindOperation(
        chart,
        { measureFrom: "bad", columns: null },
        operation,
      ),
      {
        count: 0,
        selectedIds: new Set(),
      },
    );
    assert.deepEqual(chart, before);
  }
});

test("delete selected uses NT long groups and independent BMSE endpoints, including LNOBJ", () => {
  for (const source of [
    "#00051:01\n#00151:02",
    "#LNOBJ ZZ\n#00011:01\n#00111:ZZ",
  ])
    for (const nt of [true, false]) {
      const chart = parseBMS(source),
        notes = events(chart);
      const selectedIds = new Set([eventId(notes[1])]);
      const result = applyFindOperation(
        chart,
        { long: false, columns: [] },
        "deleteSelected",
        { selectedIds, nt },
      );
      assert.equal(result.count, 1);
      assert.deepEqual(result.selectedIds, new Set());
      assert.deepEqual(values(events(chart)), nt ? [] : ["01"]);
      assert.equal(selectedIds.size, 1);
    }
  for (const nt of [true, false]) {
    const chart = parseBMS("#00001:0101");
    chart.rows[0].longCells = { 0: true, 1: true };
    const result = applyFindOperation(chart, {}, "deleteSelected", {
      selectedIds: new Set([eventId(events(chart)[1])]),
      nt,
    });
    assert.equal(result.count, 1);
    assert.deepEqual(events(chart), []);
  }
});

test("delete selected commits as one undo step and preserves the supplied selection set", () => {
  const chart = parseBMS("#00011:01\n#00111:02");
  const before = structuredClone(chart),
    history = new History(chart);
  const selectedIds = new Set([eventId(events(chart)[0])]);
  const result = applyFindOperation(chart, {}, "deleteSelected", {
    selectedIds,
  });
  assert.deepEqual(result, { count: 1, selectedIds: new Set() });
  assert.equal(selectedIds.size, 1);
  assert.equal(history.commit(before, chart), true);
  assert.deepEqual(history.undo(chart), before);
  assert.deepEqual(history.redo(before), chart);
});
