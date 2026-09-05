import { useState } from "react";
import { useStore, putFacts, putFact } from "../sync/store";
import { K } from "../sync/facts";
import { parseTime, fmtClock } from "../lib/time";
import { roundTotal, rankBy } from "../lib/scoring";
import { pColor, pFigure, gColor } from "../lib/palette";
import { useWide } from "../lib/useMedia";
import LiveInput from "../components/LiveInput";
import RunTimer from "../run/RunTimer";
import { loadRun, type RunPersist } from "../run/useRunClock";

/** A score cell: seconds, or m:ss, or blank to clear. */
function ScoreCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  return (
    <LiveInput<number | null>
      inputMode="decimal"
      value={value}
      format={(v) => (v == null ? "" : String(v))}
      parse={parseTime}
      onCommit={onCommit}
    />
  );
}

export default function Pentathlon() {
  const view = useStore((s) => s.view);
  const [runFor, setRunFor] = useState<string | null>(null);
  const [only, setOnly] = useState<string | null>(null);
  const [ri, setRi] = useState(0);
  const [resume] = useState<RunPersist | null>(() => loadRun());

  const wide = useWide();
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
        <button className="btn lg green" onClick={() => putFacts([
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
      <div className="round-tabs">
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

        {wide ? (
          <div className="tbl-wrap">
            <table className="entrytable">
              <thead>
                <tr>
                  <th>Competitor</th>
                  {games.map((g, i) => (
                    <th key={g.id} className="num">
                      <span className="sthead">
                        <i style={{ background: gColor(i) }} />{g.name}
                      </span>
                    </th>
                  ))}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const t = totals.find((x) => x.id === p.id)!.value;
                  return (
                    <tr key={p.id} className={ranks.get(p.id) === 1 ? "r1" : ""}>
                      <td>
                        <span className="who">
                          <svg viewBox="0 0 60 80" style={{ color: pColor(p.id) }}>
                            <use href={`#${pFigure(p.id)}`} width="60" height="80" />
                          </svg>
                          <b>{p.name}</b>
                          <button className="runbtn" title={`Time ${p.name}`}
                            onClick={() => setRunFor(p.id)}>&#9654;</button>
                        </span>
                      </td>
                      {games.map((g) => (
                        <td key={g.id}>
                          <ScoreCell value={round.scores[p.id]?.[g.id] ?? null}
                            onCommit={(v) => putFact(K.score(round.id, p.id, g.id), v)} />
                        </td>
                      ))}
                      <td className="num tot">{fmtClock(t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* On a phone a five-column numeric grid cannot fit beside the names, and
             sideways-scrolling to reach Basketball is miserable. One card per
             competitor keeps every station visible and labelled. */
          <div className="cards">
            {players.map((p) => {
              const t = totals.find((x) => x.id === p.id)!.value;
              const rk = ranks.get(p.id);
              return (
                <div className={"pcard" + (rk === 1 ? " lead" : "")} key={p.id}>
                  <div className="pcard-hd">
                    <svg viewBox="0 0 60 80" style={{ color: pColor(p.id) }}>
                      <use href={`#${pFigure(p.id)}`} width="60" height="80" />
                    </svg>
                    <b>{p.name}</b>
                    <span className="ptot">{fmtClock(t)}</span>
                    <button className="runbtn big" onClick={() => setRunFor(p.id)}>
                      &#9654;<em>Run</em>
                    </button>
                  </div>
                  <div className="pcard-grid">
                    {games.map((g, i) => (
                      <label key={g.id} className="scell">
                        <span style={{ color: gColor(i) }}>{g.name}</span>
                        <ScoreCell value={round.scores[p.id]?.[g.id] ?? null}
                          onCommit={(v) => putFact(K.score(round.id, p.id, g.id), v)} />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="note" style={{ marginTop: 10 }}>
          A total only counts once all {games.length} stations are in. Times sync to
          everyone else automatically.
        </p>
      </div>
    </>
  );
}
