# HANDOFF — where we left off

**Last updated:** 2026-10-08 23:45 (Pacific) · **AI:** Claude
**Current phase:** UI prototype (perfecting look + UX before Railway); Phase 0 code done
**Last commit:** "Phase 0: PWA shell, Express server, Sleeper state endpoint"
**App status:** Working locally (build passes) · **Live URL:** not deployed yet

## What we're working toward right now
Jayson wants to perfect the UI/UX on his phone first, using a test build with
real league data, then bring it to Railway. Two looks are being compared:
"Night" (Banana Bets layout + the neon night-street palette from his dinner
plan page — currently favored) and the original light Banana Bets look.
Test builds: prototype/dist/night.html and light.html (served at /test and
/test/light once on Railway). Source: prototype/app.template.html + night.css
+ game_*.css, data from prototype/compute.py → prototype/data/app.json,
rebuilt with prototype/build_all.py (paths inside are absolute to Claude's
workspace — adjust if rebuilding elsewhere).

Earlier goal (still next after the UI): 
Get Mahomie's Hub live on Railway and installed on Jayson's phone. The app
currently shows the league name, current week, all 4 seasons found on Sleeper
(2023–2026), league format, and a system check (Sleeper / server / database).
Once it's live, start Phase 1: sync every season's Sleeper data into Postgres.

## Done (newest first)
- 2026-10-08 — Game detail sheet: every game is tappable (records, home results,
  rivalry history, best/worst week). Shows score, record badges, top scorers,
  records coming in, series, week ranks, every score that week. (Claude)
- 2026-10-08 — `/api/game` endpoint: full box scores (starters by slot, bench,
  names, positions, points) from Sleeper; players file cached once a day. The
  test build calls it automatically when served by our server, and shows real
  Sleeper avatars. Tested against a fake Sleeper server. (Claude)
- 2026-10-08 — Night theme variant. (Claude)
- 2026-10-08 — Phone test build with real data 2023–2026 Wk 4, verified against
  Sleeper season totals (one 1-pt transcription fix in 2023 Wk 6). (Claude)
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
- Avatars: real Sleeper avatars only load on Railway (test pages block outside images).
- Book lines early in season are wide (e.g. -35.5); may tighten.
- Banana Bets theme, Banana Bucks and the Banana Book name carry over.
- Start/Sit helper may stay admin-only.

## Testing notes
- Build passes. `/api/health` and page routing tested locally.
  `/api/state` couldn't be tested from Claude's sandbox (no network to
  Sleeper); expect it to work on Railway and in Codespaces.

## Known bugs / open questions
- GitHub push from Claude is blocked until the Claude GitHub App is given
  access to poochinski/mahomies-hub.
- Test build data is a snapshot (Oct 8, 2026 night). Live sync = Phase 1.
- 2026 uses a league-median game (records include median W/L); 2023–2025 did not.
- Player names in the snapshot only for 16 players; full names come from /api/game on Railway.
- One record (193.02, 2025 Wk 15) was a playoff bye score — no game to open.

## Files changed in the latest push
- Everything (first commit): package.json, vite.config.js, index.html,
  public/*, src/*, server/*, BIBLE.md, HANDOFF.md, CHANGELOG.md, README.md
