import { useState, useRef, useCallback, useEffect } from 'react'
import { AudioEngine, FFT_SIZE_NORMAL, FFT_SIZE_LARGE } from '../audio/AudioEngine'
import { detectPitch } from '../audio/PitchDetector'
import { freqToCents, findClosestString, octaveCorrect } from '../audio/noteUtils'
import type { UkuleleString } from '../constants/tuning'

const THROTTLE_MS = 1000 / 30
const EMA_ALPHA = 0.2
const NULL_FRAME_HOLD = 10

// Frames deviating more than this from the current EMA are discarded as outliers.
// 200 cents ≈ 2 semitones — wide enough to track normal pitch variation,
// tight enough to reject a rogue harmonic that survived octave correction.
const OUTLIER_THRESHOLD_CENTS = 200

export interface PitchDetectionSettings {
  largeBuffer: boolean   // 4096 samples instead of 2048 — more cycles, better accuracy
  outlierRejection: boolean  // discard frames > 200¢ from current EMA
}

export interface DebugInfo {
  rawFrequency: number | null
  clarity: number | null
  fftSize: number
  lastFrameRejected: boolean
  rejectedCount: number
}

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
  debugInfo: DebugInfo
}

const initialState: PitchState = {
  frequency: null,
  clarity: null,
  cents: null,
  closestString: null,
}

export function usePitchDetection(settings: PitchDetectionSettings): UsePitchDetectionReturn {
  const [isListening, setIsListening] = useState(false)
  const [state, setState] = useState<PitchState>(initialState)
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    rawFrequency: null,
    clarity: null,
    fftSize: FFT_SIZE_NORMAL,
    lastFrameRejected: false,
    rejectedCount: 0,
  })

  const engineRef = useRef<AudioEngine | null>(null)
  const selectedStringRef = useRef<UkuleleString | null>(null)
  const lastFrameTimeRef = useRef<number>(0)
  const smoothedFreqRef = useRef<number | null>(null)
  const nullFrameCountRef = useRef<number>(0)
  const rejectedCountRef = useRef<number>(0)
  // Keep settings readable inside the RAF closure without needing restart
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const fftSize = settings.largeBuffer ? FFT_SIZE_LARGE : FFT_SIZE_NORMAL

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
          rejectedCountRef.current = 0
          setState(prev => prev.frequency === null ? prev : initialState)
          setDebugInfo(prev => ({ ...prev, rawFrequency: null, clarity: null, lastFrameRejected: false, rejectedCount: 0 }))
        }
        return
      }

      nullFrameCountRef.current = 0
      const { frequency: rawFreq, clarity } = result

      // Octave-correct the raw frame first so EMA stays within one octave
      const targetForCorrection = selectedStringRef.current ?? findClosestString(rawFreq)
      const correctedRaw = octaveCorrect(rawFreq, targetForCorrection.frequency)

      // Outlier rejection: skip frames that jump too far from the current running estimate
      let rejected = false
      if (settingsRef.current.outlierRejection && smoothedFreqRef.current !== null) {
        const deviationCents = Math.abs(1200 * Math.log2(correctedRaw / smoothedFreqRef.current))
        if (deviationCents > OUTLIER_THRESHOLD_CENTS) {
          rejected = true
          rejectedCountRef.current += 1
          setDebugInfo({ rawFrequency: rawFreq, clarity, fftSize: settingsRef.current.largeBuffer ? FFT_SIZE_LARGE : FFT_SIZE_NORMAL, lastFrameRejected: true, rejectedCount: rejectedCountRef.current })
          return
        }
      }

      rejectedCountRef.current = rejected ? rejectedCountRef.current : 0

      smoothedFreqRef.current = smoothedFreqRef.current === null
        ? correctedRaw
        : EMA_ALPHA * correctedRaw + (1 - EMA_ALPHA) * smoothedFreqRef.current

      const frequency = smoothedFreqRef.current
      const targetString = selectedStringRef.current ?? findClosestString(frequency)
      const cents = freqToCents(frequency, targetString.frequency)

      setDebugInfo({ rawFrequency: rawFreq, clarity, fftSize: settingsRef.current.largeBuffer ? FFT_SIZE_LARGE : FFT_SIZE_NORMAL, lastFrameRejected: false, rejectedCount: 0 })
      setState({ frequency, clarity, cents, closestString: targetString })
    }

    await engineRef.current.start(onFrame, fftSize)
    setIsListening(true)
  }, [fftSize])

  const stop = useCallback(async () => {
    await engineRef.current?.stop()
    engineRef.current = null
    smoothedFreqRef.current = null
    nullFrameCountRef.current = 0
    rejectedCountRef.current = 0
    setIsListening(false)
    setState(initialState)
  }, [])

  // Restart the engine when largeBuffer changes so the new fftSize takes effect
  useEffect(() => {
    if (isListening) {
      stop().then(() => start(selectedStringRef.current))
    }
  }, [settings.largeBuffer]) // eslint-disable-line react-hooks/exhaustive-deps

  return { isListening, start, stop, debugInfo, ...state }
}
