/** The replicated document: a server snapshot, an outbox of unsent writes, and the
 *  projection both feed. Lives outside React so the run timer and the poller can write
 *  to it from a rAF loop and a setInterval. */
import { create } from "zustand";
import { merge, project, type Fact, type FactMap } from "./facts";
import {
  deviceId, fetchEvent, pushFacts, now, MAX_BATCH, type WriteResult,
} from "./client";
import type { EventState } from "../domain/types";

const cacheKey = (id: string) => `pondneck.cache.${id}`;
const outboxKey = (id: string) => `pondneck.outbox.${id}`;

const readJSON = <T,>(k: string, fallback: T): T => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
};
const writeJSON = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ }
};

export interface Conflict { k: string; mine: unknown; theirs: unknown; at: number }

interface Store {
  eventId: string | null;
  name: string;
  ver: number;
  server: FactMap;       // last thing the server told us
  outbox: Fact[];        // written locally, not yet acknowledged
  view: EventState;      // merge(server, outbox) projected -- what every screen reads
  online: boolean;
  syncing: boolean;
  lastSyncAt: number;
  conflicts: Conflict[];

  open: (id: string, name?: string) => void;
  close: () => void;
  put: (facts: Fact[]) => void;
  flush: () => Promise<void>;
  poll: (force?: boolean) => Promise<void>;
  dismissConflicts: () => void;
}

const EMPTY: EventState = {
  players: [], games: [],
  teams: { drawn: false, A: { name: "Team A", members: [] }, B: { name: "Team B", members: [] } },
  rounds: [], relays: [],
};

export const useStore = create<Store>((set, get) => {
  /** THE LENS. Always render the server snapshot with unsent local writes laid back on
   *  top, or a poll landing before your edit is acknowledged reverts your own typing. */
  const reproject = (server: FactMap, outbox: Fact[]) =>
    ({ view: project(merge(server, outbox, deviceId())) });

  return {
    eventId: null, name: "", ver: 0, server: {}, outbox: [], view: EMPTY,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    syncing: false, lastSyncAt: 0, conflicts: [],

    open(id, name) {
      const server = readJSON<FactMap>(cacheKey(id), {});
      const outbox = readJSON<Fact[]>(outboxKey(id), []);
      set({ eventId: id, name: name ?? "", server, outbox, ver: 0, ...reproject(server, outbox) });
      void get().poll(true);
    },

    close() { set({ eventId: null, server: {}, outbox: [], view: EMPTY, ver: 0 }); },

    put(facts) {
      const id = get().eventId;
      if (!id || !facts.length) return;
      // Later writes to the same key supersede earlier queued ones, so a field edited
      // repeatedly offline does not send one request per keystroke.
      const byKey = new Map(get().outbox.map((f) => [f.k, f]));
      for (const f of facts) {
        const prev = byKey.get(f.k);
        if (!prev || f.ts >= prev.ts) byKey.set(f.k, f);
      }
      const outbox = [...byKey.values()];
      writeJSON(outboxKey(id), outbox);
      set({ outbox, ...reproject(get().server, outbox) });
      void get().flush();
    },

    async flush() {
      const { eventId: id, outbox, syncing } = get();
      if (!id || !outbox.length || syncing) return;
      const sending = outbox.slice();          // snapshot: more can arrive mid-flight
      set({ syncing: true });
      try {
        let res: WriteResult | null = null;
        for (let i = 0; i < sending.length; i += MAX_BATCH) {
          res = await pushFacts(id, sending.slice(i, i + MAX_BATCH));
        }
        // Anything the server refused was superseded by a newer write from someone else.
        // Surface it rather than silently swapping the number under them.
        const conflicts: Conflict[] = (res?.conflicts ?? []).map((c) => ({
          k: c.k,
          mine: sending.find((f) => f.k === c.k)?.v,
          theirs: c.v,
          at: Date.now(),
        }));
        // Remove ONLY what was actually sent. Typing during an in-flight request would
        // otherwise be wiped by the response that raced it.
        const sent = new Map(sending.map((f) => [f.k, f.ts]));
        const remaining = get().outbox.filter((f) => {
          const ts = sent.get(f.k);
          return ts === undefined || f.ts > ts;
        });
        writeJSON(outboxKey(id), remaining);
        set({ outbox: remaining, online: true, syncing: false,
              conflicts: conflicts.length ? conflicts : get().conflicts });
        await get().poll(true);
        if (remaining.length) void get().flush();
      } catch {
        // Keep the outbox. The poller and the online/visibility listeners retry.
        set({ syncing: false, online: false });
      }
    },

    async poll(force = false) {
      const { eventId: id, ver, outbox } = get();
      if (!id) return;
      try {
        const snap = await fetchEvent(id, force ? undefined : ver);
        if ("unchanged" in snap && snap.unchanged) {
          set({ online: true, lastSyncAt: Date.now() });
          return;
        }
        writeJSON(cacheKey(id), snap.facts);
        set({
          server: snap.facts, ver: snap.ver, name: snap.name ?? get().name,
          online: true, lastSyncAt: Date.now(),
          ...reproject(snap.facts, outbox),
        });
      } catch {
        set({ online: false });
      }
    },

    dismissConflicts() { set({ conflicts: [] }); },
  };
});

/** Convenience for screens: emit a fact at the corrected clock. */
export const putFact = (k: string, v: unknown) =>
  useStore.getState().put([{ k, v, ts: now() }]);
export const putFacts = (entries: { k: string; v: unknown }[]) =>
  useStore.getState().put(entries.map((e) => ({ ...e, ts: now() })));

/** Poll while the tab is visible; retry the outbox whenever the network or focus returns.
 *  Deliberately paused during a run -- no network on the timer's critical path. */
export function startSync(intervalMs = 5000) {
  let timer: number | undefined;
  const tick = () => {
    if (document.visibilityState !== "visible") return;
    if (document.body.dataset.running === "1") return;
    const s = useStore.getState();
    if (s.outbox.length) void s.flush(); else void s.poll();
  };
  const start = () => { stop(); timer = window.setInterval(tick, intervalMs); };
  const stop = () => { if (timer) window.clearInterval(timer); timer = undefined; };

  const onVis = () => { if (document.visibilityState === "visible") { tick(); start(); } else stop(); };
  const onOnline = () => { useStore.setState({ online: true }); tick(); };
  const onOffline = () => useStore.setState({ online: false });

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  start();

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}
