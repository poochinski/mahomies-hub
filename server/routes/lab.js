// League Lab: Bench Shame, Trade grader, Draft re-grade.
//   GET /api/bench?season=2026
//   GET /api/trades?season=2026
//   GET /api/draft?season=2026
import { Router } from 'express';
import { sleeper, leagueChain, getPlayers } from '../sleeper/client.js';
import { LEAGUE_ID, COMMISH_USER_ID } from '../config.js';

const router = Router();
const HOUR = 60 * 60 * 1000;

// Which positions can fill each lineup slot.
const ELIGIBLE = {
  QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'], K: ['K'], DEF: ['DEF'],
  FLEX: ['RB', 'WR', 'TE'], SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  REC_FLEX: ['WR', 'TE'], WRRB_FLEX: ['RB', 'WR']
};

async function loadSeason(season) {
  const leagueId = LEAGUE_ID;
  if (!leagueId) throw Object.assign(new Error('SLEEPER_LEAGUE_ID is not set'), { status: 500 });
  const chain = await leagueChain(leagueId);
  const s = chain.find((x) => x.season === String(season));
  if (!s) throw Object.assign(new Error(`No league found for ${season}`), { status: 404 });

  const [league, rosters, state, players] = await Promise.all([
    sleeper(`/league/${s.league_id}`, { maxAgeMs: HOUR }),
    sleeper(`/league/${s.league_id}/rosters`, { maxAgeMs: HOUR }),
    sleeper('/state/nfl'),
    getPlayers()
  ]);
  const last = Number(league.settings?.last_scored_leg) || (league.status === 'complete' ? 17 : 0);
  const regEnd = Math.min(last, (Number(league.settings?.playoff_week_start) || 15) - 1);
  const ownerOf = Object.fromEntries(rosters.map((r) => [r.roster_id, r.owner_id]));
  const isCurrent = String(season) === state.season;

  const weeks = {};
  await Promise.all(
    Array.from({ length: last }, (_, i) => i + 1).map(async (w) => {
      const age = isCurrent && w >= last ? 10 * 60 * 1000 : 7 * 24 * HOUR;
      weeks[w] = await sleeper(`/league/${s.league_id}/matchups/${w}`, { maxAgeMs: age });
    })
  );
  return { s, league, ownerOf, players, weeks, last, regEnd, isCurrent };
}

function posOf(players, id) {
  if (/^[A-Z]{2,3}$/.test(id)) return 'DEF';
  return players[id]?.p || '';
}
function nameOf(players, id) {
  if (players[id]?.n) return players[id].n;
  return /^[A-Z]{2,3}$/.test(id) ? `${id} defense` : `Player ${id}`;
}

// Every player's points for one roster-week (players_points, filled in from starters_points).
function pointsMap(m) {
  const pp = { ...(m.players_points || {}) };
  (m.starters || []).forEach((id, i) => { if (pp[id] == null && id && id !== '0') pp[id] = (m.starters_points || [])[i] || 0; });
  return pp;
}

function bestLineup(slots, pool) {
  // pool: [{id, pos, pts}]; fill the most restrictive slots first.
  const order = slots
    .map((slot, i) => ({ slot, i, n: (ELIGIBLE[slot] || []).length || 99 }))
    .sort((a, b) => a.n - b.n);
  const used = new Set();
  let total = 0;
  for (const { slot } of order) {
    const ok = ELIGIBLE[slot];
    if (!ok) continue;
    let best = null;
    for (const p of pool) if (!used.has(p.id) && ok.includes(p.pos) && (!best || p.pts > best.pts)) best = p;
    if (best) { used.add(best.id); total += best.pts; }
  }
  return total;
}

function wrap(fn) {
  return async (req, res) => {
    try {
      if (!req.query.season) return res.status(400).json({ error: 'Need a season' });
      res.json(await fn(req.query.season));
    } catch (err) {
      res.status(err.status || 502).json({ error: err.message });
    }
  };
}

