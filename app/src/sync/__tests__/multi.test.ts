import { describe, it, expect } from "vitest";
import { aggregate, type LoadedEvent } from "../multi";
import type { EventState } from "../../domain/types";

/** Two events where the SAME person sits at a different player id, which is the
 *  trap: ids are only unique within an event. */
const mk = (
  id: string, name: string,
  players: string[], totals: Record<string, number[]>,
): LoadedEvent => {
  const state: EventState = {
    players: players.map((n, i) => ({ id: `p${i + 1}`, name: n })),
    games: [{ id: "g1", name: "Football" }],
    teams: { drawn: false, A: { name: "A", members: [] }, B: { name: "B", members: [] } },
    rounds: Object.values(totals)[0].map((_, ri) => ({
      id: `r${ri}`, label: `R${ri}`,
      scores: Object.fromEntries(players.map((n, i) => [`p${i + 1}`, { g1: totals[n][ri] }])),
    })),
    relays: [],
  };
  return { id, name, state };
};

const ev2025 = mk("e25", "Downtown 2025", ["Andy", "Sachin"], { Andy: [100, 120], Sachin: [60, 80] });
// note the order flips: Sachin is p1 here, Andy is p2
const ev2026 = mk("e26", "Pond Neck 2026", ["Sachin", "Andy"], { Sachin: [50, 70], Andy: [90, 110] });

describe("joining events", () => {
  const a = aggregate([ev2025, ev2026]);

  it("matches competitors by name, not by player id", () => {
    expect(a.career.map((c) => c.name).sort()).toEqual(["Andy", "Sachin"]);
    const sachin = a.career.find((c) => c.name === "Sachin")!;
    expect(sachin.events).toBe(2);
    expect(sachin.rounds).toBe(4);
  });

  it("weights the career average by rounds, not by event", () => {
    const sachin = a.career.find((c) => c.name === "Sachin")!;
    expect(sachin.careerAvg).toBe((60 + 80 + 50 + 70) / 4);
  });

  it("tracks best and worst across all years", () => {
    const andy = a.career.find((c) => c.name === "Andy")!;
    expect(andy.bestEver).toBe(90);
    expect(andy.worstEver).toBe(120);
  });

  it("credits a title per event won on average", () => {
    expect(a.career.find((c) => c.name === "Sachin")!.titles).toBe(2);
    expect(a.career.find((c) => c.name === "Andy")!.titles).toBe(0);
    expect(a.champions.map((c) => c.name)).toEqual(["Sachin", "Sachin"]);
  });

  it("orders the career table by career average", () => {
    expect(a.career[0].name).toBe("Sachin");
  });

  it("keeps a per-event average and finishing position for each competitor", () => {
    const andy = a.career.find((c) => c.name === "Andy")!;
    expect(andy.perEvent).toHaveLength(2);
    expect(andy.perEvent.every((e) => e.rank === 2)).toBe(true);
  });
});

describe("station records across years", () => {
  it("only shares a record between stations of the same name", () => {
    const other = mk("e27", "Other", ["Andy"], { Andy: [5] });
    other.state.games = [{ id: "g1", name: "Soccer" }];
    const a = aggregate([ev2025, other]);
    const names = a.stationRecords.map((s) => s.station).sort();
    expect(names).toEqual(["Football", "Soccer"]);
    expect(a.stationRecords.find((s) => s.station === "Soccer")!.v).toBe(5);
    expect(a.stationRecords.find((s) => s.station === "Football")!.v).toBe(60);
  });
});

describe("event order", () => {
  it("is chronological by the year in the name, not by when it was imported", async () => {
    const { chronological } = await import("../multi");
    const out = chronological([
      { ...ev2026, name: "Pond Neck 2026" },
      { ...ev2025, name: "Downtown Downington 2025" },
    ]);
    expect(out.map((e) => e.name)).toEqual(["Downtown Downington 2025", "Pond Neck 2026"]);
  });

  it("leaves events with no year in the order given", async () => {
    const { chronological } = await import("../multi");
    const a = { ...ev2025, name: "Spring Games" };
    const b = { ...ev2026, name: "Autumn Games" };
    expect(chronological([a, b]).map((e) => e.name)).toEqual(["Spring Games", "Autumn Games"]);
  });
});
