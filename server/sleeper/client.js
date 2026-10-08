// Every call to Sleeper goes through this file. The browser never calls Sleeper.
// Phase 0: a small in-memory cache. Phase 1 moves the cache into Postgres.

const BASE = 'https://api.sleeper.app/v1';
const cache = new Map(); // path -> { at, data }

export async function sleeper(path, { maxAgeMs = 5 * 60 * 1000 } = {}) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data;

  const res = await fetch(BASE + path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Sleeper ${path} → ${res.status}`);
  const data = await res.json();
  cache.set(path, { at: Date.now(), data });
  return data;
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
