import { useState } from "react";
import { useAppStore } from "../store/appStore.js";

/** First-run medical disclaimer; must be acknowledged before using the app. PNFR-6 / FR-15. */
export function FirstRun(): JSX.Element {
  const acceptDisclaimer = useAppStore((s) => s.acceptDisclaimer);
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <div className="card max-w-xl">
        <h1 className="mb-2 text-2xl font-bold text-sky-400">Welcome to PranaCoach</h1>
        <p className="mb-4 text-slate-300">
          PranaCoach guides breathing (pranayama) practice with fully adaptive, beginner-safe timing.
        </p>
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <strong>Medical disclaimer.</strong> Breath retention can cause dizziness. This app is not
          medical advice. Never hold your breath to the point of discomfort. <strong>Stop immediately
          if you feel dizzy or unwell and breathe normally.</strong> Consult a doctor before starting
          if you are pregnant or have a heart, lung, or blood-pressure condition.
        </div>
        <label className="mb-4 flex items-center gap-2 text-slate-200">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          I understand and accept these terms.
        </label>
        <button
          className="btn-primary disabled:opacity-40"
          disabled={!agreed}
          onClick={() => void acceptDisclaimer()}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
