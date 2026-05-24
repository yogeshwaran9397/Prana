/**
 * Goals & streak math — pure functions over session history. PFR-30, PFR-31.
 * All date logic uses local calendar days (a "practice day" = any day with ≥1 completed session).
 */

export interface SessionRecord {
  id: string;
  startedAt: number; // epoch ms
  durationS: number;
  longestHoldS: number;
  completed: boolean;
}

/** Local YYYY-MM-DD key for an epoch timestamp. */
export function dayKey(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayKeyToOrdinal(key: string): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Set of distinct practice-day keys from completed sessions. */
export function practiceDays(history: SessionRecord[]): Set<string> {
  const days = new Set<string>();
  for (const s of history) if (s.completed) days.add(dayKey(s.startedAt));
  return days;
}

export interface StreakResult {
  current: number;
  longest: number;
}

/**
 * Current streak = consecutive days ending today (or yesterday, grace for "not yet today").
 * Longest streak = longest run of consecutive practice days ever. PFR-30.
 */
export function computeStreak(history: SessionRecord[], nowMs: number = Date.now()): StreakResult {
  const ordinals = [...practiceDays(history)].map(dayKeyToOrdinal).sort((a, b) => a - b);
  if (ordinals.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < ordinals.length; i++) {
    if (ordinals[i]! === ordinals[i - 1]! + 1) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const today = dayKeyToOrdinal(dayKey(nowMs));
  const last = ordinals[ordinals.length - 1]!;
  let current = 0;
  if (last === today || last === today - 1) {
    current = 1;
    for (let i = ordinals.length - 1; i > 0; i--) {
      if (ordinals[i]! === ordinals[i - 1]! + 1) current++;
      else break;
    }
  }
  return { current, longest };
}

export type GoalPeriod = "weekly" | "monthly";

export interface Goal {
  period: GoalPeriod;
  /** Target number of completed sessions in the period. */
  target: number;
  active: boolean;
}

export interface GoalProgress {
  period: GoalPeriod;
  target: number;
  completed: number;
  done: boolean;
}

function startOfWeek(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sunday
  const diff = (dow + 6) % 7; // make Monday the start
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

function startOfMonth(nowMs: number): number {
  const d = new Date(nowMs);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Count completed sessions inside the current week/month and report progress. PFR-31. */
export function goalProgress(
  goal: Goal,
  history: SessionRecord[],
  nowMs: number = Date.now(),
): GoalProgress {
  const from = goal.period === "weekly" ? startOfWeek(nowMs) : startOfMonth(nowMs);
  const completed = history.filter((s) => s.completed && s.startedAt >= from && s.startedAt <= nowMs).length;
  return {
    period: goal.period,
    target: goal.target,
    completed,
    done: completed >= goal.target,
  };
}

/** Total minutes practiced (completed sessions). */
export const totalMinutes = (history: SessionRecord[]): number =>
  Math.round(history.filter((s) => s.completed).reduce((sum, s) => sum + s.durationS, 0) / 60);
