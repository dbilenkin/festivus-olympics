/**
 * Confirmation that a station banked, without looking at the screen.
 *
 * iOS Safari does not support navigator.vibrate at all, so audio is the primary channel,
 * not the fallback. It is also better outdoors: the runner can hear the bank from thirty
 * feet away, which a buzz in the timekeeper's pocket cannot do.
 */
let ctx: AudioContext | null = null;

/** Must be called from inside a user gesture, or iOS leaves the context suspended. */
export function armAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx?.state === "suspended") void ctx.resume();
  } catch { /* audio simply unavailable */ }
}

function blip(freq: number, ms: number, at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

export function feedbackLap(soundOn: boolean) {
  if (soundOn) blip(880, 45);
  try { navigator.vibrate?.(30); } catch { /* unsupported */ }
}
export function feedbackFinish(soundOn: boolean) {
  if (soundOn) { blip(660, 70); blip(880, 70, 0.1); blip(1180, 160, 0.2); }
  try { navigator.vibrate?.([30, 60, 30, 60, 90]); } catch { /* unsupported */ }
}

/** Keep the screen awake for the length of a run. The sentinel is auto-released whenever
 *  the page hides, so it must be re-acquired on visibilitychange -- the classic bug. */
let sentinel: WakeLockSentinel | null = null;
export async function acquireWakeLock() {
  try {
    if (!("wakeLock" in navigator)) return;
    sentinel = await navigator.wakeLock.request("screen");
  } catch { /* denied or unsupported */ }
}
export async function releaseWakeLock() {
  try { await sentinel?.release(); } catch { /* ignore */ } finally { sentinel = null; }
}
export const wakeLockSupported = () =>
  typeof navigator !== "undefined" && "wakeLock" in navigator;
