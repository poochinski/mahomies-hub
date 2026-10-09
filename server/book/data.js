// What the Book needs from Sleeper: this season's league, who plays whom,
// scores so far, live/final points and current starters.
import { sleeper, getPlayers } from '../sleeper/client.js';
import { LEAGUE_ID } from '../config.js';
import { kickoffs } from './kickoffs.js';

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
    owner, teams, active: Object.keys(owner).map((r) => owner[r]).filter(Boolean)
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
export async function weekState(L, week, maxAgeMs = 60 * 1000) {
  const [k, ms, players] = await Promise.all([kickoffs(L.season, week, { maxAgeMs }), matchups(L.leagueId, week, maxAgeMs), getPlayers().catch(() => ({}))]);
  const teamOf = (pid) => (/^[A-Z]{2,3}$/.test(pid) ? pid : players[pid]?.t || null);
  const rosters = {}, starts = {};
  for (const m of ms) {
    const slots = (m.starters || []).length || 1;
    let rem = 0, first = Infinity; const out = [];
    for (const pid of m.starters || []) {
      if (!pid || pid === '0') { out.push('empty'); continue; }
      const g = k.gameOf[teamOf(String(pid))];
      if (!g) { out.push(`${pid}:${teamOf(String(pid)) || '?'}`); continue; }
      rem += 1 - g.progress;
      first = Math.min(first, g.at.getTime());
    }
    rosters[m.roster_id] = { pts: pts(m), rem: rem / slots, first, out, slots };
    if (m.matchup_id != null) starts[m.matchup_id] = Math.min(starts[m.matchup_id] ?? Infinity, first);
  }
  for (const mid of Object.keys(starts)) starts[mid] = new Date(Number.isFinite(starts[mid]) ? starts[mid] : k.first.getTime());
  return { rosters, starts, k };
}
