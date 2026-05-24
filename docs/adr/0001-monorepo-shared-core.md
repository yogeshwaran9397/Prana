# 0001 — Monorepo with a platform-free shared TypeScript core

- **Status:** Accepted
- **Date:** 2026-05-24
- **Context:** SRS C2/PCN-2, NFR-20/NFR-21

## Context

PranaCoach ships to desktop (R1), then mobile (R2), then adds a cloud backend (R3). The domain
logic — timer engine, goals/streaks, badges, the storage contract — must not be rewritten per
platform, or the three releases will diverge.

## Decision

Use a **pnpm + Turborepo-style monorepo** with a single shared package, `packages/core`, that
contains domain types, the `TimerEngine`, timeline compiler, goals/badges logic, presets, and the
`StorageRepository` **interface**. `core` has **zero** Electron/DOM/Node imports and is covered by
unit tests. Platform apps (`apps/desktop` now; `apps/mobile` later) consume it unchanged.

## Consequences

- **+** R2/R3 reuse the most valuable, highest-risk logic verbatim (NFR-20 ≥80% reuse target).
- **+** The core is unit-testable in isolation (40 tests today) with no platform harness.
- **+** A lint/review rule ("no platform imports in core") keeps the boundary honest.
- **−** Slightly more setup (workspace wiring, build of `core` before apps) than a single app.
- **−** Requires discipline: platform concerns (camera, mic, notifications, DB) must stay in the
  app layer behind adapters, never leak into `core`.
