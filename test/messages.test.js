import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { messageCatalog, formatMessage } from "../src/messages.js";
import { createTranslator, createLocalization } from "../src/localization.js";
import { parseBMS, putNote } from "../src/bms.js";
import { readProject } from "../src/project.js";
import { diagnose } from "../src/diagnostics.js";
import {
  createThemeDraft,
  validateTheme,
  argbToParts,
  partsToARGB,
} from "../src/theme-editor.js";
import {
  createFindCriteria,
  validateFindCriteria,
  applyFindOperation,
} from "../src/find-replace.js";
import save from "../electron/save-data.cjs";

const languages = ["jpn", "eng", "kor"];
const capture = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.message;
  }
  throw Error("Expected operation to fail");
};
test("authored errors and messages have complete translations with matching parameters", async () => {
  for (const entry of messageCatalog) {
    const slots = (text) =>
      [...text.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();
    for (const language of languages) {
      assert.ok(entry[language], `${entry.source}: ${language}`);
      assert.deepEqual(
        slots(entry[language]),
        slots(entry.source),
        `${entry.source}: ${language}`,
      );
    }
    for (const index of entry.causes || [])
      assert.ok(slots(entry.source).includes(`{${index}}`));
  }
  // Ensure future static domain errors cannot silently fall back to Chinese.
  for (const dir of ["src", "electron"])
    for (const filename of await readdir(
      new URL(`../${dir}/`, import.meta.url),
    )) {
      if (
        !/\.(?:js|cjs)$/.test(filename) ||
        /messages|locales|translations/.test(filename)
      )
        continue;
      const code = await readFile(
        new URL(`../${dir}/${filename}`, import.meta.url),
        "utf8",
      );
      for (const match of code.matchAll(
        /(?:throw\s+(?:new\s+)?Error|reject\(Error)\(\s*"([^"\n]+)"\s*\)/g,
      )) {
        if (!/[\u4e00-\u9fff]/.test(match[1])) continue;
        for (const language of ["eng", "kor"])
          assert.doesNotMatch(
            createTranslator(language)(match[1]),
            /[\u4e00-\u9fff]/,
            `${dir}/${filename}: ${match[1]}`,
          );
      }
    }
});

test("real parser, editing, project, encoding and diagnostic failures render in each language", () => {
  const chart = parseBMS("#BPM 120\n#00011:01");
  const messages = [
    capture(() => parseBMS("#BPM 0")),
    capture(() => putNote(chart, 0, "11", 0, 1, "02")),
    capture(() => readProject(new Uint8Array([1, 2]))),
    capture(() =>
      save.saveBytes({
        format: "bms",
        text: "#TITLE 看上她",
        encoding: "shift_jis",
      }),
    ),
    ...diagnose(chart).map((issue) => issue.message),
  ];
  for (const source of messages)
    for (const language of languages) {
      const translated = createTranslator(language)(source);
      assert.notEqual(translated, source, `${source}: ${language}`);
      assert.equal(translated.includes("{0}"), false);
    }
  assert.equal(
    chart.rows[0].cells[0],
    "01",
    "failed editing must preserve the original note",
  );
  assert.equal(
    save
      .saveBytes({ format: "bms", text: "#TITLE 看上她", encoding: "utf8" })
      .toString(),
    "#TITLE 看上她",
  );
});

test("dynamic parameters, unknown OS details and nested Electron errors retain their original data", () => {
  const path = "C:\\曲名 {1}\\保存 & <test>\n.wav";
  for (const language of languages) {
    const t = createTranslator(language);
    assert.ok(t("已保存 {0}", path).includes(path));
    assert.ok(t("不支持拖入的文件：" + path).includes(path));
    assert.ok(t("无效的通道数据：#00011:💿").includes("#00011:💿"));
    const encoding = t(
      "Error invoking remote method 'file:save': Error: Shift-JIS 无法保存字符“她”，请改用 UTF-8",
    );
    assert.ok(encoding.includes("她"));
    assert.ok(encoding.includes("Shift-JIS"));
    assert.ok(encoding.includes("UTF-8"));
    assert.equal(encoding.includes("无法保存字符"), false);
    const nested = t(
      "自动保存失败：{0}",
      "Error invoking remote method 'recovery:save': Error: 自动保存数据无效",
    );
    assert.equal(nested.includes("数据无效"), false);
    const native = "EACCES: permission denied, open '" + path + "'";
    assert.equal(t(native), native);
    assert.ok(t("音源关联失败：{0}", native).includes(native));
    assert.equal(
      formatMessage("无效的通道数据：" + path, "chs"),
      "无效的通道数据：" + path,
    );
  }
});

test("theme validation feedback translates real invalid values without modifying the draft", () => {
  const invalidWidth = createThemeDraft();
  invalidWidth.columns[4].Width = "1000";
  const hiddenLanes = createThemeDraft();
  hiddenLanes.columns.forEach((column) => {
    column.Width = "0";
  });
  const malformedVisual = createThemeDraft();
  malformedVisual.visual = [];
  const before = structuredClone([invalidWidth, hiddenLanes, malformedVisual]);
  const sources = [
    capture(() => validateTheme(invalidWidth)),
    capture(() => validateTheme(hiddenLanes)),
    capture(() => validateTheme(malformedVisual)),
    capture(() => argbToParts(4294967296)),
    capture(() => partsToARGB("#gg0000", 255)),
    capture(() => partsToARGB("#112233", 256)),
  ];
  for (const source of sources)
    for (const language of languages) {
      const translated = createTranslator(language)(source);
      assert.notEqual(translated, source, `${language}: ${source}`);
      if (language !== "jpn")
        assert.doesNotMatch(translated, /[\u4e00-\u9fff]/);
    }
  assert.deepEqual([invalidWidth, hiddenLanes, malformedVisual], before);
});

test("find validation failures translate in every language and preserve the chart", () => {
  const chart = parseBMS("#BASE 16\n#BPM 120\n#00011:01"),
    before = structuredClone(chart);
  const sources = [
    capture(() => createFindCriteria(chart, 0)),
    capture(() => validateFindCriteria(chart, { labelFrom: "GG" })),
    capture(() =>
      validateFindCriteria(chart, { labelFrom: "02", labelTo: "01" }),
    ),
    capture(() => validateFindCriteria(chart, { valueFrom: 0.00001 })),
    capture(() => validateFindCriteria(chart, { valueFrom: 2, valueTo: 1 })),
    capture(() => validateFindCriteria(chart, { columns: [3] })),
    capture(() => validateFindCriteria(chart, { selected: "yes" })),
    capture(() => applyFindOperation(chart, {}, "unknown")),
    capture(() =>
      applyFindOperation(chart, {}, "replace-label", { value: "GG" }),
    ),
  ];
  for (const source of sources)
    for (const language of languages) {
      const translated = createTranslator(language)(source);
      assert.notEqual(translated, source, `${language}: ${source}`);
      if (language !== "jpn")
        assert.doesNotMatch(translated, /[\u4e00-\u9fff]/);
    }
  assert.deepEqual(chart, before);
});

test("visible error lists and copied feedback switch language without translating file names", () => {
  const ui = createLocalization(),
    list = {},
    status = {},
    dialog = {};
  const prefix = "音源不在已打开的谱面目录中.wav：";
  ui.rows(list, [
    { prefix, source: "音源不在已打开的谱面目录中" },
    { prefix: "#012 51 01：", source: "长音符端点未配对" },
  ]);
  ui.text(status, "自动保存失败：{0}", "自动保存数据无效");
  ui.copyText(dialog, status);
  for (const language of ["jpn", "eng", "kor", "chs"]) {
    ui.setLanguage(language);
    const t = createTranslator(language);
    assert.equal(
      list.textContent,
      prefix +
        t("音源不在已打开的谱面目录中") +
        "\n#012 51 01：" +
        t("长音符端点未配对"),
    );
    assert.equal(
      dialog.textContent,
      t("自动保存失败：{0}", "自动保存数据无效"),
    );
  }
  ui.raw(list, "");
  ui.setLanguage("eng");
  assert.equal(list.textContent, "");
});
