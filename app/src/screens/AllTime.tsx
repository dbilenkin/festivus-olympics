import { useEffect, useState } from "react";
import { recents, go } from "../router";
import { loadAllEvents, aggregate, type AllTime as AllTimeData } from "../sync/multi";
import { fmtClock, fmtShort } from "../lib/time";
import { pColor, pFigure } from "../lib/palette";
import { chartCareerSlope } from "../charts/extra";

export default function AllTime() {
  const [data, setData] = useState<AllTimeData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ids = recents().map((r) => r.id);

  useEffect(() => {
    let live = true;
    loadAllEvents(ids)
      .then((evs) => { if (live) setData(aggregate(evs)); })
      .catch(() => { if (live) setErr("Couldn’t reach the server"); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ids.length) {
    return (
      <div className="empty">
        <h4>No events yet</h4>
        <p>The all-time board spans every event on the server. Create one to get started.</p>
      </div>
    );
  }
  if (err) return <div className="card"><p className="note">{err}</p></div>;
  if (!data) return <div className="card"><p className="note">Loading every year…</p></div>;

  const { events, career, champions, stationRecords } = data;
  const goat = career[0];

  return (
    <>
      <div className="hd-row">
        <div>
          <h2 className="sect-title">All Time</h2>
          <p className="sect-sub">
            {events.length} event{events.length === 1 ? "" : "s"} &middot;{" "}
            {career.length} competitors &middot; matched by name across the years
          </p>
        </div>
      </div>

      {goat?.careerAvg != null && (
        <div className="card" style={{ background: "linear-gradient(135deg,#fff8e2,#f6d97a)", borderColor: "var(--barn)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center", textAlign: "center" }}>
            <svg viewBox="0 0 60 80" style={{ width: 74, height: 98, color: pColor("p1") }}>
              <use href={`#${pFigure("p1")}`} width="60" height="80" />
            </svg>
            <div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 900, letterSpacing: ".24em", textTransform: "uppercase", color: "var(--barn)" }}>
                Greatest of all Pond Neck
              </div>
              <div style={{ fontSize: "clamp(30px,8vw,52px)", fontWeight: 900, textTransform: "uppercase", lineHeight: 1, color: "var(--barn-dk)" }}>
                {goat.name}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 16, marginTop: 4 }}>
                career average {fmtClock(goat.careerAvg)} over {goat.rounds} rounds
              </div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--dirt)", marginTop: 3 }}>
                {goat.titles} title{goat.titles === 1 ? "" : "s"} · best ever {fmtClock(goat.bestEver)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card corn">
        <div className="card-hd"><h3>Roll of honour</h3><span className="sub">winner of each event, on average</span></div>
        <ol className="fame">
          {champions.map((c) => (
            <li key={c.eventId} className="top">
              <span className="n">🏆</span>
              <span className="g">{c.name}<em>{c.eventName}</em></span>
              <span className="t">{fmtClock(c.avg)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <div className="card-hd"><h3>Career table</h3><span className="sub">every round ever run, weighted equally</span></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>Competitor</th><th className="num">Career avg</th><th className="num">Best ever</th>
              <th className="num">Worst ever</th><th className="num">Events</th>
              <th className="num">Rounds</th><th className="num">Titles</th>
              {events.map((e) => <th key={e.id} className="num">{e.name.replace(/\D*(\d{4}).*/, "$1") || e.name}</th>)}
            </tr></thead>
            <tbody>
              {career.map((c, i) => (
                <tr key={c.name} className={i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : ""}>
                  <td><span className="who">
                    <svg viewBox="0 0 60 80" style={{ color: pColor("p" + (i + 1)) }}>
                      <use href={`#${pFigure("p" + (i + 1))}`} width="60" height="80" />
                    </svg><b>{c.name}</b></span></td>
                  <td className="num tot"><b>{fmtClock(c.careerAvg)}</b></td>
                  <td className="num">{fmtClock(c.bestEver)}</td>
                  <td className="num">{fmtClock(c.worstEver)}</td>
                  <td className="num" style={{ color: "var(--dirt)" }}>{c.events}</td>
                  <td className="num" style={{ color: "var(--dirt)" }}>{c.rounds}</td>
                  <td className="num">{c.titles ? "🏆".repeat(c.titles) : "—"}</td>
                  {events.map((e) => {
                    const hit = c.perEvent.find((p) => p.id === e.id);
                    return <td key={e.id} className="num" style={{ color: "var(--dirt)" }}>
                      {hit?.avg != null ? `${fmtShort(hit.avg)} (${hit.rank})` : "—"}
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          Career average is the mean of every completed round across all years, so a year
          with more rounds counts for more. Per-event columns show that year&rsquo;s average
          and finishing position.
        </p>
      </div>

      {events.length > 1 && (
        <div className="chart-card">
          <h3>Year on Year</h3>
          <p className="cs">Each competitor’s average per event, joined up. Downhill is improvement.</p>
          <div className="chart-scroll"
            dangerouslySetInnerHTML={{ __html: chartCareerSlope(events, career) }} />
        </div>
      )}

      <div className="card corn">
        <div className="card-hd"><h3>All-time station records</h3>
          <span className="sub">matched by station name across the years</span></div>
        <div className="rec-grid">
          {stationRecords.map((s, i) => (
            <div className="rec" key={s.station} style={{ color: pColor("p" + (i + 1)) }}>
              <div className="k">{s.station}</div>
              <div className="v">{s.v.toFixed(2)}s</div>
              <div className="w">{s.who}</div>
              <div className="n">{s.when}</div>
            </div>
          ))}
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          A station only shares a record with the same station name. Darts and Soccer are
          different games, so they keep separate records.
        </p>
      </div>

      <div className="card">
        <div className="card-hd"><h3>The events</h3></div>
        {events.map((e) => (
          <button key={e.id} className="rowbtn" onClick={() => go(e.id, "stand")}>
            <b>{e.name}</b>
            <span>{e.state.players.length} competitors · {e.state.rounds.length} rounds</span>
          </button>
        ))}
      </div>
    </>
  );
}
