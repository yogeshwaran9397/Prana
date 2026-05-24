/**
 * Preload: exposes a narrow, typed `window.prana` API over contextBridge. No Node or DB handles
 * reach the renderer (contextIsolation on, nodeIntegration off). PIR-S3.
 */
import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSettings,
  ExportBundle,
  Goal,
  PresenceCheck,
  Profile,
  Routine,
  StoredRoutine,
  StoredSession,
} from "@prana/core";
import { IPC } from "../main/ipc.js";

const api = {
  getProfile: (): Promise<Profile> => ipcRenderer.invoke(IPC.getProfile),
  acceptDisclaimer: (): Promise<void> => ipcRenderer.invoke(IPC.acceptDisclaimer),

  listRoutines: (): Promise<StoredRoutine[]> => ipcRenderer.invoke(IPC.listRoutines),
  saveRoutine: (routine: Routine): Promise<StoredRoutine> => ipcRenderer.invoke(IPC.saveRoutine, routine),
  deleteRoutine: (id: string): Promise<void> => ipcRenderer.invoke(IPC.deleteRoutine, id),

  saveSession: (session: Omit<StoredSession, "userId">, presence: PresenceCheck[]): Promise<StoredSession> =>
    ipcRenderer.invoke(IPC.saveSession, session, presence),
  listSessions: (): Promise<StoredSession[]> => ipcRenderer.invoke(IPC.listSessions),
  getPresenceChecks: (id: string): Promise<PresenceCheck[]> => ipcRenderer.invoke(IPC.getPresenceChecks, id),

  getGoals: (): Promise<Goal[]> => ipcRenderer.invoke(IPC.getGoals),
  setGoal: (goal: Goal): Promise<void> => ipcRenderer.invoke(IPC.setGoal, goal),

  getEarnedBadges: (): Promise<{ code: string; earnedAt: number }[]> => ipcRenderer.invoke(IPC.getEarnedBadges),
  awardBadges: (codes: string[]): Promise<void> => ipcRenderer.invoke(IPC.awardBadges, codes),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.getSettings),
  setSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke(IPC.setSettings, settings),

  exportAll: (): Promise<ExportBundle> => ipcRenderer.invoke(IPC.exportAll),
  importAll: (bundle: ExportBundle): Promise<void> => ipcRenderer.invoke(IPC.importAll, bundle),
  exportToFile: (): Promise<boolean> => ipcRenderer.invoke(IPC.exportToFile),
  importFromFile: (): Promise<boolean> => ipcRenderer.invoke(IPC.importFromFile),

  notify: (title: string, body: string): Promise<void> => ipcRenderer.invoke(IPC.notify, title, body),
};

export type PranaApi = typeof api;

contextBridge.exposeInMainWorld("prana", api);
