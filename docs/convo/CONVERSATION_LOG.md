# Conversation Log — PranaCoach Planning

> Full working transcript of the planning conversation that produced `PRD.md`, `SRS.md`,
> `ARCHITECTURE.md`, and `IMPLEMENTATION_PLAN.md`.

- **Exported:** 2026-05-24
- **Participants:** User (yogesh@grlps.com) · Claude Code (Opus 4.7)
- **Project dir:** `d:\Apps\source-code\Yogesh\other\yogesh\meditation-app`

---

## 1. User — Initial brief

> I planned to build a yoga app. Give me a sea and prd, implementation steps for the below goal.
>
> Understand the following YT link: https://youtu.be/I77hh5I69gA?si=oYFk3JBhv72V2M-K
>
> By ref this youtube i planned to implement:
>
> Here in the app, i need to use a customised way of doing for beginners — they can't able
> to maintain or hold the breath for more than 10s, so in the app i need to provide a timer
> customised way but the app should provide the max customisation.
>
> And it should continually monitor the person who is doing the yoga randomly and log their
> presence. It should listen to the user — if user is saying pause it should pause and if they
> say resume it should continue. Once the session is done it should log their activity and
> notify the goal like weekly/monthly and should provide a Badge. From here establish the
> requirement and provide more features. For now start with the MVP and then include more
> features, but in the MVP I planned to go with the desktop standalone on-premise application,
> but in future it should be cloud based with user management.

### Claude — Response (summary)

