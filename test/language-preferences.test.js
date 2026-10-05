import test from "node:test";
import assert from "node:assert/strict";
import {
  detectLanguage,
  initialLanguagePreferences,
  resolveLanguagePreferences,
} from "../src/language-preferences.js";
import { createLocalization, createTranslator } from "../src/localization.js";

test("supported system language variants resolve in preference order", () => {
  for (const [tags, expected] of [
    [["en-US"], "eng"],
    [["EN_gb"], "eng"],
    [["zh-CN"], "chs"],
    [["zh-SG"], "chs"],
    [["zh-Hans-CN"], "chs"],
    [["zh"], "chs"],
    [["ja-JP"], "jpn"],
    [["ko-KR"], "kor"],
    [["fr-FR", "ja-JP", "en"], "jpn"],
    [["en-US", "zh-CN"], "eng"],
    [["zh-Hant-TW"], "eng"],
    [["de-DE"], "eng"],
    [[], "eng"],
    [[null, 12, "", "constructor"], "eng"],
  ])
    assert.equal(detectLanguage(tags), expected, JSON.stringify(tags));
});

test("saved manual language and imported translations take precedence over the system", () => {
  for (const id of ["eng", "chs", "jpn", "kor"]) {
    const saved = { id, values: { "Menu/File/Title": "Custom file" } };
    assert.deepEqual(
      resolveLanguagePreferences(JSON.stringify(saved), ["en-US"]),
      saved,
    );
  }
  for (const saved of [
    null,
    "{",
    "null",
    "{}",
    '{"id":"constructor"}',
    '{"id":"fra"}',
  ])
    assert.deepEqual(resolveLanguagePreferences(saved, ["ja-JP"]), {
      id: "jpn",
      values: null,
    });
  assert.deepEqual(
    resolveLanguagePreferences('{"id":"chs","values":[]}', ["en-US"]),
    { id: "chs", values: null },
  );
});

test("desktop system languages override Chromium language, with browser and English fallbacks", async () => {
  const navigator = { languages: ["en-US"], language: "en-US" };
  const desktop = { systemLanguages: async () => ["ko-KR"] };
  assert.equal(
    (await initialLanguagePreferences({ navigator, desktop })).id,
    "kor",
  );
  const storage = { getItem: () => '{"id":"chs"}' };
  assert.equal(
    (await initialLanguagePreferences({ storage, navigator, desktop })).id,
    "chs",
  );
  const blockedStorage = {
    getItem() {
      throw Error("blocked");
    },
  };
  const failedDesktop = {
    systemLanguages: async () => {
      throw Error("unavailable");
    },
  };
  assert.equal(
    (
      await initialLanguagePreferences({
        storage: blockedStorage,
        navigator: { language: "ja" },
        desktop: failedDesktop,
      })
    ).id,
    "jpn",
  );
  assert.equal(
    (
      await initialLanguagePreferences({
        navigator,
        desktop: { systemLanguages: async () => [] },
      })
    ).id,
    "eng",
  );
  assert.equal((await initialLanguagePreferences()).id, "eng");
});

test("localization defaults and invalid language choices fall back to English", () => {
  assert.equal(createTranslator()("保存"), "Save");
  assert.equal(createTranslator("unknown")("保存"), "Save");
  const ui = createLocalization();
  const label = {};
  ui.text(label, "保存");
  assert.equal(ui.language, "eng");
  assert.equal(label.textContent, "Save");
  ui.setLanguage("chs");
  assert.equal(label.textContent, "保存");
  ui.setLanguage("constructor");
  assert.equal(ui.language, "eng");
  assert.equal(label.textContent, "Save");
});
