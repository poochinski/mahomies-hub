// Usage (Jayson, 2026-11-09: "Snap percentages, total snaps, targets, routes run... and a brief write-up").
// How a player is being used, week by week: snaps and snap share, targets and target share, carries and
// carry share, red-zone looks and air yards, plus a few plain-English notes the app writes from those
// numbers (our own words; PFF's write-ups are theirs and aren't copied).
//
// Shares need team totals, so each week's league-wide stat file from Sleeper is boiled down to one small
// object per NFL team. Past weeks are fetched once without keeping Sleeper's big file in memory.
// Routes run aren't here: Sleeper doesn't publish them, and the free charting data (FTN via nflverse)
// only comes out after the playoffs.
import { weekStats } from './weekly.js';
import { getPlayers, sleeperOnce } from '../sleeper/client.js';

const num = (s, k) => Number(s?.[k]) || 0;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
export const USAGE_POS = new Set(['RB', 'WR', 'TE']);

// One week's stat file → { TEAM: { tgt, att, air, rz_tgt, rz_att, snaps, lead: { tgt, rb_att } } }
// `lead` holds the most targets on the team and the most carries by a running back, with who had them.
export function teamTotals(wst, players) {
  const teams = {};
  for (const [pid, s] of Object.entries(wst || {})) {
    if (!s || /^[A-Z]{2,3}$/.test(pid)) continue;
    const p = players[pid];
    if (!p || !p.t) continue;
    const T = teams[p.t] || (teams[p.t] = { tgt: 0, att: 0, air: 0, rz_tgt: 0, rz_att: 0, snaps: 0, lead: { tgt: { n: 0, pids: [] }, rb_att: { n: 0, pids: [] } } });
    T.tgt += num(s, 'rec_tgt'); T.att += num(s, 'rush_att'); T.air += num(s, 'rec_air_yd');
    T.rz_tgt += num(s, 'rec_rz_tgt'); T.rz_att += num(s, 'rush_rz_att');
    T.snaps = Math.max(T.snaps, num(s, 'tm_off_snp'));
    const bump = (L, n) => { if (n <= 0) return; if (n > L.n) { L.n = n; L.pids = [pid]; } else if (n === L.n) L.pids.push(pid); };
    bump(T.lead.tgt, num(s, 'rec_tgt'));
    if (p.p === 'RB') bump(T.lead.rb_att, num(s, 'rush_att'));
  }
  return teams;
}

// One player's week as a usage row. `T` is his team's totals that week (may be missing).
export function usageRow(pid, s, T, { w = null, opp = '', team = '' } = {}) {
  const snaps = num(s, 'off_snp'), tm = num(s, 'tm_off_snp') || T?.snaps || 0;
  const tgt = num(s, 'rec_tgt'), att = num(s, 'rush_att'), air = Math.round(num(s, 'rec_air_yd'));
  return {
    w, opp, team, snaps, tm_snaps: tm, snap_pct: snaps && tm ? pct(snaps, tm) : snaps ? null : 0,
    tm_tgt: T ? T.tgt : null, tm_att: T ? T.att : null,
    tgt, tgt_share: T ? pct(tgt, T.tgt) : null, att, att_share: T ? pct(att, T.att) : null,
    rz_tgt: num(s, 'rec_rz_tgt'), rz_att: num(s, 'rush_rz_att'),
    air, air_share: T && T.air > 0 && air > 0 ? pct(air, T.air) : null,
    rec: num(s, 'rec'), rec_yd: num(s, 'rec_yd'), rush_yd: num(s, 'rush_yd'), td: num(s, 'rec_td') + num(s, 'rush_td'),
    lead_tgt: !!(T && tgt > 0 && T.lead.tgt.pids.includes(String(pid))), lead_tgt_tied: !!(T && T.lead.tgt.pids.length > 1),
    lead_rb_att: !!(T && att > 0 && T.lead.rb_att.pids.includes(String(pid))), lead_rb_att_tied: !!(T && T.lead.rb_att.pids.length > 1)
  };
}

