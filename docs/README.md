# PranaCoach — Documentation

Navigation index for all project documentation. Docs are split into **cross-release product
specs** (apply to R1→R2→R3), **release-specific specs** (currently POC 1 / R1), **architecture
decision records**, and the original **planning transcript**.

## Reading order (newcomer → builder)

1. [PRD.md](./PRD.md) — *why*: problem, personas, release strategy, product requirements.
2. [SRS.md](./SRS.md) — *what (all releases)*: formal, testable requirements (`FR/NFR/DR/IR`).
3. [ARCHITECTURE.md](./ARCHITECTURE.md) — *how*: system design, modules, cross-platform & cloud strategy.
4. [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — *when*: phased build order across R1→R2→R3.
5. [poc-1/SRS.md](./poc-1/SRS.md) — the R1-only requirement set (`PFR/PNFR/...`), traced back to the all-release SRS.
6. [poc-1/IMPLEMENTATION.md](./poc-1/IMPLEMENTATION.md) — the R1 build guide (tasks, file layout, acceptance gates).
7. [adr/](./adr/) — architecture decision records (the *why* behind key technical choices).

## Document map

| Path | Scope | Purpose |
|---|---|---|
| [PRD.md](./PRD.md) | All releases | Product requirements & 3-release strategy (R1 desktop → R2 mobile → R3 cloud) |
| [SRS.md](./SRS.md) | All releases | Formal requirements, each tagged `[R1]/[R2]/[R3]` |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | All releases | Technical design: shared TS core, Electron/Capacitor, cloud topology |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | All releases | Phases 0–9 build order |
| [poc-1/SRS.md](./poc-1/SRS.md) | **R1 only** | Detailed, build-contract requirements for POC 1 |
| [poc-1/IMPLEMENTATION.md](./poc-1/IMPLEMENTATION.md) | **R1 only** | POC 1 engineering plan, traced to `poc-1/SRS.md` |
| [adr/](./adr/) | All releases | One file per significant, hard-to-reverse decision |
| [convo/CONVERSATION_LOG.md](./convo/CONVERSATION_LOG.md) | History | Full planning conversation that produced these docs |

## Requirement ID schemes
- **All-release SRS:** `FR-*` functional · `NFR-*` non-functional · `DR-*` data · `IR-*` interface,
  each tagged `[R1]/[R2]/[R3]`.
- **POC 1 SRS:** `PFR-*`, `PNFR-*`, `PDR-*`, `PIR-*`, `PCN-*` (constraints) — every entry has a
  **Traces to** column mapping back to the all-release IDs.
- Source code references these IDs in comments (e.g. `// PFR-5`) for forward traceability.

## Where the code lives
See the repo root [README.md](../README.md) for the monorepo layout, setup, and run commands.
`packages/core` and `apps/desktop` each have their own README.
