import { defaultColumns } from "./default-columns.js";
export const columnStyle = (col) =>
  col.theme || defaultColumns[Math.min(col.id, 26)];
export function noteRectangle(left, width, timeY, height = 10, zoom = 1) {
  return {
    x: left + 2 * zoom,
    y: timeY - height,
    width: Math.max(0, width - 4 * zoom),
    height,
  };
}
export function noteColor(value, brightness = 0) {
  const n = Number(value) >>> 0,
    alpha = (n >>> 24) / 255;
  const rgb = [16, 8, 0].map((shift) =>
    Math.round(
      ((n >>> shift) & 255) * (1 - Math.abs(brightness) / 100) +
        Math.max(0, brightness) * 2.55,
    ),
  );
  return `rgba(${rgb.join(",")},${alpha})`;
}
// Canvas and GDI+ have different font metrics. Fit the visible glyphs, not the
// nominal point size, and keep legacy label offsets inside the note border.
export function paintNoteLabel(
  ctx,
  col,
  timeY,
  text,
  {
    height = 10,
    font = "10px monospace",
    shiftX = 0,
    shiftY = 0,
    zoom = 1,
  } = {},
) {
  const rect = noteRectangle(col.left, col.width, timeY, height, zoom);
  const inner = {
    x: rect.x + zoom,
    y: rect.y + zoom,
    width: rect.width - 2 * zoom,
    height: rect.height - 2 * zoom,
  };
  if (inner.width <= 0 || inner.height <= 0 || !text) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.width, inner.height);
  ctx.clip();
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(text);
  const ascent = Math.max(0, metrics.actualBoundingBoxAscent);
  const descent = Math.max(0, metrics.actualBoundingBoxDescent);
  const scale = Math.min(1, inner.height / (ascent + descent || 1));
  const dx = Math.max(0, Math.min(inner.width, shiftX));
  const available = (inner.width - dx) / scale;
  const inkWidth = (m) =>
    Math.max(m.width, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
  let label = String(text);
  if (inkWidth(metrics) > available) {
    const chars = Array.from(label);
    let low = 0,
      high = chars.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (
        inkWidth(ctx.measureText(chars.slice(0, middle).join("") + "…")) <=
        available
      )
        low = middle;
      else high = middle - 1;
    }
    label = chars.slice(0, low).join("") + "…";
    if (inkWidth(ctx.measureText(label)) > available) {
      ctx.restore();
      return;
    }
  }
  const fitted = ctx.measureText(label);
  // Recompute vertical ink bounds after truncation (a filename's descenders
  // may have disappeared). Both positive and negative legacy shifts are bounded.
  const inkHeight =
    (fitted.actualBoundingBoxAscent + fitted.actualBoundingBoxDescent) * scale;
  const spare = Math.max(0, inner.height - inkHeight);
  const dy = Math.max(0, Math.min(spare, spare / 2 + shiftY));
  ctx.translate(
    inner.x + dx + fitted.actualBoundingBoxLeft * scale,
    inner.y + dy + fitted.actualBoundingBoxAscent * scale,
  );
  ctx.scale(scale, scale);
  ctx.fillText(label, 0, 0);
  ctx.restore();
}
export function paintNote(
  ctx,
  col,
  timeY,
  {
    long = false,
    hidden = false,
    selected = false,
    height = 10,
    opacity = 0.5,
    selectedColor = "red",
    zoom = 1,
  } = {},
) {
  const style = columnStyle(col),
    color = long ? style.LongNoteColor : style.NoteColor;
  const rect = noteRectangle(col.left, col.width, timeY, height, zoom);
  ctx.globalAlpha = hidden ? opacity : 1;
  const gradient = ctx.createLinearGradient(
    col.left,
    timeY - height - 10 * zoom,
    col.left + col.width,
    timeY + 10 * zoom,
  );
  gradient.addColorStop(0, noteColor(color, 50));
  gradient.addColorStop(1, noteColor(color, -25));
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  // Keep the entire border within the time-anchored rectangle.
  const previousLineWidth = ctx.lineWidth;
  ctx.lineWidth = zoom;
  ctx.strokeStyle = noteColor(color, 50);
  ctx.strokeRect(
    rect.x + 0.5 * zoom,
    rect.y + 0.5 * zoom,
    Math.max(0, rect.width - zoom),
    Math.max(0, rect.height - zoom),
  );
  if (selected) {
    ctx.strokeStyle = selectedColor;
    ctx.strokeRect(
      rect.x + 0.5 * zoom,
      rect.y + 0.5 * zoom,
      Math.max(0, rect.width - zoom),
      Math.max(0, rect.height - zoom),
    );
  }
  ctx.lineWidth = previousLineWidth;
  ctx.fillStyle = noteColor(long ? style.LongTextColor : style.TextColor);
  return rect;
}
