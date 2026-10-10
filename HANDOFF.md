# HANDOFF — where we left off

**Last updated:** 2026-10-09 12:10 (Pacific) · **AI:** Claude
**Current phase:** v1.8 — Sportsbook is live in the app (login, bets, parlays, leaders, commish tools); Week 6 lines post Tue Oct 13 6 AM; next = specials + futures
**Last commit:** "Live betting (nothing locks, odds move with the score) + MH logo"
**App status:** LIVE on Railway — https://mahomies-hub-production.up.railway.app (v1.7; old builds at /test/v1.6, /test/v1.5, /test/v1.0)

## What we're working toward right now
The app is live on Railway with real Sleeper data and the Sportsbook. Look = "Night"
(neon night-street palette). **No Banana Bets branding anywhere** — this is its own app.
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
- 2026-10-09 — **Sportsbook batch 1** (Claude). Jayson's calls: broke = out for the season (no re-buys); player props IN (parlay-able); tickets show the bettor.
  - **Player props**: over/under on any starting QB/RB/WR/TE's fantasy points. Line = Sleeper projection scored with league settings (live: pts so far + proj for the rest of his game), x.5, -110/-110; off the board when his game is ~over, bye, or proj < 3. Can't take the under on your own player. Bet legs keep the fantasy matchup in line_id (so parlays stay one-pick-per-matchup) + player_id/player_name (new columns). Graded Wednesday from every roster's players_points (void if the player isn't on any roster). engine.js `propPrice`/`gradeProp`, book.js `propsFor`.
  - **Game cards**: sportsbook grid (Spread · Total · Money per team row, O on top / U on bottom), live progress bar, "Opened …" line, "Player props (N) ›" link.
  - **Props tab** (matchup picker, players grouped by fantasy team).
  - **Bet slip**: up to 8 picks; Singles (each its own bet, same amount each) or Parlay (2–4, one per matchup, combined odds); **Review → Confirm & place** screen with total risk / to win / balance after; odds-moved handling re-shows the slip with new prices.
  - **Tickets**: casino-style paper ticket with the MH logo, ticket #, time, bettor (team + manager), legs, risk/to win/payout, OPEN/LIVE/WON/LOST stamp, barcode; opens after placing and from any bet in My bets or the feed; **Share ticket** makes a PNG.
  - **My bets / feed** shown as ticket stubs. Rules tab removed (now in "How it works").
  - **Book health** (commish, Me tab): database, Sleeper, lines, open bets, settlement time, ESPN clocks, Sleeper projections, last clock-job run + recent errors (`GET /api/book/admin/health`).
  - Tests: Book suite 44 checks + props suite 10 checks pass (scripts in Claude's scratchpad booktest/; fixtures built from real league data, not committed).
- 2026-10-09 — **Sportsbook uses Sleeper's live projections** (Claude). Jayson saw "proj 116.2" in the Book while Sleeper showed 128.97 with Irving's points in. data.js `projections()` pulls Sleeper's player projections (api.sleeper.app/projections/nfl/{season}/{week}, unofficial but what the Sleeper app uses), scored with the league's own scoring settings, cached 10 min. `weekState()` now builds each lineup's live projected final = points scored + projection × share of each starter's game left (used when projections cover ≥70% of the lineup; otherwise falls back to the history projection). Live odds use it; the "proj" under each team in the Book now shows this live number (pregame: Sleeper's current projection). Tuesday lines blend 60% Sleeper lineup projection + 40% history (history only if Sleeper has none). Lines already posted stay frozen. Env override for tests: SLEEPER_PROJ_BASE.
- 2026-10-09 — **Betting stays in the Book** (Jayson: "a fantasy companion/history/stats/hall of fame app first; betting is a fun side game"). Home "Your game" now shows each team's record + standing (e.g. 4-4 · 7th place) instead of a Sportsbook win %, no win bar, no "Bet →" link. Matchup previews opened anywhere except the Book tab drop the win chance and betting line (form, keys, history stay). (Claude)
- 2026-10-09 — Record book: full game details wrap instead of "..." (regular font so they take fewer lines), and every number has a label (won by, points, pts in a loss/win, season pts, wins/losses in a row); streaks show "8 · wins in a row" instead of "8 W". "How it works" button no longer stretches full width. (Claude)
- 2026-10-09 — Draft re-grade rows: "Rd 12 · #137" pick badge, team with avatar, "Drafted #137 → finished #14 ▲123 spots", "season pts" label under the number, a one-line explainer under each heading, short header. Source prototype/v1.8/v18_draft.js. (Claude)
- 2026-10-09 — Awards list: each row now shows the award name, the team (with avatar) on its own line, the full description (wraps, no more "...") and a label under every number (points, weeks on top, extra wins, wins lost, points against, won by, lost by). (Claude)
- 2026-10-09 — **Trade grader v2** (Claude), from Jayson's feedback (who got what was unclear,
  points unlabeled, names splitting across lines, wanted a tracker for ongoing trades, a
  0–0 trade and a "too close to call" at 170–150 looked wrong). Server `tradeReport()` in
  server/routes/lab.js now returns, per side: got/gave players (pos, NFL team), picks, FAAB,
  players dropped to make room, week-by-week (each received player started/bench/gone, points
  started, bench points, team score, opponent, W/L, median W/L), points per game + record
  before vs since, and a verdict. **New verdict rule:** gap in points started ÷ weeks since
  the trade: <3/wk = too close to call, 3–7 slight edge, 7–15 clear win, 15+ landslide; first
  2 weeks marked "early". (Old rule was a 15% gap in season totals, which called 170–150 a
  coin flip no matter how many weeks.) App: cards show "Got" chips (names never split),
  "Pts started" label, Ongoing/Final tag, tug-of-war bar; tapping opens a full breakdown
  (verdict + scale, the deal, running-total chart with tap tooltips, week-by-week, did it
  help the team, insights). The 0–0 trade (2024 Wk 8, Worthy for McMillan + $30 FAAB):
  checked against Sleeper — neither team ever started the player it got (Worthy sat on the
  bench, scored −1 in Wk 9), so 0 started is correct; the new view shows their bench points
  and the FAAB. Chart colors validated for the dark background (gold #b38c14, blue #3b8fe8,
  rose #d9577a). Sources: prototype/v1.8/v18_trades.js + v18_trades.css.
- 2026-10-09 — **"How it works" explanations** (Claude), Jayson wants people to understand how
  every number is made. A cyan "ⓘ How it works" button on Standings, Power rankings, Playoff
  odds, Awards, Record book, All-time, Rivals, matchup preview, Sportsbook lines, Bench Shame,
  Trade grader and Draft re-grade opens a plain-English sheet. Me tab has a "How the app
  works" list with all 13 topics (incl. "Where the data comes from"). Text lives in
  prototype/v1.8/v18_explain.js — **update it whenever a formula changes.**
- 2026-10-09 — Header (logo + Bucks/Log in button) now scrolls away with the page instead of sticking to the top (Jayson: "looks bad"). A solid strip behind the phone's status bar keeps the clock readable. Bottom tab bar still stays put. (Claude)
- 2026-10-09 — **Live betting + MH logo** (Claude). Jayson: "I don't want anything to be locked —
  the odds should change like betting during a game." Once a matchup's first starter
  kicks off, its odds go live (engine.js `livePrice`: points so far + projection × share of
  lineup left, from ESPN period/clock; data.js `weekState`). Betting only stops when every
  starter is done. Server re-prices at placement and refuses if the price got worse
  ("Odds moved", 409) — the app then shows the new price. Cancel only before kickoff.
  Lopsided games: favorite's moneyline comes off the board past -1000. New columns
  lines.sd_a/sd_b (filled in automatically for lines posted earlier) and bet_legs.live.
  App: "Live odds · 63% left to play" header, opening line shown under live games, LIVE tag
  on live bets, 30-second refresh while games are live. Logo: Jayson's gold MH + football
  is now the home-screen icon and the header logo. Test suite now 44 checks (live odds,
  stale-price refusal, ML off the board, no bets after games end).
  "Share left to play" weights each starter by position (QB 19, RB/WR 13, TE 9, K 8, DEF 7),
  so a Thursday kicker moves odds less than a QB. Empty / bye starter slots count as nothing
  left and show as "N slots not playing" under the team.
- 2026-10-09 — **Banana branding removed** (Claude), Jayson: "this isn't the Banana Bets app".
  Banana Book → **Mahomie's Sportsbook** ("the Book"), Banana Bucks → **Mahomie Bucks** (💵),
  Top Banana / Rotten Banana → **🔥 On Fire / 🧊 Ice Cold** (awards, Home "Last week" cells
  now say High score / Low score, all-time table), Banana Book Champion → Sportsbook Champion,
  new **neon football app icon + header logo** (replaces the banana). CSS color names are
  now --gold (same yellow). Server text, manifest, BIBLE §4 (rewritten for the Night look)
  updated. Old saved builds (/test/v1.0–v1.7) still show the old names; left as history.
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
- 2026-10-09 — **Sportsbook backend** (Claude). New folder `server/book/`:
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
  "Last week" 3 stat cells (High score / Low score / Top player) with a
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
A. Jayson: try it on Week 5 now (small straight bet, a 2-pick parlay with a prop, open the ticket, share it), check Wednesday 3 AM settlement in My bets; open Me → Book controls → Book health.
B. Sportsbook batch 2 (Week 6): weekly specials (On Fire / Ice Cold / low-score O-U), weekly best bettor, **Sportsbook Champion** in Awards / hall of fame.
C. Batch 3 (Week 7): futures (title + Sacko odds from the season sim, repriced Tuesdays).
D. Maybe later: tail a bet from the feed, reactions, cash out.
E. Playoff weeks (15–17) lines: only bracket games; not built yet.
F. Verify Lab endpoints with real data on Railway.

## Decisions made (and why)
- **Sportsbook rules (Jayson, 2026-10-09):** going broke = done for the season, no re-buys. Player props are in and can be parlayed (one pick per fantasy matchup still applies). Tickets/shares show the bettor's team (+ manager name). Every bet needs a confirm step.
- **App identity (Jayson, 2026-10-09):** fantasy companion / history / stats / hall of fame first. Sportsbook numbers (win %, lines, odds) only appear inside the Book tab.
- **Book details decided while building (Claude, 2026-10-09):** you can bet the over on your own game but not the under; bets can be cancelled until their game locks; 5 wrong PINs = 15-minute lock; phones stay logged in 180 days; parlays pay at most 10,000 back; lines keep the v1.5 projection formula (BIBLE §7) instead of Sleeper player projections; if ESPN kickoff times can't be read, betting pauses rather than guessing.
- **Live betting replaces locks (Jayson, 2026-10-09):** a matchup goes live at its first starter's kickoff; odds then move with the score; betting stops only when every starter is done. (DB column `lines.locked` now means "started".)
- **Sportsbook rules (Jayson, 2026-10-09):** per-game lock (first starter's kickoff), 1,000 Bucks once per season with NO allowance, launch with spread/ML/total + weekly specials + parlays + futures, team + 4-digit PIN login. Full rules in BIBLE §7. Book opens for real in Week 6.
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
- No banana names anywhere (Jayson, 2026-10-09).
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
- prototype/v1.8/ (v18_book.js, v18.py rename pass, app18.template.html, logo.svg), prototype/dist/night.html
- public/ icons + favicon.svg (football), server text (build.js award titles, index.js manifest, book comments)
- src/ (unused React shell) names, index.html, BIBLE.md, README.md, HANDOFF.md, CHANGELOG.md
