// "Gridiron Gold" — the hidden fantasy-football slot (Easter egg on the Sportsbook page).
// 5 reels × 3 rows, 9 fixed paylines. Every outcome is decided here on the server.
// Tuned by simulation (server/slots/sim.js) to pay back about 95% over time.
import crypto from 'node:crypto';

export const SYMBOLS = {
  RING: { label: 'Ring', icon: '💍' }, TROPHY: { label: 'Trophy', icon: '🏆' }, STADIUM: { label: 'Stadium', icon: '🏟️' },
  PLAYBOOK: { label: 'Playbook', icon: '📋' }, BALL: { label: 'Football', icon: '🏈' }, CAP: { label: 'Cap', icon: '🧢' },
  WILD: { label: 'MH Wild', icon: 'MH' }, TICKET: { label: 'Free Spins', icon: '🎟️' }, DRAFT: { label: 'Draft Card', icon: '📜' }
};

// Pays per LINE bet for 3 / 4 / 5 in a row from the left.
export const PAYS = {
  WILD: [60, 300, 1500], RING: [35, 140, 500], TROPHY: [20, 80, 250], STADIUM: [14, 40, 125],
  PLAYBOOK: [7, 20, 75], BALL: [6, 14, 50], CAP: [4, 11, 35]
};
// Scatter pays × TOTAL bet for 3 / 4 / 5 tickets anywhere (plus 10 free spins).
export const TICKET_PAYS = [3, 15, 75];
export const FREE_SPINS = 10, FREE_MULT = 3;

// Reel strips (symbol counts). Wilds only on reels 2–4; draft cards only on reels 1–3.
const COUNTS = [
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 8, TICKET: 1, DRAFT: 2 },
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 8, WILD: 2, TICKET: 1, DRAFT: 2 },
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 8, WILD: 2, TICKET: 1, DRAFT: 2 },
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 8, WILD: 2, TICKET: 1 },
  { RING: 2, TROPHY: 3, STADIUM: 4, PLAYBOOK: 6, BALL: 7, CAP: 8, TICKET: 1 }
];
// Spread each symbol evenly around the strip so stacks look natural.
function buildStrip(counts, seed) {
  const list = [];
  for (const [s, n] of Object.entries(counts)) for (let i = 0; i < n; i++) list.push(s);
  let x = seed; const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
export const STRIPS = COUNTS.map((c, i) => buildStrip(c, 7 + i * 13));

export const LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1]
];

// Draft Day bonus board: 12 prospects, values × TOTAL bet. Pick 3, then a Combine multiplier.
export const BOARD = [1, 2, 2, 3, 3, 4, 5, 6, 8, 10, 15, 25];
export const COMBINE = [[1, 50], [2, 35], [3, 15]]; // [multiplier, weight]

export const rand = (n) => crypto.randomInt(n);

export function spinGrid(r = rand) {
  return STRIPS.map((strip) => { const i = r(strip.length); return [0, 1, 2].map((k) => strip[(i + k) % strip.length]); });
}

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
  grid.forEach((col, reel) => col.forEach((s) => { if (s === 'TICKET') tickets++; if (s === 'DRAFT' && reel < 3) drafts++; }));
  const scatter = tickets >= 3 ? TICKET_PAYS[Math.min(tickets, 5) - 3] : 0;
  // Draft Day needs a draft card on each of reels 1, 2 and 3.
  const bonus = [0, 1, 2].every((r) => grid[r].includes('DRAFT'));
  const linePay = wins.reduce((a, w) => a + w.pay, 0);
  return { wins, linePay, tickets, scatter, freeSpins: tickets >= 3 ? FREE_SPINS : 0, bonus, total: linePay + scatter };
}

export function newBoard(r = rand) {
  const b = BOARD.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = r(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  const tot = COMBINE.reduce((a, c) => a + c[1], 0); let x = r(tot), combine = 1;
  for (const [m, w] of COMBINE) { if (x < w) { combine = m; break; } x -= w; }
  return { values: b, combine, picks: [] };
}
