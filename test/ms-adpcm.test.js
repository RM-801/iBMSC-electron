import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeMSADPCM } from "../src/ms-adpcm.js";

const standardCoefficients = [
  [256, 0],
  [512, -256],
  [0, 0],
  [192, 64],
  [240, 0],
  [460, -208],
  [392, -232],
];
const structureError = /Microsoft ADPCM WAV 文件结构无效/;
const formatError = /Microsoft ADPCM WAV 格式参数无效/;
const blockError = /Microsoft ADPCM WAV 音频块无效/;
const sampleError = /Microsoft ADPCM WAV 样本数无效/;

function chunk(name, payload) {
  const result = Buffer.alloc(8 + payload.length + (payload.length & 1));
  result.write(name, 0, "ascii");
  result.writeUInt32LE(payload.length, 4);
  result.set(payload, 8);
  return result;
}

function riff(chunks) {
  const body = Buffer.concat([Buffer.from("WAVE"), ...chunks]);
  const result = Buffer.alloc(8 + body.length);
  result.write("RIFF", 0);
  result.writeUInt32LE(body.length, 4);
  result.set(body, 8);
  return result;
}

function format({
  channels = 1,
  blockAlign = 9,
  sampleRate = 44100,
  samplesPerBlock = 2 + ((blockAlign - channels * 7) * 2) / channels,
  coefficients = standardCoefficients,
} = {}) {
  const result = Buffer.alloc(22 + coefficients.length * 4);
  result.writeUInt16LE(2, 0);
  result.writeUInt16LE(channels, 2);
  result.writeUInt32LE(sampleRate, 4);
  result.writeUInt32LE(
    Math.floor((sampleRate * blockAlign) / samplesPerBlock),
    8,
  );
  result.writeUInt16LE(blockAlign, 12);
  result.writeUInt16LE(4, 14);
  result.writeUInt16LE(result.length - 18, 16);
  result.writeUInt16LE(samplesPerBlock, 18);
  result.writeUInt16LE(coefficients.length, 20);
  coefficients.forEach(([a, b], i) => {
    result.writeInt16LE(a, 22 + i * 4);
    result.writeInt16LE(b, 24 + i * 4);
  });
  return result;
}

function block({
  predictors = [0],
  deltas = [16],
  recent = [1000],
  older = [900],
  nibbles = [0x12, 0xf8],
} = {}) {
  const channels = predictors.length;
  const result = Buffer.alloc(channels * 7 + nibbles.length);
  predictors.forEach((predictor, i) => {
    result[i] = predictor;
    result.writeUInt16LE(deltas[i], channels + i * 2);
    result.writeInt16LE(recent[i], channels * 3 + i * 2);
    result.writeInt16LE(older[i], channels * 5 + i * 2);
  });
  result.set(nibbles, channels * 7);
  return result;
}

function wave(
  data = block(),
  { fmt = format(), fact, before = [], after = [] } = {},
) {
  const chunks = [...before, chunk("fmt ", fmt)];
  if (fact !== undefined) {
    const count = Buffer.alloc(4);
    count.writeUInt32LE(fact);
    chunks.push(chunk("fact", count));
  }
  return riff([...chunks, chunk("data", data), ...after]);
}

function pcm(result) {
  return result.channelData.map((channel) =>
    Array.from(channel, (value) => value * 32768),
  );
}

test("Microsoft ADPCM mono writes the older header sample first and high nibble first", () => {
  const result = decodeMSADPCM(wave());
  assert.equal(result.sampleRate, 44100);
  assert.ok(result.channelData[0] instanceof Float32Array);
  assert.deepEqual(pcm(result), [[900, 1000, 1016, 1048, 1032, 904]]);
});

test("Microsoft ADPCM stereo has separate predictors and steps, with left in the high nibble", () => {
  const data = block({
    predictors: [0, 1],
    deltas: [16, 32],
    recent: [100, -100],
    older: [90, -90],
    nibbles: [0x1f, 0x21],
  });
  const result = decodeMSADPCM(
    wave(data, { fmt: format({ channels: 2, blockAlign: 16 }) }),
  );
  assert.deepEqual(pcm(result), [
    [90, 100, 116, 148],
    [-90, -100, -142, -156],
  ]);
});

