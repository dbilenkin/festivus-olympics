/**
 * Regression cover for two bugs that reached a real phone.
 *
 *  1. The clock sat at 0:00.00 for the whole FIRST station. Starting the run only sets a
 *     ref and idx, neither of which changed the tick callback's identity, so the effect
 *     that owns the rAF loop never re-ran. It looked fine from station 2 onward, which is
 *     exactly why it survived desk testing.
 *
 *  2. The run body was 20px wider than its container (width:100% plus horizontal
 *     margins), pushing the right-hand border off the screen.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import RunTimer from "../RunTimer";

const LEGS = ["Football", "Horseshoes", "Soccer"];
const clockText = () => document.querySelector(".run-clock")!.textContent!;
const tap = async () => {
  const body = document.querySelector(".run-body")!;
  // isPrimary must be set explicitly -- fireEvent defaults it to false, and the handler
  // ignores non-primary pointers so a multi-touch does not double-bank a station.
  await act(async () => { fireEvent.pointerDown(body, { isPrimary: true }); });
};
/** Let real animation frames run. Anything under MIN_LEG_MS (400ms) between taps is
 *  swallowed by the double-tap guard, so gaps here must clear it deliberately. */
const GUARD_MS = 450;
const frames = async (ms = 120) => {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("the run clock", () => {
  it("starts ticking on the FIRST station, not the second", async () => {
    render(<RunTimer who="Dimitri" legs={LEGS} onSave={() => {}} onExit={() => {}} />);
    expect(clockText()).toBe("0:00.00");

    await tap();                       // start
    expect(screen.getByText(/now running . 1 of 3/i)).toBeTruthy();

    await frames(150);
    expect(clockText(), "clock is frozen through station 1").not.toBe("0:00.00");
  });

  it("keeps running across a bank into the next station", async () => {
    render(<RunTimer who="Dimitri" legs={LEGS} onSave={() => {}} onExit={() => {}} />);
    await tap();
    await frames(GUARD_MS);
    await tap();                       // bank leg 1
    expect(screen.getByText(/now running . 2 of 3/i)).toBeTruthy();
    const a = clockText();
    await frames(150);
    expect(clockText()).not.toBe(a);
  });

  it("hands back splits that sum to the total it displayed", async () => {
    let saved: number[] | null = null;
    render(<RunTimer who="Dimitri" legs={LEGS} onSave={(s) => { saved = s; }} onExit={() => {}} />);
    await tap();
    for (let i = 0; i < LEGS.length; i++) { await frames(GUARD_MS); await tap(); }

    const shown = [...document.querySelectorAll(".run-legs .t")]
      .map((e) => parseFloat(e.textContent!));
    expect(shown).toHaveLength(3);

    await act(async () => {
      (screen.getByText(/save to sheet/i) as HTMLButtonElement).click();
    });
    expect(saved).not.toBeNull();
    const sum = saved!.reduce((x, y) => x + y, 0);
    expect(Math.abs(sum - shown.reduce((x, y) => x + y, 0))).toBeLessThan(0.02);
  });

  it("ignores a second tap inside the double-tap guard", async () => {
    render(<RunTimer who="Dimitri" legs={LEGS} onSave={() => {}} onExit={() => {}} />);
    await tap();          // start
    await tap();          // immediate second tap -- must be swallowed
    expect(screen.getByText(/now running . 1 of 3/i)).toBeTruthy();
  });

  it("undo reopens the previous station rather than losing it", async () => {
    render(<RunTimer who="Dimitri" legs={LEGS} onSave={() => {}} onExit={() => {}} />);
    await tap();
    await frames(GUARD_MS);
    await tap();                                   // bank leg 1
    expect(screen.getByText(/now running . 2 of 3/i)).toBeTruthy();
    await act(async () => { (screen.getByText(/undo last/i) as HTMLButtonElement).click(); });
    expect(screen.getByText(/now running . 1 of 3/i)).toBeTruthy();
  });
});

describe("layout", () => {
  it("the tap target does not set an explicit width, which would overflow its margins", () => {
    render(<RunTimer who="Dimitri" legs={LEGS} onSave={() => {}} onExit={() => {}} />);
    const body = document.querySelector(".run-body") as HTMLElement;
    // guards the 20px overflow: width:100% + margin:8px 10px is wider than the container
    expect(body.style.width).toBe("");
  });
});
