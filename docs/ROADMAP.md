# Mahomie's Hub — The Roadmap

**Written:** 2026-10-21 (Week 7) by Claude with Jayson. **Live version (with comments and Jayson's verdicts):** https://claude.ai/artifact/L3aH1k5D7mJxkAV4MoJS9N — this file is the copy any AI can read. If they disagree, the live doc wins; update this file to match.

**Where we are:** Phase 0 (Foundation). See HANDOFF.md for the current step.

## The goal and the eight rules

Mahomie's Hub is the one place a Rollin' with Mahomies manager goes to understand their week and their league: last week, right now, what's coming, and where it sits in league history. Sleeper runs the league; we explain it.

1. **Every number answers a question.** If we can't say what a manager learns or decides from it, it comes off the screen.
2. **Everything opens something.** Every name, score, bar, badge and record opens the thing behind it, and the deeper page has the chart.
3. **Four time frames, always clear:** last week, this week, what's ahead, all-time.
4. **Our league, not the NFL.** Win on context Sleeper and Yahoo don't keep.
5. **Live and honest.** As-of stamp on anything not live; every number traceable to Sleeper, ESPN or our database.
6. **Fantasy first, the Book second.** Odds, lines and win % only in the Book (playoff-odds simulations are season numbers, not Book numbers — Jayson to confirm, decision 4).
7. **Phone first.** 375 px, one hand, light and dark.
8. **Testable at any time of year.** Every screen runs on a fake league or a replayed real week.

**Done looks like:** by Week 1 of 2027 every page has been reviewed with Jayson line by line, every tap leads somewhere useful, and the app has run a full replayed season with no wrong numbers.

## The week, day by day (Home's "week mode")

| When (Pacific) | The manager's question | Home leads with |
|---|---|---|
| Tuesday | How did I do, what did it mean? | Your result, week awards, records broken, standings and odds movement. Book lines post 6 AM |
| Wednesday | Who do I pick up? | Waiver results and FAAB, Sleeper-wide trending adds still free here, bye-week holes, first look at the matchup |
| Thursday–Saturday | Can I win this week? | Preview slot by slot, lineup check, game environments, Thursday night live |
| Sunday | Am I winning right now? | Live matchup, who's on the field, what I need, the league live, top performers, record watch |
| Monday | Can I still pull it off? | Exact number needed from who's left, close games, standings consequences |
| Monday night → Tuesday | (final, pending corrections) | Says scores can still change with stat corrections, then rolls into the recap |

Plus **Playoffs mode** (Week 15+: your bracket path) and **Offseason mode** (draft, keepers, awards, the Hall). Every mode must be testable with a fake date.

## The tap map — one home page per kind of thing

| Thing | Home page | Status (Oct 21) |
|---|---|---|
| Manager | Manager page | Partial |
| Team (one manager, one season) | Team page (any season, not just this one) | Partial |
| Game | One game page: preview → Game Center → final | Partial (three pages today) |
| Week | Week page | Partial |
| Season | Season page | Partial |
| Player | Player card | Built (home league only) |
| Record | Record board | Built |
| Award | The moment behind it | Partial |
| Move (trade/claim/add/drop) | Move page | Partial (trades only) |
| Draft pick | Pick on the draft board | Partial |
| Rivalry | Rivalry card | Built |
| NFL game | NFL game page (our players in it) | Missing |

One look for everything tappable; nothing that isn't tappable looks tappable. **Every page gets its own address** (shareable, survives refresh, openable by test bots).

## Page proposals (Claude's verdicts; Jayson's are in the live doc)

**Home** — "what do I need to know about my week right now?"
- Cut: the "New look" note; the projected-finish bar before kickoff (repeats the projections) → becomes a game-flow line once games start.
- Change: "what you need" line always concrete ("needs 8.7 from 2 players projected 12.4"); Stakes tab adds playoff-odds impact of a win/loss; Top performers only once games start, mark your own players; Last week moves to the top on Tuesday; Wire leads only on waiver day and on trades.
- Keep: matchup scores/projections, lineup check (+ button to open Sleeper), lineup chart (old one with real zeros), Form, Series, This week, This week in history.
- New: If the week ended now (live mini standings), Record watch, game-flow line, Next week peek (Mon/Tue), week mode.

**League** — "where does everyone stand, and where is it headed?"
- Change: all-play/luck move into a tap-to-expand row (plus points against, median record); Power gets ingredient breakdown + rank-by-week line; Playoffs gets odds over the season (past weeks re-simulated) + remaining schedule strength.
- New: clinched/eliminated/"win and you're in" (Week 10+), all 12 scores of a week on one line with the median, standings race chart, schedule ahead, FAAB left and waiver order (Sleeper roster settings), points race chart.

**Hall** — "who has done what in this league, ever?"
- Change: numbers strip → "Broken this season"; Record book grouped into chapters (Weeks, Games, Seasons, Streaks, Careers, Players, Front office) + search + "who's closest" (record book push 2); awards show the live award race during the season; merge Draft room + Lab into **Front office** (Draft room, Trade grader, Bench Shame, Waiver report card).
- New: records by position and raw stats (push 3, Sleeper weekly stats 2023→), league rating (all-time skill score per manager, line chart), rivalry grid (every pair), keeper planner (offseason; needs keeper rules), Hall of Fame votes (later, needs accounts).

**Book** — "can I prove I know this league best?"
- Change: My bets gets a bankroll line and record by bet type; Leaders gets a bankroll race chart.
- New: "How sharp is the Book?" page (backtest already computed in every hub build, never shown), free weekly pick'em, survivor (later). Book stays Rollin' with Mahomies only.

**Me** — "how am I doing, all of it?"
- Change: This season = your team page in place; Career = your manager page in place (+ finish-by-season chart).
- New: records you hold / are close to, roster health (injuries, upcoming byes, falling snaps), alert settings (needs push), a separate Commish page.

**Deep pages** — game page first (unify the three states; final adds game flow, the deciding slot, each side's bench mistake, records set, series after). Team page: scores vs median and opponent, points by position vs league, odds over time, schedule ahead, past seasons. Manager page: finish by season, rating over time, tendencies, nemesis/favourite victim. Player card: points per owner, big bench weeks, schedule ahead. Week page: awards, standings movement, records, bench mistakes. Season page: weekly heat map, standings race, awards, draft recap, trades of the year. New NFL game page.

## Your leagues and basketball (next, in order)
1. Live scoring + Game Center for any football league (only the league id is hard-wired).
2. Player cards for any league.
3. Basketball done properly: games left this week per player, NBA schedule + live scores (ESPN), per-game averages. Category leagues not supported yet.
4. Dynasty extras (future picks, rookie drafts, roster value) for BestCoast Dynasty.

## Data not used yet
Own score snapshots during games (game flow, comebacks) · past weeks re-simulated (odds/power over time) · ESPN NFL spreads/totals (game environment) · NFL rest-of-season schedule and byes · rest-of-season projections for every rostered player · Sleeper trending adds/drops · traded future picks and keeper settings · weekly stat lines for raw-stat records · Yahoo 2021–2022.

## What nobody else shows (lean in)
Grading decisions by starting-lineup points · one history across Yahoo + Sleeper tied to people · "as good as your record?" (all-play, luck, median, schedule) · a rating built only from our league's games · game flow and comeback records from our own snapshots · record watch while it happens · fantasy points play by play · the Book · a Home that knows what day it is. Common elsewhere (don't compete): live scores, AI recaps (LeagueBeat, League Rewind), basic record books (Yahoo added one Aug 2026), Sleeper's per-season history (top 3 + standings, not tied to users).

## Testing

**Start now:** record every game day (Sleeper + ESPN responses, once a minute, compressed). Every Sunday not recorded can't be replayed in the offseason.

| Layer | What it catches | When | Status |
|---|---|---|---|
| Fake leagues (generator) | Code that only works for our league; edge cases: 8–14 teams, median on/off, keeper/dynasty, NBA, ties, quitting manager, co-owners, long/emoji names, 0-point players, negative DEF, byes, consolation | Every push | Partial (mock_sleeper.py, 3 leagues, in scratch space) |
| Game-day recorder | Makes replays possible | Every game day | Missing |
| Time machine | Moment-specific bugs (Oct 19 rollover) — server answers as of any moment of a recorded season | On demand | Missing |
| Game-day simulator | Live bugs without waiting for Sunday: a fake Sunday in 10 minutes (kickoffs, possession, red zone, delay, OT, injury, Tuesday stat correction) | Pushes touching live code | Missing |
| Number checks | Wrong numbers: W+L+T = games; season points = sum of weeks; H2H mirrors; playoff odds sum to spots; bankroll = grants + net; no blank/NaN/"[object Object]" | Every hub build, real data | Partial (29 tests, no invariants) |
| Check against Sleeper | Drift from the source, every league | Nightly | Missing |
| Screen bots | Dead taps, errors, cut-off text, overflow — every page × day mode × league × theme × 360/390/430 px | Every push + nightly | Partial (shoot.py harness, in scratch space) |
| AI reviewer | Filler and confusion: reads the week's screenshots against the data, writes a report | Tuesdays | Missing |
| Report a problem (in app) | Saves the screen + data behind it for the next AI session | Any time | Missing |
| Practice copy of the app | A second Railway app from a practice branch; changes land there first | Every change | Missing |

**Step one of Phase 0:** move the fake Sleeper (`mock_sleeper.py`), the API mock (`mock.py`) and the screenshot scripts (`shoot.py`, `lgshoot.py`) from the AI scratch space into the repo (e.g. `test/harness/`), so they survive between sessions.

Jayson's weekly 5-minute check (in season): Sunday — Game Center live, players lit up; Monday night — this week's game still on Home after the last game; Tuesday — recap right, standings match Sleeper; Wednesday — waiver claims on the Wire; anytime — Report a problem.

## Phases and gates

| Phase | When | What | Gate to leave it |
|---|---|---|---|
| 0 · Foundation | Oct 21 – Nov 3 (Weeks 7–8) | Test tools into the repo, practice copy, number checks on every build; game-day recorder; page addresses; Report a problem | One full Sunday recorded, number checks green |
| 1 · Page reviews in season | Nov 4 – Dec 14 (Weeks 9–14) | One review a week, built by Thursday: Wk 9 game page · Wk 10 Home + week mode · Wk 11 (trade deadline) League · Wk 12 team + manager pages · Wk 13 Me · Wk 14 Hall quick wins | Every in-season page reviewed |
| 2 · Playoffs | Dec 15 – Jan 4 (Weeks 15–17) | Playoff mode, award races, season awards page. Fixes only | Season over, every game day recorded |
| 3 · Offseason build | Jan – May 2027 | Time machine, simulator, fake-league generator, screen bots, AI reviewer; record book pushes 2–3, league rating, rivalry grid, Front office; Yahoo retry; basketball; AI recaps | 2026 season replays start to finish with no wrong numbers |
| 4 · Preseason | Jun – Aug 2027 | Keeper planner, 2027 draft room, alerts + push, live scoring for other leagues, full dress rehearsal | Rehearsal passes, Jayson signs off |
| 5 · 2027 season | From Week 1 | Everything live; weekly checks continue; decide on opening to other leagues | — |

## Decisions for Jayson (open as of Oct 21; answers go in the live doc)
1. "3 playing · 3 left" on Home's other games? (rec: only while games are on)
2. "If the week ended now" on Home? (rec: yes, during games)
3. Wire on Home only on waiver day + trades? (rec: yes)
4. Playoff odds outside League (Home Stakes, team pages)? (rec: yes)
5. H2H and median records separately in Standings? (rec: yes, expanded row)
6. Weekly review day/time? (rec: Tuesday evening, ~20 min)
7. Keeper rules (count, cost, deadline) — needed for the keeper planner
8. Yahoo: retry API in January, screenshots by March? (rec: yes)
9. Accounts for every leaguemate? (rec: yes)
10. Everyone installs to home screen for push? (rec: yes, before 2027)
11. Opening to other leagues: 2027 or later? (rec: later)
12. AI recaps (small monthly cost; light roast)? (rec: yes)
13. Practice copy on Railway (small monthly cost)? (rec: yes)

## How we work
Page review: (1) Claude posts a review sheet — screenshots in every state, every block numbered, its question, its data source; (2) Jayson goes line by line, ~20 min; (3) verdicts go into the live doc and a page spec in the repo (`docs/pages/<page>.md`: blocks, questions, taps) — the spec is what gets built and what screen bots test; (4) build on the practice copy, Jayson checks, live by Thursday; (5) Sunday is the real test.
Every push: HANDOFF + CHANGELOG + the page spec it touched. Start every session with "read the handoff."
