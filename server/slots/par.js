// Gridiron Gold PAR sheet: the exact theoretical payback, worked out the way a casino lab does it.
// Every possible stop of the five reels is counted (about 41 million screens), so the base game,
// free-spin and bonus frequencies are exact, not simulated. The Two-Minute Drill's average is exact too
// (expected board value × touchdown chance × expected number of drives, by dynamic programming).
//   node server/slots/par.js          → prints the sheet
//   import { parSheet } from './par.js' → same numbers as an object (cached)
import { STRIPS, LINES, PAYS, TICKET_PAYS, FREE_SPINS, FREE_MULT, DRILL } from './engine.js';

let cached = null;

function drillEV() {
  const cw = Object.fromEntries(DRILL.cell.map(([t, w]) => [t, w]));
  const tot = DRILL.cell.reduce((a, x) => a + x[1], 0);
  const pVal = cw.val / tot, pJp = cw.jp / tot, pExtra = cw.extra / tot;
  const meanVal = DRILL.values.reduce((a, b) => a + b, 0) / DRILL.values.length;
  const jt = DRILL.jackpots.reduce((a, j) => a + j[2], 0);
  const meanJp = DRILL.jackpots.reduce((a, j) => a + j[1] * j[2], 0) / jt;
  const board = 9 * (pVal * meanVal + pJp * meanJp);
  // P(k extra-drive squares on one drive), k = 0..9
  const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
  const pk = Array.from({ length: 10 }, (_, k) => C(9, k) * pExtra ** k * (1 - pExtra) ** (9 - k));
  // dist[n] = probability that `n` drives are available after the drives played so far
  let dist = new Array(DRILL.maxDrives + 1).fill(0); dist[DRILL.drives] = 1;
  let expDrives = 0;
  for (let d = 0; d < DRILL.maxDrives; d++) {
    const next = new Array(DRILL.maxDrives + 1).fill(0);
    for (let n = 0; n <= DRILL.maxDrives; n++) {
      if (!dist[n]) continue;
      if (n <= d) { next[n] += dist[n]; continue; } // drill already over
      expDrives += dist[n];
      for (let k = 0; k <= 9; k++) next[Math.min(DRILL.maxDrives, n + k)] += dist[n] * pk[k];
    }
    dist = next;
  }
  const maxJp = Math.max(...DRILL.jackpots.map((j) => j[1]));
  return { board, expDrives, ev: DRILL.td * board * expDrives, perTd: board, maxBoard: 9 * maxJp };
}

export function parSheet() {
  if (cached) return cached;
  const syms = [...new Set(STRIPS.flat())];
  const id = Object.fromEntries(syms.map((s, i) => [s, i]));
  const W = id.WILD, T = id.TICKET, D = id.DRAFT;
  const pay = syms.map((s) => PAYS[s] || null);
  // window[reel][stop] = [top, mid, bottom] as ids
  const win = STRIPS.map((st) => st.map((_, i) => [0, 1, 2].map((k) => id[st[(i + k) % st.length]])));
  const lens = STRIPS.map((s) => s.length);
  let n = 0, lineSum = 0, scatterSum = 0, hits = 0, freeHits = 0, bonusHits = 0, maxLine = 0;
  const hist = {};
  const g = [null, null, null, null, null];
  const lineEval = () => {
    let total = 0;
    for (let li = 0; li < LINES.length; li++) {
      const ln = LINES[li];
      const s0 = g[0][ln[0]], s1 = g[1][ln[1]], s2 = g[2][ln[2]], s3 = g[3][ln[3]], s4 = g[4][ln[4]];
      const s = [s0, s1, s2, s3, s4];
      let best = 0;
      // wild run
      let wn = 0; while (wn < 5 && s[wn] === W) wn++;
      if (wn >= 3) best = PAYS.WILD[wn - 3];
      let first = -1; for (let i = 0; i < 5; i++) if (s[i] !== W) { first = s[i]; break; }
      if (first >= 0 && pay[first]) {
        let c = 0; while (c < 5 && (s[c] === first || s[c] === W)) c++;
        if (c >= 3) { const p = pay[first][c - 3]; if (p > best) best = p; }
      }
      total += best;
    }
    return total / LINES.length;
  };
  for (let a = 0; a < lens[0]; a++) { g[0] = win[0][a];
    for (let b = 0; b < lens[1]; b++) { g[1] = win[1][b];
      for (let c = 0; c < lens[2]; c++) { g[2] = win[2][c];
        const bonus = g[0].includes(D) && g[1].includes(D) && g[2].includes(D);
        for (let d = 0; d < lens[3]; d++) { g[3] = win[3][d];
          for (let e = 0; e < lens[4]; e++) { g[4] = win[4][e];
            n++;
            const lp = lineEval();
            let t = 0; for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === T) t++;
            const sc = t >= 3 ? TICKET_PAYS[Math.min(t, 5) - 3] : 0;
            lineSum += lp; scatterSum += sc;
            if (lp > maxLine) maxLine = lp;
            if (lp > 0 || sc > 0 || bonus) hits++;
            if (t >= 3) freeHits++;
            if (bonus) bonusHits++;
          }
        }
      }
    }
  }
  const line = lineSum / n, scatter = scatterSum / n, pFree = freeHits / n, pBonus = bonusHits / n;
  const dr = drillEV();
  const perSpin = line + scatter; // × bet
  const bonusEV = pBonus * dr.ev;
  // Free spins: each pays ×FREE_MULT on lines and tickets; retriggers add FREE_SPINS more.
  const expFree = FREE_SPINS / (1 - FREE_SPINS * pFree);
  const freeEV = pFree * expFree * (FREE_MULT * perSpin + bonusEV);
  const rtp = perSpin + bonusEV + freeEV;
  cached = {
    screens: n,
    rtp, base: perSpin, lines: line, scatter, free: freeEV, bonus: bonusEV,
    hitRate: hits / n, freeOdds: 1 / pFree, bonusOdds: 1 / pBonus,
    drill: { avg: dr.ev, avgDrives: dr.expDrives, boardAvg: dr.board, td: DRILL.td },
    maxLineSpin: maxLine, grand: Math.max(...DRILL.jackpots.map((j) => j[1]))
  };
  return cached;
}

const pct = (x) => (x * 100).toFixed(2) + '%';
if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now(); const p = parSheet();
  console.log(`Gridiron Gold PAR sheet (${p.screens.toLocaleString()} screens, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(`  Theoretical payback  ${pct(p.rtp)}   (house edge ${pct(1 - p.rtp)})`);
  console.log(`    base lines ${pct(p.lines)} · tickets ${pct(p.scatter)} · free spins ${pct(p.free)} · Two-Minute Drill ${pct(p.bonus)}`);
  console.log(`  Hit frequency        1 in ${(1 / p.hitRate).toFixed(2)} (${pct(p.hitRate)})`);
  console.log(`  Free spins           1 in ${p.freeOdds.toFixed(0)}`);
  console.log(`  Two-Minute Drill     1 in ${p.bonusOdds.toFixed(0)} · averages ${p.drill.avg.toFixed(1)}× bet over ${p.drill.avgDrives.toFixed(2)} drives (TD chance ${p.drill.td})`);
  console.log(`  Biggest line screen  ${p.maxLineSpin.toFixed(1)}× bet · GRAND ${p.grand}× bet`);
}
