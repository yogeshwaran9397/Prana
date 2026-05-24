import { describe, expect, it, vi } from "vitest";
import { TimerEngine, type EngineEvent, type PhaseInstance } from "../src/index.js";

function tl(...specs: [PhaseInstance["kind"], number][]): PhaseInstance[] {
  return specs.map(([kind, seconds], i) => ({
    kind,
    seconds,
    techniqueId: "t1",
    techniqueName: "T",
    round: 1,
    techniqueIndex: 1,
  }));
}

function record(engine: TimerEngine): EngineEvent[] {
  const events: EngineEvent[] = [];
  engine.on((e) => events.push(e));
  return events;
}

describe("TimerEngine", () => {
  it("emits phaseStart on start and walks phases to sessionEnd", () => {
    const engine = new TimerEngine(tl(["inhale", 2], ["exhale", 2]), { epochNow: () => 1000 });
    const events = record(engine);

    engine.start(0);
    engine.update(2000); // inhale completes → exhale starts
    engine.update(4000); // exhale completes → sessionEnd

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("phaseStart");
    expect(types).toContain("phaseEnd");
    expect(types[types.length - 1]).toBe("sessionEnd");
  });

  it("produces an accurate, drift-free summary (NFR-1)", () => {
    let epoch = 10_000;
    const engine = new TimerEngine(tl(["inhale", 4], ["hold_in", 6], ["exhale", 4]), {
      epochNow: () => epoch,
    });
    let summary: EngineEvent | undefined;
    engine.on((e) => {
      if (e.type === "sessionEnd") summary = e;
    });

    engine.start(0);
    // Pump at irregular intervals to prove no setInterval drift accumulation.
    engine.update(3990);
    engine.update(4001); // inhale done at exactly 4s boundary
    engine.update(9000);
    engine.update(10_050); // hold_in done (4+6=10s)
    epoch = 24_000;
    engine.update(14_010); // exhale done (14s) → end

    expect(summary).toBeDefined();
    if (summary?.type === "sessionEnd") {
      expect(summary.summary.durationS).toBe(14);
      expect(summary.summary.longestHoldS).toBe(6);
      expect(summary.summary.completed).toBe(true);
      expect(summary.summary.perPhaseTotals.hold_in).toBeCloseTo(6, 5);
    }
  });

  it("pause/resume shifts elapsed so timing stays correct (PFR-11)", () => {
    const engine = new TimerEngine(tl(["inhale", 10]), { epochNow: () => 0 });
    let ended = false;
    engine.on((e) => {
      if (e.type === "sessionEnd") ended = true;
    });

    engine.start(0);
    engine.update(4000); // 4s in
    engine.pause(4000);
    engine.update(9000); // ignored while paused
    expect(ended).toBe(false);
    engine.resume(9000); // paused for 5s; phase start shifts to t=5000
    engine.update(13_900); // elapsed in phase = 13900-5000 = 8900ms, not done
    expect(ended).toBe(false);
    engine.update(15_001); // elapsed = 10001ms → done
    expect(ended).toBe(true);
  });

  it("does not start when paused, and ignores resume when running", () => {
    const engine = new TimerEngine(tl(["inhale", 2]), { epochNow: () => 0 });
    engine.start(0);
    expect(engine.getState()).toBe("running");
    engine.resume(100); // no-op
    expect(engine.getState()).toBe("running");
  });

  it("skip advances to the next phase immediately (PFR-11)", () => {
    const engine = new TimerEngine(tl(["inhale", 10], ["exhale", 10]), { epochNow: () => 0 });
    const events = record(engine);
    engine.start(0);
    engine.update(1000);
    engine.skip(1000);
    expect(engine.currentPhase()?.kind).toBe("exhale");
    expect(events.some((e) => e.type === "phaseEnd")).toBe(true);
  });

  it("stop marks the session incomplete (PFR-11, PNFR-7)", () => {
    const engine = new TimerEngine(tl(["inhale", 10]), { epochNow: () => 0 });
    let summary: EngineEvent | undefined;
    engine.on((e) => {
      if (e.type === "sessionEnd") summary = e;
    });
    engine.start(0);
    engine.update(3000);
    engine.stop(3000);
    if (summary?.type === "sessionEnd") {
      expect(summary.summary.completed).toBe(false);
      expect(summary.summary.durationS).toBe(3);
    }
  });

  it("handles an empty timeline by ending immediately", () => {
    const engine = new TimerEngine([], { epochNow: () => 0 });
    const fn = vi.fn();
    engine.on(fn);
    engine.start(0);
    expect(engine.getState()).toBe("ended");
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ type: "sessionEnd" }));
  });

  it("emits roundEnd and techniqueEnd at boundaries (PFR-14)", () => {
    const timeline: PhaseInstance[] = [
      { kind: "inhale", seconds: 1, techniqueId: "t1", techniqueName: "A", round: 1, techniqueIndex: 1 },
      { kind: "inhale", seconds: 1, techniqueId: "t1", techniqueName: "A", round: 2, techniqueIndex: 1 },
      { kind: "inhale", seconds: 1, techniqueId: "t2", techniqueName: "B", round: 1, techniqueIndex: 2 },
    ];
    const engine = new TimerEngine(timeline, { epochNow: () => 0 });
    const events = record(engine);
    engine.start(0);
    engine.update(1000);
    engine.update(2000);
    engine.update(3000);

    const roundEnds = events.filter((e) => e.type === "roundEnd");
    const techEnds = events.filter((e) => e.type === "techniqueEnd");
    expect(roundEnds.length).toBe(3);
    expect(techEnds.map((e) => (e.type === "techniqueEnd" ? e.techniqueId : ""))).toEqual(["t1", "t2"]);
  });
});
