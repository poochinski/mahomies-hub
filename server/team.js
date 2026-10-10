// Team page, player search and the League Wire (v2.3).
//   GET /api/team/:uid       this season for one team: roster, schedule, moves
//   GET /api/players/search  find any NFL player and who has him in the league
//   GET /api/wire            trades, waivers and adds this season, with what each move has paid off so far
import { sleeper, getPlayers } from './sleeper/client.js';
import { leagueIndex } from './player.js';

const HOUR = 60 * 60 * 1000;
const r2 = (n) => Math.round(n * 100) / 100;
const POS_ORDER = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
const isDef = (pid) => /^[A-Z]{2,3}$/.test(pid);

function pinfo(players, pid) {
  pid = String(pid);
  const p = players[pid] || {};
  if (isDef(pid)) return { id: pid, name: p.n && !/^[A-Z]{2,3}$/.test(p.n) ? p.n : `${pid} defense`, pos: 'DEF', nfl: pid, inj: null };
  return { id: pid, name: p.n || `Player ${pid}`, pos: p.p || '', nfl: p.t || '', inj: p.i || null };
}

// Points each player scored for a roster this season (started points, bench points, starts).
function seasonPoints(S, rosterId) {
  const out = {};
  for (const [w, ms] of Object.entries(S.weeks)) {
    if (Number(w) > S.last) continue;
    const m = (ms || []).find((x) => x.roster_id === rosterId); if (!m) continue;
    const st = new Set((m.starters || []).map(String));
    for (const pid of (m.players || []).map(String)) {
      const v = Number((m.players_points || {})[pid] ?? 0);
      const o = (out[pid] ||= { started: 0, bench: 0, starts: 0, weeks: 0 });
      o.weeks++;
      if (st.has(pid)) { o.started += v; o.starts++; } else o.bench += v;
    }
  }
  return out;
}

// How a player landed on this roster this season.
function howAcquired(S, rosterId, uid, pid) {
  let last = null;
  for (const t of S.tx) {
    if (t.status !== 'complete' || !t.adds || t.adds[pid] == null || t.adds[pid] !== rosterId) continue;
    if (!last || (t.created || 0) > (last.created || 0)) last = t;
  }
  if (last) return { how: last.type === 'free_agent' ? 'free agent' : last.type, week: last.week, bid: last.type === 'waiver' ? Number(last.settings?.waiver_bid ?? 0) : null };
  const pk = S.picks.find((x) => x.pid === pid && x.uid === uid);
  if (pk) return { how: 'draft', round: pk.round, pick: pk.pick_no };
  return null;
}

export async function teamPage(uid) {
  const [idx, players] = await Promise.all([leagueIndex(), getPlayers().catch(() => ({}))]);
  const S = idx.seasons.find((x) => x.cur) || idx.seasons[0];
  const R = S.rosters.find((r) => r.owner_id === uid);
  if (!R) { const e = new Error('Not on a team this season'); e.status = 404; throw e; }
  const rid = R.roster_id;
  const lg = await sleeper(`/league/${S.league_id}`, { maxAgeMs: HOUR });
  const slots = (lg.roster_positions || []).filter((x) => x !== 'BN' && x !== 'IR' && x !== 'TAXI');

  // Latest lineup Sleeper has for this team (the week being played, or the last one)
  let lineup = null, lineupWeek = null;
  for (const w of Object.keys(S.weeks).map(Number).sort((a, b) => b - a)) {
    const m = (S.weeks[w] || []).find((x) => x.roster_id === rid);
    if (m && (m.starters || []).some((x) => x && x !== '0')) { lineup = m.starters.map(String); lineupWeek = w; break; }
  }
  if (!lineup) lineup = (R.starters || []).map(String);

  const pts = seasonPoints(S, rid);
  const reserve = new Set((R.reserve || []).map(String)), taxi = new Set((R.taxi || []).map(String));
  const all = (R.players || []).map(String);
  const card = (pid) => {
    const p = pinfo(players, pid), s = pts[pid] || { started: 0, bench: 0, starts: 0, weeks: 0 };
    return { ...p, pts: r2(s.started + s.bench), started_pts: r2(s.started), starts: s.starts, weeks: s.weeks, got: howAcquired(S, rid, uid, pid) };
  };
  const starters = lineup.map((pid, i) => ({ slot: slots[i] || 'FLEX', ...(pid && pid !== '0' && all.includes(pid) ? card(pid) : { id: null, empty: true }) }));
  const inLineup = new Set(lineup);
  const bench = all.filter((p) => !inLineup.has(p) && !reserve.has(p) && !taxi.has(p)).map(card)
    .sort((a, b) => (POS_ORDER[a.pos] || 9) - (POS_ORDER[b.pos] || 9) || b.pts - a.pts);
  const ir = [...reserve].map(card), tx = [...taxi].map(card);

  // Schedule: every regular-season week (future weeks are already set in Sleeper)
  const schedule = [];
  for (let w = 1; w < S.P; w++) {
    let ms = S.weeks[w];
    if (!ms) ms = await sleeper(`/league/${S.league_id}/matchups/${w}`, { maxAgeMs: 6 * HOUR }).catch(() => []);
    const me = (ms || []).find((x) => x.roster_id === rid); if (!me || me.matchup_id == null) continue;
    const op = ms.find((x) => x.matchup_id === me.matchup_id && x.roster_id !== rid);
    const a = Number(me.custom_points ?? me.points ?? 0), b = op ? Number(op.custom_points ?? op.points ?? 0) : 0;
    const done = w <= S.last;
    schedule.push({ w, opp: op ? S.owner[op.roster_id] || null : null, mid: me.matchup_id, pts: r2(a), opp_pts: r2(b),
      state: done ? 'final' : w === idx.nflWeek ? 'now' : 'next', res: done ? (a > b ? 'W' : a < b ? 'L' : 'T') : null });
  }

  // This season's moves for this team
  const moves = [];
  for (const t of S.tx) {
    if (t.status !== 'complete' || !(t.roster_ids || []).includes(rid)) continue;
    const got = Object.entries(t.adds || {}).filter(([, r]) => r === rid).map(([p]) => pinfo(players, p).name);
    const gave = Object.entries(t.drops || {}).filter(([, r]) => r === rid).map(([p]) => pinfo(players, p).name);
    const partner = t.type === 'trade' ? (t.roster_ids || []).filter((x) => x !== rid).map((x) => S.owner[x]).filter(Boolean) : [];
    moves.push({ week: t.week, at: t.created || null, type: t.type, got, gave, with: partner, bid: t.type === 'waiver' ? Number(t.settings?.waiver_bid ?? 0) : null });
  }
  moves.sort((a, b) => (b.at || 0) - (a.at || 0));

  return { uid, season: S.season, last: S.last, P: S.P, nfl_week: idx.nflWeek, lineup_week: lineupWeek, faab_used: Number(R.settings?.waiver_budget_used ?? 0),
    starters, bench, ir, taxi: tx, schedule, moves };
}

