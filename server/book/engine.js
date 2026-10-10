// Sportsbook math: projections, lines, odds, payouts and grading.
// Pure functions only (no database, no network) so they are easy to test.

export const HOLD = 0.045; // 4.5% book margin on moneylines
export const SPREAD_CAP = 20; // biggest spread the Book will hang
export const DEFAULT_SD = 24; // weekly swing used when a team has little history

const sum = (a) => a.reduce((x, y) => x + y, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : 0);
const pstdev = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const r1 = (n) => Math.round(n * 10) / 10;
const half = (n) => Math.round(n * 2) / 2;
export const money = (n) => Math.round(n * 100) / 100;

function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

// Implied probability (with hold already added) -> American odds, rounded to 5, capped.
export function american(q) {
  let o = q >= 0.5 ? -100 * q / (1 - q) : 100 * (1 - q) / q;
  o = Math.round(o / 5) * 5;
  if (o > -100 && o < 100) o = o < 0 ? -100 : 100; // -100 and +100 mean the same thing; never show -95/+95
  return Math.max(-1000, Math.min(700, o));
}
export const decimal = (odds) => (odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds));
export function toAmerican(dec) {
  if (dec >= 2) return Math.round((dec - 1) * 100);
  return -Math.round(100 / (dec - 1));
}

/**
 * Projection for one team going into `week`.
 *   cur  = this season's regular-season scores before `week` (oldest first)
 *   prev = last season's regular-season scores
 *   lgAvg = league average this season (mean of each team's average)
 * Same formula the app's Book tab has used since v1.5:
 *   0.45 × last 3 + 0.35 × season avg + 0.20 × last season avg,
 *   pulled toward the league average (35% through Week 6, 15% after).
 */
export function project(cur, prev, lgAvg, week) {
  const avg = mean(cur);
  const raw = cur.length
    ? 0.45 * mean(cur.slice(-3)) + 0.35 * avg + 0.2 * (prev.length ? mean(prev) : avg)
    : (prev.length ? mean(prev) : lgAvg || 120);
  const k = week <= 6 ? 0.35 : 0.15;
  return (1 - k) * raw + k * (lgAvg || raw);
}

// Weekly swing (standard deviation), shrunk toward 24 points.
export function swing(cur, prev) {
  const sc = [...prev, ...cur];
  const n = sc.length;
  const s = n > 3 ? pstdev(sc) : DEFAULT_SD;
  return Math.sqrt((n * s * s + 6 * DEFAULT_SD * DEFAULT_SD) / (n + 6));
}

/**
 * Price one matchup. Returns the numbers frozen into the `lines` table.
 * spread = how many points team A is expected to win by (negative = A is the dog).
 * The app shows team A as "A -spread".
 */
export function priceMatchup(pa, pb, sda, sdb, hold = HOLD) {
  let diff = pa - pb;
  if (Math.abs(diff) > SPREAD_CAP) diff = Math.sign(diff) * SPREAD_CAP;
  const p = phi(diff / Math.hypot(sda, sdb));
  const mid = (pa + pb) / 2;
  return {
    proj_a: r1(mid + diff / 2), proj_b: r1(mid - diff / 2),
    spread: half(diff), total: half(pa + pb),
    ml_a: american(Math.min(0.995, p * (1 + hold))), ml_b: american(Math.min(0.995, (1 - p) * (1 + hold))),
    wp_a: Math.round(p * 1000) / 1000, sd_a: Math.round(sda * 100) / 100, sd_b: Math.round(sdb * 100) / 100
  };
}

/**
 * Live odds once a matchup's games have started (Jayson, 2026-10-09: nothing locks;
 * the price moves with the score, like in-game betting).
 *   st = { pts_a, pts_b, rem_a, rem_b }  points so far + share of each lineup's games still to play (0–1)
 * Expected final = points so far + projection × share left. Swing shrinks with √(share left).
 * Spread/total keep -110 and move freely (no 20-point cap live).
 * A moneyline side comes off the board when it would be shorter than -1000.
 * Returns null when every starter's game is over (result is known).
 */
export function livePrice(line, st, hold = HOLD) {
  const ra = Math.max(0, Math.min(1, st.rem_a)), rb = Math.max(0, Math.min(1, st.rem_b));
  // Expected finals: Sleeper's live projected totals when we have them, else our own projection × share left.
  const ea = st.exp_a != null ? st.exp_a : st.pts_a + Number(line.proj_a) * ra;
  const eb = st.exp_b != null ? st.exp_b : st.pts_b + Number(line.proj_b) * rb;
  const sd = Math.hypot(Number(line.sd_a || DEFAULT_SD) * Math.sqrt(ra), Number(line.sd_b || DEFAULT_SD) * Math.sqrt(rb));
  if (ra + rb < 0.005 || sd < 0.5) return null;
  const p = phi((ea - eb) / sd);
  const ml = (q) => { q = Math.min(0.995, q); return q >= 0.5 && -100 * q / (1 - q) < -1000 ? null : american(q); };
  return {
    exp_a: r1(ea), exp_b: r1(eb), spread: half(ea - eb), total: half(ea + eb),
    ml_a: ml(p * (1 + hold)), ml_b: ml((1 - p) * (1 + hold)), wp_a: Math.round(p * 1000) / 1000,
    rem_a: Math.round(ra * 1000) / 1000, rem_b: Math.round(rb * 1000) / 1000, source: st.exp_a != null && st.exp_b != null ? 'sleeper' : 'history'
  };
}

