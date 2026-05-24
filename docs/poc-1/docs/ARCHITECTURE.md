# Software Engineering Architecture (SEA) — PranaCoach

> Technical design / spec to accompany `PRD.md` and `SRS.md`. Covers the 3-release model:
> **R1 Desktop (offline, no-auth) → R2 Desktop + Mobile (offline, no-auth) → R3 Cloud + Auth
> (50k+ users)**.

- **Status:** Draft v0.2
- **Date:** 2026-05-24

---

## 1. Architectural Drivers (from PRD/SRS)

1. **Offline-first, no-auth for R1 & R2; cloud + auth + multi-user for R3** → keep data access
   behind a `StorageRepository` interface so the backend swaps (local ⇄ cloud) without UI change.
2. **One codebase across desktop + mobile** → a **shared TypeScript core** (domain, timer
   engine, repositories) + a single web UI, packaged for desktop and mobile.
3. **On-device ML** for presence (webcam) and voice (mic), in **all** releases → local
   inference, no media stored or sent.
4. **Highly accurate, highly customizable timer** → a deterministic state-machine engine,
   decoupled from UI and cues.
5. **R3 at 50k+ users** → stateless, horizontally-scalable API + managed Postgres; clients stay
   offline-capable with a sync queue.

## 2. Cross-Platform Strategy (R1 → R2)

The same web/TS app ships to every target; only thin platform adapters differ.

```
                ┌─────────────────────────────────────────────┐
                │  Shared TypeScript core (no platform deps)  │
                │  domain · TimerEngine · Goals/Badges ·       │
                │  StorageRepository interface · sync logic    │
                └───────────────┬─────────────────┬───────────┘
        React UI (shared) ──────┤                 ├────── React UI (shared)
                ┌───────────────▼──────┐   ┌──────▼────────────────┐
                │ Electron (desktop)   │   │ Capacitor (Android/iOS)│
                │ better-sqlite3, OS   │   │ SQLite plugin, native  │
                │ notifications        │   │ camera/mic/notif.      │
                └──────────────────────┘   └────────────────────────┘
```

Platform-specific concerns (storage, camera, mic, notifications) sit behind adapter
interfaces; the core and UI never call a platform API directly.

> **Stack alternatives** (adjustable): **React Native** for mobile (more native feel, less UI
> reuse with Electron), **Flutter** (one codebase, but the TS timer core is not reused and ML
> plugins differ), or **Tauri 2** (desktop+mobile from one Rust shell, but ML integration is
> harder). Recommended path below maximizes reuse and ML availability.

## 3. Recommended Technology Stack

| Concern               | R1 (Desktop)                                                                    | R2 (+ Mobile)                        | Why                                                                                                |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **App core**          | Shared **TypeScript** module                                                    | same                                 | Deterministic, unit-testable, reused everywhere.                                                   |
| **UI**                | **React** + Vite + Tailwind                                                     | same (responsive/touch)              | One component set for all targets.                                                                 |
| **State**             | Zustand / Redux Toolkit                                                         | same                                 | Predictable session/timer state.                                                                   |
| **Desktop shell**     | **Electron**                                                                    | —                                    | Mature, native notifications, broad ML ecosystem.                                                  |
| **Mobile shell**      | —                                                                               | **Capacitor** (Ionic)                | Wraps the same web app into iOS/Android with native plugins.                                       |
| **Local DB**          | **SQLite** (`better-sqlite3`)                                                   | **SQLite** (Capacitor SQLite plugin) | Same logical schema everywhere; → Postgres server-side in R3.                                      |
| **Presence (vision)** | **MediaPipe / TF.js BlazeFace** (renderer)                                      | MediaPipe (web view / native bridge) | Offline, lightweight; no image leaves device.                                                      |
| **Voice (offline)**   | **Vosk** (small model) + restricted grammar `["pause","resume","stop","[unk]"]` | Vosk (Android/iOS builds)            | True offline keyword spotting; restricted grammar boosts accuracy. Runs in a worker/native thread. |
| **Audio cues**        | Pre-recorded clips + WebAudio                                                   | same                                 | Simple, reliable, localizable.                                                                     |
| **Notifications**     | Electron `Notification`                                                         | Capacitor Local Notifications        | Native toasts per platform.                                                                        |
| **Charts**            | Recharts / Chart.js                                                             | same                                 | Dashboard trends.                                                                                  |
| **Packaging**         | electron-builder                                                                | Capacitor → Xcode / Android Studio   | Installers / store builds.                                                                         |

