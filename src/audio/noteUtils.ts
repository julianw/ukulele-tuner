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

export function findClosestString(freq: number): UkuleleString {
  let closest = UKULELE_STRINGS[0]
  let smallestDiff = Math.abs(freqToMidi(freq) - freqToMidi(closest.frequency))

  for (const string of UKULELE_STRINGS.slice(1)) {
    const diff = Math.abs(freqToMidi(freq) - freqToMidi(string.frequency))
    if (diff < smallestDiff) {
      smallestDiff = diff
      closest = string
    }
  }

  return closest
}
