# Private account setup and recovery

Existing PINs and sessions continue to work after deployment. New accounts and
reset accounts require a private, single-use setup code before choosing a PIN.
Codes expire after 24 hours and only a SHA-256 hash is stored in the database.

## Commissioner setup or recovery

From the trusted Railway/server console, with the application's `DATABASE_URL`
and `COMMISH_USER_ID` settings available, run:

```sh
npm run invite:commish
```

This revokes the commissioner's current PIN and sessions and prints one setup
code. Keep the console output private. In the app, choose the commissioner team,
paste the code, then choose and confirm a four-digit PIN. This command is also
the recovery path if the commissioner is locked out; there is no public bootstrap
endpoint or default setup code.

## Other managers

In **Me → Book controls → Set up or reset a PIN**, choose the team and create a
setup code. This revokes that team's existing PIN and sessions. Send the code
privately to the team's owner after checking their identity. It is displayed only
once; creating a replacement invalidates the earlier code.

The manager chooses their team, pastes the code, and sets their PIN. Subsequent
logins need only the PIN. Do not post codes in public league chats, issues or logs.

## Settlement integrity

Futures grading, bet status updates and credits now commit together. Voiding a
line and its resulting refunds also commit together. Each bet is locked while
graded to prevent concurrent settlement from paying it twice. Open bets whose
futures legs were graded by an interrupted older run are retried.

This change does not rewrite previously settled balances. If a bet was already
marked settled without a credit by the old code, review its ledger and reconcile
it using the commissioner adjustment tool with an explanatory note.

## Regression checks

Run `npm ci` followed by `npm test`. Tests use an isolated in-memory PGlite
Postgres database, a JSDOM interface test, and fixture league data; they do not use
`DATABASE_URL`, Sleeper or Yahoo accounts. The database adapter serializes connections because PGlite
has one connection; concurrent request tests also verify that the futures cap is
read inside the account transaction. Production PostgreSQL row-lock contention
and the deployed Railway environment are not exercised by this suite.
