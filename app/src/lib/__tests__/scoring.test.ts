import { describe, it, expect } from "vitest";
import {
  individualResults, roundTotal, rankBy, relayTeamTotal, relayStandings,
  records, bestRelayLeg,
} from "../scoring";
import { parseTime, fmtClock, fmtShort, fmtRun, fmtSecs } from "../time";
import { niceMax, inkOn, pColor, slotForId } from "../palette";
import { fixture, EXPECTED, IDS, GAME_IDS } from "./fixture";
import type { EventState, Relay } from "../../domain/types";

const S = fixture();
const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

describe("round totals match the 2025 spreadsheet", () => {
  for (const pid of IDS) {
    it(`${pid} pentathlon 3 + 4`, () => {
      expect(round2(roundTotal(S.rounds[0], pid, S.games))).toBe(EXPECTED[pid as keyof typeof EXPECTED].r3);
      expect(round2(roundTotal(S.rounds[1], pid, S.games))).toBe(EXPECTED[pid as keyof typeof EXPECTED].r4);
    });
  }
});

describe("best / average / ranks match the 2025 spreadsheet", () => {
  const rows = individualResults(S);
  for (const pid of IDS) {
    const exp = EXPECTED[pid as keyof typeof EXPECTED];
    const row = rows.find((r) => r.pid === pid)!;
    it(`${pid}`, () => {
      expect(round2(row.best)).toBe(exp.best);
      expect(round2(row.avg)).toBe(exp.avg);
      expect(row.bestRank).toBe(exp.bestRank);
      expect(row.avgRank).toBe(exp.avgRank);
    });
  }
});

describe("a round only counts when every station is in", () => {
  it("one missing station makes the whole round null", () => {
    const s: EventState = JSON.parse(JSON.stringify(S));
    delete s.rounds[0].scores.c1![GAME_IDS[2]];
    expect(roundTotal(s.rounds[0], "c1", s.games)).toBeNull();
    // ...and that player then ranks on their remaining round only
    const row = individualResults(s).find((r) => r.pid === "c1")!;
    expect(round2(row.best)).toBe(EXPECTED.c1.r4);
    expect(row.completed).toBe(1);
  });
  it("a null station is treated the same as a missing one", () => {
    const s: EventState = JSON.parse(JSON.stringify(S));
    s.rounds[0].scores.c1![GAME_IDS[0]] = null;
    expect(roundTotal(s.rounds[0], "c1", s.games)).toBeNull();
  });
});

describe("per-station bests", () => {
  it("takes the lower of the two rounds", () => {
    const row = individualResults(S).find((r) => r.pid === "c3")!;
    expect(row.perGameBest.g3).toBe(7.02); // 75.10 in P3, 7.02 in P4
    expect(row.perGameBest.g1).toBe(3.4);  //  3.40 in P3, 3.50 in P4
  });
});

describe("rankBy", () => {
  it("ties share a rank and the next rank is skipped", () => {
    const m = rankBy([
      { id: "a", value: 10 }, { id: "b", value: 10 }, { id: "c", value: 12 },
    ], true);
    expect(m.get("a")).toBe(1);
    expect(m.get("b")).toBe(1);
    expect(m.get("c")).toBe(3);
  });
  it("leaves entries without a value unranked", () => {
    const m = rankBy([{ id: "a", value: 5 }, { id: "b", value: null }], true);
    expect(m.get("b")).toBeUndefined();
  });
});

