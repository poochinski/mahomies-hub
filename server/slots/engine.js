// "Gridiron Gold" — the hidden fantasy-football slot (Easter egg on the Sportsbook page).
// 5 reels × 3 rows, 20 fixed paylines. Every outcome is decided here on the server.
// Payback is set to the Las Vegas Strip average: 92.48% theoretical incl. 1.5% progressive growth (exact, server/slots/par.js).
// Like a Nevada machine, every spin is an independent random stop on fixed reel strips
// (crypto RNG, no memory of past spins, no 'due' wins), and the screen shows the real strip.
import crypto from 'node:crypto';

export const SYMBOLS = {
  RING: { label: 'Title Ring', icon: '💍' }, TROPHY: { label: 'Trophy', icon: '🏆' }, STADIUM: { label: 'Helmet', icon: '🏈' },
  PLAYBOOK: { label: 'Football', icon: '🏈' }, BALL: { label: 'Ace', icon: 'A' }, CAP: { label: 'King', icon: 'K' },
  WILD: { label: 'MH Wild', icon: 'MH' }, TICKET: { label: 'Free Spins', icon: '🎟️' }, DRAFT: { label: 'Two-Minute Drill', icon: '⏱️' }
};

// Pays per LINE bet for 3 / 4 / 5 in a row from the left.
export const PAYS = {
  WILD: [60, 300, 1500], RING: [25, 100, 400], TROPHY: [15, 60, 200], STADIUM: [10, 30, 100],
  PLAYBOOK: [5, 15, 60], BALL: [4, 12, 40], CAP: [3, 8, 25]
};
// Scatter pays × TOTAL bet for 3 / 4 / 5 tickets anywhere (plus 10 free spins).
export const TICKET_PAYS = [2, 10, 50];
// Free spins: how many, and what every free-spin win is multiplied by. (Object so the tuner can change it.)
export const FREE = { spins: 8, mult: 2 };

// Reel strips (symbol counts). Wilds only on reels 2–4; one stopwatch (Two-Minute Drill scatter) on every reel.
export const COUNTS = [
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 6, TICKET: 1, DRAFT: 1 },
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 6, WILD: 2, TICKET: 1, DRAFT: 1 },
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 6, WILD: 2, TICKET: 2, DRAFT: 2 },
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 6, WILD: 2, TICKET: 1, DRAFT: 1 },
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 6, TICKET: 1, DRAFT: 1 }
];
// Spread each symbol evenly around the strip so stacks look natural.
export function buildStrip(counts, seed) {
  const list = [];
  for (const [s, n] of Object.entries(counts)) for (let i = 0; i < n; i++) list.push(s);
  let x = seed; const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
export const STRIPS = COUNTS.map((c, i) => buildStrip(c, 7 + i * 13));

// 20 fixed lines (row 0 = top, 1 = middle, 2 = bottom), the usual modern 20-line set.
export const LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1],
  [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0]
];

