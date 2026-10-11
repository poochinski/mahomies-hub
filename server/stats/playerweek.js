// One player's week, for the sheet that opens when you tap his row in Slot vs slot:
// points (Sleeper's number), where he's headed, his box score, snap share, his NFL game,
// and the scoring timeline the server has been logging.
import { league, matchups, projections } from '../book/data.js';
import { kickoffs, kickShort, liveAge } from '../book/kickoffs.js';
import { weekStats, statLine, bigPlay } from './weekly.js';
import { getPlayers } from '../sleeper/client.js';
import { timelineFor } from './timeline.js';

const num = (s, k) => Number(s?.[k]) || 0;
const r1 = (x) => Math.round(Number(x) * 10) / 10;

// The box score as label/value tiles, only the ones he actually has.
function boxTiles(pos, s) {
  if (!s) return [];
  const t = [];
  const add = (label, v, show = v) => { if (show) t.push({ k: label, v: String(v) }); };
  if (pos === 'DEF') {
    add('Pts allowed', num(s, 'pts_allow'), s.pts_allow != null);
    add('Yds allowed', num(s, 'yds_allow'), s.yds_allow != null);
    add('Sacks', num(s, 'sack')); add('INT', num(s, 'int')); add('Fum rec', num(s, 'fum_rec'));
    add('Def TD', num(s, 'def_td')); add('Safety', num(s, 'safe')); add('Blocks', num(s, 'blk_kick'));
    return t;
  }
  if (pos === 'K') {
    add('FG', `${num(s, 'fgm')}/${num(s, 'fga')}`, num(s, 'fga'));
    add('Long', num(s, 'fgm_lng')); add('XP', `${num(s, 'xpm')}/${num(s, 'xpa')}`, num(s, 'xpa'));
    add('40–49', num(s, 'fgm_40_49')); add('50+', num(s, 'fgm_50p'));
    return t;
  }
  if (num(s, 'pass_att')) {
    add('Comp', `${num(s, 'pass_cmp')}/${num(s, 'pass_att')}`, 1); add('Pass yds', num(s, 'pass_yd'), 1);
    add('Pass TD', num(s, 'pass_td')); add('INT', num(s, 'pass_int')); add('Sacked', num(s, 'pass_sack'));
  }
  if (num(s, 'rush_att')) {
    add('Carries', num(s, 'rush_att'), 1); add('Rush yds', num(s, 'rush_yd'), 1); add('Rush TD', num(s, 'rush_td'));
    add('Long run', num(s, 'rush_lng')); add('YPC', r1(num(s, 'rush_yd') / num(s, 'rush_att')), 1);
  }
  if (num(s, 'rec_tgt') || num(s, 'rec')) {
    add('Catches', `${num(s, 'rec')}/${num(s, 'rec_tgt')}`, 1); add('Rec yds', num(s, 'rec_yd'), 1); add('Rec TD', num(s, 'rec_td'));
    add('Long catch', num(s, 'rec_lng')); add('Red zone tgt', num(s, 'rec_rz_tgt'));
  }
  add('Fum lost', num(s, 'fum_lost'));
  return t;
}

function snaps(pos, s) {
  if (!s) return null;
  const pair = pos === 'DEF' ? null : pos === 'K' ? ['st_snp', 'tm_st_snp'] : ['off_snp', 'tm_off_snp'];
  if (!pair) return null;
  const n = num(s, pair[0]), of = num(s, pair[1]);
  if (!n || !of) return null;
  return { n, of, pct: Math.round((n / of) * 100) };
}

export async function playerWeek(pid, week) {
  const L = await league();
  const w = Number(week) || L.nflWeek;
  const live = w >= L.nflWeek;
  pid = String(pid);
  const [k, ms, players, proj, wst] = await Promise.all([
    kickoffs(L.season, w, { maxAgeMs: liveAge(45 * 1000) }).catch(() => ({ gameOf: {} })),
    matchups(L.leagueId, w, live ? liveAge(45 * 1000) : 60 * 1000), getPlayers().catch(() => ({})), projections(L, w),
    weekStats(L.season, w, { live })]);
  const isDef = /^[A-Z]{2,3}$/.test(pid);
  const pos = isDef ? 'DEF' : players[pid]?.p || '';
  const nfl = isDef ? pid : players[pid]?.t || '';
  const g = k.gameOf?.[nfl];
  const opp = g ? (g.teams.find((t) => t !== nfl) || '') : '';
  const m = ms.find((x) => (x.players || []).map(String).includes(pid));
  const pts = m ? Number((m.players_points || {})[pid] || 0) : 0;
  const pj = proj[pid] ?? null;
  const prog = g ? g.progress : 1;
  const s = wst?.[pid];
  let status = 'Bye';
  if (g && g.state === 'pre') status = kickShort(g.at);
  else if (g && g.state === 'in') status = g.detail || 'Live';
  else if (g) status = 'Final';
  const si = m ? (m.starters || []).map(String).indexOf(pid) : -1;
  return {
    pid, week: w, name: players[pid]?.n || pid, pos, nfl, inj: players[pid]?.i || null,
    team: m ? (L.teams[L.owner[m.roster_id]]?.team || '') : '', uid: m ? L.owner[m.roster_id] : null,
    slot: si >= 0 ? (L.slots[si] || 'FLEX') : m ? 'BN' : '',
    state: g ? g.state : 'bye', status,
    game: g && opp ? { opp: (g.home === nfl ? 'vs ' : '@ ') + opp, score: g.state !== 'pre' ? `${nfl} ${g.score?.[nfl] ?? 0} – ${g.score?.[opp] ?? 0} ${opp}` : '' } : null,
    pts: Math.round(pts * 100) / 100,
    proj: pj == null ? null : r1(pj),
    pace: !g || g.state === 'post' ? null : pj == null ? null : r1(pts + pj * (1 - prog)),
    line: statLine(pos, s), big: s ? bigPlay(pos, s) : '', box: boxTiles(pos, s), snaps: snaps(pos, s),
    timeline: await timelineFor(L.season, w, pid).catch(() => []),
    updated: new Date().toISOString()
  };
}
