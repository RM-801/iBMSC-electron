import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseBMS, decodeBMS, serializeBMS, events, longPairs, timeline } from '../src/bms.js';
import { readProject, writeProject } from '../src/project.js';
import { readPortableProject, writePortableProject } from '../src/portable-project.js';
import { eventColumn, numericValue } from '../src/columns.js';
import { statistics, diagnose } from '../src/diagnostics.js';
import { readAsset } from '../electron/files.cjs';

const input = process.argv[2];
if (!input) throw Error('Usage: node scripts/verify-chart.mjs chart.bms [report.json]');
const bytes = await fs.readFile(input);
const chart = parseBMS(decodeBMS(bytes));
const semantic = c => events(c).map(e => JSON.stringify({
  beat: Math.round(e.beat * 1e9) / 1e9,
  column: eventColumn(c, e), value: numericValue(c, e),
  long: !!e.bgmLong || /^[5-8]/.test(e.channel), hidden: /^[3478]/.test(e.channel),
})).sort();
const roundtrips = {};
for (const [format, reopen] of [
  ['bms', () => parseBMS(serializeBMS(chart))],
  ['ibmsc', () => readProject(writeProject(chart))],
  ['ibmscx', () => readPortableProject(writePortableProject(chart))],
]) {
  try {
    const restored = reopen();
    assert.deepEqual(semantic(restored), semantic(chart));
    assert.deepEqual(restored.resources.WAV, chart.resources.WAV);
    assert.deepEqual(restored.ratios, chart.ratios);
    assert.equal(longPairs(restored).pairs.length, longPairs(chart).pairs.length);
    roundtrips[format] = { passed: true };
  } catch (error) { roundtrips[format] = { passed: false, error: error.message.slice(0, 1500) }; }
}
const assets = { checked: 0, readable: 0, signatures: {}, failures: [] };
for (const [id, name] of Object.entries(chart.resources.WAV)) {
  assets.checked++;
  try {
    const data = await readAsset(path.dirname(input), name);
    const signature = Buffer.from(data.slice(0, 4)).toString('ascii');
    assets.signatures[signature] = (assets.signatures[signature] || 0) + 1;
    assets.readable++;
  } catch (error) { assets.failures.push({ id, name, error: error.message }); }
}
const playback = timeline(chart);
assert(playback.every(e => Number.isFinite(e.time) && e.time >= 0));
const report = {
  version: 1, chart: path.basename(input), sha256: createHash('sha256').update(bytes).digest('hex'),
  title: chart.headers.TITLE, player: chart.headers.PLAYER, bpm: chart.headers.BPM,
  events: events(chart).length, lastMeasure: Math.max(0, ...chart.rows.map(r => r.measure)),
  longPairs: longPairs(chart).pairs.length, statistics: statistics(chart),
  diagnostics: diagnose(chart), roundtrips, assets,
  playback: { events: playback.length, lastStartSeconds: playback.at(-1)?.time ?? 0 },
  limitations: ['File and timing validation only; no actual audio audition or graphical interaction.',
    'The ibmsc check uses an export produced by this port, not an original application fixture.'],
};
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv[3]) await fs.writeFile(process.argv[3], json);
console.log(json);
if (assets.failures.length || Object.values(roundtrips).some(r => !r.passed)) process.exitCode = 1;
