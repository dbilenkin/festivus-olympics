/**
 * The fact model.
 *
 * An event is NOT stored as one document. It decomposes into independently-addressed
 * last-write-wins registers ("facts"), which is what lets several phones time different
 * stations at once without clobbering each other.
 *
 * The rule for granularity is: one fact = one unit of human editing. Two places where
 * the obvious decomposition is wrong, and both are load-bearing:
 *
 *   - `teams.draw` is ONE fact holding both rosters. Per-player team facts would let two
 *     concurrent draws produce a 5/3 split with overlapping players -- a corrupt state no
 *     merge rule can repair.
 *   - `round.<id>.exists` is separate from `round.<id>.label`. Bundled, a rename that
 *     lands after a delete would silently resurrect the round.
 */
import type {
  EventState, GameId, PlayerId, RelayId, RoundId, TeamKey,
} from "../domain/types";

export interface Fact { k: string; v: unknown; ts: number }
export interface StoredFact { v: unknown; ts: number; by: string }
export type FactMap = Record<string, StoredFact>;

/* ------------------------------------------------------------------ keys */
export const K = {
  eventName: () => "event.name",
  playerName: (p: PlayerId) => `player.${p}.name`,
  playerOrd: (p: PlayerId) => `player.${p}.ord`,
  gameName: (g: GameId) => `game.${g}.name`,
  gameOrd: (g: GameId) => `game.${g}.ord`,
  draw: () => "teams.draw",
  teamName: (k: TeamKey) => `teams.${k}.name`,
  roundExists: (r: RoundId) => `round.${r}.exists`,
  roundLabel: (r: RoundId) => `round.${r}.label`,
  roundOrd: (r: RoundId) => `round.${r}.ord`,
  score: (r: RoundId, p: PlayerId, g: GameId) => `score.${r}.${p}.${g}`,
  relayExists: (y: RelayId) => `relay.${y}.exists`,
  relayLabel: (y: RelayId) => `relay.${y}.label`,
  relayOrd: (y: RelayId) => `relay.${y}.ord`,
  relayLegs: (y: RelayId) => `relay.${y}.legs`,
  lineup: (y: RelayId, k: TeamKey, i: number) => `relay.${y}.${k}.lineup.${i}`,
  split: (y: RelayId, k: TeamKey, i: number) => `relay.${y}.${k}.split.${i}`,
};

/** Must stay in step with KEY_GRAMMAR in infra/lambda/api/index.mjs. */
export const KEY_GRAMMAR =
  /^(event|player|game|teams|round|relay|score)(\.[A-Za-z0-9_-]{1,24})*$/;

/* ------------------------------------------------------------------ merge */
/**
 * Total order over writes: later timestamp wins; same millisecond is broken by device id
 * so every device converges on the same winner rather than on whoever asked last.
 */
export const beats = (a: { ts: number; by: string }, b?: StoredFact): boolean =>
  !b || a.ts > b.ts || (a.ts === b.ts && a.by > b.by);

/**
 * THE LENS. Render from the server snapshot with local unsent writes laid back on top.
 *
 * Skip this and a poll that lands before your edit is acknowledged makes your own typing
 * visibly revert -- the single most common bug in offline-first clients.
 */
export function merge(server: FactMap, pending: Fact[], by: string): FactMap {
  const out: FactMap = { ...server };
  for (const f of pending) {
    const cand = { v: f.v, ts: f.ts, by };
    if (beats(cand, out[f.k])) out[f.k] = cand;
  }
  return out;
}

/* -------------------------------------------------------------- projection */
const num = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) ? v : null;
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

