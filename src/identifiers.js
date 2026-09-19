// BMS BASE selects resource indices/data, not channel numbers or channel 03 BPM.
const digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export function chartBase(chart) {
  const base = Number(chart?.headers?.BASE ?? 36);
  if (![16, 36, 62].includes(base)) throw Error("仅支持 #BASE 16、36 或 62");
  return base;
}
export function normalizeId(chart, value) {
  const text = String(value).trim();
  return chartBase(chart) === 62 ? text : text.toUpperCase();
}
export function validId(chart, value, allowZero = false) {
  const text = normalizeId(chart, value),
    base = chartBase(chart);
  return (
    text.length === 2 &&
    [...text].every(
      (c) => digits.indexOf(c) >= 0 && digits.indexOf(c) < base,
    ) &&
    (allowZero || text !== "00")
  );
}
export function decodeId(chart, value) {
  const text = normalizeId(chart, value);
  if (!validId(chart, text, true)) return NaN;
  return digits.indexOf(text[0]) * chartBase(chart) + digits.indexOf(text[1]);
}
export function encodeId(chart, n) {
  const base = chartBase(chart);
  if (!Number.isInteger(n) || n < 0 || n >= base * base)
    throw Error("编号超出当前 BASE 范围");
  return digits[Math.floor(n / base)] + digits[n % base];
}
const lists = new Map();
export function resourceIds(chart) {
  const base = chartBase(chart);
  if (!lists.has(base))
    lists.set(
      base,
      Object.freeze(
        Array.from({ length: base * base - 1 }, (_, i) =>
          encodeId(chart, i + 1),
        ),
      ),
    );
  return lists.get(base);
}
