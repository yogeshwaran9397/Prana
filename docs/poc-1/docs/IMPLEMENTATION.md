# POC 1 — Implementation Guide (R1 Desktop MVP)

> Build-ready engineering plan for **POC 1 = Release R1**: the offline, no-auth, Windows-first
> desktop app that proves PranaCoach's core — a fully customizable adaptive breath timer with
> guided sessions, logging/streaks/goals/badges, plus **opt-in** camera presence and voice control.
>
> This document operationalizes [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) Phases 0–5
> into concrete tasks, file layout, data contracts, and acceptance gates. It traces to
> [`SRS.md`](../SRS.md) requirement IDs and the design in [`ARCHITECTURE.md`](../ARCHITECTURE.md).

- **Status:** Draft v1.0
- **Date:** 2026-05-24
- **Owner:** yogesh@grlps.com
- **Covers:** R1 only (Phases 0–5). R2 (mobile) and R3 (cloud) are explicitly out of scope here.

---

## 1. Goal & Definition of Done

**Goal:** A beginner can install a signed Windows app, build/pick an adaptive routine they can
actually keep up with, complete a guided session (visual + audio cues), control it hands-free by
voice if they choose, have presence logged if they choose, and see their streaks, goals and
badges grow — all **100% offline, with no account**.

**POC 1 is "done" when every item below is true** (mirrors [`SRS.md`](../SRS.md) §8.1 R1):

- [ ] Beginner configures and completes an adaptive guided session offline (button-driven).
- [ ] Per-phase / per-round durations, rounds, presets, ratio mode, pace multiplier all work; the
      max-hold safety cap is enforced with a warning + explicit override (FR-1…FR-12).
- [ ] Visual breath animation + audio cues stay synced to phases; pre-session consent + disclaimer
      shown (FR-13…FR-15).
- [ ] Pause/resume works by **button** and, when enabled, by **voice** (FR-22…FR-25).
- [ ] With camera enabled, presence % is logged from randomized checks; **no frames persisted**;
      with camera disabled, everything still works (FR-16…FR-21).
- [ ] Each completed session persists; streaks, weekly/monthly goals, and badges compute correctly
      against test fixtures; native notifications fire (FR-26…FR-31).
- [ ] Data exports/imports as JSON (FR-32).
- [ ] Timer accuracy within **±100ms** over a 15-min session (NFR-1); ML runs off the UI thread,
      UI ≥30fps (NFR-2); camera/mic opt-in, no raw media stored (NFR-9).
- [ ] Core domain + timer + goal/badge logic covered by unit tests (NFR-22).
- [ ] A signed/packaged Windows installer is produced.

---

## 2. Scope boundaries

| In scope (R1)                                                    | Out of scope (deferred)                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| Windows desktop (Electron); macOS/Linux best-effort, untested    | Android/iOS (R2)                                         |
| Local SQLite, single local profile (`user_id` present but fixed) | Accounts, login, authZ (R3)                              |
| Offline timer engine, cues, presence, voice                      | Cloud sync, API, analytics (R3)                          |
| JSON export/import as the only "backup"                          | Cross-device sync (R3)                                   |
| `StorageRepository` interface (SQLite impl only)                 | `ApiStorageRepository` / `SyncingStorageRepository` (R3) |

**Reuse rule (non-negotiable):** domain types, `TimerEngine`, goals/badges logic, and the
`StorageRepository` _interface_ live in `packages/core` with **zero Electron/DOM imports**, so R2
and R3 reuse them untouched (NFR-20, NFR-21, C2, C3, C6).

---

## 3. Technology stack (pinned intent)

