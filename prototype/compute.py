import json, collections, math, statistics as st
exec(open('/home/claude/data/build.py').read().split("weeks={")[0])
rows=json.load(open('/home/claude/data/rows.json'))['rows']
D='/home/claude/data/m'
names={'7564':"Ja'Marr Chase",'2309':'Amari Cooper','4984':'Josh Allen','6813':'Jonathan Taylor','4983':'DJ Moore','4866':'Saquon Barkley',
 '4034':'Christian McCaffrey','7049':'Jauan Jennings','9493':'Puka Nacua','1479':'Keenan Allen','7553':'Kyle Pitts','3198':'Derrick Henry',
 '3321':'Tyreek Hill','2749':'Raheem Mostert','9221':'Jahmyr Gibbs','12526':'Tetairoa McMillan'}
pos={'7564':'WR','2309':'WR','4984':'QB','6813':'RB','4983':'WR','4866':'RB','4034':'RB','7049':'WR','9493':'WR','1479':'WR','7553':'TE','3198':'RB','3321':'WR','2749':'RB','9221':'RB','12526':'WR'}
team_names={
 '2023':{'367052813991436288':'Injured reserve','490041312167325696':'Sticky Finger Pickens','639356158423019520':'nstynate85','862901935416655872':'The Water Boyz','868569620376891392':'PUKAchew 🏆','871806408952348672':'Phil McCraken','986472317486215168':'Bang Bang 9er Gang','988208007978782720':'The tricky dicks','988314780391849984':'JUICYSMOOOYAY','988923929580388352':'Astonishing Team','990823521775325184':'Ben BornAgain','996588984589606912':'blairmoline34'},
 '2024':{'367052813991436288':'IgotMooreDaktoGibbs her','490041312167325696':'T.J. TWatt','862901935416655872':'The Water Boyz','868569620376891392':'Orchards Skeethawk Tuas','871806408952348672':'Phil McCraken','986472317486215168':'Kittle Engine that could','987883933205323776':'Big Chubb Energy','988314780391849984':'JUICYSMOOOYAY','988923929580388352':'Astonishing Team','990823521775325184':'Ben BornAgain','996588984589606912':'blairmoline34','1127453975508324352':'Aaron it out'},
 '2025':{'367052813991436288':'Un-Kirk-umcised Penix','490041312167325696':'Tua Girls One Kupp','862901935416655872':'The Water Boyz','868569620376891392':'J.Will.i.Ams x2','871806408952348672':'Phil McCraken','986472317486215168':'San Fran 49IRs','987883933205323776':'Big Chubb Energy','988314780391849984':'JUICYSMOOOYAY','988923929580388352':'Astonishing Team','990823521775325184':'Ben BornAgain','996588984589606912':'blairmoline34','1127453975508324352':'Aaron it out'},
 '2026':{'367052813991436288':'To infinity and Bijan','490041312167325696':'NabersThinkImSellinDope','862901935416655872':'The Water Boyz','868569620376891392':'Killa Cam 💩-a-👻','871806408952348672':'Phil McCraken','986472317486215168':'Wine her, Dine her, 49er','987883933205323776':'Love Etienne Boutte','988314780391849984':'JUICYSMOOOYAY','988923929580388352':'Astonishing Team','990823521775325184':'Ben BornAgain','996588984589606912':'Anti-competitive behavior','1127453975508324352':'Aaron it out'}}
# Manager list
mgrs={}
for uid,dn in users.items():
  cur=team_names['2026'].get(uid)
  mgrs[uid]=dict(id=uid,name=dn,team=cur or team_names['2023'].get(uid,dn),active=cur is not None)
def U(s,r): return owners[s][r]
# brackets
def br(s,k):
  try: return [l.strip().split('|') for l in open(f'{D}/{s}_{k}')]
  except: return []
