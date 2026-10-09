// Mahomie's Hub server: serves /api and the app page (currently the v1.5 build).
import dns from 'node:dns';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stateRoutes from './routes/state.js';
import gameRoutes from './routes/game.js';
import labRoutes from './routes/lab.js';
import hubRoutes from './routes/hub.js';

// Some hosts can't route IPv6 out; prefer IPv4 so calls to Sleeper don't hang.
dns.setDefaultResultOrder('ipv4first');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const proto = path.join(root, 'prototype');
const APP_PAGE = path.join(proto, 'dist', 'night.html'); // v1.7
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.use('/api', stateRoutes);
app.use('/api', gameRoutes);
app.use('/api', labRoutes);
app.use('/api', hubRoutes);
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
    description: "Rollin' with Mahomies league HQ: history, stats and the Banana Book.",
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
app.get('/test/v1.6', (_req, res) => res.sendFile(path.join(proto, 'v1.6', 'night.html')));
app.get('/test/v1.5', (_req, res) => res.sendFile(path.join(proto, 'v1.5', 'night.html')));
app.get('/test/v1.0', (_req, res) => res.sendFile(path.join(proto, 'v1.0', 'night.html')));
app.get('/test/v1.0/light', (_req, res) => res.sendFile(path.join(proto, 'v1.0', 'light.html')));

// Every other address opens the app (never cached, so updates show up right away).
app.get('*', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(APP_PAGE);
});

app.listen(PORT, () => console.log(`Mahomie's Hub running on port ${PORT}`));
