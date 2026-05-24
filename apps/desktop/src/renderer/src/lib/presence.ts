/**
 * Presence monitoring (opt-in camera). PFR-19..PFR-24.
 *
 * Samples a webcam frame at RANDOMIZED intervals during a session and emits
 * {present, confidence}. Only the boolean + confidence + timestamp are ever kept — the frame is
 * drawn to an offscreen canvas, analyzed, and discarded (PFR-21 / PDR-3 / PCN-4: no frame stored).
 *
 * Detection here is a no-model heuristic (sufficient lit, changing foreground region ⇒ present) so
 * the POC runs fully offline with nothing to download. SWAP POINT: replace `detect()` with
 * MediaPipe/BlazeFace face detection for production accuracy (IR-S2). Interface stays identical.
 */
import type { PresenceCheck } from "@prana/core";

export interface PresenceOptions {
  minSeconds: number;
  maxSeconds: number;
  /** K consecutive absent checks before auto-pause/nudge fires; 0 = disabled. PFR-23. */
  autoPauseAfterAbsent: number;
  onCheck: (check: PresenceCheck) => void;
  onAutoPause?: () => void;
}

export class PresenceMonitor {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastFrame: ImageData | null = null;
  private consecutiveAbsent = 0;
  private running = false;

  constructor(private readonly opts: PresenceOptions) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 64;
    this.canvas.height = 48;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240 },
      audio: false,
    });
    this.video = document.createElement("video");
    this.video.srcObject = this.stream;
    this.video.muted = true;
    await this.video.play();
    this.running = true;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
    this.lastFrame = null;
  }

  private scheduleNext(): void {
    if (!this.running) return;
    const { minSeconds, maxSeconds } = this.opts;
    const delayMs = (minSeconds + Math.random() * Math.max(0, maxSeconds - minSeconds)) * 1000;
    this.timer = setTimeout(() => this.check(), delayMs);
  }

  private check(): void {
    if (!this.running || !this.video) return;
    const result = this.detect();
    const check: PresenceCheck = { ts: Date.now(), present: result.present, confidence: result.confidence };
    this.opts.onCheck(check);

    if (result.present) {
      this.consecutiveAbsent = 0;
    } else {
      this.consecutiveAbsent++;
      if (this.opts.autoPauseAfterAbsent > 0 && this.consecutiveAbsent >= this.opts.autoPauseAfterAbsent) {
        this.consecutiveAbsent = 0;
        this.opts.onAutoPause?.();
      }
    }
    this.scheduleNext();
  }

  /** No-model heuristic: a sufficiently lit frame with foreground variation ⇒ present. */
  private detect(): { present: boolean; confidence: number } {
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !this.video) return { present: false, confidence: 0 };
    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    const frame = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    let lumaSum = 0;
    let variance = 0;
    const n = frame.data.length / 4;
    const lumas = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = frame.data[i * 4]!;
      const g = frame.data[i * 4 + 1]!;
      const b = frame.data[i * 4 + 2]!;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      lumas[i] = l;
      lumaSum += l;
    }
    const mean = lumaSum / n;
    for (let i = 0; i < n; i++) variance += (lumas[i]! - mean) ** 2;
    variance /= n;

    // Motion vs previous frame.
    let motion = 0;
    if (this.lastFrame) {
      for (let i = 0; i < n; i++) {
        const prev =
          0.299 * this.lastFrame.data[i * 4]! +
          0.587 * this.lastFrame.data[i * 4 + 1]! +
          0.114 * this.lastFrame.data[i * 4 + 2]!;
        motion += Math.abs(lumas[i]! - prev);
      }
      motion /= n;
    }
    this.lastFrame = frame;

    // Heuristic scoring: lit enough + spatial detail + some motion ⇒ likely a present person.
    const litScore = mean > 25 && mean < 250 ? 1 : 0;
    const detailScore = Math.min(1, variance / 1500);
    const motionScore = Math.min(1, motion / 6);
    const confidence = Math.min(1, 0.4 * litScore + 0.4 * detailScore + 0.2 * motionScore);
    return { present: confidence >= 0.45, confidence: Math.round(confidence * 100) / 100 };
  }
}

/** Presence % from a list of checks. PFR-22. */
export const presencePercent = (checks: PresenceCheck[]): number | null =>
  checks.length === 0 ? null : Math.round((checks.filter((c) => c.present).length / checks.length) * 100);
