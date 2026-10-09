// League Lab: Bench Shame, Trade grader, Draft re-grade.
//   GET /api/bench?season=2026
//   GET /api/trades?season=2026
//   GET /api/draft?season=2026
import { Router } from 'express';
import { sleeper, leagueChain, getPlayers } from '../sleeper/client.js';

const router = Router();
const HOUR = 60 * 60 * 1000;

// Which positions can fill each lineup slot.
const ELIGIBLE = {
  QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'], K: ['K'], DEF: ['DEF'],
  FLEX: ['RB', 'WR', 'TE'], SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  REC_FLEX: ['WR', 'TE'], WRRB_FLEX: ['RB', 'WR']
};

async function loadSeason(season) {
  const leagueId = process.env.SLEEPER_LEAGUE_ID;
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
  return { s, league, ownerOf, players, weeks, last, regEnd };
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
router.get('/trades', wrap(async (season) => {
  const { s, ownerOf, players, weeks, last } = await loadSeason(season);
  const txWeeks = Array.from({ length: Math.max(1, last + 1) }, (_, i) => i + 1);
  const lists = await Promise.all(
    txWeeks.map((w) => sleeper(`/league/${s.league_id}/transactions/${w}`, { maxAgeMs: HOUR }).catch(() => []))
  );
  const trades = lists.flat().filter((t) => t.type === 'trade' && t.status === 'complete');

  // Points a player scored as a starter for a roster from week `from` on.
  const startedFor = (pid, rid, from) => {
    let total = 0;
    for (let w = from; w <= last; w++) {
      const m = (weeks[w] || []).find((x) => x.roster_id === rid);
      if (!m) continue;
      const i = (m.starters || []).indexOf(pid);
      if (i >= 0) total += (m.starters_points || [])[i] || 0;
    }
    return Math.round(total * 100) / 100;
  };

  const out = trades
    .sort((a, b) => (a.leg || 0) - (b.leg || 0))
    .map((t) => {
      const week = t.leg || 1;
      const sides = (t.roster_ids || []).map((rid) => {
        const got = Object.entries(t.adds || {}).filter(([, r]) => r === rid).map(([pid]) => pid);
        const ps = got.map((pid) => ({ id: pid, name: nameOf(players, pid), points: startedFor(pid, rid, week) }));
        const picks = (t.draft_picks || []).filter((p) => p.owner_id === rid).length;
        return { user_id: ownerOf[rid], roster_id: rid, players: ps, picks, points: Math.round(ps.reduce((a, p) => a + p.points, 0) * 100) / 100 };
      });
      let winner = null;
      if (sides.length === 2) {
        const [a, b] = sides;
        const hi = Math.max(a.points, b.points), lo = Math.min(a.points, b.points);
        if (hi > 0 && (hi - lo) / hi > 0.15) winner = a.points > b.points ? a.user_id : b.user_id;
      }
      return { week, created: t.created, sides, winner };
    });
  return { season: String(season), trades: out };
}));

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
