// GET /api/game?season=2023&week=17&users=<userIdA>,<userIdB>
// Full box score for one game: every starter (by lineup slot) and bench player,
// with name, position, NFL team and fantasy points, for both teams.
import { Router } from 'express';
import { sleeper, leagueChain, getPlayers } from '../sleeper/client.js';
import { LEAGUE_ID, COMMISH_USER_ID } from '../config.js';

const router = Router();
const HOUR = 60 * 60 * 1000;

router.get('/game', async (req, res) => {
  const { season, week, users } = req.query;
  const leagueId = LEAGUE_ID;
  if (!leagueId) return res.status(500).json({ error: 'SLEEPER_LEAGUE_ID is not set' });
  if (!season || !week || !users) {
    return res.status(400).json({ error: 'Need season, week and users (two user ids, comma separated)' });
  }
  const wanted = String(users).split(',').filter(Boolean);

  try {
    const chain = await leagueChain(leagueId);
    const s = chain.find((x) => x.season === String(season));
    if (!s) return res.status(404).json({ error: `No league found for ${season}` });

    const state = await sleeper('/state/nfl');
    const isPast = String(season) < state.season || Number(week) < Number(state.week);
    const matchupAge = isPast ? 7 * 24 * HOUR : 2 * 60 * 1000; // old weeks never change

    const [league, rosters, matchups, players] = await Promise.all([
      sleeper(`/league/${s.league_id}`, { maxAgeMs: HOUR }),
      sleeper(`/league/${s.league_id}/rosters`, { maxAgeMs: HOUR }),
      sleeper(`/league/${s.league_id}/matchups/${week}`, { maxAgeMs: matchupAge }),
      getPlayers()
    ]);

    const slots = (league.roster_positions || []).filter((p) => p !== 'BN' && p !== 'IR' && p !== 'TAXI');
    const rosterOf = Object.fromEntries(rosters.map((r) => [r.owner_id, r.roster_id]));
    const info = (id, pts) => {
      const p = players[id] || {};
      return {
        id,
        name: p.n || (/^[A-Z]{2,3}$/.test(id) ? `${id} defense` : `Player ${id}`),
        pos: p.p || (/^[A-Z]{2,3}$/.test(id) ? 'DEF' : ''),
        team: p.t || '',
        pts: Math.round((pts ?? 0) * 100) / 100
      };
    };

    const teams = wanted.map((uid) => {
      const rid = rosterOf[uid];
      const m = matchups.find((x) => x.roster_id === rid);
      if (!m) return { user_id: uid, roster_id: rid ?? null, points: null, starters: [], bench: [] };
      const pp = m.players_points || {};
      const starters = (m.starters || []).map((id, i) => ({
        slot: slots[i] || 'FLEX',
        ...(id && id !== '0' ? info(id, (m.starters_points || [])[i] ?? pp[id]) : { id: null, name: 'Empty', pos: '', team: '', pts: 0 })
      }));
      const startSet = new Set(m.starters || []);
      const bench = (m.players || [])
        .filter((id) => !startSet.has(id))
        .map((id) => info(id, pp[id]))
        .sort((a, b) => b.pts - a.pts);
      return { user_id: uid, roster_id: rid, points: m.points, starters, bench };
    });

    res.json({ season: String(season), week: Number(week), slots, teams });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