// ---------- Bench Shame ----------
router.get('/bench', wrap(async (season) => {
  const { league, ownerOf, players, weeks, regEnd } = await loadSeason(season);
  const slots = (league.roster_positions || []).filter((p) => ELIGIBLE[p]);
  const by = {};
  for (let w = 1; w <= regEnd; w++) {
    for (const m of weeks[w] || []) {
      const uid = ownerOf[m.roster_id];
      if (!uid) continue;
      const pp = pointsMap(m);
      const pool = (m.players || []).map((id) => ({ id, pos: posOf(players, id), pts: pp[id] || 0 }));
      const lost = Math.max(0, bestLineup(slots, pool) - (m.points || 0));
      const t = (by[uid] ||= { user_id: uid, lost: 0, worst: { lost: -1, week: 0 }, weeks: [] });
      t.lost += lost;
      t.weeks.push({ week: w, lost: Math.round(lost * 100) / 100 });
      if (lost > t.worst.lost) t.worst = { lost: Math.round(lost * 100) / 100, week: w };
    }
  }
  const teams = Object.values(by)
    .map((t) => ({ ...t, lost: Math.round(t.lost * 100) / 100 }))
    .sort((a, b) => b.lost - a.lost);
  return { season: String(season), through: regEnd, teams };
}));

// ---------- Trade grader ----------
router.get('/trades', wrap(async (season) => tradeReport(season)));

/*
 * Trade grader v2 (2026-10-09). For every completed trade, each side gets:
 *   - got / gave: players (name, position, NFL team), draft picks and FAAB that changed hands
 *   - week by week from the trade on: each received player's points and whether he was
 *     started, benched or gone from the roster; the team's score, opponent and result
 *   - totals: points STARTED from received players ("points used"), points left on the bench
 *   - team before vs after: points per game and record before the trade vs since
 * Verdict = gap in points used per week since the trade (see VERDICT below).
 */
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
// Edge per week since the trade -> label. Tuned so a 20-point gap over 9 weeks is "even"
// but the same gap over 2 weeks is a real lead.
const VERDICT = [[15, 'big'], [7, 'clear'], [3, 'slight'], [0, 'even']];

