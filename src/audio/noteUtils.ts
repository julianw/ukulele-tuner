import { MAX_DISPLAY_CENTS, UKULELE_STRINGS, type UkuleleString } from '../constants/tuning'

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function freqToCents(detected: number, target: number): number {
  const cents = 1200 * Math.log2(detected / target)
  return Math.max(-MAX_DISPLAY_CENTS, Math.min(MAX_DISPLAY_CENTS, cents))
}

/**
 * Corrects octave errors by shifting the detected frequency up or down by octaves
 * until it is within ±600 cents (half an octave) of the target.
 * This handles the common case where a pitch detector locks onto a harmonic
 * instead of the fundamental.
 */
export function octaveCorrect(detected: number, target: number): number {
  const octaveShift = Math.round(Math.log2(detected / target))
  return detected / Math.pow(2, octaveShift)
}

export function findClosestString(freq: number): UkuleleString {
  let closest = UKULELE_STRINGS[0]
  let smallestAbsCents = Math.abs(1200 * Math.log2(octaveCorrect(freq, closest.frequency) / closest.frequency))

  for (const string of UKULELE_STRINGS.slice(1)) {
    const corrected = octaveCorrect(freq, string.frequency)
    const absCents = Math.abs(1200 * Math.log2(corrected / string.frequency))
    if (absCents < smallestAbsCents) {
      smallestAbsCents = absCents
      closest = string
    }
  }

  return closest
}
