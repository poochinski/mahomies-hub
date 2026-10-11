// Run only from a trusted server console with DATABASE_URL configured.
import { pool } from '../db.js';
import { COMMISH_USER_ID } from '../config.js';
import { initBook, resetPin } from '../book/book.js';

try {
  if (!pool) throw new Error('DATABASE_URL must be set in this server console.');
  await initBook();
  const r = await resetPin(COMMISH_USER_ID, 'server-console');
  console.log(`Commissioner PIN and sessions revoked. Choose the commissioner team in the app and use this one-time setup code: ${r.invite}`);
  console.log(`Expires: ${r.expires_at}. Keep this code private.`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
