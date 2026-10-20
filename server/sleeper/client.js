// Every call to Sleeper goes through this file. The browser never calls Sleeper.
// Phase 0: a small in-memory cache. Phase 1 moves the cache into Postgres.

const BASE = process.env.SLEEPER_BASE || 'https://api.sleeper.app/v1'; // override only for local testing
const cache = new Map(); // path -> { at, data }
export const clearSleeperCache = () => cache.clear(); // tests only

// Game day: a dozen phones polling every few seconds share one request per path, so
// Sleeper sees at most one call per path per cache window no matter how many people are on.
const inflight = new Map(); // path -> Promise
export async function sleeper(path, { maxAgeMs = 5 * 60 * 1000 } = {}) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data;
  if (inflight.has(path)) return inflight.get(path);
  const p = (async () => {
    try {
      const get = (url) => fetch(url, { headers: { accept: 'application/json', 'user-agent': 'MahomiesHub/1.5' }, signal: AbortSignal.timeout(15000) });
      let res = await get(BASE + path);
      // Oct 19: Sleeper's edge kept answering one week's matchups for two leagues with a 404 to our
      // server while browsers got the data. A one-off query string skips that cached answer.
      if (res.status === 404 || res.status >= 500) res = await get(BASE + path + (path.includes('?') ? '&' : '?') + 'cb=' + Date.now());
      if (!res.ok) throw new Error(`Sleeper ${path} → ${res.status}`);
      const data = await res.json();
      cache.set(path, { at: Date.now(), data });
      return data;
    } catch (err) {
      if (hit) return hit.data; // a slow or failed refresh keeps the last good numbers on screen
      throw err;
    } finally { inflight.delete(path); }
  })();
  inflight.set(path, p);
  return p;
}

// Every NFL player, slimmed to { id: { n: name, p: position, t: team } }.
// Sleeper asks that this ~5 MB file be pulled at most once a day.
let players = null;
let playersAt = 0;
let playersLoading = null;
const DAY = 24 * 60 * 60 * 1000;

// Other sports (basketball): names and positions only, one pull a day, kept apart from the NFL file.
const otherPlayers = new Map(); // sport -> { at, data, loading }
async function getSportPlayers(sport) {
  const hit = otherPlayers.get(sport) || {};
  if (hit.data && Date.now() - hit.at < DAY) return hit.data;
  if (hit.loading) return hit.loading;
  const loading = (async () => {
    const res = await fetch(`${BASE}/players/${sport}`, { headers: { accept: 'application/json', 'user-agent': 'MahomiesHub/1.5' }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Sleeper /players/${sport} → ${res.status}`);
    const raw = await res.json(), slim = {};
    for (const [id, p] of Object.entries(raw)) {
      slim[id] = { n: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || id, p: p.position || (p.fantasy_positions || [])[0] || '', t: p.team || '' };
    }
    otherPlayers.set(sport, { at: Date.now(), data: slim });
    return slim;
  })();
  otherPlayers.set(sport, { ...hit, loading });
  try { return await loading; } catch (e) { otherPlayers.set(sport, { ...hit, loading: null }); throw e; }
}

export async function getPlayers(sport = 'nfl') {
  if (sport && sport !== 'nfl') return getSportPlayers(sport);
  if (players && Date.now() - playersAt < DAY) return players;
  if (playersLoading) return playersLoading;
  playersLoading = (async () => {
    const res = await fetch(BASE + '/players/nfl', { headers: { accept: 'application/json', 'user-agent': 'MahomiesHub/1.5' }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Sleeper /players/nfl → ${res.status}`);
    const raw = await res.json();
    const slim = {};
    for (const [id, p] of Object.entries(raw)) {
      const name =
        p.full_name ||
        [p.first_name, p.last_name].filter(Boolean).join(' ') ||
        id;
      slim[id] = { n: name, p: p.position || (p.fantasy_positions || [])[0] || '', t: p.team || '' };
      if (p.injury_status) slim[id].i = p.injury_status; // Out, IR, Doubtful, Questionable… (as of the daily pull)
      // Bio for the player profile sheet (v2.2)
      if (p.age) slim[id].a = p.age;
      if (p.number != null) slim[id].no = p.number;
      if (p.years_exp != null) slim[id].x = p.years_exp;
      if (p.college) slim[id].c = p.college;
      if (p.height) slim[id].ht = p.height;
      if (p.weight) slim[id].wt = p.weight;
      if (p.espn_id) slim[id].e = String(p.espn_id); // ESPN headshot fallback
    }
    players = slim;
    playersAt = Date.now();
    return players;
  })();
  try {
    return await playersLoading;
  } finally {
    playersLoading = null;
  }
}

// Follows previous_league_id back to the league's first season on Sleeper.
export async function leagueChain(leagueId) {
  const seasons = [];
  let id = leagueId;
  while (id && id !== '0') {
    const league = await sleeper(`/league/${id}`, { maxAgeMs: 60 * 60 * 1000 });
    seasons.push({
      league_id: league.league_id,
      season: league.season,
      name: league.name,
      status: league.status,
      total_rosters: league.total_rosters,
      sport: league.sport || 'nfl'
    });
    id = league.previous_league_id;
  }
  return seasons; // newest first
}
