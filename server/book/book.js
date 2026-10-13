// The Sportsbook (Mahomie Bucks, play money): logins, bankrolls, frozen lines, bets, locks and settlement.
// House rules live in BIBLE.md §7. 
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { COMMISH_USER_ID } from '../config.js';
import { priceWeek, legTerms, gradeLeg, gradeBet, betOdds, money, livePrice, worseThan, swing, propPrice, gradeProp, priceSpecials, gradeSpecial, SPECIAL_MARKETS } from './engine.js';
import { kickoffs, postTime, settleTime, fmtPT } from './kickoffs.js';
import * as sl from './data.js';
import { sleeper } from '../sleeper/client.js';
import { getHub } from '../hub/cache.js';
import { HOLD, americanWide } from './engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIN = 60 * 1000;

// Clock. BOOK_FAKE_NOW lets local tests pretend it's a given moment; never set it on Railway.
export const now = () => (process.env.BOOK_FAKE_NOW ? new Date(process.env.BOOK_FAKE_NOW) : new Date());

export class BookError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

// ---------- database plumbing ----------
let ready = false;
let initializing = null;
export const isReady = () => ready;

export async function initBook() {
  if (!pool) return false;
  if (ready) return true;
  if (!initializing) initializing = (async () => {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    ready = true;
    return true;
  })().finally(() => { initializing = null; });
  return initializing;
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
export const DEFAULTS = { start_week: 6, grant: 1000, min_bet: 10, max_bet: 250, parlay_min_legs: 2, parlay_max_legs: 4, parlay_max_payout: 10000, futures_cap: 250 };
export async function settings(c = pool) {
  const { rows } = await c.query('SELECT key, value FROM book_settings');
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

export async function login(userId, pin, ip = '?', invite = '') {
  if (!/^\d{4}$/.test(String(pin || ''))) throw new BookError('PIN must be 4 digits');
  const t = Date.now(); const recent = (ipTries.get(ip) || []).filter((x) => t - x < 15 * MIN);
  if (recent.length >= 30) throw new BookError('Too many tries from this phone. Wait 15 minutes.', 429);
  recent.push(t); ipTries.set(ip, recent);

  const L = await sl.league();
  if (!L.active.includes(userId)) throw new BookError('That team is not in the league this season', 404);
  const result = await tx(async (c) => {
    const run = async (sql, p) => (await c.query(sql, p)).rows;
    await run('INSERT INTO app_users(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    const [u] = await run('SELECT * FROM app_users WHERE user_id = $1 FOR UPDATE', [userId]);
    if (u.locked_until && new Date(u.locked_until) > now()) throw new BookError(`Too many wrong PINs. Try again after ${fmtPT(u.locked_until)}.`, 429);
    let created = false;
    if (!u.pin_hash) {
      if (!u.pin_invite_hash || !u.pin_invite_expires || new Date(u.pin_invite_expires) <= now() ||
          !crypto.timingSafeEqual(Buffer.from(sha(String(invite).trim()), 'hex'), Buffer.from(u.pin_invite_hash, 'hex'))) {
        throw new BookError('Ask the commish for a valid setup code before choosing a PIN.', 403);
      }
      const salt = crypto.randomBytes(16).toString('hex');
      await run('UPDATE app_users SET pin_hash=$2, pin_salt=$3, pin_set_at=now(), failed_tries=0, locked_until=NULL, pin_invite_hash=NULL, pin_invite_expires=NULL WHERE user_id=$1', [userId, hashPin(pin, salt), salt]);
      created = true;
    } else {
      const ok = crypto.timingSafeEqual(Buffer.from(hashPin(pin, u.pin_salt), 'hex'), Buffer.from(u.pin_hash, 'hex'));
      if (!ok) {
        const tries = u.failed_tries + 1;
        await run('UPDATE app_users SET failed_tries=$2, locked_until=$3 WHERE user_id=$1', [userId, tries >= 5 ? 0 : tries, tries >= 5 ? new Date(now().getTime() + 15 * MIN) : null]);
        // Commit failed-attempt accounting before returning the authentication error.
        return { error: new BookError(tries >= 5 ? 'Wrong PIN 5 times. Locked for 15 minutes.' : `Wrong PIN (${5 - tries} ${5 - tries === 1 ? 'try' : 'tries'} left)`, 401) };
      }
      await run('UPDATE app_users SET failed_tries=0, locked_until=NULL WHERE user_id=$1', [userId]);
    }
    const token = crypto.randomBytes(32).toString('base64url');
    await run('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [sha(token), userId, new Date(now().getTime() + SESSION_DAYS * 24 * 60 * MIN)]);
    await ensureGrant(userId, L.season, c);
    return { token, user_id: userId, created };
  });
  if (result.error) throw result.error;
  if (result.created) await log('pin_set', { user: userId });
  return result;
}

export async function userFromToken(token) {
  if (!token || !pool || !ready) return null;
  const [s] = await q('UPDATE sessions SET last_seen=now() WHERE token_hash=$1 AND expires_at > now() RETURNING user_id', [sha(token)]);
  return s ? s.user_id : null;
}
export async function logout(token) { if (token) await q('DELETE FROM sessions WHERE token_hash=$1', [sha(token)]); }

export async function resetPin(userId, by) {
  const L = await sl.league();
  if (!L.active.includes(userId)) throw new BookError('That team is not in the league this season', 404);
  const invite = crypto.randomBytes(24).toString('base64url');
  const expires = new Date(now().getTime() + 24 * 60 * MIN);
  await tx(async (c) => {
    await c.query('INSERT INTO app_users(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    await c.query('SELECT 1 FROM app_users WHERE user_id=$1 FOR UPDATE', [userId]);
    await c.query('UPDATE app_users SET pin_hash=NULL, pin_salt=NULL, failed_tries=0, locked_until=NULL, pin_invite_hash=$2, pin_invite_expires=$3 WHERE user_id=$1', [userId, sha(invite), expires]);
    await c.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
  });
  await log('pin_reset', { user: userId }, by);
  return { user_id: userId, invite, expires_at: expires.toISOString() };
}

// ---------- bankroll ----------
async function ensureGrant(userId, season, c = null) {
  const s = await settings(c || pool);
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
  const before = await balanceOf(userId, L.season);
  if (a < 0 && before + a < -0.001) throw new BookError(`They only have ${before} Bucks available (you can't take them below 0)`);
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
  // Sleeper's projections for each lineup as currently set (blended 60/40 with league history).
  const sp = {};
  try { const ws = await sl.weekState(L, week); for (const [rid, x] of Object.entries(ws.rosters)) if (x.proj_pre > 0 && L.owner[rid]) sp[L.owner[rid]] = x.proj_pre; } catch { /* history only */ }
  const priced = priceWeek(week, pairs, cur, prev, sp);
  let k = null; try { k = await kickoffs(season, week); } catch { /* lock times filled in later */ }
  await tx(async (c) => {
    if (have.length) {
      await c.query('DELETE FROM lines WHERE season=$1 AND week=$2', [season, week]);
      await c.query('DELETE FROM book_weeks WHERE season=$1 AND week=$2', [season, week]);
    }
    await c.query('INSERT INTO book_weeks(season, week, first_kick, last_kick, settle_at) VALUES ($1,$2,$3,$4,$5)',
      [season, week, k?.first || null, k?.last || null, k ? settleTime(k) : null]);
    for (const m of priced) {
      await c.query(`INSERT INTO lines(id, season, week, matchup_id, team_a, team_b, roster_a, roster_b, proj_a, proj_b, spread, total, ml_a, ml_b, wp_a, sd_a, sd_b)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [`${season}-w${week}-m${m.matchup_id}`, season, week, m.matchup_id, m.a, m.b, m.roster_a, m.roster_b, m.proj_a, m.proj_b, m.spread, m.total, m.ml_a, m.ml_b, m.wp_a, m.sd_a, m.sd_b]);
    }
    await insertSpecials(c, season, week, priced, k?.first || null);
  });
  await postFutures(season, week, k?.first || null).catch((e) => console.error('[book] futures', e.message));
  await log('post_lines', { season, week, lines: priced.length, force, sleeper_projections: priced.filter((m) => m.blended).length }, by);
  await refreshLocks(season, week, { fresh: true }).catch(() => {});
  return linesFor(week);
}

// ---------- weekly specials (On Fire, Ice Cold, low-score over/under) ----------
const spId = (season, week) => `${season}-w${week}-sp`;
async function insertSpecials(c, season, week, priced, firstKick) {
  const teams = [];
  for (const m of priced) { teams.push({ uid: m.a, proj: Number(m.proj_a), sd: Number(m.sd_a) || 24 }); teams.push({ uid: m.b, proj: Number(m.proj_b), sd: Number(m.sd_b) || 24 }); }
  if (teams.length < 4) return;
  const sp = priceSpecials(teams, Number(season) * 100 + Number(week));
  const id = spId(season, week);
  await c.query(`INSERT INTO lines(id, season, week, matchup_id, team_a, team_b, roster_a, roster_b, proj_a, proj_b, spread, total, ml_a, ml_b, wp_a, lock_at, note)
                 VALUES ($1,$2,$3,0,'*','*',0,0,0,0,0,$4,100,100,0.5,$5,'Weekly specials') ON CONFLICT (id) DO NOTHING`, [id, season, week, sp.lowscore.point, firstKick]);
  for (const mk of ['onfire', 'icecold']) for (const x of sp[mk]) await c.query('INSERT INTO book_specials(line_id, market, pick, odds, prob) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [id, mk, x.pick, x.odds, x.prob]);
  for (const side of ['over', 'under']) await c.query('INSERT INTO book_specials(line_id, market, pick, odds, point) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [id, 'lowscore', side, sp.lowscore[side], sp.lowscore.point]);
}
// Weeks posted before specials existed get a board the first time someone looks, if nothing has kicked off yet.
async function ensureSpecials(season, week) {
  const [have] = await q('SELECT 1 FROM lines WHERE id=$1', [spId(season, week)]);
  if (have) return;
  const rows = await q('SELECT * FROM lines WHERE season=$1 AND week=$2 AND matchup_id > 0', [season, week]);
  if (!rows.length || rows.some(isStarted)) return;
  const [bw] = await q('SELECT first_kick FROM book_weeks WHERE season=$1 AND week=$2', [season, week]);
  const priced = rows.map((r) => ({ a: r.team_a, b: r.team_b, proj_a: r.proj_a, proj_b: r.proj_b, sd_a: r.sd_a, sd_b: r.sd_b }));
  await tx((c) => insertSpecials(c, season, week, priced, bw?.first_kick || null));
}
async function specialsFor(season, week, L) {
  const [row] = await q('SELECT * FROM lines WHERE id=$1', [spId(season, week)]);
  if (!row) return null;
  const px = await q('SELECT market, pick, odds, point::float, prob::float FROM book_specials WHERE line_id=$1', [row.id]);
  const handle = await q(`SELECT g.market, COUNT(*)::int n FROM bet_legs g JOIN bets b ON b.id=g.bet_id WHERE g.line_id=$1 AND b.status <> 'cancelled' GROUP BY g.market`, [row.id]);
  const board = (mk) => px.filter((x) => x.market === mk).sort((a, b) => b.prob - a.prob).map((x) => ({ pick: x.pick, team: L.teams[x.pick]?.team || '?', odds: x.odds, prob: x.prob }));
  const lo = px.filter((x) => x.market === 'lowscore');
  return { id: row.id, lock_at: row.lock_at, started: !!isStarted(row), status: row.status, note: row.status === 'void' ? row.note : null,
    onfire: board('onfire'), icecold: board('icecold'),
    lowscore: lo.length ? { point: lo[0].point, over: lo.find((x) => x.pick === 'over')?.odds ?? -110, under: lo.find((x) => x.pick === 'under')?.odds ?? -110 } : null,
    result: row.status === 'final' ? { top: Number(row.final_a), low: Number(row.final_b) } : null,
    bets: handle.reduce((a, h) => a + h.n, 0) };
}

// ---------- season futures (v2.3) ----------
// Repriced every Tuesday with the lines, from the app's 5,000-season simulation (/api/hub odds).
// Straight bets only, 250 Bucks per person per season (futures_cap), close at the week's first kickoff,
// graded when the regular season ends (playoffs, #1 seed, Points King, wins) or the title game is final (Champion, Sacko).
export const FUTURE_MARKETS = ['champ', 'sacko', 'playoffs', 'seed1', 'pking', 'wins'];
const fuId = (season, week) => `${season}-w${week}-fu`;
const fuTried = new Map(); // "season|week" -> last attempt (so a failed post isn't retried on every page load)
async function postFutures(season, week, firstKick) {
  const [have] = await q('SELECT 1 FROM lines WHERE id=$1', [fuId(season, week)]);
  if (have) return;
  if (firstKick && new Date(firstKick) <= now()) return; // too late for this week's board
  const key = `${season}|${week}`; if (Date.now() - (fuTried.get(key) || 0) < 30 * MIN) return; fuTried.set(key, Date.now());
  const hub = await getHub({ fresh: true });
  const list = hub?.odds?.list || [];
  if (String(hub?.league?.season) !== String(season) || list.length < 4) return;
  const rows = [];
  // Off the board when nearly impossible (<0.3%) or when the price would be shorter than -1000 (same rule as moneylines).
  const add = (market, pick, p, point = null) => { if (p >= 0.003 && p * (1 + HOLD) <= 0.909) rows.push([market, pick, americanWide(p * (1 + HOLD)), point, Math.round(p * 10000) / 10000]); };
  for (const t of list) {
    add('champ', t.uid, t.champ ?? 0); add('sacko', t.uid, t.sacko ?? 0); add('seed1', t.uid, t.top ?? 0); add('pking', t.uid, t.pking ?? 0);
    add('playoffs', `yes:${t.uid}`, t.playoff ?? 0); add('playoffs', `no:${t.uid}`, 1 - (t.playoff ?? 0));
    if (t.wins_ou) { add('wins', `over:${t.uid}`, t.wins_ou.over, t.wins_ou.line); add('wins', `under:${t.uid}`, 1 - t.wins_ou.over, t.wins_ou.line); }
  }
  if (!rows.length) return;
  const id = fuId(season, week);
  await tx(async (c) => {
    await c.query(`INSERT INTO lines(id, season, week, matchup_id, team_a, team_b, roster_a, roster_b, proj_a, proj_b, spread, total, ml_a, ml_b, wp_a, lock_at, note)
                   VALUES ($1,$2,$3,-1,'*','*',0,0,0,0,0,0,100,100,0.5,$4,'Season futures') ON CONFLICT (id) DO NOTHING`, [id, season, week, firstKick]);
    for (const r of rows) await c.query('INSERT INTO book_specials(line_id, market, pick, odds, point, prob) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [id, ...r]);
  });
  await log('post_futures', { season, week, prices: rows.length });
}
async function futuresUsed(userId, season, c = pool) {
  const { rows: [r] } = await c.query(`SELECT COALESCE(SUM(b.stake),0)::float AS used FROM bets b WHERE b.user_id=$1 AND b.season=$2 AND b.status <> 'cancelled'
                       AND EXISTS (SELECT 1 FROM bet_legs g WHERE g.bet_id=b.id AND g.market = ANY($3))`, [userId, season, FUTURE_MARKETS]);
  return r.used;
}
async function futuresFor(season, week, L) {
  const [row] = await q('SELECT * FROM lines WHERE id=$1', [fuId(season, week)]);
  if (!row) return null;
  const px = await q('SELECT market, pick, odds, point::float, prob::float FROM book_specials WHERE line_id=$1 ORDER BY prob DESC', [row.id]);
  const s = await settings();
  const board = {};
  for (const x of px) {
    const [side, uid] = x.pick.includes(':') ? x.pick.split(':') : [null, x.pick];
    (board[x.market] ||= []).push({ pick: x.pick, side, uid, team: L.teams[uid]?.team || '?', odds: x.odds, prob: x.prob, point: x.point });
  }
  return { id: row.id, lock_at: row.lock_at, started: !!isStarted(row), status: row.status, cap: s.futures_cap, board };
}
const outcomeOf = (pick) => (pick.includes(':') ? pick.split(':') : [null, pick]);
// Grade open futures once Sleeper has the answers.
export async function settleFutures() {
  const L = await sl.league();
  // Include already-graded legs of open bets so interrupted older settlements can resume.
  const legs = await q(`SELECT g.*, l.season FROM bet_legs g JOIN lines l ON l.id=g.line_id JOIN bets b ON b.id=g.bet_id
                       WHERE l.matchup_id=-1 AND l.season=$1 AND b.status='open' ORDER BY g.bet_id, g.id`, [L.season]);
  if (!legs.length) return { graded: 0 };
  const lg = await sleeper(`/league/${L.leagueId}`, { maxAgeMs: 10 * MIN });
  const median = !!lg.settings?.league_average_match, playoffN = Number(lg.settings?.playoff_teams) || 6;
  const res = {};
  if (L.lastScored >= L.P - 1) {
    // Final regular-season standings: wins (head to head + median game), then points.
    const W = {}, PF = {};
    for (let w = 1; w < L.P; w++) {
      const ms = await sl.matchups(L.leagueId, w, 24 * 60 * MIN);
      const pts = (m) => Number(m.custom_points ?? m.points ?? 0);
      const sc = ms.map(pts).sort((a, b) => a - b), n = sc.length, med = n ? (sc[(n - 1) >> 1] + sc[n >> 1]) / 2 : 0;
      const by = {}; for (const m of ms) { const u = L.owner[m.roster_id]; if (!u) continue; PF[u] = (PF[u] || 0) + pts(m); W[u] = W[u] || 0; if (median && pts(m) > med) W[u]++; if (m.matchup_id != null) (by[m.matchup_id] ||= []).push(m); }
      for (const pair of Object.values(by)) if (pair.length === 2) { const [a, b] = pair; const ua = L.owner[a.roster_id], ub = L.owner[b.roster_id]; if (pts(a) > pts(b)) W[ua]++; else if (pts(b) > pts(a)) W[ub]++; }
    }
    const order = Object.keys(W).sort((a, b) => W[b] - W[a] || PF[b] - PF[a]);
    const topPF = Math.max(...Object.values(PF)), kings = Object.keys(PF).filter((u) => Math.abs(PF[u] - topPF) < 1e-9);
    res.playoffs = (u) => order.indexOf(u) < playoffN;
    res.seed1 = order[0]; res.kings = kings; res.W = W;
  }
  try {
    const wb = await sleeper(`/league/${L.leagueId}/winners_bracket`, { maxAgeMs: 30 * MIN });
    const lb = await sleeper(`/league/${L.leagueId}/losers_bracket`, { maxAgeMs: 30 * MIN });
    const f = (wb || []).find((m) => m.p === 1 && m.w != null), t = (lb || []).find((m) => m.p === 1 && m.w != null);
    if (f) res.champ = L.owner[f.w]; if (t) res.sacko = L.owner[t.w];
  } catch { /* brackets not set yet */ }
  const results = new Map();
  for (const g of legs) {
    const [side, u] = outcomeOf(g.pick); let r = null;
    if (g.market === 'champ' && res.champ) r = res.champ === u ? 'won' : 'lost';
    else if (g.market === 'sacko' && res.sacko) r = res.sacko === u ? 'won' : 'lost';
    else if (g.market === 'playoffs' && res.playoffs) r = res.playoffs(u) === (side === 'yes') ? 'won' : 'lost';
    else if (g.market === 'seed1' && res.seed1) r = res.seed1 === u ? 'won' : 'lost';
    else if (g.market === 'pking' && res.kings) r = !res.kings.includes(u) ? 'lost' : res.kings.length > 1 ? 'push' : 'won';
    else if (g.market === 'wins' && res.W) { const x = (res.W[u] || 0) - Number(g.point); r = Math.abs(x) < 1e-9 ? 'push' : (side === 'over' ? x > 0 : x < 0) ? 'won' : 'lost'; }
    if (!r) continue;
    results.set(g.id, r);
  }
  const touched = new Set();
  for (const betId of new Set(legs.map((g) => g.bet_id))) {
    await tx(async (c) => {
      const { rows: [bet] } = await c.query('SELECT * FROM bets WHERE id=$1 FOR UPDATE', [betId]);
      if (!bet || bet.status !== 'open') return;
      for (const g of legs.filter((x) => x.bet_id === betId)) {
        if (results.has(g.id)) await c.query("UPDATE bet_legs SET result=$2 WHERE id=$1 AND result='open'", [g.id, results.get(g.id)]);
      }
      if (await gradeOne(betId, c)) touched.add(betId);
    });
  }
  if (touched.size) await log('settle_futures', { graded: touched.size, champ: res.champ || null, sacko: res.sacko || null });
  return { graded: touched.size };
}

// Live state of a week: when each matchup started (its first starter's kickoff),
// points so far and how much of each lineup is left. Nothing locks: once a game
// starts, betting continues at live odds (Jayson, 2026-10-09).
// `locked` in the database now means "started"; once started it stays started.
const stateCache = new Map(); // "season|week" -> { at, data }
export async function liveWeek(season, week, { fresh = false } = {}) {
  const key = `${season}|${week}`; const hit = stateCache.get(key);
  if (!fresh && hit && Date.now() - hit.at < 30 * 1000) return hit.data;
  const L = await sl.league();
  if (L.season !== season) return null;
  const st = await sl.weekState(L, week, fresh ? 20 * 1000 : 60 * 1000);
  const t = now();
  for (const [mid, at] of Object.entries(st.starts)) {
    await q(`UPDATE lines SET lock_at = CASE WHEN locked THEN lock_at ELSE $3 END, locked = locked OR $4, updated_at = now()
             WHERE season=$1 AND week=$2 AND matchup_id=$5`, [season, week, at, at <= t, Number(mid)]);
  }
  await q('UPDATE book_weeks SET first_kick=$3, last_kick=$4, settle_at=COALESCE(settle_at,$5) WHERE season=$1 AND week=$2 AND settled_at IS NULL',
    [season, week, st.k.first, st.k.last, settleTime(st.k)]);
  if (st.k.first) await q(`UPDATE lines SET lock_at = CASE WHEN locked THEN lock_at ELSE $3 END, locked = locked OR $4, updated_at = now()
                           WHERE season=$1 AND week=$2 AND matchup_id <= 0`, [season, week, st.k.first, new Date(st.k.first) <= t]);
  // Lines posted before live betting existed have no swing saved; fill it in once.
  const noSd = await q('SELECT id, team_a, team_b FROM lines WHERE season=$1 AND week=$2 AND sd_a IS NULL', [season, week]);
  if (noSd.length) {
    const { cur, prev } = await sl.scoresBefore(L, week);
    for (const l of noSd) await q('UPDATE lines SET sd_a=$2, sd_b=$3 WHERE id=$1', [l.id, swing(cur[l.team_a] || [], prev[l.team_a] || []), swing(cur[l.team_b] || [], prev[l.team_b] || [])]);
  }
  stateCache.set(key, { at: Date.now(), data: st });
  return st;
}
export const _resetCaches = () => stateCache.clear(); // tests only
export const refreshLocks = (season, week, opt) => liveWeek(season, week, opt);

const isStarted = (line) => line.locked || (line.lock_at && new Date(line.lock_at) <= now());

// Player props for one matchup: every starting QB/RB/WR/TE in either lineup.
function propsFor(row, st, L) {
  const out = [];
  for (const [side, rid, uid] of [['a', row.roster_a, row.team_a], ['b', row.roster_b, row.team_b]]) {
    for (const p of st?.rosters?.[rid]?.players || []) {
      if (!['QB', 'RB', 'WR', 'TE'].includes(p.pos)) continue;
      const pr = propPrice(p); if (!pr) continue;
      out.push({ pid: p.pid, name: p.name, pos: p.pos, nfl: p.nfl, side, owner: uid, pts: p.pts, proj: p.proj, kick: p.kick, ...pr });
    }
  }
  return out.sort((x, y) => y.exp - x.exp);
}

// The price right now: the frozen line before kickoff, live odds after.
// Returns { ...line numbers, started, finished, live, rem_a, rem_b }.
function priceNow(row, st) {
  const base = { spread: Number(row.spread), total: Number(row.total), ml_a: row.ml_a, ml_b: row.ml_b, wp_a: Number(row.wp_a),
    spread_price: row.spread_price, total_price: row.total_price, started: !!isStarted(row), finished: row.status !== 'open', live: false };
  if (row.status !== 'open' || !base.started) return base;
  const A = st?.rosters?.[row.roster_a], B = st?.rosters?.[row.roster_b];
  if (!A || !B) return { ...base, live: true, unpriced: true };
  const both = A.proj_live != null && B.proj_live != null;
  const lp = livePrice(row, { pts_a: A.pts, pts_b: B.pts, rem_a: A.rem, rem_b: B.rem, exp_a: both ? A.proj_live : null, exp_b: both ? B.proj_live : null });
  if (!lp) return { ...base, live: true, finished: true, rem_a: 0, rem_b: 0 };
  return { ...base, ...lp, live: true };
}

export async function currentWeek() {
  const [w] = await q('SELECT season, week FROM book_weeks ORDER BY season DESC, week DESC LIMIT 1');
  return w || null;
}

export async function linesFor(week, { season = null } = {}) {
  const L = await sl.league();
  season = season || L.season;
  if (!week) { const w = await currentWeek(); if (!w) return { season, week: null, lines: [] }; week = w.week; season = w.season; }
  const [bw] = await q('SELECT * FROM book_weeks WHERE season=$1 AND week=$2', [season, week]);
  const st = bw && !bw.settled_at ? await liveWeek(season, week).catch(() => null) : null;
  if (bw && !bw.settled_at) await ensureSpecials(season, week).catch((e) => console.error('[book] specials', e.message));
  const rows = await q('SELECT * FROM lines WHERE season=$1 AND week=$2 AND matchup_id > 0 ORDER BY matchup_id', [season, week]);
  const specials = await specialsFor(season, week, L).catch(() => null);
  if (bw && !bw.settled_at && season === L.season) await postFutures(season, week, bw.first_kick).catch((e) => console.error('[book] futures', e.message));
  const futures = await futuresFor(season, week, L).catch(() => null);
  const live = Object.fromEntries(Object.entries(st?.rosters || {}).map(([r, x]) => [r, x.pts]));
  const handle = await q(`SELECT l.line_id, COUNT(*)::int AS n, COALESCE(SUM(b.stake),0)::float AS bucks FROM bet_legs l JOIN bets b ON b.id=l.bet_id
                          WHERE b.season=$1 AND b.week=$2 AND b.status <> 'cancelled' GROUP BY l.line_id`, [season, week]);
  const H = Object.fromEntries(handle.map((h) => [h.line_id, h]));
  return {
    season, week: Number(week),
    posted_at: bw?.posted_at || null, first_kick: bw?.first_kick || null, settle_at: bw?.settle_at || null, settled_at: bw?.settled_at || null, specials, futures,
    lines: rows.map((r) => { const p = priceNow(r, st); return {
      id: r.id, matchup_id: r.matchup_id, a: r.team_a, b: r.team_b,
      team_a: L.teams[r.team_a]?.team || '?', team_b: L.teams[r.team_b]?.team || '?',
      proj_a: Number(r.proj_a), proj_b: Number(r.proj_b), spread: p.spread, total: p.total,
      ml_a: p.ml_a, ml_b: p.ml_b, spread_price: r.spread_price, total_price: r.total_price, wp_a: p.wp_a,
      open: { spread: Number(r.spread), total: Number(r.total), ml_a: r.ml_a, ml_b: r.ml_b },
      live: p.live, finished: p.finished, unpriced: !!p.unpriced, exp_a: p.exp_a ?? null, exp_b: p.exp_b ?? null, proj_source: p.source || null,
      now_a: st?.rosters?.[r.roster_a]?.proj_live ?? null, now_b: st?.rosters?.[r.roster_b]?.proj_live ?? null,
      left: p.live && p.rem_a != null ? Math.round(50 * (p.rem_a + p.rem_b)) : null,
      out_a: st?.rosters?.[r.roster_a]?.out || [], out_b: st?.rosters?.[r.roster_b]?.out || [], rem_a: p.rem_a ?? null, rem_b: p.rem_b ?? null,
      lock_at: r.lock_at, started: p.started, locked: p.started, status: r.status, note: r.note,
      score_a: r.final_a != null ? Number(r.final_a) : live[r.roster_a] ?? null,
      score_b: r.final_b != null ? Number(r.final_b) : live[r.roster_b] ?? null,
      bets: H[r.id]?.n || 0,
      props: r.status === 'open' && st ? propsFor(r, st, L) : []
    }; })
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
      const { rows: bets } = await c.query("SELECT b.id FROM bets b WHERE b.status='open' AND EXISTS (SELECT 1 FROM bet_legs g WHERE g.bet_id=b.id AND g.line_id=$1) ORDER BY b.id FOR UPDATE", [id]);
      await c.query("UPDATE bet_legs SET result='void' WHERE line_id=$1 AND result='open'", [id]);
      // The void and every resulting refund commit together, or all roll back.
      for (const b of bets) await gradeOne(b.id, c);
    });
    await log('void_line', { id, note }, by);
    return;
  }
  if (isStarted(line)) throw new BookError('That game has started, so live odds run on their own now. You can only void it.');
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
  if (leg.market === 'prop') return `${leg.player_name || 'Player'} ${leg.pick === 'over' ? 'over' : 'under'} ${Number(leg.point)} pts`;
  if (FUTURE_MARKETS.includes(leg.market)) {
    const [side, u] = outcomeOf(leg.pick);
    if (leg.market === 'champ') return `Champion: ${nm(u)}`;
    if (leg.market === 'sacko') return `Sacko: ${nm(u)}`;
    if (leg.market === 'seed1') return `#1 seed: ${nm(u)}`;
    if (leg.market === 'pking') return `Points King: ${nm(u)}`;
    if (leg.market === 'playoffs') return `${nm(u)} ${side === 'yes' ? 'makes' : 'misses'} the playoffs`;
    if (leg.market === 'wins') return `${nm(u)} ${side} ${Number(leg.point)} wins`;
  }
  if (leg.market === 'onfire') return `On Fire: ${nm(leg.pick)} top score`;
  if (leg.market === 'icecold') return `Ice Cold: ${nm(leg.pick)} lowest score`;
  if (leg.market === 'lowscore') return `Week's low score ${leg.pick === 'over' ? 'over' : 'under'} ${Number(leg.point)}`;
  if (leg.market === 'ml') return `${nm(leg.pick === 'a' ? line.team_a : line.team_b)} to win (${odds(leg.odds)})`;
  if (leg.market === 'spread') { const p = Number(leg.point); return `${nm(leg.pick === 'a' ? line.team_a : line.team_b)} ${p === 0 ? 'PK' : p > 0 ? '+' + p : p}`; }
  return `${leg.pick === 'over' ? 'Over' : 'Under'} ${Number(leg.point)} total`;
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
  if (new Set(ids).size !== ids.length) throw new BookError('A parlay can only use one pick per fantasy matchup');

  if (legsIn.some((l) => FUTURE_MARKETS.includes(l.market)) && parlay) throw new BookError('Futures are straight bets only');
  const lines = await q('SELECT * FROM lines WHERE id = ANY($1)', [ids]);
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  const weeks = new Set(lines.map((l) => `${l.season}|${l.week}`));
  if (lines.length !== ids.length) throw new BookError('That line is gone. Refresh and try again.');
  if (weeks.size > 1) throw new BookError('All picks must be from the same week');
  const { season, week } = lines[0];
  if (season !== L.season) throw new BookError('That season is over');
  let st = null;
  try { st = await liveWeek(season, week, { fresh: true }); } catch { throw new BookError("Can't load live scores right now. Try again in a minute.", 503); }

  const legs = [];
  for (const li of legsIn) {
    const [fresh] = await q('SELECT * FROM lines WHERE id=$1', [String(li.line_id)]);
    const vs = `${L.teams[fresh.team_a]?.team} vs ${L.teams[fresh.team_b]?.team}`;
    if (fresh.status !== 'open') throw new BookError('That game is off the board');
    if (FUTURE_MARKETS.includes(li.market) || fresh.matchup_id === -1) {
      if (fresh.matchup_id !== -1 || !FUTURE_MARKETS.includes(li.market)) throw new BookError('Unknown bet type');
      if (isStarted(fresh)) throw new BookError("Futures are closed until next Tuesday's new prices");
      const [px] = await q('SELECT odds, point FROM book_specials WHERE line_id=$1 AND market=$2 AND pick=$3', [fresh.id, li.market, String(li.pick)]);
      if (!px) throw new BookError('That future is off the board');
      const [side, u] = outcomeOf(String(li.pick));
      if (u === userId && (li.market === 'sacko' || (li.market === 'playoffs' && side === 'no') || (li.market === 'wins' && side === 'under'))) throw new BookError("You can't bet against yourself");
      const terms = { point: px.point != null ? Number(px.point) : null, odds: px.odds, live: false };
      if (worseThan(li.market === 'wins' ? 'total' : 'ml', side || 'over', { odds: li.odds, point: li.point }, terms)) throw new BookError('Odds moved. Check the new price and place it again.', 409);
      legs.push({ line: fresh, market: li.market, pick: String(li.pick), ...terms });
      continue;
    }
    if (SPECIAL_MARKETS.includes(li.market) || fresh.matchup_id === 0) {
      if (fresh.matchup_id !== 0 || !SPECIAL_MARKETS.includes(li.market)) throw new BookError('Unknown bet type');
      if (!fresh.lock_at) throw new BookError("Can't confirm kickoff times right now. Try again in a minute.", 503);
      if (isStarted(fresh)) throw new BookError('Specials closed at the first kickoff of the week');
      const [px] = await q('SELECT odds, point FROM book_specials WHERE line_id=$1 AND market=$2 AND pick=$3', [fresh.id, li.market, String(li.pick)]);
      if (!px) throw new BookError('That pick is off the board');
      if (li.market === 'icecold' && li.pick === userId) throw new BookError("You can't bet on yourself to be Ice Cold");
      const terms = { point: px.point != null ? Number(px.point) : null, odds: px.odds, live: false };
      if (worseThan(li.market === 'lowscore' ? 'total' : 'ml', li.pick, { odds: li.odds, point: li.point }, terms)) throw new BookError('Odds moved. Check the new price and place it again.', 409);
      legs.push({ line: fresh, market: li.market, pick: String(li.pick), ...terms });
      continue;
    }
    if (!fresh.lock_at) throw new BookError("Can't confirm kickoff times right now. Try again in a minute.", 503);
    if (li.market === 'prop') {
      if (li.pick !== 'over' && li.pick !== 'under') throw new BookError('Unknown bet type');
      const pr = propsFor(fresh, st, L).find((x) => x.pid === String(li.player_id || ''));
      if (!pr) throw new BookError("That player prop is off the board right now");
      const mine2 = pr.owner === userId;
      if (mine2 && li.pick === 'under') throw new BookError("You can't bet the under on your own player");
      const terms = { point: pr.line, odds: li.pick === 'over' ? pr.over : pr.under, live: pr.live, player_id: pr.pid, player_name: pr.name };
      if (worseThan('prop', li.pick, { odds: li.odds, point: li.point }, terms)) throw new BookError('Odds moved. Check the new price and place it again.', 409);
      legs.push({ line: fresh, market: 'prop', pick: li.pick, ...terms });
      continue;
    }
    const p = priceNow(fresh, st);
    if (p.finished) throw new BookError(`${vs} is over. Waiting on the final score.`);
    if (p.unpriced) throw new BookError(`Can't price ${vs} live right now. Try again in a minute.`, 503);
    const terms = legTerms({ ...fresh, ...p }, li.market, li.pick);
    if (!terms) throw new BookError('Unknown bet type');
    if (terms.off) throw new BookError(`The moneyline on ${vs} is off the board (it's too lopsided). Try the spread.`);
    if (worseThan(li.market, li.pick, { odds: li.odds, point: li.point }, terms)) throw new BookError('Odds moved. Check the new price and place it again.', 409);
    terms.live = p.live;
    const mine = fresh.team_a === userId ? 'a' : fresh.team_b === userId ? 'b' : null;
    if (mine) {
      if ((li.market === 'ml' || li.market === 'spread') && li.pick !== mine) throw new BookError("You can't bet against yourself");
      if (li.market === 'total' && li.pick === 'under') throw new BookError("You can't bet the under on your own game");
    }
    legs.push({ line: fresh, market: li.market, pick: li.pick, ...terms });
  }
  // A special on a team (On Fire / Ice Cold) can't share a parlay with that team's own game.
  for (const sp of legs.filter((l) => l.market === 'onfire' || l.market === 'icecold')) {
    if (legs.some((l) => l.line.matchup_id > 0 && (l.line.team_a === sp.pick || l.line.team_b === sp.pick)))
      throw new BookError(`${L.teams[sp.pick]?.team || 'That team'}'s special can't be in a parlay with its own game`);
  }
  const { dec, american: odds } = betOdds(legs);
  const toWin = money(Math.min(stake * dec, parlay ? s.parlay_max_payout : Infinity) - stake);
  const lockAt = new Date(Math.min(...legs.map((l) => new Date(l.line.lock_at).getTime())));

  const bet = await tx(async (c) => {
    await c.query('INSERT INTO app_users(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    await c.query('SELECT 1 FROM app_users WHERE user_id=$1 FOR UPDATE', [userId]); // one bet at a time per person
    if (legs.some((l) => FUTURE_MARKETS.includes(l.market))) {
      const used = await futuresUsed(userId, season, c);
      if (used + stake > s.futures_cap) throw new BookError(`Futures are capped at ${s.futures_cap} Bucks a season (you have ${money(Math.max(0, s.futures_cap - used))} left)`);
    }
    await ensureGrant(userId, season, c);
    const bal = await balanceOf(userId, season, c);
    if (stake > bal) throw new BookError(`Not enough Bucks (you have ${bal})`);
    const { rows: [b] } = await c.query(`INSERT INTO bets(user_id, season, week, kind, stake, dec_odds, odds, to_win, lock_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [userId, season, week, parlay ? 'parlay' : 'single', stake, dec, odds, toWin, lockAt]);
    for (const l of legs) await c.query('INSERT INTO bet_legs(bet_id, line_id, market, pick, point, odds, live, player_id, player_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [b.id, l.line.id, l.market, l.pick, l.point, l.odds, !!l.live, l.player_id || null, l.player_name || null]);
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
    if (legs.some(isStarted)) throw new BookError('Too late: a game in this bet has started (bets can be cancelled only before kickoff)');
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
      a: g.team_a, b: g.team_b, label: label(g, g, L.teams), locked: !!isStarted(g), started: !!isStarted(g), live: !!g.live
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
    balance: bal, in_play: money(open.reduce((x, b) => x + b.stake, 0)), bets, ledger, futures_used: await futuresUsed(userId, L.season)
  };
}

export async function leaderboard() {
  const L = await sl.league();
  const s = await settings();
  const rows = await q(`SELECT u.user_id,
      EXISTS (SELECT 1 FROM bankroll_ledger x WHERE x.user_id=u.user_id AND x.season=$1 AND x.kind='grant') AS joined,
      COALESCE((SELECT SUM(amount) FROM bankroll_ledger x WHERE x.user_id=u.user_id AND x.season=$1),0)::float AS cash,
      COALESCE((SELECT SUM(stake) FROM bets b WHERE b.user_id=u.user_id AND b.season=$1 AND b.status='open'),0)::float AS in_play,
      (SELECT COUNT(*) FROM bets b WHERE b.user_id=u.user_id AND b.season=$1 AND b.status='won')::int AS won,
      (SELECT COUNT(*) FROM bets b WHERE b.user_id=u.user_id AND b.season=$1 AND b.status='lost')::int AS lost,
      (SELECT COUNT(*) FROM bets b WHERE b.user_id=u.user_id AND b.season=$1 AND b.status IN ('push','void'))::int AS push,
      COALESCE((SELECT SUM(amount) FROM bankroll_ledger x WHERE x.user_id=u.user_id AND x.season=$1 AND x.kind='adjust'),0)::float AS adjusted
    FROM app_users u`, [L.season]);
  const R = Object.fromEntries(rows.map((r) => [r.user_id, r]));
  return L.active.map((u) => {
    const r = R[u]; const joined = !!r?.joined;
    const cash = joined ? money(r.cash) : s.grant, inPlay = joined ? money(r.in_play) : 0;
    return { user_id: u, team: L.teams[u]?.team || '?', joined, cash, in_play: inPlay, bankroll: money(cash + inPlay),
      profit: money(cash + inPlay - s.grant - (joined ? r.adjusted : 0)), record: joined ? `${r.won}-${r.lost}${r.push ? '-' + r.push : ''}` : '0-0' };
  }).sort((a, b) => b.bankroll - a.bankroll || b.profit - a.profit).map((x, i) => ({ rank: i + 1, ...x }));
}

// Best bettor of the week: profit on bets settled in a week (latest settled week by default).
export async function weekly(weekIn = null) {
  const L = await sl.league();
  let week = Number(weekIn) || null;
  if (!week) { const [w] = await q('SELECT week FROM book_weeks WHERE season=$1 AND settled_at IS NOT NULL ORDER BY week DESC LIMIT 1', [L.season]); week = w ? w.week : null; }
  if (!week) return { season: L.season, week: null, rows: [] };
  const rows = await q(`SELECT user_id, COUNT(*)::int AS bets, SUM(stake)::float AS risked,
      SUM(CASE WHEN status='won' THEN 1 ELSE 0 END)::int AS won, SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END)::int AS lost,
      SUM(COALESCE(payout,0) - stake)::float AS profit, MAX(CASE WHEN status='won' THEN payout - stake END)::float AS best
    FROM bets WHERE season=$1 AND week=$2 AND status NOT IN ('open','cancelled') GROUP BY user_id`, [L.season, week]);
  return { season: L.season, week, rows: rows.map((r) => ({ ...r, team: L.teams[r.user_id]?.team || '?', profit: money(r.profit), risked: money(r.risked), best: r.best != null ? money(r.best) : null }))
    .sort((a, b) => b.profit - a.profit || b.won - a.won) };
}

export async function feed(limit = 40) {
  const L = await sl.league();
  return betsWhere("b.season=$1 AND b.status <> 'cancelled'", [L.season], Math.min(100, Number(limit) || 40));
}

// The commish's book: every bet in the league, filterable, with each manager's running
// total. Read-only — this shows what happened, it never changes anything.
export async function betBook({ week = null, user = null, status = null, limit = 300 } = {}) {
  const L = await sl.league();
  const where = ['b.season=$1'], params = [L.season];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('$?', `$${params.length}`)); };
  if (week) add('b.week=$?', Number(week));
  if (user) add('b.user_id=$?', String(user));
  if (status) add('b.status=$?', String(status));
  const bets = await betsWhere(where.join(' AND '), params, Math.min(400, Number(limit) || 300));
  const by = {};
  for (const b of bets) {
    const t = (by[b.user_id] ||= { user_id: b.user_id, team: b.team, bets: 0, staked: 0, returned: 0, won: 0, lost: 0, open: 0, other: 0, at_risk: 0 });
    t.bets++; t.staked += b.stake; t.returned += Number(b.payout || 0);
    if (b.status === 'won') t.won++;
    else if (b.status === 'lost') t.lost++;
    else if (b.status === 'open') { t.open++; t.at_risk += b.stake; }
    else t.other++;
  }
  const managers = Object.values(by).map((t) => ({
    ...t, staked: money(t.staked), returned: money(t.returned), at_risk: money(t.at_risk),
    net: money(t.returned - t.staked + t.at_risk) // open stakes aren't losses yet
  })).sort((a, b) => b.net - a.net);
  const weeks = await q('SELECT DISTINCT week FROM bets WHERE season=$1 ORDER BY week DESC', [L.season]);
  const tot = bets.reduce((a, b) => ({ staked: a.staked + b.stake, returned: a.returned + Number(b.payout || 0) }), { staked: 0, returned: 0 });
  return { season: L.season, bets, managers, weeks: weeks.map((w) => w.week), count: bets.length,
    totals: { staked: money(tot.staked), returned: money(tot.returned), house: money(tot.staked - tot.returned) } };
}

// ---------- settlement ----------
// Grade one bet from its legs (used after settlement and after voids).
async function gradeOne(betId, c = null) {
  if (!c) return tx((client) => gradeOne(betId, client));
  const run = (sql, p) => c.query(sql, p);
  const s = await settings(c);
  const { rows: [b] } = await run('SELECT * FROM bets WHERE id=$1 FOR UPDATE', [betId]);
  if (!b || b.status !== 'open') return;
  const { rows: legs } = await run('SELECT * FROM bet_legs WHERE bet_id=$1', [betId]);
  const lostLeg = legs.some((l) => l.result === 'lost');
  if (!lostLeg && legs.some((l) => l.result === 'open')) return; // still waiting on a game
  const g = gradeBet(Number(b.stake), legs, b.kind === 'parlay' ? s.parlay_max_payout : Infinity);
  await run('UPDATE bets SET status=$2, payout=$3, settled_at=now() WHERE id=$1', [betId, g.status, g.payout]);
  if (g.payout > 0) await run('INSERT INTO bankroll_ledger(user_id, season, amount, kind, bet_id, note) VALUES ($1,$2,$3,$4,$5,$6)',
    [b.user_id, b.season, g.payout, g.status === 'won' ? 'payout' : 'refund', betId, `${g.status === 'won' ? 'Won' : g.status === 'void' ? 'Void' : 'Push'} · bet #${betId}`]);
  return true;
}

// ---------- early settlement ----------
// Nobody should wait until Wednesday to find out they won a bet whose games finished on
// Sunday afternoon. Every ten minutes this grades whatever is genuinely over: a player
// prop the moment that player's own NFL game ends, a matchup bet once every starter on
// both sides has finished, the weekly specials once the last game in the league is done.
//
// Wednesday's pass still runs. Sleeper keeps applying stat corrections into Tuesday, and
// those move fantasy points, so settleWeek re-reads the final numbers and fixes anything
// that changed — including taking a payout back and re-grading a bet that flipped.
// "Over" has to mean over. weekState calls a starter 'bye' when it can't match him to an
// NFL game at all, so an ESPN outage would otherwise look like a lineup that had finished.
// At least one man has to have actually played a game that ended before we believe it.
const gamesOver = (r) => {
  const live = ((r && r.players) || []).filter((p) => !p.empty);
  if (!live.length || !live.some((p) => p.state === 'post')) return false;
  return live.every((p) => p.state === 'post' || p.state === 'bye');
};

export async function settleReady(season, week) {
  const L = await sl.league();
  if (L.season !== season) return { legs: 0, bets: 0, lines: 0 };
  const open = await q("SELECT * FROM lines WHERE season=$1 AND week=$2 AND status='open' AND matchup_id >= 0", [season, week]);
  if (!open.length) return { legs: 0, bets: 0, lines: 0 };
  const st = await sl.weekState(L, week, 60 * 1000);
  if (!st || !st.rosters) return { legs: 0, bets: 0, lines: 0 };
  const [pts, ppts] = await Promise.all([
    sl.pointsFor(L, week, 60 * 1000).catch(() => ({})),
    sl.playerPoints(L, week, 60 * 1000).catch(() => ({}))
  ]);
  // Which NFL team each starter plays for, so a prop can settle on that one game alone.
  const nflOf = {};
  for (const r of Object.values(st.rosters)) for (const p of r.players || []) if (p.pid) nflOf[p.pid] = p.nfl;
  const gameOf = st.k?.gameOf || {};
  if (Object.keys(gameOf).length < 2) return { legs: 0, bets: 0, lines: 0 }; // no schedule, no grading
  const weekOver = Object.values(st.rosters).every(gamesOver);
  // Specials are graded against the whole league, so they need every team's final.
  const all = await q('SELECT team_a, team_b, roster_a, roster_b FROM lines WHERE season=$1 AND week=$2 AND matchup_id > 0', [season, week]);
  const scores = {};
  for (const g of all) { if (pts[g.roster_a] > 0) scores[g.team_a] = pts[g.roster_a]; if (pts[g.roster_b] > 0) scores[g.team_b] = pts[g.roster_b]; }

  const touched = new Set();
  let legs = 0, lines = 0;
  await tx(async (c) => {
    for (const l of open) {
      const ready = l.matchup_id > 0 && isStarted(l) && gamesOver(st.rosters[l.roster_a]) && gamesOver(st.rosters[l.roster_b])
        && pts[l.roster_a] > 0 && pts[l.roster_b] > 0;
      const special = l.matchup_id === 0 && weekOver && Object.keys(scores).length === all.length * 2;
      const { rows: olegs } = await c.query("SELECT * FROM bet_legs WHERE line_id=$1 AND result='open'", [l.id]);
      for (const g of olegs) {
        let res = null;
        if (g.market === 'prop') {
          const gm = gameOf[nflOf[g.player_id] || ''];
          if ((!gm || gm.state === 'post') && ppts[g.player_id] != null) res = gradeProp(g.pick, g.point, ppts[g.player_id]);
        } else if (special) res = gradeSpecial(g, scores);
        else if (ready) res = gradeLeg(g, pts[l.roster_a], pts[l.roster_b]);
        if (res) { await c.query('UPDATE bet_legs SET result=$2 WHERE id=$1', [g.id, res]); legs++; touched.add(String(g.bet_id)); }
      }
      if (ready || special) {
        const vals = Object.values(scores);
        const fa = special ? (vals.length ? Math.max(...vals) : null) : pts[l.roster_a];
        const fb = special ? (vals.length ? Math.min(...vals) : null) : pts[l.roster_b];
        await c.query("UPDATE lines SET status='final', final_a=$2, final_b=$3, locked=true, updated_at=now() WHERE id=$1", [l.id, fa, fb]);
        lines++;
      }
    }
    for (const id of touched) await gradeOne(Number(id), c);
  });
  if (legs || lines) await log('settle_early', { season, week, lines, legs, bets: touched.size });
  return { legs, bets: touched.size, lines };
}

// A bet that was already paid out but whose legs have since been corrected: take the
// payout back on the ledger, then let gradeOne settle it again from the right numbers.
async function reopenBet(betId, c) {
  const { rows: [b] } = await c.query('SELECT * FROM bets WHERE id=$1 FOR UPDATE', [betId]);
  if (!b || b.status === 'open' || b.status === 'cancelled') return false;
  const paid = Number(b.payout || 0);
  if (paid > 0) await c.query('INSERT INTO bankroll_ledger(user_id, season, amount, kind, bet_id, note) VALUES ($1,$2,$3,$4,$5,$6)',
    [b.user_id, b.season, -paid, 'correction', betId, `Stat correction · bet #${betId} re-graded`]);
  await c.query("UPDATE bets SET status='open', payout=NULL, settled_at=NULL WHERE id=$1", [betId]);
  return true;
}

export async function settleWeek(season, week, { force = false, by = null } = {}) {
  const [bw] = await q('SELECT * FROM book_weeks WHERE season=$1 AND week=$2', [season, week]);
  if (!bw) throw new BookError(`No Book for ${season} Week ${week}`);
  if (bw.settled_at) throw new BookError(`Week ${week} is already settled`);
  if (!force && (!bw.settle_at || new Date(bw.settle_at) > now())) throw new BookError(`Week ${week} settles ${bw.settle_at ? fmtPT(bw.settle_at) : 'after its games'}`);
  const L = await sl.league({ fresh: true });
  if (!force && L.lastScored < week && now() - new Date(bw.settle_at) < 24 * 60 * MIN) throw new BookError(`Sleeper hasn't finalized Week ${week} yet`);
  const pts = await sl.pointsFor(L, week, 0);
  // Everything, not just what's still open: anything settled early gets re-checked here
  // against the corrected numbers.
  const lines = await q("SELECT * FROM lines WHERE season=$1 AND week=$2 AND status <> 'void'", [season, week]);
  for (const l of lines) if (l.matchup_id > 0 && (!(pts[l.roster_a] > 0) || !(pts[l.roster_b] > 0))) throw new BookError(`Missing final score for ${l.id}; not settling`);
  // Every team's score this week, for the specials board (teams playing this week only).
  const scores = {};
  const games = await q('SELECT team_a, team_b, roster_a, roster_b FROM lines WHERE season=$1 AND week=$2 AND matchup_id > 0', [season, week]);
  for (const g of games) { if (pts[g.roster_a] > 0) scores[g.team_a] = pts[g.roster_a]; if (pts[g.roster_b] > 0) scores[g.team_b] = pts[g.roster_b]; }
  const ppts = await sl.playerPoints(L, week, 0).catch(() => ({}));
  let graded = 0;
  const corrected = [];
  await tx(async (c) => {
    for (const l of lines) {
      if (l.matchup_id < 0) continue; // season futures settle on their own (settleFutures)
      const vals = Object.values(scores);
      const special = l.matchup_id === 0;
      const fa = special ? (vals.length ? Math.max(...vals) : null) : pts[l.roster_a];
      const fb = special ? (vals.length ? Math.min(...vals) : null) : pts[l.roster_b];
      await c.query("UPDATE lines SET status='final', final_a=$2, final_b=$3, locked=true, updated_at=now() WHERE id=$1", [l.id, fa, fb]);
      // Every leg, including ones already graded early — a stat correction can move them.
      const { rows: legs } = await c.query('SELECT * FROM bet_legs WHERE line_id=$1', [l.id]);
      for (const g of legs) {
        const want = special ? gradeSpecial(g, scores)
          : g.market === 'prop' ? gradeProp(g.pick, g.point, ppts[g.player_id]) : gradeLeg(g, fa, fb);
        if (want === g.result) continue;
        await c.query('UPDATE bet_legs SET result=$2 WHERE id=$1', [g.id, want]);
        if (g.result !== 'open') corrected.push({ bet: String(g.bet_id), leg: g.id, from: g.result, to: want });
      }
    }
    for (const id of new Set(corrected.map((x) => x.bet))) await reopenBet(Number(id), c);
    const { rows: bets } = await c.query("SELECT id FROM bets WHERE season=$1 AND week=$2 AND status='open'", [season, week]);
    for (const b of bets) { await gradeOne(b.id, c); graded++; }
    await c.query('UPDATE book_weeks SET settled_at=now() WHERE season=$1 AND week=$2', [season, week]);
  });
  await log('settle', { season, week, lines: lines.length, bets: graded, corrected: corrected.length, force }, by);
  return { season, week, lines: lines.length, bets: graded, corrected: corrected.length };
}

// ---------- the clock job (every 10 minutes) ----------
let lastTick = null;
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
  // 1b) Pay out anything whose games are already over, without waiting for Wednesday.
  const live = await q('SELECT season, week FROM book_weeks WHERE settled_at IS NULL ORDER BY week');
  for (const d of live) {
    try { const r = await settleReady(d.season, d.week); if (r.legs) (out.early ||= []).push({ week: d.week, ...r }); }
    catch (e) { out.errors.push(`early wk ${d.week}: ${e.message}`); }
  }
  // 2) Settle any week past its Wednesday 3 AM.
  const due = await q('SELECT season, week FROM book_weeks WHERE settled_at IS NULL AND settle_at <= $1 ORDER BY week', [now()]);
  for (const d of due) {
    try { await settleWeek(d.season, d.week); out.settled.push(d.week); }
    catch (e) { out.errors.push(`settle wk ${d.week}: ${e.message}`); }
  }
  // 2b) Season futures, once Sleeper has the answers.
  try { const f = await settleFutures(); if (f.graded) out.futures = f.graded; } catch (e) { out.errors.push(`futures: ${e.message}`); }
  // 3) Keep lock flags current for open weeks.
  const open = await q('SELECT season, week FROM book_weeks WHERE settled_at IS NULL');
  for (const o of open) await refreshLocks(o.season, o.week).catch((e) => out.errors.push(`locks wk ${o.week}: ${e.message}`));
  lastTick = out;
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

// Commish "Book health" card: is everything the Book depends on working right now?
export async function health() {
  const L = await sl.league();
  const w = await currentWeek();
  const out = { season: L.season, nfl_week: L.nflWeek, last_tick: lastTick, checks: [] };
  const add = (name, ok, detail) => out.checks.push({ name, ok, detail });
  add('Database', true, 'Connected');
  add('Sleeper', true, `${L.teams ? Object.keys(L.teams).length : 0} managers, Week ${L.nflWeek}`);
  if (w) {
    const [bw] = await q('SELECT * FROM book_weeks WHERE season=$1 AND week=$2', [w.season, w.week]);
    const lines = await q('SELECT status, locked FROM lines WHERE season=$1 AND week=$2 AND matchup_id > 0', [w.season, w.week]);
    const open = await q("SELECT COUNT(*)::int n, COALESCE(SUM(stake),0)::float s FROM bets WHERE season=$1 AND week=$2 AND status='open'", [w.season, w.week]);
    add('Lines', lines.length > 0, `Week ${w.week}: ${lines.length} games (${lines.filter((l) => l.locked).length} started, ${lines.filter((l) => l.status !== 'open').length} final/void)`);
    add('Open bets', true, `${open[0].n} bets, ${money(open[0].s)} Bucks riding`);
    add('Settlement', true, bw?.settled_at ? `Settled ${fmtPT(bw.settled_at)}` : bw?.settle_at ? `Settles ${fmtPT(bw.settle_at)}` : 'Time not set yet');
    try {
      const st = await liveWeek(w.season, w.week);
      const rs = Object.values(st?.rosters || {});
      const withProj = rs.filter((r) => r.proj_live != null).length;
      add('NFL game clocks (ESPN)', true, `${st.k.games.length} games, ${st.k.games.filter((g) => g.state === 'in').length} live now`);
      add('Sleeper projections', withProj > 0, withProj ? `${withProj} of ${rs.length} lineups projected` : 'Not available — live odds use the history projection');
    } catch (e) { add('Live data', false, e.message); }
  } else add('Lines', false, 'No week posted yet');
  const errs = await q("SELECT at, detail FROM book_log WHERE kind='tick' AND detail->'errors' <> '[]'::jsonb ORDER BY id DESC LIMIT 3");
  out.recent_errors = errs.map((e) => ({ at: e.at, errors: e.detail?.errors || [] }));
  return out;
}

