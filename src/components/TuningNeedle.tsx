import { MAX_DISPLAY_CENTS, IN_TUNE_THRESHOLD_CENTS } from '../constants/tuning'

interface TuningNeedleProps {
  cents: number | null
}

const CX = 150
const CY = 145
const RADIUS = 110
const NEEDLE_LENGTH = 95

function polarToXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  }
}

// Builds a clockwise SVG arc path from startAngle to endAngle (standard math angles)
// 180° = left, 270° = up, 360° = right — all arcs go clockwise (through the top)
function arcPath(startDeg: number, endDeg: number, r: number) {
  const start = polarToXY(startDeg, r)
  const end = polarToXY(endDeg, r)
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

// cents=0 → 270° (up), cents=-50 → 180° (left), cents=+50 → 360° (right)
function centsToAngle(cents: number): number {
  const clamped = Math.max(-MAX_DISPLAY_CENTS, Math.min(MAX_DISPLAY_CENTS, cents))
  return 270 + (clamped / MAX_DISPLAY_CENTS) * 90
}

export function TuningNeedle({ cents }: TuningNeedleProps) {
  // Needle rotation in degrees: 0 = up, -90 = left, +90 = right
  const needleRotation = cents !== null ? (cents / MAX_DISPLAY_CENTS) * 90 : 0

  const inTuneRatio = IN_TUNE_THRESHOLD_CENTS / MAX_DISPLAY_CENTS  // 5/50 = 0.1
  const yellowRatio = 20 / MAX_DISPLAY_CENTS                        // 20/50 = 0.4

  // Zone boundaries in degrees (270° = center/top)
  const leftEdge   = 270 - 90               // 180°
  const leftYellow = 270 - 90 * yellowRatio  // 234°
  const leftGreen  = 270 - 90 * inTuneRatio  // 261°
  const rightGreen  = 270 + 90 * inTuneRatio  // 279°
  const rightYellow = 270 + 90 * yellowRatio  // 306°
  const rightEdge   = 270 + 90               // 360°

  return (
    <div className="flex flex-col items-center">
      <svg width={300} height={170} viewBox="0 0 300 170" aria-label="Tuning needle">
        {/* Red zones (±20–50 cents) */}
        <path d={arcPath(leftEdge, leftYellow, RADIUS)}
          fill="none" stroke="#ef4444" strokeWidth={14} strokeLinecap="round" />
        <path d={arcPath(rightYellow, rightEdge, RADIUS)}
          fill="none" stroke="#ef4444" strokeWidth={14} strokeLinecap="round" />

        {/* Yellow zones (±5–20 cents) */}
        <path d={arcPath(leftYellow, leftGreen, RADIUS)}
          fill="none" stroke="#eab308" strokeWidth={14} strokeLinecap="round" />
        <path d={arcPath(rightGreen, rightYellow, RADIUS)}
          fill="none" stroke="#eab308" strokeWidth={14} strokeLinecap="round" />

        {/* Green zone (±5 cents) */}
        <path d={arcPath(leftGreen, rightGreen, RADIUS)}
          fill="none" stroke="#22c55e" strokeWidth={14} strokeLinecap="round" />

        {/* Tick marks */}
        {[-50, -20, -10, 0, 10, 20, 50].map(c => {
          const a = centsToAngle(c)
          const inner = polarToXY(a, RADIUS - 18)
          const outer = polarToXY(a, RADIUS + 4)
          return (
            <line key={c}
              x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke="#ffffff40" strokeWidth={c === 0 ? 2 : 1}
            />
          )
        })}

        {/* Needle — rotates around (CX, CY); drawn pointing up, then rotated */}
        <g
          transform={`rotate(${needleRotation}, ${CX}, ${CY})`}
          style={{ transition: cents !== null ? 'transform 80ms ease-out' : 'none' }}
        >
          <line
            x1={CX} y1={CY}
            x2={CX} y2={CY - NEEDLE_LENGTH}
            stroke="white" strokeWidth={2.5} strokeLinecap="round"
          />
        </g>

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
