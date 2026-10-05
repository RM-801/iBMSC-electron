import { decodeMSADPCM } from "./ms-adpcm.js";

// Older BMS/PMS sets can contain compressed WAV files unsupported by Web Audio.
// Decode their samples in memory; source assets are never rewritten.
export async function decodeAudio(context, input) {
  const pcm = decodeMSADPCM(input);
  if (pcm) {
    const buffer = context.createBuffer(
      pcm.channelData.length,
      pcm.channelData[0].length,
      pcm.sampleRate,
    );
    pcm.channelData.forEach((samples, channel) =>
      buffer.copyToChannel(samples, channel),
    );
    return buffer;
  }
  // Native decoding may detach its input. Pass only the selected bytes and keep
  // the caller's data intact, including when an IPC/Buffer view has an offset.
  const bytes =
    input instanceof ArrayBuffer
      ? input.slice(0)
      : new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice()
          .buffer;
  return context.decodeAudioData(bytes);
}
