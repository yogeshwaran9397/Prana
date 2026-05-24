# Implementation Plan — PranaCoach

> Step-by-step build order. Accompanies `PRD.md`, `SRS.md`, and `ARCHITECTURE.md`.
> Strategy: **build the offline desktop MVP in vertical slices** (R1), then **add mobile** by
> reusing the shared core (R2), then **add cloud + auth** for 50k+ users (R3). Camera & voice
> are opt-in modules added after the core loop works.

- **Status:** Draft v0.2
- **Date:** 2026-05-24

### Release map
- **R1 — Desktop, offline, no-auth:** Phases 0–5 below.
- **R2 — Desktop + Android + iOS, offline, no-auth:** Phase 6 (Mobile).
- **R3 — Cloud + Auth + 50k users:** Phases 7–9.

> **Build for reuse from day one:** put domain, TimerEngine, goals/badges, and the
> `StorageRepository` interface in a **shared TS package** (not inside the Electron app) so R2
> and R3 reuse it untouched.

---

## Phase 0 — Project setup (Foundations) — R1
1. Create a **monorepo**: `packages/core` (shared TS — domain, TimerEngine, repositories),
   `apps/desktop` (Electron), later `apps/mobile` (Capacitor). Scaffold desktop with
   Electron + React + TypeScript + Vite (e.g., `electron-vite`).
2. Add Tailwind, state lib (Zustand), router, and a component skeleton for 5 screens:
   Home, Routine Builder, Session Player, Dashboard, Settings.
3. Wire `better-sqlite3` in the main process; create DB on first run; add migrations.
4. Set up testing (Vitest) + linting + electron-builder packaging config.
5. First-run flow: **medical disclaimer** + create local profile row.

**Exit criteria:** App launches on Windows, navigates between empty screens, DB file created.

## Phase 1 — Timer Engine + Guided Session (the core, no camera/voice yet)
6. Implement domain types (`Phase`, `Technique`, `Routine`, `SafetyCaps`, `Progression`).
7. Build the **Timer Engine** state machine (pure TS): timeline compilation + monotonic
   clock + events + `pause/resume/skip/stop`. **Write unit tests first** for caps, ratio
   mode, pace multiplier, progression.
8. Seed **built-in techniques** matching the reference video style: e.g., Bhastrika,
   Kapalbhati, Anulom Vilom (alternate nostril), Bhramari, plus a guided hold/retention
   block. Beginner defaults: hold ≤ 6–8s.
9. Build **Session Player UI**: breathing animation (expanding circle), phase label,
   countdown, round/technique indicator, pause/resume buttons.
10. Add **audio cues** (pre-recorded "inhale/hold/exhale" + tones) via WebAudio; volume/on-off.
11. Build **Routine Builder**: pick techniques, set rounds & per-phase seconds, presets
    (Beginner/Intermediate/Advanced), save custom routines. Enforce safety cap with warning.

**Exit criteria:** A beginner can run a fully customized, guided session start→finish with
visual + audio cues; pause/resume via buttons works; timer accurate.

## Phase 2 — Logging, Streaks, Goals, Badges, Notifications
12. On `sessionEnd`, compute summary (duration, per-phase totals, longest hold) and **persist** the session.
13. Implement **streak** + **weekly/monthly goal** logic (pure functions + tests).
14. Implement **badge rules engine** + seed badges (First Session, 7-Day Streak, 30-Day
    Streak, Held 15s, 10 Hours Total, etc.).
15. Wire **desktop notifications** + in-app toasts for goal completion & badge unlock.
16. Build **Dashboard**: history list + charts (sessions/week, total minutes, hold trend) + trophy shelf.
17. **Export/Import** all data as JSON.

**Exit criteria:** Completing sessions updates streaks/goals, awards badges, fires
notifications, and shows on the dashboard. All logic covered by tests.

## Phase 3 — Presence Monitoring (opt-in camera module)
18. Add camera consent + Settings toggle + privacy copy ("no images stored").
19. Implement **Presence Worker**: hidden `<video>`, BlazeFace/MediaPipe face detection,
    **randomized check intervals** (e.g., 30–90s), output present/absent + confidence.
20. Record `presence_checks`, compute **presence %** into the session summary.
21. Optional: gentle audio nudge + **auto-pause** after K consecutive absences (configurable).

**Exit criteria:** With camera on, sessions log presence %; with camera off, everything still
works; no raw frames persisted.

## Phase 4 — Voice Control (opt-in mic module)
22. Add mic consent + Settings toggle + listening indicator.
23. Integrate **Vosk WASM** in a Web Worker with a **restricted grammar** = `pause`, `resume`
    (+ `stop`, `next` optional).
