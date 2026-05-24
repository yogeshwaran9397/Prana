# Architecture Decision Records (ADR)

Each ADR captures one significant, hard-to-reverse decision: the context, the choice, and the
consequences. Format is lightweight ([MADR](https://adr.github.io/madr/)-style). ADRs are
immutable once **Accepted** — to change a decision, add a new ADR that supersedes the old one.

| #                                         | Decision                                                      | Status   |
| ----------------------------------------- | ------------------------------------------------------------- | -------- |
| [0001](./0001-monorepo-shared-core.md)    | Monorepo with a platform-free shared TypeScript core          | Accepted |
| [0002](./0002-electron-over-tauri.md)     | Electron for the R1 desktop shell (over Tauri)                | Accepted |
| [0003](./0003-offline-voice-vosk.md)      | Offline voice via Vosk, not the Web Speech API                | Accepted |
| [0004](./0004-storage-repository-seam.md) | All persistence behind a `StorageRepository` interface        | Accepted |
| [0005](./0005-monotonic-timer-engine.md)  | Monotonic, schedule-anchored timer engine for ±100ms accuracy | Accepted |
