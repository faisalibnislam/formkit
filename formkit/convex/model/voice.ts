/**
 * Voice recording questions: the person answering records themselves in the
 * browser, up to a length the form's builder picks. The recording is stored
 * like any other upload, so it counts against the plan's upload size.
 */

/** The lengths a builder can pick, in seconds: 15 seconds to 5 minutes. */
export const VOICE_LENGTHS = [15, 30, 60, 120, 180, 300] as const;
export const VOICE_DEFAULT = 60;

/** The nearest allowed length, for anything sent from outside the builder. */
export function voiceLength(seconds: number | null | undefined): number {
  if (!seconds || !Number.isFinite(seconds)) return VOICE_DEFAULT;
  return VOICE_LENGTHS.reduce((best, n) => (Math.abs(n - seconds) < Math.abs(best - seconds) ? n : best), VOICE_DEFAULT);
}

/** "15 seconds", "1 minute", "5 minutes". */
export function voiceLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.round(seconds / 60);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

/** 0:42, 4:05. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What browsers record into. Anything else sent to a voice question is refused. */
export function isAudio(contentType: string | null | undefined): boolean {
  return !!contentType && /^(audio\/|video\/webm|video\/mp4)/i.test(contentType);
}