| Concern       | Choice                                      | Notes                                              |
| ------------- | ------------------------------------------- | -------------------------------------------------- |
| Language      | TypeScript (strict)                         | `strict: true`, `noUncheckedIndexedAccess` in core |
| Monorepo      | pnpm workspaces + Turborepo                 | `packages/core` + `apps/desktop`                   |
| Desktop shell | Electron +`electron-vite`                   | main / preload / renderer split                    |
| UI            | React 18 + Vite + Tailwind                  | one component set, reused in R2                    |
| State         | Zustand                                     | session/timer/UI stores                            |
| Router        | React Router (hash history)                 | works under `file://` in Electron                  |
| Local DB      | `better-sqlite3` (main process)             | migrations on first run                            |
| Presence ML   | MediaPipe Face Detection / TF.js BlazeFace  | renderer Web Worker                                |
| Voice ML      | Vosk WASM (small en model)                  | Web Worker, restricted grammar                     |
| Audio cues    | Pre-recorded clips + WebAudio               | volume + on/off                                    |
| Charts        | Recharts                                    | dashboard trends                                   |
| Notifications | Electron `Notification`                     | + in-app toast mirror                              |
| Testing       | Vitest (unit) + Playwright/Electron (smoke) | fixtures for engine & badges                       |
| Packaging     | electron-builder (NSIS, Windows)            | code signing if cert available                     |
| Lint/format   | ESLint + Prettier                           | enforced in CI                                     |

> Open decisions carried from [`ARCHITECTURE.md`](../ARCHITECTURE.md) §9 — resolve in Phase 0:
> Electron vs Tauri (**recommend Electron**, for ML ecosystem); Vosk WASM vs Python sidecar
> (**recommend WASM worker**); ORM vs raw `better-sqlite3` (**recommend raw** for MVP).

---

## 4. Repository layout

```
prana/                              (this repo)
├─ package.json                     # workspace root, scripts
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ packages/
│  └─ core/                         # NO platform deps — reused by R2/R3
│     ├─ src/
│     │  ├─ domain/                 # Phase, Technique, Routine, SafetyCaps, Progression
│     │  ├─ engine/                 # TimerEngine state machine + timeline compiler
│     │  ├─ goals/                  # streak, weekly/monthly progress (pure fns)
│     │  ├─ badges/                 # badge rules engine + seed definitions
│     │  ├─ storage/                # StorageRepository interface + DTOs
│     │  ├─ presets/                # built-in techniques + Beginner/Inter/Adv presets
│     │  └─ index.ts
│     └─ test/                      # Vitest fixtures (deterministic)
└─ apps/
   └─ desktop/
      ├─ electron/
      │  ├─ main.ts                 # app lifecycle, window, Notification
      │  ├─ preload.ts              # contextBridge: safe IPC surface
      │  └─ db/                     # better-sqlite3 SqliteStorageRepository + migrations
      ├─ src/                       # React renderer
      │  ├─ screens/                # Home, RoutineBuilder, SessionPlayer, Dashboard, Settings, FirstRun
      │  ├─ components/             # BreathAnimation, PhaseCountdown, TrophyShelf, charts
      │  ├─ workers/                # presence.worker.ts, voice.worker.ts
      │  ├─ audio/                  # cue clips + WebAudio scheduler
      │  ├─ store/                  # Zustand stores
      │  └─ ipc/                    # typed wrappers over preload bridge
      ├─ assets/                    # audio cues, ML model files
      └─ electron-builder.yml
```

**Process & threading model:**

- **Renderer (React):** screens, `TimerEngine` instance (drives UI + cues), presence/voice workers.
- **Preload:** `contextBridge` exposes a narrow, typed IPC API; `nodeIntegration` off, `contextIsolation` on.
- **Main:** SQLite persistence, OS notifications, file export/import, app lifecycle.
- **Why TimerEngine in renderer:** it needs `performance.now()` and must drive animation/cues with
  no IPC latency; persistence calls cross IPC only at `sessionEnd` and on routine save.

---

## 5. Data contracts

### 5.1 Domain model (`packages/core/src/domain`)

```ts
type PhaseKind = "inhale" | "hold_in" | "exhale" | "hold_out" | "rest";

interface Phase {
  kind: PhaseKind;
  seconds: number;
} // seconds may be 0 (skipped)

interface Technique {
  id: string;
  name: string; // "Anulom Vilom", "Bhramari", …
  rounds: number;
  phases: Phase[]; // one round's phase sequence
  ratio?: { unit: number; pattern: number[] }; // optional ratio mode, e.g. 1:4:2
}

interface Routine {
  id: string;
  name: string;
  warmupSeconds: number;
  techniques: Technique[];
  closingRestSeconds: number;
  paceMultiplier: number; // 0.75–1.25
}

interface SafetyCaps {
  maxHoldSeconds: number;
} // default 8 (beginner)

interface Progression {
  enabled: boolean;
  deltaSeconds: number;
  everyNSessions: number;
  targetHoldSeconds: number;
}
```

