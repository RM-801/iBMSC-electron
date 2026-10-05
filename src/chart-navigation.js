// Chart navigation uses BMS units (192 per measure), independently of pixel zoom.
export function createChartNavigation({
  panes,
  options,
  scale,
  height,
  activate,
  draw,
  stopPreview,
  activeElement = () => document.activeElement,
  hasFocus = () => document.hasFocus(),
  setTimer = setInterval,
  clearTimer = clearInterval,
}) {
  let middle = null,
    timer = null;
  const paneFor = (e) => panes.find((p) => p.canvas === e.currentTarget);
  function move(pane, dx, dy) {
    pane.view.scrollTop = Math.max(
      0,
      Math.min(
        Math.max(0, height() - pane.view.clientHeight),
        pane.view.scrollTop + dy,
      ),
    );
    pane.view.scrollLeft = Math.max(0, pane.view.scrollLeft + dx);
    draw();
  }
  function stopMiddle() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (middle) middle.pane.canvas.style.cursor = "";
    middle = null;
  }
  function focus(pane) {
    activate(pane);
    pane.canvas.focus?.({ preventScroll: true });
  }
  return {
    stop: stopMiddle,
    isAuto: () => Boolean(middle && !middle.drag),
    enter(e) {
      if (!options().autofocus || !hasFocus()) return;
      const active = activeElement();
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(active?.tagName) ||
        active?.isContentEditable
      )
        return;
      focus(paneFor(e));
    },
    down(e) {
      const pane = paneFor(e);
      pane.ignoreContext = false;
      if (middle) {
        focus(pane);
        pane.ignoreContext = e.button === 2;
        stopMiddle();
        e.preventDefault();
        return true;
      }
      const unfocused = activeElement() !== pane.canvas;
      focus(pane);
      if (e.button === 1) {
        e.preventDefault();
        middle = {
          pane,
          x: e.clientX,
          y: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          dx: 0,
          dy: 0,
          drag: options().middlemove === 1,
        };
        pane.canvas.setPointerCapture(e.pointerId);
        pane.canvas.style.cursor = middle.drag ? "grabbing" : "all-scroll";
        if (!middle.drag)
          timer = setTimer(() => {
            if (middle) move(middle.pane, middle.dx / 5, middle.dy / 5);
          }, 16);
        return true;
      }
      const ignored =
        unfocused && options().firstclick && options().tool !== "time";
      if (e.button === 2) {
        pane.ignoreContext = unfocused && options().firstclick;
        return true;
      }
      if (e.button !== 0 || ignored) return true;
      if (options().clickstop) stopPreview();
      return false;
    },
    move(e) {
      if (!middle) return false;
      if (middle.drag)
        move(middle.pane, middle.lastX - e.clientX, middle.lastY - e.clientY);
      else {
        middle.dx = e.clientX - middle.x;
        middle.dy = e.clientY - middle.y;
      }
      middle.lastX = e.clientX;
      middle.lastY = e.clientY;
      return true;
    },
    up(e) {
      if (!middle) return false;
      if (
        middle.drag ||
        (e.clientX - middle.x) ** 2 + (e.clientY - middle.y) ** 2 >=
          options().middleRelease
      )
        stopMiddle();
      return true;
    },
    context(e) {
      const pane = paneFor(e);
      if (!pane.ignoreContext) return false;
      pane.ignoreContext = false;
      e.preventDefault();
      return true;
    },
    wheel(e, pane) {
      stopMiddle();
      if (e.ctrlKey || !Number.isFinite(e.deltaY) || !e.deltaY) return false;
      // Horizontal trackpad gestures keep their native behavior.
      if (Math.abs(e.deltaX || 0) > Math.abs(e.deltaY)) return false;
      e.preventDefault();
      move(
        pane,
        0,
        ((Math.sign(e.deltaY) * options().wheelunits) / 48) * scale(),
      );
      return true;
    },
  };
}