> **Why not Web Speech API for voice?** It routes audio to the cloud in Chromium and is
> unreliable offline — violates the offline-first/privacy drivers. Vosk stays local on every platform.

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Electron App                                                       │
│                                                                    │
│  ┌───────────────── Renderer (React UI) ──────────────────────┐   │
│  │  Screens: Home · Routine Builder · Session Player ·         │   │
│  │           Dashboard · Settings                              │   │
│  │                                                             │   │
│  │  ┌── Timer Engine (TS state machine) ──┐                    │   │
│  │  │  emits phase events → UI + cues      │                    │   │
│  │  └──────────────────────────────────────┘                   │   │
│  │                                                             │   │
│  │  ┌── Presence Worker ──┐   ┌── Voice Worker ──┐             │   │
│  │  │ webcam → face model │   │ mic → Vosk (WASM)│             │   │
│  │  │ → present/absent     │   │ → "pause"/"resume"│            │   │
│  │  └──────────────────────┘   └──────────────────┘            │   │
│  └─────────────────────────────┬───────────────────────────────┘   │
│                                 │ IPC                               │
│  ┌──────────────── Main process ▼ ──────────────────────────────┐  │
│  │  Persistence (SQLite) · Notifications · File export/import ·  │  │
│  │  Goals/Badges engine · App lifecycle                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
   (Phase 3) Persistence layer talks to Cloud API instead of/alongside SQLite
```

## 4. Core Modules

### 4.1 Timer Engine (the differentiator)

A framework-agnostic finite state machine.

**Domain model:**

```ts
type PhaseKind = "inhale" | "hold_in" | "exhale" | "hold_out" | "rest";

interface Phase {
  kind: PhaseKind;
  seconds: number;
} // seconds can be 0 (skipped)

interface Technique {
  id: string;
  name: string; // e.g., "Anulom Vilom", "Bhramari", "Kapalbhati"
  rounds: number;
  phases: Phase[]; // one round's phase sequence
  ratio?: { unit: number; pattern: number[] }; // optional ratio mode (e.g. 1:4:2)
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
} // default 8 for beginners

interface Progression {
  // optional auto-ramp
  enabled: boolean;
  deltaSeconds: number;
  everyNSessions: number;
  targetHoldSeconds: number;
}
```

**Behavior:**

- Compiles a `Routine` into a flat **timeline** of phase instances (applying pace multiplier,
  safety caps, and progression).
- Drives via a monotonic clock (`performance.now()`), not `setInterval` accumulation, for ±100ms accuracy.
- Emits events: `phaseStart`, `tick`, `phaseEnd`, `roundEnd`, `techniqueEnd`, `sessionEnd`.
- Supports `pause()`, `resume()`, `skip()`, `stop()` — these are what voice commands call.
- **Pure & unit-testable**: given a routine + caps, asserting the produced timeline is deterministic.

### 4.2 Presence Worker

- Pulls a frame from a hidden `<video>` at **randomized intervals** (e.g., next check at
  `now + uniform(30s, 90s)`).
- Runs face/person detection (BlazeFace/MediaPipe) → `{present: boolean, confidence}`.
- Posts result to session state; **discards the frame** immediately (no persistence).
- After K consecutive `absent`, optionally fires `auto-pause` + audio nudge.

### 4.3 Voice Worker

- Captures mic via `getUserMedia`, streams to **Vosk WASM** in a Web Worker with a
  **restricted recognizer grammar** of just the command words.
- On recognized keyword → debounce → dispatch `pause`/`resume` to the timer engine.
- Never persists audio. Mic indicator reflects listening state.

### 4.4 Persistence (main process)

SQLite tables (designed to extend to multi-user — note the `user_id` column, defaulted to a
local profile in MVP):

```
users(id, name, created_at)                              -- single row in MVP
techniques(id, name, default_phases_json, is_builtin)
routines(id, user_id, name, config_json, updated_at)
sessions(id, user_id, routine_id, started_at, ended_at,
         duration_s, longest_hold_s, presence_pct,
         completed, summary_json)
