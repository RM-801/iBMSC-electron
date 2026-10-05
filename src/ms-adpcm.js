// Microsoft ADPCM (WAVE format tag 2), independent of browser codec support.
// Container/format references:
// https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/Docs/RIFFNEW.pdf
// https://learn.microsoft.com/en-us/windows/win32/xaudio2/adpcm-overview
// https://github.com/microsoft/DirectXTK/wiki/Wave-Formats
const adaptation = [
  230, 230, 230, 230, 307, 409, 512, 614, 768, 614, 512, 409, 307, 230, 230,
  230,
];
const maxOutputBytes = 256 * 1024 * 1024;
const structureError = () => Error("Microsoft ADPCM WAV 文件结构无效");
const formatError = () => Error("Microsoft ADPCM WAV 格式参数无效");
const blockError = () => Error("Microsoft ADPCM WAV 音频块无效");
const sampleError = () => Error("Microsoft ADPCM WAV 样本数无效");
const sizeError = () => Error("Microsoft ADPCM WAV 解码数据过大");

function waveChunks(view) {
  if (
    view.byteLength < 12 ||
    view.getUint32(0, true) !== 0x46464952 ||
    view.getUint32(8, true) !== 0x45564157
  )
    return null;
  const declaredEnd = view.getUint32(4, true) + 8;
  const end = Math.min(declaredEnd, view.byteLength);
  let invalid = declaredEnd < 12 || declaredEnd > view.byteLength;
  let fmt,
    data,
    fact,
    isADPCM = false;
  for (let offset = 12; offset < end;) {
    if (end - offset < 8) {
      invalid = true;
      break;
    }
    const id = view.getUint32(offset, true);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const next = start + size + (size & 1);
    const chunk = { start, size };
    // Identify tag 2 even when this fmt chunk itself has been truncated.
    if (id === 0x20746d66) {
      if (size < 2 || end - start < 2) invalid = true;
      else {
        chunk.tag = view.getUint16(start, true);
        isADPCM ||= chunk.tag === 2;
        if (fmt) invalid = true;
        else fmt = chunk;
      }
    }
    if (next > end) {
      invalid = true;
      break;
    }
    if (id === 0x61746164) {
      if (data) invalid = true;
      else data = chunk;
    } else if (id === 0x74636166) {
      if (fact || size < 4) invalid = true;
      else fact = chunk;
    }
    offset = next;
  }
  if (!isADPCM) return null;
  if (invalid || fmt?.tag !== 2 || !data) throw structureError();
  return { fmt, data, fact };
}

function readFormat(view, chunk) {
  const p = chunk.start;
  if (chunk.size < 22) throw formatError();
  const channels = view.getUint16(p + 2, true);
  const sampleRate = view.getUint32(p + 4, true);
  const blockAlign = view.getUint16(p + 12, true);
  const bits = view.getUint16(p + 14, true);
  const extraSize = view.getUint16(p + 16, true);
  const samplesPerBlock = view.getUint16(p + 18, true);
  const coefficientCount = view.getUint16(p + 20, true);
  if (
    (channels !== 1 && channels !== 2) ||
    !sampleRate ||
    bits !== 4 ||
    extraSize < 4 ||
    18 + extraSize > chunk.size ||
    coefficientCount < 1 ||
    coefficientCount > 256 ||
    4 + coefficientCount * 4 > extraSize ||
    samplesPerBlock < 2 ||
    // A mono block may end with one unused low nibble.
    blockAlign !==
      7 * channels + Math.ceil(((samplesPerBlock - 2) * channels) / 2)
  )
    throw formatError();
  const coefficients = Array.from({ length: coefficientCount }, (_, i) => [
    view.getInt16(p + 22 + i * 4, true),
    view.getInt16(p + 24 + i * 4, true),
  ]);
  return { channels, sampleRate, blockAlign, samplesPerBlock, coefficients };
}

