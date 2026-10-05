import test from "node:test";
import assert from "node:assert/strict";
import { parseBMS, events, putNote, timeline, longPairs } from "../src/bms.js";
import { constantBPM, checkMyO2Grid, adjustMyO2Grid } from "../src/myo2.js";
import { timeMap } from "../src/timing.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.0001, `${a} != ${b}`);
test("MyO2 constant BPM preserves event times and LN ends across tempo changes and STOP", () => {
  const c = parseBMS(
    "#BPM 120\n#BPM01 60\n#STOP01 48\n#00051:01\n#00108:01\n#00109:01\n#00251:01\n#00311:02\n#00101:03",
  );
  const before = JSON.stringify(c),
    d = constantBPM(c, 180);
  assert.equal(JSON.stringify(c), before);
  assert.equal(d.headers.BPM, "180");
  assert.equal(
    events(d).filter((e) => ["03", "08"].includes(e.channel)).length,
    0,
  );
  const a = timeline(c),
    b = timeline(d);
  assert.deepEqual(
    b.map((e) => e.value),
    a.map((e) => e.value),
  );
  b.forEach((e, i) => near(e.time, a[i].time));
  near(
    timeMap(c).beatToSeconds(longPairs(c).pairs[0][1].beat),
    timeMap(d).beatToSeconds(longPairs(d).pairs[0][1].beat),
  );
  assert.equal(longPairs(d).pairs.length, 1);
});
test("MyO2 reports grid and 64/48 deviations, applies selection without touching source", () => {
  const c = parseBMS("#BPM 120");
  putNote(c, 0, "11", 1, 96, "01");
  putNote(c, 1, "12", 1, 16, "02");
  const scan = checkMyO2Grid(c);
  assert.equal(scan.length, 1);
  assert.deepEqual(
    [scan[0].grid, scan[0].d64, scan[0].d48, scan[0].to64],
    [96, 1, 2, true],
  );
  near(events(adjustMyO2Grid(c, scan))[0].beat, 3 / 48);
  scan[0].to64 = false;
  near(events(adjustMyO2Grid(c, scan))[0].beat, 0); // CInt(0.5) = 0, upstream half-even.
  near(events(c)[0].beat, 2 / 48);
  assert.equal(checkMyO2Grid(adjustMyO2Grid(c, scan)).length, 0);
});
test("MyO2 grid adjustment preserves hidden notes, BGM columns and LN endpoints", () => {
  const c = parseBMS("#BPM 120\n#00002:0.5");
  putNote(c, 0, "71", 1, 48, "01");
  putNote(c, 1, "71", 1, 96, "01");
  c.rows.push({
    measure: 0,
    channel: "01",
    cells: ["00", "02", ...Array(46).fill("00")],
  });
  c.rows.push({
    measure: 0,
    channel: "01",
    cells: ["00", "03", ...Array(46).fill("00")],
  });
  const d = adjustMyO2Grid(c, checkMyO2Grid(c));
  assert.equal(events(d).length, 4);
  assert.equal(longPairs(d).pairs.length, 1);
  assert.equal(events(d).filter((e) => e.channel === "71").length, 2);
  assert.deepEqual(
    events(d)
      .filter((e) => e.channel === "01")
      .map((e) => e.value),
    ["02", "03"],
  );
  assert.deepEqual(d.ratios, c.ratios);
});
test("MyO2 refuses collisions, zero-length holds and out-of-range conversion atomically", () => {
  const c = parseBMS("#BPM 120");
  putNote(c, 0, "51", 1, 192, "01");
  putNote(c, 0, "51", 1, 96, "01");
  const scan = checkMyO2Grid(c);
  scan[0].to64 = false;
  const before = JSON.stringify(c);
  assert.throws(() => adjustMyO2Grid(c, scan), /归零/);
  assert.equal(JSON.stringify(c), before);
  assert.throws(() => constantBPM(c, 0));
  const far = parseBMS("#BPM 120\n#99911:01");
  assert.throws(() => constantBPM(far, 240), /999/);
});
