/**
 * Electron main process: window lifecycle, native notifications (PIR-H2), file-backed
 * export/import (PFR-35), and IPC handlers that delegate to the SqliteStorageRepository.
 * Renderer never touches the DB directly — everything crosses the narrow IPC seam.
 */
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { BrowserWindow, Notification, app, dialog, ipcMain } from "electron";
import type { AppSettings, ExportBundle, Goal, PresenceCheck, Routine, StoredSession } from "@prana/core";
import { SqliteStorageRepository } from "./db.js";
import { IPC } from "./ipc.js";

let repo: SqliteStorageRepository;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 880,
    minHeight: 640,
    title: "PranaCoach",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.getProfile, () => repo.getProfile());
  ipcMain.handle(IPC.acceptDisclaimer, () => repo.acceptDisclaimer());
  ipcMain.handle(IPC.listRoutines, () => repo.listRoutines());
  ipcMain.handle(IPC.saveRoutine, (_e, routine: Routine) => repo.saveRoutine(routine));
  ipcMain.handle(IPC.deleteRoutine, (_e, id: string) => repo.deleteRoutine(id));
  ipcMain.handle(IPC.saveSession, (_e, session: Omit<StoredSession, "userId">, presence: PresenceCheck[]) =>
    repo.saveSession(session, presence),
  );
  ipcMain.handle(IPC.listSessions, () => repo.listSessions());
  ipcMain.handle(IPC.getPresenceChecks, (_e, id: string) => repo.getPresenceChecks(id));
  ipcMain.handle(IPC.getGoals, () => repo.getGoals());
  ipcMain.handle(IPC.setGoal, (_e, goal: Goal) => repo.setGoal(goal));
  ipcMain.handle(IPC.getEarnedBadges, () => repo.getEarnedBadges());
  ipcMain.handle(IPC.awardBadges, (_e, codes: string[]) => repo.awardBadges(codes));
  ipcMain.handle(IPC.getSettings, () => repo.getSettings());
  ipcMain.handle(IPC.setSettings, (_e, settings: AppSettings) => repo.setSettings(settings));
  ipcMain.handle(IPC.exportAll, () => repo.exportAll());
  ipcMain.handle(IPC.importAll, (_e, bundle: ExportBundle) => repo.importAll(bundle));

  ipcMain.handle(IPC.exportToFile, async () => {
    const bundle = await repo.exportAll();
    const res = await dialog.showSaveDialog(mainWindow!, {
      title: "Export PranaCoach data",
      defaultPath: `pranacoach-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (res.canceled || !res.filePath) return false;
    await writeFile(res.filePath, JSON.stringify(bundle, null, 2), "utf-8");
    return true;
  });

  ipcMain.handle(IPC.importFromFile, async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: "Import PranaCoach data",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (res.canceled || res.filePaths.length === 0) return false;
    const raw = await readFile(res.filePaths[0]!, "utf-8");
    await repo.importAll(JSON.parse(raw) as ExportBundle);
    return true;
  });

  ipcMain.handle(IPC.notify, (_e, title: string, body: string) => {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  });
}

app.whenReady().then(() => {
  const dbPath = join(app.getPath("userData"), "pranacoach.db");
  repo = new SqliteStorageRepository(dbPath);
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
