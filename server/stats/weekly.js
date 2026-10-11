// Real NFL stat lines for the Game Center.
//
// Sleeper publishes one file per week with every player's raw stats — carries, yards,
// catches, touchdowns — and it keeps updating while games are being played. One call
// covers the whole league, so this is far cheaper than asking per player.
//   /stats/nfl/regular/{season}/{week}   one week, live
//   /stats/nfl/regular/{season}          season totals (used for a player's form before kickoff)
//
// Team defenses sit in the same file under their NFL abbreviation ("DAL"), which is
// exactly how Sleeper ids a DEF on a fantasy roster, so they need no special handling.
import { sleeper } from '../sleeper/client.js';
import { liveAge } from '../book/kickoffs.js';

const MIN = 60 * 1000;
const WEEK = 7 * 24 * 60 * MIN;
const num = (s, k) => Number(s?.[k]) || 0;

export async function weekStats(season, week, { live = false } = {}) {
  return sleeper(`/stats/nfl/regular/${season}/${week}`, { maxAgeMs: live ? liveAge(45 * 1000) : WEEK }).catch(() => ({}));
}
export async function seasonStats(season) {
  return sleeper(`/stats/nfl/regular/${season}`, { maxAgeMs: 30 * MIN }).catch(() => ({}));
}

// Sleeper's totals include the bonus counters (bonus_rec_yd_100 and friends), so running
// them through the league's own scoring settings gives the player's points OUR way, not
// Sleeper's default PPR.
export function scoreTotals(totals, scoring) {
  if (!totals) return null;
  let pts = 0, hit = 0;
  for (const [k, v] of Object.entries(totals)) {
    if (typeof v !== 'number' || scoring?.[k] == null) continue;
    pts += v * scoring[k]; hit++;
  }
  // A handful of matches means we don't really have the league's scoring (or the player
  // barely did anything measurable), and a part-scored total is worse than none. Our
  // league is PPR, so Sleeper's own PPR number is the honest fallback.
  if (hit < 6) pts = num(totals, 'pts_ppr') || pts;
  return Math.round(pts * 10) / 10;
}

// A player's season so far: points a game our way, and the counting stats worth knowing.
export function seasonForm(pos, totals, scoring) {
  if (!totals) return null;
  const gp = num(totals, 'gp');
  if (!gp) return null;
  const pts = scoreTotals(totals, scoring);
  const bits = [];
  if (pos === 'DEF') {
    if (num(totals, 'sack')) bits.push(`${num(totals, 'sack')} sacks`);
    if (num(totals, 'int')) bits.push(`${num(totals, 'int')} INT`);
  } else if (pos === 'K') {
    if (num(totals, 'fga')) bits.push(`${num(totals, 'fgm')}/${num(totals, 'fga')} FG`);
  } else {
    const td = num(totals, 'pass_td') + num(totals, 'rush_td') + num(totals, 'rec_td');
    const yd = num(totals, 'pass_yd') + num(totals, 'rush_yd') + num(totals, 'rec_yd');
    if (yd) bits.push(`${yd} yds`);
    if (td) bits.push(`${td} TD`);
  }
  return { gp, pts, ppg: Math.round((pts / gp) * 10) / 10, line: bits.join(' · ') };
}

// One week's work, written the way a box score reads.
export function statLine(pos, s) {
  if (!s) return '';
  const out = [];
  const add = (v, label) => { if (v) out.push(`${v} ${label}`); };

  if (pos === 'DEF') {
    add(num(s, 'sack'), 'SACK');
    add(num(s, 'int'), 'INT');
    add(num(s, 'fum_rec'), 'FR');
    add(num(s, 'ff'), 'FF');
    add(num(s, 'def_td') || num(s, 'td'), 'TD');
    add(num(s, 'safe'), 'SAF');
    add(num(s, 'blk_kick'), 'BLK');
    if (s.pts_allow != null) out.push(`${num(s, 'pts_allow')} PTS ALW`);
    return out.join(', ');
  }
  if (pos === 'K') {
    if (num(s, 'fga')) out.push(`${num(s, 'fgm')}/${num(s, 'fga')} FG`);
    if (num(s, 'fgm_lng')) out.push(`LNG ${num(s, 'fgm_lng')}`);
    if (num(s, 'xpa')) out.push(`${num(s, 'xpm')}/${num(s, 'xpa')} XP`);
    return out.join(', ');
  }
  if (num(s, 'pass_att')) {
    out.push(`${num(s, 'pass_cmp')}/${num(s, 'pass_att')} CMP`, `${num(s, 'pass_yd')} YD`);
    add(num(s, 'pass_td'), 'TD');
    add(num(s, 'pass_int'), 'INT');
  }
  if (num(s, 'rush_att')) {
    out.push(`${num(s, 'rush_att')} CAR`, `${num(s, 'rush_yd')} YD`);
    add(num(s, 'rush_td'), 'TD');
  }
  if (num(s, 'rec_tgt') || num(s, 'rec')) {
    out.push(`${num(s, 'rec')}/${num(s, 'rec_tgt')} REC`, `${num(s, 'rec_yd')} YD`);
    add(num(s, 'rec_td'), 'TD');
  }
  add(num(s, 'fum_lost'), 'FUM LOST');
  return out.join(', ');
}

// The one thing that stands out from a week — used for the little highlight tag.
export function bigPlay(pos, s) {
  if (!s) return '';
  if (num(s, 'rush_40p') || num(s, 'rec_40p')) return '40+ yd play';
  const lng = Math.max(num(s, 'rush_lng'), num(s, 'rec_lng'));
  if (lng >= 40) return `${lng} yd play`;
  if (num(s, 'bonus_rush_yd_100') || num(s, 'bonus_rec_yd_100')) return '100 yd game';
  if (num(s, 'bonus_pass_yd_300')) return '300 yd game';
  const td = num(s, 'anytime_tds') || (num(s, 'rush_td') + num(s, 'rec_td'));
  if (td >= 2) return `${td} TD day`;
  return '';
}
