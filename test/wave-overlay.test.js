import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS } from "../src/bms.js";
import { waveformClock, waveformSample } from "../src/wave-overlay.js";
test("overlay follows original BPM-only clock, including BPM changes before its origin", () => {
  const c = parseBMS("#BPM 120\n#BPM01 240\n#STOP01 48\n#00108:01\n#00109:01");
  const clock = waveformClock(c);
  assert.equal(clock(4), 2);
  assert.equal(clock(6) - clock(4), 0.5);
  assert.equal(clock(2) - clock(4), -1);
});
test("waveform samples outside loaded audio draw the center line", () => {
  const samples = new Float32Array([0.5, -0.5, 1]);
  assert.equal(waveformSample(samples, 2, 0.5), -0.5);
  assert.equal(waveformSample(samples, 2, -0.1), 0);
  assert.equal(waveformSample(samples, 2, 1.5), 0);
});
