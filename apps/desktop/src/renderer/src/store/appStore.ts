import { create } from "zustand";
import {
  defaultSettings,
  evaluateBadges,
  SEED_BADGES,
  type AppSettings,
  type Goal,
  type Profile,
  type SessionRecord,
  type StoredRoutine,
  type StoredSession,
} from "@prana/core";

interface AppState {
  loaded: boolean;
  profile: Profile | null;
  settings: AppSettings;
  routines: StoredRoutine[];
  sessions: StoredSession[];
  goals: Goal[];
  earnedBadges: { code: string; earnedAt: number }[];

  load: () => Promise<void>;
  acceptDisclaimer: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  refreshRoutines: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  setGoal: (goal: Goal) => Promise<void>;
  /** Persist a finished session, then re-evaluate badges and notify. Returns newly-earned codes. */
  recordSession: (
    session: Parameters<Window["prana"]["saveSession"]>[0],
    presence: Parameters<Window["prana"]["saveSession"]>[1],
  ) => Promise<string[]>;
}

const toRecords = (sessions: StoredSession[]): SessionRecord[] =>
  sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt,
    durationS: s.durationS,
    longestHoldS: s.longestHoldS,
    completed: s.completed,
  }));

export const useAppStore = create<AppState>((set, get) => ({
  loaded: false,
  profile: null,
  settings: defaultSettings(),
  routines: [],
  sessions: [],
  goals: [],
  earnedBadges: [],

  async load() {
    const [profile, settings, routines, sessions, goals, earnedBadges] = await Promise.all([
      window.prana.getProfile(),
      window.prana.getSettings(),
      window.prana.listRoutines(),
      window.prana.listSessions(),
      window.prana.getGoals(),
      window.prana.getEarnedBadges(),
    ]);
    set({ loaded: true, profile, settings, routines, sessions, goals, earnedBadges });
  },

  async acceptDisclaimer() {
    await window.prana.acceptDisclaimer();
    set({ profile: await window.prana.getProfile() });
  },

  async saveSettings(settings) {
    await window.prana.setSettings(settings);
    set({ settings });
  },

  async refreshRoutines() {
    set({ routines: await window.prana.listRoutines() });
  },

  async refreshSessions() {
    set({ sessions: await window.prana.listSessions() });
  },

  async setGoal(goal) {
    await window.prana.setGoal(goal);
    set({ goals: await window.prana.getGoals() });
  },

  async recordSession(session, presence) {
    await window.prana.saveSession(session, presence);
    const sessions = await window.prana.listSessions();
    const earnedBefore = new Set(get().earnedBadges.map((b) => b.code));
    const newly = evaluateBadges(toRecords(sessions), earnedBefore, Date.now());
    if (newly.length > 0) {
      await window.prana.awardBadges(newly);
      for (const code of newly) {
        const def = SEED_BADGES.find((b) => b.code === code);
        if (def) void window.prana.notify("Badge unlocked! 🏅", `${def.name} — ${def.description}`);
      }
    }
    set({ sessions, earnedBadges: await window.prana.getEarnedBadges() });
    return newly;
  },
}));
