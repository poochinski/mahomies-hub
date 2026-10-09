# v1.5 data: runs compute.py, then adds brackets, filtered records, playoff odds,
# awards, capped Book lines and a Book backtest. Writes app15.json.
import json, math, random, collections, statistics as st
import numpy as np
exec(open('/home/claude/data/compute.py').read())
out = json.load(open('/home/claude/data/app.json'))
sched = {int(k): v for k, v in json.load(open('/home/claude/data/sched2026.json')).items()}

def P(s, w, u):
    v = out['tw'].get(f"{s}|{w}|{u}")
    return v[0] if v else None

# ---------- 1. brackets with scores ----------
for s in ['2023', '2024', '2025']:
    b = {}
    for kind, f in (('winners', 'wb'), ('losers', 'lb')):
        L = []
        for r, m, t1, t2, w, l, p in br(s, f):
            wk = 14 + int(r); a, c = U(s, int(t1)), U(s, int(t2))
            L.append(dict(r=int(r), w=wk, a=a, b=c, pa=P(s, wk, a), pb=P(s, wk, c), p=None if p == 'null' else int(p)))
        b[kind] = L
    out['seasons'][s]['bracket'] = b

# ---------- 2. records by filter ----------
def build(filt):
    ok = (lambda s, w: True) if filt == 'all' else (lambda s, w: (w <= 14) if filt == 'reg' else (w >= 15 and s != '2026'))
    sc = [t for t in scored if ok(t['s'], t['w'])]
    GG = [g for g in G if ok(g['s'], g['w'])]
    T = [t for t in tw if ok(t['s'], t['w']) and not t['pid'].isalpha()]
    r = {}
    r['high'] = [dict(uid=t['uid'], v=t['p'], s=t['s'], w=t['w']) for t in sorted(sc, key=lambda t: -t['p'])[:10]]
    r['low'] = [dict(uid=t['uid'], v=t['p'], s=t['s'], w=t['w']) for t in sorted(sc, key=lambda t: t['p'])[:10]]
    r['blowout'] = sorted(GG, key=lambda g: -g['m'])[:10]
    r['close'] = sorted(GG, key=lambda g: g['m'])[:10]
    r['hiloss'] = sorted(GG, key=lambda g: -g['lp'])[:10]
    r['lowin'] = sorted(GG, key=lambda g: g['wp'])[:10]
    r['player'] = [dict(uid=t['uid'], v=t['pp'], s=t['s'], w=t['w'], pid=t['pid'], name=names.get(t['pid']), pos=pos.get(t['pid'], '')) for t in sorted(T, key=lambda t: -t['pp'])[:10]]
    return r
out['recf'] = {'reg': build('reg'), 'post': build('post')}
# names for any player record without one: mark unknown (front end shows "Top scorer")
for f in out['recf'].values():
    for x in f['player']:
        if not x['name']: x['name'] = None
for x in out['records']['player']:
    if x['name'].startswith('Player '): x['name'] = None

# ---------- 3. projections, capped lines, playoff odds ----------
cur26 = out['seasons']['2026']['standings']
lg_avg = sum(z['avg'] for z in cur26) / len(cur26)
def proj_week(u, week):
    x = next(z for z in cur26 if z['uid'] == u)
    a25 = [t['p'] for t in scored if t['uid'] == u and t['s'] == '2025' and t['w'] <= 14]
    raw = 0.45 * x['last3'] + 0.35 * x['avg'] + 0.20 * (sum(a25) / len(a25))
    k = 0.35 if week <= 6 else 0.15
    return (1 - k) * raw + k * lg_avg
def price(pa_, pb_, sa, sb, hold=0.045, cap=20.0):
    diff = pa_ - pb_
    if abs(diff) > cap: diff = math.copysign(cap, diff)
    sd = math.hypot(sa, sb); p = phi(diff / sd)
    return diff, p, amer(min(.995, p * (1 + hold))), amer(min(.995, (1 - p) * (1 + hold)))
