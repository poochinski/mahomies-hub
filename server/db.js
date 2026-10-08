// Postgres connection pool. DATABASE_URL comes from Railway.
// If it isn't set (for example in a fresh Codespace), the app still runs;
// database-backed features just report "not connected".
import pg from 'pg';

const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Railway's internal network doesn't need SSL; public URLs do.
      ssl: process.env.DATABASE_URL.includes('railway.internal')
        ? false
        : { rejectUnauthorized: false }
    })
  : null;

export async function checkDb() {
  if (!pool) return { connected: false, reason: 'DATABASE_URL not set' };
  try {
    const { rows } = await pool.query('SELECT NOW() AS now');
    return { connected: true, now: rows[0].now };
  } catch (err) {
    return { connected: false, reason: err.message };
  }
}
