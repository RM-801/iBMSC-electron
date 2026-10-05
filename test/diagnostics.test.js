import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS, longPairs } from "../src/bms.js";
import { diagnose, statistics } from "../src/diagnostics.js";
import { createTranslator } from "../src/localization.js";

const insideMessage = "普通音符位于同轨长音符内部";
const chart = (text) => parseBMS(
  "#BPM 120\n#WAV01 hold.wav\n#WAV02 short.wav\n#WAV03 other.wav\n#WAV1W screenshot.wav\n" + text,
);
const interiors = (c) => diagnose(c).filter(({ message }) => message === insideMessage);
const id = (e) => `${e.row}:${e.index}`;

test("a regular A4 note inside an explicit long note is reported at its exact event position", () => {
  const c = chart("#00053:01000100\n#00013:001W0000");
  const before = structuredClone(c);
  const issues = diagnose(c);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].message, insideMessage);
  assert.deepEqual(issues[0].event, {
    row: 1, index: 1, value: "1W", channel: "13", measure: 0, fraction: 0.25, beat: 1,
  });
  for (const nt of [false, true])
    assert.ok(statistics(c, { nt }).errorEvents.includes(id(issues[0].event)));
  assert.deepEqual(c, before);
});

test("valid long-note releases are not errors, while separate notes at the endpoints retain overlap errors", () => {
  assert.deepEqual(diagnose(chart("#00051:01000100")), []);
  const c = chart("#00051:01000100\n#00011:02000200");
  assert.deepEqual(interiors(c), []);
  assert.deepEqual(diagnose(c).map(({ message }) => message), ["同轨同位置重叠", "同轨同位置重叠"]);
  assert.deepEqual(diagnose(c).map(({ event }) => event.beat), [0, 2]);
});

test("notes in other keys, the other player and BGM are independent of a playable long note", () => {
  const c = chart("#00051:01000100\n#00012:00020000\n#00021:00020000\n#00001:00020000");
  assert.deepEqual(diagnose(c), []);
});

test("hidden and visible notes share the physical playable lane for explicit long-note conflicts", () => {
  for (const [longChannel, shortChannel] of [["53", "33"], ["73", "13"], ["73", "33"], ["63", "43"], ["83", "23"]]) {
    const c = chart(`#000${longChannel}:01000100\n#000${shortChannel}:00020000`);
    assert.equal(interiors(c).length, 1);
    assert.equal(interiors(c)[0].event.channel, shortChannel);
    for (const nt of [false, true])
      assert.ok(statistics(c, { nt }).errorEvents.includes(id(interiors(c)[0].event)));
  }
  assert.deepEqual(diagnose(chart("#00053:01000100\n#00032:00020000")), []);
});

test("temporary BGM long notes check their own row ordinal without confusing separate BGM lanes", () => {
  const c = chart("#00001:01020100\n#00001:00030000");
  c.rows[0].longCells = { 0: true, 2: true };
  const issues = diagnose(c);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].message, insideMessage);
  assert.equal(id(issues[0].event), "0:1");
  for (const nt of [false, true])
    assert.ok(statistics(c, { nt }).errorEvents.includes("0:1"));
});

test("LNOBJ keeps its nearest prior head and permits hidden keysounds within the connection", () => {
  const c = chart("#LNOBJ ZZ\n#00011:0102ZZ00\n#00031:0000000300000000");
  assert.equal(longPairs(c).pairs[0][0].value, "02");
  assert.deepEqual(diagnose(c), []);
  const base62 = chart("#BASE 62\n#LNOBJ 0a\n#WAV0A upper.wav\n#WAV0b lower.wav\n#00011:0A0b0a00");
  assert.equal(longPairs(base62).pairs[0][0].value, "0b");
  assert.deepEqual(diagnose(base62), []);
});

test("LNOBJ heads and releases inside a separate explicit long note are still conflicts", () => {
  const c = chart("#LNOBJ ZZ\n#00051:01000001\n#00011:0002ZZ00");
  assert.equal(longPairs(c).pairs.length, 2);
  const issues = interiors(c);
  assert.deepEqual(issues.map(({ event }) => [event.value, event.beat]), [["02", 1], ["ZZ", 2]]);
  assert.ok(issues.every(({ event }) => event.channel === "11"));
});

test("the interval check crosses variable-length measures and reports all strictly interior notes", () => {
  const c = chart("#00002:0.5\n#00102:2\n#00051:0001\n#00251:01\n#00111:02000300\n#00311:02");
  const issues = interiors(c);
  assert.deepEqual(issues.map(({ event }) => [event.measure, event.fraction, event.beat]), [[1, 0, 2], [1, 0.5, 6]]);
  assert.deepEqual(longPairs(c).pairs[0].map((e) => e.beat), [1, 10]);
});

test("overlapping spans report each interior normal event once and unpaired endpoints do not invent spans", () => {
  const c = chart("#00051:01000100\n#00071:00010001\n#00011:0000000200000000");
  assert.equal(interiors(c).length, 1);
  assert.equal(interiors(c)[0].event.beat, 1.5);
  const unpaired = chart("#00051:01\n#00011:00020000");
  assert.deepEqual(interiors(unpaired), []);
  assert.deepEqual(diagnose(unpaired).map(({ message }) => message), ["长音符端点未配对"]);
});

test("the new diagnostic translates without changing event identity", () => {
  const issue = interiors(chart("#00051:01000100\n#00011:00020000"))[0];
  const before = structuredClone(issue);
  const expected = {
    jpn: "通常ノートが同じレーンのロングノート内にあります",
    eng: "A regular note is inside a long note in the same lane",
    kor: "같은 레인의 롱 노트 안에 일반 노트가 있습니다",
  };
  for (const [language, message] of Object.entries(expected))
    assert.equal(createTranslator(language)(issue.message), message);
  assert.deepEqual(issue, before);
});
