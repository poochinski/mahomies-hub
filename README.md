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

## Account setup and tests

New and reset accounts need a private setup code from the commissioner. Existing
PINs keep working. See [account setup and recovery](docs/ACCOUNT-SETUP.md), including
`npm run invite:commish` for initial commissioner setup from the server console.

Run `npm ci` and `npm test` for the isolated database/API regression suite. Tests
use fixture league data and never connect to the production database.

