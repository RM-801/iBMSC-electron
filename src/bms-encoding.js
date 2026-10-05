let shiftJISDoubleBytes;

function doubleByteMap() {
  if (shiftJISDoubleBytes) return shiftJISDoubleBytes;
  const result = new Map();
  const decoder = new TextDecoder("shift_jis");
  const bytes = new Uint8Array(2);
  // Desktop saves use iconv-lite's Windows-31J table. Its encoder prefers the
  // FA–FC IBM extensions over their ED/EE duplicates and rejects F0–F9 private
  // characters. Visiting the remaining codes in ascending order matches it.
  for (let lead = 0x81; lead <= 0xfc; lead++) {
    if (lead > 0x9f && lead < 0xe0 || lead >= 0xed && lead <= 0xf9) continue;
    bytes[0] = lead;
    for (let trail = 0x40; trail <= 0xfc; trail++) {
      if (trail === 0x7f) continue;
      bytes[1] = trail;
      const character = decoder.decode(bytes);
      if (character.length === 1 && character !== "\ufffd" && !result.has(character))
        result.set(character, (lead << 8) | trail);
    }
  }
  shiftJISDoubleBytes = result;
  return result;
}

function shiftJISCode(character) {
  const code = character.codePointAt(0);
  // Keep ASCII/control bytes literal: ICU's decoder differs here from browser
  // decoders and iconv-lite. U+0080 is also a literal byte in the desktop table.
  if (code <= 0x80) return code;
  if (code >= 0xff61 && code <= 0xff9f) return code - 0xff61 + 0xa1;
  return doubleByteMap().get(character);
}

function unrepresentable(character) {
  // Shared with electron/save-data.cjs, including its UTF-8 round-trip failures.
  throw Error(`Shift-JIS 无法保存字符“${character}”，请改用 UTF-8`);
}

/** Encode a browser BMS/PMS download with the same strict rules as desktop save. */
export function encodeBMS(text, encoding = "utf8") {
  if (typeof text !== "string" || text.length > 32 * 1024 * 1024)
    throw Error("无效谱面数据");
  encoding ||= "utf8";
  if (!["utf8", "shift_jis"].includes(encoding))
    throw Error("不支持的保存编码");

  if (encoding === "utf8") {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    const decoder = new TextDecoder("utf-8");
    // TextEncoder replaces lone UTF-16 surrogates. Reject that loss just as the
    // desktop does; neither path adds a BOM or silently repairs source text.
    if (decoder.decode(bytes) !== text)
      unrepresentable([...text].find((character) =>
        decoder.decode(encoder.encode(character)) !== character));
    return bytes;
  }

  let length = 0;
  for (const character of text) {
    const code = shiftJISCode(character);
    if (code === undefined) unrepresentable(character);
    length += code <= 0xff ? 1 : 2;
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const character of text) {
    const code = shiftJISCode(character);
    if (code > 0xff) bytes[offset++] = code >> 8;
    bytes[offset++] = code & 0xff;
  }
  return bytes;
}
