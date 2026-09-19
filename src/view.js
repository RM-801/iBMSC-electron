import { rationalFraction } from "./project.js";
import { events, measureStarts } from "./bms.js";

export function scrollEndBeat(chart) {
  const last = events(chart).reduce((end, n) => Math.max(end, n.beat), 0);
  return Math.min(measureStarts(chart).at(-1), last + 2000 / 48);
}
export function showsSecondPlayer(chart) {
  return [2, 3].includes(Number(chart.headers.PLAYER || 1));
}
export function viewportGeometry(
  starts,
  scale,
  scrollTop,
  viewportHeight,
  contentHeight = starts.at(-1) * scale + 30,
) {
  const height = Math.max(viewportHeight, contentHeight);
  const top = Math.max(0, Math.min(scrollTop, height - viewportHeight));
  return {
    height,
    top,
    toY: (beat) => height - 20 - beat * scale - top,
    toBeat: (y) => (height - 20 - top - y) / scale,
  };
}

// User preference: snap to the nearest grid line, keeping 4/grid beats per
// step. Measure boundaries are candidates even when a short bar truncates a step.
export function snappedPosition(starts, beat, grid = 16, snap = true) {
  let measure = starts.findIndex((v, i) => beat >= v && beat < starts[i + 1]);
  if (measure < 0) return null;
  const length = starts[measure + 1] - starts[measure];
  const offset = beat - starts[measure];
  if (!snap) return {
    measure,
    slot: Math.min(65535, Math.round((offset / length) * 65536)),
    division: 65536,
    beat,
  };
  const step = 4 / grid;
  const lower = starts[measure] + Math.floor(offset / step + 1e-9) * step;
  const upper = Math.min(starts[measure + 1], lower + step);
  // Ties go forward in time (up on screen). Never write into measure 1000.
  const target = upper < starts.at(-1) && upper - beat <= beat - lower + 1e-9
    ? upper : lower;
  if (target >= starts[measure + 1] - 1e-9) measure++;
  const [slot, division] = rationalFraction(
    (target - starts[measure]) / (starts[measure + 1] - starts[measure]),
  );
  return { measure, slot, division, beat };
}

// Invert the actual bitmap-to-CSS transform, including fractional device scales.
export function pointerBeat(rendered, rect, bitmapHeight, clientY) {
  const localY =
    ((clientY - rect.top) * bitmapHeight) / (rect.height * rendered.pixelRatio);
  return (rendered.height - 20 - rendered.top - localY) / rendered.scale;
}

// Form1.VerticalPositiontoDisplay uses integer panel pixels. All chart marks
// share this projection; the inverse resolves the same raster pixel to its grid.
export function displayedBeatY(rendered, beat) {
  return Math.round(rendered.height - 20 - rendered.top - beat * rendered.scale);
}
export function pointerPosition(starts, rendered, rect, bitmapHeight, clientY, grid, snap) {
  // No one-sided pixel bias: above and below each line share half a grid cell.
  return snappedPosition(starts,
    pointerBeat(rendered, rect, bitmapHeight, clientY), grid, snap);
}