24. Map recognized keywords → debounced calls into the Timer Engine (`pause/resume/stop`).
25. Tune thresholds; add keyboard fallback; verify no audio persisted.

**Exit criteria:** Saying "pause"/"resume" reliably controls a live session in a quiet room;
mic can be disabled; works offline.

## Phase 5 — Hardening & Release (R1 / Desktop MVP done)
26. Accessibility pass (keyboard nav, captions, high-contrast theme).
27. Progression engine end-to-end (auto-ramp holds across sessions).
28. QA: timer drift over 15 min, presence accuracy across lighting, voice accuracy.
29. Package installers (Win first) with electron-builder; write user guide + disclaimer.

**Exit criteria (R1 ships):** Signed/packaged offline desktop app a beginner can install and use daily.

---

## Phase 6 — Mobile (R2 / Desktop + Android + iOS, still offline, no-auth)
30. Add `apps/mobile` using **Capacitor** (Ionic), consuming the **same `packages/core`** and
    the shared React UI; make the UI responsive/touch-first.
31. Implement mobile **platform adapters** behind the existing interfaces: SQLite
    (Capacitor SQLite plugin), camera, microphone, local notifications.
32. Bridge **on-device ML** on mobile: Vosk (Android/iOS builds) for voice; MediaPipe for
    presence (web view or native bridge). Keep the restricted grammar.
33. Handle mobile lifecycle: background/foreground, audio focus/interruptions, permission prompts.
34. QA on real Android 9+ and iOS 15+ devices; build store artifacts (Android Studio / Xcode).

**Exit criteria (R2 ships):** All R1 features work offline on Android + iOS with no account;
≥~80% of logic reused from `packages/core`.

---

## Phase 7 — Cloud Backend + Auth (R3 foundation)
35. Stand up backend (Node NestJS/Fastify or **FastAPI**) + **managed Postgres** mirroring the
    shared domain: `/auth`, `/routines`, `/sessions`, `/presence`, `/goals`, `/badges`,
    `/activity`, `/account`.
36. Implement **authN**: email+password (argon2id) + OAuth (Google/Apple), email verification,
    password reset, JWT access + rotating refresh tokens, rate-limited auth endpoints.
37. Implement **authZ**: authenticate every request; enforce **row-level per-user isolation**;
    roles `user`/`admin`.
38. Build auth/account UI screens (sign-up, sign-in, verify, reset, profile, export, **delete account**).

## Phase 8 — Sync & Activity (R3)
39. Implement `SyncingStorageRepository` = local SQLite cache + API client + **outbox/sync
    queue**, swapped in behind the unchanged `StorageRepository` interface (UI untouched).
40. Conflict handling: additive logs merge; mutable records last-write-wins by `updated_at`;
    idempotent, retry-safe requests.
41. **Activity ingestion** (async/batched) → analytics read replica; operator dashboards
    (engagement/retention), privacy-respecting + consented.
42. Data export & account deletion server-side (GDPR/DPDP).

## Phase 9 — Scale, Security & GA (R3, 50k+ users)
43. Make API tier **stateless + autoscaled** (≥2 instances) behind a load balancer; static
    assets/audio/ML models on **object storage + CDN**; add **Redis** for cache/rate-limit (designed-for).
44. Observability: centralized logs, metrics, alerts; CI/CD with rollback; backups + tested restore.
45. **Security review / pen-test** (OWASP Top 10); secrets manager.
46. **Load-test to 50k users / target peak concurrency**; confirm p95 < 300ms and 99.9% availability.

**Exit criteria (R3 ships):** Secure accounts; cross-device sync verified on two devices;
export/delete work; load test sustains 50k-user target within SLOs; security review clean.

---

## Suggested build order rationale
- **Engine + session loop first** — the customizable timer is the product's reason to exist.
- **Logging/badges next** delivers the retention loop with zero hardware/permission risk.
- **Camera and voice last among R1 modules** — highest-risk (permissions, ML, privacy) and
  explicitly *opt-in*; the app must be fully usable without them.
- **Mobile (R2) before cloud** because the shared core makes mobile cheap, and a proven local
  product de-risks the backend work.
- **Cloud last (R3)** so the offline product is validated first; the `StorageRepository` seam
  makes the switch additive, not a rewrite.

## Definition of Done
- **R1:** beginner completes a guided, voice-controllable, presence-logged session fully
  offline; sessions persist; streaks/goals/badges + notifications work; data exportable;
  Windows installer available.
- **R2:** same, on Android + iOS, offline, no account.
- **R3:** secure auth + authZ; cloud-stored profile/activity; cross-device sync; export/delete;
  sustains 50k+ users within latency/availability SLOs.
