import test from "node:test";
import assert from "node:assert/strict";
import { parseBMS, serializeBMS, events, bgmLongEvents } from "../src/bms.js";
import { prepareBMSExport } from "../src/bms-export.js";
import { encodeId } from "../src/identifiers.js";

const row = (length, entries) => {
  const cells = Array(length).fill("00");
  for (const [index, value] of entries) cells[index] = value;
  return cells.join("");
};
const positions = (chart) => events(chart).map(({ measure, channel, fraction, value }) =>
  ({ measure, channel, fraction, value }));

test("export reduces only redundant zero slots and never mutates the chart", () => {
  const chart = parseBMS("#TITLE source\n#00011:" + row(24, [[0, "01"], [8, "02"]]));
  chart.rows[0].custom = { keep: true };
  const before = structuredClone(chart);
  const exported = prepareBMSExport(chart);
  assert.deepEqual(exported.rows[0].cells, ["01", "02", "00"]);
  assert.deepEqual(positions(exported), positions(chart));
  assert.deepEqual(positions(parseBMS(serializeBMS(exported))), positions(chart));
  assert.deepEqual(chart, before);
  exported.rows[0].custom.keep = false;
  assert.equal(chart.rows[0].custom.keep, true);
});

test("maximum grid rejects an unrepresentable position instead of moving or merging notes", () => {
  const chart = parseBMS("#00011:" + row(24, [[1, "01"], [2, "02"]]));
  const before = structuredClone(chart);
  assert.throws(() => prepareBMSExport(chart, { maxGrid: 8 }), /第 000 小节的 11 通道需要至少 24 格线/);
  assert.deepEqual(positions(prepareBMSExport(chart, { maxGrid: 24 })), positions(chart));
  assert.deepEqual(chart, before);
});

test("grid density uses measure length while measure-start events and empty BGM rows remain exact", () => {
  const long = parseBMS("#00002:2\n#00011:" + row(384, [[1, "01"]]));
  assert.deepEqual(positions(prepareBMSExport(long)), positions(long));
  const short = parseBMS("#00002:0.5\n#00011:" + row(192, [[1, "01"]]));
  assert.throws(() => prepareBMSExport(short), /至少 384 格线/);
  assert.deepEqual(positions(prepareBMSExport(short, { maxGrid: 384 })), positions(short));
  const tiny = parseBMS("#00002:0.001\n#00001:00000000\n#00001:01000000");
  const exported = prepareBMSExport(tiny);
  assert.deepEqual(exported.rows.map((r) => r.cells), [["00"], ["01"]]);
  assert.equal(exported.rows.length, 2);
});

test("BPM and STOP deduplicate actual values independently without altering initial or direct BPM", () => {
  const chart = parseBMS("#BPM 123\n#WAV0A sound.wav\n#BPM0A 300.5\n#BPM0B 300.5000\n#BPM0C 400\n#STOP0A 48\n#STOP0B 48.0\n#STOP0C 0\n#00003:FF\n#00008:0A0B0C\n#00009:0A0B0C");
  const before = structuredClone(chart), exported = prepareBMSExport(chart);
  assert.equal(exported.headers.BPM, "123");
  assert.deepEqual(exported.resources.WAV, { "0A": "sound.wav" });
  assert.deepEqual(exported.resources.BPM, { "01": "300.5", "02": "400" });
  assert.deepEqual(exported.resources.STOP, { "01": "48", "02": "0" });
  assert.equal(exported.rows[0].channel, "03");
  assert.deepEqual(exported.rows[0].cells, ["FF"]);
  assert.deepEqual(exported.rows[1].cells, ["01", "01", "02"]);
  assert.deepEqual(exported.rows[2].cells, ["01", "01", "02"]);
  assert.deepEqual(chart, before);
});

