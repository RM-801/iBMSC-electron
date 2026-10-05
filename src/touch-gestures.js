// Touch navigation is separate from chart editing so a pan or pinch cannot
// accidentally place, select, move, or delete notes while it is being recognised.
export function createTouchGestures({
  focus = () => {},
  canEdit = () => false,
  beginEdit = () => {},
  moveEdit = () => {},
  endEdit = () => {},
  cancelEdit = () => {},
  pan = () => {},
  transform = () => {},
  finishNavigation = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
  holdDelay = 450,
  dragThreshold = 8,
  contextDelay = 800,
} = {}) {
  const contacts = new Map();
  let mode = "idle",
    timer = null,
    target = null,
    first = null,
    navigating = false,
    lastTouchEnd = -Infinity,
    lastTouchTarget = null;

  function snapshot(e, currentTarget = e.currentTarget) {
    // DOM events lose currentTarget after dispatch. A hold must keep the pane
    // and pointer coordinates from the original event, not the mutable event.
    return {
      currentTarget,
      target: e.target,
      pointerId: e.pointerId,
      pointerType: "touch",
      isPrimary: e.isPrimary,
      button: e.button ?? 0,
      buttons: e.buttons ?? 1,
      clientX: e.clientX,
      clientY: e.clientY,
      pageX: e.pageX,
      pageY: e.pageY,
      screenX: e.screenX,
      screenY: e.screenY,
      ctrlKey: Boolean(e.ctrlKey),
      metaKey: Boolean(e.metaKey),
      altKey: Boolean(e.altKey),
      shiftKey: Boolean(e.shiftKey),
      timeStamp: e.timeStamp,
      deferredTouch: true,
      preventDefault() {},
      stopPropagation() {},
    };
  }
  function consume(e) {
    e.preventDefault?.();
    return true;
  }
  function clearHold() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }
  function release(contact) {
    try {
      contact.current.currentTarget.releasePointerCapture?.(
        contact.current.pointerId,
      );
    } catch {
      // A cancelled pointer may already have lost its implicit capture.
    }
  }
  function cancelPreview() {
    if (mode === "edit") cancelEdit(first.current);
  }
  function navigationMode() {
    const active = [...contacts.values()];
    first = active[0] || null;
    if (!first) {
      mode = "idle";
      target = null;
      if (navigating) finishNavigation();
      navigating = false;
    } else {
      target = first.current.currentTarget;
      mode = active.some((p) => p.current.currentTarget !== target)
        ? "blocked"
        : active.length > 1
          ? "multi"
          : "pan";
    }
  }
  function geometry() {
    const [a, b] = [...contacts.values()];
    if (!a || !b) return null;
    return {
      distance: Math.hypot(
        a.current.clientX - b.current.clientX,
        a.current.clientY - b.current.clientY,
      ),
      center: {
        x: (a.current.clientX + b.current.clientX) / 2,
        y: (a.current.clientY + b.current.clientY) / 2,
      },
    };
  }
  function stop() {
    clearHold();
    cancelPreview();
    const old = [...contacts.values()];
    if (old.length) {
      lastTouchEnd = now();
      lastTouchTarget = target;
    }
    // Remove contacts before releasing capture: lostpointercapture may fire
    // synchronously, and must not cancel or commit a second time.
    contacts.clear();
    navigationMode();
    old.forEach(release);
  }

  return {
    stop,
    down(e) {
      if (e.pointerType !== "touch") {
        if (contacts.size) stop();
        lastTouchEnd = -Infinity;
        return false;
      }
      consume(e);
      if (contacts.has(e.pointerId)) return true;
      const current = snapshot(e),
        contact = { start: current, current };
      contacts.set(e.pointerId, contact);
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Capture is optional in embedded browsers and synthetic UI tests.
      }
      if (contacts.size > 1) {
        clearHold();
        cancelPreview();
        navigationMode();
        return true;
      }
      target = e.currentTarget;
      lastTouchTarget = target;
      first = contact;
      mode = "pending";
      focus(current);
      timer = setTimer(() => {
        timer = null;
        if (mode !== "pending" || first !== contact || !canEdit(contact.start))
          return;
        mode = "edit";
        beginEdit(contact.start);
        if (
          contact.current.clientX !== contact.start.clientX ||
          contact.current.clientY !== contact.start.clientY
        )
          moveEdit(contact.current);
      }, holdDelay);
      return true;
    },
    move(e) {
      if (e.pointerType !== "touch") return false;
      consume(e);
      const contact = contacts.get(e.pointerId);
      if (!contact) return true;
      const previous = contact.current,
        before = mode === "multi" ? geometry() : null;
      contact.current = snapshot(e, previous.currentTarget);
      if (mode === "edit") {
        moveEdit(contact.current);
      } else if (mode === "multi") {
        const after = geometry();
        if (
          before.center.x !== after.center.x ||
          before.center.y !== after.center.y ||
          before.distance !== after.distance
        ) {
          const ratio =
            before.distance > 0 && after.distance > 0
              ? after.distance / before.distance
              : 1;
          navigating = true;
          transform(target, ratio, before.center, after.center);
        }
      } else if (mode === "pending" || mode === "pan") {
        let from = previous;
        if (mode === "pending") {
          if (
            Math.hypot(
              e.clientX - contact.start.clientX,
              e.clientY - contact.start.clientY,
            ) < dragThreshold
          )
            return true;
          clearHold();
          mode = "pan";
          from = contact.start;
        }
        navigating = true;
        pan(target, from.clientX - e.clientX, from.clientY - e.clientY);
      }
      return true;
    },
    up(e) {
      if (e.pointerType !== "touch") return false;
      consume(e);
      const contact = contacts.get(e.pointerId);
      if (!contact) return true;
      clearHold();
      const current = snapshot(e, contact.current.currentTarget);
      if (mode === "pending") {
        // The final pointer position can arrive without an intervening move.
        if (
          Math.hypot(
            current.clientX - contact.start.clientX,
            current.clientY - contact.start.clientY,
          ) < dragThreshold
        ) {
          beginEdit(contact.start);
          // The editor has a smaller mouse drag threshold. Keep touch jitter
          // within a tap from turning into a short long note or a note move.
          endEdit({
            ...current,
            clientX: contact.start.clientX,
            clientY: contact.start.clientY,
            pageX: contact.start.pageX,
            pageY: contact.start.pageY,
          });
        }
      } else if (mode === "edit") {
        moveEdit(current);
        endEdit(current);
      }
      lastTouchEnd = now();
      lastTouchTarget = target;
      contacts.delete(e.pointerId);
      navigationMode();
      release(contact);
      return true;
    },
    cancel(e) {
      const contact = contacts.get(e.pointerId);
      if (!contact) return e.pointerType === "touch" ? consume(e) : false;
      consume(e);
      clearHold();
      cancelPreview();
      lastTouchEnd = now();
      lastTouchTarget = target;
      contacts.delete(e.pointerId);
      navigationMode();
      release(contact);
      return true;
    },
    context(e) {
      if (
        e.pointerType === "touch" ||
        e.sourceCapabilities?.firesTouchEvents ||
        contacts.size ||
        (e.currentTarget === lastTouchTarget &&
          now() - lastTouchEnd < contextDelay)
      )
        return consume(e);
      return false;
    },
  };
}
