import { events, measureStarts } from "./bms.js";
export function timeMap(chart) {
  let bpm = Number(chart.headers.BPM),
    beat = 0,
    seconds = 0;
  const segments = [],
    list = events(chart).filter((e) => ["03", "08", "09"].includes(e.channel));
  if (!Number.isFinite(bpm) || bpm <= 0) throw Error("初始 BPM 无效");
  let i = 0;
  const advance = (to) => {
    if (to > beat) {
      const end = seconds + ((to - beat) * 60) / bpm;
      segments.push({
        beat,
        endBeat: to,
        seconds,
        endSeconds: end,
        bpm,
        stop: false,
      });
      seconds = end;
      beat = to;
    }
  };
  while (i < list.length) {
    const at = list[i].beat;
    advance(at);
    const group = [];
    while (i < list.length && list[i].beat === at) group.push(list[i++]);
    for (const e of group.filter((e) => e.channel !== "09")) {
      bpm =
        e.channel === "03"
          ? parseInt(e.value, 16)
          : Number(chart.resources.BPM[e.value]);
      if (!Number.isFinite(bpm) || bpm <= 0) throw Error("BPM 定义无效");
    }
    for (const e of group.filter((e) => e.channel === "09")) {
      const value = Number(chart.resources.STOP[e.value]);
      if (!Number.isFinite(value) || value < 0) throw Error("STOP 定义无效");
      const end = seconds + ((value / 48) * 60) / bpm;
      segments.push({
        beat,
        endBeat: beat,
        seconds,
        endSeconds: end,
        bpm,
        stop: true,
      });
      seconds = end;
    }
  }
  advance(measureStarts(chart).at(-1));
  return {
    segments,
    beatToSeconds(b) {
      const s = segments.find((s) => b >= s.beat && b <= s.endBeat);
      if (!s) return b <= 0 ? 0 : seconds;
      return s.stop ? s.seconds : s.seconds + ((b - s.beat) * 60) / s.bpm;
    },
    secondsToBeat(t) {
      const s = segments.find((s) => t >= s.seconds && t < s.endSeconds);
      if (!s) return t <= 0 ? 0 : beat;
      return s.stop ? s.beat : s.beat + ((t - s.seconds) * s.bpm) / 60;
    },
  };
}
export function waveformPeaks(samples, bins) {
  if (!Number.isInteger(bins) || bins < 1) throw Error("波形列数无效");
  return Array.from({ length: bins }, (_, i) => {
    let min = 0,
      max = 0;
    const from = Math.floor((i * samples.length) / bins),
      to = Math.min(
        samples.length,
        Math.max(from + 1, Math.floor(((i + 1) * samples.length) / bins)),
      );
    for (let j = from; j < to; j++) {
      min = Math.min(min, samples[j]);
      max = Math.max(max, samples[j]);
    }
    return [min, max];
  });
}
export function calculateBPM(beats, seconds) {
  if (
    !Number.isFinite(beats) ||
    beats <= 0 ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  )
    throw Error("拍数和秒数必须为正数");
  return (60 * beats) / seconds;
}
