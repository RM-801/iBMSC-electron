import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playbackPlan, voiceStart } from '../src/playback-plan.js';
import { parseBMS, timeline } from '../src/bms.js';
import { timeMap } from '../src/timing.js';

test('seek resumes overlapping BGM and key tails, excludes completed audio, and starts boundary notes once', () => {
  const events = [
    { time: 0, value: 'bgm' }, { time: 1, value: 'done' },
    { time: 2, value: 'bgm' }, { time: 3, value: 'key' },
    { time: 5, value: 'boundary' }, { time: 6, value: 'missing' },
  ];
  const durations = { bgm: 10, done: 4, key: 3, boundary: 2 };
  const plan = playbackPlan(events, 5, e => durations[e.value] && { duration: durations[e.value] });
  assert.deepEqual(plan.map(v => [v.event.value, v.at, v.offset]), [
    ['bgm', 0, 5], ['bgm', 0, 3], ['key', 0, 2], ['boundary', 0, 0], ['missing', 1, 0],
  ]);
  assert.deepEqual(voiceStart(plan[0], 100, 99), { when: 100, offset: 5, end: 105 });
  assert.deepEqual(voiceStart(plan[0], 100, 102), { when: 102, offset: 7, end: 105 });
  assert.equal(voiceStart(plan[0], 100, 105), null);
});

test('seek uses BPM and STOP elapsed seconds and does not schedule LN ends', () => {
  const chart = parseBMS('#BPM 120\n#BPM01 60\n#STOP01 48\n#00001:01\n#00108:01\n#00109:01\n#00051:02\n#00251:02');
  const offset = timeMap(chart).beatToSeconds(8);
  assert.equal(offset, 7);
  const plan = playbackPlan(timeline(chart), offset, () => ({ duration: 12 }));
  assert.equal(plan.length, 2);
  assert.ok(plan.every(v => v.offset === 7 && v.at === 0));
  const beginning = playbackPlan(timeline(chart), 0, () => ({ duration: 12 }));
  assert.ok(beginning.every(v => v.offset === 0));
});
