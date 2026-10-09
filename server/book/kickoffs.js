// NFL kickoff times from ESPN's public scoreboard. Used to lock each
// matchup when the first starter in either lineup kicks off.
const ESPN = (process.env.ESPN_BASE || 'https://site.api.espn.com/apis/site/v2/sports/football/nfl').replace(/\/$/, '');

// ESPN and Sleeper spell a few teams differently.
const FIX = { WSH: 'WAS', JAC: 'JAX', LA: 'LAR' };

const cache = new Map(); // "season|week" -> { at, data }
export const clearKickoffCache = () => cache.clear(); // tests only

/**
 * Kickoffs for one NFL week.
 * Returns { games: [{ at: Date, teams: ['SEA','DEN'], state }], byTeam: { SEA: Date }, first: Date, last: Date }
 */
export async function kickoffs(season, week, { maxAgeMs = 30 * 60 * 1000 } = {}) {
  const key = `${season}|${week}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data;
  try {
    const res = await fetch(`${ESPN}/scoreboard?seasontype=2&week=${week}&dates=${season}`, {
      headers: { 'user-agent': 'MahomiesHub/1.8' }, signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const json = await res.json();
    const games = (json.events || []).map((e) => ({
      at: new Date(e.date),
      teams: (e.competitions?.[0]?.competitors || []).map((c) => { const t = c.team?.abbreviation || ''; return FIX[t] || t; }),
      state: e.status?.type?.state || 'pre', // pre | in | post
      period: Number(e.status?.period) || 0,
      clock: Number(e.status?.clock ?? 900)
    })).filter((g) => !Number.isNaN(g.at.getTime()));
    // How much of each game has been played (0 = not started, 1 = final).
    for (const g of games) {
      g.progress = g.state === 'post' ? 1 : g.state === 'pre' ? 0
        : g.period > 4 ? 0.98 : Math.max(0, Math.min(0.98, ((g.period - 1) * 900 + (900 - g.clock)) / 3600));
    }
    if (!games.length) throw new Error('ESPN returned no games');
    const byTeam = {};
    const gameOf = {};
    for (const g of games) for (const t of g.teams) { byTeam[t] = g.at; gameOf[t] = g; }
    const times = games.map((g) => g.at.getTime());
    const data = { games, byTeam, gameOf, first: new Date(Math.min(...times)), last: new Date(Math.max(...times)) };
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) return hit.data; // stale beats nothing
    throw err;
  }
}

// ---------- Pacific-time helpers ----------
const TZ = 'America/Los_Angeles';
function ptParts(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), h: +p.hour, min: +p.minute };
}
// A wall-clock time in Pacific -> real Date (handles daylight saving).
export function pacific(y, m, d, h = 0, min = 0) {
  let t = Date.UTC(y, m - 1, d, h, min);
  for (let i = 0; i < 2; i++) { const p = ptParts(new Date(t)); t += (Date.UTC(y, m - 1, d, h, min) - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min)); }
  return new Date(t);
}
// The given weekday (0=Sun) at hh:00 Pacific, on or before / after a date.
export function ptWeekdayBefore(date, weekday, hour) {
  const p = ptParts(date); const back = (p.wd - weekday + 7) % 7;
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d - back));
  return pacific(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour);
}
export function ptWeekdayAfter(date, weekday, hour) {
  const p = ptParts(date); const fwd = (weekday - p.wd + 7) % 7 || 7;
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + fwd));
  return pacific(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour);
}
export const fmtPT = (d) => new Date(d).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Lines post Tuesday 6 AM before the week's first kickoff;
// bets settle Wednesday 3 AM after the week's last game (after stat corrections).
export const postTime = (k) => ptWeekdayBefore(k.first, 2, 6);
export const settleTime = (k) => ptWeekdayAfter(k.last, 3, 3);
