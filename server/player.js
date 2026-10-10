// Player profiles (v2.2): one NFL player's bio, his recent NFL seasons scored YOUR league's way,
// and everything he's done in Rollin' with Mahomies (who rostered him, starts, points, draft, moves).
// GET /api/player/:pid
import { sleeper, leagueChain, getPlayers } from './sleeper/client.js';
import { LEAGUE_ID } from './config.js';

const HOUR = 60 * 60 * 1000;
const STATS = (process.env.SLEEPER_PROJ_BASE || 'https://api.sleeper.app').replace(/\/$/, '');
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;

// ---------- whole-league index (all seasons): matchups, owners, drafts, transactions ----------
let IDX = null, IDX_AT = 0, IDX_LOADING = null;
async function leagueIndex() {
  if (IDX && Date.now() - IDX_AT < 10 * 60 * 1000) return IDX;
  if (IDX_LOADING) return IDX_LOADING;
  IDX_LOADING = (async () => {
    const chain = await leagueChain(LEAGUE_ID);
    const state = await sleeper('/state/nfl', { maxAgeMs: 10 * 60 * 1000 });
    const seasons = await Promise.all(chain.map(async (c) => {
      const cur = String(c.season) === String(state.season);
      const age = cur ? 10 * 60 * 1000 : 7 * 24 * HOUR;
      const [lg, rosters, users] = await Promise.all([
        sleeper(`/league/${c.league_id}`, { maxAgeMs: cur ? 10 * 60 * 1000 : 24 * HOUR }),
        sleeper(`/league/${c.league_id}/rosters`, { maxAgeMs: cur ? 10 * 60 * 1000 : 24 * HOUR }),
        sleeper(`/league/${c.league_id}/users`, { maxAgeMs: 24 * HOUR })]);
      const st = lg.settings || {};
      const last = Number(st.last_scored_leg) || (lg.status === 'complete' ? 17 : 0);
      const P = Number(st.playoff_week_start) || 15;
      const owner = Object.fromEntries(rosters.map((r) => [r.roster_id, r.owner_id]));
      const teamName = Object.fromEntries(users.map((u) => [u.user_id, (u.metadata?.team_name || u.display_name || '').trim()]));
      const weeks = {};
      const tx = [];
      // Current season: include the week being played now (rosters/moves), not just scored weeks.
      const upto = cur ? Math.max(last, Math.min(Number(state.week) || 0, P + 2)) : last;
      await Promise.all(Array.from({ length: Math.max(upto, 1) }, (_, i) => i + 1).map(async (w) => {
        const wAge = cur && w >= last - 1 ? 10 * 60 * 1000 : age;
        [weeks[w]] = await Promise.all([
          w <= upto ? sleeper(`/league/${c.league_id}/matchups/${w}`, { maxAgeMs: wAge }).catch(() => []) : [],
          sleeper(`/league/${c.league_id}/transactions/${w}`, { maxAgeMs: wAge }).then((t) => { for (const x of t || []) tx.push({ ...x, week: w }); }).catch(() => {})
        ]);
      }));
      let picks = [];
      try {
        const drafts = await sleeper(`/league/${c.league_id}/drafts`, { maxAgeMs: 24 * HOUR });
        for (const d of drafts || []) {
          const ps = await sleeper(`/draft/${d.draft_id}/picks`, { maxAgeMs: cur ? HOUR : 7 * 24 * HOUR }).catch(() => []);
          picks = picks.concat((ps || []).map((p) => ({ pid: String(p.player_id), round: p.round, pick_no: p.pick_no, uid: p.picked_by || owner[p.roster_id] || null })));
        }
      } catch { /* no draft */ }
      return { season: String(c.season), league_id: c.league_id, cur, last, P, owner, teamName, rosters, weeks, tx, picks };
    }));
    IDX = { seasons: seasons.sort((a, b) => b.season.localeCompare(a.season)), curSeason: String(state.season), nflWeek: Number(state.week) || 0 };
    IDX_AT = Date.now();
    return IDX;
  })();
  try { return await IDX_LOADING; } finally { IDX_LOADING = null; }
}

