import { useEffect, useRef, useState } from "react";
import { useStore, putFacts, putFact } from "../sync/store";
import { K } from "../sync/facts";
import { parseTime, fmtClock } from "../lib/time";
import { roundTotal, rankBy } from "../lib/scoring";
import { pColor, pFigure, gColor } from "../lib/palette";
import RunTimer from "../run/RunTimer";
import { loadRun, type RunPersist } from "../run/useRunClock";

/**
 * Saves as you type (debounced), not on blur.
 *
 * On a phone, blur is not guaranteed: you can type a time and then lock the screen,
 * switch apps or have the keyboard dismissed without the field ever losing focus, and
 * a blur-only save loses the number silently. The store collapses repeated writes to
 * the same key, so typing "12.34" still costs one request.
 */
function ScoreCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  // Adopt an incoming value from another device, but never over something being typed.
  useEffect(() => {
    if (!dirty.current) setText(value == null ? "" : String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = parseTime(raw);
    if (parsed !== value) onCommit(parsed);
    dirty.current = false;
  };

  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        dirty.current = true;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => commit(raw), 500);
      }}
      onBlur={(e) => { window.clearTimeout(timer.current); commit(e.target.value); }}
    />
  );
}

export default function Pentathlon() {
  const view = useStore((s) => s.view);
  const [runFor, setRunFor] = useState<string | null>(null);
  const [only, setOnly] = useState<string | null>(null);
  const [ri, setRi] = useState(0);
  const [resume] = useState<RunPersist | null>(() => loadRun());

  const { players, games, rounds } = view;
  const round = rounds[Math.min(ri, Math.max(0, rounds.length - 1))];

  if (runFor && round) {
    const legs = only ? [only] : games.map((g) => g.name);
    const legIds = only ? [games.find((g) => g.name === only)!.id] : games.map((g) => g.id);
    return (
      <RunTimer
        who={players.find((p) => p.id === runFor)?.name ?? "Runner"}
        legs={legs}
        restore={resume && resume.who === players.find((p) => p.id === runFor)?.name ? resume : null}
        onExit={() => setRunFor(null)}
        onSave={(splits) => {
          putFacts(legIds.map((gid, i) => ({ k: K.score(round.id, runFor, gid), v: splits[i] })));
          setRunFor(null); setOnly(null);
        }}
      />
    );
  }

  if (!round) {
    return (
      <div className="card">
        <h2>No rounds yet</h2>
        <button className="bigbtn" onClick={() => putFacts([
          { k: K.roundExists("r1"), v: true },
          { k: K.roundLabel("r1"), v: "Round 1" },
          { k: K.roundOrd("r1"), v: 0 },
        ])}>Start Round 1</button>
      </div>
    );
  }

  const totals = players.map((p) => ({ id: p.id, value: roundTotal(round, p.id, games) }));
  const ranks = rankBy(totals, true);
  const addRound = () => {
    const id = "r" + (rounds.length + 1) + Math.random().toString(36).slice(2, 5);
    putFacts([
      { k: K.roundExists(id), v: true },
      { k: K.roundLabel(id), v: `Round ${rounds.length + 1}` },
      { k: K.roundOrd(id), v: rounds.length },
    ]);
    setRi(rounds.length);
  };

  return (
    <>
      <div className="rtabs">
        {rounds.map((r, i) => (
          <button key={r.id} className="rtab" aria-pressed={i === ri} onClick={() => setRi(i)}>
            {r.label}
          </button>
        ))}
        <button className="rtab add" onClick={addRound}>+ Round</button>
      </div>

      <div className="card">
        <h2>{round.label} &mdash; tap ▶ to time a full run</h2>
        <div className="modes" style={{ marginBottom: 12 }}>
          <button className="mode" aria-pressed={!only} onClick={() => setOnly(null)}>
            <b>All five</b><i>one continuous clock</i>
          </button>
          <button className="mode" aria-pressed={!!only}
            onClick={() => setOnly(only ?? games[0]?.name ?? null)}>
            <b>One station</b><i>re-run a single game</i>
          </button>
        </div>
        {only && (
          <div className="pickgrid" style={{ marginBottom: 12 }}>
            {games.map((g, i) => (
              <button key={g.id} className="pick" aria-pressed={only === g.name}
                onClick={() => setOnly(g.name)}>
                <span className="swatch" style={{ background: gColor(i) }} />{g.name}
              </button>
            ))}
          </div>
        )}

        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>Competitor</th>
                {games.map((g, i) => (
                  <th key={g.id} className="num" style={{ color: gColor(i) }}>
                    {g.name.slice(0, 4)}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const t = totals.find((x) => x.id === p.id)!.value;
                const rk = ranks.get(p.id);
                return (
                  <tr key={p.id} className={rk === 1 ? "r1" : ""}>
                    <td>
                      <span className="who">
                        <svg viewBox="0 0 60 80" style={{ color: pColor(p.id) }}>
                          <use href={`#${pFigure(p.id)}`} width="60" height="80" />
                        </svg>
                        <b>{p.name}</b>
                        <button className="runbtn" onClick={() => setRunFor(p.id)}>▶</button>
                      </span>
                    </td>
                    {games.map((g) => {
                      const v = round.scores[p.id]?.[g.id];
                      return (
                        <td key={g.id}>
                          <ScoreCell
                            value={v ?? null}
                            onCommit={(parsed) =>
                              putFact(K.score(round.id, p.id, g.id), parsed)}
                          />
                        </td>
                      );
                    })}
                    <td className="num tot">{fmtClock(t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          A total only counts once all {games.length} stations are in. Times sync to
          everyone else automatically.
        </p>
      </div>
    </>
  );
}
