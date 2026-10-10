// What the Book needs from Sleeper: this season's league, who plays whom,
// scores so far, live/final points and current starters.
import { sleeper, getPlayers } from '../sleeper/client.js';
import { LEAGUE_ID } from '../config.js';
import { kickoffs, kickShort } from './kickoffs.js';

const HOUR = 60 * 60 * 1000;

export async function league({ fresh = false } = {}) {
  const age = fresh ? 0 : 10 * 60 * 1000;
  const [state, lg] = await Promise.all([sleeper('/state/nfl', { maxAgeMs: age }), sleeper(`/league/${LEAGUE_ID}`, { maxAgeMs: age })]);
  const [users, rosters] = await Promise.all([
    sleeper(`/league/${LEAGUE_ID}/users`, { maxAgeMs: HOUR }),
    sleeper(`/league/${LEAGUE_ID}/rosters`, { maxAgeMs: 10 * 60 * 1000 })
  ]);
  const owner = Object.fromEntries(rosters.map((r) => [r.roster_id, r.owner_id]));
  const teams = {};
  for (const u of users) teams[u.user_id] = { id: u.user_id, team: (u.metadata?.team_name || u.display_name || '').trim(), name: u.display_name, avatar: u.avatar || null };
  const st = lg.settings || {};
  return {
    season: String(lg.season), leagueId: LEAGUE_ID, prevId: lg.previous_league_id || null,
    P: Number(st.playoff_week_start) || 15, lastScored: Number(st.last_scored_leg) || 0,
    nflWeek: Number(state.week) || 0, nflSeason: String(state.season), seasonType: state.season_type,
    owner, teams, active: Object.keys(owner).map((r) => owner[r]).filter(Boolean),
    scoring: lg.scoring_settings || {},
    slots: (lg.roster_positions || []).filter((x) => x !== 'BN' && x !== 'IR' && x !== 'TAXI')
  };
}

export async function matchups(leagueId, week, maxAgeMs = 2 * 60 * 1000) {
  return sleeper(`/league/${leagueId}/matchups/${week}`, { maxAgeMs }).catch(() => []);
}

const pts = (m) => Number(m.custom_points ?? m.points ?? 0);

// Who plays whom in a week (regular-season pairs with a matchup id).
export async function pairsFor(L, week) {
  const ms = await matchups(L.leagueId, week, 10 * 60 * 1000);
  const by = {};
  for (const m of ms) if (m.matchup_id != null) (by[m.matchup_id] ||= []).push(m);
  return Object.entries(by).filter(([, v]) => v.length === 2).sort((a, b) => a[0] - b[0]).map(([mid, [x, y]]) => ({
    matchup_id: Number(mid), roster_a: x.roster_id, roster_b: y.roster_id, a: L.owner[x.roster_id], b: L.owner[y.roster_id]
  })).filter((p) => p.a && p.b);
}

// Every team's scores before `week` this season, plus last season's regular season.
export async function scoresBefore(L, week) {
  const cur = {}, prev = {};
  const weeks = await Promise.all(Array.from({ length: Math.max(0, week - 1) }, (_, i) => matchups(L.leagueId, i + 1, 30 * 60 * 1000)));
  weeks.forEach((ms) => { for (const m of ms) { const u = L.owner[m.roster_id]; if (u && pts(m) > 0) (cur[u] ||= []).push(pts(m)); } });
  if (L.prevId) {
    const pl = await sleeper(`/league/${L.prevId}`, { maxAgeMs: 24 * HOUR });
    const pr = await sleeper(`/league/${L.prevId}/rosters`, { maxAgeMs: 24 * HOUR });
    const pOwner = Object.fromEntries(pr.map((r) => [r.roster_id, r.owner_id]));
    const pP = Number(pl.settings?.playoff_week_start) || 15;
    const pw = await Promise.all(Array.from({ length: pP - 1 }, (_, i) => matchups(L.prevId, i + 1, 24 * HOUR)));
    pw.forEach((ms) => { for (const m of ms) { const u = pOwner[m.roster_id]; if (u && pts(m) > 0) (prev[u] ||= []).push(pts(m)); } });
  }
  return { cur, prev };
}

