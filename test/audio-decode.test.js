import test from "node:test";
import assert from "node:assert/strict";
import { decodeAudio } from "../src/audio-decode.js";

// One mono block: two header samples (900, 1000) and +1/+2 nibbles at delta 16.
const adpcm = Buffer.from(
  "524946463600000057415645666d74201a0000000200010044ac00008858010008000400080004000100000100006461746108000000001000e803840312",
  "hex",
);

test("ADPCM produces an AudioBuffer at its original rate without native codec support", async () => {
  const context = {
    decodeAudioData() {
      throw Error("Native ADPCM unsupported");
    },
    createBuffer(channels, length, sampleRate) {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(length),
      );
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        copyToChannel(samples, channel) {
          data[channel].set(samples);
        },
        getChannelData(channel) {
          return data[channel];
        },
      };
    },
  };
  const before = Buffer.from(adpcm);
  const audio = await decodeAudio(context, adpcm);
  assert.equal(audio.numberOfChannels, 1);
  assert.equal(audio.sampleRate, 44100);
  assert.equal(audio.length, 4);
  assert.deepEqual(
    Array.from(audio.getChannelData(0), (n) => n * 32768),
    [900, 1000, 1016, 1048],
  );
  assert.deepEqual(adpcm, before);
});

test("other codecs use only the requested bytes and preserve native errors and caller data", async () => {
  const input = new Uint8Array([9, 1, 2, 3, 9]);
  let received;
  const context = {
    async decodeAudioData(data) {
      received = new Uint8Array(data);
      received[0] = 7;
      return "native";
    },
  };
  assert.equal(await decodeAudio(context, input.subarray(1, 4)), "native");
  assert.deepEqual([...received], [7, 2, 3]);
  assert.deepEqual([...input], [9, 1, 2, 3, 9]);
  const failure = Error("Unsupported codec");
  await assert.rejects(
    decodeAudio(
      {
        decodeAudioData() {
          throw failure;
        },
      },
      new Uint8Array([1]).buffer,
    ),
    (error) => error === failure,
  );
});
