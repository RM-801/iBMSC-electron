import { test } from "node:test";
import assert from "node:assert/strict";
import { measureStarts, parseBMS } from "../src/bms.js";
import { positionStatus } from "../src/position-status.js";

test("status matches the original screenshot at measure 052", () => {
  const starts = measureStarts(parseBMS(""));
  assert.deepEqual(positionStatus(starts, 52 * 4 + 132 / 48), {
    measure: "052",
    grid: "11 / 16",
    reduced: "11 / 16",
    measurePosition: "132 / 192",
    absolute: "10116",
  });
});

test("grid resolution and reduced position are independent", () => {
  const starts = measureStarts(parseBMS(""));
  const half = positionStatus(starts, 2, 16);
  assert.equal(half.grid, "8 / 16");
  assert.equal(half.reduced, "1 / 2");
  assert.equal(positionStatus(starts, 2, 32).grid, "16 / 32");
  assert.equal(positionStatus(starts, 4).reduced, "0 / 1");
  assert.equal(positionStatus(starts, 4).measure, "001");
});

test("variable measures use actual lengths and accumulated starts", () => {
  const starts = measureStarts(parseBMS("#00002:0.75\n#00102:1.5"));
  assert.deepEqual(positionStatus(starts, 6), {
    measure: "001",
    grid: "12 / 24",
    reduced: "1 / 2",
    measurePosition: "144 / 288",
    absolute: "288",
  });
  assert.equal(positionStatus(starts, 9).measure, "002");
  assert.equal(positionStatus(starts, 9).absolute, "432");
});

test("fractional positions stay finite, and source GCD limit can be specified", () => {
  const starts = measureStarts(parseBMS(""));
  assert.equal(positionStatus(starts, 4 / 7, 7).grid, "1 / 7");
  assert.equal(positionStatus(starts, 4 / 7, 7).reduced, "1 / 7");
  assert.equal(positionStatus(starts, 1 / 96, 384, 0.5).reduced, "1 / 384");
  assert.equal(positionStatus(starts, -1), null);
  assert.equal(positionStatus(starts, starts.at(-1)), null);
});
