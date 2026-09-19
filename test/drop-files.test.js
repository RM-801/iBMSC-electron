import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDrop } from "../src/drop-files.js";
test("drop dispatch distinguishes one chart from multiple sounds without silently discarding files", () => {
  const chart = { name: "Hyper.BMS" },
    a = { name: "a.wav" },
    b = { name: "b.OGG" };
  assert.equal(classifyDrop([chart]).chart, chart);
  assert.deepEqual(classifyDrop([a, b]).sounds, [a, b]);
  assert.throws(() => classifyDrop([chart, { name: "another.bms" }]));
  assert.throws(() => classifyDrop([chart, a]));
  assert.throws(() => classifyDrop([{ name: "archive.rar" }]));
});
