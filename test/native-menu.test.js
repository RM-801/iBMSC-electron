import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { menuTemplate } = createRequire(import.meta.url)("../electron/menu.cjs");
test("macOS menus dispatch editor commands once and preserve recent paths", () => {
  const calls = [];
  const filename = "/scores/中文 song.bms";
  const menu = menuTemplate((...args) => calls.push(args), [filename]);
  assert.deepEqual(
    menu.map((x) => x.label),
    ["iBMSC", "文件", "编辑", "选项", "转换", "预览", "窗口"],
  );
  const items = menu.flatMap((x) => x.submenu);
  const accelerators = items.map((x) => x.accelerator).filter(Boolean);
  assert.equal(new Set(accelerators).size, accelerators.length);
  items.find((x) => x.label === "粘贴").click();
  items.find((x) => x.label === "另存为…").click();
  items.find((x) => x.label === "最近打开").submenu[0].click();
  assert.deepEqual(calls, [
    ["pastenotes"],
    ["saveas"],
    ["openRecent", filename],
  ]);
  assert.equal(menuTemplate(() => {})[1].submenu[2].submenu[0].enabled, false);
  for (const action of [
    "new",
    "open",
    "save",
    "saveas",
    "projectexport",
    "recover",
    "undo",
    "redo",
    "cutnotes",
    "copynotes",
    "pastenotes",
    "deletenotes",
    "selectall",
    "findopen",
    "statistics",
    "errorcheck",
    "themeimport",
    "toggle-options",
    "convertnotes",
    "play",
    "playhere",
    "stop",
  ]) {
    calls.length = 0;
    items.filter((x) => x.click).forEach((x) => x.click());
    assert.equal(calls.filter((x) => x[0] === action).length, 1, action);
  }
});
