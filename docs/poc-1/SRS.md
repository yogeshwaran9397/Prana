# Software Requirements Specification (SRS) — POC 1 (R1 Desktop MVP)

> Formal, testable requirements for **POC 1 = Release R1** only: the offline, no-auth,
> Windows-first desktop application. Derived from [`PRD.md`](../PRD.md) and refined from the
> all-release [`SRS.md`](../SRS.md) into a granular R1 specification. Companion to
> [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) (build plan) and [`ARCHITECTURE.md`](../ARCHITECTURE.md)
> (design).

- **Status:** Draft v1.0
- **Date:** 2026-05-24
- **Owner:** yogesh@grlps.com
- **Scope tag:** Every requirement here is **[R1]**. R2 (mobile) and R3 (cloud/auth) are out of scope.
- **Requirement ID scheme (POC-1-local):** `PFR-*` functional, `PNFR-*` non-functional,
  `PDR-*` data, `PIR-*` interface, `PCN-*` constraint. Each maps back to a parent `FR/NFR/DR/IR`
  in [`SRS.md`](../SRS.md) via the **Traces to** column for cross-release traceability.

---

## 1. Introduction

### 1.1 Purpose

Specify the complete, testable requirements for the first proof-of-concept of PranaCoach: a
guided pranayama desktop app whose core value is a **fully customizable, adaptive breath-timer**
that beginners can actually keep up with, plus **opt-in** on-device presence monitoring and voice
control, and offline activity/streak/goal/badge tracking. This document is the contract against
which POC 1 is built and accepted.

### 1.2 Scope

- **In scope:** breath-timer engine; guided sessions with visual + audio cues; opt-in camera
  presence; opt-in offline voice control; session logging, streaks, weekly/monthly goals, badges,
  native notifications, dashboard; JSON export/import; first-run disclaimer; single local profile.
- **Out of scope:** accounts/authentication/authorization; cloud storage, sync, analytics; mobile
  (Android/iOS); social/leaderboard features; medical diagnosis or clinical claims; any network
  dependency for core function.

### 1.3 Definitions

| Term               | Meaning                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| **Pranayama**      | Yogic breathing practice.                                                             |
| **Phase**          | A timed breath segment: `inhale`, `hold_in`, `exhale`, `hold_out`, or `rest`.         |
| **Kumbhaka**       | Breath retention: hold-in = _antara_, hold-out = _bahya_.                             |
| **Technique**      | A named pattern of phases × rounds (e.g., Anulom Vilom).                              |
| **Routine**        | Warmup + ordered techniques + closing rest = one session plan.                        |
| **Timeline**       | The flat, ordered list of phase instances the engine compiles a routine into.         |
| **Safety cap**     | Configurable maximum hold duration (default 8s) no phase may exceed without override. |
| **Progression**    | Optional auto-increase of hold duration over completed sessions.                      |
| **Presence check** | A randomized on-device camera sample → present/absent + confidence.                   |
| **Streak**         | Count of consecutive calendar days with ≥1 completed session.                         |
| **Badge**          | A rule-based achievement award.                                                       |
| **Profile**        | The single local user row in R1 (carries `user_id` for R3-readiness).                 |

### 1.4 References

- [`PRD.md`](../PRD.md), [`SRS.md`](../SRS.md) (all-release), [`ARCHITECTURE.md`](../ARCHITECTURE.md),
  [`IMPLEMENTATION.md`](./IMPLEMENTATION.md)
- Reference video: https://www.youtube.com/watch?v=I77hh5I69gA

### 1.5 Overview

§2 overall description & constraints; §3 external interfaces; §4 functional requirements
(timer, cues, presence, voice, activity); §5 data requirements; §6 non-functional requirements;
§7 acceptance criteria; §8 traceability matrix.

---

## 2. Overall Description

### 2.1 Product perspective

