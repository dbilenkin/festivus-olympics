import { useEffect } from "react";
import { useRoute, go, remember } from "./router";
import { useStore, startSync } from "./sync/store";
import Landing from "./screens/Landing";
import Pentathlon from "./screens/Pentathlon";
import Standings from "./screens/Standings";
import SyncPill from "./components/SyncPill";

const TABS = [
  { id: "pent", label: "Pentathlon" },
  { id: "stand", label: "Standings" },
  { id: "share", label: "Share" },
];

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
      {panel === "share" && (
        <div className="card">
          <h2>Share this event</h2>
          <p className="note" style={{ marginBottom: 12 }}>
            Anyone with this link can see the scores and enter times. There is no login,
            so treat the link as the key.
          </p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button className="bigbtn" style={{ marginTop: 10 }}
            onClick={() => navigator.clipboard?.writeText(link)}>Copy link</button>
          <p className="note" style={{ marginTop: 14 }}>
            Event id <code>{eventId}</code>
          </p>
        </div>
      )}
    </div>
  );
}
