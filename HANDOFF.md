# HANDOFF — where we left off

**Last updated:** 2026-10-09 12:10 (Pacific) · **AI:** Claude
**Current phase:** v1.8 — Banana Book is live in the app (login, bets, parlays, leaders, commish tools); Week 6 lines post Tue Oct 13 6 AM; next = specials + futures
**Last commit:** "v1.8: Banana Book screens wired to the real Book"
**App status:** LIVE on Railway — https://mahomies-hub-production.up.railway.app (v1.7; old builds at /test/v1.6, /test/v1.5, /test/v1.0)

## What we're working toward right now
Jayson wants to perfect the UI/UX on his phone first, using a test build with
real league data, then bring it to Railway. Two looks are being compared:
"Night" (Banana Bets layout + the neon night-street palette from his dinner
plan page — currently favored) and the original light Banana Bets look.
VERSIONS: **v1.8 is current** (source prototype/v1.8/: app18.template.html is built by v18.py from the v1.7 template + v18_book.js; output prototype/dist/night.html). v1.7 saved at prototype/v1.7/night.html (/test/v1.7). v1.6 saved at prototype/v1.6/night.html (/test/v1.6) and branch release-v1.6. v1.5 saved at prototype/v1.5/night.html (/test/v1.5) and branch release-v1.5. Older: v1.5 (night theme only). v1.0 is saved in prototype/v1.0/
and on GitHub branch `release-v1.0` (git tags are blocked from Claude's push) — go back to it if v1.5 ever needs to be undone.
On Railway: every address = v1.5; /test/v1.0 and /test/v1.0/light = the old builds.
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
- 2026-10-09 — **v1.8: Book screens** (Claude). Book tab now talks to `/api/book`:
  log in (pick team → PIN pad; first time sets + confirms the PIN), lines with
  lock countdowns + live scores, tap prices to build a slip (1 pick = straight,
  2–4 from different games = parlay, sticky "Bet slip" bar), place/cancel,
  My bets (record, profit, in play, open + settled), Leaders (all 12 bankrolls)
  + Bet feed, Rules. Header shows your Bucks. Me tab: log out; commish sees
  Book controls (post lines, move/void a line, settle, add/remove Bucks, reset
  PIN, Book log). Old practice bets saved on the phone are gone. Click-tested
  in a phone-size browser against local Postgres (screenshots looked right,
  no page errors, no sideways scroll).
- 2026-10-09 — **Banana Book backend** (Claude). New folder `server/book/`:
  `schema.sql` (tables, created automatically on every start), `engine.js` (odds
  math + grading, pure functions), `kickoffs.js` (ESPN kickoff times, Pacific
  time helpers), `data.js` (what the Book reads from Sleeper), `book.js` (logins,
  ledger, lines, bets, locks, settlement, clock job). Routes in
  `server/routes/book.js` (list in BIBLE §10). Clock job runs every 10 min:
  posts lines Tuesday 6 AM for the coming week (from Week 6), refreshes each
  game's lock time (first starter's kickoff), settles Wednesday 3 AM once
  Sleeper has finalized the week. Parlays (2–4 legs) are included already.
  Tested end to end against a local Postgres + stand-in Sleeper/ESPN
  (36 checks: posting time, locks incl. Thursday + London games, PIN rules,
  own-game rules, limits, cancel, parlay, commish tools, payouts to the cent,
  no double settle). Test script: Claude's scratchpad `booktest/run.mjs`.
- 2026-10-09 — **v1.7** (Claude), after Jayson said v1.6 was still crowded and had
  too much sideways swiping: Home is now ~1 screen — hero with "Your game"
  (your live score, opponent, win %), "This week" 2-column live score grid,
  "Last week" 3 stat cells (Top Banana / Rotten / Top player) with a
  "Recap & scores" sheet, and a 3×3 Explore grid (Awards, Playoff odds, Power
  rankings, Record book, History, Rivals, Weekly results, This week in
  history, Lab). Removed all Home carousels. Awards = season segmented control +
  compact list rows. Records = "Change ▾" picker sheet instead of an 11-chip
  sideways row; #1 in the hero, #2–5 below. Week/season chips wrap instead of
  scrolling sideways.