presence_checks(id, session_id, ts, present, confidence)
goals(id, user_id, period ENUM(weekly,monthly), target, active)
badges(id, code, name, description, criteria_json)
user_badges(id, user_id, badge_id, earned_at)
settings(user_id, key, value)
```

All reads/writes go through a **`StorageRepository` interface**. MVP impl = SQLite; Phase 3
impl = `ApiStorageRepository` calling the cloud — UI is unaware which is active.

### 4.5 Goals & Badges Engine

- Pure functions over session history: `computeStreak()`, `weeklyProgress()`, `monthlyProgress()`,
  `evaluateBadges(history) → newlyEarned[]`.
- Runs after each `sessionEnd`; newly earned badges + completed goals → notifications.

### 4.6 Notifications

- Electron `Notification` for goal/badge events; in-app toast mirror.

## 5. Key Flows

**Session flow:**
`Select routine → Pre-session (consent: camera/mic, disclaimer) → Compile timeline →
Start engine → (loop) emit phase → animate + cue; Presence checks at random ts; Voice listens →
pause/resume → … → sessionEnd → compute summary → persist → evaluate goals/badges → notify → summary screen.`

**Voice pause:** `mic frame → Vosk → "pause" → debounce → engine.pause() → UI shows paused → "resume" → engine.resume()`.

## 6. Privacy & Safety (cross-cutting)

- Camera/mic **opt-in** per session; toggles in Settings.
- **No raw media stored** — only derived booleans/confidence.
- First-run **medical disclaimer**; persistent "stop if dizzy / breathe normally" reminder.
- Data export/import as plain JSON; user owns the local DB file.

## 7. Cloud Architecture (R3 — Auth + Cloud + 50k+ users)

### 7.1 Topology

```
 Clients (Electron / iOS / Android)
        │  HTTPS (TLS), JWT access + refresh tokens
        ▼
 ┌──────────────┐   ┌──────────────────────────────────────┐
 │ Load Balancer│──▶│ Stateless API tier (≥2 instances,     │
 │  / CDN edge  │   │ autoscaled containers)                │
 └──────────────┘   │  Auth · Routines · Sessions · Goals · │
        │           │  Badges · Sync · Activity ingest      │
        │           └───────┬───────────────┬───────────────┘
   static assets,           │               │
   audio cues, ML      ┌────▼─────┐    ┌─────▼──────┐
   models (CDN +       │ Postgres │    │  Redis     │ (cache, rate-limit,
   object storage)     │ (managed,│    │ optional   │  sessions)
                       │ +replica)│    └────────────┘
                       └────┬─────┘
                            │ async
                       ┌────▼───────────────┐
                       │ Activity/analytics  │ (batch ingest → reporting,
                       │ pipeline (queue +   │  read replica)
                       │ aggregation jobs)   │
                       └─────────────────────┘
```

### 7.2 Components

- **Backend:** Node (NestJS/Fastify) or Python (FastAPI) exposing the same domain the client
  already uses: `/auth`, `/routines`, `/sessions`, `/presence`, `/goals`, `/badges`, `/activity`, `/account`.
- **AuthN:** email+password (argon2id hashes) + OAuth (Google/Apple); short-lived JWT access
  tokens + rotating refresh tokens; rate-limited auth endpoints.
- **AuthZ:** every request authenticated; **row-level per-user isolation** enforced server-side;
  roles `user`/`admin` (admin = ops/aggregate only).
- **DB:** managed **Postgres**, same logical schema as the local SQLite (the `user_id` columns
  were there since R1) + a **read replica** for analytics. Automated daily backups.
- **Cache/queue (designed-for, optional at 50k):** Redis for caching + rate limiting; a queue
  for async activity ingestion so analytics never blocks practice.
- **Static/CDN:** object storage + CDN for audio cues and ML model files.

### 7.3 Client changes (additive, not a rewrite)

- Swap `SqliteStorageRepository` → `SyncingStorageRepository` = local SQLite cache **+** API
  client **+** an outbox/sync queue. UI is unaware which repository is active.
- **Sync:** offline-first; additive logs (sessions, presence, badges) merge; mutable records
  (routines, settings) resolve last-write-wins by `updated_at`; requests idempotent + retry-safe.
- **ML (presence/voice) stays on-device** — never uploaded (privacy + latency + offline).

### 7.4 Scale notes (50k users)

- Load is small, bursty, small-payload (≈1 session write + a few presence rows per practice).
- A **stateless API + managed Postgres (+ optional Redis/queue)** comfortably serves 50k
  registered users (~15% DAU, low-hundreds peak concurrency); scale by adding API instances.
- The hard work is **correctness, security, sync, and operability**, not raw throughput.
- **Load-test to 50k / target peak** before GA; confirm p95 < 300ms and 99.9% availability.
- See `SRS.md` §7 for capacity assumptions and derived requirements (CR-1…CR-6).

## 8. Testing Strategy

- **Unit:** timer timeline compilation, safety caps, progression, streak/badge logic (deterministic fixtures).
- **Integration:** session persistence round-trip; export/import.
- **Manual/QA:** presence accuracy across lighting; voice accuracy in quiet/noisy rooms; timer drift over a 15-min session.

## 9. Open Decisions

- Electron vs Tauri (recommend Electron for ML ecosystem).
- Vosk in-renderer WASM vs Python sidecar (recommend WASM worker to keep single-runtime).
- ORM yes/no for SQLite (optional; `better-sqlite3` raw is fine for MVP).
