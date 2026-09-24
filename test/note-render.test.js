import { test } from "node:test";
import assert from "node:assert/strict";
import {
  columnStyle,
  paintNote,
  paintNoteLabel,
  noteRectangle,
} from "../src/note-render.js";
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

test("theme label ink stays inside note borders with oversized fonts and legacy offsets", () => {
  for (const text of ["01", "120.5", "sound/long-filename-with-descenders.ogg"])
    for (const width of [10, 30, 42])
      for (const shiftX of [-8, 0, 2, 100])
        for (const shiftY of [-2, 0, 100]) {
          let clip, origin, factor, painted;
          let saved = 0;
          const measureText = (value) => ({
            width: value.length * 8,
            actualBoundingBoxLeft: 1,
            actualBoundingBoxRight: value.length * 8,
            actualBoundingBoxAscent: 11,
            actualBoundingBoxDescent: 3,
          });
          const ctx = {
            save() {
              saved++;
            },
            restore() {
              saved--;
            },
            beginPath() {},
            clip() {},
            rect(...args) {
              clip = args;
            },
            measureText,
            translate(...args) {
              origin = args;
            },
            scale(x) {
              factor = x;
            },
            fillText(value) {
              painted = value;
            },
          };
          paintNoteLabel(ctx, { left: 50.25, width }, 200.5, text, {
            font: "bold 9pt Verdana",
            shiftX,
            shiftY,
          });
          assert.equal(saved, 0);
          assert.deepEqual(clip, [53.25, 191.5, width - 6, 8]);
          if (!painted) continue;
          const m = measureText(painted);
          assert.ok(origin[0] - m.actualBoundingBoxLeft * factor >= clip[0]);
          assert.ok(
            origin[0] + m.actualBoundingBoxRight * factor <=
              clip[0] + clip[2] + 1e-9,
          );
          assert.ok(origin[1] - m.actualBoundingBoxAscent * factor >= clip[1]);
          assert.ok(
            origin[1] + m.actualBoundingBoxDescent * factor <=
              clip[1] + clip[3] + 1e-9,
          );
          assert.ok(painted === text || painted.endsWith("…"));
        }
});
