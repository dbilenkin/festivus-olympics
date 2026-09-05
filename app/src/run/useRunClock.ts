import { useCallback, useEffect, useRef, useState } from "react";

const MIN_LEG_MS = 400;          // below any real station change, above any fat-fingered double tap
const RUN_KEY = "pondneck.run.v2";

export interface RunPersist {
  v: 2; legs: string[]; who: string; startedWall: number; marks: number[]; done: boolean;
}

/** Splits are derived from cumulative marks, so they always sum to the total exactly. */
export const splitsOf = (marks: number[]): number[] =>
  marks.map((m, i) => m - (i ? marks[i - 1] : 0));

export function loadRun(): RunPersist | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o?.v === 2 && Array.isArray(o.marks) && o.marks.length ? o : null;
  } catch { return null; }
}
export function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch { /* ignore */ } }

export function useRunClock(legs: string[], who: string, restore?: RunPersist | null) {
  const [idx, setIdx] = useState(restore ? restore.marks.length : -1);
  const [marks, setMarks] = useState<number[]>(restore ? restore.marks : []);
  const [done, setDone] = useState(!!restore?.done);

  const t0 = useRef(0);                     // performance.now() origin
  const startedWall = useRef(0);            // Date.now() origin, so a reload can rebase
  const endAt = useRef(0);
  const lastTap = useRef(0);
  const clockEl = useRef<HTMLDivElement | null>(null);
  const splitEl = useRef<HTMLDivElement | null>(null);
  const raf = useRef(0);

  // Rebase a restored run against the wall clock -- the run kept going while the page
  // was gone, so the elapsed time must reflect that, not restart from zero.
  useEffect(() => {
    if (!restore) return;
    startedWall.current = restore.startedWall;
    t0.current = performance.now() - (Date.now() - restore.startedWall);
    if (restore.done && restore.marks.length) {
      endAt.current = t0.current + restore.marks[restore.marks.length - 1] * 1000;
    }
  }, [restore]);

  const elapsed = useCallback(
    () => (t0.current ? ((endAt.current || performance.now()) - t0.current) / 1000 : 0),
    [],
  );

  const persist = useCallback((m: number[], d: boolean) => {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify({
        v: 2, legs, who, startedWall: startedWall.current, marks: m, done: d,
      } satisfies RunPersist));
    } catch { /* quota or private mode: the run still works, it just can't be recovered */ }
  }, [legs, who]);

  /** The clock is written straight to the DOM. A 60fps setState would re-render the
   *  subtree every frame and visibly jank on an older phone. */
  const tick = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const e = elapsed();
    if (clockEl.current) {
      const m = Math.floor(e / 60), s = e - m * 60;
      clockEl.current.textContent = `${m}:${s < 10 ? "0" : ""}${s.toFixed(2)}`;
    }
    if (splitEl.current) {
      const last = marks.length ? marks[marks.length - 1] : 0;
      splitEl.current.textContent = (e - last).toFixed(2);
    }
    if (t0.current && !endAt.current) raf.current = requestAnimationFrame(tick);
  }, [elapsed, marks]);

  // idx and done are dependencies even though tick does not read them: starting the
  // clock only sets a ref (t0) and idx, neither of which changes tick's identity, so
  // keying this on [tick] alone left the rAF loop unstarted until the first bank --
  // the clock sat at 0:00.00 through the whole first station.
  useEffect(() => {
    tick();
    return () => cancelAnimationFrame(raf.current);
  }, [tick, idx, done]);

  /**
   * Advance. Called from pointerdown, not click -- that is 80-150ms earlier, which is the
   * difference between a split that feels honest and one that does not.
   */
  const advance = useCallback((eventTime?: number) => {
    const now = performance.now();
    if (now - lastTap.current < MIN_LEG_MS) return;     // double-tap guard
    lastTap.current = now;

    if (idx < 0) {                                      // start
      t0.current = eventTime && Math.abs(eventTime - now) < 1000 ? eventTime : now;
      startedWall.current = Date.now();
      setIdx(0);
      persist([], false);
      return;
    }
    const at = eventTime && Math.abs(eventTime - now) < 1000 ? eventTime : now;
    const m = [...marks, (at - t0.current) / 1000];
    setMarks(m);
    if (m.length >= legs.length) {
      endAt.current = at;
      setDone(true);
      persist(m, true);
    } else {
      setIdx(m.length);
      persist(m, false);
    }
  }, [idx, marks, legs.length, persist]);

  const undo = useCallback(() => {
    if (done || !marks.length) return;
    const m = marks.slice(0, -1);
    setMarks(m); setIdx(m.length); persist(m, false);
  }, [done, marks, persist]);

  const reset = useCallback(() => {
    t0.current = 0; endAt.current = 0; startedWall.current = 0;
    setMarks([]); setIdx(-1); setDone(false); clearRun();
  }, []);

  return { idx, marks, done, advance, undo, reset, clockEl, splitEl, elapsed,
           splits: splitsOf(marks) };
}
