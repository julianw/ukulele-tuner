import type { PitchDetectionSettings, DebugInfo } from '../hooks/usePitchDetection'

interface DebugPanelProps {
  settings: PitchDetectionSettings
  onChange: (settings: PitchDetectionSettings) => void
  debugInfo: DebugInfo
}

function Toggle({ label, sublabel, checked, onChange }: {
  label: string
  sublabel: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
      <div>
        <div className="text-xs font-semibold text-yellow-200">{label}</div>
        <div className="text-xs text-yellow-600 mt-0.5">{sublabel}</div>
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-yellow-400' : 'bg-white/20'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </label>
  )
}

export function DebugPanel({ settings, onChange, debugInfo }: DebugPanelProps) {
  return (
    <div className="w-full rounded-xl border border-yellow-500/30 bg-yellow-950/40 p-4 font-mono text-xs">
      <div className="text-yellow-400 font-bold mb-3 tracking-widest uppercase text-[10px]">
        ⚙ Debug
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-3 mb-4">
        <Toggle
          label="Large Buffer (4096)"
          sublabel="2× more cycles → better accuracy. Restarts mic."
          checked={settings.largeBuffer}
          onChange={v => onChange({ ...settings, largeBuffer: v })}
        />
        <Toggle
          label="Outlier Rejection"
          sublabel="Discard frames > 200¢ from current estimate"
          checked={settings.outlierRejection}
          onChange={v => onChange({ ...settings, outlierRejection: v })}
        />
      </div>

      {/* Live stats */}
      <div className="border-t border-yellow-500/20 pt-3 grid grid-cols-2 gap-x-4 gap-y-1">
        <Stat label="FFT size" value={String(debugInfo.fftSize)} />
        <Stat label="Raw freq"
          value={debugInfo.rawFrequency !== null ? `${debugInfo.rawFrequency.toFixed(1)} Hz` : '—'} />
        <Stat label="Clarity"
          value={debugInfo.clarity !== null ? debugInfo.clarity.toFixed(3) : '—'} />
        <Stat label="Last frame"
          value={debugInfo.lastFrameRejected ? 'REJECTED' : 'accepted'}
          highlight={debugInfo.lastFrameRejected}
        />
      </div>
    </div>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="text-yellow-700">{label}: </span>
      <span className={highlight ? 'text-red-400 font-bold' : 'text-yellow-300'}>{value}</span>
    </div>
  )
}