### 5.2 Compiled timeline + engine events

```ts
interface PhaseInstance {
  kind: PhaseKind;
  seconds: number;
  techniqueId: string;
  round: number;
}

type Timeline = PhaseInstance[]; // flat, after caps/pace/progression

type EngineEvent =
  | { type: "phaseStart"; index: number; phase: PhaseInstance }
  | { type: "tick"; index: number; remainingMs: number }
  | { type: "phaseEnd"; index: number }
  | { type: "roundEnd"; techniqueId: string; round: number }
  | { type: "techniqueEnd"; techniqueId: string }
  | { type: "sessionEnd"; summary: SessionSummary };
```

**Engine rules:** drive from `performance.now()` (not `setInterval` accumulation) → ±100ms over
15 min (NFR-1); `compile(routine, caps, progression)` is a **pure** function (FR-12) so it's
asserted against fixtures; controls = `start/pause/resume/skip/stop` (FR-11) — these are exactly
what the voice worker calls.

### 5.3 SQLite schema (main process; `user_id` from day one — C6/DR-2)

```sql
users(id, name, created_at)                                   -- single row in R1
techniques(id, name, default_phases_json, is_builtin)
routines(id, user_id, name, config_json, updated_at)
sessions(id, user_id, routine_id, started_at, ended_at,
         duration_s, longest_hold_s, presence_pct,
         completed, summary_json)
presence_checks(id, session_id, ts, present, confidence)      -- boolean+confidence ONLY (DR-3)
goals(id, user_id, period /* weekly|monthly */, target, active)
badges(id, code, name, description, criteria_json)
user_badges(id, user_id, badge_id, earned_at)
settings(user_id, key, value)
```

All reads/writes go through the `StorageRepository` interface (C3). R1 has one impl,
`SqliteStorageRepository`; the interface is the seam R3 swaps behind without UI changes.

### 5.4 IPC surface (preload `contextBridge`)

Keep it narrow and typed. Initial methods:
`getProfile()`, `saveRoutine(r)`, `listRoutines()`, `deleteRoutine(id)`, `saveSession(s)`,
`listSessions(range)`, `getGoals()/setGoal(g)`, `getBadges()/getEarnedBadges()`,
`getSettings()/setSetting(k,v)`, `exportAll()`, `importAll(json)`, `notify(title, body)`.

---

## 6. Phase-by-phase task breakdown

Each task lists the requirement IDs it satisfies. Phase exit criteria are the gates to advance.

### Phase 0 — Foundations

1. Scaffold pnpm workspace + Turborepo; `packages/core` (lib build) + `apps/desktop` via
   `electron-vite` (React + TS + Vite). Configure `tsconfig.base.json`, ESLint, Prettier.
2. Tailwind + Zustand + React Router; empty skeletons for the 5 screens + FirstRun
   (IR-U1). Hash router so routing works under `file://`.
3. Wire `better-sqlite3` in main; create DB on first run; migration runner (DR-8).
4. Vitest config in `core`; electron-builder config (NSIS) stub.
5. First-run flow: **medical disclaimer** + create local profile row (FR-15 partial; safety).

**Exit:** app launches on Windows, navigates between empty screens, DB file created on first run.

### Phase 1 — Timer Engine + Guided Session _(the differentiator)_

6. Implement `domain/` types (§5.1) (FR-1…FR-4, FR-7).
7. **TDD the engine:** write Vitest fixtures first for caps (FR-5), ratio mode (FR-7), pace
   multiplier (FR-9), progression (FR-6), determinism (FR-12). Then implement `compile()` +
   the monotonic-clock state machine with `start/pause/resume/skip/stop` (FR-11) and events (§5.2).
8. Seed built-in techniques + presets in `core/presets` matching the reference video: Bhastrika,
   Kapalbhati, Anulom Vilom, Bhramari, plus a guided hold/retention block; Beginner/Intermediate/
   Advanced presets with beginner hold ≤ 6–8s (FR-8).
9. **Session Player UI:** breath animation (expanding circle), phase label + countdown,
   technique/round indicator, pause/resume buttons, mic/camera status placeholders
   (IR-U2, FR-13).
