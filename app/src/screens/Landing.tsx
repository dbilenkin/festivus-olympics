import { useState } from "react";
import { createEvent, fetchEvent } from "../sync/client";
import { go, recents, remember } from "../router";
import { putFacts, useStore } from "../sync/store";
import { K } from "../sync/facts";

const DEFAULT_PLAYERS = ["Andy", "Chris", "Sachin", "Joe", "Gerard", "Malav", "Dimitri", "Pete"];
const DEFAULT_GAMES = ["Football", "Horseshoes", "Soccer", "Cornhole", "Basketball"];

/** Accepts a whole shared link, a bare event id, or something pasted with stray spaces. */
export function extractEventId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const fromUrl = s.match(/#\/e\/([a-z0-9][a-z0-9-]{2,39})/i);
  if (fromUrl) return fromUrl[1].toLowerCase();
  const bare = s.match(/^([a-z0-9][a-z0-9-]{2,39})$/i);
  return bare ? bare[1].toLowerCase() : null;
}

export default function Landing() {
  const [name, setName] = useState("Pond Neck 2026");
  const [join, setJoin] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const list = recents();

  async function create() {
    setBusy("create"); setErr(null);
    try {
      const ev = await createEvent(name.trim() || "Pond Neck");
      remember(ev.eventId, ev.name);
      useStore.getState().open(ev.eventId, ev.name);
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
      // Land on Share, not the score grid: the very next thing you need is to get this
      // onto everyone else's phone, and there is no other way to find it.
      go(ev.eventId, "share");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reach the server");
    } finally { setBusy(null); }
  }

  async function openExisting() {
    const id = extractEventId(join);
    if (!id) { setErr("That doesn't look like a Pond Neck link or event id."); return; }
    setBusy("join"); setErr(null);
    try {
      // Check it exists first, so a typo says so instead of opening an empty event.
      const snap = await fetchEvent(id);
      remember(id, snap.name ?? id);
      go(id, "pent");
    } catch {
      setErr(`No event called "${id}". Check the link and try again.`);
    } finally { setBusy(null); }
  }

  return (
    <div className="wrap">
      <div className="hero-lite">
        <h1>Pond Neck<br />Olympics</h1>
        <p>Five games · eight souls · two teams</p>
      </div>

      {list.length > 0 && (
        <div className="card corn">
          <div className="card-hd"><h3>All time</h3>
            <span className="sub">{list.length} event{list.length === 1 ? "" : "s"} on this device</span></div>
          <p className="note" style={{ marginBottom: 12 }}>
            Career averages, the roll of honour, year-on-year form and all-time station
            records across every event this device knows about.
          </p>
          <button className="btn lg green" onClick={() => go(null, "all")}>
            Open the all-time board
          </button>
        </div>
      )}

      {list.length > 0 && (
        <div className="card">
          <h2>On this device</h2>
          {list.map((r) => (
            <button key={r.id} className="rowbtn" onClick={() => go(r.id, "pent")}>
              <b>{r.name || r.id}</b><span>{r.id}</span>
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Join an event</h2>
        <p className="note" style={{ marginBottom: 12 }}>
          Scan the QR on the Share tab of a device that already has it, or paste the link
          here.
        </p>
        <label className="fld">
          <span>Link or event id</span>
          <input value={join} placeholder="https://…#/e/pond-neck-2026-ab12cd"
            onChange={(e) => setJoin(e.target.value)} />
        </label>
        <button className="bigbtn" style={{ background: "var(--plain, #2f5aa0)" }}
          disabled={busy !== null || !join.trim()} onClick={openExisting}>
          {busy === "join" ? "Looking…" : "Open it"}
        </button>
      </div>

      <div className="card">
        <h2>Or start a new one</h2>
        <label className="fld">
          <span>Event name</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="bigbtn" disabled={busy !== null} onClick={create}>
          {busy === "create" ? "Creating…" : "Create event"}
        </button>
      </div>

      {err && <div className="card" style={{ borderColor: "var(--barn)" }}>
        <p className="note" style={{ color: "var(--barn)" }}>{err}</p></div>}

      <p className="note" style={{ textAlign: "center" }}>
        Events aren&rsquo;t listed anywhere &mdash; the link is the key. That is what keeps
        strangers out, since there is no login.
      </p>
      <p className="note" style={{ textAlign: "center" }}>
        Last year&rsquo;s scorekeeper, untouched: <a href="legacy/">open it</a>
      </p>
    </div>
  );
}
