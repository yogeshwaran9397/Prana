/**
 * TimerEngine — framework-agnostic finite state machine driving a compiled timeline.
 *
 * Design for ±100ms accuracy (NFR-1 / PNFR-1): the engine never accumulates `setInterval` drift.
 * The host pumps `update(nowMs)` (e.g. from requestAnimationFrame) with a MONOTONIC clock value
 * (performance.now()); the engine derives the current phase from absolute elapsed time, so a slow
 * or skipped frame self-corrects on the next pump.
 *
 * Controls: start / pause / resume / skip / stop — exactly what the voice worker calls. PFR-11.
 * Emits: phaseStart, tick, phaseEnd, roundEnd, techniqueEnd, sessionEnd. PFR-14.
 */
import { isHoldPhase } from "../domain/types.js";
import type { PhaseInstance } from "./timeline.js";

export interface SessionSummary {
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  durationS: number; // active (non-paused) seconds practiced
  longestHoldS: number;
  /** Total seconds spent per phase kind. */
  perPhaseTotals: Record<string, number>;
  completed: boolean;
}

export type EngineEvent =
  | { type: "phaseStart"; index: number; phase: PhaseInstance }
  | { type: "tick"; index: number; phase: PhaseInstance; remainingMs: number; elapsedInPhaseMs: number }
  | { type: "phaseEnd"; index: number; phase: PhaseInstance }
  | { type: "roundEnd"; techniqueId: string; round: number }
  | { type: "techniqueEnd"; techniqueId: string }
  | { type: "sessionEnd"; summary: SessionSummary };

export type EngineState = "idle" | "running" | "paused" | "ended";

type Listener = (e: EngineEvent) => void;

export interface TimerEngineOptions {
  /** Returns epoch milliseconds; injectable for tests. Defaults to Date.now. */
  epochNow?: () => number;
}

export class TimerEngine {
  private readonly timeline: PhaseInstance[];
  private readonly listeners = new Set<Listener>();
  private readonly epochNow: () => number;

  private state: EngineState = "idle";
  private index = -1;
  /** Monotonic ms timestamp when the current phase started (adjusted for pauses). */
  private phaseStartMono = 0;
  private pausedAtMono = 0;
  private lastTickMono = 0;

  private startedAtEpoch = 0;
  private longestHoldS = 0;
  private readonly perPhaseTotals: Record<string, number> = {};
  /** Active (non-paused) milliseconds accumulated across completed phases. */
  private activeMsAccrued = 0;

  constructor(timeline: PhaseInstance[], options: TimerEngineOptions = {}) {
    this.timeline = timeline;
    this.epochNow = options.epochNow ?? (() => Date.now());
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: EngineEvent): void {
    for (const l of this.listeners) l(e);
  }

  getState(): EngineState {
    return this.state;
  }

  getIndex(): number {
    return this.index;
  }

  currentPhase(): PhaseInstance | undefined {
    return this.timeline[this.index];
  }

  /** Begin the timeline. `nowMs` is a monotonic clock value. */
  start(nowMs: number): void {
    if (this.state !== "idle") return;
    if (this.timeline.length === 0) {
      this.state = "ended";
      this.startedAtEpoch = this.epochNow();
      this.emit({ type: "sessionEnd", summary: this.buildSummary(true) });
      return;
    }
    this.state = "running";
    this.startedAtEpoch = this.epochNow();
    this.index = 0;
    this.phaseStartMono = nowMs;
    this.lastTickMono = nowMs;
    this.emit({ type: "phaseStart", index: 0, phase: this.timeline[0]! });
  }

  pause(nowMs: number): void {
    if (this.state !== "running") return;
    this.state = "paused";
    this.pausedAtMono = nowMs;
  }

  resume(nowMs: number): void {
    if (this.state !== "paused") return;
    // Shift the phase start forward by the paused duration so elapsed math stays correct.
    const pausedFor = nowMs - this.pausedAtMono;
    this.phaseStartMono += pausedFor;
    this.lastTickMono = nowMs;
    this.state = "running";
  }

  /** Skip the rest of the current phase. PFR-11. The next phase starts now (user-initiated). */
  skip(nowMs: number): void {
    if (this.state !== "running" && this.state !== "paused") return;
    if (this.state === "paused") this.resume(nowMs);
    this.completeCurrentPhase(nowMs, /*fullDuration*/ false);
    this.advance(nowMs);
  }

