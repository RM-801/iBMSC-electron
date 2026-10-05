import { test } from "node:test";
import assert from "node:assert/strict";
import save from "../electron/save-data.cjs";
import { parseBMS } from "../src/bms.js";
import { writeProject, readProject } from "../src/project.js";
test("desktop saves an actual binary project and preserves Chinese BMS encodings", () => {
  const c = parseBMS("#TITLE 中文\n#BPM 120\n#00011:01");
  const bytes = save.saveBytes({ format: "ibmsc", bytes: writeProject(c) });
  assert.equal(readProject(bytes).headers.TITLE, "中文");
  assert.equal(
    save
      .saveBytes({ format: "bms", text: "#TITLE 中文", encoding: "utf8" })
      .toString(),
    "#TITLE 中文",
  );
  assert.throws(() =>
    save.saveBytes({ format: "ibmsc", bytes: new Uint8Array([1, 2]) }),
  );
  assert.throws(() => save.saveBytes({ text: "🎵", encoding: "shift_jis" }));
  const pms = "#PLAYER 1\n#00025:01";
  assert.equal(save.saveBytes({format: "pms", text: pms, encoding: "shift_jis"}).toString(), pms);
});


test("UTF-8 is the default; Shift-JIS cannot silently rename or replace 她", () => {
  const text = "#TITLE 看上她\r\n#ARTIST 黎明\r\n#00011:01\r\n";
  assert.equal(save.saveBytes({ format: "bms", text }).toString("utf8"), text);
  assert.throws(() => save.saveBytes({ format: "bms", text, encoding: "gbk" }), /不支持的保存编码/);
  assert.throws(() => save.saveBytes({ format: "bms", text, encoding: "shift_jis" }), /Shift-JIS.*她.*UTF-8/);
});
