import { test } from "node:test";
import assert from "node:assert/strict";
import { readProject, writeProject } from "../src/project.js";
import { parseBMS, events } from "../src/bms.js";
import { numericValue, eventColumn } from "../src/columns.js";
const semantic = (c) =>
  events(c).map((e) => ({
    beat: e.beat,
    col: eventColumn(c, e),
    value: numericValue(c, e),
    long: /^[5-8]/.test(e.channel),
    hidden: /^[3478]/.test(e.channel),
  }));
test("iBMSC binary roundtrip preserves UTF16 headers, BGM columns, LN, timing and ratios", () => {
  const c = parseBMS(
    "#TITLE 测试🎵\n#BPM 120\n#PLAYER 3\n#WAV01 音源.wav\n#BPM01 145.5\n#STOP01 48\n#00302:0.75\n#00001:01\n#00001:0001\n#00151:01\n#00251:01\n#00331:01\n#00408:01\n#00509:01",
  );
  const bytes = writeProject(c),
    d = readProject(bytes);
  assert.equal(d.headers.TITLE, c.headers.TITLE);
  assert.equal(d.headers.PLAYER, "3");
  assert.deepEqual(d.ratios, c.ratios);
  assert.deepEqual(semantic(d), semantic(c));
  assert.deepEqual(d.resources.WAV, c.resources.WAV);
});
test("project decoder rejects truncation and unknown format", () => {
  const b = writeProject(parseBMS(""));
  assert.throws(() => readProject(b.slice(0, 20)));
  assert.throws(() => readProject(new Uint8Array(20)));
});

test("exported undo slots contain upstream NoOperation commands, never null chains", () => {
  const bytes = writeProject(parseBMS(""));
  const footer = bytes.slice(-1800);
  const view = new DataView(
    footer.buffer,
    footer.byteOffset,
    footer.byteLength,
  );
  for (let i = 0; i < 200; i++) {
    assert.equal(view.getInt32(i * 9, true), 1);
    assert.equal(view.getInt32(i * 9 + 4, true), 1);
    assert.equal(view.getUint8(i * 9 + 8), 255);
  }
});