A new, self-contained desktop client. **All data is local** (on-device SQLite); there is **no
backend** in POC 1. On-device ML (presence/voice) runs locally and is the only "intelligence" in
the system. The data model and storage seam are built R3-ready (a `user_id` on every user-owned
row; all I/O behind a `StorageRepository` interface) so the later cloud move is additive.

### 2.2 Product functions (high level)

Customizable timed breathing sessions → guidance cues → (optional) presence logging → (optional)
voice control → session persistence → streak/goal/badge computation → notifications + dashboard →
export/import.

### 2.3 User classes

- **Practitioner (Beginner):** primary persona "Beginner Bharat" — cannot hold breath past ~8s,
  needs adaptive timing and encouragement.
- **Practitioner (Returning):** persona "Consistent Priya" — wants progression, streaks, goals,
  badges.
- _(No operator/admin/authenticated classes in POC 1.)_

### 2.4 Operating environment

- **Primary:** Windows 10/11 (x64), Electron desktop shell.
- **Best-effort (untested for POC 1):** macOS 12+, modern Linux.
- **Hardware:** standard webcam (optional, for presence) and microphone (optional, for voice).
- **Network:** **not required** for any function.

### 2.5 Design & implementation constraints

| ID        | Constraint                                                                                                                | Traces to |
| --------- | ------------------------------------------------------------------------------------------------------------------------- | --------- |
| **PCN-1** | Must function with **no account and no network**.                                                                         | C1        |
| **PCN-2** | Domain + timer engine + repository **interface** live in a shared TS core with **no Electron/DOM imports** (R2/R3 reuse). | C2        |
| **PCN-3** | All persistence accessed only via the `StorageRepository` interface.                                                      | C3        |
| **PCN-4** | **No raw camera/microphone media** is ever persisted or transmitted.                                                      | C4        |
| **PCN-5** | Breath-hold durations are bounded by a configurable safety ceiling.                                                       | C5        |
| **PCN-6** | Every user-owned row carries `user_id` from R1 (single local profile).                                                    | C6        |
| **PCN-7** | TypeScript strict mode; core logic covered by automated unit tests.                                                       | NFR-22    |

### 2.6 Assumptions & dependencies

- Device has a working webcam/mic **only if** the user opts into presence/voice.
- Offline ML libraries (Vosk WASM small-en model; MediaPipe/TF.js BlazeFace) are bundled and
  licensed for redistribution.
- Pre-recorded audio cue clips exist (or tones are synthesized) at build time.
- A single local profile is auto-created on first run; multi-profile is out of scope.

---

## 3. External Interface Requirements

### 3.1 User interfaces

| ID         | Requirement                                                                                                                                                                | Traces to |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **PIR-U1** | Provide screens: **Home**, **Routine Builder**, **Session Player**, **Dashboard**, **Settings**, and a **First-run disclaimer/consent** screen.                            | IR-U1     |
| **PIR-U2** | The Session Player shall display: breath animation, current phase label + countdown, technique/round indicator, pause/resume controls, and mic & camera status indicators. | IR-U2     |
| **PIR-U3** | All primary flows shall be **keyboard-operable**; audio cues shall have on-screen **captions**; a **high-contrast** theme shall be selectable.                             | IR-U5     |
| **PIR-U4** | The app shall present an **estimated total session time** before starting.                                                                                                 | FR-15     |

### 3.2 Hardware interfaces

| ID         | Requirement                                                                                                    | Traces to |
| ---------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| **PIR-H1** | Optionally access a webcam (presence) and microphone (voice) via OS/runtime APIs, only after explicit consent. | IR-H1     |
| **PIR-H2** | Raise **native desktop notifications** (Electron `Notification`).                                              | IR-H2     |

### 3.3 Software interfaces

