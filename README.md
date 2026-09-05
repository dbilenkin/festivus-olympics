# Pond Neck Olympics

Scorekeeping for five backyard games, eight competitors, two teams — rural Maryland.

- **Live app:** https://dbilenkin.github.io/festivus-olympics/
- **Scorekeeper (current, offline-capable):** https://dbilenkin.github.io/festivus-olympics/legacy/

## Layout

| Path | What |
|---|---|
| `index.html` | The original single-file app. Self-contained, no build, no network. Works from `file://`. **Frozen** — the system of record during an event. |
| `app/` | The React PWA that replaces it. Vite + React + TS. |
| `app/public/legacy/index.html` | Byte-identical copy of the above, deployed as a permanent fallback. |
| `infra/` | CDK app for the backend (DynamoDB + Lambda). Separate stack, `pondneck-*` names. |

Result data is deliberately **not** committed — it contains real people's names.
Backups live on disk and are gitignored.

## Where the data lives

**Everything is server-side.** Every score, name, team and relay is in DynamoDB.
Open the app on any device, signed into nothing, and the home screen lists every
event — no link needed, nothing remembered locally.

`localStorage` holds five things, and none of them are the source of truth:

| Key | Why it has to be local |
|---|---|
| `cache.<id>` | a copy of the server snapshot, so the app boots with no signal |
| `outbox.<id>` | writes made offline, waiting to send |
| `clockoffset` | server-time correction, so offline writes get sane timestamps |
| `device` | device id, used as the last-write-wins tiebreak |
| `run.v2` | the live run — deliberately never synced, see below |

A run in progress stays on the phone timing it. A half-finished run on someone
else's screen is meaningless, and it keeps all network code off the timer's
critical path.

## The security trade

Writes are wide open — no login — and events are now listed publicly. The API base
URL ships in the JS bundle, so assume anyone can find both. That is a deliberate
choice for convenience among eight friends, and the mitigation is recovery rather
than prevention:

- The whole event is **snapshotted every five minutes** on write.
- `POST /events/{id}/restore` puts any snapshot back. Restoring is a normal write,
  so it propagates to every device by the usual sync path.
- Nothing is ever deleted — the Lambda has no `DeleteItem` permission at all.
- Rate limiting, reserved concurrency, DynamoDB throughput caps and a $5 budget
  bound what abuse can cost.

Vandalism is a five-second undo, not a loss. If that ever stops feeling like the
right trade, the fix is a shared PIN on writes, not hiding the event list.

## The games

Five stations, run back to back on one continuous clock. Tap once to bank a station
and start the next.

- **Relay** — the team event, first. Four on four, five legs, one teammate doubles up.
- **Pentathlon** — individual, after. All five stations, best and average both ranked.

Two crowns: the Team Trophy goes on relay wins alone; the Individual Champion comes
purely out of the pentathlon.
