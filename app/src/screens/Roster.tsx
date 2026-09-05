import { useStore, putFact, putFacts } from "../sync/store";
import { K } from "../sync/facts";
import { pColor, pFigure, gColor } from "../lib/palette";
import LiveInput from "../components/LiveInput";

const text = (v: string) => v;

export default function Roster() {
  const view = useStore((s) => s.view);
  const { players, games } = view;

  const addPlayer = () => {
    const n = players.length + 1;
    putFacts([
      { k: K.playerName(`p${n}`), v: `Player ${n}` },
      { k: K.playerOrd(`p${n}`), v: players.length },
    ]);
  };

  return (
    <div className="deck2">
      <div className="card">
        <h2>The competitors</h2>
        <p className="note" style={{ marginBottom: 12 }}>
          Renaming is safe at any point &mdash; scores follow the person, not the name.
        </p>
        {players.map((p) => (
          <label key={p.id} className="rosterrow">
            <svg viewBox="0 0 60 80" style={{ color: pColor(p.id) }}>
              <use href={`#${pFigure(p.id)}`} width="60" height="80" />
            </svg>
            <LiveInput<string>
              value={p.name}
              format={text}
              parse={(r) => r.slice(0, 24)}
              maxLength={24}
              onCommit={(v) => putFact(K.playerName(p.id), v)}
            />
          </label>
        ))}
        {players.length < 12 && (
          <button className="rowbtn" onClick={addPlayer}>
            <b>+ Add a competitor</b>
          </button>
        )}
      </div>

      <div className="card">
        <h2>The five stations</h2>
        <p className="note" style={{ marginBottom: 12 }}>
          All scored the same way: <b>a time in seconds, lowest wins</b>. Swap in anything
          &mdash; Ladder Golf, Spikeball, Bale Toss. The order here is the order a run
          goes through them.
        </p>
        {games.map((g, i) => (
          <label key={g.id} className="rosterrow">
            <span className="swatch" style={{ background: gColor(i) }} />
            <LiveInput<string>
              value={g.name}
              format={text}
              parse={(r) => r.slice(0, 24)}
              maxLength={24}
              onCommit={(v) => putFact(K.gameName(g.id), v)}
            />
          </label>
        ))}
        <p className="note" style={{ marginTop: 10 }}>
          Renaming a station renames it everywhere, including in results already recorded.
        </p>
      </div>
    </div>
  );
}
