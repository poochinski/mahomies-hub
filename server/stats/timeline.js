// Live scoring timeline: when each rostered player picked up his points this week.
//
// Sleeper doesn't publish fantasy points play by play, so the server keeps its own log.
// While NFL games are on it checks every 10 seconds; whenever a rostered player's points
// (from Sleeper's matchups feed, the same number the Sleeper app shows) or his box score
// (Sleeper's weekly stats feed) changes, it writes one entry: the game clock, what changed
// ("+1 REC, +14 YD") and the points it was worth. Saved in Postgres when there is one, so a
// redeploy in the middle of a game doesn't wipe the morning.
//
// Only what happens while the server is running gets logged. A player who scored before
// tracking started shows those points as one "before tracking" entry.
import { pool } from '../db.js';
import { league, matchups } from '../book/data.js';
import { kickoffs, isGameLive, liveAge } from '../book/kickoffs.js';
import { weekStats } from './weekly.js';
import { sleeper } from '../sleeper/client.js';

// The stats worth narrating. Anything else (targets, snaps, yards-after-catch) can change
// without making an entry on its own.
const SHOW = [
  ['pass_cmp', 'CMP'], ['pass_yd', 'PASS YD'], ['pass_td', 'PASS TD'], ['pass_int', 'INT'], ['pass_2pt', '2PT'],
  ['rush_att', 'CAR'], ['rush_yd', 'RUSH YD'], ['rush_td', 'RUSH TD'], ['rush_2pt', '2PT'],
  ['rec', 'REC'], ['rec_yd', 'REC YD'], ['rec_td', 'REC TD'], ['rec_2pt', '2PT'],
  ['fum_lost', 'FUM LOST'], ['fgm', 'FG'], ['fgmiss', 'FG MISS'], ['xpm', 'XP'], ['xpmiss', 'XP MISS'],
  ['sack', 'SACK'], ['int', 'INT'], ['fum_rec', 'FUM REC'], ['def_td', 'DEF TD'], ['st_td', 'ST TD'], ['safe', 'SAFETY'],
  ['blk_kick', 'BLOCK'], ['pts_allow', 'PTS ALW'], ['fgm_lng', 'LNG FG']
];
const KEYS = SHOW.map((x) => x[0]);
const pick = (s) => { const o = {}; for (const k of KEYS) if (typeof s?.[k] === 'number' && s[k]) o[k] = s[k]; return o; };

const mem = new Map();   // "season|week" -> Map(pid -> [entries])
const last = new Map();  // "season|week|pid" -> { pts, stats, entry }
let ready = null;

