# HANDOFF — where we left off

**Last updated:** 2026-10-09 23:30 (Pacific) · **AI:** Claude
**Current phase:** v2.0 Home rework — parts 1–3 live; part 4 (This week list, recap, Explore) next
**Last commit:** "Home: playoff odds removed from Your game"
**App status:** Working · **Live URL:** https://mahomies-hub-production.up.railway.app

## What we're working toward right now
**v2.0 Home page rework** (docs/V2-HANDOFF.md Part 4), then the Live Game Center (2.1). Front end is `prototype/v2.0/` (app.html, app.css, app.js, snapshot.json) — edit directly, no build step. Do not edit prototype/v1.x or prototype/dist.

This push changes **your game card** only. Before a team has played, the big number is their projected score (labeled proj), not 0.00. Once they have points, that score stays big and the projected final sits under it in gold. A cyan line says how many starters are playing now and how many are still left. If this phone has never chosen a team, a pink "Pick your team" link sits on the card. No betting numbers.

Jayson wants to see it on his phone and may ask to put the old card back. Revert commit message: "v2.0 Home: your game card shows projected score instead of 0.00".

## Done (newest first)
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
- Nothing half-done.

## Next steps (in order)
1. **Home part 4.** This week: one game per row, drop your own game, closest first, show projections like the card (not 0.00), small tags ("6–0 all-time", "Final", "Upset brewing" = lower record leading). One-sentence recap on Home. Explore shrinks to one row; keep This week in history.
2. **2.1 Live Game Center** (player by player: pts, live proj, game status, "needs X" Monday night).
3. **2.2 Sportsbook batch 2** before **Tue Oct 13, 6 AM PT** lines (weekly specials, best bettor, Sportsbook Champion). First real settlement **Wed Oct 21, 3 AM PT**.
4. Jayson: confirm Gridiron Gold sound on a real iPhone.

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
- server/sleeper/client.js (injury_status kept as `i`), server/book/data.js (players `inj`; homeCard warn/empty)
- prototype/v2.0/app.js (medianLine, warnLine, standStrip, EXPLAIN.median, slot root `.ggslot`), app.css (card lines, strip, `.ggslot`, box header wrap)
- HANDOFF.md, CHANGELOG.md, BIBLE.md

## Files changed in the push before
- `server/book/data.js` — `homeCard()` (points, projection, playing, left). No odds.
- `server/routes/hub.js` — `/api/pulse` includes `games`
- `prototype/v2.0/app.js` — your game card
- `prototype/v2.0/app.css` — proj label, playing line, pick link
- `BIBLE.md`, `docs/V2-HANDOFF.md`, `CHANGELOG.md`, `HANDOFF.md`
