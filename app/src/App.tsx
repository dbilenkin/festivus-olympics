import { useEffect, useState } from "react";
import { useRoute, go, remember } from "./router";
import { useStore, startSync } from "./sync/store";
import Landing from "./screens/Landing";
import Pentathlon from "./screens/Pentathlon";
import Standings from "./screens/Standings";
import SyncPill from "./components/SyncPill";
import QR from "./components/QR";

const TABS = [
  { id: "pent", label: "Pentathlon" },
  { id: "stand", label: "Standings" },
  { id: "share", label: "Share" },
];

function Share({ eventId, link }: { eventId: string; link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="card qrcard">
        <h2>Point a phone at this</h2>
        <QR text={link} />
        <p className="note" style={{ marginTop: 12, textAlign: "center" }}>
          Open the camera and point it here. No typing, no texting.
        </p>
      </div>

      <div className="card">
        <h2>Or send the link</h2>
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <div className="btnrow">
          <button className="bigbtn" onClick={async () => {
            try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
            catch { /* clipboard blocked -- the field above is selectable */ }
          }}>{copied ? "Copied" : "Copy link"}</button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button className="bigbtn alt" onClick={() => navigator.share?.({
              title: "Pond Neck Olympics", url: link,
            }).catch(() => {})}>Share…</button>
          )}
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          Anyone with this link can see the scores <b>and enter times</b> &mdash; there is
          no login, so the link is the key. Event id <code>{eventId}</code>
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

  useEffect(() => {
    if (eventId && eventId !== openId) useStore.getState().open(eventId);
    if (!eventId && openId) useStore.getState().close();
  }, [eventId, openId]);

  useEffect(() => { if (eventId && name) remember(eventId, name); }, [eventId, name]);
  useEffect(() => startSync(), []);

  if (!eventId) return <Landing />;

  const link = `${location.origin}${location.pathname}#/e/${eventId}/pent`;

  return (
    <div className="wrap">
      <header className="apphead">
        <div>
          <div className="ev">{name || "Pond Neck Olympics"}</div>
          <button className="linkish" onClick={() => go(null, "home")}>← all events</button>
        </div>
        <SyncPill />
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-pressed={panel === t.id}
            onClick={() => go(eventId, t.id)}>{t.label}</button>
        ))}
      </nav>

      {conflicts.length > 0 && (
        <div className="card conflict">
          <h2>Someone else got there first</h2>
          {conflicts.slice(0, 4).map((c) => (
            <p className="note" key={c.k}>
              <code>{c.k.replace(/^score\./, "")}</code> — your {String(c.mine)} was
              replaced by {String(c.theirs)}.
            </p>
          ))}
          <button className="rowbtn" onClick={() => useStore.getState().dismissConflicts()}>
            Got it
          </button>
        </div>
      )}

      {panel === "pent" && <Pentathlon />}
      {panel === "stand" && <Standings />}
      {panel === "share" && <Share eventId={eventId} link={link} />}
    </div>
  );
}
