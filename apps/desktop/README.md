# @prana/desktop

The PranaCoach Electron desktop app (POC 1 / R1). Consumes [`@prana/core`](../../packages/core)
for all domain logic and adds the platform layer: persistence, OS integration, and the React UI.
Built with `electron-vite`; see [ADR 0002](../../docs/adr/0002-electron-over-tauri.md).

## Process model

```
┌─ Renderer (React) ────────────────────────────────────────────┐
│  screens/  components/  store/  audio/  lib/ (presence, voice) │
│  runs TimerEngine + opt-in camera/mic; never touches the DB    │
└───────────────────────────────┬────────────────────────────────┘
                                 │ contextBridge (typed window.prana)
┌─ Preload ───────────────────── ▼ ──────────────────────────────┐
│  preload/index.ts — narrow, typed IPC surface (no Node leaks)   │
└───────────────────────────────┬────────────────────────────────┘
                                 │ ipcRenderer.invoke ↔ ipcMain.handle
┌─ Main (Node) ───────────────── ▼ ──────────────────────────────┐
│  main/index.ts  app lifecycle · BrowserWindow · Notification     │
│  main/db.ts     SqliteStorageRepository (better-sqlite3)         │
│  main/ipc.ts    shared channel names                             │
└─────────────────────────────────────────────────────────────────┘
```

`contextIsolation` on, `nodeIntegration` off — the renderer only sees the typed `window.prana` API.

## Directory map

| Path | Responsibility |
|---|---|
| `src/main/index.ts` | Lifecycle, window, native notifications, file export/import, IPC handlers |
| `src/main/db.ts` | `SqliteStorageRepository` — schema, migrations, CRUD, export/import (PCN-3) |
| `src/main/ipc.ts` | IPC channel names shared by main + preload |
| `src/preload/index.ts` | `contextBridge` exposing `window.prana` |
| `src/renderer/src/screens/` | Home · RoutineBuilder · SessionPlayer · Dashboard · Settings · FirstRun |
| `src/renderer/src/components/` | Presentational pieces (BreathAnimation, …) |
| `src/renderer/src/store/` | Zustand app store (profile, settings, sessions, badges) |
| `src/renderer/src/audio/` | WebAudio cue player (tones + spoken prompts) |
| `src/renderer/src/lib/` | Platform/media adapters: `presence.ts` (camera), `voice.ts` (mic) |

> **Adapter boundary (NFR-21):** camera, mic, notifications, and storage are isolated here, behind
> interfaces — `@prana/core` never calls a platform API. `lib/presence.ts` (`detect()`) and
> `lib/voice.ts` (`loadRecognizer()`) are the documented swap points for real MediaPipe/Vosk.

## Commands
```sh
pnpm --filter @prana/desktop dev        # hot-reload dev (electron-vite)
pnpm --filter @prana/desktop typecheck  # tsc --noEmit for main+preload and renderer
pnpm --filter @prana/desktop build      # production bundle → out/
pnpm --filter @prana/desktop package    # Windows NSIS installer → release/
```

## Native binaries
`better-sqlite3` and the Electron runtime are native. After install (or when switching platforms):
```sh
pnpm --filter @prana/desktop exec electron-builder install-app-deps
```
If launching Electron from a shell exporting `ELECTRON_RUN_AS_NODE=1`, unset it first — otherwise
`require('electron')` returns a path string and the app fails at `app.whenReady`.

## Typecheck config
Typechecking is split because main/preload (Node) and renderer (DOM) need different libs:
`tsconfig.node.json` (main + preload) and `tsconfig.web.json` (renderer). `pnpm typecheck` runs both.