for l in out['lines']:
    pa_, pb_ = proj_week(l['a'], 5), proj_week(l['b'], 5)
    diff, p, ma, mb = price(pa_, pb_, sd_of(l['a']), sd_of(l['b']))
    mid = (pa_ + pb_) / 2
    l.update(pa=round(mid + diff / 2, 1), pb=round(mid - diff / 2, 1), spread=round(diff * 2) / 2,
             total=round((pa_ + pb_) * 2) / 2, ml_a=ma, ml_b=mb, wp=round(p, 3))

rng = np.random.default_rng(2026)
uids = [z['uid'] for z in cur26]
idx = {u: i for i, u in enumerate(uids)}
base_w = np.array([z['w'] for z in cur26], float)
base_pf = np.array([z['pf'] for z in cur26], float)
mu = np.array([proj_week(u, 8) for u in uids]); sdv = np.array([sd_of(u) for u in uids])
weeks = [5] + list(range(6, 15))
w5pairs = [[next(r for r in owners['2026'] if owners['2026'][r] == l['a']), next(r for r in owners['2026'] if owners['2026'][r] == l['b'])] for l in out['lines']]
N = 10000
W = np.tile(base_w, (N, 1)); PF = np.tile(base_pf, (N, 1))
for wk in weeks:
    pairs = w5pairs if wk == 5 else sched[wk]
    sc = rng.normal(mu, sdv, size=(N, 12))
    PF += sc
    med = np.median(sc, axis=1, keepdims=True)
    W += (sc > med)
    for a, b in pairs:
        ia, ib = idx[owners['2026'][a]], idx[owners['2026'][b]]
        aw = sc[:, ia] > sc[:, ib]
        W[:, ia] += aw; W[:, ib] += ~aw
key = W * 10000 + PF
order = np.argsort(-key, axis=1)
rank = np.empty_like(order); rows_ = np.arange(N)[:, None]
rank[rows_, order] = np.arange(12)[None, :]
odds = []
for u, i in idx.items():
    rk = rank[:, i]
    odds.append(dict(uid=u, playoff=round(float((rk < 6).mean()), 3), bye=round(float((rk < 2).mean()), 3),
                     top=round(float((rk == 0).mean()), 3), last=round(float((rk == 11).mean()), 3),
                     wins=round(float(W[:, i].mean()), 1), rec=f"{int(base_w[i])}-{int(8 - base_w[i])}"))
odds.sort(key=lambda x: (-x['playoff'], -x['wins']))
out['odds'] = dict(sims=N, weeks_left=len(weeks), list=odds)

