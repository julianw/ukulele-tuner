import { useState, useRef, useCallback } from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import { detectPitch } from '../audio/PitchDetector'
import { freqToCents, findClosestString } from '../audio/noteUtils'
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

      // Apply EMA to smooth out frame-to-frame jitter
      const { frequency: rawFreq, clarity } = result
      smoothedFreqRef.current = smoothedFreqRef.current === null
        ? rawFreq
        : EMA_ALPHA * rawFreq + (1 - EMA_ALPHA) * smoothedFreqRef.current

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
