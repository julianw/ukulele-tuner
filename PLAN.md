# Ukulele Tuner — Implementation Plan

## Project Status

## Project Status

### Done
- [x] **Phase 1** — Project scaffold (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, Tailwind/PostCSS config)
- [x] **Phase 2** — Constants and math utilities (`tuning.ts`, `noteUtils.ts` — `freqToCents`, `findClosestString`, `octaveCorrect`)
- [x] **Phase 3** — Audio engine (`AudioEngine.ts` Web Audio RAF loop with configurable fftSize, `PitchDetector.ts` pitchy/MPM wrapper)
- [x] **Phase 4** — React hooks (`useMicrophone.ts` permission flow, `usePitchDetection.ts` with EMA smoothing, outlier rejection, debug info)
- [x] **Phase 5** — UI components (`TuningNeedle` SVG gauge, `StringSelector` with Hz labels, `PitchDisplay`, `StatusBanner`, `App`)
- [x] **Phase 6** — Capacitor config (`capacitor.config.ts` for iOS/Android)
- [x] **Phase 7** — Electron integration (`electron/main.js`, `electron/preload.js`, `electron-builder.config.json`, macOS entitlements plist)
- [x] **Phase 8** — Unit tests (31 passing: `noteUtils.test.ts`, `PitchDetector.test.ts`)
- [x] Build verified clean (`tsc --noEmit` + `vite build` passing, ~160 kB bundle)
- [x] Bug fix: TuningNeedle gauge orientation (`centsToAngle` mapped 0¢→180° instead of 270°, rotating entire gauge 90°)
- [x] Bug fix: Needle now uses `<g transform="rotate()">` for reliable CSS transition
- [x] EMA smoothing (α=0.2) + null-frame hold (10 frames) for stable display
- [x] Octave error correction (`octaveCorrect`) — prevents harmonics from pinning needle to extremes
- [x] Octave correction applied **before** EMA — fixes E4 detection where fundamental/harmonic averaging was pulling estimate to wrong string
- [x] `MIN_CLARITY` lowered 0.9 → 0.85 for better nylon string (E4) detection
- [x] Debug mode (`npm run dev:debug` / `VITE_DEBUG=true`) with runtime toggles
- [x] Large Buffer toggle (4096 samples) in debug panel
- [x] Outlier Rejection toggle (>200¢ threshold) in debug panel — on by default
- [x] StringSelector shows target frequency below each note name

### Next
- [ ] Add iOS native project (`npx cap add ios`) and verify `Info.plist` microphone permission string
- [ ] Add Android native project (`npx cap add android`) and verify `AndroidManifest.xml` `RECORD_AUDIO` permission
- [ ] CI pipeline (GitHub Actions) — run `npm test` and `npm run build` on each push

