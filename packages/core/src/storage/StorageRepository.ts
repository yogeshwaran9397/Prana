/**
 * StorageRepository — the single seam through which all persistence flows. PCN-3 / C3.
 * R1 ships exactly one implementation (SQLite, in the Electron main process). R3 swaps in an
 * API-backed implementation behind this same interface with no UI changes.
 *
 * This interface is platform-free; it carries only plain data (DTOs), no DB/Electron handles.
 */
import type { Progression, Routine, SafetyCaps } from "../domain/types.js";
import type { Goal, SessionRecord } from "../goals/goals.js";

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
  /** True once the medical disclaimer has been acknowledged. PNFR-6. */
  disclaimerAcceptedAt: number | null;
}

export interface PresenceCheck {
  ts: number;
  present: boolean;
  confidence: number;
}

export interface StoredSession extends SessionRecord {
  userId: string;
  routineId: string;
  routineName: string;
  endedAt: number;
  presencePct: number | null;
  perPhaseTotals: Record<string, number>;
}

export interface StoredRoutine extends Routine {
  userId: string;
  updatedAt: number;
}

export interface AppSettings {
  caps: SafetyCaps;
  progression: Progression;
  audioEnabled: boolean;
  audioVolume: number; // 0..1
  cameraEnabled: boolean;
  micEnabled: boolean;
  presenceMinSeconds: number;
  presenceMaxSeconds: number;
  autoPauseAfterAbsent: number; // K consecutive absent checks; 0 = off
  highContrast: boolean;
}

export interface ExportBundle {
  version: 1;
  exportedAt: number;
  profile: Profile;
  routines: StoredRoutine[];
  sessions: StoredSession[];
  presenceChecks: Record<string, PresenceCheck[]>; // sessionId -> checks
  goals: Goal[];
  earnedBadges: { code: string; earnedAt: number }[];
  settings: AppSettings;
}

export interface StorageRepository {
  // Profile
  getProfile(): Promise<Profile>;
  acceptDisclaimer(): Promise<void>;

  // Routines
  listRoutines(): Promise<StoredRoutine[]>;
  saveRoutine(routine: Routine): Promise<StoredRoutine>;
  deleteRoutine(id: string): Promise<void>;

  // Sessions
  saveSession(session: Omit<StoredSession, "userId">, presence: PresenceCheck[]): Promise<StoredSession>;
  listSessions(): Promise<StoredSession[]>;
  getPresenceChecks(sessionId: string): Promise<PresenceCheck[]>;

  // Goals
  getGoals(): Promise<Goal[]>;
  setGoal(goal: Goal): Promise<void>;

  // Badges
  getEarnedBadges(): Promise<{ code: string; earnedAt: number }[]>;
  awardBadges(codes: string[]): Promise<void>;

  // Settings
  getSettings(): Promise<AppSettings>;
  setSettings(settings: AppSettings): Promise<void>;

  // Export / import (PFR-35, PDR-6)
  exportAll(): Promise<ExportBundle>;
  importAll(bundle: ExportBundle): Promise<void>;
}

export const defaultSettings = (): AppSettings => ({
  caps: { maxHoldSeconds: 8, allowOverride: false },
  progression: { enabled: false, deltaSeconds: 1, everyNSessions: 3, targetHoldSeconds: 20 },
  audioEnabled: true,
  audioVolume: 0.8,
  cameraEnabled: false,
  micEnabled: false,
  presenceMinSeconds: 30,
  presenceMaxSeconds: 90,
  autoPauseAfterAbsent: 0,
  highContrast: false,
});
