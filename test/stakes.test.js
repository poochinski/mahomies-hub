import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';

// Stakes (Jayson, 2026-10-25): "If you win" said 3rd because of his record, but three other teams
// with the same record also won and had more points, so he finished 6th. The tab has to play out
// every game this week and break ties on total points.
async function stakesFor({ median }) {
  const base = new URL('../prototype/v2.0/', import.meta.url);
  const data = JSON.parse(await fs.readFile(new URL('snapshot.json', base), 'utf8'));
  const L = data.league, S = data.seasons[L.season];
  Object.assign(L, { week: 8, last_scored: 7, playoff_start: 15, median });
  const me = data.me, others = S.standings.map((t) => t.uid).filter((u) => u !== me);
  const [A, B, C, Dd, E, F, G, H, I, J, K] = others;
  const rec = { [A]: [6, 1, 900], [B]: [6, 1, 880], [me]: [5, 2, 800], [C]: [5, 2, 790], [Dd]: [5, 2, 785], [E]: [5, 2, 780],
    [F]: [3, 4, 700], [G]: [3, 4, 690], [H]: [2, 5, 680], [I]: [2, 5, 670], [J]: [1, 6, 660], [K]: [1, 6, 650] };
  S.standings = Object.entries(rec).map(([uid, [w, l, pf]], i) => ({ ...S.standings.find((t) => t.uid === uid), uid, w, l, pf, seed: i + 1 }));
  const games = [[me, F, 100, 90], [C, G, 130, 90], [Dd, H, 125, 90], [E, I, 95, 100], [A, B, 110, 100], [J, K, 95, 94]];
  data.lines = games.map(([a, b, pa, pb], i) => ({ id: `w8m${i + 1}`, a, b, pa, pb, live_a: 0, live_b: 0 }));
  const slot = (j) => [{ s: 'QB', n: 'Somebody', id: '1', p: 0, j, e: 0, st: 'pre', k: '2026-10-25T20:25:00Z', l: '', c: '' }];
  const pulse = { season: L.season, week: 8, live: false, phase: 'Sunday', poll: 60000, games: games.map(([a, b, pa, pb], i) => ({
    id: `w8m${i + 1}`, a, b, pts_a: 0, pts_b: 0, proj_a: pa, proj_b: pb, now_a: 0, now_b: 0, left_a: 1, left_b: 1, on_a: false, on_b: false,
    fin_a: false, fin_b: false, warn_a: [], warn_b: [], empty_a: 0, empty_b: 0, slots_a: slot(pa), slots_b: slot(pb) })) };
  const snapshot = JSON.stringify(data);
  const html = (await fs.readFile(new URL('app.html', base), 'utf8')).replace('__DATA__', () => snapshot.replace(/<\//g, '<\\/'));
  const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'https://fixture.test/#home', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, doc = w.document;
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
  w.localStorage.setItem('mh-me', JSON.stringify(me));
  w.fetch = async (url) => {
    const p = new URL(url, 'https://fixture.test').pathname;
    const response = (body) => ({ status: 200, ok: true, json: async () => body });
    if (p === '/api/health') return response({ ok: true, app: "Mahomie's Hub" });
    if (p === '/api/hub') return response(data);
    if (p === '/api/pulse') return response(pulse);
    if (p === '/api/leagues') return response({ leagues: [] });
    return response({});
  };
  w.eval(await fs.readFile(new URL('app.js', base), 'utf8'));
  // The matchup card shows Stakes as a row (no tabs since 2026-11-09).
  for (let n = 0; n < 300 && !doc.querySelector('.mx-row[data-mh="seed"]'); n++) await new Promise((r) => setTimeout(r, 10));
  const row = doc.querySelector('.mx-row[data-mh="seed"]');
  const cells = [...row.querySelectorAll('.mx-pair > span')].map((c) => c.textContent);
  row.click();
  for (let n = 0; n < 100 && !doc.querySelector('#sheetBody').textContent.includes('Where this game leaves you'); n++) await new Promise((r) => setTimeout(r, 10));
  const sheet = doc.querySelector('#sheetBody').textContent;
  w.close();
  return { cells, sheet, errors };
}

test('Stakes counts every game this week and breaks record ties on points', async () => {
  const { cells, sheet, errors } = await stakesFor({ median: false });
  assert.deepEqual(errors, []);
  assert.equal(cells.length, 2);
  // Old answer was 3rd: it ignored that C, D and B also get to six wins with more points.
  assert.equal(cells[0], 'Win 5th');
  assert.equal(cells[1], 'Lose 5th');
  assert.match(sheet, /then total points/);
  assert.match(sheet, /If you win · 5th/);
});

test('Stakes plays the median game too', async () => {
  const { cells, errors } = await stakesFor({ median: true });
  assert.deepEqual(errors, []);
  assert.equal(cells[0], 'Win 5th');
});
