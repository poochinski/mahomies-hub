// Builds the whole app's data straight from Sleeper: every season, game,
// standing, record, award, playoff odds and Banana Book line.
// Same shape as prototype/data/app15.json, so the page can swap it in.
import { sleeper, leagueChain, getPlayers } from '../sleeper/client.js';

const HOUR = 60 * 60 * 1000;
const WEEK = 7 * 24 * HOUR;
const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;

// ---------- math helpers ----------
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const pstdev = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
function erf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function amer(q) { let o = q >= 0.5 ? -100 * q / (1 - q) : 100 * (1 - q) / q; o = Math.round(o / 5) * 5; return Math.max(-1000, Math.min(700, o)); }
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------- 1. pull everything from Sleeper ----------
async function pull(leagueId) {
  const state = await sleeper('/state/nfl');
  const chain = await leagueChain(leagueId); // newest first
  const players = await getPlayers().catch(() => ({}));
  const seasons = [];
  for (const c of chain) {
    const isCur = c.season === state.season;
    const [league, users, rosters] = await Promise.all([
      sleeper(`/league/${c.league_id}`, { maxAgeMs: isCur ? 10 * 60 * 1000 : WEEK }),
      sleeper(`/league/${c.league_id}/users`, { maxAgeMs: isCur ? HOUR : WEEK }),
      sleeper(`/league/${c.league_id}/rosters`, { maxAgeMs: isCur ? 10 * 60 * 1000 : WEEK })
    ]);
    const st = league.settings || {};
    const P = Number(st.playoff_week_start) || 15;
    let last = Number(st.last_scored_leg) || 0;
    if (!last && league.status === 'complete') last = 17;
    const liveWeek = isCur && state.season_type === 'regular' && Number(state.week) > last ? Number(state.week) : null;
    const maxFetch = isCur ? Math.max(last, P - 1) : last; // current season: whole regular-season schedule (for odds)
    const weeks = {};
    await Promise.all(Array.from({ length: maxFetch }, (_, i) => i + 1).map(async (w) => {
      const age = !isCur || w < last ? WEEK : w === liveWeek ? 2 * 60 * 1000 : 30 * 60 * 1000;
      weeks[w] = await sleeper(`/league/${c.league_id}/matchups/${w}`, { maxAgeMs: age }).catch(() => []);
    }));
    let wb = [], lb = [];
    if (last >= P) {
      [wb, lb] = await Promise.all([
        sleeper(`/league/${c.league_id}/winners_bracket`, { maxAgeMs: isCur ? HOUR : WEEK }).catch(() => []),
        sleeper(`/league/${c.league_id}/losers_bracket`, { maxAgeMs: isCur ? HOUR : WEEK }).catch(() => [])
      ]);
    }
    seasons.push({ s: c.season, isCur, league, users, rosters, P, last, liveWeek, weeks, wb, lb,
      median: !!st.league_average_match, teams: league.total_rosters || rosters.length });
  }
  return { state, seasons: seasons.reverse(), players }; // oldest first
}

