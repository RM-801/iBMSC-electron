// Original Grid and Sub divisions are independent, each measured in a 4-beat bar.
export function gridOffsets(length, division) {
  const step = 4 / Math.max(1, Math.min(65536, Number(division) || 16));
  const count = Math.ceil(length / step);
  const stride = Math.max(1, Math.ceil(count / 512));
  return Array.from(
    { length: Math.ceil(count / stride) },
    (_, i) => i * stride * step,
  );
}