// ---------- player search ----------
const FANTASY = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '');
export async function playerSearch(q) {
  q = norm(q).trim(); if (q.length < 2) return [];
  const [players, idx] = await Promise.all([getPlayers(), leagueIndex()]);
  const S = idx.seasons.find((x) => x.cur) || idx.seasons[0];
  const owner = {}; for (const r of S.rosters) for (const p of r.players || []) owner[String(p)] = r.owner_id;
  const hits = [];
  for (const [pid, p] of Object.entries(players)) {
    const pos = isDef(pid) ? 'DEF' : p.p; if (!FANTASY.has(pos)) continue;
    const n = norm(p.n); if (!n) continue;
    let score;
    if (n === q) score = 0; else if (n.startsWith(q)) score = 1;
    else if (n.split(' ').some((w) => w.startsWith(q))) score = 2;
    else if (n.includes(q)) score = 3; else continue;
    if (!p.t && !isDef(pid)) score += 2;            // no NFL team (retired / free agent) sinks
    if (owner[pid]) score -= 0.5;                    // rostered in our league floats up
    hits.push({ score, ...pinfo(players, pid), owner: owner[pid] || null });
  }
  hits.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return hits.slice(0, 25).map(({ score, ...x }) => x);
}

// ---------- League Wire ----------
// Every completed move this season, newest first. "Paid off" = points the player has scored
// in the new team's starting lineup since the move (what actually counted).
export async function wire({ limit = 40 } = {}) {
  const [idx, players] = await Promise.all([leagueIndex(), getPlayers().catch(() => ({}))]);
  const S = idx.seasons.find((x) => x.cur) || idx.seasons[0];
  const startedSince = (pid, rid, fromWeek) => {
    let pts = 0, starts = 0;
    for (const [w, ms] of Object.entries(S.weeks)) {
      if (Number(w) < fromWeek || Number(w) > S.last) continue;
      const m = (ms || []).find((x) => x.roster_id === rid); if (!m) continue;
      if ((m.starters || []).map(String).includes(pid)) { pts += Number((m.players_points || {})[pid] ?? 0); starts++; }
    }
    return { pts: r2(pts), starts };
  };
  const out = [];
  for (const t of S.tx) {
    if (t.status !== 'complete' || t.type === 'commissioner') continue;
    const from = t.week; // moves made during week N count from week N's lineups on
    const sides = (t.roster_ids || []).map((rid) => {
      const got = Object.entries(t.adds || {}).filter(([, r]) => r === rid).map(([p]) => ({ ...pinfo(players, p), ...startedSince(p, rid, from) }));
      const gave = Object.entries(t.drops || {}).filter(([, r]) => r === rid).map(([p]) => pinfo(players, p));
      const picks = (t.draft_picks || []).filter((d) => d.owner_id === rid).map((d) => `${d.season} round ${d.round}`);
      return { uid: S.owner[rid] || null, got, gave, picks, value: r2(got.reduce((a, x) => a + x.pts, 0)) };
    }).filter((s) => s.uid && (s.got.length || s.gave.length || s.picks.length));
    if (!sides.length) continue;
    out.push({ id: t.transaction_id || `${t.week}-${t.created}`, type: t.type, week: t.week, at: t.created || null,
      bid: t.type === 'waiver' ? Number(t.settings?.waiver_bid ?? 0) : null, sides, scored_thru: S.last });
  }
  out.sort((a, b) => (b.at || 0) - (a.at || 0) || b.week - a.week);
  const trades = out.filter((x) => x.type === 'trade').length, waivers = out.filter((x) => x.type === 'waiver');
  const spend = {}; for (const x of waivers) { const u = x.sides[0].uid; spend[u] = (spend[u] || 0) + (x.bid || 0); }
  return { season: S.season, scored_thru: S.last, moves: out.slice(0, limit), total: out.length, trades, waivers: waivers.length,
    top_bid: waivers.reduce((m, x) => (!m || x.bid > m.bid ? x : m), null), faab: spend };
}