| ID         | Requirement                                                                                                                               | Traces to     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **PIR-S1** | Persist locally in **SQLite** via `better-sqlite3` in the Electron main process.                                                          | IR-S1         |
| **PIR-S2** | Run on-device ML: **Vosk** (voice) and **MediaPipe/BlazeFace** (vision), each off the UI thread.                                          | IR-S2         |
| **PIR-S3** | Expose a narrow, typed **IPC surface** (preload `contextBridge`) between renderer and main; `nodeIntegration` off, `contextIsolation` on. | — (R1 design) |

---

## 4. Functional Requirements

### 4.1 Breath Timer Engine — "max customization"

| ID         | Requirement                                                                                                                                               | Traces to   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **PFR-1**  | Represent a technique as an ordered list of phases (`inhale`, `hold_in`, `exhale`, `hold_out`, `rest`); any phase may have duration 0 (skipped).          | FR-1        |
| **PFR-2**  | Allow each phase duration to be set independently in seconds with **0.5s granularity**.                                                                   | FR-2        |
| **PFR-3**  | Allow **per-round** override of phase durations within a technique.                                                                                       | FR-3        |
| **PFR-4**  | Allow configuring the **number of rounds** per technique.                                                                                                 | FR-4        |
| **PFR-5**  | Enforce a configurable **maximum-hold ceiling (default 8s)**; any attempt to exceed it shall require explicit user override and display a safety warning. | FR-5        |
| **PFR-6**  | Support an optional **progression** rule: increase hold by N seconds every M completed sessions, never exceeding a user target.                           | FR-6        |
| **PFR-7**  | Support **ratio mode** (e.g., 1:4:2 with a base unit) deriving phase durations, respecting PFR-5.                                                         | FR-7        |
| **PFR-8**  | Provide **Beginner / Intermediate / Advanced** presets and allow saving user-defined presets; Beginner hold default ≤ 6–8s.                               | FR-8        |
| **PFR-9**  | Apply a live **pace multiplier (0.75×–1.25×)** to all durations.                                                                                          | FR-9        |
| **PFR-10** | Compose a **routine** = warmup + ordered techniques + closing rest, and allow create / edit / save / delete of routines.                                  | FR-10       |
| **PFR-11** | Drive the timer via `start / pause / resume / skip / stop`.                                                                                               | FR-11       |
| **PFR-12** | Timeline computation shall be **deterministic** for a given routine + caps + progression (pure function, unit-tested).                                    | FR-12       |
| **PFR-13** | Drive timing from a **monotonic clock** (`performance.now()`), not interval accumulation, to meet the ±100ms accuracy NFR.                                | NFR-1       |
| **PFR-14** | Emit lifecycle events: `phaseStart`, `tick`, `phaseEnd`, `roundEnd`, `techniqueEnd`, `sessionEnd`.                                                        | FR-11/FR-26 |

### 4.2 Guidance & Cues

| ID         | Requirement                                                                                                             | Traces to   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ----------- |
| **PFR-15** | Display a **breath animation** synchronized to the active phase (e.g., expanding/contracting circle).                   | FR-13       |
| **PFR-16** | Play configurable **audio cues** (voice prompts and/or tones) with **volume** and **on/off** control.                   | FR-14       |
| **PFR-17** | Before a session, show the **full routine, estimated total time, camera/mic consent toggles, and a safety disclaimer**. | FR-15       |
| **PFR-18** | Show, during the session, the **current phase + countdown** and **technique/round** position.                           | FR-13/IR-U2 |

### 4.3 Presence Monitoring _(opt-in camera)_

| ID         | Requirement                                                                                                                                          | Traces to    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **PFR-19** | When enabled, capture a camera frame at **randomized intervals** (configurable mean within a min–max window, e.g., 30–90s) during an active session. | FR-16        |
| **PFR-20** | Run **on-device** detection producing `{ present: boolean, confidence: number }`.                                                                    | FR-17        |
| **PFR-21** | Persist **only** the boolean + confidence + timestamp per check; **never** persist the frame.                                                        | FR-18, PCN-4 |
| **PFR-22** | Compute and store **presence %** for the session.                                                                                                    | FR-19        |
| **PFR-23** | Optionally **auto-pause** and/or play a gentle nudge after **K consecutive absent** checks (K configurable).                                         | FR-20        |
| **PFR-24** | All features **except presence** shall remain fully functional with the **camera disabled**.                                                         | FR-21        |