// Is the new price worse for the bettor than the one they saw? (protects against odds that moved)
export function worseThan(market, pick, seen, now_) {
  if (seen.odds != null && decimal(now_.odds) < decimal(Number(seen.odds)) - 1e-9) return true;
  if (seen.point != null && now_.point != null) {
    const a = Number(seen.point), b = Number(now_.point);
    if (market === 'spread' && b < a) return true;
    if (market === 'total' && (pick === 'over' ? b > a : b < a)) return true;
  }
  return false;
}

/**
 * Lines for every matchup in a week.
 *   pairs  = [{ matchup_id, roster_a, roster_b, a, b }]  (a/b = user ids)
 *   cur    = { uid: [scores before this week] }
 *   prev   = { uid: [last season regular-season scores] }
 */
export function priceWeek(week, pairs, cur, prev, sleeperProj = {}) {
  const avgs = Object.values(cur).filter((s) => s.length).map(mean);
  const lgAvg = mean(avgs);
  return pairs.map((m) => {
    const ca = cur[m.a] || [], cb = cur[m.b] || [], pa_ = prev[m.a] || [], pb_ = prev[m.b] || [];
    // Blend in Sleeper's projection for the lineup as it's set now (60%) when we have one for both teams.
    let ja = project(ca, pa_, lgAvg, week), jb = project(cb, pb_, lgAvg, week);
    const sa = sleeperProj[m.a], sb = sleeperProj[m.b];
    if (sa > 0 && sb > 0) { ja = 0.6 * sa + 0.4 * ja; jb = 0.6 * sb + 0.4 * jb; }
    return { ...m, ...priceMatchup(ja, jb, swing(ca, pa_), swing(cb, pb_)), blended: sa > 0 && sb > 0 };
  });
}

// ---------- bet legs ----------
// A leg is { market: 'spread'|'ml'|'total', pick: 'a'|'b'|'over'|'under', point, odds }.

// The numbers a pick is locked in at, taken from the frozen line.
export function legTerms(line, market, pick) {
  if (market === 'ml') {
    if (pick !== 'a' && pick !== 'b') return null;
    const o = pick === 'a' ? line.ml_a : line.ml_b;
    return o == null ? { off: true } : { point: null, odds: Number(o) };
  }
  if (market === 'spread') {
    if (pick !== 'a' && pick !== 'b') return null;
    const s = Number(line.spread);
    return { point: pick === 'a' ? -s : s, odds: Number(line.spread_price) || -110 };
  }
  if (market === 'total') {
    if (pick !== 'over' && pick !== 'under') return null;
    return { point: Number(line.total), odds: Number(line.total_price) || -110 };
  }
  return null;
}

// Grade one leg from the final scores. Returns 'won' | 'lost' | 'push'.
export function gradeLeg(leg, finalA, finalB) {
  const a = Number(finalA), b = Number(finalB);
  const cmp = (x) => (Math.abs(x) < 1e-9 ? 'push' : x > 0 ? 'won' : 'lost');
  if (leg.market === 'ml') return cmp(leg.pick === 'a' ? a - b : b - a);
  if (leg.market === 'spread') return cmp((leg.pick === 'a' ? a - b : b - a) + Number(leg.point));
  if (leg.market === 'total') return cmp(leg.pick === 'over' ? a + b - Number(leg.point) : Number(leg.point) - (a + b));
  throw new Error(`Unknown market ${leg.market}`);
}

/**
 * Grade a whole bet once every leg is graded.
 * Leg results: won | lost | push | void.  Returns { status, payout }
 * payout = Bucks returned to the bettor (stake included); 0 on a loss.
 * Parlays: any loss loses; pushed/voided legs drop out; if every leg
 * drops out the bet is a push.
 */
export function gradeBet(stake, legs, maxPayout = Infinity) {
  if (legs.some((l) => l.result === 'lost')) return { status: 'lost', payout: 0 };
  const live = legs.filter((l) => l.result === 'won');
  if (!live.length) return { status: legs.every((l) => l.result === 'void') ? 'void' : 'push', payout: money(stake) };
  const dec = live.reduce((x, l) => x * decimal(l.odds), 1);
  return { status: 'won', payout: money(Math.min(stake * dec, maxPayout)) };
}

export function betOdds(legs) {
  const dec = legs.reduce((x, l) => x * decimal(l.odds), 1);
  return { dec: Math.round(dec * 10000) / 10000, american: legs.length === 1 ? legs[0].odds : toAmerican(dec) };
}
