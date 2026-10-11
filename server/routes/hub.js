// GET /api/hub — everything the app shows, built live from Sleeper.
// Rebuilt at most every 3 minutes (past weeks are cached for days inside the Sleeper client).
import { Router } from 'express';
import { getHub } from '../hub/cache.js';
import { kickoffs, describeWeek, liveAge, isGameLive, LIVE_MS } from '../book/kickoffs.js';
import { homeCard, gameCenter, pregameProjections } from '../book/data.js';
import { playerWeek } from '../stats/playerweek.js';
import { playerProfile } from '../player.js';
import { teamPage, playerSearch, wire } from '../team.js';
import { draftIndex, draftSeason } from '../draft.js';
import { frontOffice } from '../records/frontoffice.js';
import { sleeper } from '../sleeper/client.js';
import { LEAGUE_ID, COMMISH_USER_ID } from '../config.js';

const router = Router();
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
    const k = await kickoffs(season, week, { maxAgeMs: liveAge(45 * 1000) });
    let games = [];
    try { games = (await homeCard(week)).games || []; } catch (e) { console.error('home card', e.message); }
    // poll tells the phone how often to ask again: fast while games are on, slow otherwise.
    res.json({ season, week, ...describeWeek(k), games, poll: isGameLive() ? LIVE_MS : 60 * 1000, at: new Date().toISOString() });
  } catch (err) {
    console.error('pulse failed', err.message);
    res.json(blank);
  }
});

// GET /api/projhist?weeks=2,3,4,5 — each team's pregame projection for finished weeks (Home "Last 4 weeks").
router.get('/projhist', async (req, res) => {
  const weeks = String(req.query.weeks || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 6);
  try { res.json({ weeks: await pregameProjections(weeks) }); }
  catch (err) { console.error('projhist failed', err.message); res.json({ weeks: {} }); }
});

// GET /api/live/player/:pid?week= — one player's week: box score, snaps, NFL game, scoring timeline.
router.get('/live/player/:pid', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await playerWeek(req.params.pid, req.query.week)); }
  catch (err) { console.error('player week failed', err.message); res.status(500).json({ error: err.message }); }
});

// GET /api/live/:week/:mid — Live Game Center for one matchup (player by player). Polled about once a minute.
router.get('/live/:week/:mid', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await gameCenter(req.params.week, req.params.mid)); }
  catch (err) { console.error('live failed', err.message); res.status(500).json({ error: err.message }); }
});

// GET /api/player/:pid — player profile (bio, NFL seasons scored the league's way, league history).
router.get('/player/:pid', async (req, res) => {
  try { res.json(await playerProfile(req.params.pid)); }
  catch (err) { console.error('player failed', err.message); res.status(500).json({ error: err.message }); }
});

// GET /api/team/:uid — this season for one team (roster, schedule, moves).
router.get('/team/:uid', async (req, res) => {
  try { res.json(await teamPage(String(req.params.uid))); }
  catch (err) { if (err.status !== 404) console.error('team failed', err.message); res.status(err.status || 500).json({ error: err.message }); }
});

// GET /api/players/search?q= — any NFL player, with who has him in the league.
router.get('/players/search', async (req, res) => {
  try { res.json(await playerSearch(String(req.query.q || ''))); }
  catch (err) { console.error('search failed', err.message); res.status(500).json({ error: err.message }); }
});

// GET /api/wire — League Wire: this season's trades, waivers and adds.
router.get('/wire', async (req, res) => {
  try { res.json(await wire({ limit: Math.min(100, Number(req.query.limit) || 40) })); }
  catch (err) { console.error('wire failed', err.message); res.status(500).json({ error: err.message }); }
});

// GET /api/draft — every draft, plus the habits that only show across seasons.
router.get('/draft', async (_req, res) => {
  try { res.json(await draftIndex()); }
  catch (err) { console.error('draft index failed', err.message); res.status(500).json({ error: err.message }); }
});

// GET /api/draft/:season — one draft: the whole board, graded.
router.get('/draft/:season', async (req, res) => {
  try { res.json(await draftSeason(req.params.season)); }
  catch (err) { if (err.status !== 404) console.error('draft failed', err.message); res.status(err.status || 500).json({ error: err.message }); }
});

// GET /api/records/frontoffice — the twenty Front Office boards (trades, wire, draft).
router.get('/records/frontoffice', async (_req, res) => {
  try { res.json(await frontOffice()); }
  catch (err) { console.error('front office failed', err.message); res.status(500).json({ error: err.message }); }
});

export default router;
