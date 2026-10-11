// Play-by-play for one player, Sleeper style: every snap he was part of, with the
// down & distance, game clock, score after the play, what he did, the fantasy points
// that play was worth (scored with OUR league settings) and his stat line at that moment.
//
// Source: ESPN's core API play list, which tags each play's participants with their ESPN
// athlete id and role (rusher, receiver, passer, kicker…). Sleeper's player database
// carries every player's espn_id, so matching is by id, not by name.
//   {CORE}/events/{id}/competitions/{id}/plays?limit=500
// One fetch covers both teams in a game, cached 10 s while it's live.
import { statLine } from './weekly.js';

const CORE = (process.env.ESPN_CORE_BASE || 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl').replace(/\/$/, '');
const cache = new Map(); // eventId -> { at, data }
const inflight = new Map();
export const clearPlaysCache = () => cache.clear(); // tests only

const athleteId = (ref) => { const m = /athletes\/(\d+)/.exec(ref || ''); return m ? m[1] : ''; };

export function normalize(item) {
  return {
    id: String(item.id || ''), seq: Number(item.sequenceNumber) || 0,
    type: item.type?.text || '', text: item.text || '', short: item.shortText || '',
    q: Number(item.period?.number) || 0, clock: item.clock?.displayValue || '',
    away: Number(item.awayScore) || 0, home: Number(item.homeScore) || 0,
    scoring: !!item.scoringPlay, scoreType: item.scoringType?.abbreviation || item.scoringType?.name || '',
    yds: Number(item.statYardage) || 0, turnover: !!item.isTurnover, penalty: !!item.isPenalty,
    start: { dd: item.start?.downDistanceText || '', distance: Number(item.start?.distance) || 0 },
    end: { dd: item.end?.downDistanceText || '' },
    parts: (item.participants || []).map((p) => ({ id: athleteId(p.athlete?.$ref), type: String(p.type || '') }))
  };
}

export async function gamePlays(eventId, { live = false } = {}) {
  if (!eventId) return [];
  const hit = cache.get(eventId);
  if (hit && Date.now() - hit.at < (live ? 10 * 1000 : 6 * 3600 * 1000)) return hit.data;
  if (inflight.has(eventId)) return inflight.get(eventId);
  const p = (async () => {
    try {
      const out = [];
      for (let page = 1; page <= 4; page++) {
        const res = await fetch(`${CORE}/events/${eventId}/competitions/${eventId}/plays?limit=500&page=${page}`, {
          headers: { accept: 'application/json', 'user-agent': 'MahomiesHub/1.9' }, signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) throw new Error(`ESPN plays ${res.status}`);
        const j = await res.json();
        for (const it of j.items || []) out.push(normalize(it));
        if (!(j.pageCount > page)) break;
      }
      out.sort((a, b) => a.seq - b.seq);
      cache.set(eventId, { at: Date.now(), data: out });
      return out;
    } catch (err) {
      if (hit) return hit.data;
      throw err;
    } finally { inflight.delete(eventId); }
  })();
  inflight.set(eventId, p);
  return p;
}

const isTD = (pl) => pl.scoring && (/TD|touchdown/i.test(pl.scoreType) || /touchdown/i.test(pl.type) || /touchdown/i.test(pl.text));
const fgKeys = (d, made) => {
  const pre = made ? 'fgm' : 'fgmiss';
  const k = {};
  k[pre] = 1;
  if (d) {
    if (d < 20) k[`${pre}_0_19`] = 1; else if (d < 30) k[`${pre}_20_29`] = 1; else if (d < 40) k[`${pre}_30_39`] = 1;
    else if (d < 50) k[`${pre}_40_49`] = 1; else { k[`${pre}_50p`] = 1; if (d < 60) k[`${pre}_50_59`] = 1; else k[`${pre}_60p`] = 1; }
    if (made) k.fgm_yds = d;
  }
  return k;
};

// "J.Warren" from "Jaylen Warren" — how ESPN's play text names players.
export const shortName = (name) => { const w = String(name || '').replace(/ (Jr\.|Sr\.|II|III|IV|V)$/, '').split(' ').filter(Boolean); return w.length > 1 ? `${w[0][0]}.${w.slice(1).join(' ')}` : (w[0] || ''); };

/**
 * What one play did for this player, as Sleeper stat keys. Returns null if he wasn't in it.
 */
export function playStats(pl, me) {
  const roles = pl.parts.filter((p) => me.espn && p.id === me.espn).map((p) => p.type);
  const s = {};
  const t = pl.type.toLowerCase();
  const td = isTD(pl);
  const fd = !td && pl.start.distance > 0 && pl.yds >= pl.start.distance;
  let what = '';
  // Kicker: field goals and extra points. Extra points ride on the touchdown play's text.
  if (me.pos === 'K') {
    const kick = roles.some((r) => /kick/i.test(r)) || (!pl.parts.length && pl.text.includes(me.abbr));
    if (kick && /field goal/i.test(t)) {
      const d = Number((/(\d+)[- ]?(?:yd|yard)/i.exec(pl.text) || [])[1]) || 0;
      const good = /good/i.test(t) || (pl.scoring && !/miss|block/i.test(t));
      Object.assign(s, fgKeys(d, good));
      what = `${d ? d + ' yd ' : ''}field goal ${good ? 'good' : /block/i.test(t + pl.text) ? 'blocked' : 'missed'}`;
      return { s, what };
    }
    const xp = new RegExp(`\\(${me.abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} kick\\)`, 'i');
    if (xp.test(pl.text) || (kick && /extra point/i.test(t))) {
      const good = !/no good|missed|blocked|failed/i.test(pl.text) || xp.test(pl.text);
      s[good ? 'xpm' : 'xpmiss'] = 1;
      return { s, what: good ? 'Extra point good' : 'Extra point missed' };
    }
    return null;
  }
  if (!roles.length) return null;
  const has = (r) => roles.includes(r);
  if (has('rusher') && !/sack/.test(t)) {
    s.rush_att = 1; s.rush_yd = pl.yds;
    if (td) s.rush_td = 1;
    if (pl.yds >= 40) s.rush_40p = 1;
    if (fd) s.rush_fd = 1;
    what = td ? `${pl.yds} yd rushing TD` : pl.yds > 0 ? `${pl.yds} yd rush` : pl.yds < 0 ? `rush for a loss of ${-pl.yds}` : 'stopped for no gain';
  }
  if (has('receiver')) {
    s.rec_tgt = 1;
    if (/incomplet/.test(t)) what = 'targeted, incomplete';
    else if (/intercept/.test(t)) what = 'targeted, intercepted';
    else {
      s.rec = 1; s.rec_yd = pl.yds;
      if (td) s.rec_td = 1;
      if (pl.yds >= 40) s.rec_40p = 1;
      if (fd) s.rec_fd = 1;
      if (me.pos === 'TE') s.bonus_rec_te = 1; else if (me.pos === 'RB') s.bonus_rec_rb = 1; else if (me.pos === 'WR') s.bonus_rec_wr = 1;
      what = td ? `${pl.yds} yd receiving TD` : `${pl.yds} yd catch`;
    }
  }
  if (has('passer')) {
    if (/sack/.test(t)) { s.pass_sack = 1; what = `sacked${pl.yds ? ' for ' + -pl.yds : ''}`; }
    else if (/intercept/.test(t)) { s.pass_att = 1; s.pass_int = 1; what = 'pass intercepted'; }
    else if (/incomplet/.test(t)) { s.pass_att = 1; s.pass_inc = 1; what = 'incomplete pass'; }
    else {
      s.pass_att = 1; s.pass_cmp = 1; s.pass_yd = pl.yds;
      if (td) s.pass_td = 1;
      if (pl.yds >= 40) s.pass_40p = 1;
      if (fd) s.pass_fd = 1;
      what = td ? `${pl.yds} yd TD pass` : `${pl.yds} yd completion`;
    }
  }
  if (roles.some((r) => /fumbl/i.test(r)) && /fumble/i.test(pl.text)) {
    s.fum = 1;
    if (pl.turnover) { s.fum_lost = 1; what = what ? `${what}, fumble lost` : 'fumble lost'; }
  }
  if (!Object.keys(s).length) return null;
  return { s, what };
}

const CROSS = [['rush_yd', 100, 'bonus_rush_yd_100'], ['rush_yd', 200, 'bonus_rush_yd_200'], ['rec_yd', 100, 'bonus_rec_yd_100'], ['rec_yd', 200, 'bonus_rec_yd_200'],
  ['pass_yd', 300, 'bonus_pass_yd_300'], ['pass_yd', 400, 'bonus_pass_yd_400']];

/**
 * The whole game for one player. me = { espn, abbr, pos, nfl }; g = ESPN game (home, teams).
 * Each entry: down & distance, quarter/clock, score after the play, what he did, the points,
 * running total and his stat line at that point. Oldest first.
 */
export function playerGameLog(plays, me, g, scoring) {
  const sc = scoring || {};
  const home = g?.home || '', away = (g?.teams || []).find((t) => t !== home) || '';
  const cum = {}; let total = 0; let prevEnd = '';
  const out = [];
  for (const pl of plays) {
    const dd = (pl.start.dd || prevEnd || '').replace(/ at /, ' @ ');
    if (pl.end.dd) prevEnd = pl.end.dd;
    if (pl.penalty && /no play/i.test(pl.text)) continue;
    const r = playStats(pl, me);
    if (!r) continue;
    const s = { ...r.s };
    for (const [k, line, bonus] of CROSS) if (s[k] && (cum[k] || 0) < line && (cum[k] || 0) + s[k] >= line) s[bonus] = 1;
    let pts = 0;
    for (const [k, v] of Object.entries(s)) { if (sc[k] != null) pts += v * sc[k]; cum[k] = (cum[k] || 0) + v; }
    pts = Math.round(pts * 100) / 100; total = Math.round((total + pts) * 100) / 100;
    out.push({
      id: pl.id, q: pl.q, clock: pl.clock, dd: /^\d/.test(dd) ? dd : '', what: r.what, text: pl.text, td: !!(s.rush_td || s.rec_td || s.pass_td),
      score: { away, home, a: pl.away, h: pl.home }, pts, total, line: statLine(me.pos, cum)
    });
  }
  return { plays: out, total };
}
