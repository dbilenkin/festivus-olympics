/**
 * The 2025 Festivus pentathlon, pentathlons 3 and 4.
 *
 * These numbers come from the original spreadsheet, which computed Best / Average /
 * Best Rank / Avg Rank independently of any code in this repo. That makes them a real
 * regression harness: if a refactor changes any of these, the maths broke.
 *
 * Competitors are anonymised to c1..c7 on purpose -- the arithmetic is what regresses,
 * not the names, and this repo is public.
 */
import type { EventState } from "../../domain/types";

export const GAME_IDS = ["g1", "g2", "g3", "g4", "g5"];

/** [Football, Horseshoes, Darts, Cornhole, Basketball] */
export const PENT_3: Record<string, number[]> = {
  c1: [3.75, 34.8, 10.68, 13.29, 29.13],
  c2: [4.4, 5, 9.9, 11.2, 6.7],
  c3: [3.4, 5.1, 75.1, 14.1, 9.75],
  c4: [17.17, 25, 44.4, 33.5, 38.8],
  c5: [17.4, 35.2, 23.75, 9.6, 14.2],
  c6: [33, 44, 8, 16, 16],
  c7: [25, 61, 3.75, 18.1, 10.3],
};

export const PENT_4: Record<string, number[]> = {
  c1: [15.2, 13.95, 69.84, 7.33, 7.75],
  c2: [4.7, 22.62, 44.1, 8.8, 10.14],
  c3: [3.5, 18.03, 7.02, 9.77, 8.35],
  c4: [27.61, 56.4, 26.45, 9.71, 11.03],
  c5: [23, 11.85, 92.5, 17.31, 10.45],
  c6: [55.28, 4.57, 6.21, 9.22, 7.09],
  c7: [44.19, 4.2, 5.35, 8.29, 9.76],
};

/** Straight off the spreadsheet. Not computed by this codebase. */
export const EXPECTED = {
  c1: { r3: 91.65,  r4: 114.07, best: 91.65,  avg: 102.86, bestRank: 5, avgRank: 5 },
  c2: { r3: 37.2,   r4: 90.36,  best: 37.2,   avg: 63.78,  bestRank: 1, avgRank: 1 },
  c3: { r3: 107.45, r4: 46.67,  best: 46.67,  avg: 77.06,  bestRank: 2, avgRank: 2 },
  c4: { r3: 158.87, r4: 131.2,  best: 131.2,  avg: 145.04, bestRank: 7, avgRank: 7 },
  c5: { r3: 100.15, r4: 155.11, best: 100.15, avg: 127.63, bestRank: 6, avgRank: 6 },
  c6: { r3: 117,    r4: 82.37,  best: 82.37,  avg: 99.69,  bestRank: 4, avgRank: 4 },
  c7: { r3: 118.15, r4: 71.79,  best: 71.79,  avg: 94.97,  bestRank: 3, avgRank: 3 },
};

export const IDS = Object.keys(PENT_3);

function mkRound(id: string, label: string, src: Record<string, number[]>) {
  const scores: EventState["rounds"][number]["scores"] = {};
  for (const pid of IDS) {
    const row: Record<string, number> = {};
    GAME_IDS.forEach((g, i) => { row[g] = src[pid][i]; });
    scores[pid] = row;
  }
  return { id, label, scores };
}

export function fixture(): EventState {
  return {
    players: IDS.map((id) => ({ id, name: id.toUpperCase() })),
    games: GAME_IDS.map((id, i) => ({ id, name: `Station ${i + 1}` })),
    teams: {
      drawn: true,
      A: { name: "Side A", members: ["c1", "c3", "c5", "c7"] },
      B: { name: "Side B", members: ["c2", "c4", "c6"] },
    },
    rounds: [mkRound("r3", "Pentathlon 3", PENT_3), mkRound("r4", "Pentathlon 4", PENT_4)],
    relays: [],
  };
}
