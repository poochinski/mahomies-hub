import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordOnce, timelineFor, describeDiff, _reset } from '../server/stats/timeline.js';

const gameOf = { NYG: { state: 'in', detail: 'Q2 5:12' } };
const teamOf = () => 'NYG';
const roster = (pts) => [{ players: ['9'], players_points: { 9: pts } }];
const T0 = Date.parse('2026-10-11T20:00:00Z');

test('logs points already on the board, then each new play, folding split updates together', async () => {
  _reset();
  const base = { season: '2026', week: 5, gameOf, teamOf };
  await recordOnce({ ...base, rosters: roster(10), stats: { 9: { rec: 3, rec_yd: 40 } }, now: T0 });
  // stats land first, points 10 seconds later: one entry, not two
  await recordOnce({ ...base, rosters: roster(10), stats: { 9: { rec: 4, rec_yd: 54 } }, now: T0 + 10e3 });
  await recordOnce({ ...base, rosters: roster(12.4), stats: { 9: { rec: 4, rec_yd: 54 } }, now: T0 + 20e3 });
  // nothing changed: no entry
  await recordOnce({ ...base, rosters: roster(12.4), stats: { 9: { rec: 4, rec_yd: 54 } }, now: T0 + 30e3 });
  // a touchdown a few minutes later
  await recordOnce({ ...base, rosters: roster(21.4), stats: { 9: { rec: 5, rec_yd: 77, rec_td: 1 } }, now: T0 + 300e3 });
  const tl = await timelineFor('2026', 5, '9');
  assert.equal(tl.length, 3);
  assert.equal(tl[0].kind, 'start');
  assert.equal(tl[0].delta, 10);
  assert.equal(tl[1].what, '+1 REC, +14 REC YD');
  assert.equal(tl[1].delta, 2.4);
  assert.equal(tl[1].clock, 'Q2 5:12');
  assert.equal(tl[2].what, '+1 REC, +23 REC YD, +1 REC TD');
  assert.equal(tl[2].pts, 21.4);
});

test('describeDiff reads like a box score', () => {
  assert.equal(describeDiff({ rush_att: 1, rush_yd: -2 }), '+1 CAR, -2 RUSH YD');
  assert.equal(describeDiff({ fgm: 1 }), '+1 FG');
});
