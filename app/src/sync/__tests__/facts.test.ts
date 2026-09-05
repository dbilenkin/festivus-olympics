import { describe, it, expect } from "vitest";
import { project, legacyToFacts, merge, beats, K, KEY_GRAMMAR } from "../facts";
import type { Fact, FactMap } from "../facts";
import { individualResults } from "../../lib/scoring";
import { fixture, EXPECTED, IDS } from "../../lib/__tests__/fixture";
import type { EventState } from "../../domain/types";

const toMap = (facts: Fact[], by = "phoneA"): FactMap =>
  Object.fromEntries(facts.map((f) => [f.k, { v: f.v, ts: f.ts, by }]));

const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

describe("legacy state survives a round-trip through facts", () => {
  const S = fixture();
  const back = project(toMap(legacyToFacts(S, 1000)));

  it("keeps every player and game, in order", () => {
    expect(back.players.map((p) => p.id)).toEqual(S.players.map((p) => p.id));
    expect(back.games.map((g) => g.name)).toEqual(S.games.map((g) => g.name));
  });

  it("keeps the teams and the draw", () => {
    expect(back.teams.drawn).toBe(true);
    expect(back.teams.A.members).toEqual(S.teams.A.members);
    expect(back.teams.B.name).toBe(S.teams.B.name);
  });

  it("produces byte-for-byte the same standings", () => {
    const rows = individualResults(back);
    for (const pid of IDS) {
      const exp = EXPECTED[pid as keyof typeof EXPECTED];
      const row = rows.find((r) => r.pid === pid)!;
      expect(round2(row.best)).toBe(exp.best);
      expect(round2(row.avg)).toBe(exp.avg);
      expect(row.bestRank).toBe(exp.bestRank);
    }
  });

  it("emits only keys the server will accept", () => {
    for (const f of legacyToFacts(S, 1000)) expect(f.k).toMatch(KEY_GRAMMAR);
  });
});

describe("last-write-wins is a total order", () => {
  it("later timestamp wins", () => {
    expect(beats({ ts: 2, by: "a" }, { v: 1, ts: 1, by: "z" })).toBe(true);
    expect(beats({ ts: 1, by: "z" }, { v: 1, ts: 2, by: "a" })).toBe(false);
  });
  it("same millisecond is broken by device id, deterministically", () => {
    expect(beats({ ts: 5, by: "phoneB" }, { v: 1, ts: 5, by: "phoneA" })).toBe(true);
    expect(beats({ ts: 5, by: "phoneA" }, { v: 1, ts: 5, by: "phoneB" })).toBe(false);
  });
  it("writes to a key that does not exist yet always win", () => {
    expect(beats({ ts: 0, by: "a" }, undefined)).toBe(true);
  });
});

describe("two phones offline, edit the same cell, sync in either order", () => {
  const A: Fact = { k: K.score("r1", "c1", "g1"), v: 41.2, ts: 1000 };
  const B: Fact = { k: K.score("r1", "c1", "g1"), v: 38.9, ts: 1030 };
  const applyInOrder = (order: Fact[]) => {
    let m: FactMap = {};
    for (const f of order) m = merge(m, [f], "x");
    return m[K.score("r1", "c1", "g1")].v;
  };
  it("converges on the later write regardless of arrival order", () => {
    expect(applyInOrder([A, B])).toBe(38.9);
    expect(applyInOrder([B, A])).toBe(38.9);
  });
});

describe("the lens: unsent local edits survive a poll", () => {
  it("a server snapshot does not revert my own newer unsent typing", () => {
    const server: FactMap = { [K.playerName("c1")]: { v: "Andy", ts: 100, by: "other" } };
    const pending: Fact[] = [{ k: K.playerName("c1"), v: "Andrew", ts: 200 }];
    expect(merge(server, pending, "me")[K.playerName("c1")].v).toBe("Andrew");
  });
  it("but a NEWER server value does win over a stale local one", () => {
    const server: FactMap = { [K.playerName("c1")]: { v: "Andy", ts: 300, by: "other" } };
    const pending: Fact[] = [{ k: K.playerName("c1"), v: "Andrew", ts: 200 }];
    expect(merge(server, pending, "me")[K.playerName("c1")].v).toBe("Andy");
  });
});

describe("tombstones", () => {
  const S = fixture();
  const facts = toMap(legacyToFacts(S, 1000));

  it("a delete removes the round from the projection", () => {
    const m = merge(facts, [{ k: K.roundExists("r3"), v: false, ts: 2000 }], "me");
    expect(project(m).rounds.map((r) => r.id)).toEqual(["r4"]);
  });

  it("a rename landing AFTER a delete does not resurrect the round", () => {
    let m = merge(facts, [{ k: K.roundExists("r3"), v: false, ts: 2000 }], "me");
    m = merge(m, [{ k: K.roundLabel("r3"), v: "Renamed", ts: 3000 }], "me");
    expect(project(m).rounds.map((r) => r.id)).toEqual(["r4"]);
  });

  it("an offline create that syncs late still loses to an earlier delete", () => {
    let m = merge(facts, [{ k: K.roundExists("r3"), v: false, ts: 5000 }], "me");
    m = merge(m, [{ k: K.roundExists("r3"), v: true, ts: 4000 }], "slowphone");
    expect(project(m).rounds.map((r) => r.id)).toEqual(["r4"]);
  });

  it("undelete works, because score facts were never cascade-deleted", () => {
    let m = merge(facts, [{ k: K.roundExists("r3"), v: false, ts: 2000 }], "me");
    m = merge(m, [{ k: K.roundExists("r3"), v: true, ts: 6000 }], "me");
    const back = project(m);
    expect(back.rounds.map((r) => r.id)).toEqual(["r3", "r4"]);
    expect(round2(individualResults(back).find((r) => r.pid === "c2")!.best)).toBe(EXPECTED.c2.best);
  });
});

describe("the draw is atomic", () => {
  it("two concurrent draws yield one whole roster, never a 5/3 split", () => {
    const d1: Fact = { k: K.draw(), v: { drawn: true, A: ["a", "b", "c", "d"], B: ["e", "f", "g", "h"] }, ts: 100 };
    const d2: Fact = { k: K.draw(), v: { drawn: true, A: ["e", "f", "g", "h"], B: ["a", "b", "c", "d"] }, ts: 200 };
    const m = merge(merge({}, [d1], "p1"), [d2], "p2");
    const t = project(m).teams;
    expect(t.A.members).toHaveLength(4);
    expect(t.B.members).toHaveLength(4);
    expect(t.A.members.filter((p) => t.B.members.includes(p))).toEqual([]);
  });
});

describe("projection is defensive about missing facts", () => {
  it("an empty event projects to an empty but valid state", () => {
    const s: EventState = project({});
    expect(s.players).toEqual([]);
    expect(s.teams.drawn).toBe(false);
    expect(s.rounds).toEqual([]);
  });
  it("a station added later reads null, not NaN", () => {
    const m = toMap([
      { k: K.playerName("c1"), v: "A", ts: 1 },
      { k: K.gameName("g1"), v: "Football", ts: 1 },
      { k: K.roundExists("r1"), v: true, ts: 1 },
    ]);
    expect(project(m).rounds[0].scores.c1!.g1).toBeNull();
  });
});
