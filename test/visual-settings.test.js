import test from "node:test";
import assert from "node:assert/strict";
import { themeMetadata } from "../src/theme-metadata.js";
import {
  validateVisual,
  visualNumber,
  visualFont,
  visualColor,
} from "../src/visual-settings.js";
import { creditsText } from "../src/credits.js";
import { readFileSync } from "node:fs";
test("bundled themes preserve full original XML and validate visual fields", () => {
  for (const theme of Object.values(themeMetadata)) {
    validateVisual(theme.visual);
    assert.ok(theme.sourceXml.includes("<VisualSettings>"));
    assert.equal(visualNumber(theme, "kHeight", 0), 10);
    assert.match(visualFont(theme, "kFont", ""), /pt/);
    assert.match(visualColor(theme, "Bg", ""), /rgba/);
  }
  assert.throws(() => validateVisual({ kHeight: { Value: "-1" } }));
  assert.throws(() => validateVisual({ kOpacity: { Value: "2" } }));
  assert.throws(() => validateVisual({ kFont: { Size: "Infinity" } }));
});
test("upstream contributor names remain in app and distributable credits", () => {
  const text = readFileSync(new URL("../CREDITS.md", import.meta.url), "utf8");
  for (const name of [
    "hitkey",
    "Nekokan",
    "MusicGameLAB",
    "Freefire",
    "the DtTvB",
    "Wen-DB",
    "BJmz",
    "BombTrack",
    "C.R.S",
    "enderdz",
    "复仇天神",
    "ILSPQ",
    "獠牙",
    "L.-S.P.",
    "Origin (Fantasy_Date)",
    "Rogue",
    "银羽のK’",
  ]) {
    assert.ok(text.includes(name), name);
    assert.ok(creditsText.includes(name), name);
  }
});
