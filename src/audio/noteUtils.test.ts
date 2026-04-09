import { describe, it, expect } from 'vitest'
import { freqToMidi, midiToFreq, freqToCents, findClosestString, octaveCorrect } from './noteUtils'
import { MAX_DISPLAY_CENTS } from '../constants/tuning'

describe('freqToMidi', () => {
  it('A4 (440 Hz) = MIDI 69', () => {
    expect(freqToMidi(440)).toBeCloseTo(69, 5)
  })

  it('A5 (880 Hz) = MIDI 81', () => {
    expect(freqToMidi(880)).toBeCloseTo(81, 5)
  })

  it('C4 (261.63 Hz) ≈ MIDI 60', () => {
    expect(freqToMidi(261.63)).toBeCloseTo(60, 1)
  })
})

describe('midiToFreq', () => {
  it('MIDI 69 = 440 Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5)
  })

  it('is inverse of freqToMidi', () => {
    const freq = 329.63
    expect(midiToFreq(freqToMidi(freq))).toBeCloseTo(freq, 3)
  })
})

describe('freqToCents', () => {
  it('same frequency = 0 cents', () => {
    expect(freqToCents(329.63, 329.63)).toBe(0)
  })

  it('E4 at exactly target frequency = 0 cents', () => {
    expect(freqToCents(329.63, 329.63)).toBeCloseTo(0, 5)
  })

  it('one semitone sharp = 100 cents (unclamped)', () => {
    // One semitone above E4 is F4 = 349.23 Hz
    const result = freqToCents(349.23, 329.63)
    // This is outside MAX_DISPLAY_CENTS so it clamps to 50
    expect(result).toBe(MAX_DISPLAY_CENTS)
  })

  it('slightly sharp gives positive cents', () => {
    const result = freqToCents(332, 329.63)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(20)
  })

  it('slightly flat gives negative cents', () => {
    const result = freqToCents(327, 329.63)
    expect(result).toBeLessThan(0)
    expect(result).toBeGreaterThan(-20)
  })

  it('clamps to +MAX_DISPLAY_CENTS', () => {
    expect(freqToCents(1000, 261.63)).toBe(MAX_DISPLAY_CENTS)
  })

  it('clamps to -MAX_DISPLAY_CENTS', () => {
    expect(freqToCents(200, 440)).toBe(-MAX_DISPLAY_CENTS)
  })
})

describe('findClosestString', () => {
  it('392 Hz → G4', () => {
    const result = findClosestString(392.0)
    expect(result.note).toBe('G')
  })

  it('261.63 Hz → C4', () => {
    const result = findClosestString(261.63)
    expect(result.note).toBe('C')
  })

  it('329.63 Hz → E4', () => {
    const result = findClosestString(329.63)
    expect(result.note).toBe('E')
  })

  it('440 Hz → A4', () => {
    const result = findClosestString(440.0)
    expect(result.note).toBe('A')
  })

  it('445 Hz → A4 (closest to A4 even though sharp)', () => {
    const result = findClosestString(445)
    expect(result.note).toBe('A')
  })

  it('350 Hz → E4 (closer to E4=329 than G4=392)', () => {
    const result = findClosestString(350)
    expect(result.note).toBe('E')
  })

  it('880 Hz (A4 octave up) → A4 via octave correction', () => {
    const result = findClosestString(880)
    expect(result.note).toBe('A')
  })

  it('659 Hz (E4 octave up) → E4 via octave correction', () => {
    const result = findClosestString(659)
    expect(result.note).toBe('E')
  })
})

describe('octaveCorrect', () => {
  it('returns frequency unchanged when already close', () => {
    expect(octaveCorrect(395, 392)).toBeCloseTo(395, 1)
  })

  it('halves frequency one octave up', () => {
    expect(octaveCorrect(880, 440)).toBeCloseTo(440, 1)
  })

  it('doubles frequency one octave down', () => {
    expect(octaveCorrect(220, 440)).toBeCloseTo(440, 1)
  })

  it('corrects two octaves up', () => {
    expect(octaveCorrect(1760, 440)).toBeCloseTo(440, 1)
  })

  it('result is within ±600 cents of target', () => {
    const corrected = octaveCorrect(659, 329.63)
    const cents = Math.abs(1200 * Math.log2(corrected / 329.63))
    expect(cents).toBeLessThan(600)
  })
})
