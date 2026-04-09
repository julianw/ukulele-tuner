import type { UkuleleString } from '../constants/tuning'

interface PitchDisplayProps {
  frequency: number | null
  closestString: UkuleleString | null
}

export function PitchDisplay({ frequency, closestString }: PitchDisplayProps) {
  return (
    <div className="text-center">
      <div className="text-5xl font-bold text-white tracking-tight min-h-[3.5rem]">
        {closestString ? `${closestString.note}${closestString.octave}` : '—'}
      </div>
      <div className="text-gray-400 text-sm mt-1 min-h-[1.25rem]">
        {frequency !== null ? `${Math.round(frequency)} Hz` : ''}
      </div>
    </div>
  )
}
