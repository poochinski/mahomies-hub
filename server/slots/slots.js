// Gridiron Gold: server side of the hidden slot. Uses the Sportsbook's logins and ledger.
import { pool } from '../db.js';
import { spinStops, gridAt, STRIPS, PAR, evaluate, drillRun, DRILL, LINES, FREE_MULT, SYMBOLS, PAYS, TICKET_PAYS, FREE_SPINS } from './engine.js';
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
// The Two-Minute Drill is decided and paid the moment it triggers (so closing the app can't lose it);
// the frames are kept until the player has watched them.
const publicBonus = (b) => (b ? { bet: Number(b.bet), frames: b.frames, total: b.total, jackpots: DRILL.jackpots.map((j) => ({ name: j[0], x: j[1] })) } : null);

export function paytable() {
  return { symbols: SYMBOLS, pays: PAYS, ticket_pays: TICKET_PAYS, free_spins: FREE_SPINS, free_mult: FREE_MULT, drill: { drives: DRILL.drives, max: DRILL.maxDrives, values: DRILL.values, jackpots: DRILL.jackpots.map((j) => ({ name: j[0], x: j[1] })) }, lines: LINES, bets: BETS, strips: STRIPS, par: PAR, rtp: (PAR.rtp * 100).toFixed(1) + '%' };
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
    if (st.bonus) throw new BookError('Watch your Two-Minute Drill first');
    const free = st.free_left > 0;
    const bet = free ? Number(st.free_bet) : Number(betIn);
    if (!free && !BETS.includes(bet)) throw new BookError(`Spins are ${BETS.join(' / ')} Bucks`);
    let bal = await balance(c, userId, L.season);
    if (!free) {
      if (bet > bal) throw new BookError(`Not enough Bucks (you have ${bal})`);
      await c.query("INSERT INTO bankroll_ledger(user_id, season, amount, kind, note) VALUES ($1,$2,$3,'slot_bet','Gridiron Gold spin')", [userId, L.season, -bet]);
    }
    const stops = spinStops();
    const grid = gridAt(stops);
    const e = evaluate(grid);
    const mult = free ? FREE_MULT : 1;
    const win = money(e.total * bet * mult);
    let freeLeft = st.free_left - (free ? 1 : 0), freeWon = free ? Number(st.free_won) + win : 0;
    if (e.freeSpins) { freeLeft += e.freeSpins; if (!free) freeWon = 0; }
    const freeBet = freeLeft > 0 ? bet : null;
    let bonus = null;
    if (e.bonus) {
      const run = drillRun();
      bonus = { bet, frames: run.frames, total: money(run.total * bet) };
      await c.query("INSERT INTO bankroll_ledger(user_id, season, amount, kind, note) VALUES ($1,$2,$3,'slot_win','Gridiron Gold: Two-Minute Drill')", [userId, L.season, bonus.total]);
      await c.query("INSERT INTO slot_spins(user_id, season, kind, bet, win, detail) VALUES ($1,$2,'bonus',$3,$4,$5)", [userId, L.season, bet, bonus.total, JSON.stringify(run)]);
    }
    if (win > 0) await c.query("INSERT INTO bankroll_ledger(user_id, season, amount, kind, note) VALUES ($1,$2,$3,'slot_win',$4)", [userId, L.season, win, free ? 'Gridiron Gold free spin' : 'Gridiron Gold win']);
    await c.query('UPDATE slot_state SET free_left=$3, free_bet=$4, free_won=$5, bonus=$6 WHERE user_id=$1 AND season=$2', [userId, L.season, freeLeft, freeBet, freeLeft > 0 || free ? freeWon : 0, bonus ? JSON.stringify(bonus) : null]);
    await c.query('INSERT INTO slot_spins(user_id, season, kind, bet, win, grid, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userId, L.season, free ? 'free' : 'spin', bet, win, JSON.stringify(grid), JSON.stringify({ wins: e.wins, tickets: e.tickets, bonus: e.bonus })]);
    bal = await balance(c, userId, L.season);
    return {
      grid, stops, bet, free, mult, win,
      wins: e.wins.map((w) => ({ ...w, pay: money(w.pay * bet * mult), cells: LINES[w.line].slice(0, w.n).map((row, reel) => [reel, row]) })),
      scatter: money(e.scatter * bet * mult), tickets: e.tickets,
      free_awarded: e.freeSpins, free_left: freeLeft, free_won: money(freeWon), free_done: free && freeLeft === 0,
      bonus: bonus ? publicBonus(bonus) : null, balance: bal
    };
  });
}

export async function bonusSeen(userId) {
  const L = await sl.league();
  await pool.query('UPDATE slot_state SET bonus=NULL WHERE user_id=$1 AND season=$2', [userId, L.season]);
  return { ok: true };
}