async function init() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS live_timeline (
    id BIGSERIAL PRIMARY KEY, season TEXT NOT NULL, week INT NOT NULL, pid TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now(), clock TEXT, pts NUMERIC NOT NULL, delta NUMERIC NOT NULL,
    diff JSONB, stats JSONB, kind TEXT NOT NULL DEFAULT 'play')`);
  await pool.query('CREATE INDEX IF NOT EXISTS live_timeline_wk ON live_timeline (season, week, pid, at)');
}

function bucket(season, week) {
  const k = `${season}|${week}`;
  if (!mem.has(k)) mem.set(k, new Map());
  return mem.get(k);
}

// Load a week from Postgres into memory (once), so the log and "last seen" survive a restart.
const loaded = new Set();
async function loadWeek(season, week) {
  const k = `${season}|${week}`;
  if (loaded.has(k)) return;
  loaded.add(k);
  if (!pool) return;
  const { rows } = await pool.query('SELECT id, pid, at, clock, pts, delta, diff, stats, kind FROM live_timeline WHERE season=$1 AND week=$2 ORDER BY at, id', [season, week]);
  const b = bucket(season, week);
  for (const r of rows) {
    const e = { id: Number(r.id), at: new Date(r.at).toISOString(), clock: r.clock || '', pts: Number(r.pts), delta: Number(r.delta), diff: r.diff || {}, kind: r.kind };
    if (!b.has(r.pid)) b.set(r.pid, []);
    b.get(r.pid).push(e);
    last.set(`${k}|${r.pid}`, { pts: e.pts, stats: r.stats || {}, entry: e });
  }
}

async function save(season, week, pid, e, stats) {
  if (!pool) return;
  try {
    if (e.id) await pool.query('UPDATE live_timeline SET pts=$2, delta=$3, diff=$4, stats=$5 WHERE id=$1', [e.id, e.pts, e.delta, e.diff, stats]);
    else {
      const { rows } = await pool.query('INSERT INTO live_timeline (season, week, pid, at, clock, pts, delta, diff, stats, kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
        [season, week, pid, e.at, e.clock, e.pts, e.delta, e.diff, stats, e.kind]);
      e.id = Number(rows[0].id);
    }
  } catch (err) { console.error('[timeline] save', err.message); }
}

/**
 * One pass: compare every rostered player's points and box score with what we saw last time.
 * Exported for tests; `now` lets a test pin the clock.
 */
export async function recordOnce({ season, week, rosters, stats, gameOf, teamOf, now = Date.now() }) {
  await loadWeek(season, week);
  const b = bucket(season, week);
  const key = `${season}|${week}`;
  for (const m of rosters) {
    const pp = m.players_points || {};
    for (const pid0 of m.players || []) {
      const pid = String(pid0);
      const g = gameOf[teamOf(pid)];
      const pts = Math.round(Number(pp[pid] || 0) * 100) / 100;
      const st = pick(stats[pid]);
      const prev = last.get(`${key}|${pid}`);
      if (!prev) {
        // First sighting: anything already on the board happened before we were watching.
        const e = { at: new Date(now).toISOString(), clock: g && g.state === 'in' ? (g.detail || '') : '', pts, delta: pts, diff: st, kind: 'start' };
        last.set(`${key}|${pid}`, { pts, stats: st, entry: (pts || Object.keys(st).length) ? e : null });
        if (pts || Object.keys(st).length) { if (!b.has(pid)) b.set(pid, []); b.get(pid).push(e); await save(season, week, pid, e, st); }
        continue;
      }
      const diff = {};
      for (const k of KEYS) { const d = (st[k] || 0) - (prev.stats[k] || 0); if (Math.abs(d) > 1e-9) diff[k] = Math.round(d * 100) / 100; }
      const delta = Math.round((pts - prev.pts) * 100) / 100;
      if (!Object.keys(diff).length && Math.abs(delta) < 0.005) continue;
      // Sleeper's two feeds don't always land in the same 10 seconds. If one change has
      // points and no stats (or the reverse) and the entry just before it is the other
      // half, fold them into one line instead of two.
      const pe = prev.entry;
      const fresh = pe && pe.kind === 'play' && now - new Date(pe.at).getTime() < 45 * 1000;
      const pointsOnly = !Object.keys(diff).length, statsOnly = Math.abs(delta) < 0.005;
      if (fresh && ((pointsOnly && Math.abs(pe.delta) < 0.005) || (statsOnly && Object.keys(pe.diff || {}).length === 0))) {
        pe.pts = pts; pe.delta = Math.round((pe.delta + delta) * 100) / 100;
        for (const [k, v] of Object.entries(diff)) pe.diff[k] = Math.round(((pe.diff[k] || 0) + v) * 100) / 100;
        last.set(`${key}|${pid}`, { pts, stats: st, entry: pe });
        await save(season, week, pid, pe, st);
        continue;
      }
      const e = { at: new Date(now).toISOString(), clock: g && g.state === 'in' ? (g.detail || '') : g && g.state === 'post' ? 'Final' : '', pts, delta, diff, kind: 'play' };
      if (!b.has(pid)) b.set(pid, []);
      b.get(pid).push(e);
      last.set(`${key}|${pid}`, { pts, stats: st, entry: e });
      await save(season, week, pid, e, st);
    }
  }
}

export function describeDiff(diff) {
  const out = [];
  for (const [k, label] of SHOW) {
    const v = diff?.[k];
    if (!v || k === 'fgm_lng' || k === 'pts_allow') continue;
    out.push(`${v > 0 ? '+' : ''}${Math.round(v * 10) / 10} ${label}`);
  }
  if (diff?.pts_allow) out.push(`${diff.pts_allow > 0 ? '+' : ''}${diff.pts_allow} PTS ALLOWED`);
  return out.join(', ');
}

/** A player's log for one week, oldest first, ready for the phone. */
export async function timelineFor(season, week, pid) {
  if (!ready) ready = init().catch((e) => console.error('[timeline] init', e.message));
  await ready;
  await loadWeek(season, week);
  return (bucket(season, week).get(String(pid)) || []).map((e) => ({ at: e.at, clock: e.clock, pts: e.pts, delta: e.delta, what: describeDiff(e.diff), kind: e.kind }));
}

let timer = null, busy = false;
export function startTimeline() {
  if (timer) return;
  ready = init().catch((e) => console.error('[timeline] init', e.message));
  let idle = 0;
  timer = setInterval(async () => {
    if (busy) return;
    // Off game time this only peeks at ESPN once a minute.
    if (!isGameLive() && (idle++ % 6)) return;
    busy = true;
    try {
      await ready;
      const state = await sleeper('/state/nfl', { maxAgeMs: 10 * 60 * 1000 });
      if (state.season_type !== 'regular' && state.season_type !== 'post') return;
      const L = await league();
      const week = Number(state.week) || 0;
      if (!week) return;
      const k = await kickoffs(L.season, week, { maxAgeMs: liveAge(60 * 1000) });
      const on = (k.games || []).some((g) => g.state === 'in' || (g.state === 'post' && Date.now() - g.at.getTime() < 5 * 3600 * 1000));
      if (!on) return;
      const { getPlayers } = await import('../sleeper/client.js');
      const [ms, stats, players] = await Promise.all([matchups(L.leagueId, week, liveAge(45 * 1000)), weekStats(L.season, week, { live: true }), getPlayers().catch(() => ({}))]);
      const teamOf = (pid) => (/^[A-Z]{2,3}$/.test(pid) ? pid : players[pid]?.t || null);
      await recordOnce({ season: L.season, week, rosters: ms, stats: stats || {}, gameOf: k.gameOf || {}, teamOf });
    } catch (err) {
      console.error('[timeline]', err.message);
    } finally { busy = false; }
  }, 10 * 1000);
}

export const _reset = () => { mem.clear(); last.clear(); loaded.clear(); }; // tests only
