import { useEffect, useState } from "react";
import { useRoute, go, remember } from "./router";
import { useStore, startSync } from "./sync/store";
import { useWide } from "./lib/useMedia";
import Landing from "./screens/Landing";
import Roster from "./screens/Roster";
import Draw from "./screens/Draw";
import Relays from "./screens/Relays";
import Pentathlon from "./screens/Pentathlon";
import Standings from "./screens/Standings";
import Charts from "./screens/Charts";
import Stations from "./screens/Stations";
import SyncPill from "./components/SyncPill";
import LiveBoard from "./components/LiveBoard";
import QR from "./components/QR";
import { Hero, Jingle } from "./theme/Chrome";

/** Order follows the day: set up, draw, run the team event, then the individual one. */
const TABS = [
  { id: "roster", label: "Roster", ic: "\u{1F469}‍\u{1F33E}" },
  { id: "draw", label: "Team Draw", ic: "\u{1F3A8}" },
  { id: "relay", label: "Relays", ic: "\u{1F434}" },
  { id: "pent", label: "Pentathlon", ic: "⏱" },
  { id: "stand", label: "Standings", ic: "\u{1F3C6}" },
  { id: "charts", label: "Barn Charts", ic: "\u{1F4C8}" },
  { id: "stations", label: "Station Charts", ic: "\u{1F3AF}" },
  { id: "share", label: "Share", ic: "\u{1F4E1}" },
];

function Share({ eventId, link }: { eventId: string; link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="hd-row">
        <div>
          <h2 className="sect-title">Share</h2>
          <p className="sect-sub">The link is the key &middot; there is no login</p>
        </div>
      </div>
      <div className="card qrcard">
        <div className="card-hd"><h3>Point a phone at this</h3></div>
        <QR text={link} />
        <p className="note" style={{ marginTop: 12, textAlign: "center" }}>
          Open the camera and point it here. No typing, no texting.
        </p>
      </div>
      <div className="card">
        <div className="card-hd"><h3>Or send the link</h3></div>
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn green" onClick={async () => {
            try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
            catch { /* clipboard blocked; the field above is selectable */ }
          }}>{copied ? "Copied" : "Copy link"}</button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button className="btn blue" onClick={() => navigator.share?.({
              title: "Pond Neck Olympics", url: link }).catch(() => {})}>Share&hellip;</button>
          )}
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          Anyone with this link can see the scores <b>and enter times</b>. Event id{" "}
          <code>{eventId}</code>
        </p>
      </div>
    </>
  );
}

export default function App() {
  const { eventId, panel } = useRoute();
  const openId = useStore((s) => s.eventId);
  const name = useStore((s) => s.name);
  const conflicts = useStore((s) => s.conflicts);
  const wide = useWide();

  useEffect(() => {
    if (eventId && eventId !== openId) useStore.getState().open(eventId);
    if (!eventId && openId) useStore.getState().close();
  }, [eventId, openId]);
  useEffect(() => { if (eventId && name) remember(eventId, name); }, [eventId, name]);
  useEffect(() => startSync(), []);

  const link = eventId ? `${location.origin}${location.pathname}#/e/${eventId}/pent` : "";

  return (
    <>
      <Hero eventName={eventId ? name : undefined} />

      {eventId && (
        <nav className="tabs" role="tablist" aria-label="Sections">
          <div className="tabs-in">
            {TABS.map((t) => (
              <button key={t.id} className="tab" role="tab"
                aria-selected={panel === t.id}
                onClick={() => go(eventId, t.id)}>
                <span className="ic">{t.ic}</span>{t.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="wrap">
        {!eventId ? <Landing /> : (
          <>
            <div className="evbar">
              <button className="linkish" onClick={() => go(null, "home")}>&larr; all events</button>
              <SyncPill />
            </div>

            {conflicts.length > 0 && (
              <div className="card" style={{ borderColor: "var(--barn)" }}>
                <div className="card-hd"><h3>Someone else got there first</h3></div>
                {conflicts.slice(0, 4).map((c) => (
                  <p className="note" key={c.k}>
                    <code>{c.k.replace(/^score\./, "")}</code> &mdash; your {String(c.mine)} was
                    replaced by {String(c.theirs)}.
                  </p>
                ))}
                <button className="btn sm" onClick={() => useStore.getState().dismissConflicts()}>
                  Got it
                </button>
              </div>
            )}

            {panel === "roster" && <Roster />}
            {panel === "draw" && <Draw />}
            {panel === "relay" && <Relays />}
            {panel === "pent" && (wide
              ? <div className="deck"><div><Pentathlon /></div><LiveBoard /></div>
              : <Pentathlon />)}
            {panel === "stand" && <Standings />}
            {panel === "charts" && <Charts />}
            {panel === "stations" && <Stations />}
            {panel === "share" && <Share eventId={eventId} link={link} />}
          </>
        )}
      </main>

      <Jingle />
    </>
  );
}
