# @prana/core

The **platform-free** heart of PranaCoach: domain model, timer engine, goals/streaks, badges, the
storage contract, and built-in presets. **No Electron, DOM, or Node imports** — so the desktop
app (R1), mobile app (R2), and cloud backend (R3) all reuse it unchanged. See
[ADR 0001](../../docs/adr/0001-monorepo-shared-core.md).

## Module map

| Path | Responsibility | Key requirements |
|---|---|---|
| [`src/domain/types.ts`](./src/domain/types.ts) | `Phase`, `Technique`, `Routine`, `SafetyCaps`, `Progression` | PFR-1, PFR-7 |
| [`src/engine/timeline.ts`](./src/engine/timeline.ts) | Pure routine → flat timeline compiler (caps, ratio, pace, progression) | PFR-5/6/7/9/12 |
| [`src/engine/TimerEngine.ts`](./src/engine/TimerEngine.ts) | Monotonic, schedule-anchored FSM; `start/pause/resume/skip/stop` + events | PFR-11/13/14, NFR-1 ([ADR 0005](../../docs/adr/0005-monotonic-timer-engine.md)) |
| [`src/goals/goals.ts`](./src/goals/goals.ts) | Streaks, weekly/monthly progress, totals (pure) | PFR-30, PFR-31 |
| [`src/badges/badges.ts`](./src/badges/badges.ts) | Badge rules engine + seed definitions | PFR-32 |
| [`src/storage/StorageRepository.ts`](./src/storage/StorageRepository.ts) | The persistence interface + DTOs (the R3 swap seam) | PCN-3 ([ADR 0004](../../docs/adr/0004-storage-repository-seam.md)) |
| [`src/presets/presets.ts`](./src/presets/presets.ts) | Built-in techniques + Beginner/Intermediate/Advanced routines | PFR-8 |

## Design rules
- **Purity:** `compileTimeline`, streak/goal/badge functions take inputs and return outputs — no
  I/O, no clocks except injected. This is what makes them deterministically testable.
- **Injected clock:** `TimerEngine` takes `epochNow` and is pumped with a monotonic `nowMs`, so
  tests use a fake clock and never real timers.
- **Storage is an interface, not an implementation.** `core` never imports a database.

## Commands
```sh
pnpm --filter @prana/core test       # 40 unit tests (Vitest)
pnpm --filter @prana/core build      # tsc → dist/
pnpm --filter @prana/core typecheck  # tsc --noEmit
```

Tests live in [`test/`](./test) with deterministic fixtures and reference the requirement ID they
verify.
