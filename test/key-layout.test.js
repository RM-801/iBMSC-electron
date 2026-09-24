import { test } from "node:test";
import assert from "node:assert/strict";
import { themes } from "../src/themes.js";
import {
  isPomuTheme,
  pomuColumns,
  pomuChannels,
  pomuStatisticsRows,
  shiftVisibleNotes,
} from "../src/key-layout.js";
import { parseBMS, events, serializeBMS } from "../src/bms.js";
import { statistics } from "../src/diagnostics.js";
import { originalColumns } from "../src/columns.js";
import {
  captureNotes,
  eventId,
  mirrorCaptured,
  nudgeCaptured,
} from "../src/commands.js";
import { mirrorMeasures } from "../src/edit.js";

test("Pomu layout is recognized by nine physical keys, including restored/XML themes", () => {
  assert.equal(isPomuTheme(themes.Pomu), true);
  assert.equal(isPomuTheme(JSON.parse(JSON.stringify(themes.Pomu))), true);
  assert.equal(isPomuTheme(themes.IIDX), false);
  assert.equal(isPomuTheme(null), false);
  const partial = structuredClone(themes.Pomu);
  partial.columns.find((c) => +c.Index === 17).Width = "0";
  assert.equal(isPomuTheme(partial), false);
});
test("nine-key statistics and both mirror commands keep right keys in one player field", () => {
  const chart = parseBMS(
    "#PLAYER 1\n" +
      pomuChannels.map((ch, i) => `#000${ch}:0${i + 1}`).join("\n"),
  );
  const rows = pomuStatisticsRows(statistics(chart), themes.Pomu);
  assert.deepEqual(
    rows.slice(2, 11).map((r) => r.name),
    ["1 LW", "2 LY", "3 LG", "4 LB", "5 RED", "6 RB", "7 RG", "8 RY", "9 RW"],
  );
  assert.equal(rows[11].counts[5], 9);
  const captured = structuredClone(chart),
    measures = structuredClone(chart);
  mirrorCaptured(
    captured,
    captureNotes(captured, new Set(events(captured).map(eventId))),
    pomuColumns,
  );
  mirrorMeasures(measures, 0, 0, pomuChannels, pomuChannels);
  for (const c of [captured, measures]) {
    assert.equal(c.headers.PLAYER, "1");
    for (const [i, ch] of pomuChannels.entries())
      assert.equal(events(c).find((e) => e.channel === ch).value, `0${9 - i}`);
    assert.equal(events(parseBMS(serializeBMS(c))).length, 9);
  }
});
test("horizontal movement skips unused BMS channels at the middle of the nine-key layout", () => {
  const columns = originalColumns().filter((c) => pomuColumns.includes(c.id));
  assert.deepEqual(
    shiftVisibleNotes([{ column: 8 }, { column: 9 }], 9, 14, columns).map(
      (n) => n.column,
    ),
    [9, 14],
  );
  const chart = parseBMS("#PLAYER 1\n#00015:01");
  nudgeCaptured(
    chart,
    captureNotes(chart, new Set(events(chart).map(eventId))),
    "ArrowRight",
    16,
    false,
    columns,
  );
  assert.equal(events(chart)[0].channel, "22");
  assert.throws(() => shiftVisibleNotes([{ column: 17 }], 9, 14, columns));
});
