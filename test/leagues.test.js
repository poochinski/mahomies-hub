import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatLabel } from '../server/leagues.js';

test('league picker labels read like Sleeper\'s', () => {
  assert.equal(formatLabel({ total_rosters: 12, sport: 'nfl', settings: { type: 1 }, scoring_settings: { rec: 1 }, roster_positions: ['QB', 'RB'] }), '12-Team Keeper PPR');
  assert.equal(formatLabel({ total_rosters: 12, sport: 'nfl', settings: { type: 2 }, scoring_settings: { rec: 1, bonus_rec_te: 0.5 }, roster_positions: ['QB', 'SUPER_FLEX'] }), '12-Team Dynasty SF PPR TEP');
  assert.equal(formatLabel({ total_rosters: 10, sport: 'nfl', settings: { type: 0 }, scoring_settings: { rec: 0.5 }, roster_positions: [] }), '10-Team Half PPR');
  assert.equal(formatLabel({ total_rosters: 10, sport: 'nba', settings: { type: 0 }, scoring_settings: { pts: 1 }, roster_positions: ['PG'] }), '10-Team');
});