function definitions(count, kind = "BPM", base = 36) {
  const channel = kind === "BPM" ? "08" : "09";
  const chart = parseBMS(`#BASE ${base}`);
  for (let n = 1; n <= count; n++) {
    const id = n.toString(36).toUpperCase().padStart(2, "0");
    chart.resources[kind][id] = String(300 + n / 10);
    chart.rows.push({ measure: n - 1, channel, cells: [id] });
  }
  return chart;
}

test("BPM and STOP extension switches choose independent hexadecimal or base-36 pools", () => {
  const chart = definitions(16);
  const stops = definitions(16, "STOP");
  chart.resources.STOP = stops.resources.STOP;
  chart.rows.push(...stops.rows);
  const exported = prepareBMSExport(chart, { bpmExtended: true });
  assert.equal(exported.rows[15].cells[0], "0G");
  assert.equal(exported.rows[31].cells[0], "10");
  const opposite = prepareBMSExport(chart, { stopExtended: true });
  assert.equal(opposite.rows[15].cells[0], "10");
  assert.equal(opposite.rows[31].cells[0], "0G");
});

test("255-definition mode rejects overflow atomically and extended mode retains all values", () => {
  const chart = definitions(256), before = structuredClone(chart);
  assert.throws(() => prepareBMSExport(chart), /BPM 定义数量超过当前导出上限 255/);
  const exported = prepareBMSExport(chart, { bpmExtended: true });
  assert.equal(Object.keys(exported.resources.BPM).length, 256);
  assert.equal(events(exported).length, 256);
  assert.deepEqual(chart, before);
});

test("extended pools reserve 00 and support exactly 1295 distinct definitions", () => {
  const chart = parseBMS("#BASE 62");
  for (let n = 1; n <= 1295; n++) {
    const id = encodeId(chart, n);
    chart.resources.STOP[id] = String(n);
    chart.rows.push({ measure: n % 1000, channel: "09", cells: [id] });
  }
  const exported = prepareBMSExport(chart, { stopExtended: true });
  assert.equal(Object.keys(exported.resources.STOP).length, 1295);
  assert.equal(Object.hasOwn(exported.resources.STOP, "ZZ"), true);
  assert.equal(Object.hasOwn(exported.resources.STOP, "00"), false);
  assert.equal(events(parseBMS(serializeBMS(exported))).length, 1295);
  const id = encodeId(chart, 1296);
  chart.resources.STOP[id] = "1296";
  chart.rows.push({ measure: 999, channel: "09", cells: [id] });
  assert.throws(() => prepareBMSExport(chart, { stopExtended: true }), /STOP 定义数量超过当前导出上限 1295/);
});

test("BASE 16 remains hexadecimal with extension enabled; BASE 62 retains case-sensitive input identities", () => {
  const hex = parseBMS("#BASE 16\n#BPM0F 300.5\n#00008:0F");
  assert.equal(prepareBMSExport(hex, { bpmExtended: true }).headers.BASE, "16");
  assert.equal(serializeBMS(prepareBMSExport(hex, { bpmExtended: true })).includes("#BPM01 300.5"), true);
  const chart = parseBMS("#BASE 62\n#WAV0a lower.wav\n#BPM0A 400.5\n#BPM0a 500.5\n#00008:0a0A\n#00011:0a");
  const exported = prepareBMSExport(chart, { bpmExtended: true });
  assert.equal(exported.headers.BASE, "62");
  assert.deepEqual(exported.resources.BPM, { "01": "500.5", "02": "400.5" });
  assert.deepEqual(exported.resources.WAV, chart.resources.WAV);
  assert.deepEqual(parseBMS(serializeBMS(exported)).resources, exported.resources);
});

