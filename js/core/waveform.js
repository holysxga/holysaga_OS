/**
 * Real waveform peaks for the audio the player actually loads.
 *
 * Nothing here is decorative: the bars are computed from the file's samples,
 * once per source, and cached in memory so reopening the player is instant.
 *
 * Two paths, in order:
 * - RIFF/WAVE is parsed directly (8/16/24/32-bit integer and 32-bit float).
 *   This avoids decoding a large master into a second in-memory buffer.
 * - Any other container (mp3, ogg, m4a…) is decoded with the browser's own
 *   AudioContext, which is local processing, never an external service.
 *
 * A failed or unsupported file resolves to null and the player keeps its plain
 * progress bar, so the waveform is an enhancement and never a dependency.
 */

const BAR_COUNT = 110;
const cache = new Map();

function fourCC(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function readSample(view, offset, bits, format) {
  if (format === 3) {
    if (bits === 32) return view.getFloat32(offset, true);
    if (bits === 64) return view.getFloat64(offset, true);
    return 0;
  }
  if (bits === 8) return (view.getUint8(offset) - 128) / 128;
  if (bits === 16) return view.getInt16(offset, true) / 32768;
  if (bits === 24) {
    const low = view.getUint8(offset);
    const mid = view.getUint8(offset + 1);
    const high = view.getInt8(offset + 2);
    return ((high << 16) | (mid << 8) | low) / 8388608;
  }
  if (bits === 32) return view.getInt32(offset, true) / 2147483648;
  return 0;
}

function shape(peaks) {
  let max = 0;
  for (const peak of peaks) if (peak > max) max = peak;
  if (!(max > 0)) return null;
  return peaks.map((peak) => {
    const value = peak / max;
    return Math.max(0.05, Math.min(1, Math.pow(value, 0.62)));
  });
}

/** Peak per bar straight from PCM chunks; no decodeAudioData buffer. */
function wavPeaks(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 44) return null;
  if (fourCC(view, 0) !== "RIFF" || fourCC(view, 8) !== "WAVE") return null;

  let fmt = null;
  let data = null;
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const id = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (id === "fmt " && start + 16 <= buffer.byteLength) {
      let format = view.getUint16(start, true);
      const channels = view.getUint16(start + 2, true);
      const bits = view.getUint16(start + 14, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format is in the sub-format GUID.
      if (format === 0xfffe && start + 26 <= buffer.byteLength) {
        format = view.getUint16(start + 24, true);
      }
      fmt = { format, channels, bits };
    } else if (id === "data") {
      data = { start, size: Math.min(size, buffer.byteLength - start) };
    }
    if (fmt && data) break;
    // Chunks are word-aligned.
    offset = start + size + (size % 2);
  }
  if (!fmt || !data) return null;

  const { format, channels, bits } = fmt;
  if (!channels || ![8, 16, 24, 32, 64].includes(bits)) return null;
  if (format !== 1 && format !== 3) return null;
  const bytesPerSample = bits / 8;
  const blockAlign = channels * bytesPerSample;
  if (!blockAlign || data.size < blockAlign) return null;

  const frames = Math.floor(data.size / blockAlign);
  const peaks = new Array(BAR_COUNT).fill(0);
  const framesPerBar = frames / BAR_COUNT;
  const step = Math.max(1, Math.floor(framesPerBar / 90));

  for (let frame = 0; frame < frames; frame += step) {
    const base = data.start + frame * blockAlign;
    let amplitude = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = readSample(
        view,
        base + channel * bytesPerSample,
        bits,
        format,
      );
      const absolute = Math.abs(sample);
      if (absolute > amplitude) amplitude = absolute;
    }
    const bar = Math.min(BAR_COUNT - 1, Math.floor(frame / framesPerBar));
    if (amplitude > peaks[bar]) peaks[bar] = amplitude;
  }
  return shape(peaks);
}

/** Compressed formats: let the browser decode the file it will play anyway. */
async function decodedPeaks(buffer) {
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : typeof window !== "undefined" && window.webkitAudioContext
        ? window.webkitAudioContext
        : null;
  if (!Ctor) return null;
  const context = new Ctor();
  try {
    const decoded = await new Promise((resolve, reject) => {
      // Safari only supports the callback form.
      const result = context.decodeAudioData(buffer, resolve, reject);
      if (result && typeof result.then === "function") result.then(resolve, reject);
    });
    if (!decoded || !decoded.length) return null;
    const channel = decoded.getChannelData(0);
    const samplesPerBar = Math.max(1, Math.floor(channel.length / BAR_COUNT));
    const stride = Math.max(1, Math.floor(samplesPerBar / 90));
    const peaks = new Array(BAR_COUNT).fill(0);
    for (let bar = 0; bar < BAR_COUNT; bar += 1) {
      const start = bar * samplesPerBar;
      const end = Math.min(channel.length, start + samplesPerBar);
      let peak = 0;
      for (let index = start; index < end; index += stride) {
        const absolute = Math.abs(channel[index]);
        if (absolute > peak) peak = absolute;
      }
      peaks[bar] = peak;
    }
    return shape(peaks);
  } finally {
    if (typeof context.close === "function") context.close();
  }
}

async function compute(src) {
  if (!src || typeof fetch !== "function") return null;
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const peaks = wavPeaks(buffer) || (await decodedPeaks(buffer));
    return peaks && peaks.length ? peaks : null;
  } catch (error) {
    console.warn("[waveform] could not analyse the audio", error);
    return null;
  }
}

/**
 * @param {string} src audio path the player uses
 * @returns {Promise<number[] | null>} one normalised 0..1 peak per bar
 */
export function loadWaveform(src) {
  if (!src) return Promise.resolve(null);
  if (cache.has(src)) return cache.get(src);
  const pending = compute(src).catch(() => null);
  cache.set(src, pending);
  return pending;
}
