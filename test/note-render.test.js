import { test } from "node:test";
import assert from "node:assert/strict";
import { columnStyle, paintNote, noteRectangle } from "../src/note-render.js";
test("note lower edge equals event time under scroll and zoom, including fractional coordinates", () => {
  for (const scale of [28, 56, 84])
    for (const beat of [0, 1 / 3, 96, 3999]) {
      const timeY = 224010 - beat * scale - 310;
      const rect = noteRectangle(50, 42, timeY);
      assert.equal(rect.y + rect.height, timeY);
    }
});
test("default note palette follows original per-column definitions and themes override it", () => {
  assert.equal(Number(columnStyle({ id: 5 }).NoteColor), 0xff62b0ff);
  assert.equal(Number(columnStyle({ id: 6 }).NoteColor), 0xffb0b0b0);
  assert.equal(Number(columnStyle({ id: 7 }).NoteColor), 0xffffc862);
  assert.equal(Number(columnStyle({ id: 40 }).NoteColor), 0xffe18080);
  const theme = { NoteColor: "123" };
  assert.equal(columnStyle({ id: 5, theme }), theme);
});
test("painting retains lane color under selection and keeps strokes above the time edge", () => {
  const fills = [],
    strokes = [],
    stops = [];
  const ctx = {
    createLinearGradient: () => ({
      addColorStop: (at, color) => stops.push([at, color]),
    }),
    fillRect: (...args) => fills.push(args),
    strokeRect: (...args) => strokes.push(args),
  };
  paintNote(ctx, { id: 5, left: 100, width: 40 }, 200, { selected: true });
  assert.equal(fills[0][1] + fills[0][3], 200);
  for (const s of strokes) assert.equal(s[1] + s[3] + 0.5, 200);
  assert.equal(stops.length, 2);
  assert.equal(ctx.strokeStyle, "red");
});
