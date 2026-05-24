# 0003 — Offline voice via Vosk, not the Web Speech API

- **Status:** Accepted
- **Date:** 2026-05-24
- **Context:** SRS PFR-25/PFR-27, NFR-9; PRD §9 risks

## Context

Voice control ("pause"/"resume") must work **offline** and must **not** transmit audio (privacy
driver C4/PCN-4). The browser `SpeechRecognition` (Web Speech API) is the obvious shortcut.

## Decision

Use **Vosk** (WASM, small English model) with a **restricted recognizer grammar** of just the
command words. Do **not** use the Web Speech API.

## Consequences

- **+** Truly offline and local — no audio leaves the device; satisfies the privacy/offline drivers.
- **+** A restricted grammar (`pause|resume|stop`) sharply increases accuracy for our use case.
- **−** A model file (~tens of MB) must be bundled/shipped; larger app size.
- **−** More integration work than calling a built-in browser API.
- **Why not Web Speech API:** in Chromium it routes audio to a cloud service and is unreliable
  offline — a direct violation of the offline-first and "no media transmitted" requirements.
- **POC 1 status:** the recognizer is a documented swap-in (`apps/desktop/src/renderer/src/lib/voice.ts`);
  until a model is wired it reports `unsupported` and the always-present **button/keyboard
  fallback** (PFR-28) covers control.
