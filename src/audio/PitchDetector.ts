import { PitchDetector as PitchyDetector } from 'pitchy'
import { MIN_CLARITY, MIN_DETECTABLE_FREQ, MAX_DETECTABLE_FREQ } from '../constants/tuning'

export interface PitchResult {
  frequency: number
  clarity: number
}

const detectorCache = new Map<number, PitchyDetector<Float32Array<ArrayBuffer>>>()

function getDetector(bufferSize: number): PitchyDetector<Float32Array<ArrayBuffer>> {
  if (!detectorCache.has(bufferSize)) {
    detectorCache.set(bufferSize, PitchyDetector.forFloat32Array(bufferSize))
  }
  return detectorCache.get(bufferSize)!
}

export function detectPitch(
  buffer: Float32Array<ArrayBuffer>,
  sampleRate: number
): PitchResult | null {
  const detector = getDetector(buffer.length)
  const [frequency, clarity] = detector.findPitch(buffer, sampleRate)

  if (
    clarity < MIN_CLARITY ||
    frequency < MIN_DETECTABLE_FREQ ||
    frequency > MAX_DETECTABLE_FREQ
  ) {
    return null
  }

  return { frequency, clarity }
}
