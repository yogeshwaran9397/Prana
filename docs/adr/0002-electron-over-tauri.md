# 0002 — Electron for the R1 desktop shell (over Tauri)

- **Status:** Accepted
- **Date:** 2026-05-24
- **Context:** ARCHITECTURE.md §9 open decision; SRS IR-S1/IR-S2

## Context
R1 is a desktop app that needs: a reliable web UI runtime, native notifications, local SQLite,
and — critically — **on-device ML** for presence (vision) and voice (Vosk WASM). The candidates
were Electron, Tauri 2, and a native toolkit.

## Decision
Ship R1 on **Electron** (`electron-vite` for build, `better-sqlite3` for storage,
`electron-builder` for the Windows installer).

## Consequences
- **+** Mature, broad ecosystem for the WASM/TF.js/MediaPipe ML stack we depend on.
- **+** Single JS/TS runtime end to end — the shared `core` and the UI run without a language seam.
- **+** Capacitor (R2) wraps the *same* web UI, maximizing reuse alongside Electron.
- **−** Larger binary and memory footprint than Tauri's Rust shell.
- **−** Native modules (`better-sqlite3`) must be rebuilt to match the Electron ABI per platform.
- **Revisit if:** binary size becomes a hard constraint and the ML stack gains solid Rust/Tauri
  support — then Tauri 2 could be reconsidered for a future desktop release.
