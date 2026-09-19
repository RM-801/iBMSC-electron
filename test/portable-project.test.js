import test from "node:test";
import assert from "node:assert/strict";
import { parseBMS, events, longPairs } from "../src/bms.js";
import {
  readPortableProject,
  writePortableProject,
} from "../src/portable-project.js";
import { originalColumns, writeColumn } from "../src/columns.js";
import { copyMeasures } from "../src/edit.js";
import { createRequire } from "node:module";
const { saveBytes } = createRequire(import.meta.url)(
  "../electron/save-data.cjs",
);
test("portable project round trip preserves BASE62, BGM LN, header and variable measures", () => {
  const c = parseBMS(
    "#BASE 62\n#WAV0a key.ogg\n#WAVAA other.wav\n#TITLE 测试\n#00102:0.75\n#00011:AA",
  );
  const col = originalColumns({ bgm: 1 }).find((c) => c.channel === "01");
  writeColumn(c, col, 0, 0, 1, "0a", { long: true });
  writeColumn(c, col, 1, 0, 1, "0a", { long: true });
  const text = writePortableProject(c),
    restored = readPortableProject(text);
  assert.deepEqual(restored, c);
  assert.equal(longPairs(restored).pairs.length, 1);
  assert.equal(
    saveBytes({ format: "ibmscx", text, encoding: "gbk" }).toString("utf8"),
    text,
  );
  const rows = copyMeasures(c, 0, 1, ["01"]);
  rows[0].longCells["0"] = false;
  assert.equal(c.rows.find((r) => r.channel === "01").longCells[0], true);
});
test("portable project rejects malformed versions, positions and labels", () => {
  const chart = parseBMS("");
  assert.throws(() =>
    readPortableProject(
      JSON.stringify({ format: "ibmsc-node-project", version: 2, chart }),
    ),
  );
  chart.rows.push({ measure: 1000, channel: "11", cells: ["01"] });
  assert.throws(() => writePortableProject(chart));
  chart.rows[0].measure = 0;
  chart.rows[0].cells = ["<script>"];
  assert.throws(() => writePortableProject(chart));
});