### Pending / Backlog
- [ ] Implement median filter (ideas #3) as an alternative/complement to EMA
- [ ] Implement lock-on hysteresis (ideas #5) — require larger deviation to switch strings
- [ ] Verify tuning accuracy on a real device with a physical ukulele
- [ ] `useEffect` cleanup in `App.tsx` to call `stop()` on unmount
- [ ] macOS Electron code signing (requires Apple Developer account + notarization config)

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React + Vite | Fast HMR, plain `dist/` output works everywhere |
| Pitch detection | `pitchy` (McLeod Pitch Method) | ~5 KB, pure TypeScript, more accurate than autocorrelation |
| Mobile | Capacitor v6 | Wraps the same `dist/` for iOS + Android |
| Desktop | Electron (optional) | Also consumes `dist/`, mic via Chromium's `getUserMedia` |
| Styling | Tailwind CSS v4 | Zero runtime, consistent across platforms |
| Testing | Vitest | Co-located with Vite, natural fit for DSP unit tests |
| Language | TypeScript (strict) | Throughout |

---

## Architecture

Data flows in one direction:

```
Microphone (MediaStream)
  → AudioContext / AnalyserNode (getFloatTimeDomainData at ~60fps via requestAnimationFrame)
    → pitchy.findPitch(float32Buffer, sampleRate)
      → noteUtils.freqToNote() + freqToCents()
        → React state via usePitchDetection hook
          → TuningNeedle + StatusBanner re-render
```

No global state manager needed. The audio engine is a singleton outside React; the hook bridges it into the component tree using `useState` + `useEffect`.

---

## File Structure

```
src/
  audio/
    AudioEngine.ts        ← Web Audio pipeline; configurable fftSize (2048 or 4096)
    PitchDetector.ts      ← pitchy/MPM wrapper; clarity + frequency-range filter
    noteUtils.ts          ← freqToCents, findClosestString, octaveCorrect
    noteUtils.test.ts
    PitchDetector.test.ts
  components/
    App.tsx               ← root: owns selectedString + PitchDetectionSettings state
    StringSelector.tsx    ← G / C / E / A buttons with target Hz labels
    TuningNeedle.tsx      ← SVG arc gauge; needle rotated via <g transform="rotate()">
    PitchDisplay.tsx      ← detected note name + rounded Hz readout
    StatusBanner.tsx      ← "In Tune" / "Too Sharp" / "Too Flat" / "Pluck a String"
    DebugPanel.tsx        ← debug-only panel (VITE_DEBUG=true); runtime toggles + live stats
  hooks/
    useMicrophone.ts      ← mic permission flow (web + Capacitor-aware)
    usePitchDetection.ts  ← EMA smoothing, outlier rejection, octave correction, debug info
  constants/
    tuning.ts             ← UKULELE_STRINGS, cent thresholds, MIN_CLARITY, freq limits
    debug.ts              ← DEBUG_MODE constant (import.meta.env.VITE_DEBUG)
  vite-env.d.ts           ← TypeScript types for VITE_DEBUG env var
  main.tsx
  index.css
index.html
capacitor.config.ts
electron-builder.config.json
electron/
  main.js                 ← Electron main process (mic permission handler)
  preload.js
  entitlements.mac.plist  ← macOS microphone entitlement for signed builds
vite.config.ts
tsconfig.json             ← strict mode, noEmit: true (Vite handles bundling)
package.json
```

---

## Implementation Phases

### Phase 1 — Project Scaffold

Files to create:
- `package.json` — dependencies: `react`, `react-dom`, `pitchy`, `@capacitor/core`, `@capacitor/cli`, `@capacitor/microphone`; devDependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `vitest`, `electron` (optional)
- `vite.config.ts` — React plugin + `base: './'` (required for Capacitor's `file://` origin)
- `tsconfig.json` — strict mode, `"target": "ES2022"`, `"lib": ["DOM", "DOM.Iterable", "ESNext"]`
- `index.html` — minimal shell with `<meta name="viewport">` for mobile scaling
- `src/main.tsx` — `ReactDOM.createRoot` entry point

---

### Phase 2 — Constants and Math Utilities

**`src/constants/tuning.ts`**

Standard ukulele strings (standard G-C-E-A tuning):

| String | Note | Frequency |
|---|---|---|
| 4 | G4 | 392.00 Hz |
| 3 | C4 | 261.63 Hz |
| 2 | E4 | 329.63 Hz |
| 1 | A4 | 440.00 Hz |

Constants:
- `IN_TUNE_THRESHOLD_CENTS = 5` — within ±5 cents is "in tune"
- `MAX_DISPLAY_CENTS = 50` — needle clamps at ±50 cents
- `MIN_CLARITY = 0.85` — pitchy frames below this are discarded (lowered from 0.9 to improve nylon string detection)
- `MIN_DETECTABLE_FREQ = 200`, `MAX_DETECTABLE_FREQ = 1200` — outside ukulele range

**`src/audio/noteUtils.ts`**

Pure functions (all unit-testable):
- `freqToMidi(freq)` — `69 + 12 * log2(freq / 440)`
- `midiToFreq(midi)` — inverse
- `freqToCents(detected, target)` — `1200 * log2(detected / target)`, clamped to `[-50, 50]`
- `findClosestString(freq)` — returns closest string using octave-corrected MIDI distance
- `octaveCorrect(detected, target)` — shifts detected freq by octaves until within ±600¢ of target; corrects pitchy's common harmonic detection errors

---

### Phase 3 — Audio Engine

**`src/audio/AudioEngine.ts`**

A class (not a React component) with:
```typescript
class AudioEngine {
  async start(onFrame: FrameCallback, fftSize?: number): Promise<void>
  stop(): Promise<void>
}
export const FFT_SIZE_NORMAL = 2048  // ~46ms @ 44100 Hz, ~15 cycles of C4
export const FFT_SIZE_LARGE  = 4096  // ~93ms @ 44100 Hz, ~30 cycles — toggled via debug panel
```

- `smoothingTimeConstant = 0` — pitchy operates on raw PCM, not smoothed spectrum
- `stop()` cancels the RAF loop, disconnects nodes, closes AudioContext, stops all MediaStream tracks

**`src/audio/PitchDetector.ts`**

Wraps pitchy's `PitchDetector.forFloat32Array(bufferSize)`:
- Filters out frames where `clarity < MIN_CLARITY` (0.85)
- Filters out frequencies outside `[200, 1200]` Hz

---

### Phase 4 — React Hooks

**`src/hooks/useMicrophone.ts`**

Platform-aware permission flow:
- Web: `navigator.mediaDevices.getUserMedia` directly
- Capacitor (`Capacitor.isNativePlatform()`): call `Microphone.requestPermissions()` first, then `getUserMedia`

Exports: `{ status: 'idle' | 'requesting' | 'granted' | 'denied', requestAccess }`

**`src/hooks/usePitchDetection.ts`**

Bridges `AudioEngine` into React. Accepts `PitchDetectionSettings` and returns:

```typescript
{
  isListening: boolean,
  frequency: number | null,   // EMA-smoothed, octave-corrected Hz
  clarity: number | null,
  cents: number | null,
  closestString: UkuleleString | null,
  start: (string?) => Promise<void>,
  stop: () => Promise<void>,
  debugInfo: DebugInfo,       // raw freq, clarity, fftSize, lastFrameRejected
}
```

Processing pipeline per frame:
1. `detectPitch` → raw frequency + clarity
2. `findClosestString(rawFreq)` → target string for correction
3. `octaveCorrect(rawFreq, target)` → corrected raw (harmonic folded to fundamental)
4. Outlier rejection: skip if corrected deviates > 200¢ from current EMA
5. EMA (α=0.2): `smoothed = 0.2 * corrected + 0.8 * prev`
6. `freqToCents(smoothed, targetString.frequency)` → cents for needle

State updates throttled to ~30fps. Engine restarts automatically when `largeBuffer` setting changes.

---

### Phase 5 — UI Components

**`src/components/StringSelector.tsx`**

Four buttons (G / C / E / A) in a horizontal row. Active string is highlighted. Pure presentational: `({ strings, selected, onSelect })`.

**`src/components/TuningNeedle.tsx`**

SVG arc gauge (the core visual):
- Semicircular arc centered at bottom, spanning 180° (left=−50¢, top=0¢, right=+50¢)
- Colored zones: green (±5¢), yellow (±5–20¢), red (±20–50¢)
- Needle is a `<g transform="rotate(deg, cx, cy)">` around center — CSS `transition: transform 80ms ease-out`
- Angle formula: `centsToAngle(c) = 270 + (c / 50) * 90` (maps 0¢ to 270° = straight up)
- Numeric cents value displayed below the arc

**`src/components/PitchDisplay.tsx`**

Shows detected note name (e.g., "E4") and rounded frequency (e.g., "330 Hz"). Updates at throttled 30fps.

**`src/components/DebugPanel.tsx`**

Rendered only when `DEBUG_MODE` is true. Two runtime toggles (Large Buffer, Outlier Rejection) and a live stats grid (raw Hz, clarity, FFT size, last frame status). Uses amber/yellow colour scheme to distinguish from the main UI.

**`src/components/StatusBanner.tsx`**

Large bold text:
- "In Tune" (green) — within `IN_TUNE_THRESHOLD_CENTS`
- "Too Sharp" (red) — cents > threshold
- "Too Flat" (red) — cents < -threshold
- "Pluck a String" — when no frequency detected

**`src/components/App.tsx`**

Root component — composes everything, manages `selectedString` state (null = auto-detect mode using `findClosestString`).

---

### Phase 6 — Capacitor Integration

**`capacitor.config.ts`**

```typescript
{
  appId: 'com.example.ukuleletuner',
  appName: 'Ukulele Tuner',
  webDir: 'dist',
  plugins: { Microphone: {} }
}
```

After each `vite build`, run `npx cap sync` to copy `dist/` into native projects.

Native permission requirements:
- iOS `Info.plist`: `NSMicrophoneUsageDescription`
- Android `AndroidManifest.xml`: `<uses-permission android:name="android.permission.RECORD_AUDIO" />`

---

### Phase 7 — Electron (Optional Desktop)

**`electron/main.js`**

Standard Electron main process loading `dist/index.html` via `file://`. Microphone works via Chromium's `getUserMedia` with no native plugin needed.

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "electron:dev": "concurrently \"vite\" \"electron .\"",
  "electron:build": "vite build && electron-builder",
  "cap:sync": "vite build && cap sync"
}
```

Note: macOS signed builds need the `com.apple.security.device.microphone` entitlement.

---

### Phase 8 — Tests

**`src/audio/noteUtils.test.ts`** (25 tests) — Unit tests for pure math functions:
- `freqToMidi`, `midiToFreq`, `freqToCents` — standard cases + clamping
- `findClosestString` — all four strings + octave-shifted inputs (880 Hz → A4, 659 Hz → E4)
- `octaveCorrect` — same, one octave up/down, two octaves up, within ±600¢ assertion

**`src/audio/PitchDetector.test.ts`** (6 tests) — Clarity filter and frequency-range guard using synthetic sine wave `Float32Array`s at A4, E4, C4; silence; out-of-range frequencies.

---

## Key Technical Gotchas

### iOS Safari / Capacitor
- `AudioContext` must be created inside a user gesture handler — the Start button click is the gesture; do not create the context on mount
- Capacitor's WebView on iOS handles mic permissions via the OS prompt triggered by `getUserMedia`; no separate Capacitor plugin is required

### Pitch Detection — Octave Errors
- pitchy/MPM sometimes locks onto the first harmonic (2× the fundamental) instead of the fundamental itself
- Symptom: needle pegs to ±50¢ because the reading is ~1200¢ off
- Fix: `octaveCorrect(detected, target)` rounds `log2(detected/target)` to the nearest integer and divides out that many octaves
- **Order matters**: octave correction must run on each raw frame **before** feeding into the EMA. If EMA runs first, frames at the fundamental (~330 Hz) and harmonic (~660 Hz) average to ~380 Hz, landing on the wrong string (G4 instead of E4)

### Pitch Detection — Nylon Strings (E4)
- E4 (329.63 Hz) on nylon produces a more complex waveform with lower clarity scores
- `MIN_CLARITY` was lowered from 0.9 → 0.85 to capture more valid frames
- Use the Large Buffer (4096) toggle in debug mode for more reliable detection on this string

### TuningNeedle SVG Geometry
- SVG y-axis increases downward; in standard polar coordinates (used by `Math.cos`/`Math.sin`), 270° points upward on screen
- `centsToAngle` must map 0¢ → 270° (not 180°). The original bug mapped 0¢ → 180° (pointing left), rotating the gauge 90°
- Arc zones use `sweep-flag=1` (clockwise in SVG = going from left through top to right)

### Auto-Detection vs. Manual String Selection
- Auto-detect via `findClosestString` works well for single strings but can be confused when multiple strings ring simultaneously
- Default to auto-detect; users can tap a string button to lock to that string's target frequency

### Electron macOS
- Unsigned dev builds work without entitlements
- Signed production builds need `com.apple.security.device.microphone` in `electron/entitlements.mac.plist` (already configured); wire via `electron-builder.config.json`

### TypeScript + Vite
- `noEmit: true` in `tsconfig.json` — `tsc` is used only for type-checking; Vite handles bundling. Without this, `tsc` writes `.js` files alongside `.ts` sources in `src/`
- `VITE_` prefix on env vars makes them available to the client bundle and subject to Vite's dead-code elimination at build time
