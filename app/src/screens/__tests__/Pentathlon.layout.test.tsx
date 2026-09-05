/**
 * The score grid has to be usable on both a laptop and a phone, and the two want
 * genuinely different shapes:
 *
 *  - laptop: a table, because comparing eight people across five stations is the point
 *  - phone:  a card per competitor, because a five-column numeric grid cannot fit beside
 *            the names and sideways-scrolling to reach Basketball is miserable
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import Pentathlon from "../Pentathlon";
import { useStore } from "../../sync/store";
import { project } from "../../sync/facts";

const GAMES = ["Football", "Horseshoes", "Soccer", "Cornhole", "Basketball"];

function seed() {
  const ts = 1;
  const facts: Record<string, { v: unknown; ts: number; by: string }> = {};
  const put = (k: string, v: unknown) => { facts[k] = { v, ts, by: "t" }; };
  ["Andy", "Chris"].forEach((n, i) => {
    put(`player.p${i + 1}.name`, n); put(`player.p${i + 1}.ord`, i);
  });
  GAMES.forEach((g, i) => { put(`game.g${i + 1}.name`, g); put(`game.g${i + 1}.ord`, i); });
  put("round.r1.exists", true); put("round.r1.label", "Round 1"); put("round.r1.ord", 0);
  put("score.r1.p1.g1", 3.75);
  useStore.setState({ eventId: "e1", server: facts, outbox: [], view: project(facts) });
}

/** matchMedia does not exist in happy-dom; the layout hook depends on it. */
function setViewport(wide: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: wide,
    media: q,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }));
}

beforeEach(() => { localStorage.clear(); seed(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("laptop", () => {
  it("renders a table with every station named in full, plus a Total column", () => {
    setViewport(true);
    render(<Pentathlon />);
    expect(document.querySelector("table")).toBeTruthy();
    for (const g of GAMES) expect(screen.getAllByText(g).length).toBeGreaterThan(0);
    expect(screen.getByText("Total")).toBeTruthy();
    expect(document.querySelectorAll(".pcard")).toHaveLength(0);
  });
});

describe("phone", () => {
  it("renders one card per competitor instead of a table", () => {
    setViewport(false);
    render(<Pentathlon />);
    expect(document.querySelector("table")).toBeNull();
    expect(document.querySelectorAll(".pcard")).toHaveLength(2);
  });

  it("shows all five stations, labelled, on every card -- no sideways scrolling", () => {
    setViewport(false);
    render(<Pentathlon />);
    for (const card of document.querySelectorAll(".pcard")) {
      const labels = [...card.querySelectorAll(".scell span")].map((e) => e.textContent);
      expect(labels).toEqual(GAMES);
      expect(card.querySelectorAll(".scell input")).toHaveLength(5);
    }
  });

  it("keeps the run button and the running total reachable on each card", () => {
    setViewport(false);
    render(<Pentathlon />);
    const first = document.querySelector(".pcard")!;
    expect(first.querySelector(".runbtn")).toBeTruthy();
    expect(first.querySelector(".ptot")).toBeTruthy();
  });

  it("carries existing values through to the phone layout", () => {
    setViewport(false);
    render(<Pentathlon />);
    const andy = document.querySelector(".pcard")!;
    const first = andy.querySelector(".scell input") as HTMLInputElement;
    expect(first.value).toBe("3.75");
  });
});
