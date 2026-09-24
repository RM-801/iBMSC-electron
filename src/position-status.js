// Form1.vb: POStatusRefresh, GCD. The editor stores beats; iBMSC uses 48 units/beat.
export const statusNumber = (value) => String(Number(value.toFixed(10)));

function reducedGCD(a, b, limit) {
  let high = Math.max(a, b),
    low = Math.min(a, b);
  while (low >= limit - 1e-9) {
    const remainder = high - Math.floor(high / low + 1e-10) * low;
    high = low;
    low = remainder;
  }
  return high;
}

// VB CInt rounds exact halves to the nearest even integer.
function cint(n) {
  const floor = Math.floor(n);
  return Math.abs(n - floor - 0.5) < 1e-9 ? floor + (floor % 2) : Math.round(n);
}

export function positionStatus(starts, beat, grid = 16, gridLimit = 1) {
  const measure = starts.findIndex(
    (start, i) => beat >= start && beat < starts[i + 1],
  );
  if (measure < 0 || !Number.isFinite(grid) || grid <= 0) return null;
  const offset = (beat - starts[measure]) * 48;
  const length = (starts[measure + 1] - starts[measure]) * 48;
  const gcd = reducedGCD(offset || length, length, Math.max(1e-9, gridLimit));
  return {
    measure: String(measure).padStart(3, "0"),
    grid: `${statusNumber((offset * grid) / 192)} / ${statusNumber((length * grid) / 192)}`,
    reduced: `${cint(offset / gcd)} / ${cint(length / gcd)}`,
    measurePosition: `${statusNumber(offset)} / ${statusNumber(length)}`,
    absolute: statusNumber(beat * 48),
  };
}
