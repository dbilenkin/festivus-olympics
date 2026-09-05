/** Loading several events at once, for the all-time view.
 *
 *  Competitors are matched by NAME, not id. Ids are only unique within an event -- p7
 *  is Dimitri in one year and could be anyone in the next -- so joining on them would
 *  silently merge two different people's careers. */
import { fetchEvent } from "./client";
import { project } from "./facts";
import type { EventState } from "../domain/types";
import { individualResults, roundTotal } from "../lib/scoring";

export interface LoadedEvent { id: string; name: string; state: EventState }

/**
 * Chronology comes from a year in the event's name, not from when the record was
 * created: last year's results were imported today, so creation order would put 2025
 * after 2026 and quietly invert every year-on-year chart. Events without a year keep
 * the order they were given.
 */
export function chronological(events: LoadedEvent[]): LoadedEvent[] {
  const year = (n: string) => {
    const m = /\b(19|20)\d{2}\b/.exec(n);
    return m ? parseInt(m[0], 10) : null;
  };
  return [...events].sort((a, b) => {
    const ya = year(a.name), yb = year(b.name);
    if (ya != null && yb != null) return ya - yb;
    if (ya != null) return -1;
    if (yb != null) return 1;
    return 0;
  });
}

export async function loadEvents(ids: string[]): Promise<LoadedEvent[]> {
  const out = await Promise.all(ids.map(async (id) => {
    try {
      const snap = await fetchEvent(id);
      return { id, name: snap.name || id, state: project(snap.facts) };
    } catch { return null; }
  }));
  return chronological(out.filter((e): e is LoadedEvent => e !== null));
}

export interface CareerRow {
  name: string;
  events: number;
  rounds: number;
  careerAvg: number | null;      // mean of every completed round, all years
  bestEver: number | null;
  worstEver: number | null;
  titles: number;                 // events won on average
  perEvent: { id: string; name: string; avg: number | null; rank: number | null }[];
}

export interface AllTime {
  events: LoadedEvent[];
  career: CareerRow[];
  champions: { eventId: string; eventName: string; name: string; avg: number }[];
  stationRecords: { station: string; v: number; who: string; when: string }[];
}

export function aggregate(events: LoadedEvent[]): AllTime {
  const byName = new Map<string, CareerRow>();
  const champions: AllTime["champions"] = [];

  for (const ev of events) {
    const rows = individualResults(ev.state)
      .filter((r) => r.avg != null)
      .sort((a, b) => a.avg! - b.avg!);
    if (rows.length) {
      champions.push({ eventId: ev.id, eventName: ev.name, name: rows[0].name, avg: rows[0].avg! });
    }
    rows.forEach((r, i) => {
      const cur = byName.get(r.name) ?? {
        name: r.name, events: 0, rounds: 0, careerAvg: null,
        bestEver: null, worstEver: null, titles: 0, perEvent: [],
      };
      cur.events += 1;
      cur.rounds += r.completed;
      cur.bestEver = cur.bestEver == null ? r.best : Math.min(cur.bestEver, r.best!);
      cur.worstEver = cur.worstEver == null ? r.worst : Math.max(cur.worstEver, r.worst!);
      if (i === 0) cur.titles += 1;
      cur.perEvent.push({ id: ev.id, name: ev.name, avg: r.avg, rank: i + 1 });
      byName.set(r.name, cur);
    });
  }

  // Career average is the mean of every round ever run, not the mean of the yearly
  // averages -- a year with more rounds should carry more weight.
  for (const [name, row] of byName) {
    const all: number[] = [];
    for (const ev of events) {
      const p = ev.state.players.find((x) => x.name === name);
      if (!p) continue;
      for (const r of ev.state.rounds) {
        const t = roundTotal(r, p.id, ev.state.games);
        if (t != null) all.push(t);
      }
    }
    row.careerAvg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
  }

  // Stations are matched by name too: "Darts" one year and "Soccer" the next are
  // different games, and should not share a record.
  const recs = new Map<string, { v: number; who: string; when: string }>();
  for (const ev of events) {
    for (const g of ev.state.games) {
      for (const r of ev.state.rounds) {
        for (const p of ev.state.players) {
          const v = r.scores?.[p.id]?.[g.id];
          if (v == null || !isFinite(v)) continue;
          const cur = recs.get(g.name);
          if (!cur || v < cur.v) recs.set(g.name, { v, who: p.name, when: ev.name });
        }
      }
    }
  }

  return {
    events,
    career: [...byName.values()].sort((a, b) =>
      (a.careerAvg ?? 1e9) - (b.careerAvg ?? 1e9)),
    champions,
    stationRecords: [...recs.entries()].map(([station, r]) => ({ station, ...r }))
      .sort((a, b) => a.station.localeCompare(b.station)),
  };
}
