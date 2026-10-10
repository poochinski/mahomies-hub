// Every call to Sleeper goes through this file. The browser never calls Sleeper.
// Phase 0: a small in-memory cache. Phase 1 moves the cache into Postgres.

const BASE = process.env.SLEEPER_BASE || 'https://api.sleeper.app/v1'; // override only for local testing
const cache = new Map(); // path -> { at, data }
export const clearSleeperCache = () => cache.clear(); // tests only

export async function sleeper(path, { maxAgeMs = 5 * 60 * 1000 } = {}) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data;

  const res = await fetch(BASE + path, { headers: { accept: 'application/json', 'user-agent': 'MahomiesHub/1.5' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Sleeper ${path} → ${res.status}`);
  const data = await res.json();
  cache.set(path, { at: Date.now(), data });
  return data;
}

// Every NFL player, slimmed to { id: { n: name, p: position, t: team } }.
// Sleeper asks that this ~5 MB file be pulled at most once a day.
let players = null;
let playersAt = 0;
let playersLoading = null;
const DAY = 24 * 60 * 60 * 1000;

export async function getPlayers() {
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
      total_rosters: league.total_rosters
    });
    id = league.previous_league_id;
  }
  return seasons; // newest first
}
