import { describe, it, expect } from 'vitest'
import { detectPitch } from './PitchDetector'
import { MIN_DETECTABLE_FREQ, MAX_DETECTABLE_FREQ, MIN_CLARITY } from '../constants/tuning'

function generateSineWave(freq: number, sampleRate: number, numSamples: number): Float32Array<ArrayBuffer> {
  const buffer = new Float32Array(numSamples) as Float32Array<ArrayBuffer>
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = Math.sin(2 * Math.PI * freq * i / sampleRate)
  }
  return buffer as Float32Array<ArrayBuffer>
}

describe('detectPitch', () => {
  const SAMPLE_RATE = 44100
  const BUFFER_SIZE = 2048

  it('detects A4 (440 Hz) sine wave', () => {
    const buffer = generateSineWave(440, SAMPLE_RATE, BUFFER_SIZE)
    const result = detectPitch(buffer, SAMPLE_RATE)
    expect(result).not.toBeNull()
    expect(result!.frequency).toBeCloseTo(440, 0)
    expect(result!.clarity).toBeGreaterThanOrEqual(MIN_CLARITY)
  })

  it('detects E4 (329.63 Hz) sine wave', () => {
    const buffer = generateSineWave(329.63, SAMPLE_RATE, BUFFER_SIZE)
    const result = detectPitch(buffer, SAMPLE_RATE)
    expect(result).not.toBeNull()
    expect(result!.frequency).toBeCloseTo(329.63, 0)
  })

  it('detects C4 (261.63 Hz) sine wave', () => {
    const buffer = generateSineWave(261.63, SAMPLE_RATE, BUFFER_SIZE)
    const result = detectPitch(buffer, SAMPLE_RATE)
    expect(result).not.toBeNull()
    expect(result!.frequency).toBeCloseTo(261.63, 0)
  })

  it('returns null for silence (all zeros)', () => {
    const buffer = new Float32Array(BUFFER_SIZE) as Float32Array<ArrayBuffer>
    const result = detectPitch(buffer, SAMPLE_RATE)
    expect(result).toBeNull()
  })

  it('returns null for frequency below MIN_DETECTABLE_FREQ', () => {
    const buffer = generateSineWave(50, SAMPLE_RATE, BUFFER_SIZE)
    const result = detectPitch(buffer, SAMPLE_RATE)
    if (result !== null) {
      expect(result.frequency).toBeGreaterThanOrEqual(MIN_DETECTABLE_FREQ)
    }
  })

  it('returns null for frequency above MAX_DETECTABLE_FREQ', () => {
    const buffer = generateSineWave(2000, SAMPLE_RATE, BUFFER_SIZE)
    const result = detectPitch(buffer, SAMPLE_RATE)
    if (result !== null) {
      expect(result.frequency).toBeLessThanOrEqual(MAX_DETECTABLE_FREQ)
    }
  })
})