// Fantasy-only snapshot of this week's matchups for the Home card.
// Points so far, Sleeper projected final, and how many starters are playing or still waiting.
// No spreads, odds, or win percentages.
function packSide(R) {
  const players = (R && R.players) || [];
  let now = 0, left = 0, done = 0;
  for (const p of players) {
    if (p.state === 'in') now++;
    else if (p.state === 'pre') left++;
    else if (p.state === 'post') done++;
  }
  const started = now + done > 0;
  const finished = players.length > 0 && now === 0 && left === 0;
  const proj = started ? R && R.proj_live : R && R.proj_pre;
  // Lineup warnings for starters who haven't played yet: OUT-type injury tags, bye/no team, empty slots.
  const warn = [];
  for (const p of players) {
    if (p.state !== 'pre' && p.state !== 'bye') continue;
    if (p.state === 'bye') warn.push({ name: p.name, pos: p.pos, why: p.nfl ? 'bye' : 'no team' });
    else if (/^(out|ir|doubtful|sus|pup|na|dnr)/i.test(p.inj || '')) warn.push({ name: p.name, pos: p.pos, why: p.inj });
  }
  const empty = ((R && R.out) || []).filter((x) => x === 'empty').length;
  return {
    pts: Math.round(((R && R.pts) || 0) * 100) / 100,
    proj: proj == null ? null : proj,
    now, left, started, finished, warn, empty
  };
}

export async function homeCard(week) {
  const L = await league();
  const w = Number(week) || (L.seasonType === 'regular' ? L.nflWeek : 0);
  if (!w || w >= L.P) return { week: w, games: [] };
  const [pairs, st] = await Promise.all([pairsFor(L, w), weekState(L, w, 45 * 1000)]);
  const games = pairs.map((p) => {
    const A = packSide(st.rosters[p.roster_a]);
    const B = packSide(st.rosters[p.roster_b]);
    return {
      id: `w${w}m${p.matchup_id}`, a: p.a, b: p.b,
      pts_a: A.pts, pts_b: B.pts, proj_a: A.proj, proj_b: B.proj,
      now_a: A.now, now_b: B.now, left_a: A.left, left_b: B.left,
      on_a: A.started, on_b: B.started, fin_a: A.finished, fin_b: B.finished,
      warn_a: A.warn, warn_b: B.warn, empty_a: A.empty, empty_b: B.empty
    };
  });
  return { week: w, games };
}

// Live or final points for every roster in a week.
export async function pointsFor(L, week, maxAgeMs = 2 * 60 * 1000) {
  const ms = await matchups(L.leagueId, week, maxAgeMs);
  return Object.fromEntries(ms.map((m) => [m.roster_id, pts(m)]));
}

/**
 * When each matchup locks: the earliest kickoff among both lineups' starters.
 * Returns { matchup_id: Date } and the week's kickoff info.
 * A starter whose team isn't playing (bye / empty slot) is skipped; if no
 * starter can be matched to a game, the matchup locks at the week's first kickoff.
 */
export async function lockTimes(L, week) {
  const [k, ms, players] = await Promise.all([kickoffs(L.season, week), matchups(L.leagueId, week), getPlayers().catch(() => ({}))]);
  const teamOf = (pid) => (/^[A-Z]{2,3}$/.test(pid) ? pid : players[pid]?.t || null);
  const by = {};
  for (const m of ms) if (m.matchup_id != null) (by[m.matchup_id] ||= []).push(m);
  const out = {};
  for (const [mid, pair] of Object.entries(by)) {
    let t = Infinity;
    for (const m of pair) for (const pid of m.starters || []) {
      if (!pid || pid === '0') continue;
      const at = k.byTeam[teamOf(String(pid))];
      if (at && at.getTime() < t) t = at.getTime();
    }
    out[mid] = new Date(Number.isFinite(t) ? t : k.first.getTime());
  }
  return { locks: out, k };
}

/**
 * Live state of a week for in-game odds: points so far and how much of each
 * lineup is still to play. rem = average over starter slots of (1 - game progress);
 * an empty slot or a starter on bye counts as nothing left.
 * Returns { rosters: { roster_id: { pts, rem } }, starts: { matchup_id: Date }, k }
 */
