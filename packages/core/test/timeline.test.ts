import { describe, expect, it } from "vitest";
import {
  applyCap,
  compileTimeline,
  progressionBonus,
  routineExceedsCap,
  timelineDurationSeconds,
  type Routine,
  type SafetyCaps,
} from "../src/index.js";

const caps = (maxHoldSeconds = 8, allowOverride = false): SafetyCaps => ({ maxHoldSeconds, allowOverride });

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    name: "Test",
    warmupSeconds: 0,
    closingRestSeconds: 0,
    paceMultiplier: 1,
    techniques: [
      {
        id: "t1",
        name: "Box",
        rounds: 2,
        phases: [
          { kind: "inhale", seconds: 4 },
          { kind: "hold_in", seconds: 4 },
          { kind: "exhale", seconds: 4 },
        ],
      },
    ],
    ...overrides,
  };
}

describe("compileTimeline", () => {
  it("is deterministic for the same inputs (PFR-12)", () => {
    const a = compileTimeline(routine(), { caps: caps() });
    const b = compileTimeline(routine(), { caps: caps() });
    expect(a).toEqual(b);
  });

  it("expands rounds × phases in order (PFR-1, PFR-4)", () => {
    const tl = compileTimeline(routine(), { caps: caps() });
    expect(tl.map((p) => p.kind)).toEqual([
      "inhale", "hold_in", "exhale",
      "inhale", "hold_in", "exhale",
    ]);
    expect(tl[3]!.round).toBe(2);
  });

  it("drops zero-second phases (skipped) (PFR-1)", () => {
    const r = routine();
    r.techniques[0]!.phases[1]!.seconds = 0; // hold_in skipped
    const tl = compileTimeline(r, { caps: caps() });
    expect(tl.map((p) => p.kind)).toEqual(["inhale", "exhale", "inhale", "exhale"]);
  });

  it("enforces the max-hold safety cap (PFR-5)", () => {
    const r = routine();
    r.techniques[0]!.phases[1]!.seconds = 20; // hold_in over the 8s cap
    const tl = compileTimeline(r, { caps: caps(8, false) });
    const holds = tl.filter((p) => p.kind === "hold_in");
    expect(holds.every((p) => p.seconds === 8)).toBe(true);
  });

  it("respects an explicit override of the cap (PFR-5)", () => {
    const r = routine();
    r.techniques[0]!.phases[1]!.seconds = 20;
    const tl = compileTimeline(r, { caps: caps(8, true) });
    expect(tl.find((p) => p.kind === "hold_in")!.seconds).toBe(20);
  });

  it("applies the pace multiplier and quantizes to 0.5s (PFR-9, PFR-2)", () => {
    const tl = compileTimeline(routine({ paceMultiplier: 1.25 }), { caps: caps() });
    // inhale 4 * 1.25 = 5
    expect(tl[0]!.seconds).toBe(5);
    // hold_in 4 * 1.25 = 5 (still under cap)
    expect(tl[1]!.seconds).toBe(5);
  });

  it("clamps pace to [0.75, 1.25] (PFR-9)", () => {
    const fast = compileTimeline(routine({ paceMultiplier: 5 }), { caps: caps() });
    const max = compileTimeline(routine({ paceMultiplier: 1.25 }), { caps: caps() });
    expect(fast).toEqual(max);
  });

  it("derives durations from ratio mode (PFR-7)", () => {
    const r = routine();
    r.techniques[0]!.ratio = { unit: 2, pattern: [1, 4, 2] };
    const tl = compileTimeline(r, { caps: caps(100) });
    expect(tl.slice(0, 3).map((p) => p.seconds)).toEqual([2, 8, 4]);
  });

  it("adds warmup and closing rest as rest phases (PFR-10)", () => {
    const tl = compileTimeline(routine({ warmupSeconds: 30, closingRestSeconds: 60 }), { caps: caps() });
    expect(tl[0]).toMatchObject({ kind: "rest", techniqueId: "warmup" });
    expect(tl[tl.length - 1]).toMatchObject({ kind: "rest", techniqueId: "closing" });
  });

  it("flags routines that exceed the cap for UI warning (PFR-5)", () => {
    const r = routine();
    r.techniques[0]!.phases[1]!.seconds = 20;
    expect(routineExceedsCap(r, caps(8, false))).toBe(true);
    expect(routineExceedsCap(routine(), caps(8, false))).toBe(false);
  });

  it("computes total duration", () => {
    expect(timelineDurationSeconds(compileTimeline(routine(), { caps: caps() }))).toBe(24);
  });
});

describe("progression (PFR-6)", () => {
  const prog = { enabled: true, deltaSeconds: 2, everyNSessions: 3, targetHoldSeconds: 12 };

  it("adds no bonus before the first interval", () => {
    expect(progressionBonus(6, prog, 2)).toBe(0);
  });

  it("ramps holds by delta every N sessions", () => {
    expect(progressionBonus(6, prog, 3)).toBe(2);
    expect(progressionBonus(6, prog, 6)).toBe(4);
  });

  it("never exceeds the target hold", () => {
    // base 6 + ramp capped so total ≤ 12
    expect(progressionBonus(6, prog, 30)).toBe(6);
  });

  it("is disabled when not enabled", () => {
    expect(progressionBonus(6, { ...prog, enabled: false }, 30)).toBe(0);
  });

  it("ramps holds in a compiled timeline but still respects the cap (PFR-5/PFR-6)", () => {
    const r = routine();
    r.techniques[0]!.phases[1]!.seconds = 6;
    const tl = compileTimeline(r, {
      caps: caps(8, false),
      progression: prog,
      completedSessions: 30,
    });
    // 6 + ramp would be 12, but cap clips to 8
    expect(tl.find((p) => p.kind === "hold_in")!.seconds).toBe(8);
  });
});

describe("applyCap", () => {
  it("only caps hold phases", () => {
    expect(applyCap("inhale", 20, caps(8, false))).toBe(20);
    expect(applyCap("hold_in", 20, caps(8, false))).toBe(8);
    expect(applyCap("hold_out", 20, caps(8, false))).toBe(8);
  });
});
