import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAppStore } from "./store/appStore.js";
import { FirstRun } from "./screens/FirstRun.js";
import { Home } from "./screens/Home.js";
import { RoutineBuilder } from "./screens/RoutineBuilder.js";
import { SessionPlayer } from "./screens/SessionPlayer.js";
import { Dashboard } from "./screens/Dashboard.js";
import { Settings } from "./screens/Settings.js";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/builder", label: "Routine Builder" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/settings", label: "Settings" },
];

export default function App(): JSX.Element {
  const { loaded, profile, settings, load } = useAppStore();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", settings.highContrast);
  }, [settings.highContrast]);

  if (!loaded) {
    return <div className="flex h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  // First-run medical disclaimer gate (PNFR-6 / FR-15).
  if (!profile?.disclaimerAcceptedAt) {
    return <FirstRun />;
  }

  return (
    <div className="app-shell flex h-screen flex-col">
      <header className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
        <span className="mr-4 text-lg font-bold text-sky-400">PranaCoach</span>
        <nav className="flex gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/builder" element={<RoutineBuilder />} />
          <Route path="/builder/:id" element={<RoutineBuilder />} />
          <Route path="/play/:id" element={<SessionPlayer />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
