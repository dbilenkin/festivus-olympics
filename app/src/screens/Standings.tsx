import { useState } from "react";
import { useStore } from "../sync/store";
import {
  individualResults, records, stationBreakdown, relayStandings,
} from "../lib/scoring";
import { fmtClock, fmtShort } from "../lib/time";
import { pColor, pFigure, gColor } from "../lib/palette";
import { fameAndShame } from "../charts/extra";

const medal = (r: number | null) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "");

export default function Standings() {
  const view = useStore((s) => s.view);
  const [openStation, setOpenStation] = useState<string | null>(null);

  // Average is the ranking key. Best is still shown -- it is a record, not a result.
  const rows = individualResults(view).slice()
    .sort((a, b) => (a.avg == null ? 1 : b.avg == null ? -1 : a.avg - b.avg));
  const rec = records(view);
  const champ = rows[0];
  const breakdown = stationBreakdown(view);
  const st = relayStandings(view.relays);
  const { fastest, slowest } = fameAndShame(view);

  if (!rows.some((r) => r.avg != null)) {
    return (
      <div className="empty">
        <svg viewBox="0 0 40 52" style={{ height: 110, width: 84, color: "#e8b93b" }}>
          <use href="#s-medal" width="40" height="52" />
        </svg>
        <h4>Nothing to Crown</h4>
        <p>Standings appear as soon as somebody finishes all five stations.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hd-row">
        <div>
          <h2 className="sect-title">Standings</h2>
          <p className="sect-sub">Ranked by average &middot; consistency wins the day</p>
        </div>
      </div>

      {champ?.avg != null && (
        <div className="card" style={{ background: "linear-gradient(135deg,#fff8e2,#f6d97a)", borderColor: "var(--barn)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center", textAlign: "center" }}>
            <svg viewBox="0 0 60 80" style={{ width: 74, height: 98, color: pColor(champ.pid) }}>
              <use href={`#${pFigure(champ.pid)}`} width="60" height="80" />
            </svg>
            <div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 900, letterSpacing: ".24em", textTransform: "uppercase", color: "var(--barn)" }}>
                Individual Champion of Pond Neck
              </div>
              <div style={{ fontSize: "clamp(30px,8vw,52px)", fontWeight: 900, textTransform: "uppercase", lineHeight: 1, color: "var(--barn-dk)" }}>
                {champ.name}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 16, marginTop: 4 }}>
                average {fmtClock(champ.avg)} over {champ.completed} round{champ.completed === 1 ? "" : "s"}
              </div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--dirt)", marginTop: 3 }}>
                best {fmtClock(champ.best)} &middot; worst {fmtClock(champ.worst)}
              </div>
            </div>
            <svg viewBox="0 0 40 52" style={{ width: 56, height: 74, color: "#e8b93b" }}>
              <use href="#s-medal" width="40" height="52" />
            </svg>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-hd"><h3>Individual table</h3>
          <span className="sub">average decides it &middot; best and worst for context</span></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>Competitor</th><th className="num">Average</th><th className="num">Best</th>
              <th className="num">Worst</th><th className="num">Swing</th>
              <th className="num">Rounds</th><th className="num">Rk</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pid} className={r.avgRank === 1 ? "rank-1" : r.avgRank === 2 ? "rank-2" : r.avgRank === 3 ? "rank-3" : ""}>
                  <td><span className="who">
                    <svg viewBox="0 0 60 80" style={{ color: pColor(r.pid) }}>
                      <use href={`#${pFigure(r.pid)}`} width="60" height="80" />
                    </svg><b>{r.name}</b></span></td>
                  <td className="num tot"><b>{fmtClock(r.avg)}</b></td>
                  <td className="num">{fmtClock(r.best)}</td>
                  <td className="num">{fmtClock(r.worst)}</td>
                  <td className="num" style={{ color: "var(--dirt)" }}>
                    {r.best != null && r.worst != null ? `±${(r.worst - r.best).toFixed(0)}s` : "—"}
                  </td>
                  <td className="num" style={{ color: "var(--dirt)" }}>{r.completed}</td>
                  <td className="num"><span className="medal">{medal(r.avgRank)}</span> {r.avgRank ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          A round only counts once all {view.games.length} stations are in. <b>Swing</b> is the
          gap between someone&rsquo;s best and worst round &mdash; a small one means you can count on them.
        </p>
      </div>

      <div className="card corn">
        <div className="card-hd"><h3>Every station, every number</h3>
          <span className="sub">tap a station to open it up</span></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>Station</th><th className="num">Field avg</th><th className="num">Best</th>
              <th className="num">Worst</th><th className="num">Spread</th><th className="num">Runs</th>
            </tr></thead>
            <tbody>
              {breakdown.map((b, i) => {
                const open = openStation === b.gid;
                return (
                  <>
                    <tr key={b.gid} className="clickrow" onClick={() => setOpenStation(open ? null : b.gid)}>
                      <td><span className="who">
                        <span className="swatch sm" style={{ background: gColor(i) }} />
                        <b>{b.name}</b>
                        <span className="chev">{open ? "▾" : "▸"}</span>
                      </span></td>
                      <td className="num tot">{b.field.avg == null ? "—" : b.field.avg.toFixed(2) + "s"}</td>
                      <td className="num">{b.field.best == null ? "—" : b.field.best.toFixed(2) + "s"}</td>
                      <td className="num">{b.field.worst == null ? "—" : b.field.worst.toFixed(2) + "s"}</td>
                      <td className="num" style={{ color: "var(--dirt)" }}>
                        {b.field.best != null && b.field.worst != null ? `${(b.field.worst - b.field.best).toFixed(1)}s` : "—"}
                      </td>
                      <td className="num" style={{ color: "var(--dirt)" }}>{b.field.n}</td>
                    </tr>
                    {open && (
                      <tr key={b.gid + "-d"}>
                        <td colSpan={6} style={{ padding: 0, background: "#fbf6ea" }}>
                          <table className="inner">
                            <thead><tr>
                              <th>at {b.name}</th><th className="num">Average</th>
                              <th className="num">Best</th><th className="num">Worst</th><th className="num">Runs</th>
                            </tr></thead>
                            <tbody>
                              {b.players.slice().sort((x, y) =>
                                (x.spread.avg ?? 1e9) - (y.spread.avg ?? 1e9)).map((p) => (
                                <tr key={p.pid}>
                                  <td><span className="who">
                                    <svg viewBox="0 0 60 80" style={{ color: pColor(p.pid) }}>
                                      <use href={`#${pFigure(p.pid)}`} width="60" height="80" />
                                    </svg>{p.name}</span></td>
                                  <td className="num tot">{p.spread.avg == null ? "—" : p.spread.avg.toFixed(2)}</td>
                                  <td className="num">{p.spread.best == null ? "—" : p.spread.best.toFixed(2)}</td>
                                  <td className="num">{p.spread.worst == null ? "—" : p.spread.worst.toFixed(2)}</td>
                                  <td className="num" style={{ color: "var(--dirt)" }}>{p.spread.n}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-hd"><h3>Hall of fame</h3><span className="sub">quickest single stations of the day</span></div>
          <div dangerouslySetInnerHTML={{ __html: fastest }} />
        </div>
        <div className="card">
          <div className="card-hd"><h3>Wall of shame</h3><span className="sub">the ones that will be brought up again</span></div>
          <div dangerouslySetInnerHTML={{ __html: slowest }} />
        </div>
      </div>

      <div className="card corn">
        <div className="card-hd"><h3>The record book</h3><span className="sub">every best set on the day</span></div>
        <div className="rec-grid">
          <div className="rec" style={{ color: "#a8331f" }}>
            <div className="k">Best pentathlon</div>
            <div className="v">{rec.pent ? fmtShort(rec.pent.v) : "—"}</div>
            <div className="w">{rec.pent ? view.players.find((p) => p.id === rec.pent!.pid)?.name : "unset"}</div>
          </div>
          {rec.stations.map((s, i) => (
            <div className="rec" key={s.gid} style={{ color: gColor(i) }}>
              <div className="k">{s.name}</div>
              <div className="v">{s.best ? s.best.v.toFixed(2) + "s" : "—"}</div>
              <div className="w">{s.best ? view.players.find((p) => p.id === s.best!.pid)?.name : "unset"}</div>
            </div>
          ))}
          {rec.relay && (
            <div className="rec" style={{ color: "#2f5aa0" }}>
              <div className="k">Fastest relay</div>
              <div className="v">{fmtShort(rec.relay.v)}</div>
              <div className="w">{view.teams[rec.relay.k].name}</div>
            </div>
          )}
        </div>
      </div>

      {view.relays.length > 0 && (
        <div className="card barnish">
          <div className="card-hd"><h3>The team trophy</h3><span className="sub">relay wins only</span></div>
          <div className="vs">
            <div className={"vside" + (st.A.wins > st.B.wins ? " win" : "")}>
              <div className="tm">{view.teams.A.name}</div><div className="tt">{st.A.wins}</div></div>
            <div className="vmid">{st.A.wins === st.B.wins ? "TIED" : "WINS"}</div>
            <div className={"vside" + (st.B.wins > st.A.wins ? " win" : "")}>
              <div className="tm">{view.teams.B.name}</div><div className="tt">{st.B.wins}</div></div>
          </div>
        </div>
      )}
    </>
  );
}
