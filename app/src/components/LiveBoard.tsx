import { useStore } from "../sync/store";
import { individualResults } from "../lib/scoring";
import { fmtClock } from "../lib/time";
import { pColor, pFigure } from "../lib/palette";

/** Laptop-only sidebar: who is winning, without leaving the entry grid. This is the
 *  view for a laptop propped on the picnic table while everyone else runs. */
export default function LiveBoard() {
  const view = useStore((s) => s.view);
  const rows = individualResults(view)
    .filter((r) => r.best != null)
    .sort((a, b) => a.best! - b.best!);

  return (
    <div className="card side">
      <h2>Standing right now</h2>
      {rows.length === 0 ? (
        <p className="note">
          Nobody has a complete round yet. A total appears once all {view.games.length}
          {" "}stations are in for someone.
        </p>
      ) : (
        <ol className="board">
          {rows.map((r, i) => (
            <li key={r.pid} className={i === 0 ? "lead" : ""}>
              <span className="pos">{i + 1}</span>
              <svg viewBox="0 0 60 80" style={{ color: pColor(r.pid) }}>
                <use href={`#${pFigure(r.pid)}`} width="60" height="80" />
              </svg>
              <b>{r.name}</b>
              <span className="t">{fmtClock(r.best)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="note" style={{ marginTop: 10 }}>
        Ranked by single best pentathlon. Updates as anyone on any phone enters a time.
      </p>
    </div>
  );
}
