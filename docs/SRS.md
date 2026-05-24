# Software Requirements Specification (SRS) — PranaCoach

> Formal, testable requirements. Structured after IEEE-830. Companion to `PRD.md`
> (product), `ARCHITECTURE.md` (design), `IMPLEMENTATION_PLAN.md` (build order).

- **Status:** Draft v0.1
- **Date:** 2026-05-24
- **Requirement ID scheme:** `FR-*` functional, `NFR-*` non-functional, `DR-*` data,
  `IR-*` interface. Each tagged with the release it lands in: **[R1] [R2] [R3]**.

---

## 1. Introduction

### 1.1 Purpose
Specify the requirements for **PranaCoach**, a guided pranayama app with a fully customizable
breath-timer, optional on-device presence monitoring and voice control, and activity/goal/
badge tracking. Released in three stages: desktop (offline, no-auth) → desktop+mobile
(offline, no-auth) → cloud with authentication, authorization, and cloud-stored user data at
**50,000+ user scale**.

### 1.2 Scope
- **In scope:** breath-timer engine, guided sessions, presence (camera), voice control,
  logging/streaks/goals/badges/notifications, mobile parity, accounts/auth, cloud sync &
  storage, activity analytics.
- **Out of scope:** medical diagnosis/claims, social/leaderboard features, third-party
  marketplace, hardware sensors beyond standard camera/mic.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| **Pranayama** | Yogic breathing practice. |
| **Phase** | A timed breath segment: inhale, hold-in, exhale, hold-out, or rest. |
| **Kumbhaka** | Breath retention (hold-in = antara, hold-out = bahya). |
| **Technique** | A named pattern of phases × rounds (e.g., Anulom Vilom). |
| **Routine** | Ordered set of techniques + warmup + closing rest = a session plan. |
| **Presence check** | A randomized on-device camera sample → present/absent. |
| **Badge** | A rule-based achievement award. |
| **authN / authZ** | Authentication (who you are) / authorization (what you may access). |
| **DAU** | Daily active users. |

### 1.4 References
- PRD.md, ARCHITECTURE.md, IMPLEMENTATION_PLAN.md
- Reference video: https://www.youtube.com/watch?v=I77hh5I69gA

### 1.5 Overview
§2 overall description & constraints; §3 external interfaces; §4 functional requirements;
§5 data requirements; §6 non-functional requirements; §7 cloud/scale (R3); §8 acceptance &
traceability.

---

## 2. Overall Description

### 2.1 Product perspective
A new, self-contained product. **R1/R2:** standalone client with local storage, no backend.
**R3:** clients + a cloud backend (stateless API tier + managed relational DB + object
storage). On-device ML (presence/voice) runs locally in **all** releases.

### 2.2 Product functions (high level)
Customizable timed breathing sessions; guidance cues; optional presence logging; optional
voice control; activity/streak/goal/badge tracking with notifications; (R2) mobile delivery;
(R3) accounts, cloud sync, activity analytics.

### 2.3 User classes
- **Practitioner** (all releases) — runs sessions, views progress.
- **Authenticated user** (R3) — practitioner with a cloud account + sync.
- **Operator/Admin** (R3) — monitors service health & aggregate activity; no access to raw
  personal practice content beyond what policy permits.

### 2.4 Operating environment
- **R1:** Windows 10/11 (primary); macOS 12+, modern Linux (best-effort). Desktop shell:
  Electron. Webcam + mic optional.
- **R2:** + Android 9+ and iOS 15+ (Capacitor). Camera/mic via native permissions.
- **R3:** + Cloud backend (containers on a managed platform); clients require network for
  sync/auth but retain offline practice.

### 2.5 Design & implementation constraints
- **C1:** R1 & R2 must function with **no account and no network**.
- **C2:** Single **shared TypeScript core** (domain + timer engine + repository interfaces)
  reused across desktop and mobile. *(Recommended stack — adjustable.)*
- **C3:** Storage accessed only via a `StorageRepository` interface so the backend can swap
  (local ⇄ cloud) without UI changes.
- **C4:** No raw camera/microphone media is ever persisted or transmitted.
- **C5:** Breath-hold durations are capped by a configurable safety ceiling.
- **C6:** Data model includes `user_id` from R1 (single local user) to make R3 additive.

