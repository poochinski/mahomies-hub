// Simulates the slot to check payback. Run: node server/slots/sim.js [spins]
import { spinGrid, evaluate, drillRun, FREE, PROG } from './engine.js';
const N = Number(process.argv[2]) || 2_000_000;
let a = Number(process.argv[3]) || 12345; const m32 = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd = (n) => Math.floor(m32() * n);
let bet = 0, win = 0, base = 0, fsWin = 0, bonusWin = 0, fsTrig = 0, bTrig = 0, hits = 0;
const bonusPay = () => drillRun(rnd).total;
for (let i = 0; i < N; i++) {
  bet += 1; const e = evaluate(spinGrid(rnd)); base += e.total; if (e.total > 0) hits++;
  if (e.bonus) { bTrig++; bonusWin += bonusPay(); }
  if (e.freeSpins) { fsTrig++; let left = e.freeSpins; while (left-- > 0) { const f = evaluate(spinGrid(rnd)); fsWin += f.total * FREE.mult; if (f.freeSpins) left += f.freeSpins; if (f.bonus) bonusWin += bonusPay(); } }
}
win = base + fsWin + bonusWin;
let bt=0,bn=0,bmax=0;for(let i=0;i<20000;i++){const x=drillRun(rnd);bt+=x.total;bn+=x.frames.length;bmax=Math.max(bmax,x.total)}console.log(`bonus avg ${(bt/20000).toFixed(1)}x bet, avg drives ${(bn/20000).toFixed(1)}, max ${bmax}x`);
console.log(`spins ${N}  RTP ${(win / bet * 100).toFixed(2)}%  base ${(base / bet * 100).toFixed(1)}%  free ${(fsWin / bet * 100).toFixed(1)}% (1 in ${Math.round(N / fsTrig)})  bonus ${(bonusWin / bet * 100).toFixed(1)}% (1 in ${Math.round(N / bTrig)})  hit rate ${(hits / N * 100).toFixed(1)}%`);
