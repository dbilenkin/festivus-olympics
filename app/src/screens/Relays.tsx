import { useState } from "react";
import { useStore, putFact, putFacts } from "../sync/store";
import { K } from "../sync/facts";
import { relayTeamTotal, relayStandings } from "../lib/scoring";
import { parseTime, fmtClock } from "../lib/time";
import { gColor } from "../lib/palette";
import LiveInput from "../components/LiveInput";
import RunTimer from "../run/RunTimer";
import type { Relay, TeamKey } from "../domain/types";

export default function Relays() {
  const view = useStore((s) => s.view);
  const { games, teams, relays, players } = view;
  const [runner, setRunner] = useState<{ relay: Relay; k: TeamKey } | null>(null);

  const nameOf = (id: string | null) => players.find((p) => p.id === id)?.name ?? null;

  if (runner) {
    const { relay, k } = runner;
    const e = relay.entries[k];
    return (
      <RunTimer
        who={teams[k].name}
        // Each leg names its station AND who is running it, so the timekeeper is never
        // guessing who to shout at.
        legs={relay.legs.map((gid, i) => {
          const g = games.find((x) => x.id === gid)?.name ?? "Station";
          const who = nameOf(e.lineup[i]);
          return who ? `${g} · ${who}` : g;
        })}
        onExit={() => setRunner(null)}
        onSave={(splits) => {
          putFacts(splits.map((v, i) => ({ k: K.split(relay.id, k, i), v })));
          setRunner(null);
        }}
      />
    );
  }

  if (!teams.drawn) {
    return (
      <div className="card">
        <h2>No teams, no relay</h2>
        <p className="note">The relay is four on four. Run the draw first.</p>
      </div>
    );
  }

  const addRelay = () => {
    const id = "y" + (relays.length + 1) + Math.random().toString(36).slice(2, 5);
    putFacts([
      { k: K.relayExists(id), v: true },
      { k: K.relayLabel(id), v: `Relay ${relays.length + 1}` },
      { k: K.relayOrd(id), v: relays.length },
      { k: K.relayLegs(id), v: games.map((g) => g.id) },
      // Default lineup: everyone once, then the first teammate doubles up on the leg
      // that has no one left. Five stations do not divide by four.
      ...(["A", "B"] as TeamKey[]).flatMap((k) =>
        games.map((_, i) => ({
          k: K.lineup(id, k, i),
          v: teams[k].members[i % Math.max(1, teams[k].members.length)] ?? null,
        })),
      ),
    ]);
  };

  const st = relayStandings(relays);

  return (
    <>
      <div className="card">
        <h2>The team trophy</h2>
        <div className="vs">
          <div className={"vside" + (st.A.wins > st.B.wins ? " win" : "")}>
            <div className="tm">{teams.A.name}</div><div className="tt">{st.A.wins}</div>
          </div>
          <div className="vmid">{st.A.wins === st.B.wins ? "TIED" : "WINS"}</div>
          <div className={"vside" + (st.B.wins > st.A.wins ? " win" : "")}>
            <div className="tm">{teams.B.name}</div><div className="tt">{st.B.wins}</div>
          </div>
        </div>
        <button className="bigbtn" style={{ marginTop: 14 }} onClick={addRelay}>
          + New relay
        </button>
      </div>

      {relays.map((r) => {
        const a = relayTeamTotal(r, "A"), b = relayTeamTotal(r, "B");
        return (
          <div className="card" key={r.id}>
            <div className="relayhd">
              <LiveInput<string>
                className="relayname"
                value={r.label}
                format={(v) => v}
                parse={(x) => x.slice(0, 28)}
                maxLength={28}
                onCommit={(v) => putFact(K.relayLabel(r.id), v)}
              />
            </div>

            <div className="vs">
              <div className={"vside" + (a != null && b != null && a < b ? " win" : "")}>
                <div className="tm">{teams.A.name}</div><div className="tt">{fmtClock(a)}</div>
              </div>
              <div className="vmid">VS</div>
              <div className={"vside" + (a != null && b != null && b < a ? " win" : "")}>
                <div className="tm">{teams.B.name}</div><div className="tt">{fmtClock(b)}</div>
              </div>
            </div>

            <div className="squads">
              {(["A", "B"] as TeamKey[]).map((k) => {
                const e = r.entries[k];
                const used = new Set(e.lineup.filter(Boolean));
                const missing = teams[k].members.filter((m) => !used.has(m));
                return (
                  <div className="squad" key={k}>
                    <div className={"squad-hd " + k}>
                      <b>{teams[k].name}</b>
                      {missing.length > 0
                        ? <span className="warn">{missing.map(nameOf).join(", ")} not running</span>
                        : <span className="ok">lineup set</span>}
                      <button className="runbtn big" onClick={() => setRunner({ relay: r, k })}>
                        &#9654;<em>Run</em>
                      </button>
                    </div>
                    {r.legs.map((gid, i) => (
                      <div className="leg" key={i}>
                        <span className="lnum">{i + 1}</span>
                        <span className="lname" style={{ color: gColor(i) }}>
                          {games.find((g) => g.id === gid)?.name}
                        </span>
                        <select
                          value={e.lineup[i] ?? ""}
                          onChange={(ev) => putFact(K.lineup(r.id, k, i), ev.target.value || null)}
                        >
                          <option value="">— pick —</option>
                          {teams[k].members.map((m) => (
                            <option key={m} value={m}>{nameOf(m)}</option>
                          ))}
                        </select>
                        <LiveInput<number | null>
                          inputMode="decimal"
                          placeholder="secs"
                          value={e.splits[i]}
                          format={(v) => (v == null ? "" : String(v))}
                          parse={parseTime}
                          onCommit={(v) => putFact(K.split(r.id, k, i), v)}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {relays.length === 0 && (
        <div className="card">
          <p className="note">
            A relay runs all {games.length} stations back to back &mdash; one leg each, and
            somebody covers the extra. Legs add into one team time; lowest wins.
          </p>
        </div>
      )}
    </>
  );
}
