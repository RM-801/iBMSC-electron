import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { menuTemplate, nativeViewState } = createRequire(import.meta.url)("../electron/menu.cjs");
test("macOS menus dispatch editor commands once and preserve recent paths", () => {
  const calls = [];
  const filename = "/scores/中文 song.bms";
  const menu = menuTemplate((...args) => calls.push(args), [filename]);
  assert.deepEqual(
    menu.map((x) => x.label),
    ["iBMSC", "文件", "编辑", "视图", "选项", "转换", "预览", "窗口"],
  );
  const edit = menu.find((entry) => entry.label === "编辑").submenu;
  const options = menu.find((entry) => entry.label === "选项").submenu;
  const check = edit[edit.findIndex((entry) => entry.label === "统计…") + 1];
  assert.equal(check.label, "错误检查");
  assert.notEqual(check.type, "checkbox");
  assert.equal(
    options.some((entry) => entry.label === "错误检查"),
    false,
  );
  assert.equal(
    edit.some((entry) => entry.label === "音符输入设置…"),
    false,
  );
  assert.equal(
    options.some((entry) => entry.label === "音符输入设置…"),
    true,
  );
  const visit = entries => entries.flatMap(entry => [entry, ...visit(entry.submenu || [])]);
  const items = visit(menu);
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
  assert.equal(
    menuTemplate(() => {})[1].submenu.find((x) => x.label === "最近打开")
      .submenu[0].enabled,
    false,
  );
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
    "inputsettings",
    "myo2",
    "importsm",
    "importibmsc",
    "convert-togglelong",
    "convert-togglehidden",
    "themesettings",
    "generalsettings",
    "fileoptions",
    "tool-time",
    "toggleln",
    "toggle-options",
    "convert-long",
    "convert-value",
    "convert-mirror",
    "play",
    "playhere",
    "stop",
  ]) {
    calls.length = 0;
    items.filter((x) => x.click).forEach((x) => x.click());
    assert.equal(calls.filter((x) => x[0] === action).length, 1, action);
  }
  assert.equal(
    calls.some(([action]) =>
      /playersettings|external|errorhighlight/.test(action),
    ),
    false,
  );
  calls.length = 0;
  for (const [accelerator, action] of [
    ["F5", "play"],
    ["F6", "playhere"],
    ["F7", "stop"],
  ]) {
    items.find((item) => item.accelerator === accelerator).click();
    assert.deepEqual(calls.at(-1), [action]);
  }
  assert.equal(
    items.some((item) =>
      /播放器设置|外部播放器|uBMplay|o2play/i.test(item.label || ""),
    ),
    false,
  );
});

test("native View exposes every renderer checkbox except the system menu bar", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const viewHtml = html.slice(html.indexOf('id="viewmenu"'), html.indexOf('id="languagepopover"'));
  const inputs = [...viewHtml.matchAll(/<input\b[^>]*>/g)]
    .map(([tag]) => ({ id: tag.match(/id="([^"]+)"/)?.[1], checkbox: /type="checkbox"/.test(tag), checked: /\bchecked\b/.test(tag) }))
    .filter(input => input.checkbox && input.id !== "show-menu");
  const visit = entries => entries.flatMap(entry => [entry, ...visit(entry.submenu || [])]);
  for (const invert of [false, true]) {
    const view = Object.fromEntries(inputs.map(input => [input.id, invert ? !input.checked : input.checked]));
    const calls = [];
    const items = visit(menuTemplate((...args) => calls.push(args), [], { view }).find(item => item.label === "视图").submenu);
    const checks = items.filter(item => item.type === "checkbox");
    assert.equal(checks.length, inputs.length);
    for (const item of checks) {
      item.click();
      const id = calls.at(-1)[0].slice(5);
      assert.equal(item.checked, view[id], id);
    }
    assert.deepEqual(calls.map(([action]) => action).sort(), inputs.map(({ id }) => "view:" + id).sort());
    items.find(item => item.accelerator === "F10").click();
    assert.deepEqual(calls.at(-1), ["view-toggle"]);
  }
});

test("native view state accepts booleans only and preserves unchecked controls", () => {
  const state = nativeViewState({ "show-toolbar": false, "show-options": "false", showbga: true, unknown: true });
  assert.equal(state["show-toolbar"], false);
  assert.equal(state["show-options"], true);
  assert.equal(state.showbga, true);
  assert.equal(Object.hasOwn(state, "unknown"), false);
  assert.deepEqual(nativeViewState(null), nativeViewState());
});
