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

  it("stepping back reopens the previous station rather than losing it", async () => {
    render(<RunTimer who="Dimitri" legs={LEGS} onSave={() => {}} onExit={() => {}} />);
    await tap();
    await frames(GUARD_MS);
    await tap();                                   // bank leg 1
    expect(screen.getByText(/now running . 2 of 3/i)).toBeTruthy();
    await act(async () => { (screen.getByText(/back to Football/i) as HTMLButtonElement).click(); });
    expect(screen.getByText(/now running . 1 of 3/i)).toBeTruthy();
  });

  it("the button names the station you land back on", async () => {
    render(<RunTimer who="Dimitri" legs={LEGS} onSave={() => {}} onExit={() => {}} />);
    await tap();
    await frames(GUARD_MS); await tap();           // now on Horseshoes
    expect(screen.getByText(/back to Football/i)).toBeTruthy();
    await frames(GUARD_MS); await tap();           // now on Soccer
    expect(screen.getByText(/back to Horseshoes/i)).toBeTruthy();
  });

  /** The behaviour the whole feature exists for: a premature tap must be recoverable
   *  with NO time lost -- the reopened station reclaims every second, including what
   *  leaked into the station that was started by mistake. */
  it("gives every leaked second back to the reopened station", async () => {
    let saved: number[] | null = null;
    render(<RunTimer who="Dimitri" legs={["A", "B"]} onSave={(x) => { saved = x; }} onExit={() => {}} />);
    await tap();                                   // start A
    await frames(GUARD_MS);
    await tap();                                   // PREMATURE bank of A
    await frames(GUARD_MS);                        // time leaks into B
    await act(async () => { (screen.getByText(/back to A/i) as HTMLButtonElement).click(); });
    expect(screen.getByText(/now running . 1 of 2/i)).toBeTruthy();

    await frames(GUARD_MS);
    await tap();                                   // properly bank A
    await frames(GUARD_MS);
    await tap();                                   // finish B

    await act(async () => { (screen.getByText(/save to sheet/i) as HTMLButtonElement).click(); });
    const [a, b] = saved!;
    // A absorbed the premature bank plus the leak plus the rest: ~3 guard periods.
    expect(a).toBeGreaterThan(GUARD_MS * 2.5 / 1000);
    // B only ran after the correct bank: ~1 guard period.
    expect(b).toBeLessThan(GUARD_MS * 2 / 1000);
  });

  it("can step back from the summary, and the clock resumes rather than jumping", async () => {
    render(<RunTimer who="Dimitri" legs={["A", "B"]} onSave={() => {}} onExit={() => {}} />);
    await tap();
    await frames(GUARD_MS); await tap();
    await frames(GUARD_MS); await tap();           // done
    expect(screen.getByText(/run complete/i)).toBeTruthy();
    const finished = parseFloat(clockText().split(":")[1]);

    await act(async () => { (screen.getByText(/back to B/i) as HTMLButtonElement).click(); });
    expect(screen.getByText(/now running . 2 of 2/i)).toBeTruthy();
    // resumes from the total it was showing, not from wall-clock time spent reading it
    const resumed = parseFloat(clockText().split(":")[1]);
    expect(Math.abs(resumed - finished)).toBeLessThan(0.5);
  });

  it("a clock started by accident can be restarted before anything is banked", async () => {
    render(<RunTimer who="Dimitri" legs={LEGS} onSave={() => {}} onExit={() => {}} />);
    await tap();
    await frames(300);
    expect(parseFloat(clockText().split(":")[1])).toBeGreaterThan(0.1);
    await act(async () => { (screen.getByText(/restart clock/i) as HTMLButtonElement).click(); });
    await frames(30);
    expect(parseFloat(clockText().split(":")[1])).toBeLessThan(0.2);
  });
});

describe("single-station mode", () => {
  it("one leg: start, finish, one split that is the whole total", async () => {
    let saved: number[] | null = null;
    render(<RunTimer who="Dimitri" legs={["Cornhole"]} onSave={(x) => { saved = x; }} onExit={() => {}} />);
    expect(screen.getByText(/one station, one clock/i)).toBeTruthy();
    await tap();
    expect(screen.getByText(/tap to finish/i)).toBeTruthy();
    await frames(GUARD_MS);
    await tap();
    expect(screen.getByText(/run complete/i)).toBeTruthy();
    await act(async () => { (screen.getByText(/save to sheet/i) as HTMLButtonElement).click(); });
    expect(saved).toHaveLength(1);
    expect(saved![0]).toBeGreaterThan(0.3);
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
