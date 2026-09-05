/**
 * The charts are string builders, so the thing worth asserting is that each produces
 * well-formed SVG from real data -- and, critically, that a hostile name cannot escape
 * into the markup. These bodies are set as innerHTML and names arrive from a wide-open
 * API, so esc() is a security control, not formatting.
 */
import { describe, it, expect } from "vitest";
import {
  ctxOf, chartLeaderboard, chartStacked, chartProgress, chartStationSmalls,
  chartRelays, chartRelayLegs, chartStationRange, chartStationPie,
} from "../charts";
import { individualResults } from "../../lib/scoring";
import { fixture } from "../../lib/__tests__/fixture";
import type { EventState } from "../../domain/types";

const S = fixture();
const withRelay = (): EventState => ({
  ...S,
  relays: [{
    id: "y1", label: "Relay 1", legs: ["g1", "g2", "g3", "g4", "g5"],
    entries: {
      A: { lineup: ["c1", "c3", "c5", "c7", "c1"], splits: [12.4, 18.9, 9.2, 14.6, 11.1] },
      B: { lineup: ["c2", "c4", "c6", "c2", "c4"], splits: [10.2, 21.4, 8.8, 16.3, 9.7] },
    },
  }],
});

const balanced = (svg: string) => {
  const open = (svg.match(/<svg/g) ?? []).length;
  const close = (svg.match(/<\/svg>/g) ?? []).length;
  return open > 0 && open === close;
};

describe("every chart renders from real data", () => {
  const st = withRelay();
  const C = ctxOf(st);
  const res = individualResults(st);
  const charts: [string, string][] = [
    ["leaderboard", chartLeaderboard(res, C)],
    ["stacked", chartStacked(res, C)],
    ["progress", chartProgress(res, C)],
    ["station smalls", chartStationSmalls(res, C)],
    ["relay ledger", chartRelays(C)],
    ["relay legs", chartRelayLegs(C)],
    ["station range", chartStationRange(C)],
    ["station pie", chartStationPie(C)],
  ];

  for (const [name, svg] of charts) {
    it(`${name} produces balanced svg with no stray template markers`, () => {
      expect(svg.length, name).toBeGreaterThan(100);
      expect(balanced(svg), `${name} svg tags unbalanced`).toBe(true);
      expect(svg).not.toContain("undefined");
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("[object Object]");
    });
  }

  it("the pie's slices account for the whole day", () => {
    const svg = chartStationPie(C);
    const pcts = [...svg.matchAll(/>([\d.]+)%</g)].map((m) => parseFloat(m[1]));
    expect(pcts.length).toBeGreaterThan(0);
    expect(pcts.reduce((a, b) => a + b, 0)).toBeGreaterThan(95);
  });
});

describe("charts survive an empty event", () => {
  const empty: EventState = {
    players: [], games: [], rounds: [], relays: [],
    teams: { drawn: false, A: { name: "A", members: [] }, B: { name: "B", members: [] } },
  };
  const C = ctxOf(empty);
  it("returns empty strings rather than throwing or drawing nonsense", () => {
    expect(chartLeaderboard([], C)).toBe("");
    expect(chartRelays(C)).toBe("");
    expect(chartStationRange(C)).toBe("");
    expect(chartStationPie(C)).toBe("");
  });
});

describe("a hostile name cannot escape into the markup", () => {
  it("is escaped everywhere a name is interpolated", () => {
    const nasty = '"><script>alert(1)</script>';
    const st: EventState = {
      ...withRelay(),
      players: withRelay().players.map((p, i) => (i === 0 ? { ...p, name: nasty } : p)),
    };
    const C = ctxOf(st);
    const res = individualResults(st);
    for (const svg of [
      chartLeaderboard(res, C), chartStacked(res, C), chartProgress(res, C),
      chartStationSmalls(res, C), chartStationRange(C),
    ]) {
      expect(svg).not.toContain("<script>");
      if (svg.includes("script")) expect(svg).toContain("&lt;script&gt;");
    }
  });
});
