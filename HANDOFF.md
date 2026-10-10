# HANDOFF — where we left off

**Last updated:** 2026-10-09 22:00 (Pacific) · **AI:** Grok
**Current phase:** v2.0 Home rework — items 1 and 2 of Part 4 are in this push; items 3–8 are next
**Last commit:** "v2.0 Home: Live badge follows NFL games, week title is a phase line"
**App status:** Working · **Live URL:** https://mahomies-hub-production.up.railway.app (Railway deploys main in ~2 minutes). Old builds: /test/v1.8 /test/v1.7 /test/v1.6 /test/v1.5 /test/v1.0

## What we're working toward right now
**v2.0 Home page rework** (docs/V2-HANDOFF.md Part 4), then the Live Game Center (2.1). Front end is `prototype/v2.0/` (app.html, app.css, app.js, snapshot.json) — edit directly, no build step. Do not edit prototype/v1.x or prototype/dist.

This push only changes the top of Home. "Live" used to mean the phone reached the server. It now means an NFL game this week is actually in progress (ESPN). If nothing is on, the line says "Next kickoff Thu 5:15 PM" (Pacific). The giant "Week 5" title is a short phase line instead.

## Done (newest first)
- 2026-10-09 — **Home part 1** (Grok): `GET /api/pulse` (ESPN scoreboard, ~45s cache, Home polls once a minute). Badge: Live / Next kickoff / Kickoff delayed. Phase line: Waivers run Wed, Thursday night, Game day, Sunday: N games, Monday night: N games left, Week in the books. No betting numbers added. Page title no longer says v1.8.
- 2026-10-09 — **v2.0 start** (Claude): v1.8 frozen. Live page split into prototype/v2.0. docs/V2-HANDOFF.md. BIBLE §17.
- 2026-10-09 — Sportsbook batch 1, live odds, player props, tickets, commish Bucks, Gridiron Gold slot (secret: Book tab, 2nd footer dot, the pink one). Payback 92.51%. See CHANGELOG.md for the rest of Oct 9.

## In progress (not finished)
- Nothing half-done. Home items 3–8 are not started.

## Next steps (in order)
1. **Home part 2 — your game card.** Projected final (Sleeper live projections; the Book already computes them in `server/book/data.js` `weekState`), players left / playing now, real pregame projections instead of 0.00–0.00. "Pick your team" if nobody is chosen.
2. **Home part 3.** Median tracker ("4th of 12 — on track for the median win"), lineup alert (OUT / bye / empty slot), standings strip (seed, games back of the playoff line, playoff odds). Still no betting numbers outside the Book.
3. **Home part 4.** This week: one game per row, drop your own game, closest first, tags (Final, Upset brewing, all-time series). One-sentence recap on Home. Explore shrinks to one row. Keep This week in history.
4. **2.1 Live Game Center** — player-by-player, clock, "needs X from Y" on Monday night.
5. **2.2 Sportsbook batch 2** before or right after lines post **Tue Oct 13, 6 AM PT (Week 6)**. First real settlement **Wed Oct 21, 3 AM PT**. Check both.
6. Jayson: on a phone, confirm the Home badge (this weekend it should say Sunday… or Live on Sunday, not a green Live on Friday night) and that Gridiron Gold sound plays (volume slider; iPhone silent switch).

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
- `server/book/kickoffs.js` — `kickShort`, `describeWeek` (phase + next kickoff from ESPN states)
- `server/routes/hub.js` — `GET /api/pulse`
- `prototype/v2.0/app.js` — Home hero uses the pulse; connection to the server no longer lights Live
- `prototype/v2.0/app.css` — phase title a bit smaller so a sentence fits on a phone
- `prototype/v2.0/app.html` — title is "Mahomie's Hub" (was v1.8)
- `BIBLE.md` — §10 lists `/api/pulse`; §17 describes the Home hero; version line says v2.0
- `docs/V2-HANDOFF.md` — Part 4 items 1–2 marked done
- `CHANGELOG.md`, `HANDOFF.md`
