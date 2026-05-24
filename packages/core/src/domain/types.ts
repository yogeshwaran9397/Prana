/**
 * Core domain types for PranaCoach.
 * Platform-free (no DOM / Electron / Node imports) so R1 desktop, R2 mobile, and R3 cloud
 * all reuse them untouched. See docs/poc-1/docs/SRS.md PFR-1, PFR-7, PCN-2.
 */

export type PhaseKind = "inhale" | "hold_in" | "exhale" | "hold_out" | "rest";

/** A single timed breath segment. `seconds` may be 0 (the phase is skipped). PFR-1. */
export interface Phase {
  kind: PhaseKind;
  seconds: number;
}

/** Optional ratio mode, e.g. unit=2, pattern=[1,4,2] → 2s inhale, 8s hold, 4s exhale. PFR-7. */
export interface Ratio {
  unit: number;
  /** One multiplier per phase, in the same order as `phases`. */
  pattern: number[];
}

/** A named pattern of phases repeated over `rounds`. */
export interface Technique {
  id: string;
  name: string;
  rounds: number;
  /** One round's phase sequence. */
  phases: Phase[];
  ratio?: Ratio;
}

/** A full session plan = warmup + ordered techniques + closing rest. */
export interface Routine {
  id: string;
  name: string;
  warmupSeconds: number;
  techniques: Technique[];
  closingRestSeconds: number;
  /** Live tempo scaler applied to every duration. Clamped to [0.75, 1.25]. PFR-9. */
  paceMultiplier: number;
}

/** Beginner safety ceiling for any hold phase. Default 8s. PFR-5, PCN-5. */
export interface SafetyCaps {
  maxHoldSeconds: number;
  /** If true, holds exceeding the cap are allowed (explicit user override). */
  allowOverride: boolean;
}

/** Optional auto-ramp of hold durations across completed sessions. PFR-6. */
export interface Progression {
  enabled: boolean;
  deltaSeconds: number;
  everyNSessions: number;
  targetHoldSeconds: number;
}

export const DEFAULT_MAX_HOLD_SECONDS = 8;
export const PACE_MIN = 0.75;
export const PACE_MAX = 1.25;

export const defaultSafetyCaps = (): SafetyCaps => ({
  maxHoldSeconds: DEFAULT_MAX_HOLD_SECONDS,
  allowOverride: false,
});

export const HOLD_PHASES: ReadonlySet<PhaseKind> = new Set<PhaseKind>(["hold_in", "hold_out"]);

export const isHoldPhase = (kind: PhaseKind): boolean => HOLD_PHASES.has(kind);
