import { useStore } from "../sync/store";
import { individualResults } from "../lib/scoring";
import { ctxOf, chartStationRange, chartStationPie, chartStationSmalls } from "../charts/charts";

function Card({ title, sub, svg }: { title: string; sub: string; svg: string }) {
  if (!svg) return null;
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <p className="cs">{sub}</p>
      <div className="chart-scroll" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

export default function Stations() {
  const view = useStore((s) => s.view);
  const C = ctxOf(view);
  const res = individualResults(view);

  const p1 = chartStationRange(C);
  const p2 = chartStationPie(C);
  if (!p1 && !p2) {
    return (
      <div className="empty">
        <svg viewBox="0 0 60 70" style={{ height: 120, width: 100 }}>
          <use href="#s-rooster" width="60" height="70" />
        </svg>
        <h4>Nothing to Draw</h4>
        <p>Charts appear the moment somebody finishes a full round of five stations.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hd-row">
        <div>
          <h2 className="sect-title">Station Charts</h2>
          <p className="sect-sub">Not the people — the games. Which station is slow, swingy, and eating the day</p>
        </div>
      </div>
      <Card title="Station Report Card"
        sub="Every recorded run at each station on one shared clock, quickest station on top. The bar is the full spread from best to worst; the diamond is the field average."
        svg={p1} />
      <Card title="Share of the Day"
        sub="Total clock time each station has swallowed — every pentathlon run and every relay leg added together."
        svg={p2} />
      <Card title="Station by Station"
        sub="Each game on its own, best times only. The coloured bar is the station king."
        svg={chartStationSmalls(res, C)} />
    </>
  );
}