10. Audio cues via WebAudio: pre-recorded inhale/hold/exhale + tones, volume + on/off (FR-14).
11. **Routine Builder:** pick techniques, set rounds & per-phase (and per-round) seconds at 0.5s
    granularity, presets, save/edit/delete custom routines; enforce max-hold cap with warning +
    explicit override (FR-2, FR-3, FR-10, FR-5).
12. Pre-session screen: full routine + estimated total time + consent toggles + disclaimer (FR-15).

**Exit:** a beginner runs a fully customized guided session start→finish with visual + audio cues;
button pause/resume works; timer accurate to ±100ms (NFR-1).

### Phase 2 — Logging, Streaks, Goals, Badges, Notifications

13. On `sessionEnd`, compute `SessionSummary` (duration, per-phase totals, longest hold) and
    persist via IPC → `saveSession` (FR-26).
14. `goals/` pure functions: `computeStreak`, `weeklyProgress`, `monthlyProgress` + tests
    (FR-27, FR-28).
15. `badges/` rules engine + seed badges (First Session, 7-Day Streak, 30-Day Streak, Held 15s,
    10 Hours Total, …); `evaluateBadges(history) → newlyEarned[]` + tests (FR-29).
16. Native notifications + in-app toast on goal completion / badge unlock (FR-30).
17. **Dashboard:** history list + Recharts (sessions/week, total minutes, longest-hold trend) +
    trophy shelf (FR-31).
18. Export/Import all data as JSON via main process (FR-32).

**Exit:** completing sessions updates streaks/goals, awards badges, fires notifications, shows on
the dashboard; all logic covered by tests (NFR-22).

### Phase 3 — Presence Monitoring _(opt-in camera)_

19. Camera consent + Settings toggle + privacy copy ("no images stored") (NFR-9, NFR-10).
20. `presence.worker.ts`: hidden `<video>`, BlazeFace/MediaPipe detection, **randomized** check
    intervals `now + uniform(30s,90s)` (configurable), output `{present, confidence}`; discard
    frame immediately (FR-16, FR-17, FR-18, DR-3).
21. Record `presence_checks`; compute presence % into the session summary (FR-19).
22. Optional gentle audio nudge + auto-pause after K consecutive absences (K configurable) (FR-20).

**Exit:** with camera on, sessions log presence %; with camera off everything works; no raw frames
persisted (FR-21, NFR-9).

### Phase 4 — Voice Control _(opt-in mic)_

23. Mic consent + Settings toggle + listening indicator (FR-24, NFR-10).
24. `voice.worker.ts`: Vosk WASM in a Web Worker with restricted grammar
    `["pause","resume","stop","[unk]"]` (FR-22).
25. Map recognized keywords → debounced calls into `TimerEngine` (`pause/resume/stop`) (FR-23).
26. Tune thresholds; keyboard/button fallback always present; verify no audio persisted
    (FR-25, FR-24).

**Exit:** saying "pause"/"resume" reliably controls a live session in a quiet room; mic can be
disabled; works offline (target ≥90% recognition, quiet room — success metric).

### Phase 5 — Hardening & Release

27. Accessibility pass: keyboard nav, captions for cues, high-contrast theme (IR-U5, NFR-24).
28. Progression engine end-to-end (auto-ramp holds across sessions) verified against history
    (FR-6).
29. QA matrix: timer drift over 15 min (NFR-1), presence accuracy across lighting (≥80% normal
    light), voice accuracy quiet vs noisy.
30. Package NSIS installer (Windows, signed if cert available); write user guide + medical
    disclaimer.

**Exit (R1 ships):** signed/packaged offline Windows app a beginner can install and use daily —
all §1 DoD boxes checked.

---

## 7. Suggested milestones

| Milestone                 | Phases | Demoable outcome                                                               |
| ------------------------- | ------ | ------------------------------------------------------------------------------ |
| **M1 — Walking skeleton** | 0      | App opens on Windows, navigates 5 empty screens, DB created                    |
| **M2 — Core loop**        | 1      | Build + run a custom adaptive session with cues; the product's reason to exist |
| **M3 — Retention loop**   | 2      | Sessions persist; streaks/goals/badges/notifications/dashboard work            |
| **M4 — Presence**         | 3      | Opt-in camera logs presence %, privacy-safe                                    |
| **M5 — Voice**            | 4      | Hands-free pause/resume offline                                                |
| **M6 — R1 GA**            | 5      | Signed Windows installer + docs; full DoD met                                  |

