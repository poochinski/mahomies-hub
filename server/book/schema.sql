-- Sportsbook tables. Safe to run on every start (IF NOT EXISTS everywhere).
-- Play money only: Mahomie Bucks have no cash value.

CREATE TABLE IF NOT EXISTS app_users (
  user_id       TEXT PRIMARY KEY,            -- Sleeper user id
  pin_hash      TEXT,                        -- scrypt hash; NULL = no PIN yet
  pin_salt      TEXT,
  pin_set_at    TIMESTAMPTZ,
  failed_tries  INT NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,              -- sha256 of the token the phone keeps
  user_id     TEXT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- One row per Book week: when lines posted, when it settled.
CREATE TABLE IF NOT EXISTS book_weeks (
  season      TEXT NOT NULL,
  week        INT  NOT NULL,
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_kick  TIMESTAMPTZ,
  last_kick   TIMESTAMPTZ,
  settle_at   TIMESTAMPTZ,                   -- Wednesday 3 AM after the last game
  settled_at  TIMESTAMPTZ,
  PRIMARY KEY (season, week)
);

-- Frozen lines: everyone bets the same numbers all week.
CREATE TABLE IF NOT EXISTS lines (
  id            TEXT PRIMARY KEY,            -- e.g. 2026-w6-m3
  season        TEXT NOT NULL,
  week          INT  NOT NULL,
  matchup_id    INT  NOT NULL,
  team_a        TEXT NOT NULL,               -- Sleeper user ids
  team_b        TEXT NOT NULL,
  roster_a      INT  NOT NULL,
  roster_b      INT  NOT NULL,
  proj_a        NUMERIC(7,1) NOT NULL,
  proj_b        NUMERIC(7,1) NOT NULL,
  spread        NUMERIC(5,1) NOT NULL,       -- team A expected margin (A shows as -spread)
  total         NUMERIC(6,1) NOT NULL,
  ml_a          INT NOT NULL,
  ml_b          INT NOT NULL,
  spread_price  INT NOT NULL DEFAULT -110,
  total_price   INT NOT NULL DEFAULT -110,
  wp_a          NUMERIC(5,3) NOT NULL,
  lock_at       TIMESTAMPTZ,                 -- latest known lock time (first starter's kickoff)
  locked        BOOLEAN NOT NULL DEFAULT false,
  status        TEXT NOT NULL DEFAULT 'open', -- open | final | void
  final_a       NUMERIC(7,2),
  final_b       NUMERIC(7,2),
  note          TEXT,                        -- commish changes are explained here
  posted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lines_week ON lines(season, week);

CREATE TABLE IF NOT EXISTS bets (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES app_users(user_id),
  season      TEXT NOT NULL,
  week        INT  NOT NULL,
  kind        TEXT NOT NULL,                 -- single | parlay
  stake       NUMERIC(10,2) NOT NULL,
  dec_odds    NUMERIC(12,4) NOT NULL,
  odds        INT NOT NULL,                  -- American odds shown on the slip
  to_win      NUMERIC(12,2) NOT NULL,        -- profit if it wins
  status      TEXT NOT NULL DEFAULT 'open',  -- open | won | lost | push | void | cancelled
  payout      NUMERIC(12,2),                 -- returned on settlement (stake included)
  lock_at     TIMESTAMPTZ,
  placed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS bets_user ON bets(user_id, season);
CREATE INDEX IF NOT EXISTS bets_week ON bets(season, week, status);

CREATE TABLE IF NOT EXISTS bet_legs (
  id       BIGSERIAL PRIMARY KEY,
  bet_id   BIGINT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  line_id  TEXT NOT NULL REFERENCES lines(id),
  market   TEXT NOT NULL,                    -- spread | ml | total
  pick     TEXT NOT NULL,                    -- a | b | over | under
  point    NUMERIC(6,1),                     -- spread for the picked side, or the total
  odds     INT NOT NULL,
  result   TEXT NOT NULL DEFAULT 'open'      -- open | won | lost | push | void
);
CREATE INDEX IF NOT EXISTS legs_bet ON bet_legs(bet_id);
CREATE INDEX IF NOT EXISTS legs_line ON bet_legs(line_id);

-- Every Mahomie Buck that moves. A bankroll is always SUM(amount), never stored.
CREATE TABLE IF NOT EXISTS bankroll_ledger (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES app_users(user_id),
  season      TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  kind        TEXT NOT NULL,                 -- grant | stake | payout | refund | adjust
  bet_id      BIGINT REFERENCES bets(id),
  note        TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_user ON bankroll_ledger(user_id, season);
-- The 1,000-Buck season grant can only ever happen once per person per season.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_grant ON bankroll_ledger(user_id, season) WHERE kind = 'grant';

CREATE TABLE IF NOT EXISTS book_settings (
  key    TEXT PRIMARY KEY,
  value  JSONB NOT NULL
);

-- Job runs and commish actions, newest first, for "what happened?" questions.
CREATE TABLE IF NOT EXISTS book_log (
  id      BIGSERIAL PRIMARY KEY,
  at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind    TEXT NOT NULL,
  by_user TEXT,
  detail  JSONB
);