test("opaque BPM/STOP references reject changed or removed definitions and preserve unchanged mappings", () => {
  for (const [kind, channel] of [["BPM", "08"], ["STOP", "09"]]) {
    const changed = parseBMS(`#${kind}0A 300\n#000${channel}:0A\n#IF 1\n#001${channel}:0A\n#ENDIF`);
    const before = structuredClone(changed);
    assert.throws(() => prepareBMSExport(changed), /条件分支可能引用重新编号的/);
    assert.deepEqual(changed, before);
    const unused = parseBMS(`#${kind}01 300\n#${kind}02 400\n#000${channel}:01\n#IF 1\n#001${channel}:02\n#ENDIF`);
    assert.throws(() => prepareBMSExport(unused), /条件分支可能引用重新编号的/);
    const unchanged = parseBMS(`#${kind}01 300.0\n#000${channel}:01\n#IF 1\n#001${channel}:01\n#ENDIF`);
    assert.deepEqual(prepareBMSExport(unchanged).raw, unchanged.raw);
  }
});

test("raw conditional definitions also guard remapping while unrelated expansion stays untouched", () => {
  const chart = parseBMS("#BPM0A 300\n#00008:0A\n#IF 1\n#BPM01 600\n#ENDIF");
  assert.throws(() => prepareBMSExport(chart), /条件分支可能引用重新编号的 BPM/);
  const safe = parseBMS("#BPM0A 300\n#00008:0A\n#CUSTOM preserve\n#IF 1\n#00111:01\n#ENDIF");
  assert.deepEqual(prepareBMSExport(safe).raw, safe.raw);
});

test("legacy expansion fields remain opaque and unused invalid definitions do not become events", () => {
  const chart = parseBMS("#BPM01 300\n#00008:01");
  chart.headers.BPM02 = "400";
  chart.resources.BPM["02"] = "invalid-unused";
  assert.throws(() => prepareBMSExport(chart), /条件分支可能引用重新编号的 BPM/);
  delete chart.headers.BPM02;
  chart.rows.push({ measure: 0, channel: "D1", cells: row(256, [[1, "01"]]).match(/../g) });
  const exported = prepareBMSExport(chart);
  assert.deepEqual(exported.resources.BPM, { "01": "300" });
  assert.deepEqual(exported.rows[1], chart.rows[1]);
});

test("a conditional BASE directive prevents introducing incompatible timing labels", () => {
  const chart = parseBMS("#BASE 36\n#IF 1\n#BASE 16\n#ENDIF");
  for (let n = 1; n <= 16; n++) {
    const id = n.toString(16).toUpperCase().padStart(2, "0");
    chart.resources.BPM[id] = String(300 + n);
    chart.rows.push({ measure: n, channel: "08", cells: [id] });
  }
  assert.deepEqual(prepareBMSExport(chart).raw, chart.raw);
  assert.throws(() => prepareBMSExport(chart, { bpmExtended: true }), /条件分支可能引用重新编号的 BPM/);
});

test("row compaction preserves BGM-long metadata and the existing export confirmation guard", () => {
  const chart = parseBMS("#00001:" + row(8, [[2, "01"], [6, "01"]]));
  chart.rows[0].longCells = { 2: true, 6: true };
  const exported = prepareBMSExport(chart);
  assert.deepEqual(exported.rows[0].longCells, { 1: true, 3: true });
  assert.equal(bgmLongEvents(exported).length, 2);
  assert.throws(() => serializeBMS(exported), /BGM 区存有长音符/);
});

test("invalid export options and missing timing definitions fail without changing source data", () => {
  const chart = parseBMS("#00008:01"), before = structuredClone(chart);
  for (const maxGrid of [0, 7, 10001, 192.5, "192", NaN])
    assert.throws(() => prepareBMSExport(chart, { maxGrid }), /BMS 最大格线/);
  for (const options of [{ bpmExtended: 1 }, { stopExtended: "false" }])
    assert.throws(() => prepareBMSExport(chart, options), /BMS 扩展编号设置/);
  assert.throws(() => prepareBMSExport(chart), /BPM 定义缺失或无效：01/);
  assert.deepEqual(chart, before);
});
