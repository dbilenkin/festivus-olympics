/** Talking to the API, and agreeing on what time it is. */
import type { Fact, FactMap } from "./facts";

export const API_BASE = "https://i0wg8dpt0d.execute-api.us-east-1.amazonaws.com";

const DEVICE_KEY = "pondneck.device";
const OFFSET_KEY = "pondneck.clockoffset";

/** Stable per-device id. Doubles as the tie-break when two writes share a millisecond. */
export function deviceId(): string {
  try {
    let d = localStorage.getItem(DEVICE_KEY);
    if (!d) {
      d = "d" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(DEVICE_KEY, d);
    }
    return d;
  } catch {
    return "d000000";
  }
}

/**
 * Phone clocks drift by minutes. Naive Date.now() last-write-wins means the phone with
 * the fastest clock wins every conflict forever, including other people's corrections --
 * with no visible cause. Every response carries serverNow, so each device stamps writes
 * with server-corrected time and they all agree to within a round trip.
 *
 * The offset is remembered, so the very first offline writes after a cold start are
 * stamped sensibly rather than with raw local time.
 */
let offset = Number(
  (() => { try { return localStorage.getItem(OFFSET_KEY); } catch { return null; } })() ?? 0,
) || 0;

export function noteServerTime(serverNow: number) {
  if (!Number.isFinite(serverNow)) return;
  offset = serverNow - Date.now();
  try { localStorage.setItem(OFFSET_KEY, String(offset)); } catch { /* ignore */ }
}
/** Corrected wall clock. Used for every fact timestamp. */
export const now = (): number => Date.now() + offset;
export const clockOffset = () => offset;

/* ------------------------------------------------------------------- calls */
export interface Snapshot {
  eventId: string; name: string; ver: number; serverNow: number; facts: FactMap;
}
export interface WriteResult {
  ver: number; serverNow: number; applied: number; rejected: number;
  conflicts: { k: string; v?: unknown; ts?: number; by?: string }[];
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API_BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
  if (typeof (body as { serverNow?: number }).serverNow === "number") {
    noteServerTime((body as { serverNow: number }).serverNow);
  }
  return body as T;
}

export const createEvent = (name: string) =>
  req<{ eventId: string; ver: number; name: string }>("/events", {
    method: "POST", body: JSON.stringify({ name }),
  });

/** `since` lets the server answer with ~90 bytes when nothing has changed. */
export const fetchEvent = (id: string, since?: number) =>
  req<Snapshot & { unchanged?: boolean }>(
    `/events/${encodeURIComponent(id)}${since != null ? `?since=${since}` : ""}`,
  );

export const pushFacts = (id: string, facts: Fact[]) =>
  req<WriteResult>(`/events/${encodeURIComponent(id)}/facts`, {
    method: "POST", body: JSON.stringify({ by: deviceId(), facts }),
  });

export const MAX_BATCH = 200;
