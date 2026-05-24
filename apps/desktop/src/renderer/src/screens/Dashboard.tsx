import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeStreak,
  dayKey,
  goalProgress,
  SEED_BADGES,
  totalMinutes,
  type SessionRecord,
} from "@prana/core";
import { useAppStore } from "../store/appStore.js";

export function Dashboard(): JSX.Element {
  const { sessions, goals, earnedBadges } = useAppStore();

  const records: SessionRecord[] = sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt,
    durationS: s.durationS,
    longestHoldS: s.longestHoldS,
    completed: s.completed,
  }));

  const streak = useMemo(() => computeStreak(records), [records]);

  // Sessions per day (last 14 days) + hold trend.
  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of records)
      if (s.completed) map.set(dayKey(s.startedAt), (map.get(dayKey(s.startedAt)) ?? 0) + 1);
    const out: { day: string; sessions: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d.getTime());
      out.push({ day: key.slice(5), sessions: map.get(key) ?? 0 });
    }
    return out;
  }, [records]);

  const holdTrend = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.completed)
        .sort((a, b) => a.startedAt - b.startedAt)
        .map((s, i) => ({ n: i + 1, hold: s.longestHoldS })),
    [sessions],
  );

  const earnedSet = new Set(earnedBadges.map((b) => b.code));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Sessions" value={String(records.filter((s) => s.completed).length)} />
        <Stat label="Total minutes" value={String(totalMinutes(records))} />
        <Stat label="Current streak" value={`${streak.current} 🔥`} />
        <Stat label="Longest streak" value={String(streak.longest)} />
      </div>

      <section className="grid grid-cols-2 gap-4">
        {goals.map((g) => {
          const p = goalProgress(g, records);
          return (
            <div key={g.period} className="card">
              <div className="mb-1 flex justify-between text-sm">
                <span className="capitalize text-slate-300">{g.period} goal</span>
                <span className="text-slate-400">
                  {p.completed}/{p.target} {p.done ? "✓" : ""}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-slate-700">
                <div
                  className="h-full bg-sky-500"
                  style={{ width: `${Math.min(100, (p.completed / Math.max(1, p.target)) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="card">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Sessions / day (14d)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={perDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
              <Bar dataKey="sessions" fill="#38bdf8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Longest-hold trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={holdTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="n" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
              <Line type="monotone" dataKey="hold" stroke="#a78bfa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Trophy shelf</h3>
        <div className="grid grid-cols-5 gap-3">
          {SEED_BADGES.map((b) => {
            const earned = earnedSet.has(b.code);
            return (
              <div
                key={b.code}
                className={`card text-center ${earned ? "border-amber-500/50" : "opacity-40"}`}
                title={b.description}
              >
                <div className="text-3xl">{earned ? "🏅" : "🔒"}</div>
                <div className="mt-1 text-xs font-medium">{b.name}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">History</h3>
        {records.length === 0 ? (
          <p className="text-slate-400">No sessions yet.</p>
        ) : (
          <div className="space-y-1">
            {sessions.slice(0, 20).map((s) => (
              <div key={s.id} className="card flex items-center justify-between py-2 text-sm">
                <span>{new Date(s.startedAt).toLocaleString()}</span>
                <span className="text-slate-400">{s.routineName}</span>
                <span>
                  {s.durationS}s · hold {s.longestHoldS}s
                  {s.presencePct !== null ? ` · ${s.presencePct}% present` : ""}
                  {!s.completed ? " · incomplete" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="card">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
