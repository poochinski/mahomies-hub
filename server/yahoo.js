// Yahoo history import (the league played 2021–2022 on Yahoo before moving to Sleeper).
// Step 1 (this file): the commish connects Yahoo once (read-only OAuth), then the server
// downloads every piece of each old season and saves Yahoo's answers as-is in yahoo_raw.
// Old seasons never change, so after one import Yahoo isn't needed again.
// Step 2 (later): turn the saved answers into seasons that records/history/rivals can use.
import crypto from 'node:crypto';
import { pool } from './db.js';

const API = process.env.YAHOO_API_BASE || 'https://fantasysports.yahooapis.com/fantasy/v2/'; // *_BASE only for local tests
const AUTH = process.env.YAHOO_AUTH_BASE || 'https://api.login.yahoo.com/oauth2/';
export const REDIRECT = (process.env.YAHOO_REDIRECT || 'https://mahomies-hub-production.up.railway.app/yahoo/callback').trim();

let ready = null;
function init() {
  if (!pool) return Promise.reject(new Error('Database not connected'));
  ready ||= (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS yahoo_kv (k TEXT PRIMARY KEY, v JSONB, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS yahoo_raw (path TEXT PRIMARY KEY, league_key TEXT, ok BOOLEAN NOT NULL, body JSONB, fetched_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
async function kvGet(k) { await init(); const { rows } = await pool.query('SELECT v FROM yahoo_kv WHERE k=$1', [k]); return rows[0]?.v ?? null; }
async function kvSet(k, v) {
  await init();
  await pool.query('INSERT INTO yahoo_kv (k, v, updated_at) VALUES ($1,$2,now()) ON CONFLICT (k) DO UPDATE SET v=$2, updated_at=now()', [k, JSON.stringify(v)]);
}

async function creds() {
  const id = process.env.YAHOO_CLIENT_ID, secret = process.env.YAHOO_CLIENT_SECRET;
  if (id && secret) return { id: id.trim(), secret: secret.trim() };
  return kvGet('creds');
}
export async function saveCreds(id, secret) {
  id = String(id || '').trim(); secret = String(secret || '').trim();
  if (id.length < 10 || secret.length < 10) throw new Error('That Client ID / Client Secret looks too short');
  await kvSet('creds', { id, secret });
}

// ---------- OAuth ----------
export async function authUrl() {
  const c = await creds(); if (!c) throw new Error('Add the Yahoo Client ID and Secret first');
  const state = crypto.randomBytes(16).toString('hex');
  await kvSet('oauth_state', { state, at: Date.now() });
  const q = new URLSearchParams({ client_id: c.id, redirect_uri: REDIRECT, response_type: 'code', scope: 'fspt-r', state, language: 'en-us' }); // fspt-r = Fantasy Sports read
  return AUTH + 'request_auth?' + q;
}
async function tokenCall(params) {
  const c = await creds(); if (!c) throw new Error('Yahoo keys missing');
  const res = await fetch(AUTH + 'get_token', {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(c.id + ':' + c.secret).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ redirect_uri: REDIRECT, ...params }),
    signal: AbortSignal.timeout(20000)
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error('Yahoo login failed: ' + (j.error_description || j.error || res.status));
  const tok = { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60000, at: new Date().toISOString(), scope: j.scope || null };
  await kvSet('token', tok);
  return tok;
}
export async function finishAuth(code, state) {
  const s = await kvGet('oauth_state');
  if (!s || s.state !== state || Date.now() - s.at > 30 * 60000) throw new Error('This Yahoo login link expired. Start again from the Yahoo page.');
  await kvSet('oauth_state', null);
  await tokenCall({ grant_type: 'authorization_code', code });
}
async function access() {
  let t = await kvGet('token'); if (!t) throw new Error('Yahoo not connected');
  if (Date.now() > t.expires) t = await tokenCall({ grant_type: 'refresh_token', refresh_token: t.refresh });
  return t.access;
}

// ---------- Yahoo calls (every answer is saved, good or bad) ----------
async function yget(path, leagueKey = null, retry = true) {
  const url = API + path + (path.includes('?') ? '&' : '?') + 'format=json';
  const res = await fetch(url, { headers: { authorization: 'Bearer ' + (await access()), accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (res.status === 401 && retry) { const t = await kvGet('token'); if (t) { t.expires = 0; await kvSet('token', t); } return yget(path, leagueKey, false); }
  if (res.status === 999 || res.status === 429) { await sleep(60000); if (retry) return yget(path, leagueKey, false); }
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { text: text.slice(0, 2000) }; }
  await pool.query('INSERT INTO yahoo_raw (path, league_key, ok, body, fetched_at) VALUES ($1,$2,$3,$4,now()) ON CONFLICT (path) DO UPDATE SET league_key=$2, ok=$3, body=$4, fetched_at=now()',
    [path, leagueKey, res.ok, JSON.stringify(body)]);
  if (!res.ok) {
    const why = body?.error?.description || '';
    if (/not authorized/i.test(why)) throw new Error('Yahoo says this app isn\'t allowed to read Fantasy Sports. On developer.yahoo.com, open the app and make sure API Permissions has Fantasy Sports → Read ticked, then tap Reconnect (Step 2) and try again.');
    throw new Error(`Yahoo ${res.status} on ${path}${why ? ': ' + why : ''}`);
  }
  return body;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Yahoo's JSON wraps objects as arrays of one-key pieces and lists as {"0":…, "1":…, count}.
// norm() turns that into plain objects and arrays.
export function norm(x) {
  if (Array.isArray(x)) {
    if (x.every((e) => e && typeof e === 'object')) {
      const out = {};
      for (const e of x) Object.assign(out, norm(e));
      return out;
    }
    return x.map(norm);
  }
  if (x && typeof x === 'object') {
    if ('count' in x && '0' in x) return Object.keys(x).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b).map((k) => norm(x[k]));
    const o = {}; for (const k of Object.keys(x)) o[k] = norm(x[k]); return o;
  }
  return x;
}
// Every object anywhere inside `x` that has all of `keys`.
export function findAll(x, keys, out = []) {
  if (Array.isArray(x)) { for (const e of x) findAll(e, keys, out); }
  else if (x && typeof x === 'object') {
    if (keys.every((k) => k in x)) out.push(x);
    for (const v of Object.values(x)) findAll(v, keys, out);
  }
  return out;
}

// ---------- finding the old leagues ----------
export async function findLeagues() {
  const raw = await yget('users;use_login=1/games;game_codes=nfl/leagues');
  const seen = new Map();
  for (const l of findAll(norm(raw), ['league_key', 'season'])) {
    if (!seen.has(l.league_key)) seen.set(l.league_key, { league_key: l.league_key, season: String(l.season), name: l.name, teams: Number(l.num_teams) || null, url: l.url || null });
  }
  const leagues = [...seen.values()].sort((a, b) => a.season.localeCompare(b.season));
  await kvSet('leagues', leagues);
  return leagues;
}

// ---------- importing one league (runs in the background; progress in IMPORT) ----------
const IMPORT = { running: false, league_key: null, done: 0, total: 0, errors: [], step: '', finished_at: null };
export function importStatus() { return { ...IMPORT, errors: IMPORT.errors.slice(-20) }; }

export async function startImport(leagueKey) {
  if (IMPORT.running) throw new Error('An import is already running');
  if (!/^\d+\.l\.\d+$/.test(leagueKey)) throw new Error('Bad league key');
  if (!(await kvGet('token'))) throw new Error('Connect Yahoo first (Step 2)');
  Object.assign(IMPORT, { running: true, league_key: leagueKey, done: 0, total: 0, errors: [], step: 'Starting', finished_at: null });
  let failed = false;
  runImport(leagueKey).catch((e) => { failed = true; IMPORT.errors.push(e.message); }).finally(async () => {
    IMPORT.running = false; IMPORT.finished_at = new Date().toISOString(); IMPORT.step = failed ? 'Stopped: ' + IMPORT.errors.at(-1) : 'Finished';
    if (failed) return;
    const done = (await kvGet('imported')) || {};
    done[leagueKey] = { at: IMPORT.finished_at, calls: IMPORT.done, errors: IMPORT.errors.length };
    await kvSet('imported', done).catch(() => {});
  });
}

async function runImport(lk) {
  let streak = 0; // stop if Yahoo refuses many calls in a row (lost access, rate limit)
  const step = async (label, path) => {
    IMPORT.step = label;
    try { const b = await yget(path, lk); IMPORT.done++; streak = 0; await sleep(250); return b; }
    catch (e) {
      IMPORT.done++; IMPORT.errors.push(`${label}: ${e.message}`);
      if (++streak >= 8) throw new Error('Yahoo stopped answering, try again later');
      return null;
    }
  };
  IMPORT.total = 6;
  const settings = await step('League settings', `league/${lk}/settings`);
  if (!settings) throw new Error('Yahoo would not open this league');
  await step('Standings', `league/${lk}/standings`);
  const teams = await step('Teams and managers', `league/${lk}/teams`);
  await step('Draft', `league/${lk}/draftresults/players`);
  await step('Trades and waivers', `league/${lk}/transactions`);
  await step('League info', `league/${lk}`);
  const meta = settings ? findAll(norm(settings), ['league_key', 'end_week'])[0] : null;
  const start = Number(meta?.start_week) || 1, end = Number(meta?.end_week) || 17;
  const teamKeys = teams ? [...new Set(findAll(norm(teams), ['team_key']).map((t) => t.team_key))] : [];
  const weeks = []; for (let w = start; w <= end; w++) weeks.push(w);
  IMPORT.total += weeks.length * (1 + teamKeys.length);
  for (const w of weeks) {
    await step(`Week ${w} scores`, `league/${lk}/scoreboard;week=${w}`);
    for (const tk of teamKeys) await step(`Week ${w} lineups`, `team/${tk}/roster;week=${w}/players/stats;type=week;week=${w}`);
  }
}

// ---------- read-only views (no tokens or keys ever leave the server) ----------
export async function status() {
  const out = { db: !!pool, redirect_uri: REDIRECT };
  if (!pool) return out;
  const [c, t, leagues, imported] = await Promise.all([creds(), kvGet('token'), kvGet('leagues'), kvGet('imported')]);
  const { rows } = await pool.query('SELECT league_key, count(*)::int AS n, sum(CASE WHEN ok THEN 0 ELSE 1 END)::int AS bad FROM yahoo_raw GROUP BY league_key ORDER BY league_key NULLS FIRST');
  return { ...out, has_keys: !!c, connected: !!t, connected_at: t?.at || null, scope: t?.scope || null, leagues: leagues || [], imported: imported || {}, saved: rows, import: importStatus() };
}
export async function rawList(leagueKey) {
  await init();
  const { rows } = await pool.query('SELECT path, ok, fetched_at, length(body::text) AS size FROM yahoo_raw WHERE ($1::text IS NULL OR league_key=$1) ORDER BY path', [leagueKey || null]);
  return rows;
}
export async function raw(path, normalized) {
  await init();
  const { rows } = await pool.query('SELECT path, ok, body, fetched_at FROM yahoo_raw WHERE path=$1', [path]);
  if (!rows[0]) return null;
  return normalized ? { ...rows[0], body: norm(rows[0].body) } : rows[0];
}
