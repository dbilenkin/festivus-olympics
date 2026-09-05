import { useState } from "react";
import { createEvent } from "../sync/client";
import { go, recents, remember } from "../router";
import { putFacts } from "../sync/store";
import { useStore } from "../sync/store";
import { K } from "../sync/facts";

const DEFAULT_PLAYERS = ["Andy", "Chris", "Sachin", "Joe", "Gerard", "Malav", "Dimitri", "Pete"];
const DEFAULT_GAMES = ["Football", "Horseshoes", "Soccer", "Cornhole", "Basketball"];

export default function Landing() {
  const [name, setName] = useState("Pond Neck 2026");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const list = recents();

  async function create() {
    setBusy(true); setErr(null);
    try {
      const ev = await createEvent(name.trim() || "Pond Neck");
      remember(ev.eventId, ev.name);
      useStore.getState().open(ev.eventId, ev.name);
      // Seed a roster so the event is usable immediately; all of it is editable.
      putFacts([
        { k: K.eventName(), v: ev.name },
        ...DEFAULT_PLAYERS.flatMap((n, i) => [
          { k: K.playerName(`p${i + 1}`), v: n },
          { k: K.playerOrd(`p${i + 1}`), v: i },
        ]),
        ...DEFAULT_GAMES.flatMap((g, i) => [
          { k: K.gameName(`g${i + 1}`), v: g },
          { k: K.gameOrd(`g${i + 1}`), v: i },
        ]),
        { k: K.roundExists("r1"), v: true },
        { k: K.roundLabel("r1"), v: "Round 1" },
        { k: K.roundOrd("r1"), v: 0 },
      ]);
      go(ev.eventId, "pent");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reach the server");
    } finally { setBusy(false); }
  }

  return (
    <div className="wrap">
      <div className="hero-lite">
        <h1>Pond Neck<br />Olympics</h1>
        <p>Five games · eight souls · two teams</p>
      </div>

      {list.length > 0 && (
        <div className="card">
          <h2>Your events</h2>
          {list.map((r) => (
            <button key={r.id} className="rowbtn" onClick={() => go(r.id, "pent")}>
              <b>{r.name || r.id}</b><span>{r.id}</span>
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Start a new one</h2>
        <label className="fld">
          <span>Event name</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="bigbtn" disabled={busy} onClick={create}>
          {busy ? "Creating…" : "Create event"}
        </button>
        {err && <p className="note" style={{ color: "var(--barn)", marginTop: 10 }}>{err}</p>}
        <p className="note" style={{ marginTop: 12 }}>
          You get a link to text the other seven. Anyone with it can see the scores and
          enter times &mdash; there is no login.
        </p>
      </div>

      <p className="note" style={{ textAlign: "center" }}>
        Last year&rsquo;s scorekeeper, untouched: <a href="legacy/">open it</a>
      </p>
    </div>
  );
}
