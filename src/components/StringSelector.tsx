import { UKULELE_STRINGS, type UkuleleString } from '../constants/tuning'

interface StringSelectorProps {
  selected: UkuleleString | null
  onSelect: (string: UkuleleString | null) => void
}

export function StringSelector({ selected, onSelect }: StringSelectorProps) {
  return (
    <div className="flex gap-2 justify-center">
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          selected === null
            ? 'bg-indigo-500 text-white'
            : 'bg-white/10 text-gray-300 hover:bg-white/20'
        }`}
      >
        Auto
      </button>
      {UKULELE_STRINGS.map(string => (
        <button
          key={string.name}
          onClick={() => onSelect(string)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            selected?.name === string.name
              ? 'bg-indigo-500 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          {string.note}{string.octave}
        </button>
      ))}
    </div>
  )
}
