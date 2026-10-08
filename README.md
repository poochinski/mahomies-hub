# Mahomie's Hub

League HQ for **Rollin' with Mahomies**: league history, record book, season stats and the Banana Book.

- **Rules, design and plan:** [BIBLE.md](BIBLE.md)
- **Where we left off:** [HANDOFF.md](HANDOFF.md)
- **History of changes:** [CHANGELOG.md](CHANGELOG.md)

## Run it in Codespaces

```bash
npm install
npm run build
SLEEPER_LEAGUE_ID=1312104253497540608 npm start
```

Then open the forwarded port 3000.

For live-reload while editing, run these in two terminals:

```bash
SLEEPER_LEAGUE_ID=1312104253497540608 npm run dev:server   # API on port 3000
npm run dev                                                # app on port 5173
```

## Deploy

Railway builds with `npm run build` and starts with `npm start` on every push to `main`.
