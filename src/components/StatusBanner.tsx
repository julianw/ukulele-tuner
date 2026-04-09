import { IN_TUNE_THRESHOLD_CENTS } from '../constants/tuning'

interface StatusBannerProps {
  cents: number | null
  isListening: boolean
}

export function StatusBanner({ cents, isListening }: StatusBannerProps) {
  if (!isListening) {
    return <div className="h-8" />
  }

  if (cents === null) {
    return (
      <div className="text-center text-gray-400 text-lg font-medium h-8">
        Pluck a string
      </div>
    )
  }

  if (Math.abs(cents) <= IN_TUNE_THRESHOLD_CENTS) {
    return (
      <div className="text-center text-green-400 text-lg font-bold h-8">
        In Tune
      </div>
    )
  }

  return (
    <div className="text-center text-red-400 text-lg font-bold h-8">
      {cents > 0 ? 'Too Sharp' : 'Too Flat'}
    </div>
  )
}
