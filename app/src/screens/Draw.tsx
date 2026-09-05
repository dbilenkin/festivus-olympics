import { useState } from "react";
import { useStore, putFact, putFacts } from "../sync/store";
import { K } from "../sync/facts";
import { pColor, pFigure } from "../lib/palette";
import LiveInput from "../components/LiveInput";
import type { PlayerId, TeamKey } from "../domain/types";

const NAMES_A = ["The Barn Raisers", "Shoofly Bandits", "The Buggy Whips", "Hex Sign Hooligans",
  "Whoopie Pie Wreckers", "The Scrapple Squad", "Raw Milk Renegades"];
const NAMES_B = ["The Corn Huskers", "Pond Neck Plowboys", "The Silo Sluggers", "Quilt Block Crew",
  "The Chicken Scratchers", "Butter Churn Bandits", "Downy Sausage FC"];
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export default function Draw() {
  const view = useStore((s) => s.view);
  const { players, teams, rounds, relays } = view;
  const [reveal, setReveal] = useState<PlayerId[] | null>(null);
  const [drawing, setDrawing] = useState(false);

  const half = Math.floor(players.length / 2);

  async function shake() {
    if (relays.length || rounds.some((r) => Object.values(r.scores).some(
      (row) => Object.values(row ?? {}).some((v) => v != null)))) {
      if (!confirm("Scores are already on the board. Redrawing keeps every score but reshuffles the sides. Carry on?")) return;
    }
    setDrawing(true);
    const ids = players.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    // Reveal one at a time -- the ceremony is most of the point.
    setReveal([]);
    for (let i = 0; i < ids.length; i++) {
      await new Promise((r) => setTimeout(r, 380));
      setReveal(ids.slice(0, i + 1));
    }
    await new Promise((r) => setTimeout(r, 400));

    // ONE atomic fact. Per-player team facts would let two concurrent draws land a
    // 5/3 split with someone on both sides, which no merge rule can repair.
    putFacts([
      { k: K.draw(), v: { drawn: true, A: ids.slice(0, half), B: ids.slice(half) } },
      ...(teams.A.name && teams.A.name !== "Team A" ? [] : [{ k: K.teamName("A"), v: pick(NAMES_A) }]),
      ...(teams.B.name && teams.B.name !== "Team B" ? [] : [{ k: K.teamName("B"), v: pick(NAMES_B) }]),
    ]);
    setDrawing(false);
    setReveal(null);
  }

  const nameOf = (id: PlayerId) => players.find((p) => p.id === id)?.name ?? id;
  const side = (k: TeamKey) => (reveal
    ? reveal.filter((_, i) => (k === "A" ? i < half : i >= half))
    : teams[k].members);

  return (
    <>
      <div className="card drawstage">
        <h2 style={{ color: "var(--corn-lt)" }}>Draw of the straw hat</h2>
        <div className="hat">
          <svg viewBox="0 0 120 90" className={drawing ? "shaking" : ""}>
            <use href="#s-hat" width="120" height="90" />
          </svg>
        </div>
        <button className="btn lg green" disabled={drawing || players.length < 2} onClick={shake}>
          {drawing ? "Shaking…" : teams.drawn ? "Draw again" : "Shake the hat"}
        </button>
        <p className="note" style={{ color: "#c9b997", textAlign: "center", marginTop: 10 }}>
          Randomised on the spot. Everyone&rsquo;s phone sees the same result.
        </p>
      </div>

      <div className="teamgrid">
        {(["A", "B"] as TeamKey[]).map((k) => (
          <div className={"team " + k} key={k}>
            <div className="team-hd">
              <svg viewBox="0 0 60 60"><use href="#s-hex" width="60" height="60" /></svg>
              <div>
                {teams.drawn ? (
                  <LiveInput<string>
                    className="teamname"
                    value={teams[k].name}
                    format={(v) => v}
                    parse={(r) => r.slice(0, 32)}
                    maxLength={32}
                    onCommit={(v) => putFact(K.teamName(k), v)}
                  />
                ) : <b>{k === "A" ? "Team A" : "Team B"}</b>}
                <i>{side(k).length} hands</i>
              </div>
            </div>
            <ul className="roster-list">
              {side(k).length === 0 && <li className="muted">Nobody drawn yet</li>}
              {side(k).map((id) => (
                <li key={id}>
                  <svg viewBox="0 0 60 80" style={{ color: pColor(id) }}>
                    <use href={`#${pFigure(id)}`} width="60" height="80" />
                  </svg>
                  {nameOf(id)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
