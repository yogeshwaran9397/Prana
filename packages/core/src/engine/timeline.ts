/**
 * Timeline compiler: turns a Routine (+ caps + progression + completed-session count) into a
 * flat, ordered list of phase instances. PURE and deterministic — same inputs always produce the
 * same timeline, which is what the unit tests assert. PFR-12.
 */
import {
  HOLD_PHASES,
  PACE_MAX,
  PACE_MIN,
  type Phase,
  type Progression,
  type Routine,
  type SafetyCaps,
  type Technique,
} from "../domain/types.js";

export interface PhaseInstance {
  kind: Phase["kind"];
  seconds: number;
  techniqueId: string;
  techniqueName: string;
  /** 1-based round number within the technique. */
  round: number;
  /** 1-based index of the technique within the routine (0 for warmup/closing). */
  techniqueIndex: number;
}

export interface CompileOptions {
  caps: SafetyCaps;
  progression?: Progression;
  /** Number of sessions the user has already completed (drives progression ramp). */
  completedSessions?: number;
}

const clampPace = (p: number): number => Math.min(PACE_MAX, Math.max(PACE_MIN, p));

/** Round to 0.5s granularity (PFR-2) and never below 0. */
const quantize = (seconds: number): number => Math.max(0, Math.round(seconds * 2) / 2);

/**
 * Extra hold seconds earned from progression at a given completed-session count. PFR-6.
 * Ramp = floor(completed / everyN) * delta, capped so (baseHold + ramp) never exceeds target.
 */
export function progressionBonus(
  baseHoldSeconds: number,
  progression: Progression | undefined,
  completedSessions: number,
): number {
  if (!progression?.enabled || progression.everyNSessions <= 0) return 0;
  const steps = Math.floor(completedSessions / progression.everyNSessions);
  const raw = steps * progression.deltaSeconds;
  const room = Math.max(0, progression.targetHoldSeconds - baseHoldSeconds);
  return Math.max(0, Math.min(raw, room));
}

/** Apply the safety cap to a hold phase. PFR-5. Returns the effective seconds. */
export function applyCap(kind: Phase["kind"], seconds: number, caps: SafetyCaps): number {
  if (!HOLD_PHASES.has(kind)) return seconds;
  if (caps.allowOverride) return seconds;
  return Math.min(seconds, caps.maxHoldSeconds);
}

/** Derive a technique's per-phase seconds from ratio mode if present. PFR-7. */
function resolvePhaseSeconds(technique: Technique): Phase[] {
  if (!technique.ratio) return technique.phases;
  const { unit, pattern } = technique.ratio;
  return technique.phases.map((phase, i) => ({
    kind: phase.kind,
    seconds: (pattern[i] ?? 0) * unit,
  }));
}

/** Returns true if any hold phase in the routine would be clipped by the cap (for UI warning). PFR-5. */
export function routineExceedsCap(routine: Routine, caps: SafetyCaps): boolean {
  return routine.techniques.some((t) =>
    resolvePhaseSeconds(t).some((p) => HOLD_PHASES.has(p.kind) && p.seconds > caps.maxHoldSeconds),
  );
}

/**
 * Compile a routine into a flat timeline of phase instances.
 * Order: warmup rest → for each technique, for each round, each phase → closing rest.
 * Zero-second phases are dropped (skipped). PFR-1, PFR-11.
 */
export function compileTimeline(routine: Routine, opts: CompileOptions): PhaseInstance[] {
  const pace = clampPace(routine.paceMultiplier);
  const completed = opts.completedSessions ?? 0;
  const out: PhaseInstance[] = [];

  const push = (
    kind: Phase["kind"],
    rawSeconds: number,
    techniqueId: string,
    techniqueName: string,
    round: number,
    techniqueIndex: number,
  ): void => {
    let seconds = rawSeconds;
    // Progression only ramps hold phases.
    if (HOLD_PHASES.has(kind)) {
      seconds += progressionBonus(rawSeconds, opts.progression, completed);
    }
    seconds = applyCap(kind, seconds, opts.caps);
    seconds = quantize(seconds * pace);
    if (seconds <= 0) return; // skipped phase
    out.push({ kind, seconds, techniqueId, techniqueName, round, techniqueIndex });
  };

  if (routine.warmupSeconds > 0) {
    push("rest", routine.warmupSeconds, "warmup", "Warmup", 1, 0);
  }

  routine.techniques.forEach((technique, tIdx) => {
    const phases = resolvePhaseSeconds(technique);
    const rounds = Math.max(1, Math.floor(technique.rounds));
    for (let round = 1; round <= rounds; round++) {
      for (const phase of phases) {
        push(phase.kind, phase.seconds, technique.id, technique.name, round, tIdx + 1);
      }
    }
  });

  if (routine.closingRestSeconds > 0) {
    push("rest", routine.closingRestSeconds, "closing", "Closing Rest", 1, 0);
  }

  return out;
}

/** Total planned duration of a compiled timeline, in seconds. */
export const timelineDurationSeconds = (timeline: PhaseInstance[]): number =>
  timeline.reduce((sum, p) => sum + p.seconds, 0);