### 4.4 Voice Control _(opt-in microphone)_

| ID         | Requirement                                                                                                                                                           | Traces to    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **PFR-25** | When enabled, perform **offline** keyword recognition for at least **"pause"** and **"resume"** (extensible to "stop"/"next"), using a restricted recognizer grammar. | FR-22        |
| **PFR-26** | Recognized commands shall invoke the corresponding timer action, **debounced** to prevent duplicate triggers.                                                         | FR-23        |
| **PFR-27** | Display a **listening indicator**; **never** persist any audio.                                                                                                       | FR-24, PCN-4 |
| **PFR-28** | Provide **keyboard/button controls** with equivalent functionality as a fallback.                                                                                     | FR-25        |

### 4.5 Activity, Goals, Badges, Notifications

| ID         | Requirement                                                                                                                                                 | Traces to |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **PFR-29** | On session completion, persist a record: timestamp, routine, **per-phase totals**, **longest hold**, **presence %** (if enabled), completion status.        | FR-26     |
| **PFR-30** | Compute **current** and **longest streak** (consecutive practice days).                                                                                     | FR-27     |
| **PFR-31** | Support user-editable **weekly** and **monthly** goals and show progress.                                                                                   | FR-28     |
| **PFR-32** | Evaluate **badge** rules after each session and award newly earned badges (seed set: First Session, 7-Day Streak, 30-Day Streak, Held 15s, 10 Hours Total). | FR-29     |
| **PFR-33** | Raise a **native notification** (+ in-app toast mirror) on goal completion and badge unlock.                                                                | FR-30     |
| **PFR-34** | Provide a **Dashboard**: session history list, charts (sessions/week, total minutes, longest-hold trend), and a trophy shelf.                               | FR-31     |
| **PFR-35** | Support **export** and **import** of all local data as **JSON**.                                                                                            | FR-32     |

---

## 5. Data Requirements

| ID        | Requirement                                                                                                                                                                    | Traces to   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| **PDR-1** | Persist entities: `users`, `techniques`, `routines`, `sessions`, `presence_checks`, `goals`, `badges`, `user_badges`, `settings`. `users` has exactly **one local row** in R1. | DR-1        |
| **PDR-2** | Every user-owned entity carries a `user_id` column from R1.                                                                                                                    | DR-2, PCN-6 |
| **PDR-3** | `presence_checks` store **boolean + confidence + timestamp only** — never image data.                                                                                          | DR-3, PCN-4 |
| **PDR-4** | Local DB is **SQLite**; the same logical schema is reusable server-side later.                                                                                                 | DR-4        |
| **PDR-5** | Schema changes are applied via **versioned migrations** run on startup.                                                                                                        | DR-8        |
| **PDR-6** | The **JSON export** shall be a complete, self-describing snapshot such that **import into a clean install reproduces** all routines, sessions, goals, and earned badges.       | FR-32       |

**Reference schema (R1):**

```sql
users(id, name, created_at)
techniques(id, name, default_phases_json, is_builtin)
routines(id, user_id, name, config_json, updated_at)
sessions(id, user_id, routine_id, started_at, ended_at,
         duration_s, longest_hold_s, presence_pct, completed, summary_json)
presence_checks(id, session_id, ts, present, confidence)
goals(id, user_id, period /* weekly|monthly */, target, active)
badges(id, code, name, description, criteria_json)
user_badges(id, user_id, badge_id, earned_at)
settings(user_id, key, value)
```

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID         | Requirement                                                                                                     | Traces to   |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ----------- |
| **PNFR-1** | Timer phase transitions accurate to within **±100ms** over a 15-minute session.                                 | NFR-1       |
| **PNFR-2** | Presence and voice inference run **off the UI thread**; the UI maintains **≥30fps** animation during a session. | NFR-2       |
| **PNFR-3** | App **cold start** to the Home screen in **≤3s** on a typical mid-range Windows laptop.                         | (R1 target) |