test("Microsoft ADPCM decodes a 256-byte 44100 Hz stereo block into 244 frames", () => {
  const data = block({
    predictors: [0, 0],
    deltas: [16, 16],
    recent: [200, -200],
    older: [100, -100],
    nibbles: Array(242).fill(0),
  });
  const fmt = format({ channels: 2, blockAlign: 256, samplesPerBlock: 244 });
  const decoded = decodeMSADPCM(wave(data, { fmt }));
  assert.equal(decoded.sampleRate, 44100);
  assert.deepEqual(pcm(decoded), [
    [100, ...Array(243).fill(200)],
    [-100, ...Array(243).fill(-200)],
  ]);
});

test("Microsoft ADPCM uses the file's signed coefficients and rounds prediction like Windows", () => {
  const data = block({
    predictors: [1],
    recent: [3],
    older: [-2],
    nibbles: [0x00],
  });
  const fmt = format({
    blockAlign: 8,
    coefficients: [
      [256, 0],
      [-128, 128],
    ],
  });
  assert.deepEqual(pcm(decodeMSADPCM(wave(data, { fmt }))), [[-2, 3, -3, 3]]);
});

test("Microsoft ADPCM preserves Windows native negative prediction and signed initial delta", () => {
  // Independently checked through msacm32!acmStreamConvert with a 256-byte mono
  // block. Windows uses >>8 rounding and a signed initial delta; FFmpeg's
  // truncation toward zero and unsigned initial delta differ on these inputs.
  // Reproduction: tmp-validation/ms-adpcm-windows-reference.ps1.
  const fmt = format({ blockAlign: 256 });
  const negative = block({
    predictors: [3],
    recent: [-1],
    older: [0],
    nibbles: Array(249).fill(0),
  });
  assert.deepEqual(pcm(decodeMSADPCM(wave(negative, { fmt, fact: 4 }))), [
    [0, -1, -1, -1],
  ]);
  for (const [delta, sample] of [
    [1, 1],
    [32767, 32767],
    [32768, -32768],
    [65535, -1],
  ]) {
    const data = block({
      deltas: [delta],
      recent: [0],
      older: [0],
      nibbles: [0x10, ...Array(248).fill(0)],
    });
    assert.deepEqual(pcm(decodeMSADPCM(wave(data, { fmt, fact: 4 }))), [
      [0, 0, sample, sample],
    ]);
  }
});

test("Microsoft ADPCM floors adaptation and applies the minimum after decoding a nibble", () => {
  const data = block({
    deltas: [17],
    recent: [0],
    older: [0],
    nibbles: [0x70, 0x1f],
  });
  assert.deepEqual(pcm(decodeMSADPCM(wave(data))), [
    [0, 0, 119, 119, 154, 123],
  ]);
  const small = block({
    deltas: [1],
    recent: [0],
    older: [0],
    nibbles: [0x11],
  });
  assert.deepEqual(
    pcm(decodeMSADPCM(wave(small, { fmt: format({ blockAlign: 8 }) }))),
    [[0, 0, 1, 17]],
  );
});

test("Microsoft ADPCM clips reconstructed samples to signed 16-bit PCM", () => {
  const data = block({
    predictors: [0, 0],
    deltas: [16, 16],
    recent: [32760, -32760],
    older: [100, -100],
    nibbles: [0x78],
  });
  const fmt = format({ channels: 2, blockAlign: 15 });
  assert.deepEqual(pcm(decodeMSADPCM(wave(data, { fmt }))), [
    [100, 32760, 32767],
    [-100, -32760, -32768],
  ]);
});