const POS_W = { QB: 19, RB: 13, WR: 13, TE: 9, K: 8, DEF: 7 }; // typical PPR points by position
export async function weekState(L, week, maxAgeMs = 60 * 1000) {
  const [k, ms, players, proj] = await Promise.all([kickoffs(L.season, week, { maxAgeMs }), matchups(L.leagueId, week, maxAgeMs), getPlayers().catch(() => ({})), projections(L, week)]);
  const teamOf = (pid) => (/^[A-Z]{2,3}$/.test(pid) ? pid : players[pid]?.t || null);
  const posOf = (pid) => (/^[A-Z]{2,3}$/.test(pid) ? 'DEF' : players[pid]?.p || '');
  const rosters = {}, starts = {};
  for (const m of ms) {
    // Each starter counts by how many points his position usually scores in PPR,
    // so a kicker's game finishing moves the odds less than a quarterback's.
    let rem = 0, all = 0, first = Infinity; const out = []; const plist = [];
    // Live projected final, the way Sleeper shows it: points already scored, plus each
    // starter's Sleeper projection for the part of his game still to play.
    const pp = m.players_points || {}; let live = 0, pre = 0, have = 0, starters = 0;
    for (const pid0 of m.starters || []) {
      const pid = String(pid0 || '');
      const w = POS_W[posOf(pid)] || 12; all += w;
      if (!pid || pid === '0') { out.push('empty'); continue; }
      starters++;
      const got = Number(pp[pid] || 0), pj = proj[pid];
      if (pj != null) have++;
      const g = k.gameOf[teamOf(pid)];
      plist.push({ pid, pos: posOf(pid), nfl: teamOf(pid) || '', name: players[pid]?.n || pid, pts: got, proj: pj ?? null,
        progress: g ? g.progress : 1, kick: g ? g.at : null, state: g ? g.state : 'bye', inj: players[pid]?.i || null });
      if (!g) { out.push(`${pid}:${teamOf(pid) || '?'}`); live += got; continue; }
      pre += pj || 0;
      live += g.progress >= 1 ? got : got + (pj || 0) * (1 - g.progress);
      rem += w * (1 - g.progress);
      first = Math.min(first, g.at.getTime());
    }
    // Only trust Sleeper's projection when it covers most of the lineup.
    const useProj = starters > 0 && have / starters >= 0.7;
    rosters[m.roster_id] = { pts: pts(m), rem: all ? rem / all : 0, first, out, slots: (m.starters || []).length,
      proj_live: useProj ? Math.round(live * 10) / 10 : null, proj_pre: useProj ? Math.round(pre * 10) / 10 : null, players: plist };
    if (m.matchup_id != null) starts[m.matchup_id] = Math.min(starts[m.matchup_id] ?? Infinity, first);
  }
  for (const mid of Object.keys(starts)) starts[mid] = new Date(Number.isFinite(starts[mid]) ? starts[mid] : k.first.getTime());
  return { rosters, starts, k };
}

/**
 * Sleeper's own player projections for a week, scored with THIS league's scoring
 * settings, so they match the projected totals people see in the Sleeper app.
 * Returns { player_id: projected points }. Cached 10 minutes. Empty object if unavailable.
 */
const PROJ = (process.env.SLEEPER_PROJ_BASE || 'https://api.sleeper.app').replace(/\/$/, '');
const projCache = new Map();
export async function projections(L, week, maxAgeMs = 10 * 60 * 1000) {
  const key = `${L.season}|${week}`; const hit = projCache.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data;
  try {
    const pos = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => `position[]=${p}`).join('&');
    const res = await fetch(`${PROJ}/projections/nfl/${L.season}/${week}?season_type=regular&${pos}`, {
      headers: { accept: 'application/json', 'user-agent': 'MahomiesHub/1.8' }, signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) throw new Error(`Sleeper projections ${res.status}`);
    const rows = await res.json();
    const sc = L.scoring || {}; const out = {};
    for (const r of Array.isArray(rows) ? rows : []) {
      const st = r.stats || {}; let pts = 0, hits = 0;
      for (const [k, v] of Object.entries(st)) if (sc[k] != null && typeof v === 'number') { pts += v * sc[k]; hits++; }
      if (!hits) pts = Number(st.pts_ppr ?? st.pts_half_ppr ?? st.pts_std ?? 0);
      out[String(r.player_id)] = Math.round(pts * 100) / 100;
    }
    projCache.set(key, { at: Date.now(), data: out });
    return out;
  } catch (e) {
    if (hit) return hit.data;
    return {};
  }
}

