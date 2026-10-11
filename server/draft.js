// The draft: every pick, graded, for every season on Sleeper.
//   GET /api/draft           → the index: seasons, loyalty, position habits, all-time drafters
//   GET /api/draft/:season   → one draft: the full board, grades and superlatives
//
// Keepers matter here. In this league a chunk of every draft is players kept from
// last year, and Sleeper flags them (`is_keeper`). Nobody *chose* a keeper at that
// slot, so keepers are shown on the board but left out of every grade — counting
// them was making the old re-grade praise people for "drafting" players they had
// simply retained.
//
// What a pick is worth: the points that player went on to score in this league
// (Sleeper's own scoring for us, while he was on somebody's roster), minus what the
// slot was worth. The slot's worth is the Nth-best drafted player of that same
// season, where N is the pick number — so pick 1 is measured against the best
// player anyone drafted, pick 50 against the 50th best, and so on. Positive means
// the pick beat its slot.
import { sleeper, leagueChain, getPlayers } from './sleeper/client.js';
import { LEAGUE_ID } from './config.js';

const HOUR = 60 * 60 * 1000;
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
// Kickers and defenses always go last and would swamp the value curve, so they sit
// out of the rankings. They still appear on the board.
const SKIP = new Set(['K', 'DEF']);

function pointsMap(m) {
  if (m.players_points) return m.players_points;
  const out = {};
  (m.starters || []).forEach((p, i) => { if (p && p !== '0') out[p] = (m.starters_points || [])[i] || 0; });
  return out;
}
const nameOf = (players, id) => players[id]?.n || (/^[A-Z]{2,3}$/.test(id) ? `${id} defense` : `Player ${id}`);
const posOf = (players, id) => (/^[A-Z]{2,3}$/.test(id) ? 'DEF' : players[id]?.p || '');

let CHAIN = null, CHAIN_AT = 0;
async function chain() {
  if (CHAIN && Date.now() - CHAIN_AT < HOUR) return CHAIN;
  CHAIN = await leagueChain(LEAGUE_ID); CHAIN_AT = Date.now();
  return CHAIN;
}

// Everything one season's draft needs: the picks, who owned what, and each
// drafted player's points for the year.
const cache = new Map();
async function seasonRaw(season) {
  const hit = cache.get(String(season));
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.data;
  const list = await chain();
  const s = list.find((x) => String(x.season) === String(season));
  if (!s) { const e = new Error(`No season ${season}`); e.status = 404; throw e; }
  const [league, rosters, state, players] = await Promise.all([
    sleeper(`/league/${s.league_id}`, { maxAgeMs: HOUR }),
    sleeper(`/league/${s.league_id}/rosters`, { maxAgeMs: HOUR }),
    sleeper('/state/nfl', { maxAgeMs: 10 * 60 * 1000 }),
    getPlayers().catch(() => ({}))
  ]);
  const cur = String(season) === String(state.season);
  const last = Number(league.settings?.last_scored_leg) || (league.status === 'complete' ? 17 : 0);
  const owner = Object.fromEntries(rosters.map((r) => [r.roster_id, r.owner_id]));
  const drafts = await sleeper(`/league/${s.league_id}/drafts`, { maxAgeMs: HOUR }).catch(() => []);
  const d = (drafts || []).find((x) => x.draft_id === league.draft_id) || (drafts || [])[0] || null;
  const picks = d ? await sleeper(`/draft/${d.draft_id}/picks`, { maxAgeMs: cur ? HOUR : 7 * 24 * HOUR }).catch(() => []) : [];
  const weeks = await Promise.all(Array.from({ length: last }, (_, i) => i + 1)
    .map((w) => sleeper(`/league/${s.league_id}/matchups/${w}`, { maxAgeMs: cur && w >= last ? 10 * 60 * 1000 : 7 * 24 * HOUR }).catch(() => [])));
  const pts = {};
  for (const ms of weeks) for (const m of ms || []) for (const [pid, v] of Object.entries(pointsMap(m))) pts[pid] = (pts[pid] || 0) + (Number(v) || 0);
  const rounds = Number(d?.settings?.rounds) || Math.max(0, ...(picks || []).map((p) => Number(p.round) || 0));
  const data = { season: String(season), league, owner, players, picks: picks || [], pts, last,
    cur, rounds, type: d?.type || 'snake', teams: Number(d?.settings?.teams) || rosters.length };
  cache.set(String(season), { at: Date.now(), data });
  return data;
}