function expand(nibble, state) {
  const signed = nibble < 8 ? nibble : nibble - 16;
  // Match Windows msadp32.acm's arithmetic-shift rounding. Math.floor avoids
  // JavaScript bitwise coercion overflowing the coefficient sum at 32 bits.
  const predicted = Math.floor(
    (state.recent * state.coefficients[0] +
      state.older * state.coefficients[1]) /
      256,
  );
  const sample = Math.max(
    -32768,
    Math.min(32767, predicted + signed * state.delta),
  );
  const scaledDelta = adaptation[nibble] * state.delta;
  // Malformed blocks must not grow an adaptive step beyond exact integer math.
  if (!Number.isSafeInteger(scaledDelta)) throw blockError();
  state.delta = Math.max(16, Math.floor(scaledDelta / 256));
  state.older = state.recent;
  state.recent = sample;
  return sample / 32768;
}

/** Return null for other formats; reject malformed Microsoft ADPCM WAV files. */
export function decodeMSADPCM(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = waveChunks(view);
  if (!chunks) return null;
  const { channels, sampleRate, blockAlign, samplesPerBlock, coefficients } =
    readFormat(view, chunks.fmt);
  const headerSize = channels * 7;
  const { start, size } = chunks.data;
  const fullBlocks = Math.floor(size / blockAlign);
  const remainingBytes = size % blockAlign;
  if (remainingBytes && remainingBytes < headerSize) throw blockError();
  const tailSamples = remainingBytes
    ? Math.min(
        samplesPerBlock,
        2 + Math.floor(((remainingBytes - headerSize) * 2) / channels),
      )
    : 0;
  const availableSamples = fullBlocks * samplesPerBlock + tailSamples;
  const sampleCount = chunks.fact
    ? view.getUint32(chunks.fact.start, true)
    : availableSamples;
  if (sampleCount > availableSamples) throw sampleError();
  if (sampleCount * channels * Float32Array.BYTES_PER_ELEMENT > maxOutputBytes)
    throw sizeError();
  // Check every block header, including any padded blocks beyond the fact count.
  for (let p = start; p < start + size; p += blockAlign) {
    for (let channel = 0; channel < channels; channel++) {
      if (view.getUint8(p + channel) >= coefficients.length) throw blockError();
    }
  }
  let channelData;
  try {
    channelData = Array.from(
      { length: channels },
      () => new Float32Array(sampleCount),
    );
  } catch {
    throw sizeError();
  }
  let output = 0;
  for (
    let p = start;
    p < start + size && output < sampleCount;
    p += blockAlign
  ) {
    const blockBytes = Math.min(blockAlign, start + size - p);
    const blockSamples = Math.min(
      samplesPerBlock,
      2 + Math.floor(((blockBytes - headerSize) * 2) / channels),
      sampleCount - output,
    );
    const states = Array.from({ length: channels }, (_, channel) => ({
      coefficients: coefficients[view.getUint8(p + channel)],
      delta: view.getInt16(p + channels + channel * 2, true),
      recent: view.getInt16(p + channels * 3 + channel * 2, true),
      older: view.getInt16(p + channels * 5 + channel * 2, true),
    }));
    for (let channel = 0; channel < channels; channel++) {
      channelData[channel][output] = states[channel].older / 32768;
      if (blockSamples > 1)
        channelData[channel][output + 1] = states[channel].recent / 32768;
    }
    let frame = 2;
    for (let b = p + headerSize; frame < blockSamples; b++) {
      const packed = view.getUint8(b);
      if (channels === 2) {
        channelData[0][output + frame] = expand(packed >> 4, states[0]);
        channelData[1][output + frame] = expand(packed & 15, states[1]);
        frame++;
      } else {
        channelData[0][output + frame++] = expand(packed >> 4, states[0]);
        if (frame < blockSamples)
          channelData[0][output + frame++] = expand(packed & 15, states[0]);
      }
    }
    output += blockSamples;
  }
  return { sampleRate, channelData };
}
