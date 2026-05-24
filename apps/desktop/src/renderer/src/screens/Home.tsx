import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BUILTIN_PRESETS,
  compileTimeline,
  computeStreak,
  timelineDurationSeconds,
  totalMinutes,
  type SessionRecord,
} from "@prana/core";
import { useAppStore } from "../store/appStore.js";

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Home(): JSX.Element {
  const navigate = useNavigate();
  const { routines, sessions, settings, refreshRoutines } = useAppStore();

  useEffect(() => {
    void refreshRoutines();
  }, [refreshRoutines]);

  const records: SessionRecord[] = sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt,
    durationS: s.durationS,
    longestHoldS: s.longestHoldS,
    completed: s.completed,
  }));
  const streak = useMemo(() => computeStreak(records), [records]);

  async function startPreset(level: "beginner" | "intermediate" | "advanced"): Promise<void> {
    const preset = BUILTIN_PRESETS.find((p) => p.level === level)!;
    const routine = preset.build();
    const saved = await window.prana.saveRoutine(routine);
    await refreshRoutines();
    navigate(`/play/${saved.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-slate-400">Current streak</div>
          <div className="text-3xl font-bold">{streak.current} 🔥</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-400">Longest streak</div>
          <div className="text-3xl font-bold">{streak.longest}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-400">Total practice</div>
          <div className="text-3xl font-bold">{totalMinutes(records)} min</div>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Quick start (presets)</h2>
        <div className="grid grid-cols-3 gap-4">
          {BUILTIN_PRESETS.map((p) => (
            <button key={p.level} className="card text-left hover:border-sky-400" onClick={() => void startPreset(p.level)}>
              <div className="text-lg font-semibold capitalize">{p.label}</div>
              <div className="text-sm text-slate-400">Adaptive, cap {settings.caps.maxHoldSeconds}s</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My routines</h2>
          <button className="btn-ghost" onClick={() => navigate("/builder")}>
            + New routine
          </button>
        </div>
        {routines.length === 0 ? (
          <p className="text-slate-400">No saved routines yet. Start a preset above or build your own.</p>
        ) : (
          <div className="space-y-2">
            {routines.map((r) => {
              const tl = compileTimeline(r, { caps: settings.caps, progression: settings.progression });
              return (
                <div key={r.id} className="card flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-sm text-slate-400">
                      {r.techniques.length} techniques · ~{fmtDuration(timelineDurationSeconds(tl))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={() => navigate(`/builder/${r.id}`)}>
                      Edit
                    </button>
                    <button className="btn-primary" onClick={() => navigate(`/play/${r.id}`)}>
                      Start
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
