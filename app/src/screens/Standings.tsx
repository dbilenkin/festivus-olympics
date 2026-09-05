import { useStore } from "../sync/store";
import { individualResults, records } from "../lib/scoring";
import { fmtClock, fmtShort } from "../lib/time";
import { pColor, pFigure, gColor } from "../lib/palette";

const medal = (r: number | null) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "");

export default function Standings() {
  const view = useStore((s) => s.view);
  const rows = individualResults(view).slice()
    .sort((a, b) => (a.best == null ? 1 : b.best == null ? -1 : a.best - b.best));
  const rec = records(view);
  const champ = rows[0];

  if (!rows.some((r) => r.best != null)) {
    return <div className="card"><h2>Nothing to crown yet</h2>
      <p className="note">Standings appear as soon as somebody finishes all five stations.</p></div>;
  }

  return (
    <>
      {champ?.best != null && (
        <div className="card champ">
          <svg viewBox="0 0 60 80" style={{ color: pColor(champ.pid), width: 62, height: 82 }}>
            <use href={`#${pFigure(champ.pid)}`} width="60" height="80" />
          </svg>
          <div>
            <div className="kick">Individual champion</div>
            <div className="nm">{champ.name}</div>
            <div className="sub">best {fmtClock(champ.best)} · average {fmtClock(champ.avg)}</div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Individual table</h2>
        <div className="tbl">
          <table>
            <thead><tr>
              <th>Competitor</th><th className="num">Best</th>
              <th className="num">Average</th><th className="num">Rk</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pid} className={r.bestRank === 1 ? "r1" : ""}>
                  <td><span className="who">
                    <svg viewBox="0 0 60 80" style={{ color: pColor(r.pid) }}>
                      <use href={`#${pFigure(r.pid)}`} width="60" height="80" />
                    </svg><b>{r.name}</b></span></td>
                  <td className="num tot">{fmtClock(r.best)}</td>
                  <td className="num">{fmtClock(r.avg)}</td>
                  <td className="num">{medal(r.bestRank)} {r.bestRank ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Record book</h2>
        <div className="recs">
          <div className="rec" style={{ color: "#a8331f" }}>
            <div className="k">Best pentathlon</div>
            <div className="v">{rec.pent ? fmtShort(rec.pent.v) : "—"}</div>
            <div className="w">{rec.pent ? view.players.find((p) => p.id === rec.pent!.pid)?.name : "unset"}</div>
          </div>
          {rec.stations.map((st, i) => (
            <div className="rec" key={st.gid} style={{ color: gColor(i) }}>
              <div className="k">{st.name}</div>
              <div className="v">{st.best ? st.best.v.toFixed(2) + "s" : "—"}</div>
              <div className="w">{st.best ? view.players.find((p) => p.id === st.best!.pid)?.name : "unset"}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
