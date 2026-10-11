import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';

test('account UI handles setup-code retry, PIN confirmation, code issuance and existing login', async () => {
  const base = new URL('../prototype/v2.0/', import.meta.url);
  const snapshot = await fs.readFile(new URL('snapshot.json', base), 'utf8');
  const data = JSON.parse(snapshot), uid = data.me;
  const other = Object.keys(data.managers).find((u) => u !== uid && data.managers[u].active);
  const html = (await fs.readFile(new URL('app.html', base), 'utf8')).replace('__DATA__', () => snapshot.replace(/<\//g, '<\\/'));
  const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'https://fixture.test', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, doc = w.document;
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
  let hasPin = false; const requests = [];
  const teams = () => [uid, other].map((id) => ({ id, team: data.managers[id].team, name: data.managers[id].name, has_pin: id === uid && hasPin, commish: id === uid }));
  w.fetch = async (url, opt = {}) => {
    const p = new URL(url, 'https://fixture.test').pathname;
    const response = (body, status = 200) => ({ status, ok: status < 400, json: async () => body });
    if (p === '/api/health') return response({ ok: true, app: "Mahomie's Hub" });
    if (p === '/api/hub') return response(data);
    if (p === '/api/pulse') return response({ phase: null, games: [] });
    if (p === '/api/wire') return response({ moves: [] });
    if (p === '/api/book/teams') return response(teams());
    if (p === '/api/book/status') return response({ settings: { min_bet: 10, max_bet: 250, grant: 1000 }, next: null });
    if (p === '/api/book/lines') return response({ week: null, lines: [] });
    if (p === '/api/book/weekly') return response({ week: null, rows: [] });
    if (p === '/api/book/feed') return response([]);
    if (p === '/api/book/leaderboard') return response([uid, other].map((user_id) => ({ user_id, cash: 1000, in_play: 0, bankroll: 1000, joined: user_id === uid, profit: 0, record: '0-0', rank: 1 })));
    if (p === '/api/book/me') return response({ user_id: uid, commish: true, balance: 1000, in_play: 0, bets: [], ledger: [], futures_used: 0 });
    if (p === '/api/book/login') {
      const body = JSON.parse(opt.body); requests.push(body);
      if (!hasPin && body.invite !== 'private-test-code') return response({ error: 'Ask the commish for a valid setup code before choosing a PIN.' }, 403);
      const created = !hasPin; hasPin = true; return response({ token: 'fixture-session', user_id: uid, created });
    }
    if (p === '/api/book/admin/reset-pin') return response({ user_id: other, invite: 'new-private-code', expires_at: new Date(Date.now() + 86400000).toISOString() });
    if (p === '/api/book/logout') return response({ ok: true });
    throw new Error(`Unexpected request: ${p}`);
  };
  const click = (selector) => { const el = doc.querySelector(selector); assert.ok(el, selector); el.click(); };
  async function until(check) {
    for (let n = 0; n < 200; n++) { if (check()) return; await new Promise((r) => setTimeout(r, 10)); }
    assert.fail('UI did not reach expected state: ' + doc.querySelector('#sheetBody').textContent);
  }
  const enterPin = () => { for (const key of '1234') click(`[data-key="${key}"]`); };
  async function setup(code) {
    doc.querySelector('#pinInvite').value = code; click('[data-invitego]'); enterPin();
    await until(() => doc.querySelector('#sheetBody').textContent.includes('Type it again')); enterPin();
  }
  try {
    w.eval(await fs.readFile(new URL('app.js', base), 'utf8'));
    await until(() => doc.querySelector('#view').children.length > 0);
    click('[data-tab="me"]'); await until(() => doc.querySelector('[data-login]'));
    click('[data-login]'); await until(() => doc.querySelector(`[data-lteam="${uid}"]`));
    click(`[data-lteam="${uid}"]`);
    assert.ok(doc.querySelector('#pinInvite'));
    click('[data-invitego]'); assert.match(doc.querySelector('#sheetBody').textContent, /Enter the setup code/);
    await setup('wrong-code'); await until(() => doc.querySelector('#pinInvite'));
    assert.match(doc.querySelector('#sheetBody').textContent, /valid setup code/);
    await setup('private-test-code');
    await until(() => JSON.parse(w.localStorage.getItem('mh-auth') || 'null')?.token === 'fixture-session');
    await until(() => doc.querySelector('[data-adm="pin"]'));
    click('[data-adm="pin"]'); doc.querySelector('#aUser').value = other; click('[data-admgo="pin"]');
    await until(() => doc.querySelector('[aria-label="Private setup code"]'));
    assert.equal(doc.querySelector('[aria-label="Private setup code"]').value, 'new-private-code');
    assert.equal(w.localStorage.getItem('mh-auth').includes('new-private-code'), false);
    click('#closeP'); click('[data-logout]'); click('[data-login]');
    await until(() => doc.querySelector(`[data-lteam="${uid}"]`)); click(`[data-lteam="${uid}"]`);
    assert.equal(doc.querySelector('#pinInvite'), null); enterPin();
    await until(() => JSON.parse(w.localStorage.getItem('mh-auth') || 'null')?.token === 'fixture-session');
    assert.equal(requests.at(-1).invite, '');
    // Let the post-login refresh finish before destroying its document.
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(errors, []);
  } finally { w.close(); }
});
