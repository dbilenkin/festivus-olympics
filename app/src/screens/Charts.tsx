import { useStore } from "../sync/store";
import { individualResults } from "../lib/scoring";
import {
  ctxOf, chartLeaderboard, chartStacked, chartProgress, chartRelays, chartRelayLegs,
} from "../charts/charts";

function Card({ title, sub, svg }: { title: string; sub: string; svg: string }) {
  if (!svg) return null;
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <p className="cs">{sub}</p>
      {/* Chart bodies are built as SVG strings. Every interpolated name goes through
          esc() in charts.ts, and the server rejects angle brackets. */}
      <div className="chart-scroll" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

export default function Charts() {
  const view = useStore((s) => s.view);
  const C = ctxOf(view);
  const res = individualResults(view);

  const c1 = chartLeaderboard(res, C);
  const c5 = chartRelays(C);
  if (!c1 && !c5) {
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
          <h2 className="sect-title">Barn Charts</h2>
          <p className="sect-sub">The competitors · the squads · the day in corn and clay</p>
        </div>
      </div>
      <Card title="The Relay Ledger"
        sub="Team times per relay, head to head. Thick outline took it." svg={c5} />
      <Card title="Which Leg Lost It"
        sub="Every relay broken into its five legs. Line the two squads up and the gap is usually one block wide."
        svg={chartRelayLegs(C)} />
      <Card title="Best vs. Average"
        sub="Solid bar is your single fastest pentathlon; the ghost bar underneath is your average across every round. A big gap means one lucky run."
        svg={c1} />
      <Card title="Where the Time Goes"
        sub="Your best round broken into its five stations. The widest block is the one costing you the day."
        svg={chartStacked(res, C)} />
      <Card title="Round by Round"
        sub="Every competitor’s pentathlon total, round over round. Down and to the right is the direction you want."
        svg={chartProgress(res, C)} />
    </>
  );
}
