// The Banana Book: logins, bankrolls, frozen lines, bets, locks and settlement.
// House rules live in BIBLE.md §7. Play money only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { COMMISH_USER_ID } from '../config.js';
import { priceWeek, legTerms, gradeLeg, gradeBet, betOdds, money } from './engine.js';
import { kickoffs, postTime, settleTime, fmtPT } from './kickoffs.js';
import * as sl from './data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIN = 60 * 1000;

// Clock. BOOK_FAKE_NOW lets local tests pretend it's a given moment; never set it on Railway.
export const now = () => (process.env.BOOK_FAKE_NOW ? new Date(process.env.BOOK_FAKE_NOW) : new Date());

export class BookError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

// ---------- database plumbing ----------
let ready = false;
export const isReady = () => ready;

export async function initBook() {
  if (!pool) return false;
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  ready = true;
  return true;
}

async function q(text, params) { return (await pool.query(text, params)).rows; }
async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const out = await fn(c); await c.query('COMMIT'); return out; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}
async function log(kind, detail, by = null) { await q('INSERT INTO book_log(kind, by_user, detail) VALUES ($1,$2,$3)', [kind, by, JSON.stringify(detail ?? null)]).catch(() => {}); }

// ---------- settings ----------
export const DEFAULTS = { start_week: 6, grant: 1000, min_bet: 10, max_bet: 250, parlay_min_legs: 2, parlay_max_legs: 4, parlay_max_payout: 10000 };
export async function settings() {
  const rows = await q('SELECT key, value FROM book_settings');
  const s = { ...DEFAULTS };
  for (const r of rows) if (r.key in DEFAULTS) s[r.key] = Number(r.value);
  return s;
}
export async function setSetting(key, value, by) {
  if (!(key in DEFAULTS)) throw new BookError(`Unknown setting "${key}"`);
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) throw new BookError('Setting must be a positive number');
  await q('INSERT INTO book_settings(key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, JSON.stringify(v)]);
  await log('setting', { key, value: v }, by);
  return settings();
}

// ---------- logins (team + 4-digit PIN) ----------
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const SESSION_DAYS = 180;
const ipTries = new Map(); // ip -> [timestamps]

export async function teamsList() {
  const L = await sl.league();
  const rows = await q('SELECT user_id, pin_hash IS NOT NULL AS has_pin FROM app_users');
  const has = Object.fromEntries(rows.map((r) => [r.user_id, r.has_pin]));
  return L.active.map((u) => ({ ...L.teams[u], has_pin: !!has[u], commish: u === COMMISH_USER_ID }))
    .sort((a, b) => a.team.localeCompare(b.team));
}