test("Microsoft ADPCM resets state at block boundaries and respects exact fact length", () => {
  const data = Buffer.concat([
    block({ recent: [1], older: [2], nibbles: [0x00] }),
    block({ recent: [-10], older: [-20], deltas: [32], nibbles: [0x1f] }),
  ]);
  const fmt = format({ blockAlign: 8 });
  assert.deepEqual(pcm(decodeMSADPCM(wave(data, { fmt }))), [
    [2, 1, 1, 1, -20, -10, 22, -6],
  ]);
  assert.deepEqual(pcm(decodeMSADPCM(wave(data, { fmt, fact: 6 }))), [
    [2, 1, 1, 1, -20, -10],
  ]);
  assert.deepEqual(pcm(decodeMSADPCM(wave(data, { fmt, fact: 1 }))), [[2]]);
  assert.deepEqual(pcm(decodeMSADPCM(wave(data, { fmt, fact: 0 }))), [[]]);
});

test("Microsoft ADPCM handles a short last block and an unused final mono nibble", () => {
  const data = Buffer.concat([
    block(),
    block({ recent: [-10], older: [-20], deltas: [32], nibbles: [0x1f] }),
  ]);
  assert.deepEqual(pcm(decodeMSADPCM(wave(data, { fact: 9 }))), [
    [900, 1000, 1016, 1048, 1032, 904, -20, -10, 22],
  ]);
  assert.equal(decodeMSADPCM(wave(data)).channelData[0].length, 10);
  const odd = block({ nibbles: [0x17] });
  assert.deepEqual(
    pcm(
      decodeMSADPCM(
        wave(odd, {
          fmt: format({ blockAlign: 8, samplesPerBlock: 3 }),
        }),
      ),
    ),
    [[900, 1000, 1016]],
  );
  const header = block({
    predictors: [0, 0],
    deltas: [16, 16],
    recent: [2, 4],
    older: [1, 3],
    nibbles: [],
  });
  assert.deepEqual(
    pcm(
      decodeMSADPCM(
        wave(header, {
          fmt: format({ channels: 2, blockAlign: 256 }),
        }),
      ),
    ),
    [
      [1, 2],
      [3, 4],
    ],
  );
});

test("Microsoft ADPCM accepts RIFF padding, unknown chunks, chunk order, and offset views", () => {
  const count = Buffer.alloc(4);
  count.writeUInt32LE(4);
  const encoded = riff([
    chunk("JUNK", Buffer.from([1, 2, 3])),
    chunk("data", block()),
    chunk("fact", count),
    chunk("fmt ", format()),
    chunk("LIST", Buffer.from([4])),
  ]);
  const outer = new Uint8Array(encoded.length + 13);
  outer.set(encoded, 5);
  const expected = [[900, 1000, 1016, 1048]];
  assert.deepEqual(
    pcm(decodeMSADPCM(outer.subarray(5, 5 + encoded.length))),
    expected,
  );
  assert.deepEqual(
    pcm(decodeMSADPCM(Uint8Array.from(encoded).buffer)),
    expected,
  );
});

test("Microsoft ADPCM ignores bytes beyond the declared RIFF and declines other formats", () => {
  assert.equal(decodeMSADPCM(new Uint8Array([1, 2, 3])), null);
  for (const tag of [1, 3, 17, 65534]) {
    const fmt = format();
    fmt.writeUInt16LE(tag, 0);
    assert.equal(decodeMSADPCM(wave(block(), { fmt })), null);
  }
  const encoded = wave();
  assert.deepEqual(
    pcm(decodeMSADPCM(Buffer.concat([encoded, Buffer.from([99, 98, 97])]))),
    pcm(decodeMSADPCM(encoded)),
  );
});

test("Microsoft ADPCM rejects truncated RIFF chunks and missing odd-size padding", () => {
  const encoded = wave();
  assert.throws(() => decodeMSADPCM(encoded.subarray(0, -1)), structureError);
  const missingPad = encoded.subarray(0, -1);
  missingPad.writeUInt32LE(missingPad.length - 8, 4);
  assert.throws(() => decodeMSADPCM(missingPad), structureError);
  const oversized = wave();
  oversized.writeUInt32LE(0xffffffff, 4);
  assert.throws(() => decodeMSADPCM(oversized), structureError);
  const truncatedFmt = riff([chunk("fmt ", Buffer.from([2, 0]))]);
  truncatedFmt.writeUInt32LE(50, 16);
  assert.throws(() => decodeMSADPCM(truncatedFmt), structureError);
  assert.throws(
    () => decodeMSADPCM(riff([chunk("fmt ", format())])),
    structureError,
  );
  assert.throws(
    () => decodeMSADPCM(wave(block(), { after: [Buffer.from([1])] })),
    structureError,
  );
});

