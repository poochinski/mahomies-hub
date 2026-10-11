import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import * as engine from '../server/book/engine.js';

const db = new PGlite();
const L = { season: '2026', leagueId: 'fixture', P: 15, lastScored: 0,
  active: ['commish', 'alice', 'bob'], owner: { 1: 'alice', 2: 'bob' },
  teams: { commish: { id: 'commish', team: 'Commish' }, alice: { id: 'alice', team: 'Alice' }, bob: { id: 'bob', team: 'Bob' } } };
const kickoff = new Date('2099-01-01T20:00:00Z');
let failCredit = false, failReset = false, sawLockedCap = false;
let tail = Promise.resolve();
async function acquire() {
  const previous = tail; let release;
  tail = new Promise((r) => { release = r; });
  await previous; return release;
}
async function query(sql, params, inAccountTransaction = false) {
  if (sql.includes('AS used FROM bets') && inAccountTransaction) sawLockedCap = true;
  if (failCredit && sql.startsWith('INSERT INTO bankroll_ledger') && !sql.includes("'grant'") && !sql.includes("'stake'")) {
    failCredit = false; throw new Error('Injected ledger failure');
  }
  if (failReset && sql.startsWith('DELETE FROM sessions')) { failReset = false; throw new Error('Injected reset failure'); }
  if (sql.includes('CREATE TABLE')) return (await db.exec(sql)).at(-1);
  return db.query(sql, params);
}
// PGlite has one connection. Transactions get exclusive use, exercising real
// PostgreSQL SQL/rollback semantics without opening a production connection.
const pool = {
  async query(sql, params) { const release = await acquire(); try { return await query(sql, params); } finally { release(); } },
  async connect() {
    const release = await acquire(); let accountLocked = false;
    return { release, async query(sql, params) {
      if (sql.includes('app_users') && sql.includes('FOR UPDATE')) accountLocked = true;
      return query(sql, params, accountLocked);
    } };
  }
};
const sl = {
  league: async () => L,
  weekState: async () => ({ starts: {}, rosters: {}, k: { first: kickoff, last: kickoff } }),
  pointsFor: async () => ({ 1: 100, 2: 90 }),
  playerPoints: async () => ({}),
};
const sleeper = async (p) => p.endsWith('/winners_bracket') ? [{ p: 1, w: 1 }] : [];
async function moduleAt(relative, mocks) {
  const url = new URL(relative, import.meta.url);
  const mod = new vm.SourceTextModule(await fs.readFile(url, 'utf8'), {
    identifier: url.href, initializeImportMeta(meta) { meta.url = url.href; }
  });
  await mod.link(async (specifier) => {
    const values = specifier.startsWith('node:') ? await import(specifier) : mocks[specifier];
    assert.ok(values, `Missing fixture dependency: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await mod.evaluate(); return mod.namespace;
}
let book, server, origin;
before(async () => {
  book = await moduleAt('../server/book/book.js', {
    '../db.js': { pool }, '../config.js': { COMMISH_USER_ID: 'commish' },
    './engine.js': engine, './data.js': sl,
    './kickoffs.js': { kickoffs: async () => ({}), postTime: () => kickoff, settleTime: () => kickoff, fmtPT: String },
    '../sleeper/client.js': { sleeper }, '../hub/cache.js': { getHub: async () => ({}) }
  });
  await book.initBook();
  const common = { express: { Router: express.Router }, '../db.js': { pool }, '../config.js': { COMMISH_USER_ID: 'commish' }, '../book/book.js': book };
  const yahoo = await moduleAt('../server/routes/yahoo.js', { ...common,
    '../yahoo.js': { status: async () => ({ connected: true }), rawList: async () => [{ path: 'private' }], raw: async () => ({ body: { fixture: 'private' } }) }
  });
  const routes = await moduleAt('../server/routes/book.js', { ...common, '../slots/slots.js': {} });
  const app = express(); app.use(express.json()); app.use('/api', routes.default); app.use(yahoo.default);
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise((r) => server.close(r)); await db.close(); });
beforeEach(async () => {
  failCredit = failReset = sawLockedCap = false;
  await pool.query('TRUNCATE app_users, sessions, book_weeks, lines, bets, bet_legs, bankroll_ledger, book_settings, book_log, slot_state, slot_spins, slot_jackpots, book_specials RESTART IDENTITY CASCADE');
});
let attempts = 0;
const login = (uid, pin = '1234', invite = '') => book.login(uid, pin, `test-${++attempts}`, invite);
async function join(uid) { const i = await book.resetPin(uid, 'commish'); return login(uid, '1234', i.invite); }
async function req(path, token, body) {
  return fetch(origin + path, { method: body ? 'POST' : 'GET',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function board(id = 'future', mid = -1) {
  await pool.query(`INSERT INTO lines(id, season, week, matchup_id, team_a, team_b, roster_a, roster_b, proj_a, proj_b, spread, total, ml_a, ml_b, wp_a, lock_at, sd_a, sd_b)
    VALUES ($1,'2026',6,$2,'alice','bob',1,2,100,90,10,190,100,100,0.5,$3,10,10)`, [id, mid, kickoff]);
  if (mid === -1) await pool.query("INSERT INTO book_specials(line_id,market,pick,odds) VALUES ($1,'champ','alice',100)", [id]);
}
const futureBet = (amount = 100) => book.placeBet('bob', [{ line_id: 'future', market: 'champ', pick: 'alice', odds: 100 }], amount);
async function payoutState() {
  return (await pool.query(`SELECT b.status, g.result, COALESCE((SELECT SUM(amount) FROM bankroll_ledger x WHERE x.bet_id=b.id AND x.kind IN ('payout','refund')),0)::float credit
    FROM bets b JOIN bet_legs g ON g.bet_id=b.id ORDER BY b.id`)).rows;
}

test('unclaimed accounts, including commissioner, reject arbitrary PINs and codes', async () => {
  for (const uid of ['alice', 'commish']) {
    await assert.rejects(login(uid), { status: 403 });
    await assert.rejects(login(uid, '1234', 'made-up'), { status: 403 });
  }
  assert.equal((await pool.query('SELECT * FROM sessions')).rows.length, 0);
});
test('setup codes are user-bound, hashed, expiring and replaced on reissue', async () => {
  const old = await book.resetPin('alice', 'commish');
  const code = await book.resetPin('alice', 'commish');
  const user = (await pool.query("SELECT * FROM app_users WHERE user_id='alice'")).rows[0];
  assert.notEqual(user.pin_invite_hash, code.invite); assert.equal(user.pin_invite_hash.length, 64);
  assert.equal(new Date(code.expires_at) - book.now() > 23 * 3600000, true);
  await assert.rejects(login('alice', '1234', old.invite), { status: 403 });
  await assert.rejects(login('bob', '1234', code.invite), { status: 403 });
  await pool.query("UPDATE app_users SET pin_invite_expires=now()-interval '1 second' WHERE user_id='alice'");
  await assert.rejects(login('alice', '1234', code.invite), { status: 403 });
});
test('successful setup consumes code; existing PINs still log in with one grant', async () => {
  const code = await book.resetPin('alice', 'commish');
  const first = await login('alice', '1234', code.invite);
  assert.equal(first.created, true); assert.equal(await book.userFromToken(first.token), 'alice');
  assert.equal((await login('alice')).created, false);
  await assert.rejects(login('alice', '5678', code.invite), { status: 401 });
  assert.equal((await pool.query("SELECT pin_invite_hash FROM app_users WHERE user_id='alice'")).rows[0].pin_invite_hash, null);
  assert.equal((await pool.query("SELECT * FROM bankroll_ledger WHERE kind='grant'")).rows.length, 1);
  assert.equal(JSON.stringify((await pool.query('SELECT * FROM book_log')).rows).includes(code.invite), false);
});
test('racing setup requests cannot replace the first successful PIN', async () => {
  const code = await book.resetPin('alice', 'commish');
  const r = await Promise.allSettled([login('alice', '1234', code.invite), login('alice', '5678', code.invite)]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await pool.query('SELECT * FROM sessions')).rows.length, 1);
});
test('PIN reset revokes sessions and requires a new private code', async () => {
  const previous = await join('alice');
  const code = await book.resetPin('alice', 'commish');
  assert.equal(await book.userFromToken(previous.token), null);
  await assert.rejects(login('alice'), { status: 403 });
  assert.equal((await login('alice', '5678', code.invite)).created, true);
});
test('PIN reset rolls back entirely if session revocation fails', async () => {
  const previous = await join('alice'); failReset = true;
  await assert.rejects(book.resetPin('alice', 'commish'), /Injected reset failure/);
  assert.equal(await book.userFromToken(previous.token), 'alice');
  assert.equal((await login('alice')).created, false);
});
test('wrong-PIN attempt counters survive transactions and lock after five failures', async () => {
  await join('alice');
  for (let i = 0; i < 5; i++) await assert.rejects(login('alice', '9999'), { status: 401 });
  await assert.rejects(login('alice'), { status: 429 });
});
test('Yahoo saved-data endpoints reject guests and regular users; commissioner retains access', async () => {
  const alice = await join('alice'), admin = await join('commish');
  for (const p of ['/api/yahoo/status', '/api/yahoo/raw-list', '/api/yahoo/raw?path=private']) {
    for (const [token, status] of [[null, 401], ['invalid', 401], [alice.token, 403], [admin.token, 200]]) {
      const r = await req(p, token); assert.equal(r.status, status); assert.equal(r.headers.get('cache-control'), 'no-store'); await r.text();
    }
  }
});
test('only commissioner can issue setup codes through HTTP; login accepts code', async () => {
  const alice = await join('alice'), admin = await join('commish');
  for (const [token, status] of [[null, 401], [alice.token, 403]]) {
    const r = await req('/api/book/admin/reset-pin', token, { user_id: 'bob' }); assert.equal(r.status, status); await r.text();
  }
  const r = await req('/api/book/admin/reset-pin', admin.token, { user_id: 'bob' });
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  const code = await r.json();
  const signed = await req('/api/book/login', null, { user_id: 'bob', pin: '1234', invite: code.invite });
  assert.equal(signed.status, 200); assert.equal((await signed.json()).created, true);
});
test('concurrent futures cannot exceed cap and cap is checked after account lock', async () => {
  await join('bob'); await board();
  const r = await Promise.allSettled([futureBet(250), futureBet(250)]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  assert.match(r.find((x) => x.status === 'rejected').reason.message, /capped at 250/);
  assert.equal(sawLockedCap, true);
  assert.equal((await pool.query('SELECT SUM(stake)::float n FROM bets')).rows[0].n, 250);
});
test('cancelled futures release cap; replacement bet is permitted', async () => {
  await join('bob'); await board(); const { bet } = await futureBet(250);
  await book.cancelBet('bob', bet.id);
  assert.equal((await futureBet(250)).bet.stake, 250);
});
test('failed futures payout rolls back legs and bet; retry credits exactly once', async () => {
  await join('bob'); await board(); await futureBet(); failCredit = true;
  await assert.rejects(book.settleFutures(), /Injected ledger failure/);
  assert.deepEqual(await payoutState(), [{ status: 'open', result: 'open', credit: 0 }]);
  await book.settleFutures(); await book.settleFutures();
  assert.deepEqual(await payoutState(), [{ status: 'won', result: 'won', credit: 200 }]);
});
test('concurrent futures settlement credits a winning bet once', async () => {
  await join('bob'); await board(); await futureBet();
  await Promise.all([book.settleFutures(), book.settleFutures()]);
  assert.deepEqual(await payoutState(), [{ status: 'won', result: 'won', credit: 200 }]);
});
test('open bets with previously graded futures legs are recovered', async () => {
  await join('bob'); await board(); await futureBet();
  await pool.query("UPDATE bet_legs SET result='won'");
  await book.settleFutures();
  assert.deepEqual(await payoutState(), [{ status: 'won', result: 'won', credit: 200 }]);
});
test('void refunds roll back with the line on failure and pay once on retry', async () => {
  await join('bob'); await board(); await futureBet(); failCredit = true;
  await assert.rejects(book.editLine('future', { void: true }, 'commish'), /Injected ledger failure/);
  assert.equal((await pool.query("SELECT status FROM lines WHERE id='future'")).rows[0].status, 'open');
  assert.deepEqual(await payoutState(), [{ status: 'open', result: 'open', credit: 0 }]);
  await book.editLine('future', { void: true }, 'commish');
  await book.settleFutures();
  assert.deepEqual(await payoutState(), [{ status: 'void', result: 'void', credit: 100 }]);
});
test('weekly settlement still grades and pays ordinary bets', async () => {
  await join('bob'); await board('game', 1);
  await pool.query("INSERT INTO book_weeks(season,week) VALUES ('2026',6)");
  await book.placeBet('bob', [{ line_id: 'game', market: 'ml', pick: 'b', odds: 100 }], 100);
  await book.settleWeek('2026', 6, { force: true, by: 'commish' });
  assert.deepEqual(await payoutState(), [{ status: 'lost', result: 'lost', credit: 0 }]);
});
test('weekly winning payout rolls back on failure and pays on retry', async () => {
  await join('commish'); await board('game', 1);
  await pool.query("INSERT INTO book_weeks(season,week) VALUES ('2026',6)");
  await book.placeBet('commish', [{ line_id: 'game', market: 'ml', pick: 'a', odds: 100 }], 100);
  failCredit = true;
  await assert.rejects(book.settleWeek('2026', 6, { force: true }), /Injected ledger failure/);
  assert.deepEqual(await payoutState(), [{ status: 'open', result: 'open', credit: 0 }]);
  await book.settleWeek('2026', 6, { force: true });
  assert.deepEqual(await payoutState(), [{ status: 'won', result: 'won', credit: 200 }]);
});
test('voiding one parlay leg keeps the bet open; voiding both refunds once', async () => {
  await join('commish'); await board('one', 1); await board('two', 2);
  await book.placeBet('commish', ['one', 'two'].map(line_id => ({ line_id, market: 'ml', pick: 'a', odds: 100 })), 100);
  await book.editLine('one', { void: true }, 'commish');
  assert.equal((await pool.query('SELECT status FROM bets')).rows[0].status, 'open');
  assert.equal((await pool.query("SELECT * FROM bankroll_ledger WHERE kind='refund'")).rows.length, 0);
  await Promise.all([book.editLine('two', { void: true }, 'commish'), book.editLine('two', { void: true }, 'commish')]);
  assert.equal((await pool.query('SELECT status FROM bets')).rows[0].status, 'void');
  assert.equal((await pool.query("SELECT SUM(amount)::float n FROM bankroll_ledger WHERE kind='refund'")).rows[0].n, 100);
});
test('zero-balance slot player stays joined; unjoined team retains preview bankroll', async () => {
  await join('alice');
  await pool.query("INSERT INTO bankroll_ledger(user_id,season,amount,kind) VALUES ('alice','2026',-1000,'slot_bet')");
  const lb = await book.leaderboard(), alice = lb.find((x) => x.user_id === 'alice'), bob = lb.find((x) => x.user_id === 'bob');
  assert.equal(alice.joined, true); assert.equal(alice.cash, 0); assert.equal(alice.bankroll, 0); assert.equal(alice.profit, -1000);
  assert.equal(bob.joined, false); assert.equal(bob.bankroll, 1000);
});
