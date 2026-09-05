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

## Getting an event onto another phone

There is no login and no server-side list of events. That is deliberate: writes are
wide open, so the unguessable event id **is** the access control. An endpoint that
listed events would let anyone enumerate and edit everyone else's day.

So the link is the key. Three ways to pass it along:

1. **Scan the QR** on the Share tab. Point a phone camera at the laptop. No typing.
2. **Copy link** / **Share…** and send it however you like.
3. Paste the link, or just the event id, into **Join an event** on the home screen.

Anyone holding the link can read the scores and enter times. Treat it accordingly.

## The games

Five stations, run back to back on one continuous clock. Tap once to bank a station
and start the next.

- **Relay** — the team event, first. Four on four, five legs, one teammate doubles up.
- **Pentathlon** — individual, after. All five stations, best and average both ranked.

Two crowns: the Team Trophy goes on relay wins alone; the Individual Champion comes
purely out of the pentathlon.
