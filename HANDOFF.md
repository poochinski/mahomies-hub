# HANDOFF — where we left off

**Last updated:** 2026-10-10 16:00 (Pacific) · **AI:** Claude
**Current phase:** v2.3 is live (the whole audit list + Sportsbook batch 2). Next: Jayson tests on his phone; check the Week 6 post Tue Oct 13 6 AM PT (lines + Specials); Yahoo import parked.
**Last commit:** "v2.3: version number + docs"
**App status:** Working · **Live URL:** https://mahomies-hub-production.up.railway.app

## What we're working toward right now
**v2.0 Home page rework** (docs/V2-HANDOFF.md Part 4), then the Live Game Center (2.1). Front end is `prototype/v2.0/` (app.html, app.css, app.js, snapshot.json) — edit directly, no build step. Do not edit prototype/v1.x or prototype/dist.

Where things stand (Grok, 2026-10-10):
- Home parts 1–4 are live. Part 4: This week is one game per row (your own game left off once this phone has picked a team, closest first). Scores match the card (projection, not 0.00). Tags: all-time series ("Boyz lead 6–0" or "Tied 3–3"), Final, Upset brewing (worse record ahead on points, only after the game has started). Last week has a one-sentence recap. Explore is one row: This week in history, Awards, Record book.
- Your game card is unchanged: lineup check, median-game line. No playoff odds or standings strip on the card (where playoff odds go on Home is still open).
- Box-score lineups fixed (the slot's old `.slot` class was hiding the slot column). New Home classes are prefixed `tw-`.
- Gridiron Gold v2.1 is live. Any slot math change: re-run par.js, update `PAR` in engine.js.
- Next: Live Game Center (2.1).

## Done (newest first)
- 2026-10-10 — Jayson: League tab is only for fantasy football; Sportsbook awards stay in the Book. Removed the Sportsbook Champion row from `awardsView`; it's now a card at the top of Book › Leaders (above Best bettor). (Claude)
- 2026-10-10 — **Season futures** (Claude; Jayson said yes, with a 250-Buck season cap). Sim in server/hub/build.js now also plays the playoff bracket + Toilet Bowl and returns `champ`, `sacko`, `pking`, `wins_ou {line, over}` per team in `odds.list`. `server/hub/cache.js` holds the shared `getHub()` (used by /api/hub and the Book). Book: `postFutures` (after `postLines`; also back-fills the current week before kickoff), `futuresFor` → `linesFor().futures`, `settleFutures` in `tick()`, `futures_used` on /book/me, setting `futures_cap` (250). Client: Specials tab has "This week / Season futures"; `futuresView`, `FUM`, `fuLine`, `fuRow`, `fuName`. Tests (scratchpad `booktest/fut.mjs`): 19 pass; Book 44, specials 25 still pass. NFL stat props (anytime TD) parked as a maybe; yardage = no.
- 2026-10-10 — **v2.3 shipped** (Claude): footer says v2.3. The pre-v2.3 state is saved on branch `release-v2.2` (commit 014c753) if anything needs rolling back. Seven pushes: cleanup → team page/search/Back → League Wire → Me → tables → one Game page → Sportsbook batch 2 (details below).
- 2026-10-10 — **v2.3 push 7: Sportsbook batch 2** (Claude; due before Tue Oct 13 6 AM).
  - Specials: `priceSpecials` / `gradeSpecial` / `americanWide` in server/book/engine.js (4.5% hold, cap +5000); `insertSpecials` runs inside `postLines`; `ensureSpecials` backfills a posted week that has no board yet (only before any kickoff); `specialsFor` → `linesFor().specials`; specials lock at the week's first kickoff (`liveWeek` updates matchup 0); `settleWeek` grades them from every team's final; labels "On Fire: X top score" etc. New table `book_specials`.
  - `GET /api/book/weekly` (best bettor). Client: Book "Specials" segment (`specialsView`, `spk`), slip/ticket support (`SPM`, `spLine`, `spOdds`, `vsTxt`), `bestBettor()` on Leaders, Sportsbook Champion row in Awards (current season, from the Book leaderboard).
  - Tests (Claude's scratchpad `booktest/spec.mjs`): 25 checks pass (board, overround, bets, blocks, kickoff close, settle math, best bettor, dead heat). Old suites still pass: Book 44/44, props 10/10, slot ledger.
  - **Check Tue Oct 13 6 AM:** Week 6 lines AND the Specials tab should appear. First settlement Wed Oct 21 3 AM.
- 2026-10-10 — **v2.3 push 6: one Game page** (Claude). Game Center header shows the stage (Preview / Live / In progress / Final). `matchupStory(a,b)` (form bars, keys, series, last meeting; no betting numbers) was pulled out of `previewSheet` and is appended to the Game Center; the "Matchup preview & history" button (`data-gcprev`) is gone. The Book still opens `previewSheet(id,true)` with the line. Past games still open `gameSheet` (final box score). Back history (push 2) covers moving between them. `.form-bars` now lays bars out in one row for any number of weeks.
- 2026-10-10 — **v2.3 push 5: tables** (Claude). `td.tm` names wrap (2 lines) instead of ellipsis; Playoff odds: no avatar, record under the name, "#1" column dropped, intro trimmed to one line; All-time: `atCard` list with sort chips (`S.ats`: titles / pct / avg / playoffs / tb); Game Center player names wrap to 2 lines (`.gc-p b`).
- 2026-10-10 — **v2.3 push 4: Me as one identity** (Claude). `me()` rewritten: identity card (`S.me`; logged in shows Log out; logged out shows the team picker + "Log in to bet"), My team panel (data-team, this week's opponent → game), My Book (from `BK.me`: balance, open bets, could win, won-lost, 3 open tickets), `profile(u,true)` now titled "My career" (no second name header), Record vs everyone rows are `data-rival` → League › Rivals with that pair, How the app works is one row (`data-howto` → sheet). Manager pages (`profile(u,false)`) got a "This season: roster & schedule ›" link to the team page.
- 2026-10-10 — **v2.3 push 3: League Wire** (Claude). `GET /api/wire` (server/team.js `wire()`): every completed trade / waiver / free-agent move this season, newest first; per side: players got (with points scored as a starter for the new team from the move's week through the last scored week), dropped, draft picks; summary (moves, trades, claims, top bid, FAAB by team). Home: `wireHome()` after Last week (latest 4); `data-wire` opens `wireSheet()`. Team names inside Wire rows are `<b data-team>` (handled by the capture listener because they aren't buttons). Loaded with the hub, refreshed every 3 min.
- 2026-10-10 — **v2.3 push 2: Team page, player search, Back** (Claude).
  - Server `server/team.js`: `GET /api/team/:uid` (current lineup by slot, bench/IR/taxi with season points + starts + how acquired, regular-season schedule incl. future weeks, this season's moves), `GET /api/players/search?q=` (fantasy positions, rostered players float up, owner), `GET /api/wire` (built for push 3). `leagueIndex` is now exported from server/player.js.
  - Client: `teamOpen/teamHtml` (data-team; Standings, Power rankings, Playoff odds rows open it; "Career ›" goes to the old manager page), `searchOpen` (🔍 header button). Sheet history: `nav(fn)` pushes the current sheet before opening a new one, `openSheet` adds ‹ Back (`data-shback`) when there's history, close clears it. The old player-card-only `PLB` is gone. Game Center restarts its timer when you come back to it.
  - Local mock Sleeper (Claude's scratchpad) now has rosters, lineups, transactions and a draft so these can be tested.
- 2026-10-10 — **v2.3 push 1: cleanup** (Claude; Jayson said do the whole audit list now). `recapOne` = blowout + nail-biter + upset + top-3 record (no longer repeats High/Low tiles). Explore → one `.twih-go` row. League `LSEGS` → `.chips.lchips` row (Records removed; it's a tab). Power rankings subtitle = last-3 ppg only. Standings' "2026 weeks" card removed; History view starts with the current season card. Header button shows "Book" when logged out. Last-week tiles 2 decimals. Removed dead `DONE/matchCard/awardCard/oddsBar`, ~85 unused CSS rules, the old React app (`src/`, `index.html`, `vite.config.js`) and Vite/React deps; `npm run build` is gone (Railway just runs `npm start`).
- 2026-10-10 — **Yahoo history import, part 1** (Claude). The league played **2021 (10 teams) and 2022 (12 teams) on Yahoo**, PPR both years, then moved to Sleeper (12 teams since). Jayson wants those years in the app.
  - New page **/yahoo** (server-rendered, phone-sized). Actions are commish-only: the page reads the Book login from `localStorage['mh-auth']`.
    1. Paste the Yahoo app Client ID/Secret (saved in Postgres `yahoo_kv`; Railway vars `YAHOO_CLIENT_ID`/`YAHOO_CLIENT_SECRET` win if set).
    2. Connect Yahoo (OAuth2, read-only). Redirect URI `https://mahomies-hub-production.up.railway.app/yahoo/callback`.
    3. Find leagues (`users;use_login=1/games;game_codes=nfl/leagues`) and import each one.
  - The import runs in the background. Every Yahoo answer is saved **as-is** in `yahoo_raw (path, league_key, ok, body)`. Saved per league: settings, standings, teams (managers), draftresults/players, transactions, league, scoreboard for every week, and every team's roster with weekly player stats.
  - **Public read-only checks** (no keys or tokens): `/api/yahoo/status`, `/api/yahoo/raw-list?league=KEY`, `/api/yahoo/raw?path=PATH&norm=1`. `norm=1` flattens Yahoo's odd JSON.
  - Claude's sandbox can't reach Yahoo. Tested against a mock Yahoo (connect, wrong state, find, import, a failed piece, stopping after 8 failures in a row).
  - **Part 2 (next):** read the saved answers and build 2021/2022 in the same shape as Sleeper seasons. That needs a manager-matching screen (Yahoo nickname → Sleeper user, plus "former" managers) and a 10-team 2021. Then merge into History, Records, All-time, Rivals, Awards and player cards, with a "Yahoo era" tag. Player IDs: Sleeper's players DB has `yahoo_id`.
- 2026-10-10 — **Full audit** (Claude, Jayson asked for a page-by-page breakdown): `docs/AUDIT-2026-10-10.md` lists repeats, dead navigation, cut-off names, missing features (team page/roster, player search, league activity feed, schedule, one identity on Me) and code cleanup, with a suggested order. Waiting on Jayson to pick what to do first.
- 2026-10-10 — **Player photos** (Claude, Jayson asked why there were none): `plPic()` loads Sleeper's CDN headshot `sleepercdn.com/content/nfl/players/thumb/{id}.jpg`, falls back to ESPN (`a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png`, Sleeper players `espn_id` kept as slim `e`) or Sleeper full-size, then initials; defenses use `sleepercdn.com/images/team_logos/nfl/{team}.png`. On the player card (76px) and Game Center rows (20px). Images can't be checked from Claude's sandbox; verify on the phone.
- 2026-10-10 — **v2.2 Player cards + everything clickable, first pass** (Claude). Jayson: tap an NFL player anywhere → profile (no new tab); taps should open relevant info, not just the manager page (e.g. Bench Shame → the actual games/bench).
  - `GET /api/player/:pid` (server/player.js): bio (Sleeper players DB; slim now keeps age `a`, number `no`, years_exp `x`, college `c`, `ht`, `wt`), `on_now` (current roster), NFL seasons (this + 2 previous) from Sleeper's per-player stats endpoint `api.sleeper.app/stats/nfl/player/{id}?season=&grouping=week`, re-scored with OUR scoring settings (cached 30 min current / 7 days past), and league history from a whole-league index (all seasons: matchups, owners, drafts + picks, transactions; rebuilt every 10 min): per season owners in order, starts / weeks rostered, points started / on bench, draft pick, moves (trade / waiver with FAAB / add / drop), week-by-week list, best start.
  - Client: capture-phase listener opens the card for any element with `data-pl` (works inside buttons). Names wired in: Game Center, box scores (starters + bench), trade grader (chips + detail), draft re-grade, Book props, Best player game record (rows + "Player card" button). Card has ‹ Back to the sheet you came from (Game Center reopens live). Week rows / best start open the game.
  - Bench Shame: `/api/bench` weeks now carry `scored`, `should` (bench players the best lineup would start) and `sat` (starters it would sit). Team rows open a sheet: each week, who should have started instead of whom (names tappable), tap the week → box score.
  - Couldn't hit Sleeper from Claude's sandbox: UI tested with sample data; live endpoint checked after deploy.
- 2026-10-10 — **v2.1 Live Game Center** (Claude, Jayson said go).
  - Jayson: before a team plays, show **0.00** (not the projection) on Your game and This week; the projection stays small underneath (`ygScore`).
  - Tapping Your game or a This week row (Home/League, not the Book) opens the Game Center sheet (`gcOpen` in app.js; Book still opens the betting preview). Header scoreboard (points, projected final, playing/left, leader in green), a "needs X more" line for the team projected to lose (Monday night: "to win"), every starter side by side by slot (name, pos · NFL team, vs/@ opponent, game status: kickoff time / live clock + NFL score / Final / Bye, injury tag, empty slots in red), points big + projected final small, both benches, "Matchup preview & history" button (old preview), refreshes every 60 s while open.
  - Server: `GET /api/live/:week/:mid` → `gameCenter()` in server/book/data.js (Sleeper matchups + projections + ESPN). `kickoffs()` now also keeps ESPN `detail` (clock text), `home`, `score`. `league()` has `slots` (roster_positions without BN/IR/TAXI). CSS prefix `gc-`.
- 2026-10-10 — **This week tweaks** (Claude, Jayson asked): leader's score in green (`twLeader`: final score when both done, points once anyone has played, nobody before kickoff). "Upset brewing" only on the week's single biggest upset (`upsetOn` now returns a size = win gap, ties broken by point lead; `thisWeek()` tags the max). Reviewed Grok's Home part 4: good, kept as is.
- 2026-10-10 — **Home part 4** (Grok). Jayson said go on the proposal.
  - This week: one full-width row per game, your game left off when a team is picked on this phone, tightest gap first. Gap is the projected final while the game is still going, the real margin once both lineups are done. Finished games sit under games that aren't done. Scores use the same pulse numbers as the card (proj before they play, points plus proj while they're playing, final when both are done). No spreads, odds, or win %.
  - Tags: all-time series from head-to-head ("Phil McCraken leads 3–1", "Tied 2–2"; names ending in s or z use "lead"), Final, Upset brewing (the team with fewer wins this season is ahead on points, and both teams have started). A few early points against a team that hasn't played yet is not an upset.
  - Last week: one sentence, the same first line as the full recap. Explore is three tiles: This week in history, Awards, Record book.
- 2026-10-10 — **Gridiron Gold v2.1** (Claude). Jayson: go to 20 lines; he hit only 3 features in hours of testing (normal at 1 in 156, but too rare for this game); asked for progressive pots.
  - 20 lines (side number tabs replaced by plain gold rails; 20 line colors). Free spins 8 × 2, Two-Minute Drill 6 starting drives, TD 23%; both features 1 in 87. Pays trimmed. Exact par 92.48% incl. 1.5% progressive (BIBLE §7). Sim cross-check 91.05% (without progressive) vs par 90.98%.
  - Progressive MAJOR/GRAND per season + bet size (`slot_jackpots`; seeds 50×/250× bet; +1% / +0.5% of each paid spin). Drill coins are priced in Bucks when the drill triggers (`cell.amt`, `frame.got_amt`, `bonus.jackpots`, `bonus.jp_won`); won pots reset. State/spin responses carry `pots`; plaques tick up after each spin. Old pending bonuses still replay (client falls back to v × bet).
  - `GET /api/book/slots/stats`: spins, Bucks played/won, features hit vs expected, payback, biggest win → "Your season on Gridiron Gold" in the paytable.
  - Tests: slot ledger test passes (balance matches to the cent; a MAJOR was won and reset); UI checked at 390px (machine, paytable stats, a drill collecting a MAJOR).
- 2026-10-09 — **Gridiron Gold trigger change** (Claude, Jayson's call): the Two-Minute Drill starts on **3 or more stopwatches anywhere** (was one on each of reels 1–3). Strips: 1 stopwatch on every reel (was 2 on reels 1–3). Bonus 1 in 156 (was 187). Line pays trimmed (see BIBLE §7) → par **92.53%** (`node server/slots/par.js`; sim 92.4%; slot ledger test passes). Client: anticipation on 2 stopwatches, highlights on any reel, paytable text.
- 2026-10-09 — Jayson: playoff odds don't belong in the weekly game card. Removed entirely. **Open question:** where playoff odds should live in the Home / weekly breakdown — decide with Jayson later. (Claude)
- 2026-10-09 — Jayson: the standings strip was too much. Removed it; Your game now shows one gold line under your record: "7.3% playoff odds" (`myOdds()`). Games-back info lives on the Standings page. (Claude)
- 2026-10-09 — **Home part 3 + box score fix** (Claude). Jayson kept the new game card (no revert).
  - Inside Your game: **Lineup check** (orange) for my starters who haven't played and are Out / Doubtful / IR / suspended, on bye, or have no NFL team, plus empty slots ("Fix it in Sleeper"). Injury tags = Sleeper `injury_status` from the daily players pull (`server/sleeper/client.js` slim field `i`; `weekState` players carry `inj`; `homeCard` sends `warn_a/b`, `empty_a/b` on /api/pulse).
  - **Median game line** (only when `D.league.median`): every team's projected final (final pts if done, else live/pregame projection) ranked; "projected 4th of 12 · on track for the extra win" or "2.0 pts short of the top 6 (top-6 line ≈ 123.4)"; after the week "finished 4th · extra win ✓". Tap → new "Median game" How-it-works topic.
  - **Standings strip** under the card (tap → standings): place, playoff line ("2 games back of 6th" / "1.5 games up on 7th", standard games-back math, W-L incl. median), playoff odds.
  - **Box score bug**: the slot machine's root class `.slot` (position:fixed, hidden) collided with the lineup's slot-label `.slot`, so the middle column vanished and the right team got squashed (Jayson's screenshot). Slot root renamed `.ggslot`. Team names in the box-score header now wrap. (/test/v1.8 still has the old bug; it's frozen.)
- 2026-10-09 — **Home part 2** (Grok): game card uses `weekState` projections on `/api/pulse` `games`. Pregame number is the projection. In progress: points so far, proj underneath, "N playing · N left".
- 2026-10-09 — **Home part 1** (Grok): Live badge follows ESPN. Phase line replaces the giant week title.
- 2026-10-09 — **v2.0 start** (Claude): v1.8 frozen. Live page split into prototype/v2.0. docs/V2-HANDOFF.md. BIBLE §17.
- 2026-10-09 — Sportsbook batch 1, live odds, player props, tickets, commish Bucks, Gridiron Gold slot (secret: Book tab, 2nd footer dot, the pink one). Payback 92.51%. See CHANGELOG.md for the rest of Oct 9.

## In progress (not finished)
- **Yahoo import: PARKED (Jayson, 2026-10-10).** Part 1 is live at /yahoo. Login works, but Yahoo still refuses the find-leagues call ("not authorized"), even after he checked the app permissions and the login started asking for `scope=fspt-r`. When we pick it up again: get a screenshot of the app's API Permissions on developer.yahoo.com, check `/api/yahoo/status` (connected_at/scope show whether a fresh login happened), and try a new Yahoo app with only Fantasy Sports → Read. Fallback: Jayson screenshots Yahoo's History pages (standings + champions).

## Next steps (in order)
0. **More "clickable" passes** (Jayson wants everything to open relevant info; expand as the app grows): award rows → the game/week that won it; standings stats (PF, all-play, luck) → week-by-week breakdown; power-ranking score → the four ingredients; H2H cell → rivalry (exists); recap names → games; Last-week top player tile → player card; playoff odds row → that team's remaining schedule.
1. ~~2.1 Live Game Center~~ done. Ideas for later: highlight players currently on the field, show big plays, push alerts.
2. ~~Sportsbook batch 2~~ done (v2.3). Check the Week 6 post **Tue Oct 13, 6 AM PT** (lines + Specials); first settlement **Wed Oct 21, 3 AM PT**.
3. Jayson: confirm Gridiron Gold sound on a real iPhone.

## Decisions made (and why)
- Fantasy / history first. Betting numbers (win %, lines, odds, spreads) only inside the Book tab. (Jayson, 2026-10-09)
- No Banana Bets names or assets anywhere.
- Mahomie Bucks are play money. 1,000 once per season, no re-buys. Commish adjustments are logged and cannot take a team below 0.
- Nothing locks in the Book. Odds move once a matchup's first starter kicks off. Every bet has a confirm step. Cancel only before kickoff.
- Gridiron Gold stays secret (not in menus or How it works). Server RNG, fixed strips, payback ≈92.5% (`node server/slots/par.js` after any math change).
- The browser never calls Sleeper or ESPN. Only `/api`.
- "Live" on Home is ESPN game state `in`, not a connection light. (Jayson via the v2 audit, 2026-10-09)
- Waivers phase shows Tuesday all day and Wednesday before 11 AM Pacific, and only before any NFL game that week has started.
- Former managers stay in every list, tagged Former.
- App admin is Jayson (Sleeper user Poochinski, `862901935416655872`). Sleeper league owner is MattGomez. Those are different.

## What we talked about / ideas parked
- Where to show playoff odds on Home / a weekly breakdown (not on Your game). Jayson wants to revisit.
- Full v2 order after Home: 2.1 Live Game Center, 2.2 weekly specials + Sportsbook Champion, 2.3 title/Sacko futures + playoff-week lines, 2.4 League Wire, 2.5 push + share cards + Hall of Fame voting, 2.6 start/sit (commish first), Book accuracy, survivor, dues ledger.
- Early-season Book lines can be very wide. Review after Week 8.
- Start/Sit helper may stay admin-only.

## Testing notes
- `describeWeek` checked against fake weeks: Tuesday → "Waivers run Wed" + a Thursday kickoff; Sunday with games on → "Game day" and Live; Sunday night with two Monday games left → "Monday night: 2 games left"; all final → "Week in the books" and no Live badge.
- `/api/pulse` was called against the real ESPN scoreboard for the current week (see the push that added it).
- Not yet looked at on a real phone. After Railway finishes, open Home at phone width. Friday night should not show a green Live dot unless a game is on.

## Known bugs / open questions
- Lab endpoints (bench, trades, draft) only tested with fake data. Verify on Railway with real Sleeper data.
- Gridiron Gold sound not confirmed on a real iPhone (volume slider and the silent switch).
- Playoff-odds tiebreak is points scored. Confirm that is the league's real tiebreaker.
- First login to a team sets its PIN. Commish can reset it (Me → Book controls).
- Player names in snapshot.json only cover a handful of players. Full names come from `/api/game` once the server is up.
- Git tags cannot be pushed from some agents. Saved versions live on branches (`release-v1.0` through `release-v1.8`).

## Files changed in the latest push
- prototype/v2.0/app.js — thisWeek list, recapOne, Explore row of three
- prototype/v2.0/app.css — tw- list, row, tags, recap (does not touch .tw tables)
- HANDOFF.md, CHANGELOG.md, BIBLE.md, docs/V2-HANDOFF.md

## Files changed in the push before
- server/sleeper/client.js (injury_status kept as `i`), server/book/data.js (players `inj`; homeCard warn/empty)
- prototype/v2.0/app.js (medianLine, warnLine, standStrip, EXPLAIN.median, slot root `.ggslot`), app.css (card lines, strip, `.ggslot`, box header wrap)
- HANDOFF.md, CHANGELOG.md, BIBLE.md
