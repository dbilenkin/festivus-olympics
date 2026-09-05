/** All scoring maths. Pure: every function takes the state it needs, so nothing here
 *  reaches for a global the way the legacy app did. That is what makes it testable. */

import type {
  EventState, GameId, PlayerId, Relay, Round, TeamKey,
} from "../domain/types";
import { mean } from "./time";

export interface Ranked { id: string; value: number | null }

/**
 * Rank by value; ties share a rank. Entries with no value are simply unranked
 * (absent from the map) rather than sorted to the end.
 */
export function rankBy(rows: Ranked[], lowerIsBetter: boolean): Map<string, number> {
  const valid = rows
    .filter((r): r is { id: string; value: number } => r.value != null && isFinite(r.value))
    .sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value));

  const m = new Map<string, number>();
  let lastVal: number | null = null;
  let lastRank = 0;
  valid.forEach((r, i) => {
    const rk = lastVal != null && Math.abs(r.value - lastVal) < 1e-9 ? lastRank : i + 1;
    m.set(r.id, rk);
    lastVal = r.value;
    lastRank = rk;
  });
  return m;
}

/**
 * A round only produces a total once EVERY station is recorded. A partial round is
 * null, not a smaller number -- otherwise someone who skipped a station would appear
 * to be winning.
 */
export function roundTotal(round: Round, pid: PlayerId, games: { id: GameId }[]): number | null {
  const sc = round.scores?.[pid] ?? {};
  let sum = 0;
  for (const g of games) {
    const v = sc[g.id];
    if (v == null || !isFinite(v)) return null;
    sum += v;
  }
  return sum;
}

export interface IndividualRow {
  pid: PlayerId;
  name: string;
  totals: (number | null)[];
  best: number | null;
  avg: number | null;
  completed: number;
  perGameBest: Record<GameId, number | null>;
  bestRank: number | null;
  avgRank: number | null;
}

export function individualResults(state: EventState): IndividualRow[] {
  const { players, games, rounds } = state;

  const rows: IndividualRow[] = players.map((p) => {
    const totals = rounds.map((r) => roundTotal(r, p.id, games));
    const done = totals.filter((t): t is number => t != null);

    const perGameBest: Record<GameId, number | null> = {};
    for (const g of games) {
      const vals = rounds
        .map((r) => r.scores?.[p.id]?.[g.id])
        .filter((v): v is number => v != null && isFinite(v));
      perGameBest[g.id] = vals.length ? Math.min(...vals) : null;
    }

    return {
      pid: p.id,
      name: p.name,
      totals,
      best: done.length ? Math.min(...done) : null,
      avg: done.length ? mean(done) : null,
      completed: done.length,
      perGameBest,
      bestRank: null,
      avgRank: null,
    };
  });

  const br = rankBy(rows.map((r) => ({ id: r.pid, value: r.best })), true);
  const ar = rankBy(rows.map((r) => ({ id: r.pid, value: r.avg })), true);
  for (const r of rows) {
    r.bestRank = br.get(r.pid) ?? null;
    r.avgRank = ar.get(r.pid) ?? null;
  }
  return rows;
}

/** Null unless every leg is in -- same rule as a pentathlon round. */
export function relayTeamTotal(relay: Relay, k: TeamKey): number | null {
  const e = relay.entries[k];
  if (!e) return null;
  let sum = 0;
  for (let i = 0; i < relay.legs.length; i++) {
    const v = e.splits[i];
    if (v == null || !isFinite(v)) return null;
    sum += v;
  }
  return sum;
}

export interface SideStanding { wins: number; total: number; run: number }

export function relayStandings(relays: Relay[]): Record<TeamKey, SideStanding> {
  const st: Record<TeamKey, SideStanding> = {
    A: { wins: 0, total: 0, run: 0 },
    B: { wins: 0, total: 0, run: 0 },
  };
  for (const r of relays) {
    const a = relayTeamTotal(r, "A");
    const b = relayTeamTotal(r, "B");
    if (a != null) { st.A.total += a; st.A.run++; }
    if (b != null) { st.B.total += b; st.B.run++; }
    if (a != null && b != null) {
      if (a < b) st.A.wins++;
      else if (b < a) st.B.wins++;
      else { st.A.wins += 0.5; st.B.wins += 0.5; }   // a dead heat splits the win
    }
  }
  return st;
}

/** A player's single fastest relay leg, across every relay. */
export function bestRelayLeg(
  relays: Relay[], pid: PlayerId,
): { v: number; gid: GameId } | null {
  let best: { v: number; gid: GameId } | null = null;
  for (const r of relays) {
    for (const k of ["A", "B"] as TeamKey[]) {
      const e = r.entries[k];
      if (!e) continue;
      e.lineup.forEach((id, i) => {
        const v = e.splits[i];
        if (id === pid && v != null && isFinite(v) && (!best || v < best.v)) {
          best = { v, gid: r.legs[i] };
        }
      });
    }
  }
  return best;
}

export interface RecordHolder { v: number; pid: PlayerId; when: string }
export interface Records {
  pent: RecordHolder | null;
  stations: { gid: GameId; name: string; best: RecordHolder | null }[];
  relay: { v: number; k: TeamKey; when: string } | null;
  leg: { v: number; pid: PlayerId; gid: GameId; when: string } | null;
}

/** Every all-time best on the day: overall, per station, and on the relay side. */
export function records(state: EventState): Records {
  const { players, games, rounds, relays } = state;
  const out: Records = { pent: null, stations: [], relay: null, leg: null };

  for (const rd of rounds) {
    for (const p of players) {
      const t = roundTotal(rd, p.id, games);
      if (t != null && (!out.pent || t < out.pent.v)) {
        out.pent = { v: t, pid: p.id, when: rd.label };
      }
    }
  }

  for (const g of games) {
    let best: RecordHolder | null = null;
    for (const rd of rounds) {
      for (const p of players) {
        const v = rd.scores?.[p.id]?.[g.id];
        if (v != null && isFinite(v) && (!best || v < best.v)) {
          best = { v, pid: p.id, when: rd.label };
        }
      }
    }
    out.stations.push({ gid: g.id, name: g.name, best });
  }

  for (const r of relays) {
    for (const k of ["A", "B"] as TeamKey[]) {
      const t = relayTeamTotal(r, k);
      if (t != null && (!out.relay || t < out.relay.v)) out.relay = { v: t, k, when: r.label };
      const e = r.entries[k];
      if (!e) continue;
      e.lineup.forEach((pid, i) => {
        const v = e.splits[i];
        if (pid && v != null && isFinite(v) && (!out.leg || v < out.leg.v)) {
          out.leg = { v, pid, gid: r.legs[i], when: r.label };
        }
      });
    }
  }
  return out;
}

export function teamOf(teams: EventState["teams"], pid: PlayerId): TeamKey | null {
  if (teams.A.members.includes(pid)) return "A";
  if (teams.B.members.includes(pid)) return "B";
  return null;
}