describe("relays", () => {
  const mk = (a: (number | null)[], b: (number | null)[]): Relay => ({
    id: "y1", label: "Relay 1", legs: GAME_IDS,
    entries: {
      A: { lineup: ["c1", "c3", "c5", "c7", "c1"], splits: a },
      B: { lineup: ["c2", "c4", "c6", "c2", "c4"], splits: b },
    },
  });

  it("a team time is null until all five legs are in", () => {
    expect(relayTeamTotal(mk([1, 2, 3, 4, null], [1, 1, 1, 1, 1]), "A")).toBeNull();
    expect(round2(relayTeamTotal(mk([1, 2, 3, 4, 5], [1, 1, 1, 1, 1]), "A"))).toBe(15);
  });

  it("the lower total wins, and a dead heat splits the win", () => {
    const won = relayStandings([mk([1, 1, 1, 1, 1], [2, 2, 2, 2, 2])]);
    expect(won.A.wins).toBe(1);
    expect(won.B.wins).toBe(0);
    const tied = relayStandings([mk([1, 1, 1, 1, 1], [1, 1, 1, 1, 1])]);
    expect(tied.A.wins).toBe(0.5);
    expect(tied.B.wins).toBe(0.5);
  });

  it("an incomplete relay counts for nobody", () => {
    const st = relayStandings([mk([1, 1, 1, 1, null], [2, 2, 2, 2, 2])]);
    expect(st.A.wins).toBe(0);
    expect(st.B.wins).toBe(0);
    expect(st.B.run).toBe(1);
  });

  it("finds a runner's fastest leg across relays", () => {
    const best = bestRelayLeg([mk([9, 1, 1, 1, 4], [1, 1, 1, 1, 1])], "c1");
    expect(best).toEqual({ v: 4, gid: "g5" }); // c1 runs legs 0 and 4; 4 < 9
  });
});

describe("the record book", () => {
  const rec = records(S);
  it("finds the fastest pentathlon on the day", () => {
    expect(rec.pent!.pid).toBe("c2");
    expect(round2(rec.pent!.v)).toBe(37.2);
  });
  it("finds a record for every station", () => {
    expect(rec.stations).toHaveLength(5);
    expect(rec.stations[2].best!.v).toBe(3.75); // fastest Darts across both rounds
  });
});

describe("time parsing and formatting", () => {
  it("accepts seconds, m:ss and m:ss.ss", () => {
    expect(parseTime("82.4")).toBe(82.4);
    expect(parseTime("1:22")).toBe(82);
    expect(parseTime("1:22.4")).toBeCloseTo(82.4, 6);
  });
  it("rejects junk, blanks and non-positive times", () => {
    for (const bad of ["", "  ", "abc", "0", null, undefined]) {
      expect(parseTime(bad as string)).toBeNull();
    }
  });
  it("formats consistently with the legacy app", () => {
    expect(fmtClock(82.4)).toBe("1:22.4");
    expect(fmtShort(82.4)).toBe("1:22");
    expect(fmtRun(82.47)).toBe("1:22.47");
    expect(fmtSecs(3.4)).toBe("3.40");
    expect(fmtClock(null)).toBe("—");
  });
  it("pads seconds under ten", () => {
    expect(fmtClock(65)).toBe("1:05.0");
    expect(fmtShort(65)).toBe("1:05");
  });
});

describe("chart helpers", () => {
  it("niceMax lands ticks on round numbers", () => {
    expect(niceMax(150)).toBe(160); // 0:00 0:40 1:20 2:00 2:40
    expect(niceMax(92.5)).toBe(120);
    expect(niceMax(0)).toBe(10);
  });
  it("inkOn picks readable text for a fill", () => {
    expect(inkOn("#b8891f")).toBe("#fff8e2"); // dark gold -> light text
    expect(inkOn("#f6d97a")).toBe("#2a2118"); // pale gold -> dark text
  });
});

describe("player colour is stable across devices", () => {
  it("depends on the id, not on array position", () => {
    // the bug this guards: two phones with different sort orders showing the same
    // person in different colours mid-event
    expect(slotForId("p3")).toBe(2);
    expect(pColor("p3")).toBe(pColor("p3"));
    const shuffled = ["p8", "p1", "p3"];
    expect(shuffled.map(pColor)).toEqual([pColor("p8"), pColor("p1"), pColor("p3")]);
  });
  it("handles non-standard ids without colliding into one slot", () => {
    const slots = new Set(["abc", "xyz", "hello", "world"].map(slotForId));
    expect(slots.size).toBeGreaterThan(1);
  });
});
