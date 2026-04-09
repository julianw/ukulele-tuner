import { MAX_DISPLAY_CENTS, IN_TUNE_THRESHOLD_CENTS } from '../constants/tuning'

interface TuningNeedleProps {
  cents: number | null
}

const CX = 150
const CY = 140
const RADIUS = 110
const NEEDLE_LENGTH = 95

function polarToXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  }
}

// Build an SVG arc path from startAngle to endAngle (in degrees, measured from positive x-axis)
function arcPath(startDeg: number, endDeg: number, r: number) {
  const start = polarToXY(startDeg, r)
  const end = polarToXY(endDeg, r)
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
}

// Map cents [-50, 50] to angle [-90, 90] degrees (0° = pointing left, 180° = pointing right, 270° = up)
// We want needle at 270° (straight up) when cents=0, so map:
// cents=-50 → 180°, cents=0 → 270°, cents=50 → 360°
function centsToAngle(cents: number): number {
  const clamped = Math.max(-MAX_DISPLAY_CENTS, Math.min(MAX_DISPLAY_CENTS, cents))
  return 180 + (clamped / MAX_DISPLAY_CENTS) * 90
}

export function TuningNeedle({ cents }: TuningNeedleProps) {
  const angle = cents !== null ? centsToAngle(cents) : 270

  const needle = polarToXY(angle, NEEDLE_LENGTH)

  const inTuneRatio = IN_TUNE_THRESHOLD_CENTS / MAX_DISPLAY_CENTS
  const yellowRatio = 20 / MAX_DISPLAY_CENTS

  return (
    <div className="flex flex-col items-center">
      <svg width={300} height={170} viewBox="0 0 300 170" aria-label="Tuning needle">
        {/* Red arcs (outer zones ±20–50 cents) */}
        <path
          d={arcPath(180, 180 + 90 * (1 - yellowRatio), RADIUS)}
          fill="none" stroke="#ef4444" strokeWidth={14} strokeLinecap="round"
        />
        <path
          d={arcPath(180 + 90 * (1 + yellowRatio), 270, RADIUS)}
          fill="none" stroke="#ef4444" strokeWidth={14} strokeLinecap="round"
        />

        {/* Yellow arcs (±5–20 cents) */}
        <path
          d={arcPath(180 + 90 * (1 - yellowRatio), 180 + 90 * (1 - inTuneRatio), RADIUS)}
          fill="none" stroke="#eab308" strokeWidth={14} strokeLinecap="round"
        />
        <path
          d={arcPath(180 + 90 * (1 + inTuneRatio), 180 + 90 * (1 + yellowRatio), RADIUS)}
          fill="none" stroke="#eab308" strokeWidth={14} strokeLinecap="round"
        />

        {/* Green arc (center ±5 cents) */}
        <path
          d={arcPath(180 + 90 * (1 - inTuneRatio), 180 + 90 * (1 + inTuneRatio), RADIUS)}
          fill="none" stroke="#22c55e" strokeWidth={14} strokeLinecap="round"
        />

        {/* Tick marks */}
        {[-50, -20, -10, 0, 10, 20, 50].map(c => {
          const a = centsToAngle(c)
          const inner = polarToXY(a, RADIUS - 18)
          const outer = polarToXY(a, RADIUS + 4)
          return (
            <line
              key={c}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="#ffffff40" strokeWidth={c === 0 ? 2 : 1}
            />
          )
        })}

        {/* Needle */}
        <line
          x1={CX} y1={CY}
          x2={needle.x} y2={needle.y}
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ transition: cents !== null ? 'all 80ms ease-out' : 'none' }}
        />

        {/* Center dot */}
        <circle cx={CX} cy={CY} r={5} fill="white" />
      </svg>

      {/* Cents readout */}
      <p className="text-gray-400 text-sm mt-1 h-5">
        {cents !== null ? `${cents > 0 ? '+' : ''}${Math.round(cents)}¢` : ''}
      </p>
    </div>
  )
}
