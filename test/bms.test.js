import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBMS,
  serializeBMS,
  events,
  timeline,
  longPairs,
  putNote,
  decodeBMS,
} from "../src/bms.js";
test("round trip retains duplicate BGM, unknown channels, headers, comments and precise grids", () => {
  const text =
    "#TITLE テスト\n#BPM 120\n#WAVZZ a.wav\n#00001:ZZ00\n#00001:00ZZ\n#00302:0.75\n#003D1:000001\n#00111:000100\n#CUSTOM hello\n; comment";
  const a = parseBMS(text),
    b = parseBMS(serializeBMS(a));
  assert.deepEqual(events(a), events(b));
  assert.deepEqual(a.resources, b.resources);
  assert.deepEqual(a.ratios, b.ratios);
  assert.equal(b.headers.CUSTOM, "hello");
  assert.ok(serializeBMS(b).includes("; comment"));
});
test("fractional placement uses common denominator without moving existing notes", () => {
  const c = parseBMS("#BPM 120\n#00011:000100");
  putNote(c, 0, "11", 1, 16, "ZZ");
  const e = events(c);
  assert.equal(e.length, 2);
  assert.equal(e[0].fraction, 1 / 16);
  assert.equal(e[1].fraction, 1 / 3);
  assert.deepEqual(events(parseBMS(serializeBMS(c))), e);
});
test("variable measures, hexadecimal BPM, extended BPM and STOP timeline", () => {
  const c = parseBMS(
    "#BPM 120\n#BPM01 60\n#STOP01 48\n#00002:0.5\n#00011:0101\n#00103:F0\n#00111:01\n#00208:01\n#00209:01\n#00211:0101",
  );
  assert.deepEqual(
    timeline(c).map((n) => n.time),
    [0, 0.5, 1, 2, 5],
  );
});
test("LNTYPE1 crosses measures and does not play release endpoint", () => {
  const c = parseBMS("#BPM 120\n#00051:01\n#00151:01");
  assert.equal(longPairs(c).pairs.length, 1);
  assert.equal(timeline(c).length, 1);
});
test("LNOBJ pairs nearest prior note and excludes end sound", () => {
  const c = parseBMS("#BPM 120\n#LNOBJ ZZ\n#00011:0102ZZ00");
  assert.equal(longPairs(c).pairs[0][0].value, "02");
  assert.equal(timeline(c).length, 2);
});
test("reject unsupported branches and invalid timing rather than corrupt charts", () => {
  for (const text of [
    "#IF 1",
    "#BPM 0",
    "#00002:-1",
    "#00011:001",
    "#BASE 64",
    "#LNTYPE 2",
  ])
    assert.throws(() => parseBMS(text));
  assert.throws(() => timeline(parseBMS("#00008:01")));
});
test("UTF8 and Shift-JIS decode", () => {
  assert.equal(decodeBMS(new TextEncoder().encode("日本語")), "日本語");
  assert.equal(decodeBMS(Uint8Array.from([0x82, 0xa0])), "あ");
});
test("editing invalid values is refused", () => {
  const c = parseBMS("");
  assert.throws(() => putNote(c, 1000, "11", 0, 16, "01"));
  assert.throws(() => putNote(c, 0, "11", 0, 16, "00"));
});
