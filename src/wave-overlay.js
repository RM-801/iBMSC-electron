import { events } from "./bms.js";
// RefreshPanel (Form1.vb 5687–5739) maps waveform samples through BPM changes.
// The original overlay does not include STOP pauses (audio playback still does).
export function waveformClock(chart) {
  let bpm = Number(chart.headers.BPM),
    beat = 0,
    seconds = 0;
  if (!Number.isFinite(bpm) || bpm <= 0) throw Error("波形需要有效初始 BPM");
  const points = [{ beat, seconds, bpm }];
  for (const e of events(chart)) {
    if (!["03", "08"].includes(e.channel)) continue;
    seconds += ((e.beat - beat) * 60) / bpm;
    beat = e.beat;
    bpm =
      e.channel === "03"
        ? parseInt(e.value, 16)
        : Number(chart.resources.BPM[e.value]);
    if (!Number.isFinite(bpm) || bpm <= 0) throw Error("波形遇到无效 BPM 定义");
    points.push({ beat, seconds, bpm });
  }
  return (b) => {
    let low = 0,
      high = points.length;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if (points[middle].beat <= b) low = middle;
      else high = middle;
    }
    const p = points[low];
    return p.seconds + ((b - p.beat) * 60) / p.bpm;
  };
}
export function waveformSample(samples, sampleRate, seconds) {
  const index = Math.floor(seconds * sampleRate);
  return index >= 0 && index < samples.length ? samples[index] : 0;
}
