// Mahomie's Hub server: serves /api and the built React app (dist/).
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stateRoutes from './routes/state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.use('/api', stateRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// The service worker and manifest must never be cached, so app updates show up.
app.use(
  express.static(dist, {
    setHeaders(res, filePath) {
      if (/(sw\.js|workbox-.*\.js|manifest\.webmanifest|index\.html)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

// Any other path loads the React app (React Router handles the page).
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, () => console.log(`Mahomie's Hub running on port ${PORT}`));
