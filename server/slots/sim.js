// Simulates the slot to check payback. Run: node server/slots/sim.js [spins]
import { spinGrid, evaluate, newBoard, FREE_MULT } from './engine.js';
const N = Number(process.argv[2]) || 2_000_000;
let r = 1; const rnd = (n) => { r = (r * 1103515245 + 12345) % 2147483648; return Math.floor((r / 2147483648) * n); };
let bet = 0, win = 0, base = 0, fsWin = 0, bonusWin = 0, fsTrig = 0, bTrig = 0, hits = 0;
const bonusPay = () => { const b = newBoard(rnd); const picks = [0, 1, 2].map(() => b.values.splice(rnd(b.values.length), 1)[0]); return picks.reduce((a, x) => a + x, 0) * b.combine; };
for (let i = 0; i < N; i++) {
  bet += 1; const e = evaluate(spinGrid(rnd)); base += e.total; if (e.total > 0) hits++;
  if (e.bonus) { bTrig++; bonusWin += bonusPay(); }
  if (e.freeSpins) { fsTrig++; let left = e.freeSpins; while (left-- > 0) { const f = evaluate(spinGrid(rnd)); fsWin += f.total * FREE_MULT; if (f.freeSpins) left += f.freeSpins; if (f.bonus) bonusWin += bonusPay(); } }
}
win = base + fsWin + bonusWin;
console.log(`spins ${N}  RTP ${(win / bet * 100).toFixed(2)}%  base ${(base / bet * 100).toFixed(1)}%  free ${(fsWin / bet * 100).toFixed(1)}% (1 in ${Math.round(N / fsTrig)})  bonus ${(bonusWin / bet * 100).toFixed(1)}% (1 in ${Math.round(N / bTrig)})  hit rate ${(hits / N * 100).toFixed(1)}%`);
