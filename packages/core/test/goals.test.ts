import { describe, expect, it } from "vitest";
import {
  computeStreak,
  evaluateBadges,
  goalProgress,
  totalMinutes,
  type Goal,
  type SessionRecord,
} from "../src/index.js";

const DAY = 86_400_000;

function session(id: string, startedAt: number, extra: Partial<SessionRecord> = {}): SessionRecord {
  return { id, startedAt, durationS: 600, longestHoldS: 5, completed: true, ...extra };
}

// Use a fixed local noon "now" to avoid TZ edge flakiness.
const now = new Date(2026, 4, 24, 12, 0, 0).getTime();

describe("computeStreak (PFR-30)", () => {
  it("returns zero for no history", () => {
    expect(computeStreak([], now)).toEqual({ current: 0, longest: 0 });
  });

  it("counts consecutive days ending today", () => {
    const h = [session("a", now - 2 * DAY), session("b", now - DAY), session("c", now)];
    expect(computeStreak(h, now).current).toBe(3);
  });

  it("allows a one-day grace (practiced yesterday, not yet today)", () => {
    const h = [session("a", now - 2 * DAY), session("b", now - DAY)];
    expect(computeStreak(h, now).current).toBe(2);
  });

  it("breaks the current streak after a missed day", () => {
    const h = [session("a", now - 3 * DAY), session("b", now)];
    expect(computeStreak(h, now).current).toBe(1);
  });

  it("tracks the longest streak independent of current", () => {
    const h = [
      session("a", now - 10 * DAY),
      session("b", now - 9 * DAY),
      session("c", now - 8 * DAY),
      session("d", now - 7 * DAY),
      session("e", now),
    ];
    const r = computeStreak(h, now);
    expect(r.longest).toBe(4);
    expect(r.current).toBe(1);
  });

  it("ignores incomplete sessions", () => {
    const h = [session("a", now, { completed: false })];
    expect(computeStreak(h, now).current).toBe(0);
  });

  it("dedupes multiple sessions on one day", () => {
    const h = [session("a", now), session("b", now + 3600_000)];
    expect(computeStreak(h, now).current).toBe(1);
  });
});

describe("goalProgress (PFR-31)", () => {
  const weekly: Goal = { period: "weekly", target: 3, active: true };

  it("counts completed sessions in the current week", () => {
    const h = [session("a", now), session("b", now - DAY)];
    const p = goalProgress(weekly, h, now);
    expect(p.completed).toBeGreaterThanOrEqual(1);
    expect(p.done).toBe(false);
  });

  it("marks done when target met", () => {
    const h = [session("a", now), session("b", now - 60_000), session("c", now - 120_000)];
    expect(goalProgress(weekly, h, now).done).toBe(true);
  });

  it("computes total minutes from completed sessions", () => {
    const h = [session("a", now, { durationS: 600 }), session("b", now, { durationS: 600, completed: false })];
    expect(totalMinutes(h)).toBe(10);
  });
});

describe("evaluateBadges (PFR-32)", () => {
  it("awards First Breath after one completed session", () => {
    expect(evaluateBadges([session("a", now)], new Set(), now)).toContain("first_session");
  });

  it("does not re-award an already-earned badge", () => {
    expect(evaluateBadges([session("a", now)], new Set(["first_session"]), now)).not.toContain("first_session");
  });

  it("awards Held 15s when a session holds ≥15s", () => {
    const h = [session("a", now, { longestHoldS: 16 })];
    expect(evaluateBadges(h, new Set(), now)).toContain("held_15s");
  });

  it("awards 10 Hours Total at 600 minutes", () => {
    const h = Array.from({ length: 60 }, (_, i) => session(`s${i}`, now - i * DAY, { durationS: 600 }));
    expect(evaluateBadges(h, new Set(), now)).toContain("ten_hours");
  });

  it("awards 7-Day Streak", () => {
    const h = Array.from({ length: 7 }, (_, i) => session(`s${i}`, now - i * DAY));
    expect(evaluateBadges(h, new Set(), now)).toContain("streak_7");
  });
});
