# Ukulele Tuner — Implementation Plan

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
    AudioEngine.ts        ← singleton: owns AudioContext + AnalyserNode
    PitchDetector.ts      ← wraps pitchy, converts freq → note + cents
    noteUtils.ts          ← frequency/note/cents math helpers
  components/
    StringSelector.tsx    ← G / C / E / A tab strip
    TuningNeedle.tsx      ← SVG arc gauge showing cents deviation
    PitchDisplay.tsx      ← current detected note + frequency readout
    StatusBanner.tsx      ← "In Tune" / "Too Sharp" / "Too Flat" feedback
    App.tsx               ← root: wires audio → state → UI
  hooks/
    usePitchDetection.ts  ← custom hook: starts/stops audio, publishes pitch frames
    useMicrophone.ts      ← abstracts getUserMedia + Capacitor permission flow
  constants/
    tuning.ts             ← UKULELE_STRINGS, target frequencies, cent thresholds
  main.tsx
index.html
capacitor.config.ts
electron/
  main.js                 ← Electron main process
  preload.js
vite.config.ts
tsconfig.json
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

**`src/audio/noteUtils.ts`**

Pure functions (all unit-testable):
- `freqToMidi(freq)` — `69 + 12 * log2(freq / 440)`
- `midiToFreq(midi)` — inverse
- `freqToCents(detected, target)` — `1200 * log2(detected / target)`, clamped to `[-50, 50]`
- `findClosestString(freq)` — returns the string with smallest absolute cents deviation

---

### Phase 3 — Audio Engine

**`src/audio/AudioEngine.ts`**

A class (not a React component) with:
```typescript
class AudioEngine {
  async start(onFrame: (buffer: Float32Array, sampleRate: number) => void): Promise<void>
  stop(): void
}
```

- `analyser.fftSize = 2048` — ~46ms of audio at 44100 Hz, enough for ~12 cycles of C4
- `smoothingTimeConstant = 0` — pitchy operates on raw PCM, not smoothed spectrum
- `stop()` cancels the RAF loop, disconnects nodes, closes AudioContext, and stops all MediaStream tracks (releases mic indicator on mobile)

**`src/audio/PitchDetector.ts`**

Wraps pitchy's `PitchDetector.forFloat32Array(bufferSize)`:
- Filters out frames where `clarity < 0.9`
- Filters out frequencies outside `[70, 1500]` Hz (outside ukulele range)

---

### Phase 4 — React Hooks

**`src/hooks/useMicrophone.ts`**

Platform-aware permission flow:
- Web: `navigator.mediaDevices.getUserMedia` directly
- Capacitor (`Capacitor.isNativePlatform()`): call `Microphone.requestPermissions()` first, then `getUserMedia`

Exports: `{ status: 'idle' | 'requesting' | 'granted' | 'denied', requestAccess }`

**`src/hooks/usePitchDetection.ts`**

Bridges `AudioEngine` into React. Uses `useRef` for the engine (stable, no re-renders) and `useState` for values that drive UI:

```typescript
{
  isListening: boolean,
  frequency: number | null,
  clarity: number | null,
  cents: number | null,
  closestString: UkuleleString | null,
  start: () => Promise<void>,
  stop: () => void,
}
```

State updates are throttled to ~30fps (timestamp check in `onFrame`) to avoid 60 React reconciles per second.

---

### Phase 5 — UI Components

**`src/components/StringSelector.tsx`**

Four buttons (G / C / E / A) in a horizontal row. Active string is highlighted. Pure presentational: `({ strings, selected, onSelect })`.

**`src/components/TuningNeedle.tsx`**

SVG arc gauge (the core visual):
- Static semicircular arc (180°) with colored zones: green (±5¢), yellow (±5–20¢), red (±20–50¢)
- Needle `<line>` rotated by CSS transform based on `cents` prop
- At 0¢: points straight up. At -50¢: hard left. At +50¢: hard right.
- `transition: transform 80ms ease-out` for responsive feel without jitter
- Numeric cents value displayed below the arc

**`src/components/PitchDisplay.tsx`**

Shows detected frequency (e.g., "329.4 Hz") and closest note name (e.g., "E4"). Updates at throttled 30fps.

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

**`src/audio/noteUtils.test.ts`** — Unit tests for pure math functions:
- E4 at exactly 329.63 Hz → 0 cents
- 350 Hz against E4 target → ~+103 cents
- 445 Hz input → A4 identified as closest string

**`src/audio/PitchDetector.test.ts`** — Clarity filter and frequency-range guard using synthetic sine wave Float32Arrays.

---

## Key Technical Gotchas

### iOS Safari / Capacitor
- `AudioContext` must be created inside a user gesture handler — show a "Tap to Start" button on first load
- On Capacitor/iOS, must call `Microphone.requestPermissions()` via the plugin *before* `getUserMedia`, or it silently fails

### Pitch Detection
- Buffer size: 2048 samples @ 44100 Hz = ~46ms. Sufficient for ~12 full cycles of C4 (lowest ukulele string). Going smaller risks missing low-frequency strings.
- Clarity threshold 0.9 is a good default — lower accepts noisier frames, higher causes gaps in noisy environments

### Auto-Detection vs. Manual String Selection
- Auto-detect via `findClosestString` works well for single strings but breaks when multiple strings ring simultaneously
- Default to auto-detect; let users tap a string to lock to that string's target frequency

### Electron macOS
- Unsigned dev builds work without entitlements
- Signed production builds need `com.apple.security.device.microphone` in `entitlements.plist` via `electron-builder` config
