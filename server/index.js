import fs from 'node:fs';
// Mahomie's Hub server: serves /api (incl. the Sportsbook) and the app page (v1.8 build).
import dns from 'node:dns';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stateRoutes from './routes/state.js';
import gameRoutes from './routes/game.js';
import labRoutes from './routes/lab.js';
import hubRoutes from './routes/hub.js';
import bookRoutes from './routes/book.js';
import yahooRoutes from './routes/yahoo.js';
import { initBook, startBookJobs } from './book/book.js';
import { pool } from './db.js';

// Some hosts can't route IPv6 out; prefer IPv4 so calls to Sleeper don't hang.
dns.setDefaultResultOrder('ipv4first');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototype');
// v2.0 source of truth: prototype/v2.0/ (app.html + app.css + app.js, edited directly, no build step).
// snapshot.json is the bundled Sleeper data used until /api/hub answers; it's put into app.html here.
const V2 = path.join(proto, 'v2.0');
const pageCache = new Map();
function pageFrom(dir) {
  if (!pageCache.has(dir) || process.env.NODE_ENV !== 'production') {
    const html = fs.readFileSync(path.join(dir, 'app.html'), 'utf8');
    const data = fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8').replace(/<\//g, '<\\/');
    pageCache.set(dir, html.replace('__DATA__', () => data));
  }
  return pageCache.get(dir);
}
const appPage = () => pageFrom(V2);
const PORT = process.env.PORT || 3000;

const app = express();
app.set('trust proxy', 1); // Railway sits in front; use the phone's real address for login limits
app.use(express.json());

app.use('/api', stateRoutes);
app.use('/api', gameRoutes);
app.use('/api', labRoutes);
app.use('/api', hubRoutes);
app.use('/api', bookRoutes);
app.use(yahooRoutes); // /yahoo page + /api/yahoo/* (old Yahoo seasons import)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// The first deploy installed a service worker that keeps showing the old
// placeholder app. This replacement removes itself and clears its caches, so
// phones pick up the real app on the next refresh.
const KILL_SW = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  for(const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for(const c of await self.clients.matchAll({type:'window'})) c.navigate(c.url);
})())});`;
for (const p of ['/sw.js', '/service-worker.js', '/registerSW.js']) {
  app.get(p, (_req, res) => {
    res.set('Cache-Control', 'no-store').type('application/javascript');
    res.send(p === '/registerSW.js' ? '' : KILL_SW);
  });
}
app.get(/^\/workbox-.*\.js$/, (_req, res) => res.set('Cache-Control', 'no-store').type('application/javascript').send(''));

// Install-to-home-screen info.
app.get('/manifest.webmanifest', (_req, res) => {
  res.set('Cache-Control', 'no-cache').type('application/manifest+json').send(JSON.stringify({
    name: "Mahomie's Hub", short_name: "Mahomie's Hub",
    description: "Rollin' with Mahomies league HQ: history, stats and the Sportsbook.",
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
    theme_color: '#130f1d', background_color: '#130f1d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }));
});

// Icons and other files in /public.
app.use(express.static(path.join(root, 'public'), { index: false }));

// Older builds, kept in case we need to go back.
app.use('/v2', express.static(V2, { index: false, setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
// v2.3 frozen before the v2.4 look, so the old design can be compared or restored.
const V23 = path.join(proto, 'v2.3');
app.get('/test/v2.3', (_req, res) => res.set('Cache-Control', 'no-store').type('html').send(pageFrom(V23)));
app.use('/test/v2.3', express.static(V23, { index: false, redirect: false, setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
// Exact look from the night of Oct 10, before the v2.6 chrome trial. Say "go back" to restore this.
const V25 = path.join(proto, 'v2.5');
app.get('/test/v2.5', (_req, res) => res.set('Cache-Control', 'no-store').type('html').send(pageFrom(V25)));
app.use('/test/v2.5', express.static(V25, { index: false, redirect: false, setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
// The look as it was on Oct 17, right before the v3 redesign. Jayson says "revert" → restore
// prototype/v2.0/{app.html,app.css,app.js} from branch release-v2.6-classic (see HANDOFF).
const CLASSIC = path.join(proto, 'classic');
app.get('/test/classic', (_req, res) => res.set('Cache-Control', 'no-store').type('html').send(pageFrom(CLASSIC)));
// Me › Settings › Old style sends phones here (and app.html remembers the choice in localStorage 'mh-style').
app.get('/classic', (_req, res) => res.set('Cache-Control', 'no-store').type('html').send(pageFrom(CLASSIC)));
app.use('/test/classic', express.static(CLASSIC, { index: false, redirect: false, setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
app.get('/test/v1.8', (_req, res) => res.sendFile(path.join(proto, 'v1.8', 'night.html')));
app.get('/test/v1.7', (_req, res) => res.sendFile(path.join(proto, 'v1.7', 'night.html')));
app.get('/test/v1.6', (_req, res) => res.sendFile(path.join(proto, 'v1.6', 'night.html')));
app.get('/test/v1.5', (_req, res) => res.sendFile(path.join(proto, 'v1.5', 'night.html')));
app.get('/test/v1.0', (_req, res) => res.sendFile(path.join(proto, 'v1.0', 'night.html')));
app.get('/test/v1.0/light', (_req, res) => res.sendFile(path.join(proto, 'v1.0', 'light.html')));

// Every other address opens the app (never cached, so updates show up right away).
app.get('*', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('html').send(appPage());
});

app.listen(PORT, () => console.log(`Mahomie's Hub running on port ${PORT}`));

// Sportsbook: create tables if needed, then run the clock job every 10 minutes
// (posts lines Tuesday 6 AM, keeps game locks current, settles Wednesday 3 AM).
if (pool) {
  initBook().then(() => console.log('[book] database ready')).catch((e) => console.error('[book] database not ready yet:', e.message));
  if (process.env.BOOK_JOBS !== 'off') startBookJobs();
}