Order rationale (from [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md)): engine first (the
differentiator), then logging/badges (retention, zero hardware risk), then camera/voice last
(highest permission/ML/privacy risk and explicitly opt-in — the app must be fully usable without
them).

---

## 8. Testing strategy

- **Unit (Vitest, in `core`):** timeline compilation, safety caps, ratio mode, pace multiplier,
  progression, streak math, badge evaluation — all against **deterministic fixtures** (NFR-22).
- **Integration:** session persistence round-trip (renderer → IPC → SQLite → read back);
  JSON export → wipe → import equality.
- **Manual/QA (Phase 5):** timer drift over a 15-min session; presence accuracy across lighting;
  voice accuracy in quiet/noisy rooms; keyboard-only walkthrough.
- **Smoke (optional):** Playwright-Electron launch + navigate + start/stop a short session.

Every test references the requirement ID it verifies (SRS §8.2 traceability).

---

## 9. Requirement traceability (R1)

| Area                                      | SRS IDs                                         | Phase   |
| ----------------------------------------- | ----------------------------------------------- | ------- |
| Timer engine & customization              | FR-1…FR-12                                      | 1       |
| Guidance & cues                           | FR-13…FR-15                                     | 1       |
| Presence (opt-in)                         | FR-16…FR-21                                     | 3       |
| Voice (opt-in)                            | FR-22…FR-25                                     | 4       |
| Activity / goals / badges / notifications | FR-26…FR-32                                     | 2       |
| Data model                                | DR-1…DR-4, DR-8                                 | 0–2     |
| Interfaces                                | IR-U1, IR-U2, IR-U5, IR-H1, IR-H2, IR-S1, IR-S2 | 0–5     |
| Performance                               | NFR-1, NFR-2                                    | 1, 3, 4 |
| Privacy                                   | NFR-9, NFR-10, NFR-12                           | 3, 4    |
| Maintainability / reuse                   | NFR-20, NFR-21, NFR-22                          | all     |
| Usability / accessibility                 | NFR-23, NFR-24                                  | 5       |

> R2/R3 IDs (FR-33…FR-47, NFR-3…NFR-8, NFR-13…NFR-19, CR-1…CR-6, DR-5…DR-7) are intentionally
> not in POC 1.

---

## 10. Risks (R1-specific) & mitigations

| Risk                                             | Mitigation                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Timer drift breaks ±100ms goal                   | Monotonic `performance.now()`, not interval accumulation; drift test in QA                 |
| Offline voice accuracy                           | Vosk**restricted grammar**; debounce; keyboard/button fallback always present              |
| Presence false negatives (lighting, closed eyes) | Detect presence not gaze; tunable threshold; presence is informational, never blocks       |
| Unsafe breath holds                              | Hard max-hold cap + warning + explicit override + medical disclaimer + "stop if dizzy" cue |
| Camera/mic privacy concerns                      | Opt-in per session; local-only; no media stored; transparent indicators                    |
| Core accidentally couples to Electron/DOM        | Lint rule / review gate:`packages/core` has no platform imports; keeps R2/R3 cheap         |
| ML stutters UI                                   | Presence/voice in Web Workers off the main thread (NFR-2)                                  |

---

## 11. Pre-build checklist (resolve before Phase 0)

- [ ] Confirm final app name (placeholder **PranaCoach** / repo **Prana**) — affects installer,
      window title, branding.
- [ ] Confirm stack: Electron + Capacitor path (vs Flutter/RN) — only Electron matters for R1.
- [ ] Acquire/record audio cue clips (inhale/hold/exhale + tones), or generate tones in WebAudio
      for M2 and swap real clips later.
- [ ] Choose Vosk small-en model + MediaPipe/BlazeFace model files; confirm licenses for bundling.
- [ ] Windows code-signing certificate available? (else ship unsigned for internal POC).

---

### Companion documents

- [PRD.md](../PRD.md) — product requirements & release strategy
- [SRS.md](../SRS.md) — formal, testable requirements (IDs referenced above)
- [ARCHITECTURE.md](../ARCHITECTURE.md) — system design & module specs
- [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) — full R1→R2→R3 build order
- [convo/CONVERSATION_LOG.md](../convo/CONVERSATION_LOG.md) — planning transcript
