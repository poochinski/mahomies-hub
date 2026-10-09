# HANDOFF — where we left off

**Last updated:** 2026-10-09 10:45 (Pacific) · **AI:** Claude
**Current phase:** Going live — GitHub push + Railway deploy (v1.5 test build now reads live Sleeper data)
**Last commit:** "Live data: /api/hub builds everything from Sleeper; test build loads it"
**App status:** Deployed to Railway (first deploy showed 'SLEEPER_LEAGUE_ID is not set' — fixed with defaults) · **Live URL:** Jayson's Railway domain + /test

## What we're working toward right now
Jayson wants to perfect the UI/UX on his phone first, using a test build with
real league data, then bring it to Railway. Two looks are being compared:
"Night" (Banana Bets layout + the neon night-street palette from his dinner
plan page — currently favored) and the original light Banana Bets look.
VERSIONS: v1.5 is current (night theme only). v1.0 is saved in prototype/v1.0/
and on GitHub branch `release-v1.0` (git tags are blocked from Claude's push) — go back to it if v1.5 ever needs to be undone.
On Railway: /test = v1.5, /test/v1.0 and /test/v1.0/light = the old builds.
v1.5 source: prototype/v1.5/ (app15.template.html + v15_main.js, v15_extra.js,
v15_events.js, v15.css; data from compute15.py → prototype/data/app15.json).
Built file: prototype/dist/night.html. Build paths are absolute to Claude's
workspace — adjust if rebuilding elsewhere. The light theme was NOT carried to v1.5.

Earlier goal (still next after the UI): 
Get Mahomie's Hub live on Railway and installed on Jayson's phone. The app
currently shows the league name, current week, all 4 seasons found on Sleeper
(2023–2026), league format, and a system check (Sleeper / server / database).
Once it's live, start Phase 1: sync every season's Sleeper data into Postgres.

## Done (newest first)
- 2026-10-09 — Railway fix (Claude): league ID + commish ID now default in
  `server/config.js` (Railway variables still override), so a missing variable
  can't break the app. Home address `/` now redirects to `/test` until the
  React app catches up.
- 2026-10-09 — **Live data** (Claude): `server/hub/build.js` + `GET /api/hub` rebuild
  everything the app shows (seasons, games, standings incl. median, brackets,
  records + filters, all-time, H2H, power, Book lines, playoff odds (5,000 sims),
  awards, backtest) straight from Sleeper, cached 3 min. Verified against the
  snapshot using a stand-in Sleeper built from real league data: every
  standing, champion, Sacko, record, power rank, line and award matched.
  The /test page loads /api/hub automatically when served by our server and
  refreshes every 3 minutes; seasons/weeks are no longer hard-coded.
- 2026-10-09 — **v1.5** (Claude):
  Home: week picker (Wk 1–4) with auto-written recap, tappable Week 5 matchup
  previews (win chance, line, form bars, keys to the game, last meeting),
  playoff race card, "This week in history".
  League (chips): 2026 standings/power, Playoff odds (10,000 sims incl. median
  game, using the real remaining schedule Wks 6–14), History cards that open a
  full season page (standings, winners bracket + Toilet Bowl with scores,
  every week with recaps), All-time table (former managers included, tagged "Former"),
  Rivals (former managers labeled) + head-to-head grid incl. former managers, Awards per
  season (11 auto awards; 5 more listed for live sync), Lab (Bench Shame,
  Trade grader, Draft re-grade — live on Railway only).
  Records: All / Regular season / Playoffs filter; share cards (PNG via canvas,
  press-and-hold to save) for records, games and seasons.
  Book: spreads capped at 20 and pulled harder to league avg in Wks 1–6;
  Leaders tab (leaderboard + bet feed, test mode = only your bets); settled
  bets section; "How sharp is the Book" backtest (90 past games, favorites
  won 61.8%, avg miss 25.1 pts). Team name first, username second everywhere.
  "Data as of" stamp + version in footer.
  Server: /api/bench, /api/trades, /api/draft (tested against fake Sleeper data).
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
- Former managers (rpkid426, nstynate85) stay in every list and stat, tagged "Former" wherever shown — Jayson's call (he didn't want them hidden or separated).
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
- Lab endpoints only tested with fake data; verify on Railway with real Sleeper data.
- Playoff odds tiebreak = points for (check league's real tiebreaker setting).
- Claude can push to main now; pushing git tags is blocked, so saved versions live on branches (release-v1.0).
- Test build data is a snapshot (Oct 8, 2026 night). Live sync = Phase 1.
- 2026 uses a league-median game (records include median W/L); 2023–2025 did not.
- Player names in the snapshot only for 16 players; full names come from /api/game on Railway.
- One record (193.02, 2025 Wk 15) was a playoff bye score — no game to open.

## Files changed in the latest push
- Everything (first commit): package.json, vite.config.js, index.html,
  public/*, src/*, server/*, BIBLE.md, HANDOFF.md, CHANGELOG.md, README.md
