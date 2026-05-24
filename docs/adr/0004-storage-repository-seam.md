# 0004 — All persistence behind a `StorageRepository` interface

- **Status:** Accepted
- **Date:** 2026-05-24
- **Context:** SRS C3/PCN-3, C6/PCN-6, DR-2

## Context

R1/R2 store data locally (SQLite); R3 adds a cloud backend with sync. If the UI talks to a DB
directly, the cloud move becomes a rewrite. We need the backend to swap without touching the UI.

## Decision

Define a single **`StorageRepository`** interface in `packages/core` through which _all_ reads and
writes flow. R1 implements it once as `SqliteStorageRepository` (Electron main process). Every
user-owned row carries a `user_id` from day one (a single local profile in R1).

## Consequences

- **+** R3 introduces `SyncingStorageRepository` (local cache + API client + outbox) behind the
  same interface — the UI is unaware which implementation is active.
- **+** `user_id` everywhere means the R3 multi-user move is additive, not a schema migration.
- **+** The interface is platform-free, so mobile (R2) provides its own SQLite-plugin implementation.
- **−** A small amount of indirection/boilerplate for R1, which only ever has one implementation.
- **−** The interface must stay storage-agnostic (no SQL leaking through its method shapes).