### 2.6 Assumptions & dependencies
- Device has a standard webcam/mic if presence/voice are enabled.
- Offline ML libraries (Vosk, MediaPipe/TF.js or native equivalents) are available per platform.
- R3 capacity planning assumes ~50k registered users, ~15% DAU; revisit with telemetry.

---

## 3. External Interface Requirements

### 3.1 User interfaces
- **IR-U1 [R1]** Screens: Home, Routine Builder, Session Player, Dashboard, Settings,
  First-run disclaimer/consent.
- **IR-U2 [R1]** Session Player shows breath animation, current phase + countdown,
  technique/round indicator, pause/resume controls, mic & camera status indicators.
- **IR-U3 [R2]** Touch-first responsive layout for phone form factors.
- **IR-U4 [R3]** Auth screens (sign-up, sign-in, verify email, reset password), account/profile,
  data export & delete.
- **IR-U5 [R1]** Keyboard-operable (desktop); captions for audio cues; high-contrast theme.

### 3.2 Hardware interfaces
- **IR-H1 [R1]** Optional webcam (presence) and microphone (voice) via OS/runtime APIs.
- **IR-H2 [R1]** Native desktop notifications; **[R2]** native mobile notifications.

### 3.3 Software interfaces
- **IR-S1 [R1]** Local persistence: SQLite (desktop via `better-sqlite3`; mobile via a
  Capacitor SQLite plugin).
- **IR-S2 [R1]** On-device ML: voice (Vosk), vision (MediaPipe/BlazeFace).
- **IR-S3 [R3]** Cloud REST/JSON API over HTTPS; OAuth provider(s) for federated login.

### 3.4 Communications interfaces
- **IR-C1 [R3]** All client↔server traffic over TLS 1.2+.
- **IR-C2 [R3]** Token-based auth (e.g., short-lived JWT access + refresh token).
- **IR-C3 [R3]** Sync uses idempotent, batched, retry-safe requests.

---

## 4. Functional Requirements

### 4.1 Breath Timer Engine [R1]
- **FR-1** The system shall represent a technique as an ordered list of phases
  (inhale, hold_in, exhale, hold_out, rest); any phase may have duration 0 (skipped).
- **FR-2** The system shall allow each phase duration to be set independently in seconds with
  0.5s granularity.
- **FR-3** The system shall allow per-round override of phase durations within a technique.
- **FR-4** The system shall allow configuring the number of rounds per technique.
- **FR-5** The system shall enforce a configurable **maximum-hold ceiling** (default 8s); any
  attempt to exceed it requires explicit user override and shall display a safety warning.
- **FR-6** The system shall support an optional **progression** rule: increase hold by N
  seconds every M completed sessions, not exceeding a user target.
- **FR-7** The system shall support **ratio mode** (e.g., 1:4:2 with a base unit) deriving
  phase durations, respecting FR-5.
- **FR-8** The system shall provide Beginner/Intermediate/Advanced presets and allow saving
  user-defined presets.
- **FR-9** The system shall apply a live **pace multiplier** (0.75×–1.25×) to all durations.
- **FR-10** The system shall compose a **routine** = warmup + ordered techniques + closing
  rest, and allow create/edit/save/delete of routines.
- **FR-11** The timer shall be drivable via `start/pause/resume/skip/stop`.
- **FR-12** Timeline computation shall be deterministic for a given routine + caps + progression.

### 4.2 Guidance & Cues [R1]
- **FR-13** The system shall display a breathing animation synchronized to the active phase.
- **FR-14** The system shall play configurable audio cues (voice prompts and/or tones) with
  volume and on/off control.
- **FR-15** Before a session the system shall show the full routine, estimated total time,
  camera/mic consent, and a safety disclaimer.

### 4.3 Presence Monitoring [R1, opt-in]
- **FR-16** When enabled, the system shall capture a camera frame at **randomized intervals**
  (configurable mean within a min–max window) during an active session.
- **FR-17** The system shall run on-device detection producing `{present: bool, confidence}`.
- **FR-18** The system shall persist only the boolean + confidence + timestamp per check and
  shall **not** persist the frame.
- **FR-19** The system shall compute and store **presence %** for the session.
- **FR-20** The system shall optionally auto-pause and/or play a nudge after K consecutive
  absent checks (K configurable).
- **FR-21** All features except presence shall remain fully functional with the camera disabled.

