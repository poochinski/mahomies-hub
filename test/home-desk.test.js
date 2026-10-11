import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packSide } from '../server/book/data.js';

test('packSide keeps slot order and does not warn on an empty slot', () => {
  const R = {
    pts: 10, proj_pre: 100, proj_live: 90, out: ['empty'],
    players: [
      { slot: 'QB', empty: false, name: 'Patrick Mahomes', pid: '1', pts: 0, proj: 22.24, state: 'pre', pos: 'QB', nfl: 'KC', inj: null },
      { slot: 'SUPER_FLEX', empty: true, name: '', pid: '', pts: 0, proj: null, state: 'empty', pos: '', nfl: '' },
      { slot: 'FLEX', empty: false, name: 'Bye Guy', pid: '2', pts: 0, proj: null, state: 'bye', pos: 'WR', nfl: 'DAL', inj: null }
    ]
  };
  const s = packSide(R);
  assert.deepEqual(s.slots.map((x) => x.s), ['QB', 'SF', 'FLX']);
  assert.equal(s.slots[0].n, 'Patrick Mahomes');
  assert.equal(s.slots[0].j, 22.2);
  assert.equal(s.slots[1].e, 1);
  assert.equal(s.warn.length, 1);
  assert.equal(s.warn[0].name, 'Bye Guy');
  assert.equal(s.empty, 1);
  assert.equal(s.left, 1);
  assert.equal(s.now, 0);
  assert.equal(s.started, false);
  assert.equal(s.proj, 100);
});
