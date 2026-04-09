import { useState, useRef, useCallback } from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import { detectPitch } from '../audio/PitchDetector'
import { freqToCents, findClosestString, octaveCorrect } from '../audio/noteUtils'
import type { UkuleleString } from '../constants/tuning'

const THROTTLE_MS = 1000 / 30

// Exponential moving average smoothing factor.
// Lower = smoother but slower to respond; 0.2 gives ~150ms settling time at 30fps.
const EMA_ALPHA = 0.2

// How many consecutive null frames before we clear the display (avoids flickering on brief silence)
const NULL_FRAME_HOLD = 10

interface PitchState {
  frequency: number | null
  clarity: number | null
  cents: number | null
  closestString: UkuleleString | null
}

interface UsePitchDetectionReturn extends PitchState {
  isListening: boolean
  start: (selectedString?: UkuleleString | null) => Promise<void>
  stop: () => Promise<void>
}

const initialState: PitchState = {
  frequency: null,
  clarity: null,
  cents: null,
  closestString: null,
}

export function usePitchDetection(): UsePitchDetectionReturn {
  const [isListening, setIsListening] = useState(false)
  const [state, setState] = useState<PitchState>(initialState)

  const engineRef = useRef<AudioEngine | null>(null)
  const selectedStringRef = useRef<UkuleleString | null>(null)
  const lastFrameTimeRef = useRef<number>(0)
  const smoothedFreqRef = useRef<number | null>(null)
  const nullFrameCountRef = useRef<number>(0)

  const start = useCallback(async (selectedString?: UkuleleString | null) => {
    selectedStringRef.current = selectedString ?? null

    if (!engineRef.current) {
      engineRef.current = new AudioEngine()
    }

    const onFrame = (buffer: Float32Array<ArrayBuffer>, sampleRate: number) => {
      const now = performance.now()
      if (now - lastFrameTimeRef.current < THROTTLE_MS) return
      lastFrameTimeRef.current = now

      const result = detectPitch(buffer, sampleRate)

      if (!result) {
        nullFrameCountRef.current += 1
        if (nullFrameCountRef.current >= NULL_FRAME_HOLD) {
          smoothedFreqRef.current = null
          setState(prev => prev.frequency === null ? prev : initialState)
        }
        return
      }

      nullFrameCountRef.current = 0

      const { frequency: rawFreq, clarity } = result

      // Determine target string from user selection or by detecting from raw freq.
      // We need this BEFORE EMA so we can octave-correct each frame individually.
      const targetForCorrection = selectedStringRef.current ?? findClosestString(rawFreq)

      // Octave-correct the raw frame first, THEN apply EMA.
      // If EMA ran on the raw frequency, a mix of fundamental (~330 Hz) and harmonic
      // (~660 Hz) frames would average to ~380 Hz and land on the wrong string (G4).
      const correctedRaw = octaveCorrect(rawFreq, targetForCorrection.frequency)

      smoothedFreqRef.current = smoothedFreqRef.current === null
        ? correctedRaw
        : EMA_ALPHA * correctedRaw + (1 - EMA_ALPHA) * smoothedFreqRef.current

      const frequency = smoothedFreqRef.current
      const targetString = selectedStringRef.current ?? findClosestString(frequency)
      const cents = freqToCents(frequency, targetString.frequency)

      setState({ frequency, clarity, cents, closestString: targetString })
    }

    await engineRef.current.start(onFrame)
    setIsListening(true)
  }, [])

  const stop = useCallback(async () => {
    await engineRef.current?.stop()
    engineRef.current = null
    smoothedFreqRef.current = null
    nullFrameCountRef.current = 0
    setIsListening(false)
    setState(initialState)
  }, [])

  return { isListening, start, stop, ...state }
}
