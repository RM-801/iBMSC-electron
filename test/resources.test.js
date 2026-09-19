import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS } from "../src/bms.js";
import { renameWAV, shiftWAV, assignWAV } from "../src/resources.js";
test("WAV swap rewrites sound channels but not BGA or BPM references", () => {
  const c = parseBMS(
    "#WAV01 a.wav\n#WAV02 b.wav\n#00011:0102\n#00001:0102\n#00004:0102\n#00008:0102",
  );
  renameWAV(c, "01", "02");
  assert.equal(c.resources.WAV["01"], "b.wav");
  assert.deepEqual(
    c.rows.map((r) => r.cells.join("")),
    ["0201", "0201", "0102", "0102"],
  );
});
test("WAV move without label synchronization leaves note references untouched", () => {
  const c = parseBMS("#WAV01 a.wav\n#00011:01");
  renameWAV(c, "01", "03", false);
  assert.equal(c.resources.WAV["01"], undefined);
  assert.equal(c.rows[0].cells[0], "01");
});

test("WAV block movement preserves order, exchanges displaced files, and updates references", () => {
  const c = parseBMS(
    "#WAV01 first.wav\n#WAV02 second.wav\n#WAV03 third.wav\n#00011:010203\n#00004:010203",
  );
  const selected = shiftWAV(c, ["02", "03"], -1);
  assert.deepEqual(selected, ["01", "02"]);
  assert.deepEqual(c.resources.WAV, {
    "01": "second.wav",
    "02": "third.wav",
    "03": "first.wav",
  });
  assert.equal(c.rows[0].cells.join(""), "030102");
  assert.equal(c.rows[1].cells.join(""), "010203");
  shiftWAV(c, selected, 1);
  assert.equal(c.rows[0].cells.join(""), "010203");
  assert.equal(c.resources.WAV["01"], "first.wav");
});
test("WAV boundary blocks stay put, independent blocks move and empty slots are selectable", () => {
  const c = parseBMS("#WAV01 a.wav\n#WAV02 b.wav\n#WAV04 d.wav\n#00011:04");
  assert.deepEqual(shiftWAV(c, ["01", "02", "04"], -1, false), [
    "01",
    "02",
    "03",
  ]);
  assert.equal(c.resources.WAV["03"], "d.wav");
  assert.equal(c.rows[0].cells[0], "04");
  assert.deepEqual(shiftWAV(c, ["ZY", "ZZ"], 1), ["ZY", "ZZ"]);
  assert.deepEqual(shiftWAV(c, ["05"], 1), ["06"]);
  assert.throws(() => shiftWAV(c, ["00"], 1));
});

test("browse assigns selected WAV slots then continues after the last selection, without changing notes", () => {
  const c = parseBMS("#WAV02 old.wav\n#00011:02");
  assert.deepEqual(
    assignWAV(c, ["02", "05"], ["sound/a.wav", "sound/b.wav", "sound/c.wav"]),
    ["02", "05", "06"],
  );
  assert.equal(c.resources.WAV["02"], "sound/a.wav");
  assert.equal(c.resources.WAV["06"], "sound/c.wav");
  assert.equal(c.rows[0].cells[0], "02");
  const before = structuredClone(c);
  assert.throws(() => assignWAV(c, ["ZZ"], ["one.wav", "two.wav"]));
  assert.deepEqual(c, before);
});