places={}
gametype={}  # (s,week,frozenset(rosters)) -> 'final','semi','qf','3rd','5th','toilet','toilet-final'
for s in ['2023','2024','2025']:
  wb=br(s,'wb'); lb=br(s,'lb')
  P={}
  for r,m,t1,t2,w,l,p in wb:
    wk=14+int(r); key=(s,wk,frozenset([int(t1),int(t2)]))
    if p=='1': P['champ']=U(s,int(w)); P['runner']=U(s,int(l)); gametype[key]='Championship'
    elif p=='3': P['third']=U(s,int(w)); gametype[key]='3rd place game'
    elif p=='5': gametype[key]='5th place game'
    else: gametype[key]='Playoffs · Round %s'%r
  for r,m,t1,t2,w,l,p in lb:
    wk=14+int(r); key=(s,wk,frozenset([int(t1),int(t2)]))
    if p=='1': P['sacko']=U(s,int(w)); gametype[key]='Toilet Bowl final'
    else: gametype[key]='Toilet Bowl'
  places[s]=P
# games
by=collections.defaultdict(list)
for x in rows:
  if x['mid'] is not None: by[(x['season'],x['week'],x['mid'])].append(x)
games=[]
for (s,w,m),v in sorted(by.items(),key=lambda k:(k[0][0],k[0][1],k[0][2])):
  a,b=v
  if s=='2026' and w>4: continue
  kind='Regular season' if w<=14 else gametype.get((s,w,frozenset([a['roster'],b['roster']])),'Consolation')
  games.append(dict(s=s,w=w,a=U(s,a['roster']),ap=a['pts'],b=U(s,b['roster']),bp=b['pts'],k=kind))
# standings per season
def standings(s,maxw):
  T={}
  for r in range(1,13):
    T[r]=dict(uid=U(s,r),w=0,l=0,t=0,mw=0,ml=0,pf=0.0,pa=0.0,scores=[],apw=0,apl=0)
  wk=collections.defaultdict(dict)
  for x in rows:
    if x['season']==s and x['week']<=maxw: wk[x['week']][x['roster']]=x['pts']
  for g in games:
    if g['s']!=s or g['w']>maxw: continue
  for (ss,w,m),v in by.items():
    if ss!=s or w>maxw: continue
    a,b=v
    A,B=T[a['roster']],T[b['roster']]
    A['pf']+=a['pts'];B['pf']+=b['pts'];A['pa']+=b['pts'];B['pa']+=a['pts']
    if a['pts']>b['pts']: A['w']+=1;B['l']+=1
    elif b['pts']>a['pts']: B['w']+=1;A['l']+=1
    else: A['t']+=1;B['t']+=1
  for w,sc in wk.items():
    vals=sorted(sc.values())
    med=(vals[5]+vals[6])/2
    for r,p in sc.items():
      T[r]['scores'].append(p)
      T[r]['apw']+=sum(1 for q in sc.values() if p>q); T[r]['apl']+=sum(1 for q in sc.values() if p<q)
      if s=='2026':
        if p>med: T[r]['mw']+=1
        else: T[r]['ml']+=1
  out=[]
  for r,t in T.items():
    n=len(t['scores'])
    exp=t['apw']/(t['apw']+t['apl'])*n if n else 0
    out.append(dict(uid=t['uid'],team=team_names[s].get(t['uid'],users[t['uid']]),w=t['w']+t['mw'],l=t['l']+t['ml'],h2h=f"{t['w']}-{t['l']}",
      pf=round(t['pf'],2),pa=round(t['pa'],2),ap=f"{t['apw']}-{t['apl']}",appct=round(t['apw']/max(1,t['apw']+t['apl']),3),
      luck=round(t['w']-exp,1),last3=round(sum(t['scores'][-3:])/max(1,len(t['scores'][-3:])),2),avg=round(t['pf']/max(1,n),2),
      hi=max(t['scores']),lo=min(t['scores']),scores=[round(x,2) for x in t['scores']]))
  out.sort(key=lambda x:(-x['w'],-x['pf']))
  for i,x in enumerate(out): x['seed']=i+1
  return out