// Every player's fantasy points this week, from every roster's matchup (for grading player props).
export async function playerPoints(L, week, maxAgeMs = 0) {
  const ms = await matchups(L.leagueId, week, maxAgeMs);
  const out = {};
  for (const m of ms) for (const [pid, v] of Object.entries(m.players_points || {})) out[String(pid)] = Number(v || 0);
  return out;
}

// ---------- Live Game Center (v2.1) ----------
// One fantasy matchup, player by player: points, Sleeper projection (live: points + projection for the
// part of his NFL game still to play), NFL game status/score, injury tag, plus each bench. No odds.
export async function gameCenter(week, matchupId) {
  const L = await league();
  const w = Number(week) || L.nflWeek;
  const [k, ms, players, proj] = await Promise.all([
    kickoffs(L.season, w, { maxAgeMs: 45 * 1000 }).catch(() => ({ gameOf: {}, games: [] })),
    matchups(L.leagueId, w, 45 * 1000), getPlayers().catch(() => ({})), projections(L, w)]);
  const pair = ms.filter((m) => String(m.matchup_id) === String(matchupId));
  if (pair.length !== 2) return { week: w, error: 'Matchup not found' };
  const teamOf = (pid) => (/^[A-Z]{2,3}$/.test(pid) ? pid : players[pid]?.t || '');
  const posOf = (pid) => (/^[A-Z]{2,3}$/.test(pid) ? 'DEF' : players[pid]?.p || '');
  const player = (m, pid, slot) => {
    pid = String(pid || '');
    if (!pid || pid === '0') return { slot, empty: true };
    const nfl = teamOf(pid), g = k.gameOf?.[nfl], got = Number((m.players_points || {})[pid] || 0), pj = proj[pid];
    const prog = g ? g.progress : 1, state = g ? g.state : 'bye';
    const opp = g ? (g.teams.find((t) => t !== nfl) || '') : '';
    let status = 'Bye';
    if (g && g.state === 'pre') status = kickShort(g.at);
    else if (g && g.state === 'in') status = g.detail || 'Live';
    else if (g) status = 'Final';
    return {
      slot, pid, name: players[pid]?.n || pid, pos: posOf(pid), nfl, inj: players[pid]?.i || null,
      pts: Math.round(got * 100) / 100, proj_full: pj ?? null,
      proj: !g ? Math.round(got * 10) / 10 : pj == null ? null : Math.round((got + pj * (1 - prog)) * 10) / 10,
      state, status, opp: opp ? (g.home === nfl ? 'vs ' : '@ ') + opp : '',
      nfl_score: g && g.state !== 'pre' && opp ? `${nfl} ${g.score?.[nfl] ?? 0}–${g.score?.[opp] ?? 0} ${opp}` : '',
      sc: g && g.state !== 'pre' && opp ? `${g.score?.[nfl] ?? 0}–${g.score?.[opp] ?? 0}` : ''
    };
  };
  const side = (m) => {
    const starters = (m.starters || []).map((pid, i) => player(m, pid, L.slots[i] || 'FLEX'));
    const set = new Set((m.starters || []).map(String));
    const bench = (m.players || []).filter((p) => !set.has(String(p))).map((pid) => player(m, pid, 'BN')).sort((a, b) => (b.pts - a.pts) || ((b.proj_full || 0) - (a.proj_full || 0)));
    const live = starters.filter((p) => !p.empty);
    const projSum = live.reduce((a, p) => a + (p.proj ?? p.pts), 0);
    return {
      user: L.owner[m.roster_id], team: L.teams[L.owner[m.roster_id]]?.team || '', pts: Math.round(pts(m) * 100) / 100,
      proj: Math.round(projSum * 10) / 10,
      playing: live.filter((p) => p.state === 'in').length, left: live.filter((p) => p.state === 'pre').length,
      done: live.filter((p) => p.state === 'post' || p.state === 'bye').length,
      starters, bench
    };
  };
  return { week: w, matchup_id: Number(matchupId), updated: new Date().toISOString(), a: side(pair[0]), b: side(pair[1]) };
}
