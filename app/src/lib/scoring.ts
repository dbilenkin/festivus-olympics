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
  worst: number | null;
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
      worst: done.length ? Math.max(...done) : null,
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

/* ============================================================================
   Deeper cuts. Average is the ranking key, so spread and per-station form are
   what actually explain a result -- these are the numbers behind the standings.
   ============================================================================ */

export interface Spread { best: number | null; avg: number | null; worst: number | null; n: number }

const spreadOf = (vals: number[]): Spread => ({
  best: vals.length ? Math.min(...vals) : null,
  avg: mean(vals),
  worst: vals.length ? Math.max(...vals) : null,
  n: vals.length,
});

/** Every recorded time a player has posted at one station, across all rounds. */
export function playerStationTimes(
  state: EventState, pid: PlayerId, gid: GameId,
): number[] {
  return state.rounds
    .map((r) => r.scores?.[pid]?.[gid])
    .filter((v): v is number => v != null && isFinite(v));
}

/** Per station: the whole field's spread, plus every player's own. */
export interface StationBreakdown {
  gid: GameId;
  name: string;
  field: Spread;
  players: { pid: PlayerId; name: string; spread: Spread }[];
}

export function stationBreakdown(state: EventState): StationBreakdown[] {
  return state.games.map((g) => {
    const all: number[] = [];
    const players = state.players.map((p) => {
      const vals = playerStationTimes(state, p.id, g.id);
      all.push(...vals);
      return { pid: p.id, name: p.name, spread: spreadOf(vals) };
    });
    return { gid: g.id, name: g.name, field: spreadOf(all), players };
  });
}

/** A player's pentathlon spread: their best, average and worst full round. */
export function pentathlonSpread(state: EventState, pid: PlayerId): Spread {
  return spreadOf(
    state.rounds
      .map((r) => roundTotal(r, pid, state.games))
      .filter((t): t is number => t != null),
  );
}

/**
 * How a player compares to the field at each station, as a ratio of the field average.
 * 0.8 means they are 20% quicker than everyone else there; 1.3 means 30% slower.
 * This is what turns "I am mid-table" into "I am the Cornhole guy".
 */
export interface Form { pid: PlayerId; name: string; byStation: Record<GameId, number | null> }

export function relativeForm(state: EventState): Form[] {
  const fieldAvg: Record<GameId, number | null> = {};
  for (const g of state.games) {
    const all = state.players.flatMap((p) => playerStationTimes(state, p.id, g.id));
    fieldAvg[g.id] = mean(all);
  }
  return state.players.map((p) => {
    const byStation: Record<GameId, number | null> = {};
    for (const g of state.games) {
      const mineAvg = mean(playerStationTimes(state, p.id, g.id));
      const fa = fieldAvg[g.id];
      byStation[g.id] = mineAvg != null && fa != null && fa > 0 ? mineAvg / fa : null;
    }
    return { pid: p.id, name: p.name, byStation };
  });
}

/** Head to head: rounds where both finished, and who was quicker. */
export interface H2H { wins: number; losses: number; played: number }

export function headToHead(state: EventState): Record<PlayerId, Record<PlayerId, H2H>> {
  const out: Record<PlayerId, Record<PlayerId, H2H>> = {};
  for (const a of state.players) {
    out[a.id] = {};
    for (const b of state.players) {
      if (a.id === b.id) continue;
      let wins = 0, losses = 0, played = 0;
      for (const r of state.rounds) {
        const ta = roundTotal(r, a.id, state.games);
        const tb = roundTotal(r, b.id, state.games);
        if (ta == null || tb == null) continue;
        played++;
        if (ta < tb) wins++; else if (tb < ta) losses++;
      }
      out[a.id][b.id] = { wins, losses, played };
    }
  }
  return out;
}

/** First complete round vs most recent. Positive means they got quicker. */
export interface Trend { pid: PlayerId; name: string; first: number; last: number; delta: number }

export function improvement(state: EventState): Trend[] {
  return state.players.flatMap((p) => {
    const totals = state.rounds
      .map((r) => roundTotal(r, p.id, state.games))
      .filter((t): t is number => t != null);
    if (totals.length < 2) return [];
    const first = totals[0], last = totals[totals.length - 1];
    return [{ pid: p.id, name: p.name, first, last, delta: first - last }];
  });
}

/** Single fastest and single slowest station times of the whole day. */
export interface Extreme { v: number; pid: PlayerId; name: string; gid: GameId; game: string; when: string }

export function extremes(state: EventState): { fastest: Extreme[]; slowest: Extreme[] } {
  const all: Extreme[] = [];
  for (const r of state.rounds) {
    for (const p of state.players) {
      for (const g of state.games) {
        const v = r.scores?.[p.id]?.[g.id];
        if (v != null && isFinite(v)) {
          all.push({ v, pid: p.id, name: p.name, gid: g.id, game: g.name, when: r.label });
        }
      }
    }
  }
  const byTime = [...all].sort((x, y) => x.v - y.v);
  return { fastest: byTime.slice(0, 5), slowest: byTime.slice(-5).reverse() };
}
