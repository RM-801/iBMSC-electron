import { test } from "node:test";
import assert from "node:assert/strict";
import { importSM, smDifficulties } from "../src/sm.js";
import { events, longPairs } from "../src/bms.js";
const fixture =
  "#TITLE:Test;\n#BPMS:0=120,4=150.5;\n#NOTES:dance-single:author:Hard:7:0,0,0,0,0:\n2000\n0000\n3000\n0001;";
test("SM import matches upstream A1-A4 mapping and long-note endpoints", () => {
  const c = importSM(fixture);
  assert.equal(smDifficulties(fixture)[0].name, "Hard");
  assert.equal(c.headers.PLAYLEVEL, "7");
  assert.deepEqual(
    events(c).map((e) => e.channel),
    ["56", "56", "13", "08"],
  );
  assert.equal(longPairs(c).pairs.length, 1);
});
test("unsupported SM column modes fail instead of mis-mapping", () =>
  assert.throws(() =>
    importSM(fixture.replace("dance-single", "dance-double")),
  ));
