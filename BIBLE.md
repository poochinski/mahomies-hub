# MAHOMIE'S HUB — Project Bible

**LEAGUE HQ · HISTORY + STATS + SPORTSBOOK** · *Peel back the league.*

> This file is the single source of truth for the Mahomie's Hub app. It lives at the root of the GitHub repo.
> Any AI assistant (Claude, ChatGPT, Grok, or another) must read this file **and** `HANDOFF.md` before writing code. Section 15 has the prompt to start any session.
> If something you are asked to do conflicts with this file, stop and say so before changing anything.

- **Owner / commissioner:** Jayson
- **App name:** Mahomie's Hub (repo `poochinski/mahomies-hub`). The Banana Bets look, Banana Bucks and the Banana Book carry over from the Banana Bets family.
- **Sister projects:** Banana Bets (`poochinski/banana-bets`) and Jaypardy. This is a **separate repo and separate Railway service**. Never mix code between them.
- **Prototype version:** v1.5 (v1.0 saved at git tag `v1.0`)
- **Bible version:** 1.1 · 2026-10-07 (relay workflow: unlimited work per session, handoff on every push)

---

## 1. What we are building

A private, phone-installable web app (PWA) for one Sleeper fantasy football league. It pulls every season of league data from the free Sleeper API and turns it into:

1. **League history and Hall of Fame** — every season, champion, and manager record since the league started on Sleeper.
2. **Record book** — highs, lows, blowouts, and single-player performances, updated automatically every week.
3. **Season hub** — standings, power rankings, luck index, weekly recaps, rivalries.
4. **The Banana Book** — a league-only sportsbook with moneyline, spread, and over/under on every weekly matchup, using play money (Banana Bucks).
5. **Awards** — automatic end-of-year awards plus commissioner-entered ones.
6. **Commissioner tools** — start/sit help, line control, bet settlement, manual awards. Visible only to the commissioner.

**Who uses it:** every manager in the league, on their phone, from the home-screen icon. Login is a simple pick-your-team + PIN. No public access.

**What it is not:** it is not a real-money betting app. All wagers are Banana Bucks. Any real money between leaguemates is settled outside the app.

## 1b. League facts (from Sleeper, checked 2026-10-07)

| | |
|---|---|
| League | **Rollin' with Mahomies** |
| Current league_id (2026) | `1312104253497540608` |
| History chain | 2026 `1312104253497540608` → 2025 `1258891263936040960` → 2024 `1124805924880834560` → 2023 `988171750385008640` (first season) |
| Teams | 12 |
| Scoring | Full PPR (`rec: 1.0`) |
| Lineup | QB, RB, RB, WR, WR, TE, FLEX, K, DEF + 6 bench |
| Playoffs | 6 teams, start Week 15 |
| Trade deadline | Week 11 |
| App admin ("commish" role in this app) | Jayson = Sleeper user **Poochinski** (`862901935416655872`), team "The Water Boyz" |
| Sleeper league owner | MattGomez (`868569620376891392`) |

