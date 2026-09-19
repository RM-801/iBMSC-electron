// XML has its own encoding declaration; it must not inherit the chart encoding setting.
export function decodeXML(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let encoding = "utf-8";
  if (b[0] === 255 && b[1] === 254) encoding = "utf-16le";
  else if (b[0] === 254 && b[1] === 255) encoding = "utf-16be";
  else if (b[0] === 0 && b[1] === 60) encoding = "utf-16be";
  else if (b[0] === 60 && b[1] === 0) encoding = "utf-16le";
  else {
    const header = String.fromCharCode(...b.subarray(0, 512));
    const declared = header.match(
      /^\s*<\?xml\s[^?]*encoding\s*=\s*["']([^"']+)["']/i,
    );
    if (declared) encoding = declared[1];
  }
  return new TextDecoder(encoding, { fatal: true }).decode(b);
}
