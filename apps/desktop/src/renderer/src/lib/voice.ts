/**
 * Voice control (opt-in mic). PFR-25..PFR-28.
 *
 * Offline keyword spotting for "pause" / "resume" (+ "stop"), debounced (PFR-26).
 *
 * The architecture mandates an OFFLINE recognizer (Vosk WASM), NOT the cloud-routed Web Speech
 * API. Bundling a Vosk model is a large asset, so this module is built around a pluggable
 * `Recognizer` and reports `supported: false` when no offline model is wired — at which point the
 * UI relies on the always-present button/keyboard fallback (PFR-28). To enable real voice:
 *   1. `pnpm add vosk-browser` in apps/desktop
 *   2. drop a small en model under assets/models/vosk-en
 *   3. implement `createVoskRecognizer()` below and return it from `loadRecognizer()`.
 */
export type VoiceCommand = "pause" | "resume" | "stop";

export interface Recognizer {
  start(): Promise<void>;
  stop(): void;
}

export interface VoiceOptions {
  onCommand: (cmd: VoiceCommand) => void;
  debounceMs?: number;
}

const GRAMMAR: VoiceCommand[] = ["pause", "resume", "stop"];

export class VoiceController {
  private recognizer: Recognizer | null = null;
  private lastFiredAt = 0;
  private readonly debounceMs: number;

  constructor(private readonly opts: VoiceOptions) {
    this.debounceMs = opts.debounceMs ?? 1200;
  }

  /** True once an offline recognizer has been wired (see module header). */
  get supported(): boolean {
    return this.recognizer !== null;
  }

  /** Debounced dispatch so one utterance never double-triggers (PFR-26). */
  private fire(cmd: VoiceCommand): void {
    const now = Date.now();
    if (now - this.lastFiredAt < this.debounceMs) return;
    this.lastFiredAt = now;
    this.opts.onCommand(cmd);
  }

  /** Map a recognized phrase to a command using the restricted grammar (PFR-25). */
  handleTranscript(text: string): void {
    const lower = text.toLowerCase();
    for (const cmd of GRAMMAR) {
      if (lower.includes(cmd)) {
        this.fire(cmd);
        return;
      }
    }
  }

  private async loadRecognizer(): Promise<Recognizer | null> {
    // No offline model bundled in the POC → unsupported (button fallback covers control).
    return null;
  }

  async start(): Promise<{ supported: boolean }> {
    this.recognizer = await this.loadRecognizer();
    if (!this.recognizer) return { supported: false };
    await this.recognizer.start();
    return { supported: true };
  }

  stop(): void {
    this.recognizer?.stop();
    this.recognizer = null;
  }
}