  /** Stop the whole session early (marked incomplete). PFR-11, PNFR-7. */
  stop(nowMs: number): void {
    if (this.state === "ended" || this.state === "idle") return;
    if (this.state === "running") {
      this.accrueActive(nowMs);
    }
    this.state = "ended";
    this.emit({ type: "sessionEnd", summary: this.buildSummary(false) });
  }

  /**
   * Host pump. Call frequently (e.g. each animation frame) with a monotonic clock.
   * Drives ticks and phase transitions off absolute elapsed time (no drift accumulation).
   */
  update(nowMs: number): void {
    if (this.state !== "running") return;
    const phase = this.timeline[this.index];
    if (!phase) return;

    const elapsedInPhaseMs = nowMs - this.phaseStartMono;
    const phaseMs = phase.seconds * 1000;
    const remainingMs = Math.max(0, phaseMs - elapsedInPhaseMs);

    this.emit({ type: "tick", index: this.index, phase, remainingMs, elapsedInPhaseMs });
    this.lastTickMono = nowMs;

    if (elapsedInPhaseMs >= phaseMs) {
      this.completeCurrentPhase(nowMs, /*fullDuration*/ true);
      // Anchor the next phase to the SCHEDULED boundary (phaseStart + phaseMs), not nowMs, so a
      // late pump's overshoot is not carried forward — this is what keeps a 15-min session
      // within ±100ms instead of accumulating drift. NFR-1 / PNFR-1.
      this.advance(this.phaseStartMono + phaseMs);
    }
  }

  private accrueActive(nowMs: number): void {
    const phase = this.timeline[this.index];
    if (!phase) return;
    const elapsedInPhaseMs = Math.min(nowMs - this.phaseStartMono, phase.seconds * 1000);
    this.activeMsAccrued += Math.max(0, elapsedInPhaseMs);
  }

  private completeCurrentPhase(nowMs: number, fullDuration: boolean): void {
    const phase = this.timeline[this.index];
    if (!phase) return;
    const elapsedInPhaseMs = fullDuration
      ? phase.seconds * 1000
      : Math.min(nowMs - this.phaseStartMono, phase.seconds * 1000);
    const elapsedS = Math.max(0, elapsedInPhaseMs / 1000);

    this.activeMsAccrued += elapsedInPhaseMs;
    this.perPhaseTotals[phase.kind] = (this.perPhaseTotals[phase.kind] ?? 0) + elapsedS;
    if (isHoldPhase(phase.kind)) {
      this.longestHoldS = Math.max(this.longestHoldS, elapsedS);
    }

    this.emit({ type: "phaseEnd", index: this.index, phase });

    const next = this.timeline[this.index + 1];
    const isLastOfRound = !next || next.techniqueId !== phase.techniqueId || next.round !== phase.round;
    if (isLastOfRound && phase.techniqueId !== "warmup" && phase.techniqueId !== "closing") {
      this.emit({ type: "roundEnd", techniqueId: phase.techniqueId, round: phase.round });
    }
    const isLastOfTechnique = !next || next.techniqueId !== phase.techniqueId;
    if (isLastOfTechnique && phase.techniqueId !== "warmup" && phase.techniqueId !== "closing") {
      this.emit({ type: "techniqueEnd", techniqueId: phase.techniqueId });
    }
  }

  private advance(nowMs: number): void {
    const nextIndex = this.index + 1;
    if (nextIndex >= this.timeline.length) {
      this.state = "ended";
      this.emit({ type: "sessionEnd", summary: this.buildSummary(true) });
      return;
    }
    this.index = nextIndex;
    this.phaseStartMono = nowMs;
    this.emit({ type: "phaseStart", index: nextIndex, phase: this.timeline[nextIndex]! });
  }

  private buildSummary(completed: boolean): SessionSummary {
    return {
      startedAt: this.startedAtEpoch,
      endedAt: this.epochNow(),
      durationS: Math.round(this.activeMsAccrued / 1000),
      longestHoldS: Math.round(this.longestHoldS * 10) / 10,
      perPhaseTotals: { ...this.perPhaseTotals },
      completed,
    };
  }
}
