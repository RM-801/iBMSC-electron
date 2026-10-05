import { test } from "node:test";
import assert from "node:assert/strict";
import {
  viewportGeometry,
  scrollEndBeat,
  showsSecondPlayer,
} from "../src/view.js";
import {
  parseBMS,
  measureStarts,
  putNote,
  events,
  serializeBMS,
} from "../src/bms.js";
import {
  copyMeasures,
  pasteMeasures,
  mirrorMeasures,
  deleteMeasures,
} from "../src/edit.js";
test("blank startup has no demo notes, titles or audio definitions", () => {
  const c = parseBMS("#BPM 120\n#LNTYPE 1");
  assert.equal(events(c).length, 0);
  assert.deepEqual(c.resources.WAV, {});
  assert.equal(c.headers.TITLE, undefined);
});
test("scroll range follows last note plus upstream 2000 units, including LN release", () => {
  const c = parseBMS("#00051:01\n#03251:01");
  assert.equal(scrollEndBeat(c), 128 + 2000 / 48);
  assert.equal(scrollEndBeat(parseBMS("")), 2000 / 48);
  assert.equal(scrollEndBeat(parseBMS("#99911:0001")), 4000);
});
test("dynamic viewport still maps notes exactly at varied scroll positions", () => {
  const c = parseBMS("#00102:0.5\n#02011:01"),
    starts = measureStarts(c);
  const height = scrollEndBeat(c) * 56 + 30;
  for (const top of [0, 300, height - 600]) {
    const g = viewportGeometry(starts, 56, top, 600, height);
    assert.equal(g.height, height);
    for (const y of [0, 250, 599])
      assert.ok(Math.abs(g.toY(g.toBeat(y)) - y) < 1e-7);
  }
});
test("PLAYER header drives SP, couple and DP visibility", () => {
  for (const [header, expected] of [
    ["", false],
    ["1", false],
    ["2", true],
    ["3", true],
  ])
    assert.equal(
      showsSecondPlayer(parseBMS(header ? "#PLAYER " + header : "")),
      expected,
    );
});
test("scroll and zoom preserve coordinate roundtrip with variable measures", () => {
  const starts = measureStarts(parseBMS("#00102:0.75\n#00402:1.5"));
  for (const scale of [36, 56, 84])
    for (const top of [0, 600, 20000]) {
      const g = viewportGeometry(starts, scale, top, 750);
      for (const y of [0, 200, 749])
        assert.ok(Math.abs(g.toY(g.toBeat(y)) - y) < 1e-7);
    }
});

test("range copy/paste preserves fractional grids and refuses overwrite atomically", () => {
  const c = parseBMS("#00311:000100\n#00451:0101");
  const copied = copyMeasures(c, 3, 4, [
    "16",
    "11",
    "12",
    "13",
    "14",
    "15",
    "18",
    "19",
  ]);
  pasteMeasures(c, copied, 8);
  assert.equal(c.rows[2].measure, 8);
  assert.deepEqual(c.rows[2].cells, ["00", "01", "00"]);
  const before = JSON.stringify(c);
  assert.throws(() => pasteMeasures(c, copied, 8));
  assert.equal(JSON.stringify(c), before);
});
test("mirror preserves scratch and long-note channels; range deletion is scoped", () => {
  const c = parseBMS("#00311:01\n#00351:01\n#00316:01\n#00321:01\n#00411:01");
  mirrorMeasures(c, 3, 3, ["16", "11", "12", "13", "14", "15", "18", "19"]);
  assert.deepEqual(
    c.rows.map((r) => r.channel),
    ["19", "59", "16", "21", "11"],
  );
  deleteMeasures(c, 3, 3, ["16", "11", "12", "13", "14", "15", "18", "19"]);
  assert.deepEqual(
    c.rows.map((r) => r.channel),
    ["21", "11"],
  );
});

test("nearest-grid snapping is symmetric and crosses measure boundaries", async () => {
  const { snappedPosition } = await import("../src/view.js");
  const starts = measureStarts(parseBMS("#00202:0.5"));
  const at = (beat) => {
    const p = snappedPosition(starts, beat, 16);
    return starts[p.measure] + p.slot / p.division * (starts[p.measure+1]-starts[p.measure]);
  };
  for (const line of [1, 4, 8, 8.25, 10]) {
    assert.equal(at(line - 0.124), line);
    assert.equal(at(line + 0.124), line);
    assert.equal(at(line - 0.126), line - 0.25);
    assert.equal(at(line + 0.126), line + 0.25);
  }
  assert.equal(at(8.125), 8.25);
  assert.equal(snappedPosition(starts, 7.99, 16).measure, 2);
});

test("nearest snapping handles partial grid at variable bars and chart end", async () => {
  const { snappedPosition } = await import("../src/view.js");
  const starts = measureStarts(parseBMS("#00002:0.3"));
  assert.equal(snappedPosition(starts, 1.09, 16).measure, 0);
  const p = snappedPosition(starts, 1.11, 16);
  assert.equal(p.measure, 1);
  assert.equal(p.slot, 0);
  assert.equal(snappedPosition(starts, starts.at(-1)-0.001, 16).measure, 999);
  assert.equal(snappedPosition(starts, starts.at(-1), 16), null);
  const free = snappedPosition(starts, 1.09, 16, false);
  assert.ok(Math.abs(free.slot/free.division*1.2-1.09) < 1.2/65536);
});

test("pointer round snapping is symmetric across DPI, scale and scroll", async () => {
  const { pointerPosition } = await import("../src/view.js");
  const starts = measureStarts(parseBMS("#00102:0.75"));
  for (const scale of [12, 48, 60, 192]) for (const pixelRatio of [1, 1.25, 1.5, 2])
    for (const top of [100, 100.375]) {
      const rendered = { height: 2947.333, top, scale, pixelRatio };
      const rect = { top: 78.375, height: 603 };
      const bitmap = Math.round(rect.height * pixelRatio);
      for (const beat of [1, 4, 5.25, 7, 8.75]) {
        const line = rendered.height - 20 - top - beat * scale;
        for (const direction of [-1, 1]) for (const fraction of [0, 0.49, 0.51]) {
          const clientY = rect.top + (line + direction * fraction * scale / 4) * rect.height * pixelRatio / bitmap;
          const p = pointerPosition(starts, rendered, rect, bitmap, clientY, 16, true);
          const actual = starts[p.measure] + p.slot / p.division * (starts[p.measure+1]-starts[p.measure]);
          const expected = fraction < 0.5 ? beat : beat - direction / 4;
          assert.ok(Math.abs(actual-expected) < 1e-8);
        }
      }
    }
});

test("whole-editor zoom retains note/grid hit positions at fractional DPI", async () => {
  const { displayedBeatY, pointerPosition } = await import("../src/view.js");
  const starts = measureStarts(parseBMS("#00102:0.75"));
  for (const zoom of [0.5, 1, 1.1, 1.75, 2, 3]) for (const pixelRatio of [1, 1.25, 2]) {
    const rendered = { height: 8025 * zoom, top: 603.25, scale: 192 * zoom, bottomInset: 20 * zoom, pixelRatio };
    const rect = { top: 70.5, height: 605 }, bitmap = Math.round(rect.height * pixelRatio);
    for (const beat of [0, 1, 4, 5.25, 7]) {
      const clientY = rect.top + displayedBeatY(rendered, beat) * rect.height * pixelRatio / bitmap;
      const position = pointerPosition(starts, rendered, rect, bitmap, clientY, 16, true);
      assert.equal(starts[position.measure] + position.slot / position.division * (starts[position.measure+1] - starts[position.measure]), beat);
    }
  }
});
