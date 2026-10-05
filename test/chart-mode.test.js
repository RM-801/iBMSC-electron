import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS, serializeBMS } from "../src/bms.js";
import {
  editorMode,
  initializeEditorMode,
  editorModeChoices,
  editorModeSelection,
  setEditorMode,
} from "../src/chart-mode.js";
import { History } from "../src/history.js";
import { readProject, writeProject } from "../src/project.js";
import {
  validateProjectChart,
  readPortableProject,
  writePortableProject,
} from "../src/portable-project.js";
import { createTranslator } from "../src/localization.js";

const modernChoices = [["SINGLE", "SINGLE"], ["DOUBLE", "DOUBLE"], ["PMS", "PMS"]];

test("initial mode inference preserves missing, legacy and unknown PLAYER headers", () => {
  for (const [player, mode] of [[undefined, "SINGLE"], ["1", "SINGLE"], ["2", "DOUBLE"], ["3", "DOUBLE"], ["4", "SINGLE"], ["7", "SINGLE"]]) {
    const chart = parseBMS(player === undefined ? "" : `#PLAYER ${player}`);
    const before = structuredClone(chart);
    assert.equal(editorMode(chart), mode);
    assert.deepEqual(chart, before, "reading a mode must not modify its document");
    assert.equal(initializeEditorMode(chart), chart);
    assert.equal(chart.editorMode, mode);
    assert.deepEqual(chart.headers, before.headers);
    assert.deepEqual(chart.rows, before.rows);
  }
});

test("explicit editor metadata wins over header inference and a PMS filename wins on initialization", () => {
  for (const mode of ["SINGLE", "DOUBLE", "PMS"]) {
    const chart = parseBMS("#PLAYER 2");
    chart.editorMode = mode;
    assert.equal(editorMode(chart), mode);
    initializeEditorMode(chart);
    assert.equal(chart.editorMode, mode);
    assert.equal(chart.headers.PLAYER, "2");
    initializeEditorMode(chart, { pms: true });
    assert.equal(chart.editorMode, "PMS");
    assert.equal(chart.headers.PLAYER, "2");
  }
  const invalidHint = parseBMS("#PLAYER 3");
  invalidHint.editorMode = "old-unknown-hint";
  assert.equal(editorMode(invalidHint), "DOUBLE");
  initializeEditorMode(invalidHint);
  assert.equal(invalidHint.editorMode, "DOUBLE");
});

test("new choices are modern modes; only the current imported Couple or Battle appears", () => {
  for (const player of [undefined, "1", "3", "7"]) {
    const chart = parseBMS(player === undefined ? "" : `#PLAYER ${player}`);
    assert.deepEqual(editorModeChoices(chart), modernChoices);
    assert.equal(editorModeSelection(chart), editorMode(chart));
  }
  for (const [player, key, label] of [["2", "legacy-couple", "Couple Play"], ["4", "legacy-battle", "Battle Play"]]) {
    const chart = initializeEditorMode(parseBMS(`#PLAYER ${player}`));
    assert.deepEqual(editorModeChoices(chart), [...modernChoices, [key, label]]);
    assert.equal(editorModeSelection(chart), key);
    initializeEditorMode(chart, { pms: true });
    assert.deepEqual(editorModeChoices(chart), modernChoices);
    assert.equal(editorModeSelection(chart), "PMS");
    assert.equal(chart.headers.PLAYER, player);
  }
  const changed = editorModeChoices(parseBMS("#PLAYER 2"));
  changed[0][0] = "corrupt";
  changed[3][0] = "corrupt";
  assert.deepEqual(editorModeChoices(parseBMS("#PLAYER 2")), [...modernChoices, ["legacy-couple", "Couple Play"]]);
});

test("explicit modern selection sets a compatible PLAYER without changing notes or other headers", () => {
  for (const [mode, player] of [["SINGLE", "1"], ["DOUBLE", "3"], ["PMS", "3"]]) {
    const chart = initializeEditorMode(parseBMS("#PLAYER 4\n#TITLE Legacy\n#00011:01\n#00022:02"));
    const rows = structuredClone(chart.rows);
    assert.equal(setEditorMode(chart, mode), chart);
    assert.equal(chart.editorMode, mode);
    assert.equal(chart.headers.PLAYER, player);
    assert.equal(chart.headers.TITLE, "Legacy");
    assert.deepEqual(chart.rows, rows);
    assert.equal(editorModeSelection(chart), mode);
    assert.deepEqual(editorModeChoices(chart), modernChoices);
  }
  for (const mode of ["legacy-couple", "legacy-battle", "single", "pms", "3", undefined, null]) {
    const chart = initializeEditorMode(parseBMS("#PLAYER 2"));
    const before = structuredClone(chart);
    assert.throws(() => setEditorMode(chart, mode), { message: "无效谱面类型" });
    assert.deepEqual(chart, before);
  }
});

