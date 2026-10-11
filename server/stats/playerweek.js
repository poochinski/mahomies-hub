// One player's week, for the sheet that opens when you tap his row in Slot vs slot:
// points (Sleeper's number), where he's headed, his box score, snap share, his NFL game,
// and his play-by-play for the game (ESPN), scored our way.
import { league, matchups, projections } from '../book/data.js';
import { kickoffs, kickShort, liveAge } from '../book/kickoffs.js';
import { weekStats, statLine, bigPlay } from './weekly.js';
import { getPlayers } from '../sleeper/client.js';
import { gamePlays, playerGameLog, shortName } from './plays.js';

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
  // Play by play from ESPN (not for team defenses — they score as a unit).
  let log = null, logErr = '';
  if (!isDef && g && g.state !== 'pre' && g.id) {
    try {
      const plays = await gamePlays(g.id, { live: g.state === 'in' });
      log = playerGameLog(plays, { espn: players[pid]?.e || '', abbr: shortName(players[pid]?.n || ''), pos, nfl }, g, L.scoring);
    } catch (err) { logErr = 'Play-by-play isn\'t reachable right now.'; console.error('plays', err.message); }
  }
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
    plays: log ? log.plays : [], plays_total: log ? log.total : null, plays_err: logErr, def: isDef,
    updated: new Date().toISOString()
  };
}

// ---------- Score breakdown (tap the points) ----------
// Every scoring stat he has this week × what our league pays for it, like Sleeper's
// "Score Breakdown". Totals are checked against Sleeper's own number for him.
const LABEL = {
  pass_yd: 'Passing yards', pass_td: 'Passing TD', pass_int: 'Interceptions', pass_2pt: '2-pt pass', pass_cmp: 'Completions', pass_att: 'Pass attempts',
  pass_inc: 'Incompletions', pass_sack: 'Sacked', pass_fd: 'Passing first downs', pass_40p: '40+ yd pass bonus', pass_cmp_40p: '40+ yd completion bonus', pass_td_40p: '40+ yd TD pass bonus',
  pass_int_td: 'Pick six thrown', bonus_pass_yd_300: '300+ passing yards bonus', bonus_pass_yd_400: '400+ passing yards bonus', bonus_pass_cmp_25: '25+ completions bonus',
  rush_yd: 'Rushing yards', rush_td: 'Rushing TD', rush_att: 'Rush attempts', rush_2pt: '2-pt rush', rush_fd: 'Rushing first downs', rush_40p: '40+ yd rush bonus',
  rush_td_40p: '40+ yd rushing TD bonus', bonus_rush_yd_100: '100+ rushing yards bonus', bonus_rush_yd_200: '200+ rushing yards bonus', bonus_rush_att_20: '20+ carries bonus',
  rec: 'Receptions', rec_yd: 'Receiving yards', rec_td: 'Receiving TD', rec_2pt: '2-pt catch', rec_fd: 'Receiving first downs', rec_40p: '40+ yd catch bonus',
  rec_td_40p: '40+ yd receiving TD bonus', bonus_rec_yd_100: '100+ receiving yards bonus', bonus_rec_yd_200: '200+ receiving yards bonus', rec_tgt: 'Targets',
  bonus_rec_te: 'TE reception bonus', bonus_rec_rb: 'RB reception bonus', bonus_rec_wr: 'WR reception bonus', fum: 'Fumbles', fum_lost: 'Fumbles lost', fum_rec_td: 'Fumble recovery TD',
  fgm: 'Field goals made', fgmiss: 'Field goals missed', xpm: 'Extra points made', xpmiss: 'Extra points missed', fgm_yds: 'FG yards',
  fgm_0_19: 'FG made 0–19', fgm_20_29: 'FG made 20–29', fgm_30_39: 'FG made 30–39', fgm_40_49: 'FG made 40–49', fgm_50_59: 'FG made 50–59', fgm_60p: 'FG made 60+', fgm_50p: 'FG made 50+',
  fgmiss_0_19: 'FG missed 0–19', fgmiss_20_29: 'FG missed 20–29', fgmiss_30_39: 'FG missed 30–39', fgmiss_40_49: 'FG missed 40–49', fgmiss_50p: 'FG missed 50+',
  sack: 'Sacks', int: 'Interceptions', fum_rec: 'Fumble recoveries', ff: 'Forced fumbles', def_td: 'Defensive TD', st_td: 'Special teams TD', safe: 'Safeties',
  blk_kick: 'Blocked kicks', def_st_td: 'Def/ST TD', def_st_ff: 'Def/ST forced fumbles', def_st_fum_rec: 'Def/ST fumble recoveries', int_ret_yd: 'INT return yards',
  pts_allow_0: 'Points allowed 0', pts_allow_1_6: 'Points allowed 1–6', pts_allow_7_13: 'Points allowed 7–13', pts_allow_14_20: 'Points allowed 14–20',
  pts_allow_21_27: 'Points allowed 21–27', pts_allow_28_34: 'Points allowed 28–34', pts_allow_35p: 'Points allowed 35+',
  yds_allow_0_100: 'Yards allowed 0–99', yds_allow_100_199: 'Yards allowed 100–199', yds_allow_200_299: 'Yards allowed 200–299', yds_allow_300_349: 'Yards allowed 300–349',
  yds_allow_350_399: 'Yards allowed 350–399', yds_allow_400_449: 'Yards allowed 400–449', yds_allow_450_499: 'Yards allowed 450–499', yds_allow_500_549: 'Yards allowed 500–549', yds_allow_550p: 'Yards allowed 550+',
  kr_yd: 'Kick return yards', pr_yd: 'Punt return yards', idp_tkl: 'Tackles'
};
const pretty = (k) => LABEL[k] || k.replace(/^bonus_/, '').split('_').map((w) => (/^(td|fg|xp|int|yd|yds|fd|st|def|2pt)$/i.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(' ');

export async function scoreBreakdown(pid, week) {
  const L = await league();
  const w = Number(week) || L.nflWeek;
  const live = w >= L.nflWeek;
  pid = String(pid);
  const [ms, players, wst] = await Promise.all([matchups(L.leagueId, w, live ? liveAge(45 * 1000) : 60 * 1000), getPlayers().catch(() => ({})), weekStats(L.season, w, { live })]);
  const s = wst?.[pid] || {};
  const sc = L.scoring || {};
  const rows = [];
  for (const [k, per] of Object.entries(sc)) {
    const v = Number(s[k]);
    if (!per || !v) continue;
    rows.push({ k, label: pretty(k), stat: Math.round(v * 100) / 100, per, pts: Math.round(v * per * 100) / 100 });
  }
  rows.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
  const sum = Math.round(rows.reduce((a, r) => a + r.pts, 0) * 100) / 100;
  const m = ms.find((x) => (x.players || []).map(String).includes(pid));
  const sleeperPts = m ? Math.round(Number((m.players_points || {})[pid] || 0) * 100) / 100 : null;
  return { pid, week: w, name: players[pid]?.n || pid, pos: /^[A-Z]{2,3}$/.test(pid) ? 'DEF' : players[pid]?.p || '', rows, total: sum, sleeper: sleeperPts, updated: new Date().toISOString() };
}
