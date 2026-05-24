# PranaCoach — POC 1 (R1 Desktop MVP)

Adaptive, beginner-safe pranayama breath-timer with guided sessions, opt-in presence & voice,
and offline streak/goal/badge tracking. Offline, no account, Windows-first.

This is the implementation of **POC 1 / Release R1** as specified in
[docs/poc-1/SRS.md](docs/poc-1/SRS.md) and planned in
[docs/poc-1/IMPLEMENTATION.md](docs/poc-1/IMPLEMENTATION.md).

## Monorepo layout

```
packages/core      Shared, platform-free TypeScript: domain types, TimerEngine, timeline
                   compiler, goals/streaks, badges, StorageRepository interface, presets.
                   Zero Electron/DOM imports → reusable by R2 (mobile) and R3 (cloud). 40 unit tests.
apps/desktop       Electron app: main (SQLite repo + IPC + notifications), preload (typed bridge),
                   renderer (React + Tailwind + Zustand): 5 screens + first-run disclaimer.
```

## Prerequisites
- Node ≥ 20, pnpm ≥ 10.
- On first setup the native deps (Electron binary, `better-sqlite3`) must be built:
  ```sh
  pnpm install
  # if the Electron binary / sqlite binding are missing, fetch them:
  pnpm --filter @prana/desktop exec electron-builder install-app-deps
  ```

## Develop & run
```sh
pnpm test            # run the @prana/core unit suite (40 tests)
pnpm dev             # launch the desktop app with hot reload (electron-vite)
pnpm build:desktop   # production bundle (out/main, out/preload, out/renderer)
pnpm --filter @prana/desktop package   # Windows NSIS installer (release/)
```

> Note: if running Electron from a shell that exports `ELECTRON_RUN_AS_NODE=1`, unset it first —
> that variable makes Electron behave as plain Node and `require('electron')` returns a path string.

## What works (R1 acceptance — see SRS §7)
- **Adaptive timer engine** — per-phase/per-round durations (0.5s granularity), rounds, ratio
  mode, live pace multiplier, beginner max-hold safety cap with override + warning, optional
  progression auto-ramp. Deterministic, drift-free (anchors phases to the scheduled boundary so a
  15-min session stays within ±100ms). _(packages/core, fully unit-tested.)_
- **Guided session** — breath animation synced to phases, audio cues (WebAudio tones + spoken
  prompts) with captions, pre-session consent + disclaimer, pause/resume/skip/stop.
- **Opt-in presence** — randomized on-device webcam checks → present/absent + confidence →
  presence %; only booleans stored, frames discarded. App fully works with camera off.
  _(Heuristic detector; swap in MediaPipe/BlazeFace at `lib/presence.ts` `detect()`.)_
- **Opt-in voice** — restricted-grammar "pause/resume/stop", debounced, with an always-present
  button fallback. _(Offline Vosk recognizer is a documented swap-in; see `lib/voice.ts`.)_
- **Logging / streaks / goals / badges / notifications / dashboard** — sessions persist to SQLite;
  streaks, weekly/monthly goals, 5 seed badges, native notifications, charts + trophy shelf.
- **JSON export/import** — full snapshot; import replaces local data.
- **First-run medical disclaimer**, high-contrast theme, keyboard-operable UI.

## Known POC limitations
- Presence uses a lightweight no-model heuristic (no MediaPipe model bundled).
- Voice reports "unsupported" until an offline Vosk model is wired (button control always works).
- Windows-first; macOS/Linux build configs are best-effort and untested.
- Native binaries (`better-sqlite3`, Electron) must match the runtime; rebuild on platform change.

## Traceability
Requirement IDs (`PFR-*`, `PNFR-*`, …) referenced throughout the source map to
[docs/poc-1/SRS.md](docs/poc-1/SRS.md); build phases to
[docs/poc-1/IMPLEMENTATION.md](docs/poc-1/IMPLEMENTATION.md).
