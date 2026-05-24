/**
 * Audio cues via WebAudio — synthesized tones + spoken phase prompts (SpeechSynthesis, local).
 * No bundled clips needed for the POC; real recorded clips can replace `speak()` later. PFR-16.
 * Volume + on/off are honored from settings.
 */
import type { PhaseKind } from "@prana/core";

const PHASE_TONE: Record<PhaseKind, number> = {
  inhale: 523.25, // C5
  hold_in: 659.25, // E5
  exhale: 392.0, // G4
  hold_out: 440.0, // A4
  rest: 329.63, // E4
};

const PHASE_WORD: Record<PhaseKind, string> = {
  inhale: "Inhale",
  hold_in: "Hold",
  exhale: "Exhale",
  hold_out: "Hold out",
  rest: "Rest",
};

export class CuePlayer {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.8;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Short tone marking a phase transition. */
  private tone(freq: number, durationMs = 220): void {
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.4, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }

  private speak(text: string): void {
    if (typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(text);
    u.volume = this.volume;
    u.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /** Cue the start of a phase: tone + spoken word. Returns the caption text for the UI. */
  cuePhase(kind: PhaseKind): string {
    const caption = PHASE_WORD[kind];
    if (this.enabled) {
      this.tone(PHASE_TONE[kind]);
      this.speak(caption);
    }
    return caption;
  }

  /** Gentle two-tone nudge (e.g. presence absence). */
  nudge(): void {
    if (!this.enabled) return;
    this.tone(440, 150);
    setTimeout(() => this.tone(330, 200), 180);
  }
}

export const cuePlayer = new CuePlayer();
