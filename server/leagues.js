// The league picker (2026-10-19): every Sleeper league a manager is in this season, football and
// basketball, each with this week's matchup for him. Everything comes from Sleeper's public API,
// so a Sleeper user id (or username) is all it takes — no password.
import { sleeper } from './sleeper/client.js';
import { LEAGUE_ID } from './config.js';

const SPORTS = ['nfl', 'nba'];
const MIN = 60 * 1000;

// "12-Team Keeper PPR", "12-Team Dynasty SF PPR TEP", "10-Team Points"
export function formatLabel(lg) {
  const st = lg.settings || {}, sc = lg.scoring_settings || {}, rp = lg.roster_positions || [];
  const bits = [`${lg.total_rosters || ''}-Team`];
  if (st.type === 2) bits.push('Dynasty'); else if (st.type === 1) bits.push('Keeper');
  if ((lg.sport || 'nfl') === 'nfl') {
    if (rp.includes('SUPER_FLEX')) bits.push('SF');
    bits.push(sc.rec === 1 ? 'PPR' : sc.rec === 0.5 ? 'Half PPR' : 'Standard');
    if ((sc.bonus_rec_te || 0) > 0) bits.push('TEP');
  }
  return bits.join(' ');
}

const avatarUrl = (id) => (id ? `https://sleepercdn.com/avatars/thumbs/${id}` : null);

async function oneLeague(lg, uid, week) {
  const id = lg.league_id;
  const [users, rosters, ms] = await Promise.all([
    sleeper(`/league/${id}/users`, { maxAgeMs: 30 * MIN }).catch(() => []),
    sleeper(`/league/${id}/rosters`, { maxAgeMs: 5 * MIN }).catch(() => []),
    week ? sleeper(`/league/${id}/matchups/${week}`, { maxAgeMs: MIN }).catch(() => []) : []
  ]);
  const userOf = Object.fromEntries((users || []).map((u) => [u.user_id, u]));
  const side = (roster, m) => {
    if (!roster) return null;
    const u = userOf[roster.owner_id] || {}, s = roster.settings || {};
    return {
      uid: roster.owner_id || null,
      team: (u.metadata?.team_name || u.display_name || 'Team').trim(),
      name: u.display_name || '',
      avatar: u.metadata?.avatar || avatarUrl(u.avatar),
      w: s.wins || 0, l: s.losses || 0, t: s.ties || 0,
      pts: m ? Math.round((Number(m.points) || 0) * 100) / 100 : null
    };
  };
  const mine = (rosters || []).find((r) => r.owner_id === uid || (r.co_owners || []).includes(uid));
  const myM = mine && (ms || []).find((m) => m.roster_id === mine.roster_id);
  const oppM = myM && myM.matchup_id != null ? (ms || []).find((m) => m.matchup_id === myM.matchup_id && m.roster_id !== myM.roster_id) : null;
  const oppR = oppM && (rosters || []).find((r) => r.roster_id === oppM.roster_id);
  return {
    id, sport: lg.sport || 'nfl', season: lg.season, name: String(lg.name || 'League').trim(), status: lg.status,
    avatar: avatarUrl(lg.avatar), format: formatLabel(lg), week: week || null,
    home: id === LEAGUE_ID,
    me: side(mine, myM), opp: side(oppR, oppM)
  };
}

export async function userLeagues(uid) {
  uid = String(uid || '').trim();
  if (!/^\d{5,25}$/.test(uid)) throw new Error('Not a Sleeper user id');
  const out = [];
  for (const sport of SPORTS) {
    let state;
    try { state = await sleeper(`/state/${sport}`, { maxAgeMs: 10 * MIN }); } catch { continue; }
    const season = String(state.league_season || state.season || '');
    if (!season) continue;
    const list = await sleeper(`/user/${uid}/leagues/${sport}/${season}`, { maxAgeMs: 10 * MIN }).catch(() => []);
    const week = Number(state.display_week || state.week) || 0;
    const rows = await Promise.all((list || []).map((lg) => oneLeague(lg, uid, state.season_type === 'off' ? 0 : week).catch(() => null)));
    out.push(...rows.filter(Boolean));
  }
  // Rollin' with Mahomies first, then football before basketball, then by name.
  out.sort((a, b) => (b.home - a.home) || (a.sport === b.sport ? a.name.localeCompare(b.name) : a.sport === 'nfl' ? -1 : 1));
  return out;
}

// Username → { user_id, display_name, avatar } (for people who aren't in Rollin' with Mahomies).
export async function lookupUser(name) {
  name = String(name || '').trim();
  if (!/^[A-Za-z0-9_.-]{2,40}$/.test(name)) throw new Error('That doesn\'t look like a Sleeper username');
  const u = await sleeper(`/user/${encodeURIComponent(name)}`, { maxAgeMs: 60 * MIN });
  if (!u || !u.user_id) throw new Error('No Sleeper user by that name');
  return { user_id: u.user_id, display_name: u.display_name || name, avatar: avatarUrl(u.avatar) };
}
