# Mahomie's Hub — Handoff to v2.0

**For:** the next AI assistant taking over this project (ChatGPT, Codex, Grok, Gemini, or Claude in a new session).
**From:** Claude, 2026-10-09 (end of the v1.8 build sessions).
**Owner:** Jayson (Sleeper username *Poochinski*, team *The Water Boyz*, the league's app commissioner). Jayson is **not a developer** and mostly works from his phone.

> **Paste everything in "Part 1 — The prompt" into the new AI.** Parts 2–6 are the reference it should read from the repo.

---

## Part 1 — The prompt (copy and paste this)

```
You are taking over development of "Mahomie's Hub", a live web app (PWA) for my
Sleeper fantasy football league "Rollin' with Mahomies". I'm Jayson, the
commissioner. I am not a developer: explain things in plain words, and do the
work yourself whenever you can.

THE PROJECT
- GitHub repo: https://github.com/poochinski/mahomies-hub  (branch: main)
- Live app: https://mahomies-hub-production.up.railway.app
- Railway auto-deploys every push to main (about 2 minutes). Postgres is on Railway.
- Current version: v1.8 (live). We are starting VERSION 2.0 now.

READ THESE FIRST, IN FULL, BEFORE DOING ANYTHING:
1. https://raw.githubusercontent.com/poochinski/mahomies-hub/main/BIBLE.md
2. https://raw.githubusercontent.com/poochinski/mahomies-hub/main/HANDOFF.md
3. https://raw.githubusercontent.com/poochinski/mahomies-hub/main/docs/V2-HANDOFF.md
4. https://raw.githubusercontent.com/poochinski/mahomies-hub/main/CHANGELOG.md
If you can't open them, tell me and I'll paste them.

HOW TO WORK
- Follow BIBLE section 12 (working rules) and section 17 (v2.0 rules).
- If you can push to GitHub yourself (GitHub connector / Codex / Copilot agent):
  commit straight to main in small, working chunks. Railway deploys each push.
  Use commit author: Jayson <editfilminc@gmail.com>.
- If you can't push: give me COMPLETE files (or exact find/replace blocks with
  the file path) plus the terminal commands for GitHub Codespaces:
      git add -A
      git commit -m "Short description"
      git push origin main
  and remind me Railway auto-deploys from that push.
- Every push must also update HANDOFF.md (rewrite it), add one line to the top of
  CHANGELOG.md, and update BIBLE.md when a rule, feature or decision changes.
- Never leave the app broken between pushes. My usage with you can run out anytime.
- After a push, check the live app: /api/health must say ok, and the change
  must show on the phone-size page (390px wide).
- The v2.0 front end is prototype/v2.0/app.html + app.css + app.js (edit them
  directly, no build step). Never edit prototype/v1.x folders or prototype/dist.

FIRST: tell me the current goal, what's done, what's next, and open bugs from
the handoff, then propose the v2.0 plan (start with the Home page rework in
docs/V2-HANDOFF.md Part 4) and ask me to say go.
```

---

## Part 2 — What the app is

**Mahomie's Hub** is the league's own app: a **fantasy companion, history book, stats hub and hall of fame first**, with a **fun side game: a play-money sportsbook** using *Mahomie Bucks* 💵. It reads everything from Sleeper and keeps the league's whole history (2023–2026) in one place, including managers who left (tagged "Former").

**League facts:** Sleeper league_id `1312104253497540608` (2026), 12 teams, PPR, **2026 adds a league-median game** (every week you also win if you score in the top half). Playoffs: top 6, top 2 get byes. Commissioner (app admin) user_id `862901935416655872`.

**Identity rules (Jayson's decisions):**
- Betting numbers (win %, lines, odds, spreads) appear **only inside the Book tab**. Everywhere else is fantasy + history.
- **No "Banana Bets" branding anywhere** (that's a different app of Jayson's). Names: *Mahomie's Sportsbook*, *Mahomie Bucks* 💵, *On Fire* 🔥 (weekly high), *Ice Cold* 🧊 (weekly low), *Sportsbook Champion*.
- Logo: gold "MH" + football (public/brand-96.png, app icons). Look: "Night" theme (dark purple ground, gold/pink/cyan/green accents, Chakra Petch + IBM Plex fonts). Mobile-first, 390px wide.
- Header scrolls with the page (not pinned). Plain-English "ⓘ How it works" explanations on every stat.

**Tech:** Node 18+ / Express server (`server/`), Postgres on Railway, vanilla-JS single-page front end, PWA manifest + MH icons. No front-end framework. No service worker (an old one self-removes).

---

## Part 3 — What's built (v1.0 → v1.8)

### Version history
| Version | Date | What it added |
|---|---|---|
| Phase 0 | Oct 7 | PWA shell, Express, `/api/health`, `/api/state` (Sleeper history chain), Railway |
| v1.0 | Oct 8 | Prototype with real league data, game sheets, `/api/game` box scores |
| v1.5 | Oct 9 | Week picker + recaps, season pages + brackets, playoff odds, awards, H2H grid, capped Book lines, previews, share cards, records filter, Lab endpoints |
| v1.6 | Oct 9 | Swipe cards, Explore tiles, League tile menu, Awards page |
| v1.7 | Oct 9 | One-screen Home, compact Awards, record picker |
| **v1.8** | Oct 9 | **The real Sportsbook in the app** + everything below |

Old builds stay reachable: `/test/v1.8`, `/test/v1.7`, `/test/v1.6`, `/test/v1.5`, `/test/v1.0`. Saved branches: `release-v1.0`, `release-v1.5`, `release-v1.6`, `release-v1.7`, `release-v1.8` (git tags can't be pushed).

### Tabs and features (live now)
**Home** — Week banner; *Your game* card (both teams, live score, record + place; tap → matchup preview: form bars, keys to the game, all-time series, last meeting); *This week* grid of all 6 live scores; *Last week* tiles (🔥 high score, 🧊 low score, ⭐ top player) + recap link; *Explore* 3×3 shortcuts; footer with data time.

**League** — Standings (W-L incl. median, PF, all-play, luck, playoff line) · Power rankings (0–100 percentile blend) · Playoff odds (5,000 simulated seasons) · Awards (Champion, Sacko, Points King, On Fire, Ice Cold, Horseshoe, Snakebitten, Punching Bag, Monster Week, Bully, Heartbreaker; live leaders in season) · History (season podiums, brackets, every week) · All-time table · Rivals (H2H grid + rivalry cards) · Lab: **Bench Shame**, **Trade grader v2** (who got what, points started per week, verdict scale, weekly tracker sheet, chart, team impact), **Draft re-grade** (steals/busts).

**Records** — Record book (regular season / playoffs filter): high/low scores, blowouts, closest games, best player games, streaks, with full details and unit labels.

**Me** — Pick your team or log in; manager profile (career, seasons, head-to-head); "How the app works" list; **commish Book controls**.

**Book (Mahomie's Sportsbook)** — details in BIBLE §7:
- Team + 4-digit PIN login (first login sets the PIN; 5 wrong → 15-min lock; 180-day sessions).
- **1,000 Bucks once per season, no re-buys** (broke = done for the season).
- Lines post **Tuesday 6 AM PT**: projection = 60% Sleeper lineup projection + 40% league history; spread cap 20; spreads/totals −110; moneyline 4.5% hold.
- **Nothing locks — live in-game odds**: once a matchup's first starter kicks off, expected final = Sleeper live projected totals (points so far + projection for players left, from ESPN game clocks); price moves with the score; a moneyline side comes off the board past −1000; "Odds moved" protection.
- **Player props** (over/under on a starter's fantasy points, line = Sleeper projection x.5, −110; no under on your own player).
- Bet slip: Singles or Parlay (2–4 legs, one pick per fantasy matchup), **confirm screen**, casino-style **tickets** with the MH logo showing the bettor, shareable as an image.
- My bets, Leaders (bankroll leaderboard), league bet feed. Cancel only before kickoff.
- **Settlement Wednesday 3 AM PT** after stat corrections.
- Commish: Book health check, post lines, move/void a line, settle a week, **add/take away Bucks for any team incl. yourself** (balances, quick amounts, reason, ledger; can't go below 0), reset a PIN, Book log.

**Secret Easter egg — "Gridiron Gold" slot machine.** On the Book tab, tap the **pink dot** (2nd of the 4 footer dots). **Never list it in menus, help or "How it works".** Casino cabinet (drawn symbols, marquee lights, LED meters, paylines, slam stop, anticipation, rollups, BIG/MEGA/EPIC wins), WebAudio sounds with volume slider, MH wild, free spins (×3), **Two-Minute Drill** hold-and-spin bonus with MINI/MINOR/MAJOR/GRAND jackpots. Server-decided outcomes, **92.51% payback = Las Vegas Strip average** (exact par sheet: `node server/slots/par.js`). Uses real Mahomie Bucks.

### Server / API (all under `/api`)
`/health` · `/state` · `/hub` (whole app data, rebuilt from Sleeper; app refreshes every 3 min) · `/game` (box scores) · Lab: bench / trades / draft · `/book/*` (status, teams, login, logout, me, lines, bets, cancel, leaderboard, feed, slots/*, admin/*).
Background job every 10 min: post lines Tue 6 AM, keep live state, settle Wed 3 AM.
Database tables: app_users, sessions, book_weeks, lines, bets, bet_legs, bankroll_ledger (balance = sum of ledger), book_settings, book_log, slot_state, slot_spins.

### Railway environment variables
`DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (required). Optional (defaults in code): `SLEEPER_LEAGUE_ID`, `COMMISH_USER_ID`, `PORT`. Test-only: `BOOK_FAKE_NOW`, `BOOK_JOBS`, `SLEEPER_BASE`, `ESPN_BASE`, `SLEEPER_PROJ_BASE`.

---

## Part 4 — Version 2.0: where to take it next

### 2.0 — Home page rework (do this first)
From the Home audit (2026-10-09):
1. **Fix the "Live" badge** — DONE 2026-10-09. `GET /api/pulse` reads ESPN. Live only while a game's state is `in`. Otherwise "Next kickoff Thu 5:15 PM" (Pacific), or "Kickoff delayed" if that time has passed and the game hasn't started. The server being up no longer lights the badge.
2. **Replace the giant "Week 6" title** — DONE 2026-10-09. Phase line from the same pulse: *Waivers run Wed* (Tue, and Wed before 11 AM PT, before any game), *Thursday night* / *Game day* / *Sunday: N games* / *Monday night: N games left* / *Week in the books*.
3. **Your game card:** DONE 2026-10-09 (look is up for Jayson to accept or undo). Projected score instead of 0.00 before that team plays. Once they have points, the score stays big and "proj" sits under it. "N playing · N left" while the lineup is in progress. "Pick your team" if this phone hasn't chosen one. Numbers come from `weekState` (Sleeper projections), not from betting lines.
4. **Median tracker:** "You're 4th of 12 this week — on track for the median win." (half of every 2026 week is invisible today).
5. **Lineup alert:** starter OUT / on bye / empty slot (weekState already detects "slots not playing").
6. **Standings strip:** your seed, games back of the playoff line, playoff odds.
7. **This week grid:** no cut-off names (one game per row), remove your own game, sort by closest, tags like "6–0 all-time", "Final", "Upset brewing".
8. **Put the one-sentence recap on Home.** Shrink *Explore* to one row (tabs already cover it); keep *This week in history*.

### 2.1 — Live Game Center
Player-by-player view of any matchup during games: points, live projection, game clock/status, who's left, "needs X from Y" on Monday night. This keeps people in the app on Sundays instead of Sleeper.

### 2.2 — Sportsbook batch 2
Weekly specials (On Fire / Ice Cold winner, low-score over/under), weekly best bettor, **Sportsbook Champion** in Awards + Hall of Fame. Bet lines first go up **Tue Oct 13, 6 AM (Week 6)**; first real settlement Wed Oct 21, 3 AM — check both.

### 2.3 — Futures + playoffs
Title and Sacko futures from the season sim (repriced Tuesdays). Playoff-week lines (weeks 15–17, bracket games only).

### 2.4 — League Wire
A running feed: trades (with early grade), big waiver adds, records broken, streaks, On Fire/Ice Cold changes, median-game drama. Waiver Wizard tracker (points from mid-season pickups).

### 2.5 — Engagement
Web push notifications for installed PWAs (lines posted, bet settled, record broken; iOS 16.4+), shareable record cards, Hall of Fame inductions with league voting, trophy case per manager.

### 2.6 — Commish + extras
Start/Sit helper (commish-only first), "How sharp is the Book?" accuracy page, survivor side game, dues/payouts ledger (tracking only), awards voting.

### Still missing / to verify
- Lab endpoints only tested on fake data — verify with real Sleeper data on Railway.
- Gridiron Gold sounds not yet heard on a real phone; check volume and the iPhone silent switch.
- Playoff-odds tiebreaker assumes points for; confirm the league's real setting.
- First login to a team claims its PIN; commish can reset.
- Sportsbook early-season lines can be wide; review after Week 8.

---

## Part 5 — Where the code lives (v2.0)

```
server/index.js            Express app; serves the v2.0 page (app.html + snapshot data)
server/hub/build.js        builds /api/hub (every stat) from Sleeper
server/book/               engine.js (odds math), book.js (rules, jobs, bets), data.js (Sleeper/weekState), kickoffs.js (ESPN), schema.sql
server/slots/              engine.js (reels, pays, PAR), slots.js (spins + ledger), par.js (exact payback), sim.js
server/routes/             state, game, lab, hub, book
prototype/v2.0/app.html    page shell (head, header, tab bar, sheet) — EDIT THIS
prototype/v2.0/app.css     all styles — EDIT THIS
prototype/v2.0/app.js      all front-end code — EDIT THIS
prototype/v2.0/snapshot.json  bundled data used until /api/hub loads (refresh it occasionally from /api/hub)
prototype/v1.x/, prototype/dist/   frozen old builds — DO NOT EDIT
public/                    icons, logo, fonts (Bungee, Orbitron for the slot)
BIBLE.md  HANDOFF.md  CHANGELOG.md  docs/V2-HANDOFF.md
```

Front-end notes: `app.js` is one big function (no modules). Data object `D` (from `/api/hub`), state `S`, `render()` draws the current tab, one delegated click handler reads `data-*` attributes, bottom sheets via `openSheet(html)`. Sportsbook calls go through `api(path, {body})` to `/api/book`. Tabs: `home()`, `league()`, `records()`, `book()`, `me()`.

**Testing:** run locally with `npm install` then `DATABASE_URL=... node server/index.js` (port 3000), or test on Railway after the push. Always look at the page at 390px wide.

---

## Part 6 — Rules that must not break

1. Fantasy/history first; betting numbers only in the Book tab.
2. No Banana Bets names or assets.
3. Mahomie Bucks are play money only. Never add real-money payments.
4. 1,000 Bucks per season, no re-buys; commish adjustments always logged with a reason.
5. Nothing locks in the Book; live odds move with the score. Every bet has a confirm step.
6. The slot stays secret and keeps a Nevada-style design: independent server RNG, fixed strips, re-run `par.js` after any math change and keep payback ≈92.5%.
7. Never call Sleeper from the browser; the front end only talks to `/api`.
8. Never put secrets in code; they go in Railway variables.
9. Every push: working app + updated HANDOFF.md + CHANGELOG line (+ BIBLE when rules change).
10. Mobile first (390px), plain-English explanations, and Jayson approves anything that changes how the league experiences the app.