// One season's board, graded.
export async function draftSeason(season) {
  const R = await seasonRaw(season);
  const { players, pts, owner } = R;
  if (!R.picks.length) return { season: R.season, has_draft: false, picks: [], managers: [], superlatives: [], rounds: 0 };

  const picks = R.picks.filter((p) => p.player_id).map((p) => {
    const pid = String(p.player_id);
    const md = p.metadata || {};
    return {
      pick_no: p.pick_no, round: p.round, round_pick: p.pick_no - (p.round - 1) * (R.teams || 12), slot: p.draft_slot,
      uid: p.picked_by || owner[p.roster_id] || null,
      pid, name: md.first_name ? `${md.first_name} ${md.last_name}` : nameOf(players, pid),
      pos: md.position || posOf(players, pid), nfl: md.team || players[pid]?.t || '',
      keeper: p.is_keeper === true,
      points: r2(pts[pid] || 0)
    };
  }).sort((a, b) => a.pick_no - b.pick_no);

  // The value curve: the Nth-best drafted player is what pick N was "worth".
  const ranked = picks.filter((p) => !SKIP.has(p.pos)).slice().sort((a, b) => b.points - a.points);
  ranked.forEach((p, i) => { p.rank = i + 1; });
  const curve = ranked.map((p) => p.points);
  const par = (pickNo) => (curve.length ? curve[Math.min(curve.length - 1, Math.max(0, pickNo - 1))] : 0);

  for (const p of picks) {
    if (SKIP.has(p.pos) || p.rank == null) { p.value = null; continue; }
    p.par = r1(par(p.pick_no));
    p.value = r1(p.points - p.par);     // points above or below what the slot usually returns
    p.moved = p.pick_no - p.rank;        // spots gained (kept for the old "finished #N" line)
  }

  // "Still on the board": the best player taken in the next two rounds. Looking at the
  // whole rest of the draft just names the same late-round hit under every bad pick,
  // and nobody was realistically choosing between pick 2 and pick 150.
  const later = picks.filter((p) => !SKIP.has(p.pos));
  const WINDOW = 2 * (R.teams || 12);
  for (const p of picks) {
    p.better = null;
    if (p.keeper || p.value == null || p.value >= 0) continue;
    let best = null;
    for (const q of later) {
      if (q.pick_no <= p.pick_no || q.pick_no > p.pick_no + WINDOW || q.keeper) continue;
      if (q.points <= p.points) continue;
      if (!best || q.points > best.points) best = q;
    }
    if (best) p.better = { pid: best.pid, name: best.name, pos: best.pos, points: best.points, pick_no: best.pick_no, uid: best.uid, after: best.pick_no - p.pick_no };
  }

  // Grades, from live picks only.
  const live = picks.filter((p) => !p.keeper && p.value != null);
  const by = {};
  for (const p of live) {
    const m = (by[p.uid] ||= { uid: p.uid, picks: 0, value: 0, hits: 0, misses: 0, best: null, worst: null, by_pos: {}, by_tier: { early: 0, mid: 0, late: 0 } });
    m.picks++; m.value += p.value;
    if (p.value >= 40) m.hits++; else if (p.value <= -40) m.misses++;
    if (!m.best || p.value > m.best.value) m.best = p;
    if (!m.worst || p.value < m.worst.value) m.worst = p;
    const bp = (m.by_pos[p.pos] ||= { pos: p.pos, picks: 0, value: 0 });
    bp.picks++; bp.value += p.value;
    m.by_tier[p.round <= 3 ? 'early' : p.round <= 8 ? 'mid' : 'late'] += p.value;
  }
  const keeperCount = {};
  for (const p of picks) if (p.keeper) keeperCount[p.uid] = (keeperCount[p.uid] || 0) + 1;
  const GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
  const managers = Object.values(by).map((m) => ({
    ...m, value: r1(m.value), keepers: keeperCount[m.uid] || 0,
    per_pick: r1(m.value / Math.max(1, m.picks)),
    hit_rate: Math.round((m.hits / Math.max(1, m.picks)) * 100),
    by_pos: Object.values(m.by_pos).map((x) => ({ ...x, value: r1(x.value) })).sort((a, b) => b.value - a.value),
    by_tier: { early: r1(m.by_tier.early), mid: r1(m.by_tier.mid), late: r1(m.by_tier.late) },
    best: m.best && { pid: m.best.pid, name: m.best.name, pos: m.best.pos, round: m.best.round, pick_no: m.best.pick_no, value: m.best.value, points: m.best.points },
    worst: m.worst && { pid: m.worst.pid, name: m.worst.name, pos: m.worst.pos, round: m.worst.round, pick_no: m.worst.pick_no, value: m.worst.value, points: m.worst.points, better: m.worst.better }
  })).sort((a, b) => b.value - a.value);
  managers.forEach((m, i) => { m.rank = i + 1; m.grade = GRADES[Math.min(GRADES.length - 1, Math.round(i * (GRADES.length - 1) / Math.max(1, managers.length - 1)))]; });

  return { season: R.season, has_draft: true, rounds: R.rounds, type: R.type, teams: R.teams, scored_thru: R.last,
    keepers: picks.filter((p) => p.keeper).length, live_picks: live.length,
    picks, managers, superlatives: superlatives(managers, live) };
}

