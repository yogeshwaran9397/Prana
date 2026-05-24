import { useState } from "react";
import type { AppSettings } from "@prana/core";
import { useAppStore } from "../store/appStore.js";

export function Settings(): JSX.Element {
  const { settings, saveSettings, goals, setGoal, load } = useAppStore();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [msg, setMsg] = useState("");

  function patch(p: Partial<AppSettings>): void {
    setDraft((d) => ({ ...d, ...p }));
  }

  async function save(): Promise<void> {
    await saveSettings(draft);
    setMsg("Settings saved.");
    setTimeout(() => setMsg(""), 2000);
  }

  async function doExport(): Promise<void> {
    const ok = await window.prana.exportToFile();
    setMsg(ok ? "Exported." : "Export cancelled.");
    setTimeout(() => setMsg(""), 2500);
  }

  async function doImport(): Promise<void> {
    const ok = await window.prana.importFromFile();
    if (ok) {
      await load();
      setMsg("Imported. All data replaced.");
    } else {
      setMsg("Import cancelled.");
    }
    setTimeout(() => setMsg(""), 2500);
  }

  const weekly = goals.find((g) => g.period === "weekly");
  const monthly = goals.find((g) => g.period === "monthly");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="card space-y-3">
        <h2 className="font-semibold">Safety (PFR-5)</h2>
        <label className="flex items-center justify-between">
          <span>Max hold ceiling (seconds)</span>
          <input
            type="number"
            min={1}
            className="input w-24"
            value={draft.caps.maxHoldSeconds}
            onChange={(e) => patch({ caps: { ...draft.caps, maxHoldSeconds: Number(e.target.value) } })}
          />
        </label>
        <label className="flex items-center justify-between">
          <span>
            Allow override <span className="text-xs text-slate-500">(run holds longer than the cap)</span>
          </span>
          <input
            type="checkbox"
            checked={draft.caps.allowOverride}
            onChange={(e) => patch({ caps: { ...draft.caps, allowOverride: e.target.checked } })}
          />
        </label>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Progression (PFR-6)</h2>
        <label className="flex items-center justify-between">
          <span>Auto-ramp holds</span>
          <input
            type="checkbox"
            checked={draft.progression.enabled}
            onChange={(e) => patch({ progression: { ...draft.progression, enabled: e.target.checked } })}
          />
        </label>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <label>
            +seconds
            <input
              type="number"
              className="input mt-1 w-full"
              value={draft.progression.deltaSeconds}
              onChange={(e) =>
                patch({ progression: { ...draft.progression, deltaSeconds: Number(e.target.value) } })
              }
            />
          </label>
          <label>
            every N sessions
            <input
              type="number"
              className="input mt-1 w-full"
              value={draft.progression.everyNSessions}
              onChange={(e) =>
                patch({ progression: { ...draft.progression, everyNSessions: Number(e.target.value) } })
              }
            />
          </label>
          <label>
            target hold (s)
            <input
              type="number"
              className="input mt-1 w-full"
              value={draft.progression.targetHoldSeconds}
              onChange={(e) =>
                patch({ progression: { ...draft.progression, targetHoldSeconds: Number(e.target.value) } })
              }
            />
          </label>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Audio, camera & voice</h2>
        <label className="flex items-center justify-between">
          <span>Audio cues</span>
          <input
            type="checkbox"
            checked={draft.audioEnabled}
            onChange={(e) => patch({ audioEnabled: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between">
          <span>Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.audioVolume}
            onChange={(e) => patch({ audioVolume: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center justify-between">
          <span>Camera presence by default (no images stored)</span>
          <input
            type="checkbox"
            checked={draft.cameraEnabled}
            onChange={(e) => patch({ cameraEnabled: e.target.checked })}
          />
        </label>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <label>
            check min (s)
            <input
              type="number"
              className="input mt-1 w-full"
              value={draft.presenceMinSeconds}
              onChange={(e) => patch({ presenceMinSeconds: Number(e.target.value) })}
            />
          </label>
          <label>
            check max (s)
            <input
              type="number"
              className="input mt-1 w-full"
              value={draft.presenceMaxSeconds}
              onChange={(e) => patch({ presenceMaxSeconds: Number(e.target.value) })}
            />
          </label>
          <label>
            auto-pause after K absent
            <input
              type="number"
              className="input mt-1 w-full"
              value={draft.autoPauseAfterAbsent}
              onChange={(e) => patch({ autoPauseAfterAbsent: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="flex items-center justify-between">
          <span>Microphone voice control by default</span>
          <input
            type="checkbox"
            checked={draft.micEnabled}
            onChange={(e) => patch({ micEnabled: e.target.checked })}
          />
        </label>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Accessibility (PNFR-13)</h2>
        <label className="flex items-center justify-between">
          <span>High-contrast theme</span>
          <input
            type="checkbox"
            checked={draft.highContrast}
            onChange={(e) => patch({ highContrast: e.target.checked })}
          />
        </label>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Goals (PFR-31)</h2>
        {weekly && (
          <label className="flex items-center justify-between">
            <span>Weekly target (sessions)</span>
            <input
              type="number"
              min={1}
              className="input w-24"
              value={weekly.target}
              onChange={(e) => void setGoal({ ...weekly, target: Number(e.target.value) })}
            />
          </label>
        )}
        {monthly && (
          <label className="flex items-center justify-between">
            <span>Monthly target (sessions)</span>
            <input
              type="number"
              min={1}
              className="input w-24"
              value={monthly.target}
              onChange={(e) => void setGoal({ ...monthly, target: Number(e.target.value) })}
            />
          </label>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Data (PFR-35)</h2>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => void doExport()}>
            Export all data (JSON)
          </button>
          <button className="btn-ghost" onClick={() => void doImport()}>
            Import data (replaces current)
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={() => void save()}>
          Save settings
        </button>
        {msg && <span className="text-sm text-emerald-400">{msg}</span>}
      </div>
    </div>
  );
}
