import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS, events, longPairs } from "../src/bms.js";
import { changeMeasureRatio } from "../src/measure-edit.js";
const fixture = () => parseBMS("#00011:00010001\n#00112:01");
test("absolute beat mode leaves time positions unchanged", () => {
  const c = fixture(),
    beats = events(c).map((e) => e.beat);
  changeMeasureRatio(c, 0, 0.5, "absolute");
  assert.deepEqual(
    events(c).map((e) => e.beat),
    beats,
  );
});
test("measure mode shifts following measure but keeps local offset", () => {
  const c = fixture();
  changeMeasureRatio(c, 0, 0.5, "measure");
  assert.deepEqual(
    events(c).map((e) => e.beat),
    [1, 2, 3],
  );
});
test("cut mode deletes overflow and shifts following measure", () => {
  const c = fixture();
  changeMeasureRatio(c, 0, 0.5, "cut", { nt: false });
  assert.deepEqual(
    events(c).map((e) => e.beat),
    [1, 2],
  );
});
test("scale mode scales within measure and shifts following measure", () => {
  const c = fixture();
  changeMeasureRatio(c, 0, 0.5, "scale");
  assert.deepEqual(
    events(c).map((e) => e.beat),
    [0.5, 1.5, 2],
  );
});
test("NT cut shortens a long note to one upstream unit before measure end", () => {
  const c = parseBMS("#00051:01000001");
  changeMeasureRatio(c, 0, 0.5, "cut", { nt: true });
  const pair = longPairs(c).pairs[0];
  assert.equal(pair[0].beat, 0);
  assert.ok(Math.abs(pair[1].beat - (2 - 1 / 48)) < 1e-10);
});

test("NT cut removes holds wholly in the trimmed range and retains cross-measure suffix", () => {
  const wholly = parseBMS("#00051:00000101");
  changeMeasureRatio(wholly, 0, 0.5, "cut", { nt: true });
  assert.equal(events(wholly).length, 0);
  const crossing = parseBMS("#00051:00000001\n#00151:0001");
  changeMeasureRatio(crossing, 0, 0.5, "cut", { nt: true });
  assert.deepEqual(
    longPairs(crossing).pairs[0].map((e) => e.beat),
    [2, 4],
  );
});
test("NT cut ending exactly at old measure boundary collapses to one regular note", () => {
  const c = parseBMS("#00051:00000001\n#00151:01");
  changeMeasureRatio(c, 0, 0.5, "cut", { nt: true });
  assert.deepEqual(
    events(c).map((e) => [e.beat, e.channel, e.value]),
    [[2, "11", "01"]],
  );
  assert.equal(longPairs(c).pairs.length, 0);
});
test("NT scaling keeps both outside portions of a hold and scales only the affected measure", () => {
  const c = parseBMS("#00051:0001\n#00251:0001");
  changeMeasureRatio(c, 1, 0.5, "scale", { nt: true });
  assert.deepEqual(
    longPairs(c).pairs[0].map((e) => e.beat),
    [2, 8],
  );
});

test("multiple measure lengths apply in original ascending order, keeping other measures aligned", async () => {
  const { changeMeasureRatios } = await import("../src/measure-edit.js");
  const c = parseBMS("#00011:01\n#00111:01\n#00211:01");
  changeMeasureRatios(c, [1, 0], 0.5, "measure");
  assert.deepEqual(
    events(c).map((n) => n.beat),
    [0, 2, 4],
  );
  assert.equal(c.ratios[0], 0.5);
  assert.equal(c.ratios[1], 0.5);
});
test("failed batch length change leaves the entire chart unchanged", async () => {
  const { changeMeasureRatios } = await import("../src/measure-edit.js");
  const c = parseBMS("#99911:0001"),
    before = structuredClone(c);
  assert.throws(() => changeMeasureRatios(c, [0, 1], 0.1, "absolute"));
  assert.deepEqual(c, before);
});

test("measure labels tolerate non-simple decimal lengths without interrupting refresh", async () => {
  const {measureLabel} = await import("../src/measure-edit.js");
  assert.doesNotThrow(() => measureLabel(2, Math.PI));
  assert.equal(measureLabel(2, 1), "002: 1 ( 4 / 4 )");
});
