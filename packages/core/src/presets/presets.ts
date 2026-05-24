/**
 * Built-in techniques + Beginner/Intermediate/Advanced presets, matching the reference video
 * style (Bhastrika, Kapalbhati, Anulom Vilom, Bhramari + a guided retention block). PFR-8.
 * Beginner holds default to ≤ 6–8s so beginners can keep up. PRD G1.
 */
import type { Routine, Technique } from "../domain/types.js";

let counter = 0;
const id = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

type Level = "beginner" | "intermediate" | "advanced";

/** Hold seconds per level, kept within the beginner safety cap by default. */
const holdFor: Record<Level, number> = { beginner: 4, intermediate: 8, advanced: 12 };
const breathFor: Record<Level, number> = { beginner: 4, intermediate: 5, advanced: 6 };

function bhastrika(level: Level): Technique {
  const b = breathFor[level];
  return {
    id: id("bhastrika"),
    name: "Bhastrika (Bellows Breath)",
    rounds: level === "beginner" ? 10 : level === "intermediate" ? 15 : 20,
    phases: [
      { kind: "inhale", seconds: b },
      { kind: "exhale", seconds: b },
    ],
  };
}

function kapalbhati(level: Level): Technique {
  return {
    id: id("kapalbhati"),
    name: "Kapalbhati (Skull-Shining)",
    rounds: level === "beginner" ? 20 : level === "intermediate" ? 30 : 40,
    phases: [
      { kind: "inhale", seconds: 1 },
      { kind: "exhale", seconds: 0.5 },
    ],
  };
}

function anulomVilom(level: Level): Technique {
  const b = breathFor[level];
  const h = holdFor[level];
  return {
    id: id("anulom"),
    name: "Anulom Vilom (Alternate Nostril)",
    rounds: level === "beginner" ? 6 : level === "intermediate" ? 10 : 12,
    phases: [
      { kind: "inhale", seconds: b },
      { kind: "hold_in", seconds: h },
      { kind: "exhale", seconds: b },
    ],
  };
}

function bhramari(level: Level): Technique {
  const b = breathFor[level];
  return {
    id: id("bhramari"),
    name: "Bhramari (Humming Bee)",
    rounds: level === "beginner" ? 4 : level === "intermediate" ? 6 : 8,
    phases: [
      { kind: "inhale", seconds: b },
      { kind: "exhale", seconds: b * 2 },
    ],
  };
}

function retention(level: Level): Technique {
  const b = breathFor[level];
  return {
    id: id("retention"),
    name: "Guided Retention (Kumbhaka)",
    rounds: level === "beginner" ? 3 : level === "intermediate" ? 5 : 6,
    phases: [
      { kind: "inhale", seconds: b },
      { kind: "hold_in", seconds: holdFor[level] },
      { kind: "exhale", seconds: b },
      { kind: "hold_out", seconds: Math.round(holdFor[level] / 2) },
      { kind: "rest", seconds: 2 },
    ],
  };
}

export function presetRoutine(level: Level): Routine {
  const name =
    level === "beginner" ? "Beginner Daily" : level === "intermediate" ? "Intermediate Daily" : "Advanced Daily";
  return {
    id: id("routine"),
    name,
    warmupSeconds: level === "beginner" ? 30 : 20,
    techniques: [
      bhastrika(level),
      kapalbhati(level),
      anulomVilom(level),
      retention(level),
      bhramari(level),
    ],
    closingRestSeconds: level === "beginner" ? 60 : 45,
    paceMultiplier: 1,
  };
}

export const BUILTIN_PRESETS: { level: Level; label: string; build: () => Routine }[] = [
  { level: "beginner", label: "Beginner", build: () => presetRoutine("beginner") },
  { level: "intermediate", label: "Intermediate", build: () => presetRoutine("intermediate") },
  { level: "advanced", label: "Advanced", build: () => presetRoutine("advanced") },
];

/** A minimal starter technique for the Routine Builder "add technique" action. */
export function blankTechnique(): Technique {
  return {
    id: id("tech"),
    name: "New Technique",
    rounds: 5,
    phases: [
      { kind: "inhale", seconds: 4 },
      { kind: "hold_in", seconds: 4 },
      { kind: "exhale", seconds: 4 },
    ],
  };
}

export function blankRoutine(): Routine {
  return {
    id: id("routine"),
    name: "My Routine",
    warmupSeconds: 20,
    techniques: [blankTechnique()],
    closingRestSeconds: 30,
    paceMultiplier: 1,
  };
}

export const newId = id;
