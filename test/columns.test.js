import { test } from "node:test";
import assert from "node:assert/strict";
import {
  originalColumns,
  fillBGMColumns,
  eventColumn,
  writeColumn,
  numericValue,
} from "../src/columns.js";
import { parseBMS, events, serializeBMS } from "../src/bms.js";
import { insertMeasure, removeMeasure } from "../src/edit.js";
test("upstream column order: BPM STOP A1-A8 D1-D8 BGA LAYER POOR B1...", () => {
  const columns = originalColumns({ bgm: 3 });
  assert.deepEqual(
    columns.filter((c) => c.channel).map((c) => c.title),
    [
      "BPM",
      "STOP",
      ...Array.from({ length: 8 }, (_, i) => "A" + (i + 1)),
      ...Array.from({ length: 8 }, (_, i) => "D" + (i + 1)),
      "BGA",
      "LAYER",
      "POOR",
      "B1",
      "B2",
      "B3",
    ],
  );
  assert.equal(columns.find((c) => c.title === "D8").channel, "26");
});
test("normal hidden LN and hidden LN share same physical lane", () => {
  const c = parseBMS(
    "#00011:01\n#00131:01\n#00251:01\n#00371:01\n#00403:78\n#00508:01",
  );
  assert.deepEqual(
    events(c).map((e) => eventColumn(c, e)),
    [5, 5, 5, 5, 1, 1],
  );
});
test("independent BGM columns remain independent across save/load", () => {
  const c = parseBMS("");
  const col = originalColumns({ bgm: 3 }).find((c) => c.title === "B3");
  writeColumn(c, col, 0, 0, 16, "01");
  assert.equal(c.rows.length, 3);
  const d = parseBMS(serializeBMS(c));
  assert.equal(eventColumn(d, events(d)[0]), 28);
});
test("numeric input chooses 03 / 08 and STOP definition automatically", () => {
  const c = parseBMS(""),
    cols = originalColumns();
  writeColumn(
    c,
    cols.find((c) => c.id === 1),
    0,
    0,
    16,
    "140",
  );
  writeColumn(
    c,
    cols.find((c) => c.id === 1),
    1,
    0,
    16,
    "140.5",
  );
  writeColumn(
    c,
    cols.find((c) => c.id === 2),
    2,
    0,
    16,
    "48",
  );
  assert.deepEqual(
    events(c).map((e) => e.channel),
    ["03", "08", "09"],
  );
  assert.deepEqual(
    events(c).map((e) => numericValue(c, e)),
    [140, 140.5, 48],
  );
});
test("conditional expansion remains intact without flattening alternatives", () => {
  const branch =
    "#RANDOM 2\n#IF 1\n#00011:01\n#ELSE\n#00012:01\n#ENDIF\n#ENDRANDOM";
  const c = parseBMS(branch);
  assert.equal(events(c).length, 0);
  assert.ok(serializeBMS(c).includes(branch.replaceAll("\n", "\r\n")));
});
test("insert/remove measures shifts events and ratios reversibly", () => {
  const c = parseBMS("#00302:0.75\n#00311:01");
  const before = structuredClone(c);
  insertMeasure(c, 2);
  assert.equal(c.rows[0].measure, 4);
  assert.equal(c.ratios[4], 0.75);
  removeMeasure(c, 2);
  assert.deepEqual(c, before);
});

test("BGM display fills viewport, preserves chart minimum and respects theme widths", () => {
  for (const double of [false, true]) for (const bga of [false, true]) {
    const base = originalColumns({ double, bga, bgm: 15 });
    const filled = fillBGMColumns(base, 1920);
    const edge = filled.at(-1).left + filled.at(-1).width;
    assert.ok(edge >= 1920 && edge < 1960);
    assert.equal(base.filter(c => c.channel === "01").length, 15);
    assert.equal(fillBGMColumns(base, 300).length, base.length);
    assert.equal(base.some(c => c.id === 25), bga);
    assert.equal(base.some(c => c.id === 21), double);
  }
  const custom = [{ id: 26, bgm: 0, channel: "01", title: "Music1", width: 23, left: 500 }];
  assert.equal(fillBGMColumns(custom, 600).at(-1).title, "Music5");
  assert.equal(fillBGMColumns([{ ...custom[0], width: 0 }], 600).length, 1);
  assert.equal(fillBGMColumns(originalColumns({ bgm: 999 }), 100000).at(-1).bgm, 998);
});
