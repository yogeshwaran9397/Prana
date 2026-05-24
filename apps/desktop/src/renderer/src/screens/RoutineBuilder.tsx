import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  blankRoutine,
  blankTechnique,
  compileTimeline,
  routineExceedsCap,
  timelineDurationSeconds,
  type Phase,
  type PhaseKind,
  type Routine,
  type Technique,
} from "@prana/core";
import { useAppStore } from "../store/appStore.js";

const PHASE_KINDS: PhaseKind[] = ["inhale", "hold_in", "exhale", "hold_out", "rest"];
const PHASE_LABEL: Record<PhaseKind, string> = {
  inhale: "Inhale",
  hold_in: "Hold in",
  exhale: "Exhale",
  hold_out: "Hold out",
  rest: "Rest",
};

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RoutineBuilder(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const { routines, settings, refreshRoutines } = useAppStore();
  const [routine, setRoutine] = useState<Routine>(() => blankRoutine());

  useEffect(() => {
    if (id) {
      const existing = routines.find((r) => r.id === id);
      if (existing) setRoutine(existing);
    }
  }, [id, routines]);

  const overCap = routineExceedsCap(routine, settings.caps);
  const timeline = compileTimeline(routine, { caps: settings.caps, progression: settings.progression });
  const totalSeconds = timelineDurationSeconds(timeline);

  function update(patch: Partial<Routine>): void {
    setRoutine((r) => ({ ...r, ...patch }));
  }

  function updateTechnique(idx: number, patch: Partial<Technique>): void {
    setRoutine((r) => ({
      ...r,
      techniques: r.techniques.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  }

  function updatePhase(tIdx: number, pIdx: number, patch: Partial<Phase>): void {
    setRoutine((r) => ({
      ...r,
      techniques: r.techniques.map((t, i) =>
        i === tIdx ? { ...t, phases: t.phases.map((p, j) => (j === pIdx ? { ...p, ...patch } : p)) } : t,
      ),
    }));
  }

  async function save(): Promise<void> {
    await window.prana.saveRoutine(routine);
    await refreshRoutines();
    navigate("/");
  }

  async function remove(): Promise<void> {
    if (id) {
      await window.prana.deleteRoutine(id);
      await refreshRoutines();
    }
    navigate("/");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{id ? "Edit routine" : "New routine"}</h1>
        <div className="text-sm text-slate-400">
          Est. total ~{fmt(totalSeconds)} ({timeline.length} phases)
        </div>
      </div>

      <div className="card space-y-3">
        <label className="block">
          <span className="text-sm text-slate-400">Name</span>
          <input className="input mt-1 w-full" value={routine.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm text-slate-400">Warmup (s)</span>
            <input
              type="number"
              className="input mt-1 w-full"
              value={routine.warmupSeconds}
              onChange={(e) => update({ warmupSeconds: Number(e.target.value) })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Closing rest (s)</span>
            <input
              type="number"
              className="input mt-1 w-full"
              value={routine.closingRestSeconds}
              onChange={(e) => update({ closingRestSeconds: Number(e.target.value) })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Pace ×{routine.paceMultiplier.toFixed(2)}</span>
            <input
              type="range"
              min={0.75}
              max={1.25}
              step={0.05}
              className="mt-3 w-full"
              value={routine.paceMultiplier}
              onChange={(e) => update({ paceMultiplier: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>

      {overCap && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          ⚠ A hold exceeds your {settings.caps.maxHoldSeconds}s safety cap.{" "}
          {settings.caps.allowOverride
            ? "Override is ON — holds will run as entered."
            : "Holds will be clipped to the cap. Enable override in Settings to allow longer holds."}
        </div>
      )}

      {routine.techniques.map((tech, tIdx) => (
        <div key={tech.id} className="card space-y-3">
          <div className="flex items-center gap-3">
            <input
              className="input flex-1"
              value={tech.name}
              onChange={(e) => updateTechnique(tIdx, { name: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-400">
              Rounds
              <input
                type="number"
                min={1}
                className="input w-20"
                value={tech.rounds}
                onChange={(e) => updateTechnique(tIdx, { rounds: Number(e.target.value) })}
              />
            </label>
            <button
              className="btn-ghost"
              onClick={() =>
                setRoutine((r) => ({ ...r, techniques: r.techniques.filter((_, i) => i !== tIdx) }))
              }
            >
              Remove
            </button>
          </div>

          <div className="space-y-2">
            {tech.phases.map((phase, pIdx) => (
              <div key={pIdx} className="flex items-center gap-2">
                <select
                  className="input w-32"
                  value={phase.kind}
                  onChange={(e) => updatePhase(tIdx, pIdx, { kind: e.target.value as PhaseKind })}
                >
                  {PHASE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {PHASE_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="input w-24"
                  value={phase.seconds}
                  onChange={(e) => updatePhase(tIdx, pIdx, { seconds: Number(e.target.value) })}
                />
                <span className="text-sm text-slate-500">seconds</span>
                <button
                  className="ml-auto text-slate-500 hover:text-rose-400"
                  onClick={() =>
                    updateTechnique(tIdx, { phases: tech.phases.filter((_, j) => j !== pIdx) })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                updateTechnique(tIdx, { phases: [...tech.phases, { kind: "inhale", seconds: 4 } as Phase] })
              }
            >
              + Add phase
            </button>
          </div>
        </div>
      ))}

      <button
        className="btn-ghost w-full"
        onClick={() => setRoutine((r) => ({ ...r, techniques: [...r.techniques, blankTechnique()] }))}
      >
        + Add technique
      </button>

      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => void save()}>
          Save routine
        </button>
        <button className="btn-ghost" onClick={() => navigate("/")}>
          Cancel
        </button>
        {id && (
          <button className="btn-danger ml-auto" onClick={() => void remove()}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
