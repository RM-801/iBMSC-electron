import { defaultColumns } from "./default-columns.js";
export const columnStyle = (col) =>
  col.theme || defaultColumns[Math.min(col.id, 26)];
export function noteRectangle(left, width, timeY, height = 10) {
  return {
    x: left + 2,
    y: timeY - height,
    width: Math.max(0, width - 4),
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
  } = {},
) {
  const style = columnStyle(col),
    color = long ? style.LongNoteColor : style.NoteColor;
  const rect = noteRectangle(col.left, col.width, timeY, height);
  ctx.globalAlpha = hidden ? opacity : 1;
  const gradient = ctx.createLinearGradient(
    col.left,
    timeY - height - 10,
    col.left + col.width,
    timeY + 10,
  );
  gradient.addColorStop(0, noteColor(color, 50));
  gradient.addColorStop(1, noteColor(color, -25));
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  // Keep the entire border within the time-anchored rectangle.
  ctx.strokeStyle = noteColor(color, 50);
  ctx.strokeRect(
    rect.x + 0.5,
    rect.y + 0.5,
    Math.max(0, rect.width - 1),
    Math.max(0, rect.height - 1),
  );
  if (selected) {
    ctx.strokeStyle = selectedColor;
    ctx.strokeRect(
      rect.x + 0.5,
      rect.y + 0.5,
      Math.max(0, rect.width - 1),
      Math.max(0, rect.height - 1),
    );
  }
  ctx.fillStyle = noteColor(long ? style.LongTextColor : style.TextColor);
  return rect;
}
