import test from "node:test";
import assert from "node:assert/strict";
import { parseBMS, events, longPairs } from "../src/bms.js";
import { captureNotes, eventId, putCaptured } from "../src/commands.js";
import { createDragPreview } from "../src/drag-preview.js";
import { statistics } from "../src/diagnostics.js";

function scene(
  text,
  delta,
  { copy = false, select = () => true, deltaColumn = 0 } = {},
) {
  const chart = parseBMS(text),
    before = structuredClone(chart);
  const source = captureNotes(chart, new Set(events(chart).map(eventId)));
  const moving = source.filter(select);
  const notes = moving.map((note) => ({
    ...note,
    beat: note.beat + delta,
    column: note.column + deltaColumn,
  }));
  const map = new Map(notes.map((note) => [eventId(note), note]));
  const pairs = longPairs(chart)
    .pairs.filter((pair) => pair.every((note) => map.has(eventId(note))))
    .map((pair) => pair.map((note) => map.get(eventId(note))));
  const preview = createDragPreview(
    chart,
    source,
    moving,
    { notes, pairs },
    { copy, nt: true },
  );
  assert.deepEqual(chart, before, "preview never edits the document");
  return { chart, moving, source, preview };
}

test("moving a group onto its own previous positions does not collide with itself", () => {
  const { chart, moving, preview } = scene("#00011:0102", 2);
  assert.equal(preview.hiddenIds.size, 2);
  assert.deepEqual(
    preview.notes.map((note) => note.beat),
    [2, 4],
  );
  assert.equal(preview.errorEvents.size, 0);
  putCaptured(chart, moving, { deltaBeat: 2 });
  assert.deepEqual(
    events(chart).map((note) => [note.value, note.beat]),
    [
      ["01", 2],
      ["02", 4],
    ],
  );
  assert.deepEqual(statistics(chart, { nt: true }).errorEvents, []);
});

test("a long note moving through its own old span has one body and no self-collision", () => {
  const { preview } = scene("#00051:0102", 1);
  assert.equal(preview.hiddenIds.size, 2);
  assert.deepEqual(
    preview.pairs[0].map((note) => note.beat),
    [1, 3],
  );
  assert.equal(preview.errorEvents.size, 0);
});

test("moving away clears old overlap errors on stationary notes", () => {
  const { source, preview } = scene("#00051:0102\n#00011:0003", 4, {
    select: (note) => note.channel === "51",
  });
  assert.equal(
    preview.hiddenIds.has(
      eventId(source.find((note) => note.channel === "11")),
    ),
    false,
  );
  assert.equal(preview.errorEvents.size, 0);
});

test("new collisions are checked at the moving long note's current position", () => {
  const { source, preview } = scene("#00051:0102\n#00111:0003", 4, {
    select: (note) => note.channel === "51",
  });
  assert(
    preview.errorEvents.has(
      eventId(source.find((note) => note.channel === "11")),
    ),
  );
});

test("horizontal moves use the destination column for collision checks", () => {
  const { preview } = scene("#00011:01\n#00012:02", 0, {
    select: (note) => note.channel === "11",
    deltaColumn: 1,
  });
  assert.equal(preview.errorEvents.size, 1);
  assert(preview.errorEvents.has(eventId(preview.notes[0])));
});

test("copy preview retains the source and checks overlaps against it", () => {
  const { preview } = scene("#00011:0102", 2, { copy: true });
  assert.equal(preview.hiddenIds.size, 0);
  assert(preview.errorEvents.has(eventId(preview.notes[0])));
});

test("resizing a short note gives its two preview endpoints unique identities", () => {
  const chart = parseBMS("#00011:01"),
    source = captureNotes(chart, new Set(events(chart).map(eventId)));
  const a = { ...source[0], channel: "51" },
    b = { ...a, beat: 2 };
  const preview = createDragPreview(
    chart,
    source,
    source,
    { notes: [a, b], pairs: [[a, b]] },
    { nt: true },
  );
  assert.equal(new Set(preview.notes.map(eventId)).size, 2);
  assert.equal(preview.errorEvents.size, 0);
  assert.equal(preview.pairs[0][1], preview.notes[1]);
});