seasons={}
for s,mw in [('2023',14),('2024',14),('2025',14),('2026',4)]:
  st_=standings(s,mw)
  info=dict(season=s,standings=st_,median=(s=='2026'))
  if s in places: info.update({k:v for k,v in places[s].items()})
  info['top_scorer']=max(st_,key=lambda x:x['pf'])['uid']
  info['reg_champ']=st_[0]['uid']
  info['team_names']=team_names[s]
  seasons[s]=info
# power rankings 2026
cur=seasons['2026']['standings']
def pct(vals,v): return sum(1 for x in vals if x<v)/ (len(vals)-1)
pfg=[x['avg'] for x in cur]; app=[x['appct'] for x in cur]; l3=[x['last3'] for x in cur]; wp=[x['w']/(x['w']+x['l']) for x in cur]
for x in cur:
  x['power']=round(100*(0.35*pct(pfg,x['avg'])+0.25*pct(app,x['appct'])+0.20*pct(l3,x['last3'])+0.20*pct(wp,x['w']/(x['w']+x['l']))),1)
# power after week 3 for movement
st3=standings('2026',3)
pfg3=[x['avg'] for x in st3]; app3=[x['appct'] for x in st3]; l33=[x['last3'] for x in st3]; wp3=[x['w']/(x['w']+x['l']) for x in st3]
p3={x['uid']:0.35*pct(pfg3,x['avg'])+0.25*pct(app3,x['appct'])+0.20*pct(l33,x['last3'])+0.20*pct(wp3,x['w']/(x['w']+x['l'])) for x in st3}
rank3={u:i+1 for i,(u,_) in enumerate(sorted(p3.items(),key=lambda k:-k[1]))}
pr=sorted(cur,key=lambda x:(-x['power'],-x['pf']))
for i,x in enumerate(pr): x['prank']=i+1; x['pmove']=rank3[x['uid']]-(i+1)
# records
tw=[dict(s=x['season'],w=x['week'],uid=U(x['season'],x['roster']),p=x['pts'],pid=x['top_pid'],pp=x['top_pts']) for x in rows if not (x['season']=='2026' and x['week']>4)]
scored=[t for t in tw if t['p']>0]
def gm(g):
  win,lose=(('a','b') if g['ap']>=g['bp'] else ('b','a'))
  return dict(s=g['s'],w=g['w'],k=g['k'],win=g[win],wp=g[win+'p'],lose=g[lose],lp=g[lose+'p'],m=round(abs(g['ap']-g['bp']),2))
G=[gm(g) for g in games]
rec={}
rec['high']=[dict(uid=t['uid'],v=t['p'],s=t['s'],w=t['w']) for t in sorted(scored,key=lambda t:-t['p'])[:10]]
rec['low']=[dict(uid=t['uid'],v=t['p'],s=t['s'],w=t['w']) for t in sorted(scored,key=lambda t:t['p'])[:10]]
rec['blowout']=sorted(G,key=lambda g:-g['m'])[:10]
rec['close']=sorted(G,key=lambda g:g['m'])[:10]
rec['hiloss']=sorted(G,key=lambda g:-g['lp'])[:10]
rec['lowin']=sorted(G,key=lambda g:g['wp'])[:10]
rec['player']=[dict(uid=t['uid'],v=t['pp'],s=t['s'],w=t['w'],pid=t['pid'],name=names.get(t['pid'],'Player '+t['pid']),pos=pos.get(t['pid'],'')) for t in sorted([t for t in tw if not t['pid'].isalpha()],key=lambda t:-t['pp'])[:10]]
sea=[]
for s in ['2023','2024','2025']:
  for x in seasons[s]['standings']: sea.append(dict(uid=x['uid'],v=x['pf'],s=s,rec=f"{x['w']}-{x['l']}"))
rec['seasonhi']=sorted(sea,key=lambda x:-x['v'])[:10]
rec['seasonlo']=sorted(sea,key=lambda x:x['v'])[:10]
# streaks (H2H regular season)
seq=collections.defaultdict(list)
for g in games:
  if g['k']!='Regular season': continue
  for me,mp,op in ((g['a'],g['ap'],g['bp']),(g['b'],g['bp'],g['ap'])):
    seq[me].append((g['s'],g['w'],'W' if mp>op else 'L'))
