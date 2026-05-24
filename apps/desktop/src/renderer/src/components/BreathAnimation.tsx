import type { PhaseKind } from "@prana/core";

const PHASE_LABEL: Record<PhaseKind, string> = {
  inhale: "Inhale",
  hold_in: "Hold",
  exhale: "Exhale",
  hold_out: "Hold Out",
  rest: "Rest",
};

const PHASE_COLOR: Record<PhaseKind, string> = {
  inhale: "#38bdf8",
  hold_in: "#a78bfa",
  exhale: "#34d399",
  hold_out: "#fbbf24",
  rest: "#94a3b8",
};

interface Props {
  kind: PhaseKind;
  /** 0..1 progress through the current phase. */
  progress: number;
  remainingSeconds: number;
}

/**
 * Breath animation synced to the active phase (PFR-15). The circle expands on inhale, holds at
 * full/empty during holds, contracts on exhale. Captions accompany audio cues (PNFR-13).
 */
export function BreathAnimation({ kind, progress, remainingSeconds }: Props): JSX.Element {
  let scale: number;
  switch (kind) {
    case "inhale":
      scale = 0.5 + 0.5 * progress;
      break;
    case "exhale":
      scale = 1 - 0.5 * progress;
      break;
    case "hold_in":
      scale = 1;
      break;
    case "hold_out":
    case "rest":
      scale = 0.5;
      break;
    default:
      scale = 0.5;
  }

  const color = PHASE_COLOR[kind];
  const size = 260;

  return (
    <div className="flex flex-col items-center justify-center gap-6" aria-live="polite">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <div
          className="absolute rounded-full transition-transform duration-200 ease-linear"
          style={{
            width: size,
            height: size,
            transform: `scale(${scale})`,
            background: `radial-gradient(circle, ${color}55 0%, ${color}22 70%, transparent 100%)`,
            border: `3px solid ${color}`,
          }}
        />
        <div className="z-10 text-center">
          <div className="text-3xl font-semibold" style={{ color }}>
            {PHASE_LABEL[kind]}
          </div>
          <div className="mt-1 text-5xl font-bold tabular-nums">{Math.ceil(remainingSeconds)}</div>
        </div>
      </div>
    </div>
  );
}
