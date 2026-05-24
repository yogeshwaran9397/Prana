# 0005 — Monotonic, schedule-anchored timer engine for ±100ms accuracy

- **Status:** Accepted
- **Date:** 2026-05-24
- **Context:** SRS PFR-12/PFR-13, NFR-1/PNFR-1

## Context
The customizable breath timer is the product's reason to exist; it must stay accurate to within
**±100ms over a 15-minute session** (NFR-1) and be deterministic enough to unit-test.

## Decision
Implement the `TimerEngine` as a framework-agnostic finite state machine driven by an **injectable
monotonic clock** (`performance.now()` in the app, a fake clock in tests). The host pumps
`update(nowMs)` each animation frame; the engine derives the current phase from **absolute elapsed
time**, never by accumulating `setInterval` deltas. When a phase completes, the next phase is
anchored to the **scheduled boundary** (`phaseStart + phaseMs`), not to the (possibly late) pump
time, so per-phase overshoot does not accumulate. Timeline compilation is a **pure function**.

## Consequences
- **+** Drift cannot accumulate across phases — a late frame self-corrects on the next pump.
- **+** Fully deterministic and unit-testable with a fake clock (no real timers in tests).
- **+** `start/pause/resume/skip/stop` are plain methods — exactly what voice/buttons call.
- **−** The host is responsible for pumping `update()`; if it stops pumping, the engine pauses
  implicitly (mitigated by driving from `requestAnimationFrame`).
- **Note:** this decision was validated by a test that initially failed and exposed naive
  `advance()` drift; the fix (schedule anchoring) is the rule recorded here.
