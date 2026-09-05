/**
 * Server round-trip: facts pulled back out of the DEPLOYED API, projected, and scored.
 *
 * The snapshot in fixtures/server-snapshot.json was captured from the real DynamoDB via
 * the real Lambda, not hand-written. If projection or the wire format ever drifts, the
 * 2025 numbers stop matching here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { project } from "../facts";
import type { FactMap } from "../facts";
import { individualResults } from "../../lib/scoring";
import { EXPECTED, IDS } from "../../lib/__tests__/fixture";

const snap: FactMap = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "server-snapshot.json"), "utf8"),
);
const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

describe("data that made a full trip through DynamoDB still scores identically", () => {
  const state = project(snap);

  it("comes back with the whole roster and all five stations", () => {
    expect(state.players).toHaveLength(7);
    expect(state.games).toHaveLength(5);
    expect(state.rounds.map((r) => r.label)).toEqual(["Pentathlon 3", "Pentathlon 4"]);
  });

  it("every competitor's best, average and ranks survive the wire", () => {
    const rows = individualResults(state);
    for (const pid of IDS) {
      const exp = EXPECTED[pid as keyof typeof EXPECTED];
      const row = rows.find((r) => r.pid === pid)!;
      expect(round2(row.best), `${pid} best`).toBe(exp.best);
      expect(round2(row.avg), `${pid} avg`).toBe(exp.avg);
      expect(row.bestRank, `${pid} best rank`).toBe(exp.bestRank);
      expect(row.avgRank, `${pid} avg rank`).toBe(exp.avgRank);
    }
  });

  it("carries the server's ts and by on every fact, so LWW still works locally", () => {
    for (const [k, f] of Object.entries(snap)) {
      expect(typeof f.ts, k).toBe("number");
      expect(typeof f.by, k).toBe("string");
    }
  });
});
