// Gridiron Gold: server side of the hidden slot. Uses the Sportsbook's logins and ledger.
import { pool } from '../db.js';
import { spinGrid, evaluate, newBoard, LINES, FREE_MULT, SYMBOLS, PAYS, TICKET_PAYS, FREE_SPINS, BOARD, COMBINE } from './engine.js';
import * as sl from '../book/data.js';
import { BookError } from '../book/book.js';

export const BETS = [10, 25, 50];
const money = (n) => Math.round(n * 100) / 100;

async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const out = await fn(c); await c.query('COMMIT'); return out; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}
const balance = async (c, u, s) => money((await c.query('SELECT COALESCE(SUM(amount),0)::float b FROM bankroll_ledger WHERE user_id=$1 AND season=$2', [u, s])).rows[0].b);
async function lockState(c, u, s) {
  await c.query('SELECT 1 FROM app_users WHERE user_id=$1 FOR UPDATE', [u]);
  await c.query('INSERT INTO slot_state(user_id, season) VALUES ($1,$2) ON CONFLICT DO NOTHING', [u, s]);
  return (await c.query('SELECT * FROM slot_state WHERE user_id=$1 AND season=$2', [u, s])).rows[0];
}
const publicBonus = (b) => (b ? { picks: b.picks.map((i) => ({ index: i, value: b.values[i] })), need: 3 - b.picks.length, bet: Number(b.bet), size: b.values.length } : null);

export function paytable() {
  return { symbols: SYMBOLS, pays: PAYS, ticket_pays: TICKET_PAYS, free_spins: FREE_SPINS, free_mult: FREE_MULT, board: BOARD, combine: COMBINE, lines: LINES, bets: BETS, rtp: '≈95%' };
}

export async function state(userId) {
  const L = await sl.league();
  return tx(async (c) => {
    const st = await lockState(c, userId, L.season);
    return { balance: await balance(c, userId, L.season), free_left: st.free_left, free_bet: st.free_bet ? Number(st.free_bet) : null, free_won: Number(st.free_won), bonus: publicBonus(st.bonus), bets: BETS };
  });
}

export async function spin(userId, betIn) {
  const L = await sl.league();
  return tx(async (c) => {
    const st = await lockState(c, userId, L.season);
    if (st.bonus) throw new BookError('Finish your Draft Day bonus first');
    const free = st.free_left > 0;
    const bet = free ? Number(st.free_bet) : Number(betIn);
    if (!free && !BETS.includes(bet)) throw new BookError(`Spins are ${BETS.join(' / ')} Bucks`);
    let bal = await balance(c, userId, L.season);
    if (!free) {
      if (bet > bal) throw new BookError(`Not enough Bucks (you have ${bal})`);
      await c.query("INSERT INTO bankroll_ledger(user_id, season, amount, kind, note) VALUES ($1,$2,$3,'slot_bet','Gridiron Gold spin')", [userId, L.season, -bet]);
    }
    const grid = spinGrid();
    const e = evaluate(grid);
    const mult = free ? FREE_MULT : 1;
    const win = money(e.total * bet * mult);
    let freeLeft = st.free_left - (free ? 1 : 0), freeWon = free ? Number(st.free_won) + win : 0;
    if (e.freeSpins) { freeLeft += e.freeSpins; if (!free) freeWon = 0; }
    const freeBet = freeLeft > 0 ? bet : null;
    let bonus = null;
    if (e.bonus) { bonus = { ...newBoard(), bet }; }
    if (win > 0) await c.query("INSERT INTO bankroll_ledger(user_id, season, amount, kind, note) VALUES ($1,$2,$3,'slot_win',$4)", [userId, L.season, win, free ? 'Gridiron Gold free spin' : 'Gridiron Gold win']);
    await c.query('UPDATE slot_state SET free_left=$3, free_bet=$4, free_won=$5, bonus=$6 WHERE user_id=$1 AND season=$2', [userId, L.season, freeLeft, freeBet, freeLeft > 0 || free ? freeWon : 0, bonus ? JSON.stringify(bonus) : null]);
    await c.query('INSERT INTO slot_spins(user_id, season, kind, bet, win, grid, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userId, L.season, free ? 'free' : 'spin', bet, win, JSON.stringify(grid), JSON.stringify({ wins: e.wins, tickets: e.tickets, bonus: e.bonus })]);
    bal = await balance(c, userId, L.season);
    return {
      grid, bet, free, mult, win,
      wins: e.wins.map((w) => ({ ...w, pay: money(w.pay * bet * mult), cells: LINES[w.line].slice(0, w.n).map((row, reel) => [reel, row]) })),
      scatter: money(e.scatter * bet * mult), tickets: e.tickets,
      free_awarded: e.freeSpins, free_left: freeLeft, free_won: money(freeWon), free_done: free && freeLeft === 0,
      bonus: bonus ? publicBonus(bonus) : null, balance: bal
    };
  });
}

export async function pick(userId, index) {
  const L = await sl.league();
  return tx(async (c) => {
    const st = await lockState(c, userId, L.season);
    const b = st.bonus;
    if (!b) throw new BookError('No Draft Day bonus to play');
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= b.values.length) throw new BookError('Pick a prospect on the board');
    if (b.picks.includes(i)) throw new BookError('Already picked');
    b.picks.push(i);
    const out = { index: i, value: b.values[i], picks: b.picks.map((k) => ({ index: k, value: b.values[k] })), need: 3 - b.picks.length };
    if (b.picks.length < 3) {
      await c.query('UPDATE slot_state SET bonus=$3 WHERE user_id=$1 AND season=$2', [userId, L.season, JSON.stringify(b)]);
      return out;
    }
    const sum = b.picks.reduce((a, k) => a + b.values[k], 0);
    const total = money(sum * b.combine * Number(b.bet));
    await c.query("INSERT INTO bankroll_ledger(user_id, season, amount, kind, note) VALUES ($1,$2,$3,'slot_win','Gridiron Gold: Draft Day bonus')", [userId, L.season, total]);
    await c.query('UPDATE slot_state SET bonus=NULL WHERE user_id=$1 AND season=$2', [userId, L.season]);
    await c.query("INSERT INTO slot_spins(user_id, season, kind, bet, win, detail) VALUES ($1,$2,'bonus',$3,$4,$5)", [userId, L.season, b.bet, total, JSON.stringify(b)]);
    return { ...out, done: true, sum, combine: b.combine, total, board: b.values, balance: await balance(c, userId, L.season) };
  });
}