streaks=[]
for u,L in seq.items():
  L.sort()
  i=0
  while i<len(L):
    j=i
    while j+1<len(L) and L[j+1][2]==L[i][2]: j+=1
    streaks.append(dict(uid=u,t=L[i][2],n=j-i+1,start=f"{L[i][0]} Wk {L[i][1]}",end=f"{L[j][0]} Wk {L[j][1]}",live=(j==len(L)-1)))
    i=j+1
rec['wstreak']=sorted([x for x in streaks if x['t']=='W'],key=lambda x:-x['n'])[:10]
rec['lstreak']=sorted([x for x in streaks if x['t']=='L'],key=lambda x:-x['n'])[:10]
# all-time per manager
AT={}
for u in users: AT[u]=dict(uid=u,w=0,l=0,pf=0,pa=0,g=0,titles=[],runner=[],sacko=[],third=[],playoffs=[],seasons=[],best=None,worst=None,pw=0,pl=0,tb=0,rb=0)
for g in games:
  for me,mp,op,ou in ((g['a'],g['ap'],g['bp'],g['b']),(g['b'],g['bp'],g['ap'],g['a'])):
    a=AT[me]
    if g['k']=='Regular season':
      a['g']+=1;a['pf']+=mp;a['pa']+=op
      if mp>op:a['w']+=1
      elif mp<op:a['l']+=1
    elif g['k'].startswith('Playoffs') or g['k'] in ('Championship',):
      if mp>op:a['pw']+=1
      else:a['pl']+=1
for t in scored:
  a=AT[t['uid']]
  if not a['best'] or t['p']>a['best']['v']: a['best']=dict(v=t['p'],s=t['s'],w=t['w'])
  if not a['worst'] or t['p']<a['worst']['v']: a['worst']=dict(v=t['p'],s=t['s'],w=t['w'])
for s in ['2023','2024','2025','2026']:
  for x in seasons[s]['standings']:
    AT[x['uid']]['seasons'].append(dict(s=s,rec=f"{x['w']}-{x['l']}",pf=x['pf'],seed=x['seed'],team=x['team']))
  if s in places:
    P=places[s]; AT[P['champ']]['titles'].append(s);AT[P['runner']]['runner'].append(s);AT[P['sacko']]['sacko'].append(s);AT[P['third']]['third'].append(s)
    for r,m,t1,t2,w,l,p in br(s,'wb'):
      if r=='1' or r=='2':
        for t in (t1,t2): 
          u=U(s,int(t))
          if s not in AT[u]['playoffs']: AT[u]['playoffs'].append(s)
# weekly top/rotten banana counts (all weeks incl playoffs where scored, excl byes)
wkgrp=collections.defaultdict(list)
for t in scored: wkgrp[(t['s'],t['w'])].append(t)
for k,v in wkgrp.items():
  if len(v)<12: continue
  AT[max(v,key=lambda t:t['p'])['uid']]['tb']+=1
  AT[min(v,key=lambda t:t['p'])['uid']]['rb']+=1
alltime=[]
for u,a in AT.items():
  a['pf']=round(a['pf'],2);a['pa']=round(a['pa'],2)
  a['pct']=round(a['w']/max(1,a['w']+a['l']),3); a['avg']=round(a['pf']/max(1,a['g']),2)
  alltime.append(a)
alltime.sort(key=lambda a:(-len(a['titles']),-a['pct']))
# H2H
H=collections.defaultdict(lambda:[0,0,0.0,0.0,[]])
for g in games:
  for me,mp,op,ou in ((g['a'],g['ap'],g['bp'],g['b']),(g['b'],g['bp'],g['ap'],g['a'])):
    h=H[(me,ou)]
    if mp>op:h[0]+=1
    else:h[1]+=1
    h[2]+=mp;h[3]+=op;h[4].append(dict(s=g['s'],w=g['w'],m=mp,o=op,k=g['k']))
