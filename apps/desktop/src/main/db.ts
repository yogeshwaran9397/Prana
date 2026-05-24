/**
 * SqliteStorageRepository — the R1 implementation of @prana/core's StorageRepository (PCN-3).
 * Runs in the Electron main process via better-sqlite3 (synchronous). Schema carries `user_id`
 * from day one (PCN-6/PDR-2); presence rows store only boolean+confidence+ts, never frames (PDR-3).
 */
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import {
  defaultSettings,
  type AppSettings,
  type ExportBundle,
  type Goal,
  type PresenceCheck,
  type Profile,
  type Routine,
  type StorageRepository,
  type StoredRoutine,
  type StoredSession,
} from "@prana/core";

const SCHEMA_VERSION = 1;
const LOCAL_USER_ID = "local";

export class SqliteStorageRepository implements StorageRepository {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
    this.seed();
  }

  // ---- migrations (PDR-5) ----
  private migrate(): void {
    const current = this.db.pragma("user_version", { simple: true }) as number;
    if (current < 1) {
      this.db.exec(`
        CREATE TABLE users(
          id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL,
          disclaimer_accepted_at INTEGER
        );
        CREATE TABLE routines(
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
          config_json TEXT NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE TABLE sessions(
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, routine_id TEXT, routine_name TEXT,
          started_at INTEGER NOT NULL, ended_at INTEGER NOT NULL,
          duration_s INTEGER NOT NULL, longest_hold_s REAL NOT NULL,
          presence_pct REAL, completed INTEGER NOT NULL, summary_json TEXT NOT NULL
        );
        CREATE TABLE presence_checks(
          id TEXT PRIMARY KEY, session_id TEXT NOT NULL, ts INTEGER NOT NULL,
          present INTEGER NOT NULL, confidence REAL NOT NULL
        );
        CREATE TABLE goals(
          user_id TEXT NOT NULL, period TEXT NOT NULL, target INTEGER NOT NULL,
          active INTEGER NOT NULL, PRIMARY KEY(user_id, period)
        );
        CREATE TABLE user_badges(
          user_id TEXT NOT NULL, code TEXT NOT NULL, earned_at INTEGER NOT NULL,
          PRIMARY KEY(user_id, code)
        );
        CREATE TABLE settings(
          user_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
          PRIMARY KEY(user_id, key)
        );
      `);
      this.db.pragma(`user_version = ${SCHEMA_VERSION}`);
    }
  }

  private seed(): void {
    const exists = this.db.prepare("SELECT id FROM users WHERE id = ?").get(LOCAL_USER_ID);
    if (!exists) {
      this.db
        .prepare("INSERT INTO users(id, name, created_at, disclaimer_accepted_at) VALUES (?,?,?,?)")
        .run(LOCAL_USER_ID, "Me", Date.now(), null);
    }
    const hasGoals = this.db.prepare("SELECT 1 FROM goals WHERE user_id = ?").get(LOCAL_USER_ID);
    if (!hasGoals) {
      const ins = this.db.prepare("INSERT INTO goals(user_id, period, target, active) VALUES (?,?,?,?)");
      ins.run(LOCAL_USER_ID, "weekly", 5, 1);
      ins.run(LOCAL_USER_ID, "monthly", 20, 1);
    }
  }

  // ---- profile ----
  async getProfile(): Promise<Profile> {
    const row = this.db
      .prepare("SELECT id, name, created_at, disclaimer_accepted_at FROM users WHERE id = ?")
      .get(LOCAL_USER_ID) as
      | { id: string; name: string; created_at: number; disclaimer_accepted_at: number | null }
      | undefined;
    if (!row) throw new Error("Local profile missing");
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      disclaimerAcceptedAt: row.disclaimer_accepted_at,
    };
  }

  async acceptDisclaimer(): Promise<void> {
    this.db
      .prepare("UPDATE users SET disclaimer_accepted_at = ? WHERE id = ?")
      .run(Date.now(), LOCAL_USER_ID);
  }

  // ---- routines ----
  async listRoutines(): Promise<StoredRoutine[]> {
    const rows = this.db
      .prepare(
        "SELECT id, user_id, config_json, updated_at FROM routines WHERE user_id = ? ORDER BY updated_at DESC",
      )
      .all(LOCAL_USER_ID) as { id: string; user_id: string; config_json: string; updated_at: number }[];
    return rows.map((r) => ({
      ...(JSON.parse(r.config_json) as Routine),
      id: r.id,
      userId: r.user_id,
      updatedAt: r.updated_at,
    }));
  }

  async saveRoutine(routine: Routine): Promise<StoredRoutine> {
    const id = routine.id || randomUUID();
    const updatedAt = Date.now();
    const config = JSON.stringify({ ...routine, id });
    this.db
      .prepare(
        `INSERT INTO routines(id, user_id, name, config_json, updated_at) VALUES (?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, config_json=excluded.config_json, updated_at=excluded.updated_at`,
      )
      .run(id, LOCAL_USER_ID, routine.name, config, updatedAt);
    return { ...routine, id, userId: LOCAL_USER_ID, updatedAt };
  }

  async deleteRoutine(id: string): Promise<void> {
    this.db.prepare("DELETE FROM routines WHERE id = ? AND user_id = ?").run(id, LOCAL_USER_ID);
  }

  // ---- sessions + presence ----
  async saveSession(
    session: Omit<StoredSession, "userId">,
    presence: PresenceCheck[],
  ): Promise<StoredSession> {
    const id = session.id || randomUUID();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO sessions(id, user_id, routine_id, routine_name, started_at, ended_at,
             duration_s, longest_hold_s, presence_pct, completed, summary_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          LOCAL_USER_ID,
          session.routineId,
          session.routineName,
          session.startedAt,
          session.endedAt,
          session.durationS,
          session.longestHoldS,
          session.presencePct,
          session.completed ? 1 : 0,
          JSON.stringify(session.perPhaseTotals),
        );
      const ins = this.db.prepare(
        "INSERT INTO presence_checks(id, session_id, ts, present, confidence) VALUES (?,?,?,?,?)",
      );
      for (const c of presence) ins.run(randomUUID(), id, c.ts, c.present ? 1 : 0, c.confidence);
    });
    tx();
    return { ...session, id, userId: LOCAL_USER_ID };
  }

  async listSessions(): Promise<StoredSession[]> {
    const rows = this.db
      .prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC")
      .all(LOCAL_USER_ID) as Record<string, unknown>[];
    return rows.map((r) => this.rowToSession(r));
  }

  private rowToSession(r: Record<string, unknown>): StoredSession {
    return {
      id: r.id as string,
      userId: r.user_id as string,
      routineId: r.routine_id as string,
      routineName: r.routine_name as string,
      startedAt: r.started_at as number,
      endedAt: r.ended_at as number,
      durationS: r.duration_s as number,
      longestHoldS: r.longest_hold_s as number,
      presencePct: (r.presence_pct as number | null) ?? null,
      completed: (r.completed as number) === 1,
      perPhaseTotals: JSON.parse((r.summary_json as string) || "{}"),
    };
  }

  async getPresenceChecks(sessionId: string): Promise<PresenceCheck[]> {
    const rows = this.db
      .prepare("SELECT ts, present, confidence FROM presence_checks WHERE session_id = ? ORDER BY ts")
      .all(sessionId) as { ts: number; present: number; confidence: number }[];
    return rows.map((r) => ({ ts: r.ts, present: r.present === 1, confidence: r.confidence }));
  }

  // ---- goals ----
  async getGoals(): Promise<Goal[]> {
    const rows = this.db
      .prepare("SELECT period, target, active FROM goals WHERE user_id = ?")
      .all(LOCAL_USER_ID) as { period: string; target: number; active: number }[];
    return rows.map((r) => ({
      period: r.period as Goal["period"],
      target: r.target,
      active: r.active === 1,
    }));
  }

  async setGoal(goal: Goal): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO goals(user_id, period, target, active) VALUES (?,?,?,?)
         ON CONFLICT(user_id, period) DO UPDATE SET target=excluded.target, active=excluded.active`,
      )
      .run(LOCAL_USER_ID, goal.period, goal.target, goal.active ? 1 : 0);
  }

  // ---- badges ----
  async getEarnedBadges(): Promise<{ code: string; earnedAt: number }[]> {
    const rows = this.db
      .prepare("SELECT code, earned_at FROM user_badges WHERE user_id = ?")
      .all(LOCAL_USER_ID) as { code: string; earned_at: number }[];
    return rows.map((r) => ({ code: r.code, earnedAt: r.earned_at }));
  }

  async awardBadges(codes: string[]): Promise<void> {
    const ins = this.db.prepare("INSERT OR IGNORE INTO user_badges(user_id, code, earned_at) VALUES (?,?,?)");
    const now = Date.now();
    const tx = this.db.transaction(() => {
      for (const code of codes) ins.run(LOCAL_USER_ID, code, now);
    });
    tx();
  }

  // ---- settings ----
  async getSettings(): Promise<AppSettings> {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'app'")
      .get(LOCAL_USER_ID) as { value: string } | undefined;
    if (!row) return defaultSettings();
    try {
      return { ...defaultSettings(), ...(JSON.parse(row.value) as Partial<AppSettings>) };
    } catch {
      return defaultSettings();
    }
  }

  async setSettings(settings: AppSettings): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO settings(user_id, key, value) VALUES (?, 'app', ?)
         ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value`,
      )
      .run(LOCAL_USER_ID, JSON.stringify(settings));
  }

  // ---- export / import (PFR-35, PDR-6) ----
  async exportAll(): Promise<ExportBundle> {
    const profile = await this.getProfile();
    const routines = await this.listRoutines();
    const sessions = await this.listSessions();
    const presenceChecks: Record<string, PresenceCheck[]> = {};
    for (const s of sessions) presenceChecks[s.id] = await this.getPresenceChecks(s.id);
    return {
      version: 1,
      exportedAt: Date.now(),
      profile,
      routines,
      sessions,
      presenceChecks,
      goals: await this.getGoals(),
      earnedBadges: await this.getEarnedBadges(),
      settings: await this.getSettings(),
    };
  }

  async importAll(bundle: ExportBundle): Promise<void> {
    const tx = this.db.transaction(() => {
      // Replace all user-owned data with the imported snapshot (clean reproduction — PDR-6).
      for (const t of ["routines", "sessions", "presence_checks", "goals", "user_badges", "settings"]) {
        if (t === "presence_checks") this.db.prepare(`DELETE FROM presence_checks`).run();
        else this.db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(LOCAL_USER_ID);
      }
      for (const r of bundle.routines) {
        this.db
          .prepare("INSERT INTO routines(id, user_id, name, config_json, updated_at) VALUES (?,?,?,?,?)")
          .run(r.id, LOCAL_USER_ID, r.name, JSON.stringify(r), r.updatedAt);
      }
      for (const s of bundle.sessions) {
        this.db
          .prepare(
            `INSERT INTO sessions(id, user_id, routine_id, routine_name, started_at, ended_at,
               duration_s, longest_hold_s, presence_pct, completed, summary_json)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            s.id,
            LOCAL_USER_ID,
            s.routineId,
            s.routineName,
            s.startedAt,
            s.endedAt,
            s.durationS,
            s.longestHoldS,
            s.presencePct,
            s.completed ? 1 : 0,
            JSON.stringify(s.perPhaseTotals),
          );
        const checks = bundle.presenceChecks[s.id] ?? [];
        const ins = this.db.prepare(
          "INSERT INTO presence_checks(id, session_id, ts, present, confidence) VALUES (?,?,?,?,?)",
        );
        for (const c of checks) ins.run(randomUUID(), s.id, c.ts, c.present ? 1 : 0, c.confidence);
      }
      for (const g of bundle.goals) {
        this.db
          .prepare("INSERT INTO goals(user_id, period, target, active) VALUES (?,?,?,?)")
          .run(LOCAL_USER_ID, g.period, g.target, g.active ? 1 : 0);
      }
      for (const b of bundle.earnedBadges) {
        this.db
          .prepare("INSERT OR IGNORE INTO user_badges(user_id, code, earned_at) VALUES (?,?,?)")
          .run(LOCAL_USER_ID, b.code, b.earnedAt);
      }
      this.db
        .prepare("INSERT INTO settings(user_id, key, value) VALUES (?, 'app', ?)")
        .run(LOCAL_USER_ID, JSON.stringify(bundle.settings));
    });
    tx();
  }
}
