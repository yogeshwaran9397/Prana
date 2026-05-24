# Product Requirements Document (PRD) — PranaCoach

> A guided pranayama / yoga-breathing app with **fully customizable breath timers**,
> **presence monitoring**, **voice control**, and **streak/badge tracking**.
> Inspired by *"Daily Pranayama under 15-Minutes"* by Saurabh Bothra
> ([video](https://www.youtube.com/watch?v=I77hh5I69gA)).

- **Status:** Draft v0.2
- **Date:** 2026-05-24
- **Release model:** R1 Desktop (offline, no-auth) → R2 Desktop + Mobile (offline, no-auth) → R3 Cloud + Auth (50k+ users)
- Companion docs: `SRS.md` (formal requirements), `ARCHITECTURE.md` (design), `IMPLEMENTATION_PLAN.md` (build order)

---

## 1. Problem & Motivation

Guided pranayama videos (like the reference) run on **fixed timing** — one inhale/hold/exhale
cadence for everyone. This breaks for **beginners**, who typically can't hold a breath
(kumbhaka) past ~5–10 seconds. They fall behind, get discouraged, or hold unsafely to keep up.

PranaCoach **adapts the timing to the individual** (max customization), **confirms the user is
actually practicing** (presence), is **hands-free** (voice control), and **rewards consistency**
(streaks, goals, badges) — starting as an offline desktop app and growing to a cloud,
multi-platform, multi-user product.

## 2. Release Strategy (drives everything below)

| Release | Platforms | Auth | Data location | Headline |
|---|---|---|---|---|
| **R1 — Proto / MVP** | **Desktop** (Win first; mac/Linux best-effort) | **None** | **Local only** (on-device DB) | Prove the core: customizable timer + guided session + logging/badges. Camera/voice opt-in. |
| **R2 — Multi-platform** | **Desktop + Android + iOS** | **None** | **Local per device** | Same experience on mobile; no cross-device sync yet. |
| **R3 — Cloud** | Desktop + Android + iOS | **Yes (authN + authZ)** | **Cloud** (+ local cache) | Accounts, cloud-stored user info & activity, cross-device sync, analytics. **Scale: 50,000+ users.** |

**Guiding principles:**
- R1 & R2 must work **100% offline with no account** — frictionless trial.
- The codebase and data model are built **R3-ready from day one** (e.g., `user_id` present,
  storage behind an interface) so the cloud move is additive, not a rewrite.
- On-device ML (presence/voice) **stays on-device in all releases** (privacy + latency + offline).

## 3. Goals & Non-Goals

### Goals
- G1. Pranayama techniques with **per-phase, per-round customizable timers** + beginner safety caps + progression. *(R1)*
- G2. Guided session with **audio + visual cues** and a breath animation. *(R1)*
- G3. **Random presence sampling** via camera; log presence %. *(R1, opt-in)*
- G4. **Voice commands** "pause"/"resume", offline & local. *(R1, opt-in)*
- G5. **Activity logging**, streaks, weekly/monthly goals, **badges**, notifications. *(R1)*
- G6. **Run on Android + iOS** with the same feature set. *(R2)*
- G7. **Authentication & authorization**, **cloud-stored user profile + activity**, **cross-device sync**, cloud deployment serving **50k+ users**. *(R3)*

### Non-Goals
- Cloud/accounts in R1–R2.
- Social features/leaderboards (candidate for post-R3).
- Full conversational assistant (only a small command vocabulary).
- Medical/clinical claims or diagnosis.

## 4. Personas
| Persona | Description | Key need |
|---|---|---|
| **Beginner Bharat** | New, can't hold breath > ~8s, intimidated by fixed-pace videos | Gentle, adaptive timing; encouragement |
| **Consistent Priya** | Daily practitioner; wants streaks + longer holds | Progress tracking, goals, badges |
| **Multi-device Meera** *(R3)* | Practices on phone + desktop | Account + sync |
| **Admin/Operator** *(R3)* | Runs the cloud service | Reliability, observability, abuse/safety controls |

## 5. Key User Stories
- **US1 (R1):** As a beginner I set my max hold (e.g., 6s) so the app never pushes past it; it ramps up as I improve.
- **US2 (R1):** As a user I build/edit a session: techniques, rounds, and inhale/hold/exhale/rest seconds (or presets).
- **US3 (R1):** As a user I see a breath animation + hear cues for inhale/hold/exhale.
- **US4 (R1):** As a user I say "pause"/"resume" to control the session hands-free.
- **US5 (R1):** As a user the app randomly checks I'm present and logs presence %.
- **US6 (R1):** As a user I see a post-session summary and full history with charts.
- **US7 (R1):** As a user I get notified on goal completion / badge unlock; streaks tracked.
- **US8 (R2):** As a user I get the same app on my Android/iOS phone, offline.
- **US9 (R3):** As a user I create an account, and my profile + activity are stored in the cloud and **sync across my devices**.
- **US10 (R3):** As a user I trust that my account is secure (authN) and I can only access my own data (authZ).
- **US11 (R3):** As an operator the service stays responsive for 50k+ users.

## 6. Functional Requirements (product-level; see `SRS.md` for formal IDs)

### 6.1 Breath Timer Engine — "max customization" *(R1)*
- Phases: `inhale`, `hold_in` (antara kumbhaka), `exhale`, `hold_out` (bahya kumbhaka), `rest`; any phase may be 0/disabled.
- Every phase duration independently customizable (0.5s granularity), per technique **and per round**.
- Customizable **rounds** per technique.
- **Beginner safety cap:** global max-hold ceiling (default 8s) no preset may exceed without explicit override + warning.
- **Progression:** optional auto-increase of hold by N s every M sessions, capped at a target.
- **Ratio mode:** e.g., 1:4:2 with a base unit → derived durations.
- **Presets** (Beginner/Intermediate/Advanced) + user-saved custom presets.
- **Pace multiplier** (0.75×–1.25×) live.
- A **routine** = warmup + ordered techniques + closing rest; saveable/editable.

### 6.2 Guidance & Cues *(R1)*
- Visual breathing animation synced to phases; phase countdown; technique/round indicator.
- Audio cues (voice prompts / tones), volume + on/off.
- Pre-session screen: full routine + estimated total time + consent + safety disclaimer.

### 6.3 Presence Monitoring *(R1, opt-in)*
- At **random intervals** (configurable mean) capture a frame, run **on-device** face/person detection → present/absent + confidence.
- Store only the boolean + confidence (**no raw images**); compute presence %.
- Optional auto-pause + nudge after K consecutive absences.
- Fully optional — app works without camera.

### 6.4 Voice Control *(R1, opt-in)*
- **Offline** keyword spotting for "pause"/"resume" (extensible to "stop"/"next").
- Listening indicator; mic opt-in; debounced; **no audio persisted**.

### 6.5 Activity, Goals, Badges, Notifications *(R1)*
- Persist every session (date/time, routine, per-phase totals, longest hold, presence %, completion).
- Streaks (current + longest); weekly & monthly goals (editable) with progress bars.
- Rule-based badges (First Session, 7-Day Streak, 30-Day Streak, Held 15s, 10 Hours Total, …).
- Native notifications on goal completion / badge unlock; dashboard with history + charts + trophy shelf.

### 6.6 Mobile parity *(R2)*
- All R1 features on Android + iOS; native camera/mic/notifications; touch-first UI; local storage per device; no account.

### 6.7 Accounts, Cloud & Sync *(R3)*
- **Authentication:** email+password and/or OAuth (Google/Apple); email verification; password reset; secure session tokens.
- **Authorization:** every user can access only their own data (per-user isolation); future roles (user/admin).
- **Cloud-stored user info & activity:** profile, routines, sessions, goals, badges synced to cloud.
- **Cross-device sync:** offline-first with a sync queue; conflict resolution (last-write-wins per record + merge for additive logs).
- **Activity collection & analytics:** aggregate user activity for the operator (engagement, retention) — privacy-respecting, consented.
- **Account management:** profile edit, data export, **account & data deletion** (GDPR/DPDP-style).

## 7. Non-Functional Requirements (summary; formal in `SRS.md`)
- **Offline-first** (R1–R2 fully; R3 offline cache + sync).
- **Privacy:** camera/mic opt-in; no raw media stored; explicit consent; in R3 clear data policy + deletion.
- **Performance:** timer accuracy ±100ms; ML must not stutter UI (off main thread).
- **Portability:** one shared core across desktop + mobile.
- **Security (R3):** encrypted transport (TLS), hashed passwords (argon2/bcrypt), token-based auth, per-user authZ, secrets management.
- **Scalability (R3):** support **50,000+ registered users**; design for ~10–15% DAU and peak concurrency (see §8).
- **Reliability (R3):** target 99.9% API availability; backups; graceful offline degradation.
- **Accessibility:** keyboard-operable (desktop), captions, high-contrast theme.

## 8. Scale & Capacity Assumptions (R3, for 50k+ users)
> Working planning numbers — to be validated with real telemetry.
- **Registered users:** 50,000+ (design headroom to ~150k).
- **DAU:** assume ~15% → ~7,500/day; **peak concurrency** ~ a few hundred simultaneous sessions.
- **Write load:** sessions are small JSON; main writes are 1 session + a handful of presence rows per practice. Easily handled by a single managed Postgres with read replicas.
- **Sync/activity events:** batched, not chatty; ingest via the API or a lightweight queue.
- **Implication:** a **stateless horizontally-scalable API tier** behind a load balancer + **managed Postgres** + object storage + CDN is sufficient; no exotic infra needed at 50k. (Details in `ARCHITECTURE.md`.)

## 9. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Offline voice accuracy | Vosk with a *restricted grammar* of just command words; keyboard fallback. |
| Presence false negatives (lighting, closed eyes) | Detect presence not gaze; tune threshold; presence is informational, never blocks. |
| Unsafe breath holds | Hard caps + warnings + medical disclaimer + "stop if dizzy" cue. |
| Camera/mic privacy concerns | Opt-in, local-only, no media stored; transparent UI; clear R3 data policy. |
| Cross-platform divergence | Shared TS core + single UI layer (Electron + Capacitor); platform code isolated behind adapters. |
| Cloud cost/complexity at scale | Stateless API + managed DB + autoscaling; cache; load test to 50k before GA. |
| Data privacy/compliance in R3 | Consent, export, deletion; encryption; minimize collected PII. |

## 10. Success Metrics
- R1: beginner completes a full adaptive session without falling behind; sessions persist; badges/goals correct.
- ≥80% presence accuracy (normal light); ≥90% voice recognition (quiet room).
- R2: feature parity on Android + iOS; install + run offline.
- R3: auth secure (pen-test clean on OWASP top 10); sync correct; load test sustains 50k users / target peak concurrency within latency SLO (p95 API < 300ms).

See `SRS.md` for the formal, testable requirement set and `IMPLEMENTATION_PLAN.md` for sequencing.
