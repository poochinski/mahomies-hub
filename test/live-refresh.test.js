import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kickoffs, liveAge, isGameLive, clearKickoffCache, LIVE_MS } from '../server/book/kickoffs.js';
import { sleeper, clearSleeperCache } from '../server/sleeper/client.js';

const espn = (state) => ({
  events: [{ date: new Date(Date.now() - 3600e3).toISOString(),
    status: { period: 2, clock: 300, type: { state, shortDetail: 'Q2 5:00' } },
    competitions: [{ competitors: [{ homeAway: 'home', score: '7', team: { abbreviation: 'SEA' } }, { homeAway: 'away', score: '3', team: { abbreviation: 'ARI' } }] }] }]
});

test('a game in progress switches the server to the fast live refresh', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; clearKickoffCache(); });
  clearKickoffCache();
  globalThis.fetch = async () => ({ ok: true, json: async () => espn('post') });
  await kickoffs('2026', 5, { maxAgeMs: 0 });
  assert.equal(isGameLive(), false);
  assert.equal(liveAge(45000), 45000);
  clearKickoffCache();
  globalThis.fetch = async () => ({ ok: true, json: async () => espn('in') });
  await kickoffs('2026', 5, { maxAgeMs: 0 });
  assert.equal(isGameLive(), true);
  assert.equal(liveAge(45000), LIVE_MS);
});

test('many phones asking at once make one Sleeper call, and a failed refresh keeps the last numbers', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; clearSleeperCache(); });
  clearSleeperCache();
  let calls = 0;
  globalThis.fetch = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return { ok: true, json: async () => ({ v: calls }) }; };
  const got = await Promise.all(Array.from({ length: 12 }, () => sleeper('/x', { maxAgeMs: 0 })));
  assert.equal(calls, 1);
  assert.ok(got.every((g) => g.v === 1));
  globalThis.fetch = async () => { throw new Error('down'); };
  assert.deepEqual(await sleeper('/x', { maxAgeMs: 0 }), { v: 1 });
});
