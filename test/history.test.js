import { test } from "node:test";
import assert from "node:assert/strict";
import { History } from "../src/history.js";
test("undo to saved state is clean; asynchronous save marks only its snapshot", () => {
  const a = { v: 1 },
    b = { v: 2 },
    c = { v: 3 },
    history = new History(a);
  history.commit(a, b);
  assert.equal(history.isDirty(b), true);
  assert.deepEqual(history.undo(b), a);
  assert.equal(history.isDirty(a), false);
  history.redo(a);
  history.commit(b, c);
  history.markSaved(b);
  assert.equal(history.isDirty(c), true);
});
test("no-op changes preserve redo; real branches truncate redo", () => {
  const h = new History({ n: 0 });
  h.commit({ n: 0 }, { n: 1 });
  h.undo({ n: 1 });
  assert.equal(h.commit({ n: 0 }, { n: 0 }), false);
  assert.equal(h.canRedo, true);
  h.commit({ n: 0 }, { n: 2 });
  assert.equal(h.canRedo, false);
});
