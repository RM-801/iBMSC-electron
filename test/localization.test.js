import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createLocalization, createTranslator } from "../src/localization.js";
import { uiTranslations } from "../src/ui-translations.js";
import {
  themeEditorLabels,
  visualColors,
  themeFonts,
  themeNumbers,
} from "../src/theme-editor-fields.js";
import { createThemeDraft } from "../src/theme-editor.js";
import { createThemeEditor } from "../src/theme-editor-ui.js";
import {
  createFindReplace,
  findReplaceLabels,
} from "../src/find-replace-ui.js";
const { menuTemplate } = createRequire(import.meta.url)("../electron/menu.cjs");

test("all static UI labels, hints and accessibility text have non-Chinese translations", async () => {
  const html = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const sources = [...html.matchAll(/>([^<>]+)</g)]
    .map((m) => m[1])
    .concat(
      [...html.matchAll(/(?:title|aria-label|placeholder)="([^"]+)"/g)].map(
        (m) => m[1],
      ),
    )
    .concat(themeEditorLabels, findReplaceLabels);
  for (const language of ["eng", "kor"]) {
    const t = createTranslator(language);
    for (const source of sources)
      assert.doesNotMatch(
        t(source),
        /[\u4e00-\u9fff]/,
        `${language}: ${source}`,
      );
  }
  for (const [source, translations] of Object.entries(uiTranslations)) {
    for (const language of ["jpn", "eng", "kor"]) {
      assert.ok(translations[language], `${language}: ${source}`);
      assert.deepEqual(
        [...translations[language].matchAll(/\{\d+\}/g)]
          .map((m) => m[0])
          .sort(),
        [...source.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort(),
        `${language}: placeholders in ${source}`,
      );
    }
  }
});

test("custom theme controls switch language without changing column titles or font names", () => {
  const document = {
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        ownerDocument: document,
        childNodes: [],
        append(...children) {
          this.childNodes.push(...children);
        },
        setAttribute(name, value) {
          this[name] = value;
        },
      };
    },
  };
  const root = document.createElement("div"),
    preview = document.createElement("canvas");
  preview.getContext = () => null;
  const ui = createLocalization(),
    editor = createThemeEditor({ root, preview, ui });
  const draft = createThemeDraft();
  for (const [key] of visualColors) draft.visual[key] = { Value: "4278190080" };
  for (const [key] of themeFonts)
    draft.visual[key] = { Name: "标题", Size: "9", Style: "0" };
  for (const [key] of themeNumbers)
    draft.visual[key] = {
      Value: key === "kHeight" ? "10" : key === "kOpacity" ? "0.5" : "0",
    };
  editor.load(draft);
  const visit = (node) => [node, ...node.childNodes.flatMap(visit)];
  const nodes = visit(root),
    byId = (id) => nodes.find((node) => node.id === id);
  const title = byId("themeedit-column-Title"),
    font = byId("themeedit-kFont-Name");
  title.value = "主题列定义无效 {0} & <b>";
  title.oninput();
  font.value = "长音符";
  font.oninput();
  const option = byId("themeedit-column").childNodes[4];
  const before = editor.read();
  const colorsLegend = nodes.find(
    (node) => node.tagName === "LEGEND" && node.textContent === "颜色",
  );
  for (const language of ["jpn", "eng", "kor", "chs"]) {
    ui.setLanguage(language);
    assert.equal(colorsLegend.textContent, createTranslator(language)("颜色"));
    assert.equal(title.value, "主题列定义无效 {0} & <b>");
    assert.equal(font.value, "长音符");
    assert.equal(option.textContent, "04 · 主题列定义无效 {0} & <b>");
    assert.deepEqual(editor.read(), before);
  }
});

