// Front Office records: the twenty boards that grade managers on the moves they made
// rather than the points their teams happened to score.
//   GET /api/records/frontoffice
//
// Everything here is built from two things we already pull from Sleeper: every completed
// transaction in league history (leagueIndex) and every graded draft (draft.js). Nothing
// new gets fetched.
//
// The one rule that runs through all of it: a move is worth the points it actually put in
// your STARTING lineup. Points a guy scored on your bench never helped you win a game, so
// they don't count here. And letting a player go costs you the points he went on to start
// for somebody else that season.
import { leagueIndex } from '../player.js';
import { getPlayers } from '../sleeper/client.js';
import { draftSeason } from '../draft.js';

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const CACHE_MS = 15 * 60 * 1000;
const nameOf = (players, id) => players[id]?.n || (/^[A-Z]{2,3}$/.test(id) ? `${id} defense` : `Player ${id}`);
const posOf = (players, id) => (/^[A-Z]{2,3}$/.test(id) ? 'DEF' : players[id]?.p || '');
const plus = (n) => (n > 0 ? `+${r1(n).toFixed(1)}` : r1(n).toFixed(1));
const pl = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

// ---------- the lineups, week by week ----------
// L[week][roster_id] = { st: Set of starter ids, pp: { player id -> points } }
function lineups(S) {
  const L = {}; let maxW = 0;
  for (const [w, ms] of Object.entries(S.weeks)) {
    const week = Number(w); if (!ms || !ms.length) continue;
    const row = (L[week] = {});
    for (const m of ms) {
      const pp = { ...(m.players_points || {}) };
      (m.starters || []).forEach((p, i) => { if (p && p !== '0' && pp[p] == null) pp[p] = (m.starters_points || [])[i] || 0; });
      row[m.roster_id] = { st: new Set((m.starters || []).map(String).filter((x) => x && x !== '0')), pp };
      if ((m.starters || []).some((x) => x && x !== '0')) maxW = Math.max(maxW, week);
    }
  }
  return { L, maxW };
}

// Points a player put in one roster's starting lineup over a stretch of weeks.
function startedFor(S, pid, rid, from, to) {
  let pts = 0, starts = 0;
  for (let w = Math.max(1, from); w <= to; w++) {
    const r = S.L[w]?.[rid]; if (!r || !r.st.has(pid)) continue;
    pts += Number(r.pp[pid]) || 0; starts++;
  }
  return { pts: r2(pts), starts };
}

// Points a player put in anybody ELSE's starting lineup from this week on — what letting him go cost.
function startedElsewhere(S, pid, notRid, from) {
  let pts = 0, starts = 0; const by = {};
  for (let w = Math.max(1, from); w <= S.maxW; w++) {
    for (const [rid, r] of Object.entries(S.L[w] || {})) {
      if (Number(rid) === Number(notRid) || !r.st.has(pid)) continue;
      const v = Number(r.pp[pid]) || 0;
      pts += v; starts++; by[rid] = (by[rid] || 0) + v;
    }
  }
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  return { pts: r2(pts), starts, for_uid: top ? S.owner[top[0]] || null : null };
}