// ---------- NFL stats, scored with this league's settings ----------
const statCache = new Map();
async function nflSeason(pid, season, scoring, current) {
  const key = `${pid}|${season}`, hit = statCache.get(key), maxAge = current ? 30 * 60 * 1000 : 7 * 24 * HOUR;
  if (hit && Date.now() - hit.at < maxAge) return hit.data;
  const res = await fetch(`${STATS}/stats/nfl/player/${encodeURIComponent(pid)}?season_type=regular&season=${season}&grouping=week`, {
    headers: { accept: 'application/json', 'user-agent': 'MahomiesHub/2.2' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Sleeper stats ${res.status}`);
  const raw = await res.json();
  const weeks = [];
  for (const [w, row] of Object.entries(raw || {})) {
    if (!row || !row.stats) continue;
    const st = row.stats; let pts = 0, hits = 0;
    for (const [k, v] of Object.entries(st)) if (scoring[k] != null && typeof v === 'number') { pts += v * scoring[k]; hits++; }
    if (!hits) pts = Number(st.pts_ppr ?? 0);
    if (!(st.gp || st.gms_active || pts)) continue;
    weeks.push({ w: Number(w), pts: r2(pts), opp: row.opponent || '', team: row.team || '', date: row.date || null, st });
  }
  weeks.sort((a, b) => a.w - b.w);
  const sum = (k) => r1(weeks.reduce((a, x) => a + (Number(x.st[k]) || 0), 0));
  const data = {
    season: String(season), gp: weeks.length, pts: r1(weeks.reduce((a, x) => a + x.pts, 0)),
    weeks: weeks.map(({ w, pts, opp, team }) => ({ w, pts, opp, team })),
    totals: {
      pass_yd: sum('pass_yd'), pass_td: sum('pass_td'), pass_int: sum('pass_int'), rush_att: sum('rush_att'), rush_yd: sum('rush_yd'), rush_td: sum('rush_td'),
      rec_tgt: sum('rec_tgt'), rec: sum('rec'), rec_yd: sum('rec_yd'), rec_td: sum('rec_td'), fgm: sum('fgm'), fga: sum('fga'), xpm: sum('xpm'),
      def_sack: sum('sack'), def_int: sum('int'), def_td: sum('def_td'), fum_rec: sum('fum_rec')
    }
  };
  data.ppg = data.gp ? r1(data.pts / data.gp) : 0;
  statCache.set(key, { at: Date.now(), data });
  return data;
}

export async function playerProfile(pid) {
  pid = String(pid);
  const [players, idx] = await Promise.all([getPlayers().catch(() => ({})), leagueIndex()]);
  const p = players[pid] || {};
  const isDef = /^[A-Z]{2,3}$/.test(pid);
  const bio = { id: pid, name: p.n || (isDef ? `${pid} defense` : `Player ${pid}`), pos: isDef ? 'DEF' : p.p || '', team: isDef ? pid : p.t || '',
    inj: p.i || null, age: p.a || null, number: p.no ?? null, exp: p.x ?? null, college: p.c || null, height: p.ht || null, weight: p.wt || null };

  // In the league, season by season
  const seasons = [];
  let best = null, onNow = null;
  for (const S of idx.seasons) {
    const wk = [];
    for (const [w, ms] of Object.entries(S.weeks)) {
      for (const m of ms || []) {
        if (!(m.players || []).map(String).includes(pid)) continue;
        const uid = S.owner[m.roster_id] || null;
        const started = (m.starters || []).map(String).includes(pid);
        const pts = Number((m.players_points || {})[pid] ?? 0);
        wk.push({ w: Number(w), uid, started, pts: r2(pts), playoff: Number(w) >= S.P });
        if (started && (!best || pts > best.pts)) best = { season: S.season, w: Number(w), uid, pts: r2(pts) };
      }
    }
    wk.sort((a, b) => a.w - b.w);
    const owners = []; for (const x of wk) if (x.uid && owners[owners.length - 1] !== x.uid) owners.push(x.uid);
    const draft = S.picks.filter((x) => x.pid === pid);
    const moves = [];
    for (const t of S.tx) {
      if (t.status !== 'complete') continue;
      const add = t.adds && t.adds[pid] != null ? S.owner[t.adds[pid]] : null, drop = t.drops && t.drops[pid] != null ? S.owner[t.drops[pid]] : null;
      if (!add && !drop) continue;
      moves.push({ week: t.week, at: t.created || null, type: t.type, to: add, from: drop, bid: t.type === 'waiver' ? Number(t.settings?.waiver_bid ?? 0) : null });
    }
    moves.sort((a, b) => (a.at || 0) - (b.at || 0));
    if (S.cur) { const r = S.rosters.find((x) => (x.players || []).map(String).includes(pid)); onNow = r ? r.owner_id : null; }
    if (!wk.length && !draft.length && !moves.length) continue;
    const st = wk.filter((x) => x.started);
    seasons.push({ season: S.season, weeks: wk, owners, starts: st.length, rostered: wk.length,
      pts_started: r2(st.reduce((a, x) => a + x.pts, 0)), pts_bench: r2(wk.filter((x) => !x.started).reduce((a, x) => a + x.pts, 0)), draft, moves });
  }

  // NFL: this season and the two before, scored with the league's current scoring settings
  let nfl = [];
  try {
    const cur = idx.seasons[0];
    const lg = await sleeper(`/league/${cur.league_id}`, { maxAgeMs: HOUR });
    const scoring = lg.scoring_settings || {};
    const yrs = [Number(idx.curSeason), Number(idx.curSeason) - 1, Number(idx.curSeason) - 2];
    nfl = (await Promise.all(yrs.map((y) => nflSeason(pid, y, scoring, String(y) === idx.curSeason).catch(() => null)))).filter((x) => x && x.gp);
  } catch { nfl = []; }

  return { bio, on_now: onNow, nfl, league: { seasons, best }, cur_season: idx.curSeason };
}
