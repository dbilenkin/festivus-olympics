import { useStore } from "../sync/store";

/** The only honest answer to "did that save?" -- and with wide-open writes in a yard
 *  with no bars, the answer is genuinely sometimes "not yet".
 *
 *  Each value is selected separately and returns a primitive. A selector returning a
 *  fresh object re-renders forever under zustand v5, because the snapshot is compared
 *  by reference. */
export default function SyncPill() {
  const online = useStore((s) => s.online);
  const outbox = useStore((s) => s.outbox.length);
  const syncing = useStore((s) => s.syncing);
  const lastSyncAt = useStore((s) => s.lastSyncAt);

  const pending = outbox > 0;
  const cls = !online ? "off" : pending || syncing ? "pend" : "ok";
  const label = !online
    ? (pending ? `Offline · ${outbox} waiting` : "Offline")
    : syncing ? "Saving…"
    : pending ? `${outbox} waiting`
    : lastSyncAt ? "Saved" : "Connecting…";

  return <div className={"pill " + cls}><i />{label}</div>;
}