Team names change; always read them from Sleeper (`metadata.team_name`, falling back to `display_name` when it's missing — one manager has no team name).

---

## 2. Tech stack (locked)

Same family as Banana Bets and Jaypardy, so every AI and every session works the same way.

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite | Single-page app, React Router for pages |
| App shell | PWA | `manifest.webmanifest`, service worker via `vite-plugin-pwa`, installable on iOS and Android |
| Styling | Plain CSS with design tokens | Copy tokens from Banana Bets `src/styles.css` (section 4) |
| Backend | Node + Express | Same repo, `/server` folder, serves the API and the built frontend |
| Database | PostgreSQL on Railway | Caches all Sleeper data + stores app data (bets, users, awards) |
| Jobs | `node-cron` inside the server | Pulls Sleeper data on a schedule |
| Hosting | Railway | Auto-deploys on every push to `main` |
| Dev environment | GitHub Codespaces | All editing and git commands happen there |
| Repo | `poochinski/mahomies-hub` | New repo, public or private |

**Why a backend and not frontend-only?** The sportsbook needs shared state (everyone sees the same lines and the same bets), logins, and bankrolls. Caching Sleeper data in Postgres also makes every page load fast and keeps us well under Sleeper's rate limits.

---

## 3. Folder structure

```
mahomies-hub/
├─ BIBLE.md              ← this file (source of truth)
├─ HANDOFF.md            ← where we left off (updated at the end of every session)
├─ CHANGELOG.md          ← one line per change, newest on top
├─ package.json
├─ vite.config.js
├─ index.html
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icon-192.png
│  ├─ icon-512.png
│  └─ apple-touch-icon.png
├─ src/                  ← React frontend
│  ├─ main.jsx
│  ├─ App.jsx            ← router + layout shell only
│  ├─ styles.css         ← tokens + global styles
│  ├─ api.js             ← every fetch to our own /api lives here
│  ├─ components/        ← shared UI (Card, StatTile, TeamBadge, Odds, BottomNav…)
│  └─ pages/             ← one file per page (Home, History, Records, Book…)
└─ server/               ← Node/Express backend
   ├─ index.js           ← Express app, serves /api and the built frontend
   ├─ db.js              ← Postgres pool
   ├─ schema.sql         ← all table definitions
   ├─ sleeper/           ← Sleeper API client + sync jobs
   ├─ stats/             ← records, power rankings, awards math
   ├─ book/              ← odds engine, bet placement, settlement
   └─ routes/            ← Express route files
```

**Rule:** keep files small. One page per file, one job per module. A file over ~400 lines gets split.

---

## 4. Design system (inherited from Banana Bets)

Same look as Banana Bets: light graphite surfaces, dark slate hero panels with a faint grid, four "controller dot" accents (blue, green, red, yellow), heavy Inter type, yellow as the signature highlight.

### Color tokens (copy exactly)

```css
:root {
  --background: #ececef;   --background-2: #e2e3e7;
  --surface: #f8f8f7;      --surface-2: #dedee2;   --surface-3: #cacbd0;
  --border: #a8aab1;       --border-soft: #d0d1d5;
  --text: #303238;         --text-soft: #686b73;
  --dark: #3b3e45;         --dark-2: #585b63;
  --blue: #0862d9;         --blue-light: #1875ef;
  --green: #00a76d;        --green-light: #10be80;
  --red: #d91e2c;          --red-light: #ef3b46;
  --yellow: #e7b92f;       --yellow-light: #f6cf4c;
  --shadow: 0 7px 22px rgba(40, 42, 48, 0.10);
}
```

**Hero panel background** (used on the top card of every page):
```css
background:
  radial-gradient(circle at 85% 5%, rgba(24,117,239,.14), transparent 28%),
  radial-gradient(circle at 4% 100%, rgba(231,185,47,.08), transparent 31%),
  linear-gradient(135deg, #41444b 0%, #2f3238 52%, #25282d 100%);
```
plus a 32px grid overlay at 14% opacity (see Banana Bets `.hero::before`).

### What each color means in this app

| Color | Meaning |
|---|---|
| Yellow | Mahomie's Hub brand, champions, "Top Banana", active nav, primary buttons |
| Blue | Probabilities, projections, model numbers |
| Green | Wins, positive results, bet won, money up |
| Red | Losses, Sacko, bet lost, "Rotten Banana" |
| Gray | Neutral, pending, historical |

### Type
- Font: **Inter** (400–900), fallback `ui-sans-serif, system-ui, -apple-system, sans-serif`.
- Headlines: weight 900, tight letter-spacing (−0.8px to −1.7px).
- Eyebrows and labels: uppercase, weight 900, letter-spacing 1.2–2.4px, small (8–10px on desktop, 10–11px on phone).
- Numbers: `font-variant-numeric: tabular-nums` everywhere digits line up.

### Components to reuse from Banana Bets
`.hero`, `.highlight-card` (colored 3px top bar), `.metric-card`, `.panel`, `.team-badge`, `.confidence-badge`, `.value-rank` (dark circle with yellow number), the tutorial overlay, `.brand-dots`.

### Mobile-first rules (this app lives on phones)
- Design at **390px wide first**, then scale up.
- **Bottom tab bar** on phones: Home · League · Records · Book · Me. Sidebar only on desktop (≥900px).
- Tap targets at least 44px tall.
- Respect safe areas: `padding-bottom: env(safe-area-inset-bottom)` on the tab bar.
- No horizontal page scroll. Wide tables scroll inside their own container.
- Standalone PWA: `display: standalone`, `theme_color: #2f3238`, `background_color: #ececef`.

### Branding copy
- Name: **MAHOMIE'S HUB** (display as `MAHOMIE'S <strong>HUB</strong>`, same treatment as `BANANA <strong>BETS</strong>`)
- Subtitle: **LEAGUE HQ · HISTORY + STATS + SPORTSBOOK**
- Tagline: *Peel back the league.*
- Currency: **Banana Bucks** (symbol 🍌 is allowed only on the currency, nowhere else)

---

## 5. Sleeper data source

Base URL: `https://api.sleeper.app/v1` — free, read-only, no API key.

| What | Endpoint | How often we pull it |
|---|---|---|
| NFL state (current season + week) | `/state/nfl` | every sync |
| League settings | `/league/{league_id}` | daily |
| Managers | `/league/{league_id}/users` | daily |
| Rosters (record, points for/against) | `/league/{league_id}/rosters` | every sync |
| Weekly matchups + player points | `/league/{league_id}/matchups/{week}` | every sync (current week), once (past weeks) |
| Playoff brackets | `/league/{league_id}/winners_bracket`, `/losers_bracket` | daily in playoffs |
| Trades, waivers, adds/drops | `/league/{league_id}/transactions/{week}` | every sync |
| Drafts | `/league/{league_id}/drafts`, `/draft/{draft_id}/picks` | once per season |
| All NFL players (~5 MB) | `/players/nfl` | **once per day max** |
| Avatars | `https://sleepercdn.com/avatars/thumbs/{avatar_id}` | on demand |

**League history:** every league object has `previous_league_id`. Start from the current `league_id`, follow `previous_league_id` back until it is null or `"0"`. That chain is every season on Sleeper.

**Projections (unofficial):** `https://api.sleeper.app/projections/nfl/{season}/{week}?season_type=regular` (add `&position[]=QB&position[]=RB…` as needed). It is not documented by Sleeper and can change or disappear. The odds engine must still work without it (fallback in section 7).

**Rate limit:** Sleeper asks for fewer than 1,000 calls per minute. All calls go through `server/sleeper/client.js`, which caches responses in Postgres and never calls Sleeper from the browser.

**Sync schedule (Pacific time):**
- Every 10 minutes during NFL game windows (Thu night, Sun, Mon night)
- Every 2 hours otherwise during the season
- Wednesday 3:00 AM: final settle of last week (Sleeper stat corrections land by then), then grade bets and post recap

**Config:** the current `SLEEPER_LEAGUE_ID` is an environment variable on Railway. Each new season, Sleeper creates a new league_id; update the env var (or add a commissioner button that finds it from the commissioner's Sleeper username).

---

## 6. Database tables

```sql
-- Sleeper mirror (rebuilt any time from the API)
seasons(season, league_id PK, previous_league_id, name, settings_json, champion_roster_id)
managers(user_id PK, display_name, team_name, avatar)
rosters(league_id, roster_id, owner_id, wins, losses, ties, fpts, fpts_against, PRIMARY KEY(league_id, roster_id))
matchups(league_id, week, roster_id, matchup_id, points, starters_json, players_points_json, PRIMARY KEY(league_id, week, roster_id))
players(player_id PK, full_name, position, team, status, updated_at)
transactions(transaction_id PK, league_id, week, type, status, roster_ids_json, adds_json, drops_json, picks_json, created)
draft_picks(draft_id, pick_no, round, roster_id, player_id, PRIMARY KEY(draft_id, pick_no))
brackets(league_id, bracket, match_id, round, t1, t2, winner, loser, place, PRIMARY KEY(league_id, bracket, match_id))

-- App data
app_users(user_id PK → managers, pin_hash, role DEFAULT 'manager', created_at)   -- role: 'manager' | 'commish'
sessions(token PK, user_id, expires_at)
lines(id PK, league_id, week, matchup_id, home_roster, away_roster,
      proj_home, proj_away, spread, total, ml_home, ml_away, win_prob_home,
      status, locked_at, settled_at, override_by)                          -- status: open | locked | settled | void
bets(id PK, user_id, line_id, market, side, stake, odds, line_value,
     status, payout, placed_at, settled_at)                               -- market: ml | spread | total; status: pending | won | lost | push | void
bankroll_ledger(id PK, user_id, season, amount, reason, ref_id, created_at)   -- balance = SUM(amount)
awards(id PK, season, award_key, title, roster_id, value, note, source)       -- source: auto | commish
recaps(league_id, week, body_md, created_at, PRIMARY KEY(league_id, week))
```

**Rule:** a bankroll is never stored as a single number. It is always the sum of the ledger, so every Banana Buck can be traced.

---

## 7. The Banana Book (sportsbook rules + odds engine)

### House rules
- Every manager starts each season with **1,000 Banana Bucks**.
- **+100 weekly allowance** every Tuesday so nobody is knocked out for the season.
- Min bet 10, max bet 250 per wager (commissioner can change).
- Spreads are capped at 20 points; in Weeks 1–6 projections are pulled harder (35%) toward the league average.
- Markets per matchup: **moneyline, spread, total (over/under)**. Parlays come in Phase 7.
- You **can** bet on your own matchup, but only on yourself to win (no betting against yourself).
- All lines **lock at the first NFL kickoff of the week** (usually Thursday night). After that, no bets.
- Bets settle when the week is final (Wednesday 3 AM job), using Sleeper's final points.
- Exact tie on a spread or total = **push** (stake returned).
- Commissioner can void a line (refunds every bet on it) or override any number before lock.
- Season prize: the bankroll leader gets the **Banana Book Champion** award. Bragging rights only.

### Odds engine (`server/book/engine.js`)

For each matchup, team A vs team B:

**Step 1 — Projected score for each team**
```
proj_sleeper = sum of Sleeper projections for the team's current starters
proj_form    = team's average points over its last 4 games
proj_season  = team's season average (falls back to league average early in the year)

projection = 0.60 * proj_sleeper + 0.25 * proj_form + 0.15 * proj_season
```
If Sleeper projections are missing: `projection = 0.6 * proj_form + 0.4 * proj_season`.
Weeks 1–3: blend in last season's average with weight shrinking each week.

**Step 2 — Uncertainty**
```
sd_team = standard deviation of that team's weekly scores (this season + last season),
          shrunk toward the league-wide sd (default 24 points if not enough data)
sd_game = sqrt(sd_A² + sd_B²)
```

**Step 3 — Fair win probability**
```
diff  = projection_A - projection_B
p_A   = Φ(diff / sd_game)        -- Φ = standard normal CDF
p_B   = 1 - p_A
```

**Step 4 — Lines**
```
spread_A = -round_to_half(diff)              -- favorite shows negative
total    = round_to_half(projection_A + projection_B)
spread and total both priced at -110
```

**Step 5 — Moneyline with house edge (vig)**
```
hold      = 0.045                            -- 4.5% book margin, configurable
implied_A = p_A * (1 + hold)
implied_B = p_B * (1 + hold)
American odds from implied probability q:
  if q >= 0.5:  odds = -round(100 * q / (1 - q))
  else:         odds = +round(100 * (1 - q) / q)
Round to the nearest 5. Cap at -1000 / +700.
```

**Step 6 — Line movement (Phase 4b)**
If more than 70% of the money on a market is on one side, shift that side's price by 10 cents (or half a point on spreads). Max 2 moves per line. All moves logged.

**Payouts**
```
positive odds:  profit = stake * odds / 100
negative odds:  profit = stake * 100 / |odds|
won  → ledger +stake +profit   (stake was already deducted when placed)
push → ledger +stake
```

**Accuracy check:** keep every line and result. A "How sharp is the Book?" page compares projected vs actual (mean error, % favorites that won). Tune the weights in Step 1 after Week 8.

---

## 8. Feature list

Status tags: **MVP** (Phase 2), **v1** (Phases 3–5), **v2** (Phase 6–7), **COMMISH** (commissioner-only).

### Home (MVP)
- This week: every matchup with live scores (during games) and Banana Book lines
- Top Banana (week high score) and Rotten Banana (week low score)
- Quick links to My Team, Book, Records

### League History & Hall of Fame (MVP)
- Season cards: champion, runner-up, Sacko, regular season #1, top scorer
- Trophy case per manager
- All-time standings table: W-L-T, win %, PF, PA, playoff apps, titles, Sackos
- Head-to-head matrix (every manager vs every manager)

### Record Book (MVP)
- Highest / lowest team score (single week)
- Biggest blowout / closest game
- Highest scoring loss / lowest scoring win
- Best single-player performance (by position too)
- Most points in a season / fewest
- Longest win streak / losing streak
- Each record shows holder, value, season/week, and the runner-up list (top 10)
- "NEW RECORD" badge when a record falls this week

### Manager Profiles (MVP)
- Career stats, season-by-season line, trophies, best/worst week, favorite trade partner, biggest rival

### Season Hub (v1)
- Standings with **All-Play record** (record if you played everyone every week)
- **Luck Index** = actual wins − all-play expected wins
- **Power Rankings** (formula in section 9) with up/down arrows vs last week
- **Playoff odds** (Monte Carlo, 10,000 simulated rest-of-seasons)
- **Weekly Recap**: auto-written summary every Wednesday

### Unique features (v1)
- **Bench Shame**: points left on the bench each week (optimal lineup vs actual), season leaderboard
- **Rivalry Cards**: series record, avg margin, biggest beatdown, last 5 meetings for any two managers
- **Trade Grader**: points each side got after the trade, updated weekly, with a verdict
- **Draft Re-grade**: each pick's points vs where it was drafted; best steal and worst bust
- **Waiver Wizard tracker**: points scored by players picked up mid-season

### The Banana Book (v1)
- Lines board for the week, bet slip, my open bets, my history
- Bankroll leaderboard + weekly profit/loss
- Bet feed ("Mike took the over 241.5 for 150") for trash talk
- How sharp is the Book? page

### Awards (v1, ready before championship week)
Auto awards: MVP manager (most PF), Top Banana count (most weekly highs), Rotten Banana (most weekly lows), Unluckiest (most PA), Luckiest (Luck Index), Waiver Wizard, Trade of the Year, Draft Steal, Draft Bust, Bench Shame champion, Banana Book Champion, Biggest Blowout, Comeback Kid.
Commissioner awards: free-text entries added in the admin panel.
Optional: league voting on 1–2 awards (Phase 7).

### Commissioner tools (COMMISH, v1–v2)
- Admin panel: force sync, edit/void lines, settle a week manually, adjust bankrolls (logged), set the season's league_id, add awards
- **Start/Sit helper**: for each lineup slot, compares starter vs bench options on projection, last-4 average, opponent points allowed to that position, and boom/bust range. Commissioner-only at first; can be opened to everyone later.

### Later ideas (v2)
- Parlays (2–4 legs, no same-matchup legs)
- Player props ("Will Team X score 150+?")
- Survivor side game (pick one team to win each week, can't reuse)
- Push notifications (lines open, bet settled, record broken) — iOS supports web push only for installed PWAs, iOS 16.4+
- Hall of Fame inductions with league voting
- Shareable record cards (image export for the group chat)
- Dues and payouts ledger (tracking only)

---

## 9. Stats formulas

**All-Play:** for each week, a team's all-play wins = number of other teams it outscored that week. Season all-play % = total all-play wins / total all-play games.

**Expected wins:** sum over weeks of (teams outscored that week / (league size − 1)).

**Luck Index:** actual wins − expected wins. Positive = lucky.

**Power Rankings score (0–100):**
```
score = 0.35 * percentile(points for per game)
      + 0.25 * percentile(all-play %)
      + 0.20 * percentile(last 3 weeks points)
      + 0.20 * percentile(win %)
```
Ties broken by points for.

**Optimal lineup (Bench Shame):** using the league's roster positions from league settings, fill each starting slot greedily with the highest-scoring eligible rostered player that week (fill single-position slots first, then FLEX/SUPER_FLEX). Bench Shame = optimal − actual.

**Trade value:** for each side, sum of points scored by acquired players while on the new roster, plus points from acquired draft picks' players. Verdict when the gap is more than 15%.

**Playoff odds:** simulate the remaining schedule 10,000 times; each team's weekly score ~ Normal(projection, sd_team); apply league tiebreakers from settings; count playoff berths and byes.

---

## 10. Pages and routes

| Route | Page | Phase |
|---|---|---|
| `/` | Home (this week) | 2 |
| `/login` | Pick your team + PIN | 2 |
| `/history` | Seasons + Hall of Fame | 2 |
| `/records` | Record Book | 2 |
| `/managers/:userId` | Manager profile | 2 |
| `/h2h` | Head-to-head matrix + rivalry cards | 3 |
| `/season` | Standings, power rankings, luck, playoff odds | 3 |
| `/recap/:week` | Weekly recap | 3 |
| `/book` | Lines board + bet slip | 4 |
| `/book/me` | My bets + bankroll | 4 |
| `/book/leaders` | Bankroll leaderboard + bet feed | 4 |
| `/awards` | Season awards | 5 |
| `/commish` | Admin panel (commish only) | 4–6 |
| `/commish/start-sit` | Start/Sit helper (commish only) | 6 |

### API routes (server)
```
GET  /api/state                     current season/week + last sync time
GET  /api/history                   all seasons, champions, all-time table
GET  /api/records                   record book
GET  /api/managers/:id              profile
GET  /api/game?season=&week=&users=a,b   box score: starters by slot + bench, names, positions, points (built)
GET  /api/bench?season=              Bench Shame: optimal minus actual, per team + worst week (built)
GET  /api/trades?season=             Trade grader: starter points each side got after the trade (built)
GET  /api/draft?season=              Draft re-grade: steals and busts by pick vs points rank (built)
GET  /api/season/:season            standings, power, luck, playoff odds
GET  /api/h2h                       matrix
GET  /api/recap/:season/:week
GET  /api/book/lines?week=          current lines
POST /api/book/bets                 place bet (auth)
GET  /api/book/me                   my bets + balance (auth)
GET  /api/book/leaders
GET  /api/awards/:season
POST /api/auth/login                { user_id, pin } → session token
POST /api/commish/*                 sync, lines, settle, awards (commish only)
```

---

## 11. Roadmap

| Phase | Name | Goal | Done when |
|---|---|---|---|
| 0 | Setup | Repo, Codespace, Railway, Postgres, PWA shell deployed | A blank Mahomie's Hub app installs on Jayson's phone from Railway |
| 1 | Data pipeline | Sleeper sync into Postgres, full history chain | Every season's matchups are in the database and `/api/state` works |
| 2 | MVP: History + Records | Home, History, Records, Manager profiles, login | The league can install it and browse history; shared in the group chat |
| 3 | Season hub | Power rankings, all-play, luck, recaps, rivalries, Bench Shame | Wednesday recap posts automatically |
| 4 | Banana Book | Lines, bets, bankrolls, settlement, admin line control | One full week of bets placed, locked, and settled correctly |
| 5 | Awards | Auto + commish awards, trade grader, draft re-grade | Awards page ready before the championship week |
| 6 | Commish tools | Start/Sit helper, admin panel polish | Jayson uses it for his own lineup |
| 7 | Extras | Parlays, props, survivor, notifications, share cards | Pick from the v2 list |

**Target timing (2026 season, starting the week of Oct 7):**
Phases 0–1 this week · Phase 2 live in about 2 weeks · Phase 3 the week after · Phase 4 live around NFL Week 9–10 · Phase 5 before the fantasy championship week · Phases 6–7 in the offseason.

---

## 12. Working rules for any AI assistant

1. **Read `BIBLE.md` and `HANDOFF.md` first** whenever Jayson starts or resumes a session. Ask before contradicting either.
2. **Jayson is not a developer.** Explain steps in plain words. Never assume he knows a command.
3. **Give complete files** for anything new, and for edits give the **exact block to find and the exact block to replace it with**, with the file path above each. No "…rest of code here".
4. **Always end a code answer with the git commands** to run in the Codespaces terminal:
   ```bash
   git remote -v          # must show poochinski/mahomies-hub
   git status
   git add .
   git commit -m "Short description of the change"
   git push
   ```
   and remind him that **Railway auto-deploys from that push** (wait ~2 minutes, then refresh the app).
5. **Work as long as usage lasts.** There is no limit on features per session. Jayson uses each AI until its usage runs out, then switches to the next one. Keep going from one task to the next.
6. **Build in small, pushable chunks.** Each chunk ends in a working app and a push. Never leave the app broken between pushes, because usage can run out at any moment.
7. **Every push includes an updated `HANDOFF.md`.** Before giving the git commands for any chunk, give the full updated `HANDOFF.md` (template in section 14) so it goes out in the same commit. Also add one line to the top of `CHANGELOG.md`. The repo is always the real, current state.
8. **Never** change the tech stack, folder structure, color tokens, or database tables without saying so and updating this Bible in the same push.
9. **Never** put secrets (database URL, admin PIN) in code. They go in Railway environment variables.
10. **Never call Sleeper from the browser.** Frontend talks only to `/api`.
11. **Mobile first.** Every page must work at 390px wide before it ships.
12. **Banana Bucks only.** Never add real-money payment features.
13. **If Jayson says he is switching AIs or running low on usage,** give the full updated `HANDOFF.md` and `CHANGELOG.md` line right away, with the git commands.

---

## 13. Environment variables (Railway)

| Name | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | (from Railway Postgres) | Postgres connection |
| `SLEEPER_LEAGUE_ID` | `1312104253497540608` | Current season's league (2026) |
| `COMMISH_USER_ID` | `862901935416655872` | Jayson (Poochinski) gets the admin role |
| `SESSION_SECRET` | long random string | Signs login tokens |
| `TZ` | `America/Los_Angeles` | Cron schedule in Pacific time |
| `BOOK_HOLD` | `0.045` | Sportsbook margin |

---

## 14. HANDOFF.md template

`HANDOFF.md` is a living document. It is rewritten in full **with every push**, by whichever AI made the change, so the next AI (or the same one tomorrow) starts with the complete picture. Keep it under ~250 lines: move old "Done" entries into `CHANGELOG.md` when the list gets long.

```markdown
# HANDOFF — where we left off

**Last updated:** YYYY-MM-DD HH:MM (Pacific) · **AI:** Claude / ChatGPT / Grok
**Current phase:** Phase X — name
**Last commit:** "commit message"
**App status:** Working / Broken (what's broken) · **Live URL:** https://…

## What we're working toward right now
The current goal in 2–4 sentences, in plain words. Update this whenever the
goal shifts because of testing or new ideas.

## Done (newest first)
- YYYY-MM-DD — what was built or fixed, in one line (AI name)

## In progress (not finished)
- What is half-done, which files, and what is still missing

## Next steps (in order)
1. Exactly what to do first next time
2. …

## Decisions made (and why)
- Decision — reason. (Anything that changes the plan in this Bible also gets
  written into the Bible.)

## What we talked about / ideas parked
- Ideas, league feedback, things Jayson asked about that aren't built yet

## Testing notes
- What Jayson tested on his phone and what he saw

## Known bugs / open questions
- …

## Files changed in the latest push
- path — what changed
```

---

## 15. Starting or resuming a session

Paste this at the start of every session, in any AI (or whenever you come back to one):

```
Read the Mahomie's Hub project files before we continue:
https://raw.githubusercontent.com/poochinski/mahomies-hub/main/BIBLE.md
https://raw.githubusercontent.com/poochinski/mahomies-hub/main/HANDOFF.md

Read both fully and follow section 12 of the Bible. Then tell me the current
goal, the last thing done, what's in progress, the next steps, and open bugs,
and ask if I'm ready to start. If you can't open the links, say so and I'll
paste the files.
```

The repo must be **public** for the links to work. GitHub can take up to ~5 minutes to show a fresh push at those links. If the AI can't open them, or the handoff it reads is older than your last push, paste both files into the chat instead.

## 16. Switching AIs (the relay)

1. Work in one AI as long as its usage lasts. Every push already updates `HANDOFF.md`.
2. If you get a low-usage warning, say "I'm switching AIs, give me the updated handoff" and push what it gives you. If you got cut off first, the handoff from your last push is still current.
3. Open the next AI and paste the starter prompt from section 15.
4. Check its summary matches what you remember, then say go.
5. Order: Claude → ChatGPT → Grok → back to Claude when its usage resets.
