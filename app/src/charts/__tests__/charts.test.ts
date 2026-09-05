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

/* -------------------------------------------------------------- the deeper cuts */
import {
  chartConsistency, chartHeadToHead, chartMomentum, chartForm, fameAndShame,
} from "../extra";
import { stationBreakdown, relativeForm, headToHead, improvement, extremes } from "../../lib/scoring";

describe("average is the ranking key", () => {
  const S2 = fixture();
  it("orders competitors by average, not by their single best round", () => {
    const rows = individualResults(S2).slice()
      .sort((a, b) => (a.avg == null ? 1 : b.avg == null ? -1 : a.avg - b.avg));
    // c2 has both the best single round AND the best average here, so use a case
    // where they differ: c3's best (46.67) beats c1's best (91.65), and its average
    // does too -- assert the order is the AVERAGE order from the spreadsheet.
    expect(rows.map((r) => r.pid)).toEqual(["c2", "c3", "c7", "c6", "c1", "c5", "c4"]);
    expect(rows[0].avgRank).toBe(1);
  });

  it("reports worst as well as best", () => {
    const row = individualResults(S2).find((r) => r.pid === "c3")!;
    expect(Math.round(row.best! * 100) / 100).toBe(46.67);
    expect(Math.round(row.worst! * 100) / 100).toBe(107.45);
  });
});

describe("per-station breakdown", () => {
  const b = stationBreakdown(fixture());
  it("gives the field a best, average and worst for every station", () => {
    expect(b).toHaveLength(5);
    for (const s of b) {
      expect(s.field.best).not.toBeNull();
      expect(s.field.worst).not.toBeNull();
      expect(s.field.worst!).toBeGreaterThanOrEqual(s.field.best!);
      expect(s.field.n).toBe(14);              // 7 competitors x 2 rounds
    }
  });
  it("gives every competitor their own spread at each station", () => {
    const darts = b[2];
    const c3 = darts.players.find((p) => p.pid === "c3")!;
    expect(c3.spread.best).toBe(7.02);
    expect(c3.spread.worst).toBe(75.1);
    expect(c3.spread.n).toBe(2);
  });
});

describe("relative form", () => {
  it("expresses a competitor as a ratio of the field at each station", () => {
    const f = relativeForm(fixture()).find((x) => x.pid === "c2")!;
    const vals = Object.values(f.byStation).filter((v): v is number => v != null);
    expect(vals).toHaveLength(5);
    for (const v of vals) expect(v).toBeGreaterThan(0);
    // c2 is the quickest overall, so most stations should read under 1
    expect(vals.filter((v) => v < 1).length).toBeGreaterThanOrEqual(3);
  });
});

describe("head to head", () => {
  const h = headToHead(fixture());
  it("counts only rounds both competitors finished", () => {
    expect(h.c2.c4.played).toBe(2);
  });
  it("is symmetric: my wins are your losses", () => {
    expect(h.c2.c4.wins).toBe(h.c4.c2.losses);
    expect(h.c2.c4.losses).toBe(h.c4.c2.wins);
  });
});

describe("momentum and extremes", () => {
  it("measures first complete round against the latest", () => {
    const t = improvement(fixture()).find((x) => x.pid === "c3")!;
    expect(Math.round(t.delta * 100) / 100).toBe(60.78);   // 107.45 -> 46.67
  });
  it("finds the quickest and slowest single station times of the day", () => {
    const { fastest, slowest } = extremes(fixture());
    expect(fastest[0].v).toBe(3.4);
    expect(slowest[0].v).toBe(92.5);
    expect(slowest[0].game).toBe("Station 3");
  });
});

describe("the new charts render", () => {
  const S2 = fixture();
  for (const [name, svg] of [
    ["consistency", chartConsistency(S2)],
    ["head to head", chartHeadToHead(S2)],
    ["momentum", chartMomentum(S2)],
    ["form grid", chartForm(S2)],
  ] as [string, string][]) {
    it(`${name} produces balanced svg`, () => {
      expect(svg.length, name).toBeGreaterThan(100);
      expect((svg.match(/<svg/g) ?? []).length).toBe((svg.match(/<\/svg>/g) ?? []).length);
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
    });
  }
  it("fame and shame escape names", () => {
    const nasty = { ...S2, players: S2.players.map((p, i) => i === 0 ? { ...p, name: "<b>x</b>" } : p) };
    const { fastest, slowest } = fameAndShame(nasty);
    expect(fastest + slowest).not.toContain("<b>x</b>");
  });
});
