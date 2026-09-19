import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS } from "../src/bms.js";
import { renderIndex } from "../src/render-index.js";
test("render index returns only visible notes while retaining long notes crossing viewport", () => {
  const c = parseBMS(
    "#00011:01\n#01011:01\n#99911:01\n#00051:01\n#02051:01\n#00001:01\n#00001:02",
  );
  const index = renderIndex(c);
  assert.equal(index.visible(39, 41).length, 1);
  assert.equal(index.visiblePairs(39, 41).length, 1);
  assert.equal(index.visible(3995, 3997)[0].measure, 999);
  assert.deepEqual(
    index.all.filter((e) => e.channel === "01").map(index.column),
    [26, 27],
  );
});
