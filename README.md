# Mahomie's Hub

League HQ for **Rollin' with Mahomies**: league history, record book, season stats and the Sportsbook (Mahomie Bucks, play money only).

- **Rules, design and plan:** [BIBLE.md](BIBLE.md)
- **Where we left off:** [HANDOFF.md](HANDOFF.md)
- **History of changes:** [CHANGELOG.md](CHANGELOG.md)

## Run it in Codespaces

```bash
npm install
npm start
```

Then open the forwarded port 3000. `npm run dev` restarts the server when a server file changes.

The app page is `prototype/v2.0/` (app.html, app.css, app.js). Edit those files directly; there is no build step.

## Deploy

Railway installs and runs `npm start` on every push to `main` (no build step).