test("find controls translate while keeping custom lane names, criteria and replacement data intact", () => {
  const document = {
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        ownerDocument: document,
        childNodes: [],
        classList: { toggle() {} },
        append(...children) {
          this.childNodes.push(...children);
        },
        replaceChildren(...children) {
          this.childNodes = children;
        },
        setAttribute(name, value) {
          this[name] = value;
        },
      };
    },
  };
  const root = document.createElement("div"),
    ui = createLocalization(),
    calls = [];
  const find = createFindReplace({
    root,
    ui,
    onAction: (...args) => calls.push(args),
  });
  const laneTitle = "长音符 {0} & <b>";
  find.setColumns([{ id: 1 }, { id: 4, title: laneTitle }, { id: 26 }]);
  find.setBase(62);
  find.load({
    selected: false,
    measureFrom: 3,
    labelFrom: "aB",
    valueTo: 123.4567,
    columns: [4],
  });
  const visit = (node) => [node, ...node.childNodes.flatMap(visit)];
  const nodes = visit(root),
    byId = (id) => nodes.find((node) => node.id === id);
  byId("find-label-replacement").value = "Za";
  byId("find-value-replacement").value = "12.3456";
  const before = find.read(),
    status = document.createElement("p");
  ui.text(status, "已处理 {0} 个音符", 3);
  for (const language of ["jpn", "eng", "kor", "chs"]) {
    ui.setLanguage(language);
    const t = createTranslator(language);
    assert.equal(byId("find-selected").textContent, t("已选中"));
    assert.equal(byId("find-delete-selected").textContent, t("删除已选中"));
    assert.equal(byId("find-delete").textContent, t("按条件删除"));
    assert.equal(byId("find-label-replacement")["aria-label"], t("替换编号"));
    assert.equal(byId("find-label-from")["aria-label"], t("编号起点"));
    assert.equal(byId("find-column-4").textContent, laneTitle);
    assert.equal(byId("find-label-replacement").value, "Za");
    assert.equal(byId("find-value-replacement").value, "12.3456");
    assert.equal(byId("find-label-to").value, "zz");
    assert.deepEqual(find.read(), before);
    assert.equal(status.textContent, t("已处理 {0} 个音符", 3));
    byId("find-replace-label").onclick();
    assert.deepEqual(calls.at(-1), ["replace-label", before, "Za"]);
    byId("find-replace-value").onclick();
    assert.deepEqual(calls.at(-1), ["replace-value", before, "12.3456"]);
    byId("find-delete-selected").onclick();
    assert.deepEqual(calls.at(-1), ["delete-selected", before, undefined]);
    byId("find-delete").onclick();
    assert.deepEqual(calls.at(-1), ["delete", before, undefined]);
  }
});

test("translations preserve shortcuts, literal parameters and partial imported XML fallbacks", () => {
  assert.equal(createTranslator("eng")("另存为 (A)…"), "Save as (A)…");
  assert.equal(
    createTranslator("kor")("当前 {0}，切换输入方式（F8）", "NT"),
    "현재 NT: 입력 방식 전환(F8)",
  );
  assert.equal(
    createTranslator("jpn")("发现 {0} 项", 12),
    "12 件見つかりました",
  );
  const t = createTranslator("eng", { "Menu/File/SaveAs": "Custom save" });
  assert.equal(t("另存为 (A)…"), "Custom save (A)…");
  assert.equal(t("禁止纵向移动"), "Disable vertical movement");
  assert.equal(
    t("原文件值：{0}", "标题 {1} & <b>"),
    "Original value: 标题 {1} & <b>",
  );
});

function text(value) {
  return { nodeType: 3, nodeValue: value, isConnected: true };
}
function element(tag, children = [], attributes = {}) {
  const el = {
    tagName: tag.toUpperCase(),
    childNodes: children,
    isConnected: true,
  };
  const attrs = Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      { value, ownerElement: el },
    ]),
  );
  el.getAttribute = (key) => attrs[key]?.value;
  el.getAttributeNode = (key) => attrs[key];
  return el;
}