- 2026-10-09 — **v1.6** (Claude), after Jayson said there was too much scrolling
  and he couldn't find Awards: Home hero tiles swipe sideways; Week matchups are
  swipeable cards (tap = preview); "Explore the league" tile grid (Awards, Playoff
  odds, Record book, History, Rivals, Lab); Awards race swipe row; results show 3
  games + "Show all"; power rankings as swipe cards. League tab uses a 4×2 icon
  tile menu instead of a sideways chip row (Awards was hidden off-screen).
  Awards page redesigned: season cards (with each year's champ), champion +
  Sacko spotlight, award grid, "Share awards" card. Records show top 5 + "Show all".
- 2026-10-09 — Bye-week scores in records (e.g. 193.02, 2025 Wk 15) are now tappable: "Playoff bye" card with week rank, every score that week, and the lineup (live). (Claude)
- 2026-10-09 — Fixed "old placeholder app showing" (Claude): the Phase 0 React
  build had installed a service worker on phones that kept serving the old
  page. Server now serves v1.5 at every address, replaces /sw.js with a
  self-removing worker that clears caches, and the page unregisters any old
  worker on load. Manifest + icons served directly. The React app in src/ is
  NOT served right now (v1.5 page is the app until React catches up).
- 2026-10-09 — **Live on Railway** (Claude): Sleeper calls now prefer IPv4 and
  time out instead of hanging; `/api/diag` confirms Railway reaches Sleeper
  (200 in 76 ms, all 4 seasons found). `/api/hub` returns real live data
  (14 managers, Week 5 live). .gitignore fixed so prototype/dist is committed.
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
- Nothing half-done. Needs a real-phone check by Jayson once Railway has the database.

## Next steps (in order)
A. Jayson: confirm `/api/health` shows the database connected, log in to the Book
   as The Water Boyz to claim the commish team + PIN, and tell the league to log in.
   Tue Oct 13 6 AM: check Week 6 lines posted (if not: Me → Book controls → Post lines).
B. Weekly specials (Top Banana / Rotten Banana / low-score O-U), priced by simulation.
C. Futures (Champion / Sacko) repriced Tuesdays.
D. Playoff weeks (15–17) lines: only bracket games; not built yet (Book stops after Wk 14 for now).
E. Verify Lab endpoints with real data on Railway.

## Decisions made (and why)
- **Book details decided while building (Claude, 2026-10-09):** you can bet the over on your own game but not the under; bets can be cancelled until their game locks; 5 wrong PINs = 15-minute lock; phones stay logged in 180 days; parlays pay at most 10,000 back; lines keep the v1.5 projection formula (BIBLE §7) instead of Sleeper player projections; if ESPN kickoff times can't be read, betting pauses rather than guessing.
- **Lock rule detail:** a game's lock time = earliest kickoff among both lineups' current starters, rechecked every few minutes; once locked it never reopens (Sleeper locks a player once his game starts, so the time can't move earlier after that).
- **Banana Book rules (Jayson, 2026-10-09):** per-game lock (first starter's kickoff), 1,000 Bucks once per season with NO allowance, launch with spread/ML/total + weekly specials + parlays + futures, team + 4-digit PIN login. Full rules in BIBLE §7. Book opens for real in Week 6.
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
- DATABASE_URL was added on the mahomies-hub service 2026-10-09; confirm `/api/health` says db connected after the redeploy.
- First login to a team sets its PIN, so whoever logs in first owns it; commish can reset a PIN if someone grabs the wrong team.
- Playoff odds tiebreak = points for (check league's real tiebreaker setting).
- Claude can push to main now; pushing git tags is blocked, so saved versions live on branches (release-v1.0).
- Test build data is a snapshot (Oct 8, 2026 night). Live sync = Phase 1.
- 2026 uses a league-median game (records include median W/L); 2023–2025 did not.
- Player names in the snapshot only for 16 players; full names come from /api/game on Railway.

## Files changed in the latest push
- New: prototype/v1.8/ (app18.template.html, v18_book.js, v18.py), prototype/v1.7/night.html (saved build)
- Changed: prototype/dist/night.html (v1.8), server/index.js (/test/v1.7), server/hub/build.js (version 1.8), HANDOFF.md, CHANGELOG.md
