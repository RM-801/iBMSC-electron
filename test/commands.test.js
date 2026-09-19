import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMS, events } from "../src/bms.js";
import {
  captureNotes,
  putCaptured,
  mirrorCaptured,
  eventId,
} from "../src/commands.js";
test("selected notes move together without moving other notes", () => {
  const c = parseBMS("#00011:01000100\n#00012:01");
  const notes = captureNotes(
    c,
    new Set(
      events(c)
        .filter((e) => e.channel === "11")
        .map(eventId),
    ),
  );
  putCaptured(c, notes, { deltaBeat: 4 });
  assert.deepEqual(
    events(c).map((e) => [e.channel, e.beat]),
    [
      ["12", 0],
      ["11", 4],
      ["11", 6],
    ],
  );
});
test("multi-copy and hidden-long conversion preserve positions", () => {
  const c = parseBMS("#00011:000100");
  const notes = captureNotes(c, new Set(events(c).map(eventId)));
  putCaptured(c, notes, { copy: true, deltaBeat: 4, long: true, hidden: true });
  assert.equal(events(c)[1].channel, "71");
  assert.ok(Math.abs(events(c)[1].beat - 16 / 3) < 1e-9);
});
test("mirror is simultaneous even for exchanged lanes", () => {
  const c = parseBMS("#00011:01\n#00019:02");
  mirrorCaptured(c, captureNotes(c, new Set(events(c).map(eventId))));
  assert.deepEqual(
    events(c)
      .map((e) => [e.channel, e.value])
      .sort(),
    [
      ["11", "02"],
      ["19", "01"],
    ],
  );
});

test("keyboard nudge preserves spacing at lower boundary and uses fine steps", async () => {
  const { nudgeCaptured } = await import("../src/commands.js");
  const c = parseBMS("#00011:0101");
  let notes = captureNotes(c, new Set(events(c).map(eventId)));
  nudgeCaptured(c, notes, "ArrowDown");
  assert.deepEqual(
    events(c).map((e) => e.beat),
    [0, 2],
  );
  notes = captureNotes(c, new Set(events(c).map(eventId)));
  nudgeCaptured(c, notes, "ArrowUp", 16, true);
  assert.ok(Math.abs(events(c)[0].beat - 1 / 48) < 1e-9);
});