export async function tradeReport(season) {
  const { s, league, ownerOf, players, weeks, last, isCurrent } = await loadSeason(season);
  const P = Number(league.settings?.playoff_week_start) || 15;
  const median = !!league.settings?.league_average_match;
  const ongoing = isCurrent && league.status !== 'complete';
  const lists = await Promise.all(Array.from({ length: Math.max(1, last + 1) }, (_, i) => i + 1)
    .map((w) => sleeper(`/league/${s.league_id}/transactions/${w}`, { maxAgeMs: HOUR }).catch(() => [])));
  const trades = lists.flat().filter((t) => t.type === 'trade' && t.status === 'complete');

  // Per week: roster -> { m, pts, opp, result, mres }
  const wk = {};
  for (let w = 1; w <= last; w++) {
    const ms = weeks[w] || []; const by = {}; const pairs = {};
    for (const m of ms) { by[m.roster_id] = { m, pts: m.points || 0 }; if (m.matchup_id != null) (pairs[m.matchup_id] ||= []).push(m); }
    for (const pr of Object.values(pairs)) if (pr.length === 2) {
      const [a, b] = pr;
      by[a.roster_id].opp = b.roster_id; by[a.roster_id].opp_pts = b.points || 0;
      by[b.roster_id].opp = a.roster_id; by[b.roster_id].opp_pts = a.points || 0;
      by[a.roster_id].result = a.points > b.points ? 'W' : a.points < b.points ? 'L' : 'T';
      by[b.roster_id].result = b.points > a.points ? 'W' : b.points < a.points ? 'L' : 'T';
    }
    if (median && w < P && ms.length) {
      const v = ms.map((m) => m.points || 0).sort((x, y) => x - y);
      const med = (v[Math.floor((v.length - 1) / 2)] + v[Math.ceil((v.length - 1) / 2)]) / 2;
      for (const m of ms) by[m.roster_id].mres = (m.points || 0) > med ? 'W' : 'L';
    }
    wk[w] = by;
  }
  const info = (pid) => ({ id: pid, name: nameOf(players, pid), pos: posOf(players, pid), nfl: /^[A-Z]{2,3}$/.test(pid) ? pid : players[pid]?.t || '' });
  const record = (rid, from, to) => {
    let w = 0, l = 0, t = 0;
    for (let x = from; x <= to; x++) { const r = wk[x]?.[rid]; if (!r) continue;
      for (const res of [r.result, r.mres]) if (res === 'W') w++; else if (res === 'L') l++; else if (res === 'T') t++; }
    return `${w}-${l}${t ? '-' + t : ''}`;
  };
  const ppg = (rid, from, to) => { const v = []; for (let x = from; x <= to; x++) { const r = wk[x]?.[rid]; if (r && r.pts > 0) v.push(r.pts); } return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null; };

  const out = trades.sort((a, b) => (a.leg || 0) - (b.leg || 0) || (a.created || 0) - (b.created || 0)).map((t) => {
    const week = t.leg || 1;
    const adds = t.adds || {}, drops = t.drops || {};
    const rids = t.roster_ids || [];
    const sides = rids.map((rid) => {
      const got = Object.keys(adds).filter((p) => adds[p] === rid);
      const gave = Object.keys(drops).filter((p) => drops[p] === rid && adds[p] != null && adds[p] !== rid);
      const cut = Object.keys(drops).filter((p) => drops[p] === rid && adds[p] == null); // dropped to make room
      const picks = (list) => list.map((p) => ({ season: String(p.season), round: p.round, orig: ownerOf[p.roster_id] || null }));
      const dp = t.draft_picks || [];
      const faab = (t.waiver_budget || []);
      // Week-by-week for the players this side received.
      const tenure = Object.fromEntries(got.map((p) => [p, { seen: false, gone: null }]));
      const pl = Object.fromEntries(got.map((p) => [p, { ...info(p), used: 0, bench: 0, starts: 0, weeks_on: 0, best: null, gone: null }]));
      const rows = [];
      for (let w = week; w <= last; w++) {
        const r = wk[w]?.[rid]; if (!r) continue;
        const pp = pointsMap(r.m); const st = new Set((r.m.starters || []).map(String)); const on = new Set((r.m.players || []).map(String));
        const each = {};
        let used = 0, bench = 0;
        for (const p of got) {
          const tn = tenure[p];
          if (tn.gone) { each[p] = { s: 'gone' }; continue; }
          if (!on.has(p)) { if (tn.seen) { tn.gone = w; pl[p].gone = w; each[p] = { s: 'gone' }; } else each[p] = { s: 'pending' }; continue; }
          tn.seen = true; const v = r2(pp[p] || 0);
          pl[p].weeks_on++;
          if (st.has(p)) { used += v; pl[p].used += v; pl[p].starts++; each[p] = { s: 'start', pts: v }; if (!pl[p].best || v > pl[p].best.pts) pl[p].best = { w, pts: v }; }
          else { bench += v; pl[p].bench += v; each[p] = { s: 'bench', pts: v }; }
        }
        rows.push({ w, playoff: w >= P, used: r2(used), bench: r2(bench), team: r2(r.pts), opp: r.opp ? ownerOf[r.opp] : null, opp_pts: r.opp_pts != null ? r2(r.opp_pts) : null, result: r.result || null, median: r.mres || null, each });
      }
      for (const p of got) { pl[p].used = r2(pl[p].used); pl[p].bench = r2(pl[p].bench); }
      const used = r2(rows.reduce((a, x) => a + x.used, 0)), bench = r2(rows.reduce((a, x) => a + x.bench, 0));
      const regLast = Math.min(last, P - 1);
      return {
        user_id: ownerOf[rid], roster_id: rid,
        got: got.map((p) => pl[p]), gave: gave.map(info), cut: cut.map(info),
        picks_got: picks(dp.filter((p) => p.owner_id === rid)), picks_gave: picks(dp.filter((p) => p.previous_owner_id === rid)),
        faab_got: faab.filter((b) => b.receiver === rid).reduce((a, b) => a + (b.amount || 0), 0),
        faab_gave: faab.filter((b) => b.sender === rid).reduce((a, b) => a + (b.amount || 0), 0),
        used, bench, weeks: rows, prev_team: wk[week - 1]?.[rid] ? r2(wk[week - 1][rid].pts) : null,
        before: { ppg: ppg(rid, 1, Math.min(week - 1, regLast)), rec: record(rid, 1, Math.min(week - 1, regLast)), weeks: Math.max(0, Math.min(week - 1, regLast)) },
        after: { ppg: ppg(rid, week, regLast), rec: record(rid, week, regLast), weeks: Math.max(0, regLast - week + 1) }
      };
    });
    const n = sides.length ? Math.max(...sides.map((x) => x.weeks.length)) : 0;
    const ranked = [...sides].sort((a, b) => b.used - a.used);
    let verdict = { leader: null, edge: 0, per_week: 0, label: 'pending', weeks: n };
    if (n && ranked.length >= 2) {
      const edge = r2(ranked[0].used - ranked[1].used), per = r1(edge / n);
      const label = VERDICT.find(([min]) => per >= min)[1];
      verdict = { leader: label === 'even' ? null : ranked[0].user_id, ahead: ranked[0].user_id, edge, per_week: per, label, weeks: n };
    }
    const status = ongoing ? 'ongoing' : 'final';
    return { id: t.transaction_id, week, created: t.created, status, weeks_left: ongoing ? Math.max(0, (P - 1) - last) : 0, sides, verdict };
  });
  return { season: String(season), through: last, playoff_start: P, ongoing, trades: out };
}

