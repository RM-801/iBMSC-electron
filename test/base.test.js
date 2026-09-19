import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBMS,
  serializeBMS,
  events,
  putNote,
  longPairs,
  timeline,
} from "../src/bms.js";
import { encodeId, decodeId, resourceIds } from "../src/identifiers.js";
import { renameWAV, shiftWAV, assignWAV } from "../src/resources.js";
import { relabelNote } from "../src/note-edit.js";
import { defineNumber, writeColumn, originalColumns } from "../src/columns.js";
import { statistics } from "../src/diagnostics.js";
import { writeProject } from "../src/project.js";
const base62 = "#BASE 62\n#BPM 120\n";
test("BASE62 full alphabet, late header and case-distinct definitions round trip", () => {
  const c = parseBMS(
    "#WAV0A upper.wav\n#WAV0a lower.ogg\n#BMPzz last.png\n#00011:0A0azz\n#BASE 62",
  );
  assert.equal(c.resources.WAV["0A"], "upper.wav");
  assert.equal(c.resources.WAV["0a"], "lower.ogg");
  const reopened = parseBMS(serializeBMS(c));
  assert.deepEqual(reopened.resources, c.resources);
  assert.deepEqual(reopened.rows, c.rows);
  assert.deepEqual(reopened.headers, c.headers);
  const ids = resourceIds(c);
  assert.equal(ids.length, 3843);
  assert.equal(ids.at(-1), "zz");
  assert.equal(decodeId(c, "0a"), 36);
  assert.equal(decodeId(c, "10"), 62);
  for (let n = 0; n < 3844; n++) assert.equal(decodeId(c, encodeId(c, n)), n);
  assert.throws(() => writeProject(c), /BASE36/);
});
test("BASE16 and default BASE36 remain case insensitive; channel 03 stays hexadecimal", () => {
  const c = parseBMS("#BASE 16\n#WAVff a.wav\n#00019:ff\n#00003:af");
  assert.equal(c.rows[0].channel, "19");
  assert.equal(c.rows[0].cells[0], "FF");
  assert.equal(c.rows[1].cells[0], "AF");
  assert.equal(resourceIds(c).length, 255);
  assert.throws(() => parseBMS("#BASE 16\n#WAV0G a.wav"));
  assert.equal(parseBMS("#WAV0a a.wav\n#00011:0a").rows[0].cells[0], "0A");
  assert.equal(parseBMS(base62 + "#00003:af").rows[0].cells[0], "AF");
  assert.throws(() => parseBMS(base62 + "#00003:zz"));
  const opaque = parseBMS("#IF 1\n#BASE 62\n#ENDIF\n#00011:0a");
  assert.equal(opaque.rows[0].cells[0], "0A");
});
test("BASE62 label editing and WAV movement cross Z/a and z/10 boundaries", () => {
  const c = parseBMS(base62 + "#WAV0Z z.wav\n#00011:0Z");
  assert.deepEqual(shiftWAV(c, ["0Z"], 1), ["0a"]);
  assert.equal(events(c)[0].value, "0a");
  renameWAV(c, "0a", "0z");
  assert.deepEqual(shiftWAV(c, ["0z"], 1), ["10"]);
  assert.equal(events(c)[0].value, "10");
  assert.deepEqual(assignWAV(c, ["zy"], ["a.wav", "b.ogg"]), ["zy", "zz"]);
  assert.throws(() => assignWAV(c, ["zz"], ["a", "b"]));
  relabelNote(c, events(c)[0], "0a");
  assert.equal(events(c)[0].value, "0a");
  putNote(c, 1, "11", 0, 1, "zz");
  assert.equal(events(c).at(-1).value, "zz");
});
test("BASE62 LNOBJ, statistics and tempo lookups retain case sensitivity", () => {
  const c = parseBMS(
    base62 +
      "#LNOBJ 0a\n#WAV0A a.wav\n#BPM0A 60\n#BPM0a 240\n#STOPzz 48\n#00011:0A0a\n#00008:0a\n#00009:zz\n#00111:0A",
  );
  assert.equal(longPairs(c).pairs.length, 1);
  assert.equal(longPairs(c).pairs[0][1].value, "0a");
  const result = timeline(c);
  assert.equal(result.length, 2);
  assert.equal(result[1].time, 1.25);
  assert.equal(statistics(c).aLanes[1].counts[2], 1);
  const many = parseBMS(base62);
  for (let n = 1; n <= 35; n++)
    many.resources.BPM[encodeId(many, n)] = String(n);
  assert.equal(defineNumber(many, "BPM", 200), "0a");
  assert.equal(parseBMS(serializeBMS(c)).headers.LNOBJ, "0a");
});

test("BASE62 BGM writing keeps lower-case labels, including temporary LN endpoints", () => {
  const c = parseBMS(base62);
  // Resolve by channel rather than relying on an editor column index.
  const col = originalColumns({ bgm: 1 }).find((c) => c.channel === "01");
  writeColumn(c, col, 0, 0, 2, "0a", { long: true });
  writeColumn(c, col, 0, 1, 2, "zz", { long: true });
  assert.deepEqual(
    events(c).map((e) => e.value),
    ["0a", "zz"],
  );
  assert.equal(longPairs(c).pairs.length, 1);
});

test("four case combinations stay distinct while copying long notes", async () => {
  const { captureNotes, putCaptured, eventId } =
    await import("../src/commands.js");
  const c = parseBMS(
    base62 +
      "#WAVAA a.wav\n#WAVAa b.wav\n#WAVaA c.wav\n#WAVaa d.wav\n#00051:AAAaaAaa",
  );
  assert.equal(Object.keys(c.resources.WAV).length, 4);
  const copied = captureNotes(c, new Set(events(c).map(eventId)));
  putCaptured(c, copied, { copy: true, deltaBeat: 4 });
  assert.deepEqual(
    events(c).map((e) => e.value),
    ["AA", "Aa", "aA", "aa", "AA", "Aa", "aA", "aa"],
  );
  assert.equal(longPairs(c).pairs.length, 4);
  assert.equal(longPairs(parseBMS(serializeBMS(c))).pairs.length, 4);
});