function superlatives(managers, live) {
  if (!managers.length) return [];
  const out = [];
  const add = (key, title, uid, line, pid) => { if (uid) out.push({ key, title, uid, line, pid: pid || null }); };
  const top = managers[0], bottom = managers[managers.length - 1];
  add('king', 'Draft king', top.uid, `${top.value > 0 ? '+' : ''}${top.value} points above what his picks were worth`);
  const sniper = live.slice().sort((a, b) => b.value - a.value)[0];
  if (sniper) add('sniper', 'The sniper', sniper.uid, `${sniper.name} in round ${sniper.round} · +${r1(sniper.value)}`, sniper.pid);
  const reach = live.slice().sort((a, b) => a.value - b.value)[0];
  if (reach) add('reach', 'The reach', reach.uid, `${reach.name} in round ${reach.round} · ${r1(reach.value)}`, reach.pid);
  // Don't hand the same pick two titles.
  const used = new Set([sniper?.pid, reach?.pid]);
  const lateBest = live.filter((p) => p.round >= 8 && !used.has(p.pid)).sort((a, b) => b.value - a.value)[0];
  if (lateBest && lateBest.value > 0) add('late', 'Late-round hero', lateBest.uid, `${lateBest.name} in round ${lateBest.round} · +${r1(lateBest.value)}`, lateBest.pid);
  const swing = managers.filter((m) => m.picks >= 5);
  const boom = swing.filter((m) => m.hits && m.misses).sort((a, b) => (b.hits + b.misses) - (a.hits + a.misses))[0];
  if (boom) add('boom', 'Boom or bust', boom.uid, `${boom.hits} big hit${boom.hits === 1 ? '' : 's'} and ${boom.misses} big miss${boom.misses === 1 ? '' : 'es'} in ${boom.picks} picks`);
  const steady = swing.slice().sort((a, b) => (a.hits + a.misses) - (b.hits + b.misses))[0];
  if (steady) { const sw = steady.hits + steady.misses;
    add('steady', 'Steady hand', steady.uid, sw ? `Only ${sw} of ${steady.picks} picks swung far either way` : `${steady.picks} picks and not one swung far either way`); }
  if (bottom && bottom !== top && bottom.value < 0) add('rough', 'Rough night', bottom.uid, `${r1(Math.abs(bottom.value))} points below what his picks were worth`);
  return out;
}

// The index: every season, plus habits that only show up across years.
export async function draftIndex() {
  const list = await chain();
  const seasons = [];
  for (const c of list) {
    try { seasons.push(await draftSeason(c.season)); } catch { /* season with no draft */ }
  }
  const withDraft = seasons.filter((s) => s.has_draft);

  // Loyalty: the same manager taking the same player in more than one season.
  const seen = {};
  for (const s of withDraft) for (const p of s.picks) {
    if (!p.uid) continue;
    const k = p.uid + '|' + p.pid;
    (seen[k] ||= { uid: p.uid, pid: p.pid, name: p.name, pos: p.pos, seasons: [] }).seasons.push({ season: s.season, round: p.round, keeper: p.keeper });
  }
  const loyalty = Object.values(seen).filter((x) => x.seasons.length > 1)
    .map((x) => ({ ...x, n: x.seasons.length }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  // Position habits: what each manager takes in each round, across every draft.
  const rounds = Math.max(0, ...withDraft.map((s) => s.rounds || 0));
  const heat = {};
  for (const s of withDraft) for (const p of s.picks) {
    if (!p.uid || !p.round) continue;
    const m = (heat[p.uid] ||= {});
    const r = (m[p.round] ||= {});
    r[p.pos] = (r[p.pos] || 0) + 1;
  }
  const habits = Object.keys(heat).map((uid) => ({
    uid,
    rounds: Array.from({ length: rounds }, (_, i) => {
      const r = heat[uid][i + 1]; if (!r) return null;
      const best = Object.entries(r).sort((a, b) => b[1] - a[1])[0];
      return { pos: best[0], n: best[1], total: Object.values(r).reduce((a, b) => a + b, 0) };
    })
  }));

  // When each position first comes off the board, league-wide.
  const firstOff = {};
  for (const s of withDraft) {
    const got = {};
    for (const p of s.picks) if (!p.keeper && !got[p.pos]) { got[p.pos] = p.pick_no; (firstOff[p.pos] ||= []).push(p.pick_no); }
  }
  const market = Object.entries(firstOff).map(([pos, arr]) => ({ pos, first: Math.min(...arr), typical: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) }))
    .sort((a, b) => a.typical - b.typical);

  // All-time drafter table.
  const all = {};
  for (const s of withDraft) for (const m of s.managers) {
    const a = (all[m.uid] ||= { uid: m.uid, picks: 0, value: 0, hits: 0, misses: 0, keepers: 0, seasons: 0 });
    a.picks += m.picks; a.value += m.value; a.hits += m.hits; a.misses += m.misses; a.keepers += m.keepers; a.seasons++;
  }
  const table = Object.values(all).map((a) => ({ ...a, value: r1(a.value), per_pick: r1(a.value / Math.max(1, a.picks)) }))
    .sort((a, b) => b.per_pick - a.per_pick);

  return {
    seasons: withDraft.map((s) => ({ season: s.season, rounds: s.rounds, type: s.type, keepers: s.keepers, picks: s.picks.length,
      scored_thru: s.scored_thru, top: s.managers[0] ? { uid: s.managers[0].uid, grade: s.managers[0].grade, value: s.managers[0].value } : null })),
    loyalty: loyalty.slice(0, 40), habits, rounds, market, table
  };
}
