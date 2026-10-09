// GET /api/hub — everything the app shows, built live from Sleeper.
// Rebuilt at most every 3 minutes (past weeks are cached for days inside the Sleeper client).
import { Router } from 'express';
import { buildHub } from '../hub/build.js';
import { LEAGUE_ID, COMMISH_USER_ID } from '../config.js';

const router = Router();
const FRESH_MS = 3 * 60 * 1000;
let cached = null;
let cachedAt = 0;
let building = null;

async function getHub() {
  if (cached && Date.now() - cachedAt < FRESH_MS) return cached;
  if (!building) {
    building = buildHub(LEAGUE_ID, COMMISH_USER_ID)
      .then((d) => { cached = d; cachedAt = Date.now(); return d; })
      .finally(() => { building = null; });
  }
  // Serve the last good copy while a rebuild runs, if we have one.
  return cached || building;
}

router.get('/hub', async (_req, res) => {
  if (!LEAGUE_ID) return res.status(500).json({ error: 'SLEEPER_LEAGUE_ID is not set' });
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getHub());
  } catch (err) {
    console.error('hub build failed', err);
    res.status(502).json({ error: err.message });
  }
});

export default router;