test("Microsoft ADPCM validates format extensions, table bounds, and samples per block", () => {
  const mutations = [
    (f) => f.writeUInt16LE(0, 2),
    (f) => f.writeUInt16LE(3, 2),
    (f) => f.writeUInt32LE(0, 4),
    (f) => f.writeUInt16LE(3, 14),
    (f) => f.writeUInt16LE(3, 16),
    (f) => f.writeUInt16LE(33, 16),
    (f) => f.writeUInt16LE(0, 20),
    (f) => f.writeUInt16LE(8, 20),
    (f) => f.writeUInt16LE(257, 20),
    (f) => f.writeUInt16LE(1, 18),
    (f) => f.writeUInt16LE(8, 18),
    (f) => f.writeUInt16LE(4, 18),
    (f) => f.writeUInt16LE(6, 12),
  ];
  for (const mutate of mutations) {
    const fmt = format();
    mutate(fmt);
    assert.throws(() => decodeMSADPCM(wave(block(), { fmt })), formatError);
  }
  assert.throws(
    () => decodeMSADPCM(wave(block(), { fmt: format().subarray(0, 20) })),
    formatError,
  );
});

test("Microsoft ADPCM rejects invalid predictors and incomplete block headers", () => {
  assert.throws(
    () => decodeMSADPCM(wave(block({ predictors: [7] }))),
    blockError,
  );
  assert.throws(() => decodeMSADPCM(wave(block().subarray(0, 6))), blockError);
  assert.throws(
    () => decodeMSADPCM(wave(Buffer.concat([block(), Buffer.from([0])]))),
    blockError,
  );
  const laterBad = Buffer.concat([block(), block({ predictors: [255] })]);
  assert.throws(() => decodeMSADPCM(wave(laterBad, { fact: 1 })), blockError);
});

test("Microsoft ADPCM validates fact counts and rejects conflicting mandatory chunks", () => {
  assert.throws(() => decodeMSADPCM(wave(block(), { fact: 7 })), sampleError);
  assert.throws(
    () => decodeMSADPCM(wave(block(), { fact: 0xffffffff })),
    sampleError,
  );
  assert.throws(
    () =>
      decodeMSADPCM(wave(block(), { after: [chunk("fact", Buffer.alloc(3))] })),
    structureError,
  );
  for (const extra of [
    chunk("fmt ", format()),
    chunk("fmt ", Buffer.alloc(0)),
    chunk("data", block()),
  ])
    assert.throws(
      () => decodeMSADPCM(wave(block(), { after: [extra] })),
      structureError,
    );
  assert.throws(
    () =>
      decodeMSADPCM(
        wave(block(), { fact: 1, after: [chunk("fact", Buffer.alloc(4))] }),
      ),
    structureError,
  );
  assert.deepEqual(pcm(decodeMSADPCM(wave(Buffer.alloc(0), { fact: 0 }))), [
    [],
  ]);
});

test("Microsoft ADPCM rejects excessive output allocation and unsafe adaptive step growth", () => {
  // 32.1 MiB of compressed stereo data would require over 256 MiB of PCM.
  const blockAlign = 65535;
  const encoded = Buffer.alloc(blockAlign * 513);
  const fmt = format({ channels: 2, blockAlign });
  assert.throws(
    () => decodeMSADPCM(wave(encoded, { fmt })),
    /Microsoft ADPCM WAV 解码数据过大/,
  );
  const explosive = block({ nibbles: Array(32).fill(0x88) });
  assert.throws(
    () => decodeMSADPCM(wave(explosive, { fmt: format({ blockAlign: 39 }) })),
    blockError,
  );
});
