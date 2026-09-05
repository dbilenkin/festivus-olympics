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

## The games

Five stations, run back to back on one continuous clock. Tap once to bank a station
and start the next.

- **Relay** — the team event, first. Four on four, five legs, one teammate doubles up.
- **Pentathlon** — individual, after. All five stations, best and average both ranked.

Two crowns: the Team Trophy goes on relay wins alone; the Individual Champion comes
purely out of the pentathlon.
