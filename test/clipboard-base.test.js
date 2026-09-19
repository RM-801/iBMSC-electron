import test from "node:test";
import assert from "node:assert/strict";
import { parseBMS, events, longPairs } from "../src/bms.js";
import {
  remapClipboardRows,
  remapClipboardNotes,
} from "../src/clipboard-base.js";
import { captureNotes, putCaptured, eventId } from "../src/commands.js";
import { pasteMeasures } from "../src/edit.js";
test("BASE62 to BASE36 paste keeps distinct sounds and existing target references", () => {
  const source = parseBMS(
    "#BASE 62\n#WAV0A a.wav\n#WAV0a b.ogg\n#WAVzz c.wav\n#00011:0A0azz",
  );
  const target = parseBMS("#WAV0A existing.wav\n#00111:0A");
  const notes = captureNotes(source, new Set(events(source).map(eventId)));
  putCaptured(target, remapClipboardNotes(target, source, notes), {
    copy: true,
  });
  assert.deepEqual(
    events(target).map((e) => target.resources.WAV[e.value]),
    ["a.wav", "b.ogg", "c.wav", "existing.wav"],
  );
});
test("cross-base LNOBJ conversion preserves hold and numeric resources", () => {
  const source = parseBMS(
    "#BASE 62\n#LNOBJ zz\n#WAV0a a.wav\n#BPMzz 180\n#STOPzz 48\n#00011:0azz\n#00008:zz\n#00009:zz",
  );
  const target = parseBMS("#WAVZZ existing.wav\n#00111:ZZ");
  pasteMeasures(target, remapClipboardRows(target, source, source.rows), 0);
  assert.equal(longPairs(target).pairs.length, 1);
  assert.notEqual(target.headers.LNOBJ, "ZZ");
  assert.equal(
    target.resources.BPM[events(target).find((e) => e.channel === "08").value],
    "180",
  );
  assert.equal(target.resources.WAV.ZZ, "existing.wav");
});