const list = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// A few short notes about one week, compared with the weeks before it (`prev`, oldest first).
export function usageNotes(pos, r, prev = []) {
  if (!r) return [];
  const notes = [], team = r.team || 'his team';
  const played = prev.filter((x) => x.snaps > 0);
  if (!r.snaps && !r.tgt && !r.att) return ['Didn\'t play an offensive snap.'];
  // Role: snap share against his usual
  if (r.snap_pct != null) {
    const avg = played.length ? Math.round(played.reduce((a, x) => a + (x.snap_pct || 0), 0) / played.length) : null;
    const last = played.length ? played[played.length - 1].snap_pct : null;
    let s = `Played ${r.snaps} of ${team}'s ${r.tm_snaps} offensive snaps (${r.snap_pct}%)`;
    if (played.length >= 2 && avg != null && Math.abs(r.snap_pct - avg) >= 10) s += `, ${r.snap_pct > avg ? 'up' : 'down'} from his ${avg}% average before this week`;
    else if (played.length === 1 && last != null && Math.abs(r.snap_pct - last) >= 12) s += `, ${r.snap_pct > last ? 'up' : 'down'} from ${last}% the week before`;
    notes.push(s + '.');
  }
  // Targets
  if (r.tgt > 0 && (pos === 'WR' || pos === 'TE' || pos === 'RB')) {
    let s = `Drew ${plural(r.tgt, 'target', 'targets')}`;
    if (r.tgt_share != null) s += ` (${r.tgt_share}% of ${team}'s)`;
    if (r.lead_tgt) s += r.lead_tgt_tied ? ', tied for the team lead' : ', the most on the team';
    notes.push(s + '.');
  }
  // Carries
  if (r.att > 0 && pos === 'RB') {
    let s = `Carried ${plural(r.att, 'time', 'times')}`;
    if (r.att_share != null) s += ` (${r.att_share}% of ${team}'s runs)`;
    if (r.lead_rb_att) s += r.lead_rb_att_tied ? ', tied for the most among the backs' : ', the most among the backs';
    notes.push(s + '.');
  }
  // Season highs (once there's a season to compare against)
  if (played.length >= 2) {
    const hi = [];
    const top = (k) => Math.max(...played.map((x) => x[k] || 0));
    if (r.snaps > top('snaps')) hi.push('snaps');
    if (r.tgt > 0 && r.tgt > top('tgt')) hi.push('targets');
    if (pos === 'RB' && r.att > 0 && r.att > top('att')) hi.push('carries');
    if (hi.length) notes.push(`Season high in ${list(hi)}.`);
  }
  // Red zone
  const rz = r.rz_tgt + r.rz_att;
  if (rz >= 2) {
    const parts = [];
    if (r.rz_att) parts.push(plural(r.rz_att, 'carry', 'carries'));
    if (r.rz_tgt) parts.push(plural(r.rz_tgt, 'target', 'targets'));
    notes.push(`${rz} red-zone chances (${parts.join(', ')}).`);
  }
  // Downfield role
  if ((pos === 'WR' || pos === 'TE') && r.air >= 80) notes.push(`${r.air} air yards${r.air_share != null ? ` (${r.air_share}% of the team's)` : ''}.`);
  return notes.slice(0, 5);
}

// Team totals for one week, cached small. The current week reuses the shared live stat file.
const TT = new Map();
export async function teamWeek(season, week, { live = false } = {}) {
  const key = `${season}|${week}`, hit = TT.get(key);
  const maxAge = live ? 60 * 1000 : 6 * 60 * 60 * 1000;
  if (hit && Date.now() - hit.at < maxAge) return hit.data;
  if (TT_INFLIGHT.has(key)) return TT_INFLIGHT.get(key);
  const p = loadTeamWeek(key, season, week, live, hit);
  TT_INFLIGHT.set(key, p);
  try { return await p; } finally { TT_INFLIGHT.delete(key); }
}
const TT_INFLIGHT = new Map();
async function loadTeamWeek(key, season, week, live, hit) {
  try {
    const [wst, players] = await Promise.all([
      live ? weekStats(season, week, { live: true }) : sleeperOnce(`/stats/nfl/regular/${season}/${week}`),
      getPlayers().catch(() => ({}))]);
    const data = teamTotals(wst, players);
    TT.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) return hit.data;
    return {};
  }
}