// Two-Minute Drill bonus (hold-and-spin style, our own football take):
// a 3×3 grid where every square re-spins each drive, plus a side "TOUCHDOWN" reel.
// When the side reel lands TOUCHDOWN, everything on the grid is collected.
// Values are × TOTAL bet. Start with 6 drives; EXTRA DRIVE squares add one (max 20).
export const DRILL = {
  drives: 6, maxDrives: 20, td: 0.23,
  cell: [['blank', 54], ['val', 37], ['jp', 6], ['extra', 3]],
  values: [0.2, 0.3, 0.5, 0.5, 1, 1, 1.5, 2, 3, 5],
  jackpots: [['MINI', 5, 62], ['MINOR', 15, 28], ['MAJOR', 50, 9], ['GRAND', 250, 1]]
};
// Progressive jackpots (Jayson, 2026-10-10): MAJOR and GRAND grow by a slice of every paid spin
// (rate × bet), one pot per bet size, shared by the whole league, and reset to `seed` × bet when won.
// MINI and MINOR stay fixed. The rates are part of the payback (par.js adds them in).
export const PROG = { MAJOR: { seed: 50, rate: 0.01 }, GRAND: { seed: 250, rate: 0.005 } };
function pickW(list, r, wIdx) { const tot = list.reduce((a, x) => a + x[wIdx], 0); let x = r(tot); for (const it of list) { if (x < it[wIdx]) return it; x -= it[wIdx]; } return list[list.length - 1]; }
export function drillRun(r = rand) {
  const frames = []; let total = 0, drives = DRILL.drives;
  for (let d = 0; d < drives && d < DRILL.maxDrives; d++) {
    const cells = [];
    for (let i = 0; i < 9; i++) {
      const t = pickW(DRILL.cell, r, 1)[0];
      if (t === 'val') cells.push({ t, v: DRILL.values[r(DRILL.values.length)] });
      else if (t === 'jp') { const j = pickW(DRILL.jackpots, r, 2); cells.push({ t, jp: j[0], v: j[1] }); }
      else if (t === 'extra') { cells.push({ t }); drives = Math.min(DRILL.maxDrives, drives + 1); }
      else cells.push({ t });
    }
    const td = r(1000) < DRILL.td * 1000;
    const got = td ? cells.reduce((a, c) => a + (c.v || 0), 0) : 0;
    total += got;
    frames.push({ drive: d + 1, drives, cells, td, got: Math.round(got * 100) / 100 });
  }
  return { frames, total: Math.round(total * 100) / 100 };
}

export const rand = (n) => crypto.randomInt(n);

// One independent random stop per reel. The screen shows strip[stop], strip[stop+1], strip[stop+2].
export const spinStops = (r = rand) => STRIPS.map((strip) => r(strip.length));
export const gridAt = (stops) => STRIPS.map((strip, reel) => [0, 1, 2].map((k) => strip[(stops[reel] + k) % strip.length]));
export function spinGrid(r = rand) { return gridAt(spinStops(r)); }

// PAR sheet (re-run `node server/slots/par.js` after changing any pay, strip or drill number, and update this).
export const PAR = { rtp: 0.9248, prog: 0.015, hit: 0.5013, free_odds: 87, bonus_odds: 87, drill_avg: 24.0, screens: 31334400 };

// grid[reel][row]. Returns line wins, scatter count/pay, bonus trigger. All pays in multiples of TOTAL bet.
export function evaluate(grid) {
  const lineBetShare = 1 / LINES.length;
  const wins = [];
  LINES.forEach((ln, li) => {
    const syms = ln.map((row, reel) => grid[reel][row]);
    // best of: wild run alone, or the first non-wild symbol with wilds substituting
    let best = null;
    const run = (target) => { let n = 0; for (const s of syms) { if (s === target || (s === 'WILD' && target !== 'WILD')) n++; else break; } return n; };
    const first = syms.find((s) => s !== 'WILD');
    const cands = new Set(['WILD']); if (first && PAYS[first]) cands.add(first);
    for (const t of cands) { const n = run(t); if (n >= 3) { const pay = PAYS[t][n - 3] * lineBetShare; if (!best || pay > best.pay) best = { line: li, sym: t, n, pay }; } }
    if (best) wins.push(best);
  });
  let tickets = 0, drafts = 0;
  grid.forEach((col, reel) => col.forEach((s) => { if (s === 'TICKET') tickets++; if (s === 'DRAFT') drafts++; }));
  const scatter = tickets >= 3 ? TICKET_PAYS[Math.min(tickets, 5) - 3] : 0;
  const bonus = drafts >= 3; // 3 or more stopwatches anywhere (Jayson, 2026-10-09)
  const linePay = wins.reduce((a, w) => a + w.pay, 0);
  return { wins, linePay, tickets, scatter, freeSpins: tickets >= 3 ? FREE.spins : 0, bonus, total: linePay + scatter };
}
