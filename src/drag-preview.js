import { eventId } from "./commands.js";
import { statistics } from "./diagnostics.js";

// Preview positions replace moving notes without editing the document/history.
// Copies retain their sources; synthetic IDs keep copied/resized endpoints distinct.
export function createDragPreview(
  chart,
  sourceNotes,
  originals,
  preview,
  { copy = false, nt = false } = {},
) {
  const hiddenIds = new Set(copy ? [] : originals.map(eventId));
  const replacements = new Map(
    preview.notes.map((note, index) => [
      note,
      {
        ...note,
        row: chart.rows.length,
        index,
      },
    ]),
  );
  const notes = preview.notes.map((note) => replacements.get(note));
  const effective = sourceNotes
    .filter((note) => !hiddenIds.has(eventId(note)))
    .concat(notes)
    .sort((a, b) => a.beat - b.beat || a.row - b.row || a.index - b.index);
  return {
    notes,
    pairs: preview.pairs.map((pair) =>
      pair.map((note) => replacements.get(note) || note),
    ),
    hiddenIds,
    errorEvents: new Set(
      statistics(chart, { nt, notes: effective }).errorEvents,
    ),
  };
}