test("switching updates UI text nodes without replacing controls, chart data or counts", () => {
  const caption = text("禁止纵向移动"),
    input = element("input", [], { title: "标题" });
  input.checked = true;
  input.value = "禁止纵向移动";
  const count = text("1677"),
    button = element("button", [count], { title: "统计" });
  const editorText = text("#TITLE 标题\n#WAV01 保存.wav"),
    editor = element("textarea", [editorText]);
  const label = element("label", [input, caption]);
  const ui = createLocalization(element("body", [label, button, editor]));
  const filename = element("span");
  ui.text(filename, "尚未选择");
  ui.raw(filename, "默认");
  const message = element("p");
  ui.text(message, "发现 {0} 项", 3);
  for (const language of ["jpn", "kor", "eng", "chs"]) {
    ui.setLanguage(language);
    assert.equal(caption.nodeValue, createTranslator(language)("禁止纵向移动"));
    assert.equal(
      message.textContent,
      createTranslator(language)("发现 {0} 项", 3),
    );
    assert.equal(
      input.getAttribute("title"),
      createTranslator(language)("标题"),
    );
    assert.equal(label.childNodes[0], input);
    assert.equal(input.checked, true);
    assert.equal(input.value, "禁止纵向移动");
    assert.equal(count.nodeValue, "1677");
    assert.equal(editorText.nodeValue, "#TITLE 标题\n#WAV01 保存.wav");
    assert.equal(filename.textContent, "默认");
  }
  ui.setLanguage("eng");
  ui.text(message, "发现 {0} 项", 7);
  assert.equal(message.textContent, "Found 7 items");
  caption.isConnected = false;
  caption.nodeValue = "detached";
  ui.setLanguage("jpn");
  assert.equal(caption.nodeValue, "detached");
});

test("view menu aliases use original language XML keys and switch without altering visibility", () => {
  const labels = [
    ["视图", "Title"],
    ["显示 / 隐藏", "ToolTip"],
    ["菜单栏", "Menu"],
    ["工具栏", "ToolBar"],
    ["操作面板", "OptionsPanel"],
    ["状态栏", "StatusBar"],
    ["左分屏", "LSplit"],
    ["右分屏", "RSplit"],
    ["主网格", "Grid"],
    ["副网格", "Sub"],
    ["轨道背景", "BG"],
    ["小节编号", "MeasureIndex"],
    ["小节线", "MeasureLine"],
    ["垂直线", "Vertical"],
    ["列标题", "ColumnCaption"],
  ];
  const captions = labels.map(([source]) => text(source));
  const checkbox = element("input", [], { title: "显示 / 隐藏（F10）" });
  checkbox.checked = false;
  const menu = element("div", [...captions, checkbox]);
  menu.hidden = true;
  const ui = createLocalization(menu);
  const imported = Object.fromEntries(
    labels.map(([, key]) => ["SubMenu/ShowHide/" + key, "Custom " + key]),
  );
  for (const language of ["jpn", "eng", "kor", "chs"]) {
    ui.setLanguage(language);
    const t = createTranslator(language);
    for (let index = 0; index < labels.length; index++) {
      const [source] = labels[index];
      assert.equal(captions[index].nodeValue, t(source));
      if (language === "eng" || language === "kor")
        assert.doesNotMatch(captions[index].nodeValue, /[\u4e00-\u9fff]/);
      if (language === "jpn")
        assert.notEqual(captions[index].nodeValue, source);
    }
    assert.equal(checkbox.getAttribute("title"), t("显示 / 隐藏") + "（F10）");
    ui.setLanguage(language, imported);
    for (let index = 0; index < labels.length; index++)
      assert.equal(captions[index].nodeValue, "Custom " + labels[index][1]);
    assert.equal(checkbox.getAttribute("title"), "Custom ToolTip（F10）");
    assert.equal(checkbox.checked, false);
    assert.equal(menu.hidden, true);
    assert.equal(menu.childNodes.at(-1), checkbox);
  }
});

test("native menus translate all UI while preserving recent file paths and routing", () => {
  for (const language of ["jpn", "eng", "kor"]) {
    const calls = [],
      path = "/scores/文件/默认.bms";
    const menu = menuTemplate(
      (...args) => calls.push(args),
      [path],
      { nt: false },
      createTranslator(language),
    );
    const visit = (items) =>
      items.flatMap((item) => [item, ...visit(item.submenu || [])]);
    const items = visit(menu);
    const recent = items.find((item) => item.label === path);
    assert.ok(recent);
    recent.click();
    assert.deepEqual(calls, [["openRecent", path]]);
    if (language !== "jpn")
      for (const item of items)
        if (item.label !== path)
          assert.doesNotMatch(item.label || "", /[\u4e00-\u9fff]/);
    assert.equal(
      items.some((item) => /中国語のみ|Chinese only/i.test(item.label || "")),
      false,
    );
  }
});
