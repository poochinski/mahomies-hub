import { Router } from 'express';
import { sleeper, leagueChain } from '../sleeper/client.js';
import { checkDb } from '../db.js';
import { LEAGUE_ID, COMMISH_USER_ID } from '../config.js';

const router = Router();

// GET /api/health — is the server up, is the database connected?
router.get('/health', async (_req, res) => {
  res.json({ ok: true, app: "Mahomie's Hub", db: await checkDb() });
});

// GET /api/diag — always 200, says whether the server can reach Sleeper and why not.
router.get('/diag', async (_req, res) => {
  const out = { node: process.version, league: LEAGUE_ID, env_league: !!process.env.SLEEPER_LEAGUE_ID };
  try {
    const t0 = Date.now();
    const r = await fetch('https://api.sleeper.app/v1/state/nfl', { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json', 'user-agent': 'MahomiesHub/1.5' } });
    out.ms = Date.now() - t0;
    out.sleeper_status = r.status;
    out.sleeper_body = (await r.text()).slice(0, 200);
  } catch (e) {
    out.sleeper_error = String(e && (e.cause?.code || e.cause?.message || e.message));
  }
  try { const c = await Promise.race([leagueChain(LEAGUE_ID), new Promise((_, j) => setTimeout(() => j(new Error('chain timed out after 10s')), 10000))]); out.seasons = c.map((x) => x.season); } catch (e) { out.chain_error = String(e.cause?.code || e.message); }
  res.json(out);
});

// GET /api/state — current NFL week + league basics + every season on Sleeper.
router.get('/state', async (_req, res) => {
  const leagueId = LEAGUE_ID;
  if (!leagueId) return res.status(500).json({ error: 'SLEEPER_LEAGUE_ID is not set' });
  try {
    const [nfl, league, seasons] = await Promise.all([
      sleeper('/state/nfl'),
      sleeper(`/league/${leagueId}`),
      leagueChain(leagueId)
    ]);
    res.json({
      league: {
        id: league.league_id,
        name: league.name,
        season: league.season,
        status: league.status,
        teams: league.total_rosters,
        playoff_teams: league.settings?.playoff_teams,
        playoff_week_start: league.settings?.playoff_week_start,
        scoring: league.scoring_settings?.rec === 1 ? 'PPR' : league.scoring_settings?.rec === 0.5 ? 'Half PPR' : 'Standard'
      },
      nfl: {
        season: nfl.season,
        week: nfl.week,
        season_type: nfl.season_type,
        last_scored_week: league.settings?.last_scored_leg ?? null
      },
      seasons,
      fetched_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