// ---------- read every move in league history ----------
function readSeason(S, players) {
  const done = S.tx.filter((t) => t.status === 'complete' && t.type !== 'commissioner');

  // When a player arrived on, and left, each roster — so a guy added twice isn't counted twice.
  const ev = {};
  for (const t of done) {
    for (const [pid, rid] of Object.entries(t.adds || {})) (ev[pid] ||= []).push({ w: t.week, at: t.created || 0, rid, dir: 1 });
    for (const [pid, rid] of Object.entries(t.drops || {})) (ev[pid] ||= []).push({ w: t.week, at: t.created || 0, rid, dir: -1 });
  }
  for (const list of Object.values(ev)) list.sort((a, b) => a.at - b.at || a.w - b.w);
  // Last week a player was on this roster after arriving in week `from`.
  const until = (pid, rid, from, at) => {
    const out = (ev[pid] || []).find((e) => e.dir === -1 && Number(e.rid) === Number(rid) && e.at > at);
    return out ? Math.max(from, out.w - 1) : S.maxW;
  };

  const info = (pid) => ({ pid, name: nameOf(players, pid), pos: posOf(players, pid) });
  const adds = [], lets = [], trades = [];

  for (const t of done) {
    const at = t.created || 0;
    if (t.type === 'trade') {
      const rids = t.roster_ids || [];
      const sides = rids.map((rid) => {
        const got = Object.keys(t.adds || {}).filter((p) => t.adds[p] === rid);
        const gave = Object.keys(t.drops || {}).filter((p) => t.drops[p] === rid && t.adds?.[p] != null && t.adds[p] !== rid);
        let gain = 0; const players_got = [];
        for (const pid of got) {
          const g = startedFor(S, pid, rid, t.week, until(pid, rid, t.week, at));
          gain += g.pts; players_got.push({ ...info(pid), pts: g.pts, starts: g.starts });
        }
        players_got.sort((a, b) => b.pts - a.pts);
        return { uid: S.owner[rid] || null, rid, gain: r2(gain), got: players_got, gave: gave.map(info) };
      }).filter((s) => s.uid);
      if (sides.length >= 2) trades.push({ season: S.season, week: t.week, at, sides });
      continue;
    }
    // Waivers and free agents
    for (const [pid, rid] of Object.entries(t.adds || {})) {
      const to = until(pid, rid, t.week, at);
      const g = startedFor(S, pid, rid, t.week, to);
      adds.push({ season: S.season, week: t.week, at, ...info(pid), uid: S.owner[rid] || null, rid,
        bid: t.type === 'waiver' ? Number(t.settings?.waiver_bid ?? 0) : 0, type: t.type,
        pts: g.pts, starts: g.starts, held: Math.max(0, to - t.week + 1) });
    }
    for (const [pid, rid] of Object.entries(t.drops || {})) {
      const e = startedElsewhere(S, pid, rid, t.week);
      if (e.pts > 0) lets.push({ season: S.season, week: t.week, ...info(pid), uid: S.owner[rid] || null, ...e });
    }
  }
  return { adds, lets, trades, moves: done };
}

// ---------- board helpers ----------
const board = (key, title, kicker, unit, subject, note, rows) =>
  ({ key, title, kicker, unit, subject, note, rows: rows.filter(Boolean).slice(0, 10) });
const top = (arr, score, n = 10) => arr.slice().sort((a, b) => score(b) - score(a)).slice(0, n);
const bottom = (arr, score, n = 10) => arr.slice().sort((a, b) => score(a) - score(b)).slice(0, n);

