# Ukulele Tuner

A cross-platform chromatic ukulele tuner built with React + Vite. Listens to your microphone in real time, detects pitch using the McLeod Pitch Method, and shows how sharp or flat each string is on an SVG arc gauge.

Runs as a **web app**, a **desktop app** (Electron), or a **native mobile app** (iOS/Android via Capacitor) — all from the same codebase.

---

## Features

- Real-time pitch detection via the Web Audio API + [pitchy](https://github.com/ianprime0509/pitchy)
- SVG tuning gauge with green/yellow/red zones (±5 / ±20 / ±50 cents)
- Standard G-C-E-A tuning — tap a string button to lock to it, or use Auto mode
- Each string button shows its target frequency (e.g. "E4 / 330 Hz")
- Exponential smoothing + octave-error correction for a stable needle
- Debug mode with live stats and runtime feature toggles (see below)

---

## Getting Started

```bash
npm install
npm run dev        # opens http://localhost:5173
```

Click **Start Tuning**, allow microphone access, and pluck a string.

---

## npm Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run dev:debug` | Start with debug panel enabled (`VITE_DEBUG=true`) |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run cap:sync` | Build + sync `dist/` into Capacitor native projects |
| `npm run electron:dev` | Run Electron + Vite dev server concurrently |
| `npm run electron:build` | Build + package desktop app via electron-builder |

---

## Debug Mode

```bash
npm run dev:debug
```

Shows a debug panel at the bottom of the app (stripped entirely from production builds):

- **Large Buffer (4096)** — doubles the analysis window from 2048 → 4096 samples, giving ~30 cycles of E4 per frame instead of ~15. Improves MPM accuracy on complex nylon strings. Restarts the mic when toggled.
- **Outlier Rejection** — discards pitch frames that deviate > 200 cents from the current running estimate, preventing rogue harmonics from corrupting the smoothed value. On by default.
- **Live stats** — raw detected frequency, clarity score, FFT size, and whether the last frame was accepted or rejected.

`VITE_DEBUG` is a Vite build-time constant. When `false`, the debug panel branch is dead-code eliminated and never shipped to users.

---

## Mobile Deployment (Capacitor)

Requires [Capacitor CLI](https://capacitorjs.com/docs/getting-started):

```bash
# First time only
npx cap add ios
npx cap add android

# After any code change
npm run cap:sync   # runs vite build && cap sync

# Open in native IDE
npx cap open ios      # Xcode
npx cap open android  # Android Studio
```

**iOS** — add to `ios/App/App/Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Required to detect the pitch of your ukulele strings.</string>
```

**Android** — confirm in `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

---

## Desktop Deployment (Electron)

```bash
npm run electron:dev    # development (Vite HMR + Electron)
npm run electron:build  # production package
```

macOS signed builds require the `com.apple.security.device.microphone` entitlement — already configured in `electron/entitlements.mac.plist` and referenced from `electron-builder.config.json`.

---

## Project Structure

```
src/
  audio/
    AudioEngine.ts          Web Audio API — mic capture, RAF loop, configurable fftSize
    PitchDetector.ts        pitchy wrapper — clarity + frequency-range filtering
    noteUtils.ts            Pure math: freqToCents, findClosestString, octaveCorrect
    noteUtils.test.ts
    PitchDetector.test.ts
  components/
    App.tsx                 Root — composes all components, owns settings state
    StringSelector.tsx      G / C / E / A string buttons with target Hz
    TuningNeedle.tsx        SVG arc gauge (green/yellow/red zones, animated needle)
    PitchDisplay.tsx        Detected note name + Hz readout
    StatusBanner.tsx        "In Tune" / "Too Sharp" / "Too Flat" / "Pluck a String"
    DebugPanel.tsx          Debug-mode panel (VITE_DEBUG=true only)
  hooks/
    useMicrophone.ts        Mic permission flow (web + Capacitor-aware)
    usePitchDetection.ts    Audio → React state bridge (EMA, outlier rejection)
  constants/
    tuning.ts               String frequencies, cent thresholds, detection limits
    debug.ts                DEBUG_MODE constant (read from VITE_DEBUG)
  vite-env.d.ts             TypeScript types for Vite env vars
  main.tsx                  ReactDOM entry point
  index.css                 Tailwind base + body/root styles
index.html
vite.config.ts
tsconfig.json
capacitor.config.ts
electron-builder.config.json
electron/
  main.js                   Electron main process
  preload.js                Isolated preload (minimal)
  entitlements.mac.plist    macOS microphone entitlement
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite 5 |
| Language | TypeScript (strict) |
| Pitch detection | pitchy — McLeod Pitch Method |
| Styling | Tailwind CSS v3 |
| Testing | Vitest |
| Mobile | Capacitor v6 |
| Desktop | Electron 31 + electron-builder |

---

## How It Works

```
Microphone (MediaStream)
  → AudioContext / AnalyserNode  (2048 or 4096 sample buffer, smoothingTimeConstant=0)
    → octaveCorrect(rawFreq, targetString)   (fold harmonics to fundamental octave)
      → EMA smoother  (α=0.2, ~150ms settling)
        → outlier rejection  (discard frames > 200¢ from current estimate)
          → freqToCents(smoothedFreq, targetString.frequency)
            → React state @ 30fps  (usePitchDetection hook)
              → TuningNeedle + StatusBanner re-render
```

Key decisions:
- **Octave correction before EMA** — prevents harmonics from averaging with the fundamental and pulling the estimate to the wrong pitch
- **Outlier rejection** — a single rogue frame has zero effect on the displayed value
- **`AudioContext` created inside a click handler** — required by iOS Safari's autoplay policy
