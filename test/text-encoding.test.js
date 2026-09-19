import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { decodeXML } from "../src/text-encoding.js";
import { decodeBMS } from "../src/bms.js";
const iconv = createRequire(import.meta.url)("iconv-lite");
test("explicit Chinese chart encoding preserves metadata and WAV filenames", () => {
  const text = "#TITLE 中文谱面\n#WAV01 音源.wav";
  assert.equal(decodeBMS(iconv.encode(text, "gbk"), "gbk"), text);
  assert.throws(() => decodeBMS(iconv.encode(text, "gbk"), "utf8"));
  assert.throws(() => decodeBMS(new Uint8Array(), "unknown"));
});
test("XML declarations and UTF16 byte order override chart decoding assumptions", () => {
  for (const encoding of [
    "gb2312",
    "shift_jis",
    "utf-8",
    "utf-16le",
    "utf-16be",
  ]) {
    const text = `<?xml version="1.0" encoding="${encoding}"?><iBMSC>中文</iBMSC>`;
    assert.equal(decodeXML(iconv.encode(text, encoding)), text);
  }
  const text = "<iBMSC>中文</iBMSC>";
  assert.equal(
    decodeXML(iconv.encode(text, "utf16-le", { addBOM: true })),
    text,
  );
  assert.equal(
    decodeXML(iconv.encode(text, "utf16-be", { addBOM: true })),
    text,
  );
});