// ---------- Draft re-grade ----------
router.get('/draft', wrap(async (season) => {
  const { league, ownerOf, players, weeks, last } = await loadSeason(season);
  if (!league.draft_id) return { season: String(season), steals: [], busts: [] };
  const picks = await sleeper(`/draft/${league.draft_id}/picks`, { maxAgeMs: 7 * 24 * HOUR });

  const pts = {};
  for (let w = 1; w <= last; w++) {
    for (const m of weeks[w] || []) {
      for (const [pid, p] of Object.entries(pointsMap(m))) pts[pid] = (pts[pid] || 0) + (p || 0);
    }
  }
  const rows = picks
    .filter((p) => p.player_id)
    .map((p) => ({
      pick_no: p.pick_no,
      round: p.round,
      slot: p.draft_slot,
      user_id: p.picked_by || ownerOf[p.roster_id],
      id: p.player_id,
      name: p.metadata?.first_name ? `${p.metadata.first_name} ${p.metadata.last_name}` : nameOf(players, p.player_id),
      pos: p.metadata?.position || posOf(players, p.player_id),
      points: Math.round((pts[p.player_id] || 0) * 100) / 100
    }))
    .filter((p) => p.pos !== 'K' && p.pos !== 'DEF');
  [...rows].sort((a, b) => b.points - a.points).forEach((p, i) => { p.rank = i + 1; });
  const steals = [...rows].sort((a, b) => (b.pick_no - b.rank) - (a.pick_no - a.rank)).slice(0, 5);
  const busts = [...rows].sort((a, b) => (b.rank - b.pick_no) - (a.rank - a.pick_no)).slice(0, 5);
  return { season: String(season), steals, busts };
}));

export default router;