h2h={f"{a}|{b}":dict(w=v[0],l=v[1],pf=round(v[2],2),pa=round(v[3],2),games=v[4]) for (a,b),v in H.items()}
# Week 4 2026 recap + week 5 matchups
w4=[t for t in scored if t['s']=='2026' and t['w']==4]
recap=dict(week=4,top=max(w4,key=lambda t:t['p']),rot=min(w4,key=lambda t:t['p']),
  pow=max(w4,key=lambda t:t['pp']))
recap['pow']['name']=names.get(recap['pow']['pid'],'')
recap['games']=[g for g in G if g['s']=='2026' and g['w']==4]
# Book lines for week 5
def sd_of(u):
  sc=[t['p'] for t in scored if t['uid']==u and t['s'] in ('2025','2026') and t['w']<=14]
  s=st.pstdev(sc) if len(sc)>3 else 24
  n=len(sc); return math.sqrt((n*s*s+6*24*24)/(n+6))
def proj(u):
  x=next(z for z in cur if z['uid']==u)
  last25=[t['p'] for t in scored if t['uid']==u and t['s']=='2025' and t['w']<=14]
  a25=sum(last25)/len(last25)
  raw=0.45*x['last3']+0.35*x['avg']+0.20*a25
  lg=sum(z['avg'] for z in cur)/len(cur)
  return 0.85*raw+0.15*lg
def phi(z): return 0.5*(1+math.erf(z/math.sqrt(2)))
def amer(q):
  o=-100*q/(1-q) if q>=0.5 else 100*(1-q)/q
  o=round(o/5)*5; return max(-1000,min(700,o))
w5=[]
for line in open(f'{D}/2026_5'):
  r_,m_,p_,_,_=line.strip().split('|'); w5.append(dict(roster=int(r_),mid=int(m_),pts=float(p_)))
pairs=collections.defaultdict(list)
for x in w5: pairs[x['mid']].append(x)
lines=[]
for m,(a,b) in sorted(pairs.items()):
  ua,ub=U('2026',a['roster']),U('2026',b['roster'])
  pa_,pb_=proj(ua),proj(ub); sa,sb=sd_of(ua),sd_of(ub)
  diff=pa_-pb_; sd=math.hypot(sa,sb); p=phi(diff/sd)
  hold=0.045
  lines.append(dict(id=f"w5m{m}",a=ua,b=ub,pa=round(pa_,1),pb=round(pb_,1),spread=round(diff*2)/2,total=round((pa_+pb_)*2)/2,
    ml_a=amer(min(.995,p*(1+hold))),ml_b=amer(min(.995,(1-p)*(1+hold))),wp=round(p,3),live_a=a['pts'],live_b=b['pts']))
out=dict(league=dict(name="Rollin' with Mahomies",season='2026',week=5,teams=12,scoring='PPR',playoff_start=15,playoff_teams=6,median=True,first='2023'),
  managers=mgrs,seasons=seasons,records=rec,alltime=alltime,h2h=h2h,recap=recap,lines=lines,games=G,
  power=[dict(uid=x['uid'],power=x['power'],rank=x['prank'],move=x['pmove'],rec=f"{x['w']}-{x['l']}",avg=x['avg'],ap=x['ap'],luck=x['luck'],last3=x['last3'],scores=x['scores']) for x in pr],
  tw={f"{t['s']}|{t['w']}|{t['uid']}":[t['p'],t['pid'],t['pp']] for t in tw},names=names,
  me='862901935416655872',updated='2026-10-08T22:50:00-07:00')
json.dump(out,open('/home/claude/data/app.json','w'),ensure_ascii=False,separators=(',',':'))
import os;print(os.path.getsize('/home/claude/data/app.json'))
print({s:{k:users[v] for k,v in places[s].items()} for s in places})
print([ (users[l['a']],l['spread'],l['ml_a'],users[l['b']],l['ml_b'],l['total']) for l in lines])
print([(users[x['uid']],x['rank'],x['move'],x['rec']) for x in out['power']])
print('high',rec['high'][0],'low',rec['low'][0])
print([(users[a['uid']],a['w'],a['l'],a['titles'],a['sacko'],a['tb'],a['rb']) for a in alltime])
