import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS } from "../src/bms.js";
import { timeMap, waveformPeaks, calculateBPM } from "../src/timing.js";
test("playhead pauses through STOP and resumes at changed BPM", () => {
  const c = parseBMS("#BPM 120\n#BPM01 60\n#STOP01 48\n#00108:01\n#00109:01");
  const map = timeMap(c);
  assert.equal(map.beatToSeconds(4), 2);
  assert.equal(map.secondsToBeat(2.5), 4);
  assert.equal(map.secondsToBeat(3.5), 4.5);
  assert.equal(map.beatToSeconds(5), 4);
});
test("waveform reduction retains extrema and BPM calculation is bounded", () => {
  assert.deepEqual(waveformPeaks(Float32Array.from([-0.5, 0.25, -1, 1]), 2), [
    [-0.5, 0.25],
    [-1, 1],
  ]);
  assert.equal(calculateBPM(4, 2), 120);
  assert.throws(() => calculateBPM(4, 0));
});