### 4.4 Voice Control [R1, opt-in]
- **FR-22** When enabled, the system shall perform **offline** keyword recognition for at
  least "pause" and "resume" (extensible to "stop"/"next").
- **FR-23** Recognized commands shall invoke the corresponding timer action, debounced to
  prevent duplicate triggers.
- **FR-24** The system shall display a listening indicator and shall not persist any audio.
- **FR-25** Keyboard/touch controls shall provide equivalent functionality as a fallback.

### 4.5 Activity, Goals, Badges, Notifications [R1]
- **FR-26** On session completion the system shall persist a record: timestamp, routine,
  per-phase totals, longest hold, presence %, completion status.
- **FR-27** The system shall compute current and longest **streak** (consecutive practice days).
- **FR-28** The system shall support user-editable **weekly** and **monthly** goals and show progress.
- **FR-29** The system shall evaluate **badge** rules after each session and award newly earned badges.
- **FR-30** The system shall raise a native **notification** on goal completion and badge unlock.
- **FR-31** The system shall provide a **dashboard**: session history, charts (sessions/week,
  total minutes, hold trend), and a trophy shelf.
- **FR-32** The system shall support **export/import** of all local data as JSON.

### 4.6 Mobile Parity [R2]
- **FR-33** The system shall provide all R1 functional requirements on Android 9+ and iOS 15+.
- **FR-34** The mobile app shall use native camera, microphone, and notification permissions/APIs.
- **FR-35** Mobile data shall be stored locally per device (no account, no cross-device sync in R2).

### 4.7 Accounts & Authentication [R3]
- **FR-36** The system shall let a user create an account via email+password and/or OAuth
  (e.g., Google/Apple).
- **FR-37** The system shall verify email ownership and support password reset.
- **FR-38** The system shall issue short-lived access tokens + refresh tokens; sessions shall
  be revocable (logout / lost device).
- **FR-39** Passwords shall be stored only as salted hashes (argon2id or bcrypt).

### 4.8 Authorization [R3]
- **FR-40** Every API request shall be authenticated; unauthenticated requests to protected
  resources shall be rejected.
- **FR-41** A user shall be able to read/write **only their own** data (per-user isolation
  enforced server-side).
- **FR-42** The system shall support roles (at minimum `user`, `admin`) with admin limited to
  operational/aggregate functions, not arbitrary access to personal practice content.

### 4.9 Cloud Storage, Sync & Activity [R3]
- **FR-43** The system shall store the user's profile, routines, sessions, goals, and badges
  in the cloud.
- **FR-44** The client shall remain offline-capable, queueing changes and syncing when online
  (offline-first).
- **FR-45** Sync shall be conflict-tolerant: additive logs (sessions, presence, badges) merge;
  mutable records (routines, settings) resolve last-write-wins by updated_at.
- **FR-46** The system shall collect user **activity** (engagement/retention signals) for
  operators, subject to consent and privacy policy.
- **FR-47** The system shall let users **export** and **delete** their account and all
  associated data.

---

## 5. Data Requirements

- **DR-1 [R1]** Entities: `users`, `techniques`, `routines`, `sessions`, `presence_checks`,
  `goals`, `badges`, `user_badges`, `settings`. (`users` has one local row in R1.)
- **DR-2 [R1]** Every user-owned entity carries `user_id` from R1 onward.
- **DR-3 [R1]** `presence_checks` store boolean + confidence + timestamp only — never image data.
- **DR-4 [R1]** Local DB is SQLite; same logical schema is reused server-side in R3 (Postgres).
- **DR-5 [R3]** Server enforces referential integrity and row-level per-user access.
- **DR-6 [R3]** PII is minimized (email + optional display name); stored encrypted at rest where supported.
- **DR-7 [R3]** Backups: automated daily DB backups with tested restore; retention policy defined.
- **DR-8** Schema changes are versioned via migrations on every platform.

---

## 6. Non-Functional Requirements

### 6.1 Performance
- **NFR-1 [R1]** Timer phase transitions accurate to within **±100ms** over a 15-minute session.
- **NFR-2 [R1]** Presence and voice inference run off the UI thread; UI shall maintain ≥30fps animation.
- **NFR-3 [R3]** API latency **p95 < 300ms**, **p99 < 800ms** under target load (§7).