test("PMS import preserves PLAYER until explicit selection exports PLAYER 3", () => {
  for (const player of [undefined, "1", "2", "3", "4", "7"]) {
    const chart = parseBMS(player === undefined ? "" : `#PLAYER ${player}`);
    const headers = structuredClone(chart.headers);
    initializeEditorMode(chart, { pms: true });
    assert.equal(editorModeSelection(chart), "PMS");
    assert.deepEqual(chart.headers, headers);
    setEditorMode(chart, "PMS");
    assert.equal(chart.headers.PLAYER, "3");
    for (const restored of [parseBMS(serializeBMS(chart)), readProject(writeProject(chart))]) {
      assert.equal(restored.headers.PLAYER, "3");
      assert.equal(editorMode(restored), "DOUBLE", "formats without editor metadata infer PLAYER 3 as DOUBLE");
      initializeEditorMode(restored, { pms: true });
      assert.equal(editorModeSelection(restored), "PMS");
      assert.equal(restored.headers.PLAYER, "3");
    }
  }
});

test("history restores both explicit PMS state and the original legacy PLAYER on undo and redo", () => {
  let chart = initializeEditorMode(parseBMS("#PLAYER 2\n#00011:01\n#00022:02"));
  const original = structuredClone(chart), history = new History(chart);
  setEditorMode(chart, "PMS");
  history.commit(original, chart);
  assert.equal(history.isDirty(chart), true);
  chart = history.undo(chart);
  assert.deepEqual(chart, original);
  assert.equal(editorModeSelection(chart), "legacy-couple");
  assert.equal(history.isDirty(chart), false);
  chart = history.redo(chart);
  assert.equal(editorModeSelection(chart), "PMS");
  assert.equal(chart.headers.PLAYER, "3");
  history.markSaved(chart);
  assert.equal(history.isDirty(chart), false);
});

test("portable projects and recovery JSON preserve explicit editor mode independently of PLAYER", () => {
  for (const mode of ["SINGLE", "DOUBLE", "PMS"]) {
    const chart = parseBMS("#PLAYER 4\n#00011:01\n#00022:02");
    chart.editorMode = mode;
    const restored = readPortableProject(writePortableProject(chart));
    assert.deepEqual(restored, chart);
    assert.equal(restored.editorMode, mode);
    assert.equal(restored.headers.PLAYER, "4");
    const recovery = JSON.stringify({ format: "ibmsc-recovery-v1", chart });
    const recovered = validateProjectChart(JSON.parse(recovery).chart);
    assert.equal(recovered.editorMode, mode);
    assert.equal(recovered.headers.PLAYER, "4");
  }
  const older = parseBMS("#PLAYER 2");
  const restored = readPortableProject(writePortableProject(older));
  assert.equal(restored.editorMode, undefined);
  assert.equal(editorMode(restored), "DOUBLE");
});

test("optional editor mode is validated on project export, import and recovery", () => {
  for (const mode of ["pms", "legacy-couple", "legacy-battle", 1, null, {}]) {
    const chart = parseBMS("");
    chart.editorMode = mode;
    assert.throws(() => validateProjectChart(chart), { message: "无效谱面类型" });
    assert.throws(() => writePortableProject(chart), { message: "无效谱面类型" });
    assert.throws(() => readPortableProject(JSON.stringify({ format: "ibmsc-node-project", version: 1, chart })), { message: "无效谱面类型" });
  }
  assert.doesNotThrow(() => validateProjectChart(parseBMS("")));
});

test("BMS and original IBMSC keep imported Couple and Battle PLAYER values unchanged", () => {
  for (const [player, mode, selected] of [["2", "DOUBLE", "legacy-couple"], ["4", "SINGLE", "legacy-battle"]]) {
    const chart = initializeEditorMode(parseBMS(`#PLAYER ${player}\n#00011:01\n#00021:02`));
    const before = structuredClone(chart);
    const bms = serializeBMS(chart);
    assert.doesNotMatch(bms, /editorMode|SINGLE|DOUBLE|PMS/);
    for (const restored of [parseBMS(bms), readProject(writeProject(chart))]) {
      assert.equal(restored.headers.PLAYER, player);
      assert.equal(editorMode(restored), mode);
      assert.equal(editorModeSelection(restored), selected);
    }
    assert.deepEqual(chart, before);
  }
});

test("invalid chart type has all three translated error messages", () => {
  for (const [language, expected] of [
    ["jpn", "譜面タイプが無効です"],
    ["eng", "Invalid chart type"],
    ["kor", "채보 유형이 올바르지 않습니다"],
  ]) assert.equal(createTranslator(language)("无效谱面类型"), expected);
});
