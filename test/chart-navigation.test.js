import test from "node:test";
import assert from "node:assert/strict";
import { createChartNavigation } from "../src/chart-navigation.js";
import { generalDefaults } from "../src/general-settings.js";

function fixture() {
  let active = { tagName: "BODY" },
    focused,
    stopped = 0,
    tick,
    clears = 0;
  const options = { ...generalDefaults, tool: "select", middleRelease: 1 };
  const panes = Array.from({ length: 2 }, () => {
    const pane = {
      view: { scrollTop: 1000, scrollLeft: 100, clientHeight: 400 },
    };
    pane.canvas = {
      style: {},
      focus: () => {
        active = pane.canvas;
      },
      setPointerCapture() {},
    };
    return pane;
  });
  const nav = createChartNavigation({
    panes,
    options: () => options,
    scale: () => 192,
    height: () => 5000,
    activate: (pane) => {
      focused = pane;
    },
    draw() {},
    stopPreview: () => {
      stopped++;
    },
    activeElement: () => active,
    hasFocus: () => true,
    setTimer: (fn) => {
      tick = fn;
      return 7;
    },
    clearTimer: () => {
      clears++;
      tick = null;
    },
  });
  const event = (extra = {}) => ({
    currentTarget: panes[0].canvas,
    button: 0,
    clientX: 100,
    clientY: 100,
    pointerId: 1,
    preventDefault() {
      this.prevented = true;
    },
    ...extra,
  });
  return {
    panes,
    nav,
    options,
    event,
    tick: () => tick?.(),
    get stopped() {
      return stopped;
    },
    get focused() {
      return focused;
    },
    get clears() {
      return clears;
    },
    setActive: (value) => {
      active = value;
    },
  };
}

test("first click focuses without editing; blank clicks stop only key preview", () => {
  const f = fixture();
  assert.equal(f.nav.down(f.event()), true);
  assert.equal(f.focused, f.panes[0]);
  assert.equal(f.stopped, 0);
  assert.equal(f.nav.down(f.event()), false);
  assert.equal(f.stopped, 1);
  f.options.clickstop = false;
  assert.equal(f.nav.down(f.event()), false);
  assert.equal(f.stopped, 1);
  f.setActive({ tagName: "INPUT" });
  assert.equal(f.nav.down(f.event({ button: 2 })), true);
  assert.equal(f.nav.context(f.event()), true);
  assert.equal(f.nav.context(f.event()), false);
  f.setActive({ tagName: "BODY" });
  f.options.tool = "time";
  assert.equal(f.nav.down(f.event()), false);
});

test("wheel moves the hovered pane by chart units and leaves Ctrl zoom available", () => {
  const f = fixture(),
    e = f.event({ deltaY: -120 });
  assert.equal(f.nav.wheel(e, f.panes[1]), true);
  assert.equal(e.prevented, true);
  assert.equal(f.panes[1].view.scrollTop, 616);
  assert.equal(f.panes[0].view.scrollTop, 1000);
  f.options.wheelunits = 48;
  f.nav.wheel(f.event({ deltaY: 1 }), f.panes[1]);
  assert.equal(f.panes[1].view.scrollTop, 808);
  assert.equal(
    f.nav.wheel(f.event({ ctrlKey: true, deltaY: -1 }), f.panes[1]),
    false,
  );
  assert.equal(f.panes[1].view.scrollTop, 808);
});

test("middle drag pans both axes while auto mode continues until click or wheel", () => {
  const f = fixture();
  f.options.middlemove = 1;
  assert.equal(f.nav.down(f.event({ button: 1 })), true);
  f.nav.move(f.event({ clientX: 130, clientY: 140 }));
  assert.deepEqual(
    [f.panes[0].view.scrollLeft, f.panes[0].view.scrollTop],
    [70, 960],
  );
  f.nav.up(f.event({ button: 1, clientX: 130, clientY: 140 }));
  assert.equal(f.nav.move(f.event()), false);
  f.options.middlemove = 0;
  f.nav.down(f.event({ button: 1 }));
  f.nav.up(f.event({ button: 1 }));
  f.nav.move(f.event({ clientX: 150, clientY: 200 }));
  f.tick();
  assert.deepEqual(
    [f.panes[0].view.scrollLeft, f.panes[0].view.scrollTop],
    [80, 980],
  );
  assert.equal(f.nav.down(f.event()), true);
  f.tick();
  assert.equal(f.clears, 1);
  f.nav.down(f.event({ button: 1 }));
  f.nav.wheel(f.event({ ctrlKey: true, deltaY: -1 }), f.panes[0]);
  assert.equal(f.clears, 2);
});

test("hover focus respects the option and preserves input focus", () => {
  const f = fixture();
  f.nav.enter(f.event());
  assert.equal(f.focused, undefined);
  f.options.autofocus = true;
  f.setActive({ tagName: "INPUT" });
  f.nav.enter(f.event());
  assert.equal(f.focused, undefined);
  f.setActive({ tagName: "BODY" });
  f.nav.enter(f.event({ currentTarget: f.panes[1].canvas }));
  assert.equal(f.focused, f.panes[1]);
});

// Stopping navigation or focusing must never accidentally delete a note.
test("right click consumes auto-scroll cancellation and unfocused time-tool clicks", () => {
  const f = fixture();
  f.nav.down(f.event({ button: 1 }));
  f.nav.up(f.event({ button: 1 }));
  assert.equal(f.nav.down(f.event({ button: 2 })), true);
  assert.equal(f.nav.context(f.event()), true);
  f.setActive({ tagName: "BODY" });
  f.options.tool = "time";
  assert.equal(f.nav.down(f.event({ button: 2 })), true);
  assert.equal(f.nav.context(f.event()), true);
});