### 6.2 Security [R3 unless noted]
- **NFR-4** All network traffic over TLS 1.2+.
- **NFR-5** Token-based authN; refresh-token rotation; rate limiting on auth endpoints.
- **NFR-6** Authorization enforced server-side on every request (no client-trust).
- **NFR-7** Protection against OWASP Top 10 (injection, broken access control, etc.); security
  review/pen-test before GA.
- **NFR-8** Secrets managed via a secrets manager; no secrets in source.
- **NFR-9 [R1]** On all releases, camera/mic are opt-in and no raw media is stored or sent.

### 6.3 Privacy & Compliance
- **NFR-10** Explicit consent for camera, mic, and (R3) activity analytics.
- **NFR-11 [R3]** Right to export and delete data (GDPR / India DPDP aligned).
- **NFR-12** Clear, accessible privacy policy describing what is collected and why.

### 6.4 Scalability & Availability [R3]
- **NFR-13** Support **≥ 50,000 registered users** with headroom to ~150k without re-architecture.
- **NFR-14** API tier is **stateless** and **horizontally scalable** behind a load balancer.
- **NFR-15** Target **99.9%** API monthly availability.
- **NFR-16** System sustains target peak concurrency (§7) within NFR-3 latency.

### 6.5 Reliability & Operability [R3]
- **NFR-17** Centralized logging, metrics, and alerting (health, latency, error rate, saturation).
- **NFR-18** Automated CI/CD with rollback capability.
- **NFR-19** Tested backup/restore; defined RPO ≤ 24h, RTO ≤ 4h (initial targets).

### 6.6 Portability & Maintainability
- **NFR-20** ≥ ~80% of application logic shared across desktop and mobile via the common core.
- **NFR-21** Platform-specific code (camera, mic, notifications, storage) isolated behind adapters.
- **NFR-22** Core domain + timer + goal/badge logic covered by automated unit tests.

### 6.7 Usability & Accessibility
- **NFR-23** Beginner can configure and complete a session without external help (validated by usability test).
- **NFR-24** Keyboard operability (desktop), captions for audio cues, high-contrast theme.

---

## 7. Cloud & Scale Requirements (R3 detail)

### 7.1 Capacity planning (working assumptions)
- Registered users: **50,000+** (plan headroom ~150k).
- DAU ~15% → ~7,500/day; peak concurrent active sessions: low hundreds.
- Per practice: ~1 session write + a few presence rows + a sync pull — low, bursty, small payloads.

### 7.2 Derived requirements
- **CR-1** Deploy API as containers with autoscaling (min 2 instances for HA) behind a load balancer.
- **CR-2** Use a **managed relational DB** (Postgres) with automated backups and at least one
  read replica for analytics/reporting.
- **CR-3** Cache hot/read-heavy data (e.g., badge definitions, leaderboards-if-added) via an
  in-memory cache (Redis) — optional at 50k, designed-for.
- **CR-4** Ingest activity/analytics asynchronously (batch endpoint or lightweight queue) so it
  never blocks the practice experience.
- **CR-5** Use object storage + CDN for static assets (audio cues, ML models) to keep clients
  lightweight and cacheable.
- **CR-6** Load-test to 50k users / target peak concurrency and confirm NFR-3/NFR-15 before GA.

> At 50k users this is a conventional, modest cloud footprint — a stateless API + managed
> Postgres (+ optional Redis/queue) is sufficient. The work is correctness, security,
> sync, and operability — not raw throughput. See `ARCHITECTURE.md` §7.

---

## 8. Acceptance & Traceability

### 8.1 Acceptance criteria by release
- **R1 accepted when:** a beginner configures & completes an adaptive guided session offline;
  pause/resume works (button + voice if enabled); presence logged if enabled; session persists;
  streaks/goals/badges compute correctly against fixtures; notifications fire; export/import works.
- **R2 accepted when:** all R1 acceptance criteria pass on Android 9+ and iOS 15+, offline,
  no account.
- **R3 accepted when:** sign-up/sign-in/reset work; authZ blocks cross-user access (verified by
  test); data syncs across two devices with correct conflict handling; export & delete work;
  load test sustains 50k-user target peak within latency/availability SLOs; security review clean.

### 8.2 Traceability
Each `FR/NFR/DR/IR` is realized by a module in `ARCHITECTURE.md` and scheduled in a phase in
`IMPLEMENTATION_PLAN.md`; tests reference the requirement ID they verify.
