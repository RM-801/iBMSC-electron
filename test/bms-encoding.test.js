import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import save from "../electron/save-data.cjs";
import { decodeBMS, parseBMS } from "../src/bms.js";
import { encodeBMS } from "../src/bms-encoding.js";

const iconv = createRequire(import.meta.url)("iconv-lite");
const hex = (bytes) => Buffer.from(bytes).toString("hex");
const sameDesktopBytes = (text, encoding) => {
  const bytes = encodeBMS(text, encoding);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(hex(bytes), save.saveBytes({ text, encoding }).toString("hex"));
  return bytes;
};
const sameDesktopError = (text, encoding) => {
  let expected;
  try { save.saveBytes({ text, encoding }); } catch (error) { expected = error.message; }
  assert.ok(expected, "desktop must reject this input too");
  assert.throws(() => encodeBMS(text, encoding), { message: expected });
};

test("UTF-8 is the default, preserves Chinese and surrogate pairs, and adds no BOM", () => {
  const text = "#TITLE 看上她 🎵\r\n#ARTIST 黎明\r\n#WAV01 音源.wav\r\n#00011:01\r\n";
  const bytes = sameDesktopBytes(text);
  assert.deepEqual([...bytes.subarray(0, 3)], [0x23, 0x54, 0x49]);
  assert.equal(decodeBMS(bytes, "utf8"), text);
  assert.equal(parseBMS(decodeBMS(bytes)).headers.TITLE, "看上她 🎵");
  assert.equal(hex(encodeBMS("🎵", "utf8")), "f09f8eb5");
  assert.equal(encodeBMS("").length, 0);
});

test("Shift-JIS saves Japanese, halfwidth kana, ASCII and line endings exactly", () => {
  assert.equal(hex(encodeBMS("日本語 ｶﾀｶﾅﾞﾟ", "shift_jis")), "93fa967b8cea20b6c0b6c5dedf");
  const text = "#TITLE 日本語 ｶﾀｶﾅ\r\n#WAV01 音源.wav\r\n#00011:01\r\n";
  const bytes = sameDesktopBytes(text, "shift_jis");
  assert.equal(decodeBMS(bytes, "shift_jis"), text);
  assert.equal(parseBMS(decodeBMS(bytes)).resources.WAV["01"], "音源.wav");
  assert.equal(encodeBMS("", "shift_jis").length, 0);
});

test("Windows extensions use desktop-compatible byte choices without Unicode normalization", () => {
  assert.equal(hex(encodeBMS("①髙﨑纊", "shift_jis")), "8740fbfcfab1fa5c");
  const text = "①髙﨑纊Ⅰⅰ№℡∵～￠￡￢－";
  const bytes = sameDesktopBytes(text, "shift_jis");
  assert.equal(iconv.decode(bytes, "shift_jis"), text);
  for (const character of ["¥", "‾", "〜", "−", "¢", "£", "¬"])
    sameDesktopError(character, "shift_jis");
});

test("ASCII controls and the full halfwidth range agree with desktop even when ICU differs", () => {
  const ascii = Array.from({ length: 0x81 }, (_, code) => String.fromCharCode(code)).join("");
  assert.deepEqual([...sameDesktopBytes(ascii, "shift_jis")], Array.from({ length: 0x81 }, (_, i) => i));
  const kana = Array.from({ length: 63 }, (_, index) => String.fromCharCode(0xff61 + index)).join("");
  assert.deepEqual([...sameDesktopBytes(kana, "shift_jis")], Array.from({ length: 63 }, (_, i) => 0xa1 + i));
});

test("unrepresentable Chinese and supplementary characters report the whole first character", () => {
  const text = "#TITLE 看上她🎵\r\n";
  assert.throws(() => encodeBMS(text, "shift_jis"), {
    message: "Shift-JIS 无法保存字符“她”，请改用 UTF-8",
  });
  sameDesktopError(text, "shift_jis");
  sameDesktopError("🎵她", "shift_jis");
  sameDesktopBytes("中文 黎明", "shift_jis");
  sameDesktopError("𠮷", "shift_jis");
});

test("private-use characters and lone surrogates cannot silently become question marks", () => {
  for (const text of ["\ue000", "\ue69c", "\ue69d", "\ue757", "\uf8f0", "\uf8f1", "\ufffd"])
    sameDesktopError(text, "shift_jis");
  for (const text of ["\ud800", "\udc00", "X\ud800Y", "\ud800\ud800", "\udc00\ud800"])
    for (const encoding of ["utf8", "shift_jis"]) sameDesktopError(text, encoding);
  // The existing desktop verifier strips an initial BOM when decoding and
  // rejects such input. Preserve that behavior while adding no BOM ourselves.
  sameDesktopError("\ufeff#TITLE Test", "utf8");
  sameDesktopBytes("#TITLE A\ufeffB", "utf8");
});

test("every BMP character has the same Shift-JIS representability and output as iconv-lite", () => {
  let accepted = 0;
  for (let code = 0; code <= 0xffff; code++) {
    const character = String.fromCharCode(code);
    const expected = iconv.encode(character, "shift_jis");
    const description = `U+${code.toString(16).padStart(4, "0")}`;
    if (iconv.decode(expected, "shift_jis") === character) {
      assert.equal(hex(encodeBMS(character, "shift_jis")), expected.toString("hex"), description);
      accepted++;
    } else {
      assert.throws(() => encodeBMS(character, "shift_jis"), /无法保存字符/, description);
    }
  }
  assert.ok(accepted > 7000, "the full Windows-31J repertoire was exercised");
});

test("invalid input and unsupported encodings use the existing desktop validation", () => {
  for (const text of [undefined, null, 123, new Uint8Array([1])])
    sameDesktopError(text, "utf8");
  for (const encoding of ["gbk", "utf-8", "Shift_JIS", "unknown"])
    sameDesktopError("#TITLE Test", encoding);
  for (const encoding of [undefined, null, ""])
    sameDesktopBytes("#TITLE 中文", encoding);
  sameDesktopError("x".repeat(32 * 1024 * 1024 + 1), "utf8");
});