/** facts -> the shape every screen and the whole scoring layer already understands. */
export function project(facts: FactMap): EventState {
  const byPrefix = (p: string) => Object.keys(facts).filter((k) => k.startsWith(p));

  // players / games: ordered by (ord, id) so every device agrees on the order
  const ids = (kind: "player" | "game") => {
    const s = new Set<string>();
    for (const k of byPrefix(`${kind}.`)) s.add(k.split(".")[1]);
    return [...s].sort((a, b) => {
      const oa = num(facts[`${kind}.${a}.ord`]?.v) ?? 0;
      const ob = num(facts[`${kind}.${b}.ord`]?.v) ?? 0;
      return oa - ob || (a < b ? -1 : a > b ? 1 : 0);
    });
  };

  const players = ids("player").map((id) => ({
    id, name: str(facts[K.playerName(id)]?.v, id),
  }));
  const games = ids("game").map((id) => ({
    id, name: str(facts[K.gameName(id)]?.v, id),
  }));

  const draw = facts[K.draw()]?.v as
    | { drawn?: boolean; A?: PlayerId[]; B?: PlayerId[] } | undefined;
  const teams = {
    drawn: !!draw?.drawn,
    A: { name: str(facts[K.teamName("A")]?.v, "Team A"), members: draw?.A ?? [] },
    B: { name: str(facts[K.teamName("B")]?.v, "Team B"), members: draw?.B ?? [] },
  };

  // rounds: a tombstone (exists === false) filters the round out. Its score facts are
  // deliberately left behind rather than cascade-deleted -- one write instead of forty,
  // and undelete then works for free.
  const roundIds = [...new Set(byPrefix("round.").map((k) => k.split(".")[1]))]
    .filter((r) => facts[K.roundExists(r)]?.v !== false)
    .sort((a, b) => (num(facts[K.roundOrd(a)]?.v) ?? 0) - (num(facts[K.roundOrd(b)]?.v) ?? 0)
      || (a < b ? -1 : 1));

  const rounds = roundIds.map((rid, i) => {
    const scores: EventState["rounds"][number]["scores"] = {};
    for (const p of players) {
      const row: Record<string, number | null> = {};
      for (const g of games) row[g.id] = num(facts[K.score(rid, p.id, g.id)]?.v);
      scores[p.id] = row;
    }
    return { id: rid, label: str(facts[K.roundLabel(rid)]?.v, `Round ${i + 1}`), scores };
  });

  const relayIds = [...new Set(byPrefix("relay.").map((k) => k.split(".")[1]))]
    .filter((y) => facts[K.relayExists(y)]?.v !== false)
    .sort((a, b) => (num(facts[K.relayOrd(a)]?.v) ?? 0) - (num(facts[K.relayOrd(b)]?.v) ?? 0)
      || (a < b ? -1 : 1));

  const relays = relayIds.map((yid, i) => {
    const legs = (facts[K.relayLegs(yid)]?.v as GameId[]) ?? games.map((g) => g.id);
    const side = (k: TeamKey) => ({
      lineup: legs.map((_, j) => (facts[K.lineup(yid, k, j)]?.v as PlayerId) ?? null),
      splits: legs.map((_, j) => num(facts[K.split(yid, k, j)]?.v)),
    });
    return {
      id: yid,
      label: str(facts[K.relayLabel(yid)]?.v, `Relay ${i + 1}`),
      legs,
      entries: { A: side("A"), B: side("B") },
    };
  });

  return { players, games, teams, rounds, relays };
}

/* --------------------------------------------------------------- migration */
/**
 * The legacy localStorage blob -> facts.
 *
 * Backdated by default: any live edit beats the import, so this is idempotent and
 * non-destructive. It can be re-run any number of times while debugging without ever
 * clobbering something newer.
 */
export function legacyToFacts(o: EventState, ts: number): Fact[] {
  const f: Fact[] = [];
  o.players.forEach((p, i) => {
    f.push({ k: K.playerName(p.id), v: p.name, ts });
    f.push({ k: K.playerOrd(p.id), v: i, ts });
  });
  o.games.forEach((g, i) => {
    f.push({ k: K.gameName(g.id), v: g.name, ts });
    f.push({ k: K.gameOrd(g.id), v: i, ts });
  });
  f.push({
    k: K.draw(),
    v: { drawn: !!o.teams.drawn, A: o.teams.A.members, B: o.teams.B.members },
    ts,
  });
  f.push({ k: K.teamName("A"), v: o.teams.A.name, ts });
  f.push({ k: K.teamName("B"), v: o.teams.B.name, ts });

  o.rounds.forEach((r, i) => {
    f.push({ k: K.roundExists(r.id), v: true, ts });
    f.push({ k: K.roundLabel(r.id), v: r.label, ts });
    f.push({ k: K.roundOrd(r.id), v: i, ts });
    for (const [pid, byGame] of Object.entries(r.scores ?? {})) {
      for (const [gid, val] of Object.entries(byGame ?? {})) {
        if (val != null) f.push({ k: K.score(r.id, pid, gid), v: val, ts });
      }
    }
  });

  o.relays.forEach((y, i) => {
    f.push({ k: K.relayExists(y.id), v: true, ts });
    f.push({ k: K.relayLabel(y.id), v: y.label, ts });
    f.push({ k: K.relayOrd(y.id), v: i, ts });
    f.push({ k: K.relayLegs(y.id), v: y.legs, ts });
    (["A", "B"] as TeamKey[]).forEach((side) => {
      const e = y.entries?.[side];
      if (!e) return;
      e.lineup.forEach((pid, j) => {
        if (pid) f.push({ k: K.lineup(y.id, side, j), v: pid, ts });
      });
      e.splits.forEach((s, j) => {
        if (s != null) f.push({ k: K.split(y.id, side, j), v: s, ts });
      });
    });
  });
  return f;
}