let CACHE = null, AT = 0;
export async function frontOffice({ fresh = false } = {}) {
  if (!fresh && CACHE && Date.now() - AT < CACHE_MS) return CACHE;
  const [idx, players] = await Promise.all([leagueIndex(), getPlayers().catch(() => ({}))]);

  // Every season's moves
  const seasons = [];
  for (const raw of idx.seasons) {
    const { L, maxW } = lineups(raw);
    const S = { ...raw, L, maxW };
    seasons.push({ S, ...readSeason(S, players) });
  }
  const allAdds = seasons.flatMap((x) => x.adds);
  const allLets = seasons.flatMap((x) => x.lets);
  const allTrades = seasons.flatMap((x) => x.trades);

  // Every draft we have, already graded
  const drafts = [];
  for (const raw of idx.seasons) {
    try { const d = await draftSeason(raw.season); if (d.has_draft) drafts.push(d); } catch { /* no draft that year */ }
  }

  // ---------- per-manager running totals ----------
  const M = {};
  const mg = (uid) => (M[uid] ||= { uid, trades: 0, moves: 0, trade_edge: 0, add_pts: 0, let_pts: 0, faab: 0, faab_pts: 0, faab_adds: 0, adds: 0, drops: 0 });
  for (const sea of seasons) {
    for (const t of sea.moves) {
      const seen = new Set();
      for (const rid of t.roster_ids || []) { const u = sea.S.owner[rid]; if (u && !seen.has(u)) { seen.add(u); mg(u).moves++; } }
    }
    for (const a of sea.adds) { if (!a.uid) continue; const m = mg(a.uid); m.adds++; m.add_pts += a.pts; if (a.bid > 0) { m.faab += a.bid; m.faab_pts += a.pts; m.faab_adds++; } }
    for (const l of sea.lets) { if (!l.uid) continue; mg(l.uid).let_pts += l.pts; mg(l.uid).drops++; }
    for (const t of sea.trades) {
      const ranked = t.sides.slice().sort((a, b) => b.gain - a.gain);
      for (const s of t.sides) {
        const best = ranked.find((x) => x.uid !== s.uid);
        s.edge = r2(s.gain - (best ? best.gain : 0));
        s.season = t.season; s.week = t.week;
        const m = mg(s.uid); m.trades++; m.trade_edge += s.edge;
      }
    }
  }
  const mgrs = Object.values(M).map((m) => ({ ...m,
    trade_edge: r1(m.trade_edge), add_pts: r1(m.add_pts), let_pts: r1(m.let_pts), faab_pts: r1(m.faab_pts),
    wire: r1(m.add_pts - m.let_pts), per_dollar: m.faab ? r2(m.faab_pts / m.faab) : null }));

  // Trade partners, both ways
  const pair = {};
  for (const t of allTrades) {
    const us = t.sides.map((s) => s.uid).filter(Boolean);
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const k = [us[i], us[j]].sort().join('|');
      (pair[k] ||= { uid: k.split('|')[0], uid2: k.split('|')[1], n: 0, seasons: new Set() }).n++;
      pair[k].seasons.add(t.season);
    }
  }

  // Draft rollups
  const dAll = {}, dSeason = [], dPos = {}, keepers = [], picks = [];
  for (const d of drafts) {
    for (const m of d.managers) {
      const a = (dAll[m.uid] ||= { uid: m.uid, picks: 0, value: 0, hits: 0, misses: 0, seasons: 0 });
      a.picks += m.picks; a.value += m.value; a.hits += m.hits; a.misses += m.misses; a.seasons++;
      dSeason.push({ uid: m.uid, season: d.season, value: m.value, picks: m.picks, hits: m.hits, misses: m.misses, grade: m.grade });
      for (const bp of m.by_pos) {
        const k = m.uid + '|' + bp.pos;
        const p = (dPos[k] ||= { uid: m.uid, pos: bp.pos, picks: 0, value: 0 });
        p.picks += bp.picks; p.value += bp.value;
      }
    }
    for (const p of d.picks) {
      if (p.keeper) { if (p.points > 0) keepers.push({ ...p, season: d.season }); continue; }
      if (p.value != null) picks.push({ ...p, season: d.season });
    }
  }
  const drafters = Object.values(dAll).map((a) => ({ ...a, value: r1(a.value), per_pick: r1(a.value / Math.max(1, a.picks)) }));
  const posTable = Object.values(dPos).map((p) => ({ ...p, value: r1(p.value) }));

  // ---------- the boards ----------
  const mRow = (m, v, vfmt, sub) => ({ uid: m.uid, v: r1(v), vfmt, sub });
  const sw = (x) => `${x.season} wk ${x.week}`;

  const B = {};
  const put = (b) => { B[b.key] = b; return b.key; };

  // Activity — plain counting records, so they keep their plain names.
  put(board('fo:trades', 'Most trades', 'Every season on Sleeper', 'trades', 'manager',
    'One trade counts once for each manager in it.',
    top(mgrs, (m) => m.trades).filter((m) => m.trades).map((m) => mRow(m, m.trades, String(m.trades), pl(m.trades, 'trade') + ' made'))));

  put(board('fo:moves', 'Most roster moves', 'Trades, waivers and free agents', 'moves', 'manager',
    'Every completed transaction a manager was part of.',
    top(mgrs, (m) => m.moves).filter((m) => m.moves).map((m) => mRow(m, m.moves, String(m.moves),
      `${pl(m.adds, 'add')}, ${pl(m.drops, 'drop')}, ${pl(m.trades, 'trade')}`))));

  // Trades
  put(board('fo:buddies', 'Trade buddies', 'Who keeps calling who', 'trades', 'pair',
    'The two managers who have swapped players the most.',
    top(Object.values(pair), (p) => p.n).map((p) => ({ uid: p.uid, uid2: p.uid2, v: p.n, vfmt: String(p.n),
      sub: pl(p.n, 'trade') + ' · ' + [...p.seasons].sort().join(', ') }))));

  put(board('fo:career', 'Best trader', 'All-time, every trade added up', 'points', 'manager',
    'A trade is worth the points your new players started for you, against the points the guys you sent out started for him. Add every trade up.',
    top(mgrs.filter((m) => m.trades), (m) => m.trade_edge).map((m) => mRow(m, m.trade_edge, plus(m.trade_edge),
      `${pl(m.trades, 'trade')} · ${plus(r1(m.trade_edge / m.trades))} a trade`))));

  const sides = allTrades.flatMap((t) => t.sides.map((s) => ({ ...s, other: t.sides.filter((x) => x.uid !== s.uid) })));
  const sideRow = (s) => ({ uid: s.uid, v: r1(s.edge), vfmt: plus(s.edge), pid: s.got[0]?.pid || null,
    sub: (s.got.length ? 'Got ' + s.got.slice(0, 2).map((p) => p.name).join(' + ') + (s.got.length > 2 ? ` +${s.got.length - 2} more` : '') : 'Got picks') +
      ' from ' + (s.other[0]?.uid ? '{{' + s.other[0].uid + '}}' : 'the league') + ' · ' + sw(s) });
  put(board('fo:heist', 'The robbery', 'The most lopsided trade we have on record', 'points', 'manager',
    'One trade, one side. The gap between what he got out of it and what the other guy did.',
    top(sides, (s) => s.edge).filter((s) => s.edge > 0).map(sideRow)));
  put(board('fo:regret', 'The one he regrets', 'The other end of the robbery', 'points', 'manager',
    'Same math as The robbery, from the losing side.',
    bottom(sides, (s) => s.edge).filter((s) => s.edge < 0).map(sideRow)));

  // Waivers and FAAB
  put(board('fo:wire', 'Best on the wire', 'Pickups minus the ones he let go', 'points', 'manager',
    'Points his waiver and free-agent adds started for him, minus the points the players he dropped went on to start for somebody else.',
    top(mgrs.filter((m) => m.adds || m.drops), (m) => m.wire).map((m) => mRow(m, m.wire, plus(m.wire),
      `${plus(m.add_pts)} from ${pl(m.adds, 'pickup')} · ${m.let_pts ? '-' + r1(m.let_pts).toFixed(1) + ' let go' : 'nothing let go'}`))));

  put(board('fo:grab', 'Best free agent grab', 'One pickup, off the scrap heap', 'points started', 'player',
    'The most points any single waiver or free-agent add went on to start for the manager who claimed him.',
    top(allAdds, (a) => a.pts).filter((a) => a.pts > 0).map((a) => ({ uid: a.uid, pid: a.pid, v: r1(a.pts), vfmt: r1(a.pts).toFixed(1),
      sub: `${a.name}${a.pos ? ' (' + a.pos + ')' : ''} · ${a.bid > 0 ? '$' + a.bid : 'free agent'} · added ${sw(a)}` }))));

  put(board('fo:gotaway', 'Dropped too soon', 'What letting him go cost', 'points elsewhere', 'player',
    'Points the player went on to start for a different team in the same season after being dropped.',
    top(allLets, (l) => l.pts).map((l) => ({ uid: l.uid, pid: l.pid, v: r1(l.pts), vfmt: '-' + r1(l.pts).toFixed(1),
      sub: `${l.name}${l.pos ? ' (' + l.pos + ')' : ''} · dropped ${sw(l)} · started ${pl(l.starts, 'week')} for ${l.for_uid ? '{{' + l.for_uid + '}}' : 'somebody else'}` }))));

  put(board('fo:bid', 'Biggest FAAB bid', 'Most Mahomie-free dollars ever spent on one guy', 'dollars', 'player',
    'Waiver budget is separate from Mahomie Bucks — this is the in-league FAAB bid Sleeper recorded.',
    top(allAdds.filter((a) => a.bid > 0), (a) => a.bid).map((a) => ({ uid: a.uid, pid: a.pid, v: a.bid, vfmt: '$' + a.bid,
      sub: `${a.name}${a.pos ? ' (' + a.pos + ')' : ''} · ${r1(a.pts).toFixed(1)} points started · ${sw(a)}` }))));

  const paid = allAdds.filter((a) => a.bid > 0);
  put(board('fo:spent', 'Best money spent', 'The bid that paid for itself', 'points started', 'player',
    'Among players somebody actually bid on, the most points one of them started for the buyer.',
    top(paid, (a) => a.pts).filter((a) => a.pts > 0).map((a) => ({ uid: a.uid, pid: a.pid, v: r1(a.pts), vfmt: r1(a.pts).toFixed(1),
      sub: `${a.name}${a.pos ? ' (' + a.pos + ')' : ''} · $${a.bid} · ${r2(a.pts / a.bid)} points a dollar · ${sw(a)}` }))));

  put(board('fo:wasted', 'Worst money spent', 'Paid up, got nothing', 'dollars', 'player',
    'Bids of $10 or more that gave the buyer the fewest starting-lineup points. Big money, empty lineup.',
    paid.filter((a) => a.bid >= 10).sort((a, b) => a.pts - b.pts || b.bid - a.bid).slice(0, 10).map((a) => ({ uid: a.uid, pid: a.pid, v: a.bid, vfmt: '$' + a.bid,
      sub: `${a.name}${a.pos ? ' (' + a.pos + ')' : ''} · ${r1(a.pts).toFixed(1)} points started · ${sw(a)}` }))));

  put(board('fo:perdollar', 'Points per dollar', 'Who shops smart', 'points per $', 'manager',
    'Starting-lineup points from his FAAB claims divided by every dollar he bid. Needs at least $50 spent.',
    top(mgrs.filter((m) => m.faab >= 50), (m) => m.per_dollar).map((m) => mRow(m, m.per_dollar, r2(m.per_dollar).toFixed(2),
      `$${m.faab} on ${pl(m.faab_adds, 'claim')} · ${plus(m.faab_pts)} points`))));

  // Draft
  const pickRow = (p) => ({ uid: p.uid, pid: p.pid, v: r1(p.value), vfmt: plus(p.value),
    sub: `${p.name}${p.pos ? ' (' + p.pos + ')' : ''} · ${p.season} rd ${p.round} · ${r1(p.points).toFixed(1)} pts` });
  put(board('fo:steal', 'Steal of the draft', 'All-time best value pick', 'points above the slot', 'player',
    'How far a pick beat what that slot was worth — the player who finished that high among the picks people actually made. Keepers are left out.',
    top(picks, (p) => p.value).map(pickRow)));
  put(board('fo:bust', 'Draft day bust', 'All-time worst value pick', 'points below the slot', 'player',
    'Same math as Steal of the draft, from the wrong end.',
    bottom(picks, (p) => p.value).map(pickRow)));

  put(board('fo:keeper', 'Best keeper call', 'The guy he was right to hang on to', 'points kept', 'player',
    'A keeper costs you a pick instead of being graded against one, so this is simply the points he scored the year he was kept.',
    top(keepers, (k) => k.points).map((k) => ({ uid: k.uid, pid: k.pid, v: r1(k.points), vfmt: r1(k.points).toFixed(1),
      sub: `${k.name}${k.pos ? ' (' + k.pos + ')' : ''} · kept in ${k.season}` }))));

  put(board('fo:drafter', 'Best drafter', 'Every draft we have, per pick', 'points per pick', 'manager',
    'Total value of his live picks divided by how many he made. Needs at least 15 picks.',
    top(drafters.filter((d) => d.picks >= 15), (d) => d.per_pick).map((d) => ({ uid: d.uid, v: r1(d.per_pick), vfmt: plus(d.per_pick),
      sub: `${pl(d.picks, 'pick')} over ${pl(d.seasons, 'draft')} · ${plus(d.value)} total` }))));

  const nightRow = (x) => ({ uid: x.uid, v: r1(x.value), vfmt: plus(x.value),
    sub: `${x.season} · grade ${x.grade} · ${x.hits} hit, ${x.misses} miss in ${pl(x.picks, 'pick')}` });
  put(board('fo:bestnight', 'Best draft night', 'One manager, one draft', 'points above the slots', 'manager',
    'Add up the value of everything one manager drafted in a single year.', top(dSeason, (x) => x.value).map(nightRow)));
  put(board('fo:worstnight', 'Worst draft night', 'The one he wants back', 'points below the slots', 'manager',
    'Same as Best draft night, from the bottom.', bottom(dSeason, (x) => x.value).map(nightRow)));

  put(board('fo:specialist', 'Position specialist', 'Nobody drafts this spot better', 'points above the slots', 'manager',
    'One manager, one position, every draft added up. Needs at least 5 picks there.',
    top(posTable.filter((p) => p.picks >= 5), (p) => p.value).map((p) => ({ uid: p.uid, v: r1(p.value), vfmt: plus(p.value), pos: p.pos,
      sub: `${p.pos} · ${pl(p.picks, 'pick')} · ${plus(r1(p.value / p.picks))} a pick` }))));

  const out = {
    version: '2.5',
    seasons: idx.seasons.map((s) => s.season),
    first: idx.seasons[idx.seasons.length - 1]?.season || null,
    drafts: drafts.map((d) => d.season),
    groups: [
      { key: 'activity', title: 'Activity', boards: ['fo:trades', 'fo:moves'] },
      { key: 'trades', title: 'Trades', boards: ['fo:career', 'fo:heist', 'fo:regret', 'fo:buddies'] },
      { key: 'wire', title: 'Waivers & FAAB', boards: ['fo:wire', 'fo:grab', 'fo:gotaway', 'fo:spent', 'fo:wasted', 'fo:bid', 'fo:perdollar'] },
      { key: 'draft', title: 'Draft', boards: ['fo:steal', 'fo:bust', 'fo:keeper', 'fo:drafter', 'fo:bestnight', 'fo:worstnight', 'fo:specialist'] }
    ],
    boards: B
  };
  CACHE = out; AT = Date.now();
  return out;
}