# ---------- 4. awards ----------
def season_awards(s):
    stn = out['seasons'][s]['standings']; endw = 14 if s != '2026' else 4
    wk = collections.defaultdict(list)
    for t in scored:
        if t['s'] == s and t['w'] <= endw: wk[t['w']].append(t)
    hi = collections.Counter(); lo = collections.Counter()
    for v in wk.values():
        hi[max(v, key=lambda t: t['p'])['uid']] += 1; lo[min(v, key=lambda t: t['p'])['uid']] += 1
    sg = [g for g in G if g['s'] == s]
    sreg = [g for g in sg if g['w'] <= endw]
    A = []
    def add(key, title, u, val, note, g=None): A.append(dict(key=key, title=title, uid=u, val=val, note=note, game=g))
    if s in places:
        add('champ', 'Champion', places[s]['champ'], '🏆', 'Won the title')
        add('sacko', 'Sacko', places[s]['sacko'], '🚽', 'Won the Toilet Bowl, lost the season')
    t = max(stn, key=lambda x: x['pf']); add('points', 'Points King', t['uid'], f"{t['pf']:.1f}", 'Most points in the regular season')
    u, n = hi.most_common(1)[0]; add('topb', 'Top Banana', u, f"{n}×", 'Most weeks as the league high scorer')
    u, n = lo.most_common(1)[0]; add('rotb', 'Rotten Banana', u, f"{n}×", 'Most weeks as the league low scorer')
    t = max(stn, key=lambda x: x['luck']); add('lucky', 'Horseshoe', t['uid'], f"+{t['luck']:.1f}", 'Luckiest: more wins than the points deserved')
    t = min(stn, key=lambda x: x['luck']); add('unlucky', 'Snakebitten', t['uid'], f"{t['luck']:.1f}", 'Unluckiest: fewer wins than the points deserved')
    t = max(stn, key=lambda x: x['pa']); add('pa', 'Punching Bag', t['uid'], f"{t['pa']:.1f}", 'Most points scored against')
    g = max(sg, key=lambda g: g['wp']); add('high', 'Monster Week', g['win'], f"{g['wp']:.2f}", f"Week {g['w']} · {g['k']}", g)
    g = max(sg, key=lambda g: g['m']); add('blow', 'Bully', g['win'], f"+{g['m']:.1f}", f"Biggest blowout · Week {g['w']}", g)
    g = min(sreg, key=lambda g: g['m']); add('heart', 'Heartbreaker', g['lose'], f"-{g['m']:.2f}", f"Closest loss · Week {g['w']}", g)
    return A
out['awards'] = {s: season_awards(s) for s in ['2023', '2024', '2025', '2026']}

# ---------- 5. Book backtest ----------
def team_hist(u, s, upto):
    return [t['p'] for t in scored if t['uid'] == u and t['s'] == s and t['w'] < upto and t['w'] <= 14]
def bt(s, w):
    prev = str(int(s) - 1)
    res = []
    for g in G:
        if g['s'] != s or g['w'] != w: continue
        pj = {}
        for u in (g['win'], g['lose']):
            h = team_hist(u, s, w); ph = [t['p'] for t in scored if t['uid'] == u and t['s'] == prev and t['w'] <= 14]
            l3 = h[-3:]; avg = sum(h) / len(h); pavg = sum(ph) / len(ph) if ph else avg
            raw = 0.45 * sum(l3) / len(l3) + 0.35 * avg + 0.20 * pavg
            lgh = [t['p'] for t in scored if t['s'] == s and t['w'] < w and t['w'] <= 14]
            k = 0.35 if w <= 6 else 0.15
            pj[u] = (1 - k) * raw + k * (sum(lgh) / len(lgh))
        diff = pj[g['win']] - pj[g['lose']]
        if abs(diff) > 20: diff = math.copysign(20, diff)
        spread = round(diff * 2) / 2
        fav_won = diff > 0
        margin = g['wp'] - g['lp']
        res.append(dict(fav_won=fav_won, err=abs(margin - diff), pick=abs(spread) < .01))
    return res
allr = []
for s, ws in (('2025', range(3, 15)), ('2026', range(2, 5))):
    for w in ws: allr += bt(s, w)
real = [r for r in allr if not r['pick']]
out['backtest'] = dict(games=len(allr), fav_pct=round(sum(r['fav_won'] for r in real) / len(real), 3),
                       mae=round(sum(r['err'] for r in allr) / len(allr), 1), span='2025 Wk 3 – 2026 Wk 4')
out['version'] = '1.5'
out['league']['last_scored'] = 4
out['updated_label'] = 'Thu Oct 8, 11:50 PM'
json.dump(out, open('/home/claude/data/app15.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('lines', [(users[l['a']], l['spread'], l['ml_a'], users[l['b']], l['ml_b']) for l in out['lines']])
print('odds', [(users[o['uid']], o['playoff'], o['bye'], o['wins']) for o in odds])
print('backtest', out['backtest'])
print('awards 2025', [(a['title'], users[a['uid']], a['val']) for a in out['awards']['2025']])
import os; print('size', os.path.getsize('/home/claude/data/app15.json'))
