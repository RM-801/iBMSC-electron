import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS, events, longPairs } from "../src/bms.js";
import { eventId } from "../src/commands.js";
import { removeNoteGroup, relabelNote, resizeNotes } from "../src/note-edit.js";
test("NT right-delete removes both endpoints, BMSE removes only the targeted end", () => {
  for (const nt of [true, false]) {
    const c = parseBMS("#00051:0101");
    removeNoteGroup(c, events(c)[1], nt);
    assert.equal(events(c).length, nt ? 0 : 1);
  }
});
test("relabel NT sound retains LNOBJ release marker; numeric relabel allocates extended BPM", () => {
  const c = parseBMS("#LNOBJ ZZ\n#00011:01ZZ\n#00103:78");
  relabelNote(c, events(c)[1], "a");
  assert.deepEqual(
    events(c)
      .slice(0, 2)
      .map((n) => n.value),
    ["0A", "ZZ"],
  );
  assert.equal(longPairs(c).pairs.length, 1);
  relabelNote(c, events(c)[2], 150.5);
  assert.equal(c.resources.BPM[events(c)[2].value], "150.5");
});
test("NT multi-resize clamps at shortest length and collapses to a regular note", () => {
  const c = parseBMS("#00051:0101\n#00052:01000001");
  resizeNotes(c, new Set(events(c).map(eventId)), true, -20);
  assert.deepEqual(
    events(c)
      .map((n) => [n.channel, n.beat])
      .sort(),
    [
      ["11", 0],
      ["52", 0],
      ["52", 1],
    ],
  );
});
test("NT lower end resize crosses a measure while retaining the release time", () => {
  const c = parseBMS("#00151:01\n#00251:01");
  resizeNotes(c, new Set(events(c).map(eventId)), false, -3);
  assert.deepEqual(
    events(c).map((n) => n.beat),
    [1, 8],
  );
});
test("NT resizing preserves LNOBJ endpoint and can extend a regular note", () => {
  const c = parseBMS("#LNOBJ ZZ\n#00011:01ZZ\n#00012:02");
  resizeNotes(
    c,
    new Set([eventId(events(c).find((n) => n.channel === "11"))]),
    true,
    4,
  );
  assert.equal(longPairs(c).pairs[0][1].value, "ZZ");
  const n = events(c).find((n) => n.channel === "12");
  resizeNotes(c, new Set([eventId(n)]), true, 3);
  assert.equal(longPairs(c).pairs.length, 2);
});

test("resizing cannot silently pair a hold with the following hold", () => {
  const c = parseBMS("#00051:0101\n#00151:0202");
  assert.throws(
    () => resizeNotes(c, new Set([eventId(events(c)[0])]), true, 3),
    /交叉/,
  );
});

test("resize preview is read-only and predicts the committed endpoints", async () => {
  const { planNoteResize } = await import("../src/note-edit.js");
  const c = parseBMS("#00051:0101"),
    before = structuredClone(c);
  const ids = new Set(events(c).map(eventId));
  const preview = planNoteResize(c, ids, true, 3);
  assert.deepEqual(c, before);
  assert.deepEqual(
    preview.plans.map((n) => n.beat),
    [0, 5],
  );
  resizeNotes(c, ids, true, 3);
  assert.deepEqual(
    events(c).map((n) => n.beat),
    preview.plans.map((n) => n.beat),
  );
});
