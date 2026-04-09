import { useState, useRef, useCallback } from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import { detectPitch } from '../audio/PitchDetector'
import { freqToCents, findClosestString } from '../audio/noteUtils'
import type { UkuleleString } from '../constants/tuning'

const THROTTLE_MS = 1000 / 30

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
        setState(prev =>
          prev.frequency === null ? prev : initialState
        )
        return
      }

      const { frequency, clarity } = result
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
    setIsListening(false)
    setState(initialState)
  }, [])

  return { isListening, start, stop, ...state }
}
