# HANDOFF — where we left off

**Last updated:** 2026-10-07 22:50 (Pacific) · **AI:** Claude
**Current phase:** Phase 0 — Setup (code done, deploy steps left for Jayson)
**Last commit:** "Phase 0: PWA shell, Express server, Sleeper state endpoint"
**App status:** Working locally (build passes) · **Live URL:** not deployed yet

## What we're working toward right now
Get Mahomie's Hub live on Railway and installed on Jayson's phone. The app
currently shows the league name, current week, all 4 seasons found on Sleeper
(2023–2026), league format, and a system check (Sleeper / server / database).
Once it's live, start Phase 1: sync every season's Sleeper data into Postgres.

## Done (newest first)
- 2026-10-07 — Phase 0 code: Vite + React PWA shell (bottom tab bar on phones,
  sidebar on desktop), Banana Bets color tokens, app icons, Express server
  serving the app + `/api/health` + `/api/state`, Sleeper client with
  in-memory cache and history-chain walker. (Claude)
- 2026-10-07 — Planning: BIBLE.md v1.1, app named Mahomie's Hub, league ID
  confirmed, relay workflow decided. (Claude)

## In progress (not finished)
- Railway deploy (Jayson's steps below)

## Next steps (in order)
1. Jayson: Railway → New Project → Deploy from GitHub repo → `poochinski/mahomies-hub`.
2. Jayson: in the same Railway project, add a PostgreSQL database.
3. Jayson: on the app service → Variables, add:
   `SLEEPER_LEAGUE_ID=1312104253497540608`, `COMMISH_USER_ID=862901935416655872`,
   `TZ=America/Los_Angeles`, and `DATABASE_URL` as a reference to the Postgres
   service (`${{Postgres.DATABASE_URL}}`).
4. Jayson: app service → Settings → Networking → Generate Domain. Open it on
   the phone, check all three system-check dots are green, then Add to Home Screen.
5. Phase 1: `server/schema.sql` with the Sleeper mirror tables (BIBLE §6),
   then the sync job for seasons → users → rosters → matchups.

## Decisions made (and why)
- App name: Mahomie's Hub, repo `poochinski/mahomies-hub` — Jayson's pick.
- No one-feature-per-session limit; every push carries an updated HANDOFF — so
  any AI can pick up the moment another runs out of usage.
- Build tools (vite, plugins) are in `dependencies`, not `devDependencies`, so
  Railway always installs them for `npm run build`.
- Jayson has the admin role in the app via `COMMISH_USER_ID`; the Sleeper
  league owner is MattGomez. App admin and Sleeper commissioner are separate.

## What we talked about / ideas parked
- Banana Bets theme, Banana Bucks and the Banana Book name carry over.
- Start/Sit helper may stay admin-only.

## Testing notes
- Build passes. `/api/health` and page routing tested locally.
  `/api/state` couldn't be tested from Claude's sandbox (no network to
  Sleeper); expect it to work on Railway and in Codespaces.

## Known bugs / open questions
- None yet.

## Files changed in the latest push
- Everything (first commit): package.json, vite.config.js, index.html,
  public/*, src/*, server/*, BIBLE.md, HANDOFF.md, CHANGELOG.md, README.md
