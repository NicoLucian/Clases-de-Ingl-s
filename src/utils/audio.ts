/**
 * Audio encoding/decoding helpers for Gemini Live API:
 * - Input: 16kHz 16-bit signed little-endian PCM (base64)
 * - Output: 24kHz 16-bit signed little-endian PCM (base64)
 */

export function downsampleAndEncodePcm16(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate = 16000
): string {
  let samples = input;

  if (inputSampleRate !== targetSampleRate && inputSampleRate > 0) {
    const ratio = inputSampleRate / targetSampleRate;
    const outputLength = Math.max(1, Math.floor(input.length / ratio));
    const resampled = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const exactIndex = i * ratio;
      const lowerIndex = Math.floor(exactIndex);
      const upperIndex = Math.min(lowerIndex + 1, input.length - 1);
      const frac = exactIndex - lowerIndex;
      resampled[i] = input[lowerIndex] * (1 - frac) + input[upperIndex] * frac;
    }
    samples = resampled;
  }

  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function decodePcm24kToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const byteLength = binary.length;
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const sampleCount = Math.floor(byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer);

  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 / 32768;
  }

  return float32;
}

export function computeRmsLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, rms * 3.2);
}