### 6.2 Privacy & Safety

| ID         | Requirement                                                                                                                                          | Traces to      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **PNFR-4** | Camera and mic are **opt-in**; **no raw media** is stored or sent.                                                                                   | NFR-9          |
| **PNFR-5** | Explicit **consent** is captured per session (or persisted preference) for camera and mic.                                                           | NFR-10         |
| **PNFR-6** | A first-run **medical disclaimer** is shown and acknowledged; a persistent "stop if dizzy / breathe normally" reminder is available during sessions. | FR-15 (safety) |

### 6.3 Reliability

| ID         | Requirement                                                                                                                                                    | Traces to       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **PNFR-7** | A crash or forced quit mid-session shall not corrupt the local DB; an interrupted session is recorded as **incomplete** rather than lost or partially written. | (R1 robustness) |
| **PNFR-8** | All core function shall work fully **offline** with no degradation.                                                                                            | C1/PCN-1        |

### 6.4 Maintainability & Portability

| ID          | Requirement                                                                                                                 | Traces to     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **PNFR-9**  | **≥~80%** of application logic lives in the shared core, reusable by desktop and (later) mobile.                            | NFR-20        |
| **PNFR-10** | Platform-specific code (camera, mic, notifications, storage) is **isolated behind adapters**; core has no platform imports. | NFR-21, PCN-2 |
| **PNFR-11** | Core domain + timer + goal/badge logic is covered by **automated unit tests** with deterministic fixtures.                  | NFR-22, PCN-7 |

### 6.5 Usability & Accessibility

| ID          | Requirement                                                                                                           | Traces to |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| **PNFR-12** | A **beginner** can configure and complete a session **without external help** (validated by a usability walkthrough). | NFR-23    |
| **PNFR-13** | The app is **keyboard-operable**, provides **captions** for audio cues, and offers a **high-contrast** theme.         | NFR-24    |

---

## 7. Acceptance Criteria (POC 1 accepted when…)

1. **Adaptive session, offline:** a beginner sets a max hold (e.g., 6s), builds or picks a routine,
   and completes a guided session **fully offline**; the timer never exceeds the cap without an
   explicit override + warning. _(PFR-1…PFR-18, PNFR-1, PNFR-8)_
2. **Customization works:** per-phase and per-round durations, rounds, presets, ratio mode, and
   live pace multiplier all produce the expected compiled timeline (asserted by fixtures).
   _(PFR-1…PFR-12)_
3. **Cues synced:** breath animation and audio cues stay synchronized to phases; pre-session
   screen shows routine, ETA, consent, and disclaimer. _(PFR-15…PFR-18)_
4. **Pause/resume:** works by **button** always, and by **voice** when the mic is enabled, in a
   quiet room (target ≥90% recognition). _(PFR-25…PFR-28)_
5. **Presence (if enabled):** randomized checks log a presence %, **no frames are persisted**, and
   with the camera **disabled** every other feature still works (target ≥80% accuracy in normal
   light). _(PFR-19…PFR-24, PNFR-4)_
6. **Retention loop:** completing sessions persists records, updates **streaks** and **weekly/
   monthly goals**, awards **badges**, fires **notifications**, and shows on the **dashboard**;
   all computation verified against fixtures. _(PFR-29…PFR-34, PNFR-11)_
7. **Data portability:** **export → fresh install → import** reproduces all data. _(PFR-35, PDR-6)_
8. **Accuracy & responsiveness:** timer within ±100ms over 15 min; UI ≥30fps with ML running.
   _(PNFR-1, PNFR-2)_
