// GET /api/hub — everything the app shows, built live from Sleeper.
// Rebuilt at most every 3 minutes (past weeks are cached for days inside the Sleeper client).
import { Router } from 'express';
import { buildHub } from '../hub/build.js';
import { kickoffs, describeWeek } from '../book/kickoffs.js';
import { homeCard } from '../book/data.js';
import { sleeper } from '../sleeper/client.js';
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

// GET /api/pulse — Home badge only. Live means an NFL game is in progress (ESPN),
// not "the server is up". Cached inside kickoffs(); safe to poll once a minute.
router.get('/pulse', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const blank = { live: false, live_n: 0, left: 0, next: null, delayed: false, phase: null };
  try {
    const state = await sleeper('/state/nfl', { maxAgeMs: 10 * 60 * 1000 });
    const season = String(state.season || '');
    const week = Number(state.week) || 0;
    if (state.season_type !== 'regular' || !week) return res.json({ season, week, ...blank });
    const k = await kickoffs(season, week, { maxAgeMs: 45 * 1000 });
    let games = [];
    try { games = (await homeCard(week)).games || []; } catch (e) { console.error('home card', e.message); }
    res.json({ season, week, ...describeWeek(k), games });
  } catch (err) {
    console.error('pulse failed', err.message);
    res.json(blank);
  }
});

export default router;
