import test from "node:test";
import assert from "node:assert/strict";
import { KeyPreview } from "../src/key-preview.js";

function audioMock() {
  const voices = [];
  return {
    voices, destination: {},
    createBufferSource() {
      const source = { stopped: 0, disconnected: 0, started: 0,
        connect() {}, start() { this.started++; },
        stop() { this.stopped++; }, disconnect() { this.disconnected++; } };
      voices.push(source);
      return source;
    },
  };
}
test("each click stops the preceding audition, including the same key; stop also cancels audition", async () => {
  const audio = audioMock(), preview = new KeyPreview(async () => audio), buffer = {};
  await preview.play(buffer);
  await preview.play(buffer);
  assert.equal(audio.voices[0].stopped, 1);
  assert.equal(audio.voices[0].disconnected, 1);
  assert.equal(audio.voices[1].started, 1);
  preview.stop();
  assert.equal(audio.voices[1].stopped, 1);
  assert.equal(preview.source, null);
  await preview.play(buffer);
  audio.voices[2].onended();
  assert.equal(preview.source, null);
  assert.equal(audio.voices[2].disconnected, 1);
  await preview.play(buffer);
  await assert.rejects(preview.play(undefined), /加载音源/);
  assert.equal(audio.voices[3].stopped, 1);
});
test("rapid clicks and stop during AudioContext resume cannot resurrect an older audition", async () => {
  const audio = audioMock(), pending = [];
  const preview = new KeyPreview(() => new Promise(resolve => pending.push(resolve)));
  const old = preview.play({ id: 1 }), latest = preview.play({ id: 2 });
  pending[1](audio);
  await latest;
  pending[0](audio);
  await old;
  assert.equal(audio.voices.length, 1);
  assert.equal(audio.voices[0].buffer.id, 2);
  const canceled = preview.play({ id: 3 });
  preview.stop();
  pending[2](audio);
  await canceled;
  assert.equal(audio.voices.length, 1);
});
