import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  compileTimeline,
  timelineDurationSeconds,
  TimerEngine,
  type PhaseInstance,
  type PresenceCheck,
  type SessionSummary,
} from "@prana/core";
import { useAppStore } from "../store/appStore.js";
import { BreathAnimation } from "../components/BreathAnimation.js";
import { cuePlayer } from "../audio/cues.js";
import { PresenceMonitor, presencePercent } from "../lib/presence.js";
import { VoiceController } from "../lib/voice.js";

type Mode = "pre" | "running" | "done";

interface LiveState {
  phase: PhaseInstance;
  remainingMs: number;
  progress: number;
  index: number;
}

export function SessionPlayer(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const { routines, settings, sessions, recordSession } = useAppStore();

  const routine = routines.find((r) => r.id === id);
  const completedSessions = sessions.filter((s) => s.completed).length;

  const timeline = useMemo(
    () =>
      routine
        ? compileTimeline(routine, {
            caps: settings.caps,
            progression: settings.progression,
            completedSessions,
          })
        : [],
    [routine, settings, completedSessions],
  );

  const [mode, setMode] = useState<Mode>("pre");
  const [live, setLive] = useState<LiveState | null>(null);
  const [paused, setPaused] = useState(false);
  const [caption, setCaption] = useState("");
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [useCamera, setUseCamera] = useState(settings.cameraEnabled);
  const [useMic, setUseMic] = useState(settings.micEnabled);
  const [presentNow, setPresentNow] = useState<boolean | null>(null);
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);

  const engineRef = useRef<TimerEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const presenceRef = useRef<PresenceMonitor | null>(null);
  const voiceRef = useRef<VoiceController | null>(null);
  const presenceChecks = useRef<PresenceCheck[]>([]);

  useEffect(() => {
    cuePlayer.setEnabled(settings.audioEnabled);
    cuePlayer.setVolume(settings.audioVolume);
  }, [settings.audioEnabled, settings.audioVolume]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      presenceRef.current?.stop();
      voiceRef.current?.stop();
    };
  }, []);

  if (!routine) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-slate-400">Routine not found.</p>
        <button className="btn-ghost mt-4" onClick={() => navigate("/")}>
          Back home
        </button>
      </div>
    );
  }

  function pump(): void {
    const engine = engineRef.current;
    if (!engine) return;
    engine.update(performance.now());
    if (engine.getState() === "running" || engine.getState() === "paused") {
      rafRef.current = requestAnimationFrame(pump);
    }
  }

  async function startSession(): Promise<void> {
    const engine = new TimerEngine(timeline);
    engineRef.current = engine;
    presenceChecks.current = [];

    engine.on((e) => {
      if (e.type === "phaseStart") {
        setCaption(cuePlayer.cuePhase(e.phase.kind));
      } else if (e.type === "tick") {
        setLive({
          phase: e.phase,
          remainingMs: e.remainingMs,
          progress: 1 - e.remainingMs / (e.phase.seconds * 1000),
          index: e.index,
        });
      } else if (e.type === "sessionEnd") {
        void finish(e.summary);
      }
    });

    // Opt-in presence (PFR-19..24).
    if (useCamera) {
      const monitor = new PresenceMonitor({
        minSeconds: settings.presenceMinSeconds,
        maxSeconds: settings.presenceMaxSeconds,
        autoPauseAfterAbsent: settings.autoPauseAfterAbsent,
        onCheck: (c) => {
          presenceChecks.current.push(c);
          setPresentNow(c.present);
        },
        onAutoPause: () => {
          cuePlayer.nudge();
          handlePause();
        },
      });
      try {
        await monitor.start();
        presenceRef.current = monitor;
      } catch {
        setPresentNow(null); // camera unavailable; session still runs (PFR-24)
      }
    }

    // Opt-in voice (PFR-25..28).
    if (useMic) {
      const voice = new VoiceController({
        onCommand: (cmd) => {
          if (cmd === "pause") handlePause();
          else if (cmd === "resume") handleResume();
          else if (cmd === "stop") handleStop();
        },
      });
      const { supported } = await voice.start();
      setVoiceSupported(supported);
      if (supported) voiceRef.current = voice;
    }

    setMode("running");
    setPaused(false);
    engine.start(performance.now());
    rafRef.current = requestAnimationFrame(pump);
  }

  function handlePause(): void {
    engineRef.current?.pause(performance.now());
    setPaused(true);
  }
  function handleResume(): void {
    engineRef.current?.resume(performance.now());
    setPaused(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(pump);
  }
  function handleSkip(): void {
    engineRef.current?.skip(performance.now());
  }
  function handleStop(): void {
    engineRef.current?.stop(performance.now());
  }

  async function finish(s: SessionSummary): Promise<void> {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    presenceRef.current?.stop();
    voiceRef.current?.stop();

    const pct = useCamera ? presencePercent(presenceChecks.current) : null;
    setSummary(s);
    setMode("done");

    const earned = await recordSession(
      {
        id: "",
        routineId: routine!.id,
        routineName: routine!.name,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationS: s.durationS,
        longestHoldS: s.longestHoldS,
        completed: s.completed,
        presencePct: pct,
        perPhaseTotals: s.perPhaseTotals,
      },
      presenceChecks.current,
    );
    setNewBadges(earned);
    if (s.completed) void window.prana.notify("Session complete 🎉", `${routine!.name} · ${s.durationS}s practiced`);
  }

  // ---- pre-session ----
  if (mode === "pre") {
    const total = timelineDurationSeconds(timeline);
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-bold">{routine.name}</h1>
        <div className="card space-y-2">
          <div className="text-slate-300">
            {routine.techniques.length} techniques · est. {Math.floor(total / 60)}:{String(Math.round(total % 60)).padStart(2, "0")}
          </div>
          <ul className="text-sm text-slate-400">
            {routine.techniques.map((t) => (
              <li key={t.id}>
                • {t.name} × {t.rounds} rounds
              </li>
            ))}
          </ul>
        </div>

        <div className="card space-y-3">
          <div className="text-sm font-semibold text-slate-300">Before you start</div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useCamera} onChange={(e) => setUseCamera(e.target.checked)} />
            Enable camera for presence logging <span className="text-slate-500">(no images stored)</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useMic} onChange={(e) => setUseMic(e.target.checked)} />
            Enable microphone for voice "pause"/"resume" <span className="text-slate-500">(no audio stored)</span>
          </label>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
            Stop if you feel dizzy and breathe normally. This is not medical advice.
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => void startSession()}>
            Start session
          </button>
          <button className="btn-ghost" onClick={() => navigate("/")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ---- done ----
  if (mode === "done" && summary) {
    return (
      <div className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-2xl font-bold">{summary.completed ? "Session complete 🎉" : "Session ended"}</h1>
        <div className="card grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-slate-400">Duration</div>
            <div className="text-2xl font-bold">{summary.durationS}s</div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Longest hold</div>
            <div className="text-2xl font-bold">{summary.longestHoldS}s</div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Presence</div>
            <div className="text-2xl font-bold">
              {useCamera ? `${presencePercent(presenceChecks.current) ?? "—"}%` : "—"}
            </div>
          </div>
        </div>
        {newBadges.length > 0 && (
          <div className="card border-amber-500/40 bg-amber-500/10 text-amber-200">
            🏅 New badge{newBadges.length > 1 ? "s" : ""}: {newBadges.join(", ")}
          </div>
        )}
        <div className="flex justify-center gap-2">
          <button className="btn-primary" onClick={() => navigate("/dashboard")}>
            View dashboard
          </button>
          <button className="btn-ghost" onClick={() => navigate("/")}>
            Home
          </button>
        </div>
      </div>
    );
  }

  // ---- running ----
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
      <div className="flex w-full items-center justify-between text-sm text-slate-400">
        <span>{live ? `${live.phase.techniqueName} · round ${live.phase.round}` : "Starting…"}</span>
        <span className="flex gap-3">
          <span title="Camera">{useCamera ? (presentNow === false ? "📷 absent" : "📷 on") : "📷 off"}</span>
          <span title="Microphone">
            {useMic ? (voiceSupported === false ? "🎙 n/a (use buttons)" : "🎙 listening") : "🎙 off"}
          </span>
        </span>
      </div>

      {live && (
        <BreathAnimation kind={live.phase.kind} progress={live.progress} remainingSeconds={live.remainingMs / 1000} />
      )}
      <div className="h-6 text-lg text-slate-300" aria-live="polite">
        {caption}
      </div>

      <div className="flex gap-2">
        {paused ? (
          <button className="btn-primary" onClick={handleResume}>
            ▶ Resume
          </button>
        ) : (
          <button className="btn-ghost" onClick={handlePause}>
            ⏸ Pause
          </button>
        )}
        <button className="btn-ghost" onClick={handleSkip}>
          ⏭ Skip phase
        </button>
        <button className="btn-danger" onClick={handleStop}>
          ⏹ Stop
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Index {live ? live.index + 1 : 0} / {timeline.length}
      </p>
    </div>
  );
}
