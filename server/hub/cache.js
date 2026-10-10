// The app's data (buildHub), rebuilt at most every 3 minutes and shared by /api/hub and the Book's futures.
import { buildHub } from './build.js';
import { LEAGUE_ID, COMMISH_USER_ID } from '../config.js';

const FRESH_MS = 3 * 60 * 1000;
let cached = null, cachedAt = 0, building = null;
export async function getHub({ fresh = false } = {}) {
  if (cached && !fresh && Date.now() - cachedAt < FRESH_MS) return cached;
  if (!building) {
    building = buildHub(LEAGUE_ID, COMMISH_USER_ID)
      .then((d) => { cached = d; cachedAt = Date.now(); return d; })
      .finally(() => { building = null; });
  }
  // Serve the last good copy while a rebuild runs, if we have one.
  return (!fresh && cached) || building;
}