// ---------- 2. build the app data ----------
export async function buildHub(leagueId, me) {
  const { state, seasons: SE, players } = await pull(leagueId);
  const cur = SE[SE.length - 1];
  const CUR = cur.s;
  const names = {};
  const pname = (pid) => {
    if (/^[A-Z]{2,3}$/.test(pid)) return `${pid} defense`;
    return players[pid]?.n || null;
  };
  const ppos = (pid) => (/^[A-Z]{2,3}$/.test(pid) ? 'DEF' : players[pid]?.p || '');

  // managers + team names per season
  const managers = {}; const teamNames = {}; const avatars = {};
  for (const x of SE) {
    teamNames[x.s] = {};
    for (const u of x.users) {
      const tn = (u.metadata?.team_name || u.display_name || '').trim();
      teamNames[x.s][u.user_id] = tn;
      managers[u.user_id] = { id: u.user_id, name: u.display_name, team: tn, active: false };
      if (u.avatar) avatars[u.user_id] = u.avatar;
    }
  }
  for (const u of cur.users) managers[u.user_id].active = true;

  const owner = {}; // s -> roster_id -> user_id
  for (const x of SE) owner[x.s] = Object.fromEntries(x.rosters.map((r) => [r.roster_id, r.owner_id]));
  const U = (s, r) => owner[s][r];

  // rows: one per team-week that has been scored
  const rows = [];
  for (const x of SE) for (let w = 1; w <= x.last; w++) for (const m of x.weeks[w] || []) {
    const sp = m.starters_points || []; let bi = -1;
    sp.forEach((p, i) => { if (bi < 0 || p > sp[bi]) bi = i; });
    const pid = bi >= 0 ? String((m.starters || [])[bi]) : '0';
    rows.push({ s: x.s, w, roster: m.roster_id, mid: m.matchup_id ?? null, pts: m.points || 0, pid, pp: bi >= 0 ? sp[bi] : 0 });
  }
  const tw = rows.map((t) => ({ s: t.s, w: t.w, uid: U(t.s, t.roster), p: t.pts, pid: t.pid, pp: t.pp })).filter((t) => t.uid);
  const scored = tw.filter((t) => t.p > 0);

  // brackets -> places + game labels
  const places = {}; const gameKind = {};
  for (const x of SE) {
    if (!x.wb.length) continue;
    const P = {}; const wk = (r) => x.P - 1 + Number(r);
    const key = (r, a, b) => `${x.s}|${wk(r)}|${[a, b].sort().join(',')}`;
    for (const m of x.wb) {
      if (!m.t1 || !m.t2 || typeof m.t1 === 'object' || typeof m.t2 === 'object') continue;
      const k = key(m.r, U(x.s, m.t1), U(x.s, m.t2));
      if (m.p === 1) { P.champ = U(x.s, m.w); P.runner = U(x.s, m.l); gameKind[k] = 'Championship'; }
      else if (m.p === 3) { P.third = U(x.s, m.w); gameKind[k] = '3rd place game'; }
      else if (m.p === 5) gameKind[k] = '5th place game';
      else gameKind[k] = `Playoffs · Round ${m.r}`;
    }
    for (const m of x.lb) {
      if (!m.t1 || !m.t2 || typeof m.t1 === 'object' || typeof m.t2 === 'object') continue;
      const k = key(m.r, U(x.s, m.t1), U(x.s, m.t2));
      if (m.p === 1) { P.sacko = U(x.s, m.w); gameKind[k] = 'Toilet Bowl final'; } else gameKind[k] = 'Toilet Bowl';
    }
    if (P.champ) places[x.s] = P;
  }

  // games
  const groups = new Map();
  for (const t of rows) if (t.mid != null) {
    const k = `${t.s}|${t.w}|${t.mid}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t);
  }
  const P_of = Object.fromEntries(SE.map((x) => [x.s, x.P]));
  const games = [];
  for (const [, v] of [...groups.entries()].sort()) {
    if (v.length !== 2) continue;
    const [a, b] = v; const s = a.s, w = a.w;
    const ua = U(s, a.roster), ub = U(s, b.roster);
    const kind = w < P_of[s] ? 'Regular season' : gameKind[`${s}|${w}|${[ua, ub].sort().join(',')}`] || 'Consolation';
    const [win, lose] = a.pts >= b.pts ? [a, b] : [b, a];
    games.push({ s, w, k: kind, win: U(s, win.roster), wp: win.pts, lose: U(s, lose.roster), lp: lose.pts, m: r2(Math.abs(a.pts - b.pts)) });
  }
  games.sort((x, y) => (x.s === y.s ? x.w - y.w : x.s < y.s ? -1 : 1));

  // standings
  function standings(x, maxw) {
    const T = {};
    for (const r of x.rosters) T[r.roster_id] = { uid: r.owner_id, w: 0, l: 0, t: 0, mw: 0, ml: 0, pf: 0, pa: 0, scores: [], apw: 0, apl: 0 };
    for (let w = 1; w <= maxw; w++) {
      const ms = (x.weeks[w] || []).filter((m) => T[m.roster_id]);
      const by = {}; ms.forEach((m) => { if (m.matchup_id != null) (by[m.matchup_id] ||= []).push(m); });
      for (const pair of Object.values(by)) {
        if (pair.length !== 2) continue; const [a, b] = pair; const A = T[a.roster_id], B = T[b.roster_id];
        A.pf += a.points; B.pf += b.points; A.pa += b.points; B.pa += a.points;
        if (a.points > b.points) { A.w++; B.l++; } else if (b.points > a.points) { B.w++; A.l++; } else { A.t++; B.t++; }
      }
      const vals = ms.map((m) => m.points).sort((p, q) => p - q);
      const med = vals.length ? (vals[Math.floor((vals.length - 1) / 2)] + vals[Math.ceil((vals.length - 1) / 2)]) / 2 : 0;
      for (const m of ms) {
        const t = T[m.roster_id]; t.scores.push(m.points);
        t.apw += ms.filter((o) => m.points > o.points).length; t.apl += ms.filter((o) => m.points < o.points).length;
        if (x.median) { if (m.points > med) t.mw++; else t.ml++; }
      }
    }
    const out = Object.values(T).map((t) => {
      const n = t.scores.length; const exp = t.apw + t.apl ? (t.apw / (t.apw + t.apl)) * n : 0;
      const l3 = t.scores.slice(-3);
      return { uid: t.uid, team: teamNames[x.s][t.uid] || managers[t.uid]?.name || '?', w: t.w + t.mw, l: t.l + t.ml, h2h: `${t.w}-${t.l}`,
        pf: r2(t.pf), pa: r2(t.pa), ap: `${t.apw}-${t.apl}`, appct: Math.round((t.apw / Math.max(1, t.apw + t.apl)) * 1000) / 1000,
        luck: r1(t.w - exp), last3: r2(mean(l3)), avg: r2(t.pf / Math.max(1, n)),
        hi: n ? Math.max(...t.scores) : 0, lo: n ? Math.min(...t.scores) : 0, scores: t.scores.map(r2) };
    });
    out.sort((a, b) => b.w - a.w || b.pf - a.pf); out.forEach((t, i) => { t.seed = i + 1; });
    return out;
  }
  const regEnd = (x) => Math.min(x.last, x.P - 1);
  const seasons = {};
  for (const x of SE) {
    const st = standings(x, regEnd(x));
    const info = { season: x.s, standings: st, median: x.median, team_names: teamNames[x.s], last: x.last, ...(places[x.s] || {}) };
    if (st.length) { info.top_scorer = [...st].sort((a, b) => b.pf - a.pf)[0].uid; info.reg_champ = st[0].uid; }
    if (x.wb.length) {
      const pts = (w, uid) => { const t = tw.find((z) => z.s === x.s && z.w === w && z.uid === uid); return t ? t.p : null; };
      const conv = (list) => list.filter((m) => typeof m.t1 === 'number' && typeof m.t2 === 'number').map((m) => {
        const w = x.P - 1 + Number(m.r); const a = U(x.s, m.t1), b = U(x.s, m.t2);
        return { r: Number(m.r), w, a, b, pa: pts(w, a), pb: pts(w, b), p: m.p ?? null };
      });
      info.bracket = { winners: conv(x.wb), losers: conv(x.lb) };
    }
    seasons[x.s] = info;
  }

  // power rankings (current season)
  const pctl = (vals, v) => vals.filter((q) => q < v).length / Math.max(1, vals.length - 1);
  const powerScores = (st) => {
    const a = st.map((t) => t.avg), b = st.map((t) => t.appct), c = st.map((t) => t.last3), d = st.map((t) => t.w / Math.max(1, t.w + t.l));
    return Object.fromEntries(st.map((t) => [t.uid, 0.35 * pctl(a, t.avg) + 0.25 * pctl(b, t.appct) + 0.2 * pctl(c, t.last3) + 0.2 * pctl(d, t.w / Math.max(1, t.w + t.l))]));
  };
  const curSt = seasons[CUR].standings;
  let power = [];
  if (regEnd(cur) >= 1) {
    const now = powerScores(curSt);
    const prevSt = regEnd(cur) >= 2 ? standings(cur, regEnd(cur) - 1) : curSt;
    const before = powerScores(prevSt);
    const prevRank = Object.fromEntries(Object.entries(before).sort((a, b) => b[1] - a[1]).map(([u], i) => [u, i + 1]));
    power = [...curSt].sort((a, b) => now[b.uid] - now[a.uid] || b.pf - a.pf).map((t, i) => ({
      uid: t.uid, power: r1(100 * now[t.uid]), rank: i + 1, move: (prevRank[t.uid] || i + 1) - (i + 1),
      rec: `${t.w}-${t.l}`, avg: t.avg, ap: t.ap, luck: t.luck, last3: t.last3, scores: t.scores }));
  }

  // records
  function buildRecords(filter) {
    const ok = (t) => filter === 'all' ? true : filter === 'reg' ? t.w < P_of[t.s] : t.w >= P_of[t.s] && t.s !== CUR;
    const sc = scored.filter(ok), GG = games.filter(ok);
    const T = tw.filter((t) => ok(t) && !/^[A-Z]{2,3}$/.test(t.pid) && t.pid !== '0');
    const team = (t) => ({ uid: t.uid, v: t.p, s: t.s, w: t.w });
    const R = {
      high: [...sc].sort((a, b) => b.p - a.p).slice(0, 10).map(team),
      low: [...sc].sort((a, b) => a.p - b.p).slice(0, 10).map(team),
      blowout: [...GG].sort((a, b) => b.m - a.m).slice(0, 10),
      close: [...GG].sort((a, b) => a.m - b.m).slice(0, 10),
      hiloss: [...GG].sort((a, b) => b.lp - a.lp).slice(0, 10),
      lowin: [...GG].sort((a, b) => a.wp - b.wp).slice(0, 10),
      player: [...T].sort((a, b) => b.pp - a.pp).slice(0, 10).map((t) => ({ uid: t.uid, v: t.pp, s: t.s, w: t.w, pid: t.pid, name: pname(t.pid), pos: ppos(t.pid) }))
    };
    return R;
  }
  const records = buildRecords('all');
  const done = SE.filter((x) => x.s !== CUR || regEnd(x) >= x.P - 1);
  const sea = done.flatMap((x) => seasons[x.s].standings.map((t) => ({ uid: t.uid, v: t.pf, s: x.s, rec: `${t.w}-${t.l}` })));
  records.seasonhi = [...sea].sort((a, b) => b.v - a.v).slice(0, 10);
  records.seasonlo = [...sea].sort((a, b) => a.v - b.v).slice(0, 10);
  const seq = {};
  for (const g of games) if (g.k === 'Regular season') for (const [me_, res] of [[g.win, 'W'], [g.lose, 'L']]) (seq[me_] ||= []).push({ s: g.s, w: g.w, r: res });
  const streaks = [];
  for (const [u, L] of Object.entries(seq)) {
    L.sort((a, b) => (a.s === b.s ? a.w - b.w : a.s < b.s ? -1 : 1));
    for (let i = 0; i < L.length;) { let j = i; while (j + 1 < L.length && L[j + 1].r === L[i].r) j++;
      streaks.push({ uid: u, t: L[i].r, n: j - i + 1, start: `${L[i].s} Wk ${L[i].w}`, end: `${L[j].s} Wk ${L[j].w}`, live: j === L.length - 1 }); i = j + 1; }
  }
  records.wstreak = streaks.filter((x) => x.t === 'W').sort((a, b) => b.n - a.n).slice(0, 10);
  records.lstreak = streaks.filter((x) => x.t === 'L').sort((a, b) => b.n - a.n).slice(0, 10);
  const recf = { reg: buildRecords('reg'), post: buildRecords('post') };

  // all-time
  const AT = {};
  for (const u of Object.keys(managers)) AT[u] = { uid: u, w: 0, l: 0, pf: 0, pa: 0, g: 0, titles: [], runner: [], sacko: [], third: [], playoffs: [], seasons: [], best: null, worst: null, pw: 0, pl: 0, tb: 0, rb: 0 };
  for (const g of games) for (const [me_, mp, op] of [[g.win, g.wp, g.lp], [g.lose, g.lp, g.wp]]) {
    const a = AT[me_]; if (!a) continue;
    if (g.k === 'Regular season') { a.g++; a.pf += mp; a.pa += op; if (mp > op) a.w++; else if (mp < op) a.l++; }
    else if (g.k.startsWith('Playoffs') || g.k === 'Championship') { if (mp > op) a.pw++; else a.pl++; }
  }
  for (const t of scored) { const a = AT[t.uid]; if (!a) continue;
    if (!a.best || t.p > a.best.v) a.best = { v: t.p, s: t.s, w: t.w };
    if (!a.worst || t.p < a.worst.v) a.worst = { v: t.p, s: t.s, w: t.w }; }
  for (const x of SE) {
    for (const t of seasons[x.s].standings) AT[t.uid]?.seasons.push({ s: x.s, rec: `${t.w}-${t.l}`, pf: t.pf, seed: t.seed, team: t.team });
    const P = places[x.s];
    if (P) { AT[P.champ]?.titles.push(x.s); AT[P.runner]?.runner.push(x.s); AT[P.sacko]?.sacko.push(x.s); AT[P.third]?.third.push(x.s); }
    for (const m of x.wb) if ((m.r === 1 || m.r === 2) && typeof m.t1 === 'number' && typeof m.t2 === 'number')
      for (const r of [m.t1, m.t2]) { const a = AT[U(x.s, r)]; if (a && !a.playoffs.includes(x.s)) a.playoffs.push(x.s); }
  }
  const byWeek = {};
  for (const t of scored) (byWeek[`${t.s}|${t.w}`] ||= []).push(t);
  for (const [k, v] of Object.entries(byWeek)) {
    const x = SE.find((z) => z.s === k.split('|')[0]); if (v.length < x.teams) continue;
    AT[v.reduce((a, b) => (b.p > a.p ? b : a)).uid] && AT[v.reduce((a, b) => (b.p > a.p ? b : a)).uid].tb++;
    AT[v.reduce((a, b) => (b.p < a.p ? b : a)).uid] && AT[v.reduce((a, b) => (b.p < a.p ? b : a)).uid].rb++;
  }
  const alltime = Object.values(AT).filter((a) => a.seasons.length).map((a) => ({ ...a, pf: r2(a.pf), pa: r2(a.pa),
    pct: Math.round((a.w / Math.max(1, a.w + a.l)) * 1000) / 1000, avg: r2(a.pf / Math.max(1, a.g)) }));
  alltime.sort((a, b) => b.titles.length - a.titles.length || b.pct - a.pct);

  // head to head
  const h2h = {};
  for (const g of games) for (const [a, ap, b, bp] of [[g.win, g.wp, g.lose, g.lp], [g.lose, g.lp, g.win, g.wp]]) {
    const h = (h2h[`${a}|${b}`] ||= { w: 0, l: 0, pf: 0, pa: 0, games: [] });
    if (ap > bp) h.w++; else h.l++; h.pf = r2(h.pf + ap); h.pa = r2(h.pa + bp); h.games.push({ s: g.s, w: g.w, m: ap, o: bp, k: g.k });
  }

  // tw map + names
  const twMap = {};
  for (const t of tw) { twMap[`${t.s}|${t.w}|${t.uid}`] = [t.p, t.pid, t.pp]; const n = pname(t.pid); if (n && !/defense$/.test(n)) names[t.pid] = n; }

  // ---------- Banana Book ----------
  const prev = SE.length > 1 ? SE[SE.length - 2] : null;
  const regScores = (u, s) => scored.filter((t) => t.uid === u && t.s === s && t.w < P_of[s]).map((t) => t.p);
  const sdOf = (u) => { const sc = [...(prev ? regScores(u, prev.s) : []), ...regScores(u, CUR)]; const s = sc.length > 3 ? pstdev(sc) : 24; const n = sc.length; return Math.sqrt((n * s * s + 6 * 24 * 24) / (n + 6)); };
  const lgAvg = mean(curSt.map((t) => t.avg));
  const proj = (u, week) => {
    const x = curSt.find((t) => t.uid === u); const p = prev ? regScores(u, prev.s) : [];
    const raw = x && x.scores.length ? 0.45 * x.last3 + 0.35 * x.avg + 0.2 * (p.length ? mean(p) : x.avg) : (p.length ? mean(p) : lgAvg || 120);
    const k = week <= 6 ? 0.35 : 0.15; return (1 - k) * raw + k * (lgAvg || raw);
  };
  const lines = [];
  if (cur.liveWeek && cur.liveWeek < cur.P) {
    const by = {}; for (const m of cur.weeks[cur.liveWeek] || []) if (m.matchup_id != null) (by[m.matchup_id] ||= []).push(m);
    for (const [mid, pair] of Object.entries(by).sort((a, b) => a[0] - b[0])) {
      if (pair.length !== 2) continue; const [a, b] = pair; const ua = U(CUR, a.roster_id), ub = U(CUR, b.roster_id);
      const pa = proj(ua, cur.liveWeek), pb = proj(ub, cur.liveWeek);
      let diff = pa - pb; if (Math.abs(diff) > 20) diff = Math.sign(diff) * 20;
      const p = phi(diff / Math.hypot(sdOf(ua), sdOf(ub))); const mid_ = (pa + pb) / 2;
      lines.push({ id: `w${cur.liveWeek}m${mid}`, a: ua, b: ub, pa: r1(mid_ + diff / 2), pb: r1(mid_ - diff / 2), spread: Math.round(diff * 2) / 2,
        total: Math.round((pa + pb) * 2) / 2, ml_a: amer(Math.min(0.995, p * 1.045)), ml_b: amer(Math.min(0.995, (1 - p) * 1.045)),
        wp: Math.round(p * 1000) / 1000, live_a: a.points || 0, live_b: b.points || 0 });
    }
  }

  // ---------- playoff odds ----------
  let odds = { sims: 0, weeks_left: 0, list: [] };
  const firstOpen = regEnd(cur) + 1;
  if (cur.isCur && firstOpen < cur.P && curSt.length) {
    const uids = curSt.map((t) => t.uid); const idx = Object.fromEntries(uids.map((u, i) => [u, i]));
    const mu = uids.map((u) => proj(u, 8)), sd = uids.map(sdOf);
    const sched = [];
    for (let w = firstOpen; w < cur.P; w++) {
      const by = {}; for (const m of cur.weeks[w] || []) if (m.matchup_id != null) (by[m.matchup_id] ||= []).push(m.roster_id);
      sched.push(Object.values(by).filter((p) => p.length === 2).map(([a, b]) => [idx[U(CUR, a)], idx[U(CUR, b)]]));
    }
    const N = 5000, n = uids.length, playoffN = Number(cur.league.settings?.playoff_teams) || 6;
    const cnt = uids.map(() => ({ po: 0, bye: 0, top: 0, last: 0, wins: 0 }));
    const baseW = curSt.map((t) => t.w), basePF = curSt.map((t) => t.pf);
    for (let s = 0; s < N; s++) {
      const W = baseW.slice(), PF = basePF.slice();
      for (const pairs of sched) {
        const sc = mu.map((m, i) => m + sd[i] * gauss());
        for (let i = 0; i < n; i++) PF[i] += sc[i];
        if (cur.median) { const sorted = [...sc].sort((a, b) => a - b); const med = (sorted[(n - 1) >> 1] + sorted[n >> 1]) / 2; for (let i = 0; i < n; i++) if (sc[i] > med) W[i]++; }
        for (const [a, b] of pairs) { if (sc[a] > sc[b]) W[a]++; else W[b]++; }
      }
      const order = uids.map((_, i) => i).sort((a, b) => W[b] - W[a] || PF[b] - PF[a]);
      order.forEach((i, rk) => { const c = cnt[i]; if (rk < playoffN) c.po++; if (rk < 2) c.bye++; if (rk === 0) c.top++; if (rk === n - 1) c.last++; });
      for (let i = 0; i < n; i++) cnt[i].wins += W[i];
    }
    const games_ = (t) => t.w + t.l;
    odds = { sims: N, weeks_left: sched.length, list: uids.map((u, i) => ({ uid: u, playoff: Math.round(cnt[i].po / N * 1000) / 1000, bye: Math.round(cnt[i].bye / N * 1000) / 1000,
      top: Math.round(cnt[i].top / N * 1000) / 1000, last: Math.round(cnt[i].last / N * 1000) / 1000, wins: r1(cnt[i].wins / N),
      rec: `${curSt[i].w}-${curSt[i].l}`, g: games_(curSt[i]) })).sort((a, b) => b.playoff - a.playoff || b.wins - a.wins) };
  }

  // ---------- awards ----------
  const awards = {};
  for (const x of SE) {
    const stn = seasons[x.s].standings; const end = regEnd(x); if (!stn.length || end < 1) continue;
    const hi = {}, lo = {};
    for (let w = 1; w <= end; w++) { const v = scored.filter((t) => t.s === x.s && t.w === w); if (!v.length) continue;
      const a = v.reduce((p, q) => (q.p > p.p ? q : p)), b = v.reduce((p, q) => (q.p < p.p ? q : p)); hi[a.uid] = (hi[a.uid] || 0) + 1; lo[b.uid] = (lo[b.uid] || 0) + 1; }
    const sg = games.filter((g) => g.s === x.s), sreg = sg.filter((g) => g.w <= end);
    const A = []; const add = (key, title, uid, val, note, game = null) => A.push({ key, title, uid, val, note, game });
    if (places[x.s]) { add('champ', 'Champion', places[x.s].champ, '🏆', 'Won the title'); if (places[x.s].sacko) add('sacko', 'Sacko', places[x.s].sacko, '🚽', 'Won the Toilet Bowl, lost the season'); }
    const best = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
    let t = [...stn].sort((a, b) => b.pf - a.pf)[0]; add('points', 'Points King', t.uid, t.pf.toFixed(1), 'Most points in the regular season');
    let e = best(hi); if (e) add('topb', 'Top Banana', e[0], `${e[1]}×`, 'Most weeks as the league high scorer');
    e = best(lo); if (e) add('rotb', 'Rotten Banana', e[0], `${e[1]}×`, 'Most weeks as the league low scorer');
    t = [...stn].sort((a, b) => b.luck - a.luck)[0]; add('lucky', 'Horseshoe', t.uid, `+${t.luck.toFixed(1)}`, 'Luckiest: more wins than the points deserved');
    t = [...stn].sort((a, b) => a.luck - b.luck)[0]; add('unlucky', 'Snakebitten', t.uid, t.luck.toFixed(1), 'Unluckiest: fewer wins than the points deserved');
    t = [...stn].sort((a, b) => b.pa - a.pa)[0]; add('pa', 'Punching Bag', t.uid, t.pa.toFixed(1), 'Most points scored against');
    if (sg.length) { let g = [...sg].sort((a, b) => b.wp - a.wp)[0]; add('high', 'Monster Week', g.win, g.wp.toFixed(2), `Week ${g.w} · ${g.k}`, g);
      g = [...sg].sort((a, b) => b.m - a.m)[0]; add('blow', 'Bully', g.win, `+${g.m.toFixed(1)}`, `Biggest blowout · Week ${g.w}`, g); }
    if (sreg.length) { const g = [...sreg].sort((a, b) => a.m - b.m)[0]; add('heart', 'Heartbreaker', g.lose, `-${g.m.toFixed(2)}`, `Closest loss · Week ${g.w}`, g); }
    awards[x.s] = A;
  }

  // ---------- Book backtest ----------
  const btRes = [];
  const btRun = (x, from, to) => {
    const pv = SE[SE.indexOf(x) - 1];
    for (let w = from; w <= to; w++) for (const g of games.filter((z) => z.s === x.s && z.w === w)) {
      const pj = {};
      for (const u of [g.win, g.lose]) {
        const h = scored.filter((t) => t.uid === u && t.s === x.s && t.w < w).map((t) => t.p); if (!h.length) return;
        const ph = pv ? regScores(u, pv.s) : []; const lgh = scored.filter((t) => t.s === x.s && t.w < w).map((t) => t.p);
        const raw = 0.45 * mean(h.slice(-3)) + 0.35 * mean(h) + 0.2 * (ph.length ? mean(ph) : mean(h)); const k = w <= 6 ? 0.35 : 0.15;
        pj[u] = (1 - k) * raw + k * mean(lgh);
      }
      let diff = pj[g.win] - pj[g.lose]; if (Math.abs(diff) > 20) diff = Math.sign(diff) * 20;
      btRes.push({ fav: diff > 0, err: Math.abs(g.wp - g.lp - diff), pick: Math.abs(Math.round(diff * 2) / 2) < 0.01 });
    }
  };
  if (prev) btRun(prev, 3, regEnd(prev));
  btRun(cur, 2, regEnd(cur));
  const real = btRes.filter((r) => !r.pick);
  const backtest = { games: btRes.length, fav_pct: real.length ? Math.round(real.filter((r) => r.fav).length / real.length * 1000) / 1000 : 0,
    mae: r1(mean(btRes.map((r) => r.err))), span: `${prev ? prev.s + ' Wk 3' : CUR + ' Wk 2'} – ${CUR} Wk ${regEnd(cur)}` };

  const now = new Date();
  const updated_label = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const st = cur.league.settings || {};
  return {
    league: { name: cur.league.name, season: CUR, week: cur.liveWeek || Number(state.week) || cur.last, teams: cur.teams,
      scoring: cur.league.scoring_settings?.rec === 1 ? 'PPR' : cur.league.scoring_settings?.rec === 0.5 ? 'Half PPR' : 'Standard',
      playoff_start: cur.P, playoff_teams: Number(st.playoff_teams) || 6, median: cur.median, first: SE[0].s, last_scored: cur.last, live: !!cur.liveWeek },
    managers, seasons, records, recf, alltime, h2h, games, power, lines, odds, awards, backtest,
    tw: twMap, names, avatars, me, version: '1.7', updated_label, updated: now.toISOString()
  };
}
