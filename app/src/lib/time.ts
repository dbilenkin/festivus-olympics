/** Time parsing and formatting. Ported verbatim from the legacy app -- the exact
 *  rounding behaviour is load-bearing, because every displayed total must keep
 *  matching what the scorekeeper already has on screen. */

/** "1:22.4" | "82.4" | "1:22" -> seconds, or null if it isn't a usable time. */
export function parseTime(str: string | number | null | undefined): number | null {
  if (str == null) return null;
  const t = String(str).trim();
  if (!t) return null;
  if (t.includes(":")) {
    const parts = t.split(":");
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    if (!isFinite(m) || !isFinite(s)) return null;
    const v = Math.abs(m) * 60 + Math.abs(s);
    return v > 0 ? v : null;
  }
  const v = parseFloat(t);
  return isFinite(v) && v > 0 ? v : null;
}

const NA = "—"; // em dash

/** seconds -> "82.40", for a single station cell */
export const fmtSecs = (v: number | null | undefined): string =>
  v == null || !isFinite(v) ? NA : v.toFixed(2);

/** seconds -> "1:22.4", for a total */
export function fmtClock(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return NA;
  const m = Math.floor(v / 60);
  const s = v - m * 60;
  return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}

/** seconds -> "1:22", compact, for axis ticks */
export function fmtShort(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return NA;
  const m = Math.floor(v / 60);
  const s = Math.round(v - m * 60);
  return m + ":" + String(s).padStart(2, "0");
}

/** seconds -> "1:22.47", for the live run clock */
export function fmtRun(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "0:00.00";
  const m = Math.floor(v / 60);
  const s = v - m * 60;
  return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2);
}

export const mean = (a: number[]): number | null =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