- Identified the YouTube video via web search:
  **["Daily Pranayama under 15-Minutes | Breathing Exercises & Yoga" by Saurabh Bothra](https://www.youtube.com/watch?v=I77hh5I69gA)**
  (a Habuild-style guided pranayama session). YouTube blocks transcript scraping, but the
  format — a guided, timed sequence of pranayama techniques each with an
  inhale / hold (kumbhaka) / exhale pattern — maps directly to the "customizable breath-hold
  timer" requirement.
- Key insight: the video uses **one fixed cadence for everyone**, which breaks down for
  beginners who can't hold breath past ~10s. The app's differentiator is making that timing
  **fully adaptive and customizable**.
- Created three planning docs (placeholder product name **PranaCoach**):
  - `docs/PRD.md` — Product Requirements (problem, personas, user stories, functional &
    non-functional requirements, risks, 3-phase release plan).
  - `docs/ARCHITECTURE.md` — the "SEA" / technical design (recommended stack: Electron +
    React + TypeScript, SQLite, MediaPipe/BlazeFace for on-device presence, Vosk for offline
    voice; pure-TS Timer Engine; `StorageRepository` interface; DB schema with `user_id` from
    day one).
  - `docs/IMPLEMENTATION_PLAN.md` — phased build order (timer engine first, then
    logging/badges, then opt-in camera + voice, then cloud).
- Explained why **Web Speech API** is unsuitable (cloud-routed, unreliable offline) and why
  **Vosk with a restricted grammar** ("pause"/"resume") is the right offline choice.
- Offered to proceed with Phase 0 (scaffolding) or refine docs.

---

## 2. User — Expanded scope: release stages, mobile, auth, cloud, 50k users

> create a PRD, SRS for this project. In the initial proto release the app should be running
> on the desktop; next stage it should be running on both desktop and mobile platforms
> (Android and iOS). Initial 2 releases should run without any login / authentication /
> authorization; in the next stage I planned to push it for authentication and authorization
> and need to store all the user info into the cloud, and the application will be deployed in
> the cloud and get the user's activity — which will be used by min more than 50k. So consider
> all these and fine tune this.

### Claude — Response (summary)

Established a **3-stage release model** and aligned all four docs to it:

| Release | Platforms | Auth | Data | Headline |
|---|---|---|---|---|
| **R1 — Proto / MVP** | Desktop (Win first) | None | Local only | Core: customizable timer + guided session + logging/badges; camera/voice opt-in |
| **R2 — Multi-platform** | Desktop + Android + iOS | None | Local per device | Same experience on mobile, no sync |
| **R3 — Cloud** | All | authN + authZ | Cloud + sync | Accounts, cloud-stored profile & activity, cross-device sync, analytics — **50k+ users** |

Key decisions and changes:
- **Cross-platform stack:** shared **TypeScript core** (domain, TimerEngine, repositories) +
  shared **React UI**, packaged via **Electron** (desktop) and **Capacitor** (Android/iOS) —
  maximizes reuse and keeps offline ML (Vosk/MediaPipe) workable. Noted alternatives:
  React Native, Flutter, Tauri 2.
- **`docs/PRD.md`** — rewritten around the release table; added user stories US8–US11
  (mobile, accounts, sync, authZ, scale), an R3 functional block (auth, cloud storage, sync,
  activity analytics, account/data deletion), and a scale/capacity section
  (~50k registered, ~15% DAU, low-hundreds peak concurrency).
- **`docs/SRS.md`** — *new* formal IEEE-830-style spec: testable requirements with IDs
  (`FR-*`, `NFR-*`, `DR-*`, `IR-*`), each tagged **[R1]/[R2]/[R3]**; covers timer engine,
  presence, voice, logging/badges, mobile parity, auth/authZ (FR-36–42), cloud sync
  (FR-43–47), scalability NFRs to 50k+ (NFR-13–16), cloud/scale requirements (CR-1–6), and
  per-release acceptance criteria.
- **`docs/ARCHITECTURE.md`** — added cross-platform strategy diagram; replaced the thin cloud
  note with a full **R3 cloud architecture**: stateless autoscaled API + managed Postgres
  (+ read replica) + optional Redis/queue + object storage/CDN, JWT auth, row-level authZ,
  offline-first sync, on-device ML retained, and 50k-scale notes.
- **`docs/IMPLEMENTATION_PLAN.md`** — remapped to R1 (Phases 0–5, now a monorepo with shared
  `packages/core`), **R2 mobile** (Phase 6 — Capacitor reusing the core), and **R3 cloud**
  (Phase 7 backend+auth, Phase 8 sync+activity, Phase 9 scale/security/load-test to 50k + GA),
  with per-release Definition of Done.

Flagged the cross-platform stack as the one decision worth confirming (Electron+Capacitor vs
Flutter vs React Native) and offered to proceed to Phase 0.

---

## 3. User — App name request

> based on the requirement suggest me a app name

### Claude — Response (summary)

Suggested names tied to the core value (adaptive, beginner-friendly breath timing + presence
+ voice + streaks):

- **Top recommendation:** **Prana** (life force / breath; short, brandable) — with a caveat
  to verify domain/trademark since it's a common Sanskrit word.
- **By theme:**
  - Breath-pacing / adaptive: *Pace & Breath, Sukha, EasyPrana, Tempo Breath*
  - Calm / habit / streaks: *Anuloma, Sthira, BreathStreak*
  - Coach / guidance: *PranaCoach, Breathwise*
- **Shortlist:** Prana · Sukha · Anuloma · Breathwise · Tempo Breath (with fit + watch-outs).
- Practical advice before committing (important for the public R3 launch): check domain
  (`.app`/`.com`), app-store name collisions (many breathing apps exist), and trademark.
  Coined/compound names (Breathwise, Anuloma, Tempo Breath) are usually easier to protect than
  common Sanskrit words.
- Offered to (1) pick one and update all four docs, or (2) brainstorm in a chosen direction,
  and to run an availability check on the chosen favorite.

---

## 4. User — Export request

> export this entire conversation into a md file and store it

### Claude — Response

Wrote this file (`docs/CONVERSATION_LOG.md`) capturing the full planning conversation.

---

## Artifacts produced in this conversation
- `docs/PRD.md` — Product Requirements Document (v0.2, 3-release model)
- `docs/SRS.md` — Software Requirements Specification (IEEE-830 style)
- `docs/ARCHITECTURE.md` — Software Engineering Architecture / design (v0.2)
- `docs/IMPLEMENTATION_PLAN.md` — Phased build order (R1 → R2 → R3)
- `docs/CONVERSATION_LOG.md` — this transcript

## Open items / next steps
- Confirm the **app name** (placeholder: *PranaCoach*).
- Confirm the **cross-platform stack** (recommended: shared TS core + Electron + Capacitor).
- Decide whether to begin **Phase 0** scaffolding (monorepo: `packages/core` + `apps/desktop`
  + SQLite + 5 screens).
