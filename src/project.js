import { chartBase } from "./identifiers.js";
import { parseBMS, events, measureStarts } from "./bms.js";
import {
  originalColumns,
  eventColumn,
  numericValue,
  writeColumn,
} from "./columns.js";
// .NET BinaryReader/Writer, little endian, UTF-16LE strings prefixed by byte-length varints.
class Reader {
  constructor(bytes) {
    this.bytes = new Uint8Array(bytes);
    this.view = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset,
      this.bytes.byteLength,
    );
    this.pos = 0;
  }
  take(n) {
    if (n < 0 || this.pos + n > this.bytes.length)
      throw Error("工程文件被截断");
    const p = this.pos;
    this.pos += n;
    return p;
  }
  u8() {
    return this.view.getUint8(this.take(1));
  }
  i16() {
    return this.view.getInt16(this.take(2), true);
  }
  i32() {
    return this.view.getInt32(this.take(4), true);
  }
  f32() {
    return this.view.getFloat32(this.take(4), true);
  }
  f64() {
    return this.view.getFloat64(this.take(8), true);
  }
  str() {
    let n = 0,
      shift = 0,
      b;
    do {
      if (shift > 28) throw Error("无效字符串长度");
      b = this.u8();
      n += (b & 127) * 2 ** shift;
      shift += 7;
    } while (b & 128);
    const p = this.take(n);
    return new TextDecoder("utf-16le").decode(this.bytes.subarray(p, p + n));
  }
  count() {
    const n = this.i32();
    if (n < 0 || n > 1000000) throw Error("工程项目数量无效");
    return n;
  }
}
class Writer {
  constructor() {
    this.parts = [];
  }
  number(type, n, size) {
    const b = new Uint8Array(size);
    new DataView(b.buffer)[type](0, n, true);
    this.parts.push(b);
  }
  u8(n) {
    this.number("setUint8", n, 1);
  }
  i16(n) {
    this.number("setInt16", n, 2);
  }
  i32(n) {
    this.number("setInt32", n, 4);
  }
  f32(n) {
    this.number("setFloat32", n, 4);
  }
  f64(n) {
    this.number("setFloat64", n, 8);
  }
  str(s = "") {
    s = String(s);
    let n = s.length * 2;
    do {
      const b = n & 127;
      n >>>= 7;
      this.u8(b | (n ? 128 : 0));
    } while (n);
    const b = new Uint8Array(s.length * 2),
      v = new DataView(b.buffer);
    for (let i = 0; i < s.length; i++)
      v.setUint16(i * 2, s.charCodeAt(i), true);
    this.parts.push(b);
  }
  result() {
    const out = new Uint8Array(this.parts.reduce((n, b) => n + b.length, 0));
    let p = 0;
    for (const b of this.parts) {
      out.set(b, p);
      p += b.length;
    }
    return out;
  }
}
export function rationalFraction(n) {
  if (n === 0) return [0, 1];
  for (let d = 1; d <= 65536; d++) {
    const a = Math.round(n * d);
    if (Math.abs(a / d - n) < 1e-10) return [a, d];
  }
  throw Error("该位置无法无损转换为 BMS 网格");
}
function atBeat(c, beat) {
  const starts = measureStarts(c);
  const measure = starts.findIndex(
    (v, i) => beat >= v - 1e-9 && beat < starts[i + 1] - 1e-9,
  );
  if (measure < 0) throw Error("音符超出 000–999 小节");
  const [slot, division] = rationalFraction(
    (beat - starts[measure]) / (starts[measure + 1] - starts[measure]),
  );
  return { measure, slot, division };
}
export function readProject(bytes) {
  const r = new Reader(bytes);
  if (r.i32() !== 0x534d4269 || r.u8() !== 0x43) throw Error("不是 iBMSC 工程");
  const version = [r.u8(), r.u8(), r.u8()];
  if (version[0] !== 3) throw Error("当前仅支持 iBMSC 3.x 二进制工程");
  const c = parseBMS(""),
    prefs = {},
    notes = [];
  let expansion = "";
  while (r.pos < r.bytes.length) {
    const block = r.i32();
    switch (block) {
      case 0x66657250:
        prefs.flags = r.i32();
        prefs.divide = r.i32();
        prefs.sub = r.i32();
        prefs.slash = r.i32();
        prefs.height = r.f32();
        prefs.width = r.f32();
        prefs.bgm = r.i32();
        break;
      case 0x64616548: {
        for (const k of ["TITLE", "ARTIST", "GENRE"]) c.headers[k] = r.str();
        c.headers.BPM = String(r.i32() / 10000);
        const pr = r.u8();
        c.headers.PLAYER = String((pr & 15) + 1);
        c.headers.RANK = String(pr >> 4);
        c.headers.PLAYLEVEL = r.str();
        for (const k of [
          "SUBTITLE",
          "SUBARTIST",
          "STAGEFILE",
          "BANNER",
          "BACKBMP",
        ])
          c.headers[k] = r.str();
        c.headers.DIFFICULTY = String(r.u8());
        for (const k of ["EXRANK", "TOTAL", "COMMENT"]) c.headers[k] = r.str();
        const ln = r.i16();
        if (ln)
          c.headers.LNOBJ = ln.toString(36).toUpperCase().padStart(2, "0");
        else c.headers.LNTYPE = "1";
        break;
      }
      case 0x564157: {
        prefs.wav = r.u8();
        const n = r.count();
        for (let i = 0; i < n; i++)
          c.resources.WAV[r.i16().toString(36).toUpperCase().padStart(2, "0")] =
            r.str();
        break;
      }
      case 0x74616542: {
        prefs.numerator = r.i16();
        prefs.denominator = r.i16();
        prefs.beatMode = r.u8();
        const n = r.count();
        for (let i = 0; i < n; i++) {
          const m = r.i16(),
            length = r.f64();
          if (m < 0 || m > 999 || !Number.isFinite(length) || length <= 0)
            throw Error("工程小节长度无效");
          c.ratios[m] = length / 192;
        }
        break;
      }
      case 0x6e707845:
        expansion = r.str();
        break;
      case 0x65746f4e: {
        const n = r.count();
        for (let i = 0; i < n; i++)
          notes.push({
            position: r.f64(),
            column: r.i32(),
            value: r.i32() / 10000,
            flags: r.u8(),
            length: r.f64(),
          });
        break;
      }
      case 0x6f646e55: {
        const count = r.count();
        prefs.undoIndex = r.i32();
        for (let i = 0; i < count; i++)
          for (let side = 0; side < 2; side++) {
            const n = r.count();
            for (let j = 0; j < n; j++) r.take(r.count());
          }
        break;
      }
      default:
        throw Error("未知 iBMSC 数据块：" + block.toString(16));
    }
  }
  const exp = parseBMS(expansion);
  c.raw = exp.raw;
  for (const k of Object.keys(c.resources))
    Object.assign(c.resources[k], exp.resources[k]);
  for (const [k, v] of Object.entries(exp.headers))
    if (k !== "BPM") c.headers[k] = v;
  c.rows.push(...exp.rows);
  const cols = originalColumns({
    bgm: Math.max(15, ...notes.map((n) => n.column - 25)),
  });
  for (const n of notes) {
    const col = cols.find((c) => c.id === n.column);
    if (!col?.channel) throw Error("未知工程轨道：" + n.column);
    const p = atBeat(c, n.position / 48),
      value =
        n.column <= 2
          ? n.value
          : Math.round(n.value).toString(36).toUpperCase().padStart(2, "0");
    const nt = !!(prefs.flags & 1),
      isLong = nt ? n.length > 0 : !!(n.flags & 1);
    writeColumn(c, col, p.measure, p.slot, p.division, value, {
      long: isLong,
      hidden: !!(n.flags & 2),
    });
    if (nt && n.length > 0) {
      const end = atBeat(c, (n.position + n.length) / 48);
      writeColumn(c, col, end.measure, end.slot, end.division, value, {
        long: true,
        hidden: !!(n.flags & 2),
      });
    }
  }
  c.projectPreferences = prefs;
  c.warnings.push("原版撤销命令已读取跳过，当前编辑历史从导入时开始");
  return c;
}
export function writeProject(c) {
  if (chartBase(c) !== 36) throw Error("原版 .IBMSC 格式仅支持 BASE36；请保存为 BMS，以保留当前 BASE 和编号");
  const w = new Writer(),
    h = c.headers;
  w.i32(0x534d4269);
  w.u8(0x43);
  for (const n of [3, 0, 5]) w.u8(n);
  w.i32(0x66657250);
  w.i32(0x1ffcfe);
  for (const n of [16, 4, 0]) w.i32(n);
  w.f32(1);
  w.f32(1);
  w.i32(8);
  w.i32(0x64616548);
  for (const k of ["TITLE", "ARTIST", "GENRE"]) w.str(h[k]);
  w.i32(Math.round(Number(h.BPM) * 10000));
  w.u8((Number(h.PLAYER || 1) - 1) | (Number(h.RANK || 2) << 4));
  w.str(h.PLAYLEVEL);
  for (const k of ["SUBTITLE", "SUBARTIST", "STAGEFILE", "BANNER", "BACKBMP"])
    w.str(h[k]);
  w.u8(Number(h.DIFFICULTY || 0));
  for (const k of ["EXRANK", "TOTAL", "COMMENT"]) w.str(h[k]);
  w.i16(parseInt(h.LNOBJ || "00", 36));
  w.i32(0x564157);
  w.u8(0);
  const wav = Object.entries(c.resources.WAV);
  w.i32(wav.length);
  for (const [id, name] of wav) {
    w.i16(parseInt(id, 36));
    w.str(name);
  }
  w.i32(0x74616542);
  w.i16(4);
  w.i16(4);
  w.u8(3);
  const ratios = Object.entries(c.ratios);
  w.i32(ratios.length);
  for (const [m, r] of ratios) {
    w.i16(Number(m));
    w.f64(r * 192);
  }
  w.i32(0x6e707845);
  const expansion = [...c.raw];
  for (const [id, v] of Object.entries(c.resources.BMP))
    expansion.push("#BMP" + id + " " + v);
  for (const [key, v] of Object.entries(h))
    if (
      ![
        "TITLE",
        "ARTIST",
        "GENRE",
        "BPM",
        "PLAYER",
        "RANK",
        "PLAYLEVEL",
        "SUBTITLE",
        "SUBARTIST",
        "STAGEFILE",
        "BANNER",
        "BACKBMP",
        "DIFFICULTY",
        "EXRANK",
        "TOTAL",
        "COMMENT",
        "LNOBJ",
        "LNTYPE",
      ].includes(key)
    )
      expansion.push("#" + key + " " + v);
  const all = events(c),
    recognized = all.filter((e) => eventColumn(c, e) >= 0);
  for (const row of c.rows.filter(
    (r, i) =>
      !recognized.some((e) => e.row === i) && r.cells.some((v) => v !== "00"),
  ))
    expansion.push(
      "#" +
        String(row.measure).padStart(3, "0") +
        row.channel +
        ":" +
        row.cells.join(""),
    );
  w.str(expansion.join("\r\n"));
  w.i32(0x65746f4e);
  w.i32(recognized.length);
  for (const e of recognized) {
    w.f64(e.beat * 48);
    w.i32(eventColumn(c, e));
    w.i32(
      Math.round(
        (e.channel[0] === "0" && ["03", "08", "09"].includes(e.channel)
          ? numericValue(c, e)
          : parseInt(e.value, 36)) * 10000,
      ),
    );
    w.u8(
      (e.bgmLong || /^[5-8]/.test(e.channel) ? 1 : 0) | (/^[3478]/.test(e.channel) ? 2 : 0),
    );
    w.f64(0);
  }
  w.i32(0x6f646e55);
  w.i32(100);
  w.i32(0);
  for (let i = 0; i < 200; i++) {
    w.i32(1);
    w.i32(1);
    w.u8(255);
  }
  return w.result();
}