9. **Packaging:** a **signed/packaged Windows installer** is produced with a user guide + disclaimer.

---

## 8. Traceability Matrix

### 8.1 POC 1 → parent SRS (cross-release)

| POC 1 area                                | POC 1 IDs                                   | Parent SRS IDs                                  |
| ----------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| Timer engine & customization              | PFR-1…PFR-14                                | FR-1…FR-12, NFR-1                               |
| Guidance & cues                           | PFR-15…PFR-18                               | FR-13…FR-15                                     |
| Presence (opt-in)                         | PFR-19…PFR-24                               | FR-16…FR-21                                     |
| Voice (opt-in)                            | PFR-25…PFR-28                               | FR-22…FR-25                                     |
| Activity / goals / badges / notifications | PFR-29…PFR-35                               | FR-26…FR-32                                     |
| Data                                      | PDR-1…PDR-6                                 | DR-1…DR-4, DR-8                                 |
| Interfaces                                | PIR-U1…PIR-U4, PIR-H1…PIR-H2, PIR-S1…PIR-S3 | IR-U1, IR-U2, IR-U5, IR-H1, IR-H2, IR-S1, IR-S2 |
| Performance                               | PNFR-1…PNFR-3                               | NFR-1, NFR-2                                    |
| Privacy & safety                          | PNFR-4…PNFR-6                               | NFR-9, NFR-10                                   |
| Maintainability / portability             | PNFR-9…PNFR-11                              | NFR-20, NFR-21, NFR-22                          |
| Usability / accessibility                 | PNFR-12…PNFR-13                             | NFR-23, NFR-24                                  |
| Constraints                               | PCN-1…PCN-7                                 | C1…C6, NFR-22                                   |

### 8.2 POC 1 → build phase ([`IMPLEMENTATION.md`](./IMPLEMENTATION.md))

| Phase                          | Delivers                                | POC 1 IDs                             |
| ------------------------------ | --------------------------------------- | ------------------------------------- |
| Phase 0 — Foundations          | scaffold, DB, first-run disclaimer      | PIR-S1, PIR-S3, PDR-1, PDR-5, PNFR-6  |
| Phase 1 — Engine + Session     | timer, cues, builder                    | PFR-1…PFR-18, PNFR-1                  |
| Phase 2 — Logging/Goals/Badges | persistence, streaks, dashboard, export | PFR-29…PFR-35, PDR-6, PNFR-11         |
| Phase 3 — Presence             | opt-in camera                           | PFR-19…PFR-24, PNFR-4                 |
| Phase 4 — Voice                | opt-in mic                              | PFR-25…PFR-28, PNFR-4                 |
| Phase 5 — Hardening & Release  | a11y, progression, QA, installer        | PFR-6, PNFR-2, PNFR-12, PNFR-13, §7.9 |

### 8.3 PRD goal → POC 1 coverage

| PRD goal (R1)                                       | Covered by    |
| --------------------------------------------------- | ------------- |
| G1 — customizable timers + caps + progression       | PFR-1…PFR-14  |
| G2 — guided session, audio + visual cues            | PFR-15…PFR-18 |
| G3 — random presence sampling, presence %           | PFR-19…PFR-24 |
| G4 — offline voice "pause"/"resume"                 | PFR-25…PFR-28 |
| G5 — logging, streaks, goals, badges, notifications | PFR-29…PFR-34 |

> PRD goals **G6 (mobile)** and **G7 (cloud/auth/scale)** are intentionally not part of POC 1.

---

### Companion documents

- [PRD.md](../PRD.md) — product requirements & release strategy (source of these requirements)
- [SRS.md](../SRS.md) — all-release formal requirements (parent IDs)
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) — POC 1 build plan & phase breakdown
- [ARCHITECTURE.md](../ARCHITECTURE.md) — system design & module specs