export async function login(userId, pin, ip = '?') {
  if (!/^\d{4}$/.test(String(pin || ''))) throw new BookError('PIN must be 4 digits');
  const t = Date.now(); const recent = (ipTries.get(ip) || []).filter((x) => t - x < 15 * MIN);
  if (recent.length >= 30) throw new BookError('Too many tries from this phone. Wait 15 minutes.', 429);
  recent.push(t); ipTries.set(ip, recent);

  const L = await sl.league();
  if (!L.active.includes(userId)) throw new BookError('That team is not in the league this season', 404);
  await q('INSERT INTO app_users(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  const [u] = await q('SELECT * FROM app_users WHERE user_id = $1', [userId]);
  if (u.locked_until && new Date(u.locked_until) > now()) throw new BookError(`Too many wrong PINs. Try again after ${fmtPT(u.locked_until)}.`, 429);
  let created = false;
  if (!u.pin_hash) {
    const salt = crypto.randomBytes(16).toString('hex');
    await q('UPDATE app_users SET pin_hash=$2, pin_salt=$3, pin_set_at=now(), failed_tries=0, locked_until=NULL WHERE user_id=$1', [userId, hashPin(pin, salt), salt]);
    created = true;
    await log('pin_set', { user: userId });
  } else {
    const ok = crypto.timingSafeEqual(Buffer.from(hashPin(pin, u.pin_salt), 'hex'), Buffer.from(u.pin_hash, 'hex'));
    if (!ok) {
      const tries = u.failed_tries + 1;
      await q('UPDATE app_users SET failed_tries=$2, locked_until=$3 WHERE user_id=$1', [userId, tries >= 5 ? 0 : tries, tries >= 5 ? new Date(now().getTime() + 15 * MIN) : null]);
      throw new BookError(tries >= 5 ? 'Wrong PIN 5 times. Locked for 15 minutes.' : `Wrong PIN (${5 - tries} ${5 - tries === 1 ? 'try' : 'tries'} left)`, 401);
    }
    await q('UPDATE app_users SET failed_tries=0, locked_until=NULL WHERE user_id=$1', [userId]);
  }
  const token = crypto.randomBytes(32).toString('base64url');
  await q('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [sha(token), userId, new Date(now().getTime() + SESSION_DAYS * 24 * 60 * MIN)]);
  await ensureGrant(userId, L.season);
  return { token, user_id: userId, created };
}

export async function userFromToken(token) {
  if (!token || !pool || !ready) return null;
  const [s] = await q('UPDATE sessions SET last_seen=now() WHERE token_hash=$1 AND expires_at > now() RETURNING user_id', [sha(token)]);
  return s ? s.user_id : null;
}
export async function logout(token) { if (token) await q('DELETE FROM sessions WHERE token_hash=$1', [sha(token)]); }

export async function resetPin(userId, by) {
  await q('UPDATE app_users SET pin_hash=NULL, pin_salt=NULL, failed_tries=0, locked_until=NULL WHERE user_id=$1', [userId]);
  await q('DELETE FROM sessions WHERE user_id=$1', [userId]);
  await log('pin_reset', { user: userId }, by);
}

// ---------- bankroll ----------
async function ensureGrant(userId, season, c = null) {
  const s = await settings();
  const run = (sql, p) => (c ? c.query(sql, p) : pool.query(sql, p));
  await run(`INSERT INTO bankroll_ledger(user_id, season, amount, kind, note) VALUES ($1,$2,$3,'grant',$4)
             ON CONFLICT (user_id, season) WHERE kind = 'grant' DO NOTHING`, [userId, season, s.grant, `${season} season bankroll`]);
}
async function balanceOf(userId, season, c = null) {
  const r = await (c || pool).query('SELECT COALESCE(SUM(amount),0)::float AS b FROM bankroll_ledger WHERE user_id=$1 AND season=$2', [userId, season]);
  return money(r.rows[0].b);
}

export async function adjust(userId, amount, note, by) {
  const a = money(Number(amount));
  if (!a) throw new BookError('Amount must be a non-zero number');
  if (!note || !String(note).trim()) throw new BookError('Give a reason (it goes in the ledger)');
  const L = await sl.league();
  await q('INSERT INTO app_users(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  await ensureGrant(userId, L.season);
  await q("INSERT INTO bankroll_ledger(user_id, season, amount, kind, note, created_by) VALUES ($1,$2,$3,'adjust',$4,$5)", [userId, L.season, a, String(note).trim(), by]);
  await log('adjust', { user: userId, amount: a, note }, by);
  return balanceOf(userId, L.season);
}

// ---------- lines ----------
export async function postLines(week, { force = false, by = null } = {}) {
  const L = await sl.league();
  const season = L.season;
  if (week < 1 || week >= L.P) throw new BookError(`Week ${week} isn't a regular-season week`);
  const have = await q('SELECT 1 FROM book_weeks WHERE season=$1 AND week=$2', [season, week]);
  if (have.length && !force) throw new BookError(`Week ${week} lines are already posted`);
  if (have.length) {
    const bets = await q("SELECT 1 FROM bets WHERE season=$1 AND week=$2 AND status <> 'cancelled' LIMIT 1", [season, week]);
    if (bets.length) throw new BookError(`Week ${week} already has bets; change single lines instead of reposting`);
  }
  const pairs = await sl.pairsFor(L, week);
  if (!pairs.length) throw new BookError(`Sleeper has no Week ${week} matchups yet`);
  const { cur, prev } = await sl.scoresBefore(L, week);
  const priced = priceWeek(week, pairs, cur, prev);
  let k = null; try { k = await kickoffs(season, week); } catch { /* lock times filled in later */ }
  await tx(async (c) => {
    if (have.length) {
      await c.query('DELETE FROM lines WHERE season=$1 AND week=$2', [season, week]);
      await c.query('DELETE FROM book_weeks WHERE season=$1 AND week=$2', [season, week]);
    }
    await c.query('INSERT INTO book_weeks(season, week, first_kick, last_kick, settle_at) VALUES ($1,$2,$3,$4,$5)',
      [season, week, k?.first || null, k?.last || null, k ? settleTime(k) : null]);
    for (const m of priced) {
      await c.query(`INSERT INTO lines(id, season, week, matchup_id, team_a, team_b, roster_a, roster_b, proj_a, proj_b, spread, total, ml_a, ml_b, wp_a)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [`${season}-w${week}-m${m.matchup_id}`, season, week, m.matchup_id, m.a, m.b, m.roster_a, m.roster_b, m.proj_a, m.proj_b, m.spread, m.total, m.ml_a, m.ml_b, m.wp_a]);
    }
  });
  await log('post_lines', { season, week, lines: priced.length, force }, by);
  await refreshLocks(season, week, { fresh: true }).catch(() => {});
  return linesFor(week);
}

// Recompute each matchup's lock time from current starters + kickoffs.
// Once a line is locked it never unlocks.
const lockChecked = new Map(); // "season|week" -> ms
export async function refreshLocks(season, week, { fresh = false } = {}) {
  const key = `${season}|${week}`;
  if (!fresh && Date.now() - (lockChecked.get(key) || 0) < MIN) return;
  const L = await sl.league();
  if (L.season !== season) return;
  const { locks, k } = await sl.lockTimes(L, week);
  const t = now();
  for (const [mid, at] of Object.entries(locks)) {
    await q(`UPDATE lines SET lock_at = CASE WHEN locked THEN lock_at ELSE $3 END,
                              locked = locked OR $4, updated_at = now()
             WHERE season=$1 AND week=$2 AND matchup_id=$5`, [season, week, at, at <= t, Number(mid)]);
  }
  await q('UPDATE book_weeks SET first_kick=$3, last_kick=$4, settle_at=COALESCE(settle_at,$5) WHERE season=$1 AND week=$2 AND settled_at IS NULL',
    [season, week, k.first, k.last, settleTime(k)]);
  lockChecked.set(key, Date.now());
}

const isLocked = (line) => line.locked || (line.lock_at && new Date(line.lock_at) <= now());

export async function currentWeek() {
  const [w] = await q('SELECT season, week FROM book_weeks ORDER BY season DESC, week DESC LIMIT 1');
  return w || null;
}

export async function linesFor(week, { season = null } = {}) {
  const L = await sl.league();
  season = season || L.season;
  if (!week) { const w = await currentWeek(); if (!w) return { season, week: null, lines: [] }; week = w.week; season = w.season; }
  await refreshLocks(season, week).catch(() => {});
  const [bw] = await q('SELECT * FROM book_weeks WHERE season=$1 AND week=$2', [season, week]);
  const rows = await q('SELECT * FROM lines WHERE season=$1 AND week=$2 ORDER BY matchup_id', [season, week]);
  const live = rows.length && !bw?.settled_at ? await sl.pointsFor(L, week).catch(() => ({})) : {};
  const handle = await q(`SELECT l.line_id, COUNT(*)::int AS n, COALESCE(SUM(b.stake),0)::float AS bucks FROM bet_legs l JOIN bets b ON b.id=l.bet_id
                          WHERE b.season=$1 AND b.week=$2 AND b.status <> 'cancelled' GROUP BY l.line_id`, [season, week]);
  const H = Object.fromEntries(handle.map((h) => [h.line_id, h]));
  return {
    season, week: Number(week),
    posted_at: bw?.posted_at || null, first_kick: bw?.first_kick || null, settle_at: bw?.settle_at || null, settled_at: bw?.settled_at || null,
    lines: rows.map((r) => ({
      id: r.id, matchup_id: r.matchup_id, a: r.team_a, b: r.team_b,
      team_a: L.teams[r.team_a]?.team || '?', team_b: L.teams[r.team_b]?.team || '?',
      proj_a: Number(r.proj_a), proj_b: Number(r.proj_b), spread: Number(r.spread), total: Number(r.total),
      ml_a: r.ml_a, ml_b: r.ml_b, spread_price: r.spread_price, total_price: r.total_price, wp_a: Number(r.wp_a),
      lock_at: r.lock_at, locked: !!isLocked(r), status: r.status, note: r.note,
      score_a: r.final_a != null ? Number(r.final_a) : live[r.roster_a] ?? null,
      score_b: r.final_b != null ? Number(r.final_b) : live[r.roster_b] ?? null,
      bets: H[r.id]?.n || 0
    }))
  };
}

// Commish: change a line's numbers (before it locks) or void it.
export async function editLine(id, body, by) {
  const [line] = await q('SELECT * FROM lines WHERE id=$1', [id]);
  if (!line) throw new BookError('No such line', 404);
  if (line.status !== 'open') throw new BookError(`Line is already ${line.status}`);
  const note = String(body.note || '').trim();
  if (body.void) {
    await tx(async (c) => {
      await c.query("UPDATE lines SET status='void', note=$2, updated_at=now() WHERE id=$1", [id, note || 'Voided by commish']);
      await c.query("UPDATE bet_legs SET result='void' WHERE line_id=$1 AND result='open'", [id]);
    });
    await log('void_line', { id, note }, by);
    // Bets made only of void legs are refunded now; parlays keep their other legs.
    const bets = await q("SELECT DISTINCT b.id FROM bets b JOIN bet_legs l ON l.bet_id=b.id WHERE l.line_id=$1 AND b.status='open'", [id]);
    for (const b of bets) await gradeOne(b.id);
    return;
  }
  if (isLocked(line)) throw new BookError('That game is locked; only voiding is allowed now');
  const f = {};
  for (const k of ['spread', 'total', 'ml_a', 'ml_b', 'spread_price', 'total_price']) if (body[k] != null) {
    const v = Number(body[k]); if (!Number.isFinite(v)) throw new BookError(`${k} must be a number`);
    if (k.startsWith('ml') || k.endsWith('price')) { if (Math.abs(v) < 100) throw new BookError(`${k} must be -100 or lower, or +100 or higher`); f[k] = Math.round(v); }
    else f[k] = Math.round(v * 2) / 2;
  }
  if (!Object.keys(f).length) throw new BookError('Nothing to change');
  const sets = Object.keys(f).map((k, i) => `${k}=$${i + 2}`).join(', ');
  await q(`UPDATE lines SET ${sets}, note=$${Object.keys(f).length + 2}, updated_at=now() WHERE id=$1`, [id, ...Object.values(f), note || 'Adjusted by commish']);
  await log('edit_line', { id, ...f, note }, by);
}

// ---------- bets ----------
function label(leg, line, teams) {
  const nm = (u) => teams[u]?.team || '?';
  const odds = (o) => (o > 0 ? `+${o}` : `${o}`);
  if (leg.market === 'ml') return `${nm(leg.pick === 'a' ? line.team_a : line.team_b)} to win (${odds(leg.odds)})`;
  if (leg.market === 'spread') { const p = Number(leg.point); return `${nm(leg.pick === 'a' ? line.team_a : line.team_b)} ${p === 0 ? 'PK' : p > 0 ? '+' + p : p}`; }
  return `${leg.pick === 'over' ? 'Over' : 'Under'} ${Number(leg.point)} · ${nm(line.team_a)} vs ${nm(line.team_b)}`;
}

/**
 * Place a bet. legs = [{ line_id, market: 'spread'|'ml'|'total', pick: 'a'|'b'|'over'|'under' }]
 * One leg = straight bet; 2–4 legs = parlay.
 */
export async function placeBet(userId, legsIn, stakeIn) {
  const s = await settings();
  const L = await sl.league();
  const stake = Number(stakeIn);
  if (!Number.isInteger(stake)) throw new BookError('Bet whole Bucks only');
  if (stake < s.min_bet || stake > s.max_bet) throw new BookError(`Bets are ${s.min_bet}–${s.max_bet} Bucks`);
  if (!Array.isArray(legsIn) || !legsIn.length) throw new BookError('Pick something to bet on');
  const parlay = legsIn.length > 1;
  if (parlay && (legsIn.length < s.parlay_min_legs || legsIn.length > s.parlay_max_legs)) throw new BookError(`Parlays are ${s.parlay_min_legs}–${s.parlay_max_legs} picks`);
  const ids = legsIn.map((l) => String(l.line_id));
  if (new Set(ids).size !== ids.length) throw new BookError('A parlay can only use one pick per game');

  const lines = await q('SELECT * FROM lines WHERE id = ANY($1)', [ids]);
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  const weeks = new Set(lines.map((l) => `${l.season}|${l.week}`));
  if (lines.length !== ids.length) throw new BookError('That line is gone. Refresh and try again.');
  if (weeks.size > 1) throw new BookError('All picks must be from the same week');
  const { season, week } = lines[0];
  if (season !== L.season) throw new BookError('That season is over');
  await refreshLocks(season, week, { fresh: true }).catch(() => {});

  const legs = [];
  for (const li of legsIn) {
    const [fresh] = await q('SELECT * FROM lines WHERE id=$1', [String(li.line_id)]);
    if (fresh.status !== 'open') throw new BookError('That game is off the board');
    if (!fresh.lock_at) throw new BookError("Can't confirm kickoff times right now. Try again in a minute.", 503);
    if (isLocked(fresh)) throw new BookError(`${L.teams[fresh.team_a]?.team} vs ${L.teams[fresh.team_b]?.team} is locked`);
    const terms = legTerms(fresh, li.market, li.pick);
    if (!terms) throw new BookError('Unknown bet type');
    const mine = fresh.team_a === userId ? 'a' : fresh.team_b === userId ? 'b' : null;
    if (mine) {
      if ((li.market === 'ml' || li.market === 'spread') && li.pick !== mine) throw new BookError("You can't bet against yourself");
      if (li.market === 'total' && li.pick === 'under') throw new BookError("You can't bet the under on your own game");
    }
    legs.push({ line: fresh, market: li.market, pick: li.pick, ...terms });
  }
  const { dec, american: odds } = betOdds(legs);
  const toWin = money(Math.min(stake * dec, parlay ? s.parlay_max_payout : Infinity) - stake);
  const lockAt = new Date(Math.min(...legs.map((l) => new Date(l.line.lock_at).getTime())));

  const bet = await tx(async (c) => {
    await c.query('INSERT INTO app_users(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    await c.query('SELECT 1 FROM app_users WHERE user_id=$1 FOR UPDATE', [userId]); // one bet at a time per person
    await ensureGrant(userId, season, c);
    const bal = await balanceOf(userId, season, c);
    if (stake > bal) throw new BookError(`Not enough Bucks (you have ${bal})`);
    const { rows: [b] } = await c.query(`INSERT INTO bets(user_id, season, week, kind, stake, dec_odds, odds, to_win, lock_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [userId, season, week, parlay ? 'parlay' : 'single', stake, dec, odds, toWin, lockAt]);
    for (const l of legs) await c.query('INSERT INTO bet_legs(bet_id, line_id, market, pick, point, odds) VALUES ($1,$2,$3,$4,$5,$6)', [b.id, l.line.id, l.market, l.pick, l.point, l.odds]);
    await c.query("INSERT INTO bankroll_ledger(user_id, season, amount, kind, bet_id, note) VALUES ($1,$2,$3,'stake',$4,$5)", [userId, season, -stake, b.id, `Bet #${b.id}`]);
    return b;
  });
  return { bet: await betView(bet.id), balance: await balanceOf(userId, season) };
}

export async function cancelBet(userId, betId) {
  const out = await tx(async (c) => {
    const { rows: [b] } = await c.query('SELECT * FROM bets WHERE id=$1 FOR UPDATE', [betId]);
    if (!b || b.user_id !== userId) throw new BookError('No such bet', 404);
    if (b.status !== 'open') throw new BookError(`That bet is already ${b.status}`);
    const { rows: legs } = await c.query('SELECT l.* FROM lines l JOIN bet_legs g ON g.line_id=l.id WHERE g.bet_id=$1', [betId]);
    if (legs.some(isLocked)) throw new BookError('Too late: a game in this bet has started');
    await c.query("UPDATE bets SET status='cancelled', settled_at=now() WHERE id=$1", [betId]);
    await c.query("INSERT INTO bankroll_ledger(user_id, season, amount, kind, bet_id, note) VALUES ($1,$2,$3,'refund',$4,$5)", [userId, b.season, b.stake, betId, `Cancelled bet #${betId}`]);
    return b;
  });
  return { balance: await balanceOf(userId, out.season) };
}

async function betView(id) { return (await betsWhere('b.id = $1', [id]))[0]; }

async function betsWhere(where, params, limit = 200) {
  const L = await sl.league();
  const bets = await q(`SELECT b.* FROM bets b WHERE ${where} ORDER BY b.placed_at DESC LIMIT ${limit}`, params);
  if (!bets.length) return [];
  const legs = await q(`SELECT g.*, l.team_a, l.team_b, l.week, l.lock_at, l.locked, l.status AS line_status, l.final_a, l.final_b, l.roster_a, l.roster_b
                        FROM bet_legs g JOIN lines l ON l.id=g.line_id WHERE g.bet_id = ANY($1) ORDER BY g.id`, [bets.map((b) => b.id)]);
  return bets.map((b) => ({
    id: Number(b.id), user_id: b.user_id, team: L.teams[b.user_id]?.team || '?', season: b.season, week: b.week, kind: b.kind,
    stake: Number(b.stake), odds: b.odds, dec_odds: Number(b.dec_odds), to_win: Number(b.to_win), status: b.status,
    payout: b.payout != null ? Number(b.payout) : null, placed_at: b.placed_at, settled_at: b.settled_at, lock_at: b.lock_at,
    legs: legs.filter((g) => String(g.bet_id) === String(b.id)).map((g) => ({
      line_id: g.line_id, market: g.market, pick: g.pick, point: g.point != null ? Number(g.point) : null, odds: g.odds, result: g.result,
      a: g.team_a, b: g.team_b, label: label(g, g, L.teams), locked: !!isLocked(g)
    }))
  }));
}

export async function me(userId) {
  const L = await sl.league();
  await ensureGrant(userId, L.season);
  const bal = await balanceOf(userId, L.season);
  const bets = await betsWhere('b.user_id=$1 AND b.season=$2', [userId, L.season]);
  const open = bets.filter((b) => b.status === 'open');
  const ledger = await q('SELECT amount::float, kind, bet_id, note, created_at FROM bankroll_ledger WHERE user_id=$1 AND season=$2 ORDER BY id DESC LIMIT 50', [userId, L.season]);
  return {
    user_id: userId, team: L.teams[userId]?.team || '?', commish: userId === COMMISH_USER_ID, season: L.season,
    balance: bal, in_play: money(open.reduce((x, b) => x + b.stake, 0)), bets, ledger
  };
}

export async function leaderboard() {
  const L = await sl.league();
  const s = await settings();
  const rows = await q(`SELECT u.user_id,
      COALESCE((SELECT SUM(amount) FROM bankroll_ledger x WHERE x.user_id=u.user_id AND x.season=$1),0)::float AS cash,
      COALESCE((SELECT SUM(stake) FROM bets b WHERE b.user_id=u.user_id AND b.season=$1 AND b.status='open'),0)::float AS in_play,
      (SELECT COUNT(*) FROM bets b WHERE b.user_id=u.user_id AND b.season=$1 AND b.status='won')::int AS won,
      (SELECT COUNT(*) FROM bets b WHERE b.user_id=u.user_id AND b.season=$1 AND b.status='lost')::int AS lost,
      (SELECT COUNT(*) FROM bets b WHERE b.user_id=u.user_id AND b.season=$1 AND b.status IN ('push','void'))::int AS push,
      COALESCE((SELECT SUM(amount) FROM bankroll_ledger x WHERE x.user_id=u.user_id AND x.season=$1 AND x.kind='adjust'),0)::float AS adjusted
    FROM app_users u`, [L.season]);
  const R = Object.fromEntries(rows.map((r) => [r.user_id, r]));
  return L.active.map((u) => {
    const r = R[u]; const joined = !!r && (r.cash !== 0 || r.in_play !== 0 || r.won + r.lost + r.push > 0);
    const cash = joined ? money(r.cash) : s.grant, inPlay = joined ? money(r.in_play) : 0;
    return { user_id: u, team: L.teams[u]?.team || '?', joined, cash, in_play: inPlay, bankroll: money(cash + inPlay),
      profit: money(cash + inPlay - s.grant - (joined ? r.adjusted : 0)), record: joined ? `${r.won}-${r.lost}${r.push ? '-' + r.push : ''}` : '0-0' };
  }).sort((a, b) => b.bankroll - a.bankroll || b.profit - a.profit).map((x, i) => ({ rank: i + 1, ...x }));
}

export async function feed(limit = 40) {
  const L = await sl.league();
  return betsWhere("b.season=$1 AND b.status <> 'cancelled'", [L.season], Math.min(100, Number(limit) || 40));
}

// ---------- settlement ----------
// Grade one bet from its legs (used after settlement and after voids).
async function gradeOne(betId, c = null) {
  const run = (sql, p) => (c ? c.query(sql, p) : pool.query(sql, p));
  const s = await settings();
  const { rows: [b] } = await run('SELECT * FROM bets WHERE id=$1', [betId]);
  if (!b || b.status !== 'open') return;
  const { rows: legs } = await run('SELECT * FROM bet_legs WHERE bet_id=$1', [betId]);
  const lostLeg = legs.some((l) => l.result === 'lost');
  if (!lostLeg && legs.some((l) => l.result === 'open')) return; // still waiting on a game
  const g = gradeBet(Number(b.stake), legs, b.kind === 'parlay' ? s.parlay_max_payout : Infinity);
  await run('UPDATE bets SET status=$2, payout=$3, settled_at=now() WHERE id=$1', [betId, g.status, g.payout]);
  if (g.payout > 0) await run('INSERT INTO bankroll_ledger(user_id, season, amount, kind, bet_id, note) VALUES ($1,$2,$3,$4,$5,$6)',
    [b.user_id, b.season, g.payout, g.status === 'won' ? 'payout' : 'refund', betId, `${g.status === 'won' ? 'Won' : g.status === 'void' ? 'Void' : 'Push'} · bet #${betId}`]);
}

export async function settleWeek(season, week, { force = false, by = null } = {}) {
  const [bw] = await q('SELECT * FROM book_weeks WHERE season=$1 AND week=$2', [season, week]);
  if (!bw) throw new BookError(`No Book for ${season} Week ${week}`);
  if (bw.settled_at) throw new BookError(`Week ${week} is already settled`);
  if (!force && (!bw.settle_at || new Date(bw.settle_at) > now())) throw new BookError(`Week ${week} settles ${bw.settle_at ? fmtPT(bw.settle_at) : 'after its games'}`);
  const L = await sl.league({ fresh: true });
  if (!force && L.lastScored < week && now() - new Date(bw.settle_at) < 24 * 60 * MIN) throw new BookError(`Sleeper hasn't finalized Week ${week} yet`);
  const pts = await sl.pointsFor(L, week, 0);
  const lines = await q("SELECT * FROM lines WHERE season=$1 AND week=$2 AND status='open'", [season, week]);
  for (const l of lines) if (!(pts[l.roster_a] > 0) || !(pts[l.roster_b] > 0)) throw new BookError(`Missing final score for ${l.id}; not settling`);
  let graded = 0;
  await tx(async (c) => {
    for (const l of lines) {
      const fa = pts[l.roster_a], fb = pts[l.roster_b];
      await c.query("UPDATE lines SET status='final', final_a=$2, final_b=$3, locked=true, updated_at=now() WHERE id=$1", [l.id, fa, fb]);
      const { rows: legs } = await c.query("SELECT * FROM bet_legs WHERE line_id=$1 AND result='open'", [l.id]);
      for (const g of legs) await c.query('UPDATE bet_legs SET result=$2 WHERE id=$1', [g.id, gradeLeg(g, fa, fb)]);
    }
    const { rows: bets } = await c.query("SELECT id FROM bets WHERE season=$1 AND week=$2 AND status='open'", [season, week]);
    for (const b of bets) { await gradeOne(b.id, c); graded++; }
    await c.query('UPDATE book_weeks SET settled_at=now() WHERE season=$1 AND week=$2', [season, week]);
  });
  await log('settle', { season, week, lines: lines.length, bets: graded, force }, by);
  return { season, week, lines: lines.length, bets: graded };
}

// ---------- the clock job (every 10 minutes) ----------
export async function tick() {
  if (!pool) return { skipped: 'no database' };
  if (!ready) await initBook();
  const out = { at: now().toISOString(), posted: [], settled: [], errors: [] };
  const s = await settings();
  const L = await sl.league();
  // 1) Post lines Tuesday 6 AM for the coming week.
  if (L.seasonType === 'regular' && L.nflSeason === L.season) {
    for (const w of [L.nflWeek, L.nflWeek + 1]) {
      if (w < s.start_week || w < 1 || w >= L.P) continue;
      const have = await q('SELECT 1 FROM book_weeks WHERE season=$1 AND week=$2', [L.season, w]);
      if (have.length) continue;
      try {
        const k = await kickoffs(L.season, w);
        if (now() >= postTime(k) && now() < k.last) { await postLines(w); out.posted.push(w); }
      } catch (e) { out.errors.push(`post wk ${w}: ${e.message}`); }
    }
  }
  // 2) Settle any week past its Wednesday 3 AM.
  const due = await q('SELECT season, week FROM book_weeks WHERE settled_at IS NULL AND settle_at <= $1 ORDER BY week', [now()]);
  for (const d of due) {
    try { await settleWeek(d.season, d.week); out.settled.push(d.week); }
    catch (e) { out.errors.push(`settle wk ${d.week}: ${e.message}`); }
  }
  // 3) Keep lock flags current for open weeks.
  const open = await q('SELECT season, week FROM book_weeks WHERE settled_at IS NULL');
  for (const o of open) await refreshLocks(o.season, o.week).catch((e) => out.errors.push(`locks wk ${o.week}: ${e.message}`));
  if (out.posted.length || out.settled.length || out.errors.length) await log('tick', out);
  return out;
}

export function startBookJobs() {
  const run = () => tick().catch((e) => console.error('[book] tick failed:', e.message));
  setTimeout(run, 20 * 1000);
  setInterval(run, 10 * MIN);
}

export async function status() {
  const s = await settings();
  const L = await sl.league();
  const w = await currentWeek();
  let next = null;
  if (L.seasonType === 'regular') {
    const nw = Math.max(s.start_week, w && w.season === L.season ? w.week + 1 : L.nflWeek);
    if (nw < L.P) { try { const k = await kickoffs(L.season, nw); next = { week: nw, posts_at: postTime(k), posts_label: fmtPT(postTime(k)) }; } catch { next = { week: nw }; } }
  }
  return { ready, season: L.season, nfl_week: L.nflWeek, open_week: w && w.season === L.season ? w.week : null, next, settings: s, commish: COMMISH_USER_ID };
}

export async function recentLog(limit = 50) { return q('SELECT * FROM book_log ORDER BY id DESC LIMIT $1', [limit]); }
