import { useState, useCallback } from 'react'
import { StringSelector } from './StringSelector'
import { TuningNeedle } from './TuningNeedle'
import { PitchDisplay } from './PitchDisplay'
import { StatusBanner } from './StatusBanner'
import { useMicrophone } from '../hooks/useMicrophone'
import { usePitchDetection } from '../hooks/usePitchDetection'
import type { UkuleleString } from '../constants/tuning'

export default function App() {
  const [selectedString, setSelectedString] = useState<UkuleleString | null>(null)
  const { status: micStatus, requestAccess } = useMicrophone()
  const { isListening, frequency, cents, closestString, start, stop } = usePitchDetection()

  const handleStartStop = useCallback(async () => {
    if (isListening) {
      await stop()
      return
    }

    // On mobile browsers, AudioContext must be created inside a user gesture.
    // We request mic access here (inside the click handler) so AudioContext
    // creation in AudioEngine.start() also happens within the gesture.
    if (micStatus !== 'granted') {
      const granted = await requestAccess()
      if (!granted) return
    }

    await start(selectedString)
  }, [isListening, micStatus, requestAccess, selectedString, start, stop])

  const handleStringSelect = useCallback((string: UkuleleString | null) => {
    setSelectedString(string)
    // If already listening, restart with new string selection
    if (isListening) {
      stop().then(() => start(string))
    }
  }, [isListening, start, stop])

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white tracking-wide">Ukulele Tuner</h1>
        <p className="text-gray-500 text-xs mt-1">Standard G-C-E-A tuning</p>
      </div>

      {/* String selector */}
      <StringSelector selected={selectedString} onSelect={handleStringSelect} />

      {/* Note display */}
      <PitchDisplay frequency={frequency} closestString={closestString} />

      {/* Tuning needle */}
      <TuningNeedle cents={cents} />

      {/* Status */}
      <StatusBanner cents={cents} isListening={isListening} />

      {/* Start/Stop button */}
      <button
        onClick={handleStartStop}
        className={`w-40 py-3 rounded-full text-base font-semibold transition-all ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-indigo-500 hover:bg-indigo-600 text-white'
        }`}
      >
        {isListening ? 'Stop' : micStatus === 'denied' ? 'Mic Denied' : 'Start Tuning'}
      </button>

      {micStatus === 'denied' && (
        <p className="text-red-400 text-xs text-center max-w-xs">
          Microphone access was denied. Please allow microphone access in your browser settings and reload.
        </p>
      )}
    </div>
  )
}
