// /api/book/* — the Sportsbook. Phones send "Authorization: Bearer <token>" after logging in.
import { Router } from 'express';
import { pool } from '../db.js';
import { COMMISH_USER_ID } from '../config.js';
import * as book from '../book/book.js';

const router = Router();

const wrap = (fn) => async (req, res) => {
  try { res.json(await fn(req, res)); }
  catch (e) {
    const status = e instanceof book.BookError ? e.status : 500;
    if (status === 500) console.error('[book]', e);
    res.status(status).json({ error: status === 500 ? `Book error: ${e.message}` : e.message });
  }
};

// Database must be up for anything Book-related.
router.use('/book', async (_req, res, next) => {
  if (!pool) return res.status(503).json({ error: 'The Book needs the database (DATABASE_URL not set)' });
  if (!book.isReady()) { try { await book.initBook(); } catch (e) { return res.status(503).json({ error: `Database not ready: ${e.message}` }); } }
  next();
});

const token = (req) => (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim() || null;
async function who(req) { return book.userFromToken(token(req)); }
async function need(req) { const u = await who(req); if (!u) throw new book.BookError('Log in first', 401); return u; }
async function commish(req) { const u = await need(req); if (u !== COMMISH_USER_ID) throw new book.BookError('Commish only', 403); return u; }

router.get('/book/status', wrap(() => book.status()));
router.get('/book/teams', wrap(() => book.teamsList()));
router.post('/book/login', wrap((req) => book.login(String(req.body?.user_id || ''), String(req.body?.pin || ''), req.ip)));
router.post('/book/logout', wrap(async (req) => { await book.logout(token(req)); return { ok: true }; }));
router.get('/book/me', wrap(async (req) => book.me(await need(req))));

router.get('/book/lines', wrap((req) => book.linesFor(Number(req.query.week) || null)));
router.post('/book/bets', wrap(async (req) => book.placeBet(await need(req), req.body?.legs, req.body?.stake)));
router.post('/book/bets/:id/cancel', wrap(async (req) => book.cancelBet(await need(req), req.params.id)));
router.get('/book/leaderboard', wrap(() => book.leaderboard()));
router.get('/book/feed', wrap((req) => book.feed(req.query.limit)));

// ---------- commish tools ----------
router.post('/book/admin/post-lines', wrap(async (req) => book.postLines(Number(req.body?.week), { force: !!req.body?.force, by: await commish(req) })));
router.post('/book/admin/settle', wrap(async (req) => {
  const by = await commish(req); const s = await book.status();
  return book.settleWeek(String(req.body?.season || s.season), Number(req.body?.week), { force: !!req.body?.force, by });
}));
router.post('/book/admin/line/:id', wrap(async (req) => { await book.editLine(req.params.id, req.body || {}, await commish(req)); return { ok: true }; }));
router.post('/book/admin/adjust', wrap(async (req) => ({ balance: await book.adjust(String(req.body?.user_id), req.body?.amount, req.body?.note, await commish(req)) })));
router.post('/book/admin/reset-pin', wrap(async (req) => { await book.resetPin(String(req.body?.user_id), await commish(req)); return { ok: true }; }));
router.post('/book/admin/setting', wrap(async (req) => book.setSetting(String(req.body?.key), req.body?.value, await commish(req))));
router.post('/book/admin/tick', wrap(async (req) => { await commish(req); return book.tick(); }));
router.get('/book/admin/health', wrap(async (req) => { await commish(req); return book.health(); }));
router.get('/book/admin/log', wrap(async (req) => { await commish(req); return book.recentLog(Number(req.query.limit) || 50); }));

export default router;
