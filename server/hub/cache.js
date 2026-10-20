// The app's data (buildHub), rebuilt at most every 3 minutes and shared by /api/hub and the Book's futures.
// Any other Sleeper league (the league picker, 2026-10-19) gets its own cache entry; the home league is
// Rollin' with Mahomies (SLEEPER_LEAGUE_ID). At most MAX_OTHER other leagues are kept in memory.
import { buildHub } from './build.js';
import { LEAGUE_ID, COMMISH_USER_ID } from '../config.js';

const FRESH_MS = 3 * 60 * 1000;
const MAX_OTHER = 40;
const hubs = new Map(); // leagueId -> { data, at, building }

export async function getHub({ fresh = false, leagueId = LEAGUE_ID } = {}) {
  const id = String(leagueId || LEAGUE_ID);
  let e = hubs.get(id);
  if (!e) { e = { data: null, at: 0, building: null }; hubs.set(id, e); trim(); }
  if (e.data && !fresh && Date.now() - e.at < FRESH_MS) { touch(id, e); return e.data; }
  if (!e.building) {
    e.building = buildHub(id, COMMISH_USER_ID)
      .then((d) => { e.data = d; e.at = Date.now(); return d; })
      .finally(() => { e.building = null; });
  }
  touch(id, e);
  // Serve the last good copy while a rebuild runs, if we have one.
  return (!fresh && e.data) || e.building;
}
function touch(id, e) { hubs.delete(id); hubs.set(id, e); } // most recently used goes last
function trim() {
  const others = [...hubs.keys()].filter((k) => k !== LEAGUE_ID);
  while (others.length > MAX_OTHER) hubs.delete(others.shift());
}
