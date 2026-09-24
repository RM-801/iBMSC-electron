import { test } from "node:test";
import assert from "node:assert/strict";
import { gridOffsets } from "../src/grid-lines.js";

test("accent divisions remain independent of snap divisions across changed measure lengths", () => {
  const grid = gridOffsets(3, 12), accent = gridOffsets(3, 16);
  assert.equal(grid.length, 9);
  assert.equal(accent.length, 12);
  assert.equal(accent[1], 0.25);
  assert.ok(!grid.includes(accent[1]));
  assert.ok(grid.at(-1) < 3 && accent.at(-1) < 3);
  assert.ok(gridOffsets(4, 65536).length <= 512);
});
