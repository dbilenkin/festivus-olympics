import { useEffect, useState } from "react";
import RunTimer from "./run/RunTimer";
import { loadRun, type RunPersist } from "./run/useRunClock";
import { fmtRun } from "./lib/time";
import { pColor, pFigure } from "./lib/palette";

/** Preview build: roster and stations are local only. Sync and the full screens land next;
 *  the point of this build is to feel the timing interaction on a real phone. */
const ROSTER = ["Andy", "Chris", "Sachin", "Joe", "Gerard", "Malav", "Dimitri", "Pete"];
const STATIONS = ["Football", "Horseshoes", "Soccer", "Cornhole", "Basketball"];
const RESULTS_KEY = "pondneck.preview.results.v1";

interface Result { who: string; splits: number[]; total: number; at: number }

const loadResults = (): Result[] => {
  try { return JSON.parse(localStorage.getItem(RESULTS_KEY) || "[]"); } catch { return []; }
};

export default function App() {
  const [who, setWho] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [resume, setResume] = useState<RunPersist | null>(null);
  const [results, setResults] = useState<Result[]>(loadResults);

  // An interrupted run is offered back rather than silently lost.
  useEffect(() => { setResume(loadRun()); }, []);

  const save = (splits: number[]) => {
    const total = splits.reduce((a, b) => a + b, 0);
    const next = [{ who: who ?? "Runner", splits, total, at: Date.now() }, ...results].slice(0, 25);
    setResults(next);
    try { localStorage.setItem(RESULTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setRunning(false);
  };

  if (running && who) {
    return (
      <RunTimer
        who={who}
        legs={STATIONS}
        restore={resume && resume.who === who ? resume : null}
        onSave={save}
        onExit={() => { setRunning(false); setResume(null); }}
      />
    );
  }

  return (
    <div className="wrap">
      <div className="hero-lite">
        <h1>Pond Neck<br />Olympics</h1>
        <p>Timer preview</p>
      </div>

      {resume && (
        <div className="card" style={{ borderColor: "var(--barn)" }}>
          <h2>Unfinished run</h2>
          <p className="note" style={{ marginBottom: 12 }}>
            <b>{resume.who}</b> &mdash; {resume.marks.length} of {resume.legs.length} banked,
            started {Math.round((Date.now() - resume.startedWall) / 1000)}s ago.
            The clock has kept running.
          </p>
          <button className="bigbtn" onClick={() => { setWho(resume.who); setRunning(true); }}>
            Pick it back up
          </button>
          <button className="bigbtn" style={{ background: "var(--barn)", marginTop: 8 }}
            onClick={() => { localStorage.removeItem("pondneck.run.v2"); setResume(null); }}>
            Throw it away
          </button>
        </div>
      )}

      <div className="card">
        <h2>Who is running?</h2>
        <div className="pickgrid">
          {ROSTER.map((n, i) => {
            const id = `p${i + 1}`;
            return (
              <button key={n} className="pick" aria-pressed={who === n} onClick={() => setWho(n)}>
                <svg viewBox="0 0 60 80" style={{ color: pColor(id) }}>
                  <use href={`#${pFigure(id)}`} width="60" height="80" />
                </svg>
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Five stations, one clock</h2>
        <p className="note" style={{ marginBottom: 14 }}>
          {STATIONS.join(" → ")}. Start the clock, then tap once as each station finishes &mdash;
          it banks that split and starts the next in the same instant. The clock never pauses,
          so the splits always add up to the real total.
        </p>
        <button className="bigbtn" disabled={!who} onClick={() => setRunning(true)}>
          {who ? `Start ${who}'s run` : "Pick a runner first"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="card">
          <h2>Saved runs (this phone)</h2>
          {results.map((r, i) => (
            <div className="res" key={i}>
              <b>{r.who}</b>
              <span style={{ color: "var(--dirt)" }}>{r.splits.map((s) => s.toFixed(1)).join(" · ")}</span>
              <span>{fmtRun(r.total)}</span>
            </div>
          ))}
          <p className="note" style={{ marginTop: 12 }}>
            Saved on this device only &mdash; shared sync is the next piece.
          </p>
        </div>
      )}

      <p className="note" style={{ textAlign: "center" }}>
        Your real scorekeeper, untouched: <a href="legacy/">open it here</a>
      </p>
    </div>
  );
}
