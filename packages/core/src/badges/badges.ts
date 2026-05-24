/**
 * Badge rules engine + seed definitions. PFR-32.
 * `evaluateBadges` is pure: given history + already-earned codes, it returns the codes newly
 * earned. The host persists them and fires notifications.
 */
import { computeStreak, totalMinutes, type SessionRecord } from "../goals/goals.js";

export interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  /** Pure predicate over the full completed-session history. */
  earned: (history: SessionRecord[], nowMs: number) => boolean;
}

const completed = (history: SessionRecord[]): SessionRecord[] => history.filter((s) => s.completed);

export const SEED_BADGES: BadgeDefinition[] = [
  {
    code: "first_session",
    name: "First Breath",
    description: "Complete your first session.",
    earned: (h) => completed(h).length >= 1,
  },
  {
    code: "streak_7",
    name: "7-Day Streak",
    description: "Practice 7 days in a row.",
    earned: (h, now) => computeStreak(h, now).longest >= 7,
  },
  {
    code: "streak_30",
    name: "30-Day Streak",
    description: "Practice 30 days in a row.",
    earned: (h, now) => computeStreak(h, now).longest >= 30,
  },
  {
    code: "held_15s",
    name: "Held 15s",
    description: "Hold your breath for 15 seconds in a session.",
    earned: (h) => completed(h).some((s) => s.longestHoldS >= 15),
  },
  {
    code: "ten_hours",
    name: "10 Hours Total",
    description: "Accumulate 10 hours of practice.",
    earned: (h) => totalMinutes(h) >= 600,
  },
];

/** Returns badge codes newly earned (in `SEED_BADGES` but not in `alreadyEarned`). PFR-32. */
export function evaluateBadges(
  history: SessionRecord[],
  alreadyEarned: ReadonlySet<string>,
  nowMs: number = Date.now(),
  definitions: BadgeDefinition[] = SEED_BADGES,
): string[] {
  const newly: string[] = [];
  for (const def of definitions) {
    if (alreadyEarned.has(def.code)) continue;
    if (def.earned(history, nowMs)) newly.push(def.code);
  }
  return newly;
}
