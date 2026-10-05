import test from "node:test";
import assert from "node:assert/strict";
import { createTouchGestures } from "../src/touch-gestures.js";

function setup(options = {}) {
  const calls = [],
    timers = new Map();
  let time = 1000,
    timerId = 0;
  const pane = {
    setPointerCapture(id) {
      calls.push(["capture", id]);
    },
    releasePointerCapture(id) {
      calls.push(["release", id]);
    },
  };
  const gestures = createTouchGestures({
    focus: (e) => calls.push(["focus", e]),
    canEdit: () => true,
    beginEdit: (e) => calls.push(["begin", e]),
    moveEdit: (e) => calls.push(["move", e]),
    endEdit: (e) => calls.push(["end", e]),
    cancelEdit: (e) => calls.push(["cancel", e]),
    pan: (...args) => calls.push(["pan", ...args]),
    transform: (...args) => calls.push(["transform", ...args]),
    finishNavigation: () => calls.push(["finish"]),
    setTimer(fn) {
      const id = ++timerId;
      timers.set(id, fn);
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    now: () => time,
    ...options,
  });
  function event(id = 1, x = 10, y = 20, extra = {}) {
    return {
      currentTarget: pane,
      target: pane,
      pointerId: id,
      pointerType: "touch",
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
      ...extra,
    };
  }
  return {
    pane,
    calls,
    gestures,
    event,
    timers,
    named: (name) => calls.filter(([type]) => type === name),
    edits: () =>
      calls.filter(([type]) =>
        ["begin", "move", "end", "cancel"].includes(type),
      ),
    hold() {
      const waiting = [...timers.values()];
      timers.clear();
      waiting.forEach((fn) => fn());
    },
    advance(ms) {
      time += ms;
    },
  };
}

test("touch tap defers selection or writing until release", () => {
  const s = setup();
  const down = s.event();
  assert.equal(s.gestures.down(down), true);
  assert.equal(down.prevented, true);
  assert.equal(s.edits().length, 0);
  s.gestures.move(s.event(1, 13, 22));
  s.gestures.up(s.event(1, 13, 22));
  assert.deepEqual(
    s.edits().map(([name]) => name),
    ["begin", "end"],
  );
  assert.equal(s.named("begin")[0][1].deferredTouch, true);
  assert.equal(s.timers.size, 0);
  assert.equal(s.named("finish").length, 0);
});

test("single finger drag scrolls from its origin without editing or a late hold", () => {
  const s = setup();
  s.gestures.down(s.event());
  s.gestures.move(s.event(1, 13, 22));
  s.gestures.move(s.event(1, 30, 35));
  s.hold();
  s.gestures.move(s.event(1, 35, 25));
  s.gestures.up(s.event(1, 35, 25));
  assert.deepEqual(s.named("pan"), [
    ["pan", s.pane, -20, -15],
    ["pan", s.pane, -5, 10],
  ]);
  assert.equal(s.edits().length, 0);
  assert.equal(s.named("finish").length, 1);
});

test("tap jitter cannot become a mouse-threshold move or a short long note", () => {
  const s = setup();
  s.gestures.down(s.event(1, 10, 20));
  s.gestures.move(s.event(1, 16, 20));
  s.gestures.up(s.event(1, 16, 20));
  const start = s.named("begin")[0][1],
    end = s.named("end")[0][1];
  assert.equal(end.clientX, start.clientX);
  assert.equal(end.clientY, start.clientY);
  assert.equal(s.named("pan").length, 0);
});

test("release far from the initial contact without move events cannot write", () => {
  const s = setup();
  s.gestures.down(s.event());
  s.gestures.up(s.event(1, 200, 200));
  assert.equal(s.edits().length, 0);
});

test("hold starts an edit with a stable event, then drag and release complete it", () => {
  const s = setup();
  const down = s.event(1, 10, 20, { shiftKey: true });
  s.gestures.down(down);
  down.currentTarget = null;
  down.clientX = 999;
  down.shiftKey = false;
  s.hold();
  s.gestures.move(s.event(1, 30, 40));
  s.gestures.up(s.event(1, 40, 50));
  const begin = s.named("begin")[0][1];
  assert.equal(begin.currentTarget, s.pane);
  assert.equal(begin.clientX, 10);
  assert.equal(begin.shiftKey, true);
  assert.equal(begin.deferredTouch, true);
  assert.deepEqual(
    s.edits().map(([name]) => name),
    ["begin", "move", "move", "end"],
  );
  assert.equal(s.named("pan").length, 0);
});

test("unsafe hold cannot start editing, but a short tap can still write", () => {
  const s = setup({ canEdit: () => false });
  s.gestures.down(s.event());
  s.hold();
  assert.equal(s.edits().length, 0);
  s.gestures.move(s.event(1, 50, 80));
  s.gestures.up(s.event(1, 50, 80));
  assert.equal(s.edits().length, 0);
  s.gestures.down(s.event());
  s.gestures.up(s.event());
  assert.deepEqual(
    s.edits().map(([name]) => name),
    ["begin", "end"],
  );
});

test("pinch cancels a held edit and emits incremental zoom and center translation", () => {
  const s = setup();
  s.gestures.down(s.event(1, 0, 0));
  s.hold();
  s.gestures.move(s.event(1, 5, 0));
  s.gestures.down(s.event(2, 105, 0));
  s.gestures.move(s.event(2, 205, 0));
  assert.equal(s.named("cancel").length, 1);
  assert.deepEqual(s.named("transform"), [
    ["transform", s.pane, 2, { x: 55, y: 0 }, { x: 105, y: 0 }],
  ]);
  s.gestures.up(s.event(2, 205, 0));
  s.hold();
  s.gestures.move(s.event(1, 15, 10));
  s.gestures.up(s.event(1, 15, 10));
  assert.deepEqual(s.named("pan"), [["pan", s.pane, -10, -10]]);
  assert.equal(s.named("begin").length, 1);
  assert.equal(s.named("end").length, 0);
  assert.equal(s.named("finish").length, 1);
});

test("two fingers before a hold never select and the remaining finger never taps", () => {
  const s = setup();
  s.gestures.down(s.event(1, 0, 0));
  s.gestures.down(s.event(2, 100, 0));
  s.hold();
  s.gestures.up(s.event(1, 0, 0));
  s.hold();
  s.gestures.up(s.event(2, 100, 0));
  assert.equal(s.edits().length, 0);
});

test("extra fingers are ignored for geometry and do not cause a transform jump", () => {
  const s = setup();
  s.gestures.down(s.event(1, 0, 0));
  s.gestures.down(s.event(2, 100, 0));
  s.gestures.down(s.event(3, 300, 0));
  s.gestures.move(s.event(3, 900, 0));
  assert.equal(s.named("transform").length, 0);
  s.gestures.up(s.event(1, 0, 0));
  s.gestures.move(s.event(2, 200, 0));
  assert.equal(s.named("transform")[0][2], 700 / 800);
  s.gestures.stop();
  assert.equal(s.edits().length, 0);
});

test("touches in different panes cannot become a cross-pane pinch or edit", () => {
  const s = setup();
  const other = {};
  s.gestures.down(s.event());
  s.hold();
  s.gestures.down(s.event(2, 100, 100, { currentTarget: other }));
  s.gestures.move(s.event(1, 50, 60));
  s.gestures.move(s.event(2, 150, 150, { currentTarget: other }));
  assert.equal(s.named("cancel").length, 1);
  assert.equal(s.named("transform").length, 0);
  assert.equal(s.named("pan").length, 0);
  s.gestures.up(s.event(1, 50, 60));
  s.gestures.move(s.event(2, 160, 170, { currentTarget: other }));
  assert.deepEqual(s.named("pan"), [["pan", other, -10, -20]]);
  s.gestures.up(s.event(2, 160, 170, { currentTarget: other }));
  assert.equal(s.named("end").length, 0);
});

test("cancel and stop clear pending holds and never commit an editing preview", () => {
  for (const method of ["cancel", "stop"]) {
    for (const held of [false, true]) {
      const s = setup();
      s.gestures.down(s.event());
      if (held) s.hold();
      s.gestures[method](s.event());
      s.hold();
      s.gestures.up(s.event());
      assert.equal(s.named("begin").length, held ? 1 : 0);
      assert.equal(s.named("cancel").length, held ? 1 : 0);
      assert.equal(s.named("end").length, 0);
      assert.equal(s.timers.size, 0);
    }
  }
});

test("capture release reentrancy and unrelated cancellations cannot cancel a fresh gesture", () => {
  const s = setup();
  s.pane.releasePointerCapture = (id) => s.gestures.cancel(s.event(id));
  s.gestures.down(s.event());
  s.gestures.up(s.event());
  assert.equal(s.named("cancel").length, 0);
  s.gestures.down(s.event(2));
  s.gestures.cancel(s.event(1));
  s.hold();
  assert.equal(s.named("begin").length, 2);
  s.gestures.stop();
  assert.equal(s.named("cancel").length, 1);
});

test("touch context menus are suppressed without suppressing a real mouse right click", () => {
  const s = setup();
  s.gestures.down(s.event());
  assert.equal(
    s.gestures.context(s.event(1, 10, 20, { pointerType: "mouse" })),
    true,
  );
  s.gestures.up(s.event());
  const synthetic = s.event(1, 10, 20, { pointerType: "mouse" });
  assert.equal(s.gestures.context(synthetic), true);
  assert.equal(synthetic.prevented, true);
  s.advance(801);
  assert.equal(s.gestures.context(synthetic), false);
  assert.equal(s.gestures.context(s.event()), true);
  s.gestures.down(s.event());
  s.gestures.up(s.event());
  const mouse = s.event(3, 10, 20, { pointerType: "mouse", button: 2 });
  assert.equal(s.gestures.down(mouse), false);
  assert.equal(s.gestures.context(mouse), false);
});

test("mouse and pen pointer events pass through untouched", () => {
  const s = setup();
  for (const pointerType of ["mouse", "pen"]) {
    for (const method of ["down", "move", "up", "cancel", "context"]) {
      const event = s.event(7, 10, 20, { pointerType });
      assert.equal(s.gestures[method](event), false);
      assert.equal(event.prevented, false);
    }
  }
  assert.equal(s.calls.length, 0);
});

test("switching to mouse or pen cancels touch previews before passing through", () => {
  for (const pointerType of ["mouse", "pen"]) {
    const s = setup();
    s.gestures.down(s.event());
    s.hold();
    const down = s.event(2, 10, 20, { pointerType });
    assert.equal(s.gestures.down(down), false);
    assert.equal(down.prevented, false);
    assert.equal(s.named("cancel").length, 1);
    s.gestures.up(s.event());
    assert.equal(s.named("end").length, 0);
    assert.equal(s.gestures.context(down), false);
  }
});
