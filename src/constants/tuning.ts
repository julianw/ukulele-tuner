export interface UkuleleString {
  name: string
  note: string
  octave: number
  frequency: number
}

export const UKULELE_STRINGS: UkuleleString[] = [
  { name: '4', note: 'G', octave: 4, frequency: 392.0 },
  { name: '3', note: 'C', octave: 4, frequency: 261.63 },
  { name: '2', note: 'E', octave: 4, frequency: 329.63 },
  { name: '1', note: 'A', octave: 4, frequency: 440.0 },
]

export const IN_TUNE_THRESHOLD_CENTS = 5
export const MAX_DISPLAY_CENTS = 50

export const MIN_DETECTABLE_FREQ = 200
export const MAX_DETECTABLE_FREQ = 1200
export const MIN_CLARITY = 0.9
