import re,json
s=open('app17.template.html').read()
book=open('v18_book.js').read()
def rep(a,b,cnt=1):
    global s
    n=s.count(a)
    assert n==cnt,(n,a[:80])
    s=s.replace(a,b)
rep("<title>Mahomie's Hub v1.7</title>","<title>Mahomie's Hub v1.8</title>")
# state
rep("me:store('me')||D.me,bets:store('bets')||[],bseg:'lines',slip:null,stake:25};","me:(store('auth')||{}).user_id||store('me')||D.me,bseg:'lines',picks:[],stake:25,lt:null,pin:'',pin1:null,pinErr:'',pinBusy:false};")
rep("    S.bets=S.bets.filter(function(b){return D.lines.some(function(l){return l.id===b.line})});store('bets',S.bets);\n","")
rep("if(j&&j.ok&&j.app===\"Mahomie's Hub\"){LIVE=true;render();loadHub()}","if(j&&j.ok&&j.app===\"Mahomie's Hub\"){LIVE=true;render();loadHub();bookLoad()}")
# old practice helpers
a=s.index("function profit(stake,o)"); b=s.index("function line(id)")
s=s[:a]+s[b:]
a=s.index("function pickLabel(p)"); b=s.index("/* ---------- HOME ---------- */")
s=s[:a]+s[b:]
# book block
a=s.index("/* ---------- BOOK ---------- */"); b=s.index("/* ---------- ME / PROFILE ---------- */")
s=s[:a]+book+"\n"+s[b:]
# preview link: only when the hub has that week's line
rep("""(sc||'<button type="button" class="prev-link" data-bkprev="'+l.id+'">Preview ›</button>')""",
    """(sc||(line('w'+W.week+'m'+l.matchup_id)?'<button type="button" class="prev-link" data-prev="w'+W.week+'m'+l.matchup_id+'">Preview ›</button>':''))""")
rep("""  if(S.picks.length)h+='<button type="button" class="slipbar\"""","""  if(S.picks.length)h+='<div style="height:60px"></div><button type="button" class="slipbar\"""")
# old slip
a=s.index("function slipHtml(){\n  var p=S.slip"); b=s.index("function toast(t)")
s=s[:a]+s[b:]
rep("function closeSheet(){$('#sheet').classList.remove('open');$('#scrim').classList.remove('open');if(S.slip){S.slip=null;render()}}",
    "function closeSheet(){$('#sheet').classList.remove('open');$('#scrim').classList.remove('open')}")
rep("  $('#bucks').textContent=money(bank());","  $('#bucks').textContent=BK.me?money(BK.me.balance):'Log in';")
# events
a=s.index("  if(d.pick){"); b=s.index("  if(t.id==='bucksBtn')")
s=s[:a]+"""  if(d.bk){var a=d.bk.split('|');if(!AUTH){S.picks=[{line:a[0],mkt:a[1],side:a[2]}];render();openLogin();return}togglePick(a[0],a[1],a[2]);return}
  if(d.slip){openSheet(slipHtml());return}
  if(d.unpick!==undefined){S.picks.splice(+d.unpick,1);render();if(S.picks.length)openSheet(slipHtml());else closeSheetQuiet();return}
  if(d.stake){S.stake=+d.stake;openSheet(slipHtml());return}
  if(t.id==='place'){placeBet(t);return}
  if(t.id==='clearSlip'){S.picks=[];closeSheetQuiet();render();return}
  if(d.bcancel){t.disabled=true;api('/bets/'+d.bcancel+'/cancel',{method:'POST'}).then(function(){toast('Bet cancelled, Bucks returned');bookLoad()}).catch(function(e){t.disabled=false;toast(e.message)});return}
  if(d.login){openLogin();return}
  if(d.lteam){S.lt=d.lteam;S.pin='';S.pin1=null;S.pinErr='';openSheet(loginSheet());return}
  if(d.key){pinKey(d.key);return}
  if(d.pinback){S.lt=null;S.pin='';S.pin1=null;S.pinErr='';openSheet(loginSheet());return}
  if(d.logout){logout();return}
  if(d.adm){openSheet(admSheet(d.adm,d.arg));if(d.adm==='log')loadLog();return}
  if(d.admgo){admGo(d.admgo,d.arg,t);return}
  if(d.bkreload){BK.on=null;render();bookLoad();return}
"""+s[b:]
rep("  if(d.tab){go(d.tab);return}","  if(d.tab){go(d.tab);if(d.tab==='book'||d.tab==='me')bookLoad();return}")
rep("  if(t.id==='bucksBtn'){go('book');return}","  if(t.id==='bucksBtn'){go('book');bookLoad();return}")
a=s.index("  if(e.target.id==='stake'){"); b=s.index("});",a)
s=s[:a]+"  if(e.target.id==='stake'){S.stake=Math.round(+e.target.value||0);slipCheck()}\n"+s[b:]
# Me tab
a=s.index("function me(){"); b=s.index("/* ---------- GAME DETAIL ---------- */")
s=s[:a]+"""function me(){
  var act=ids.filter(function(u){return M(u).active}),h;
  if(AUTH)h='<section class="panel"><div class="ph" style="margin:0"><div><div class="kicker">Logged in to the Banana Book</div><h2 style="font-size:18px">'+esc(team(AUTH.user_id))+'</h2></div><button type="button" class="x" data-logout="1">Log out</button></div></section>';
  else h='<section class="panel"><label for="meSel" class="kicker" style="display:block;margin-bottom:6px">Who are you?</label><select id="meSel">'+act.map(function(u){return '<option value="'+u+'"'+(u===S.me?' selected':'')+'>'+esc(team(u))+' · '+esc(M(u).name)+'</option>'}).join('')+'</select>'+
    (LIVE?'<p class="muted" style="font-size:11.5px;margin-top:6px">Just browsing. Log in with your team PIN to bet.</p><button type="button" class="cta" data-login="1" style="margin-top:10px">Log in to the Book</button>':'<p class="muted" style="font-size:11.5px;margin-top:6px">Pick your team to see your stats.</p>')+'</section>';
  h+=profile(S.me,true);
  h+=admPanel();
  return h+foot();
}

"""+s[b:]
rep("D.version+' test build · ","D.version+' · ")
# AWARDS pass: full award rows with a unit under each number (Jayson 2026-10-09)
a_="""<span class="aw-m"><b>'+esc(a.title)+'</b><span>'+esc(tnS(s,a.uid))+' · '+esc(a.note)+'</span></span><span class="aw-v num">'+esc(a.val)+'</span></button>'"""
assert s.count(a_)==1
s=s.replace(a_,"""<span class="aw-m"><b>'+esc(a.title)+'</b><span class="aw-tm">'+av(a.uid,18)+esc(tnS(s,a.uid))+'</span><span class="aw-note">'+esc(a.note)+'</span></span>'+awVal(a)+'</button>'""")
s=s.replace("function awardsView(){","""var AW_UNIT={points:['points','points'],topb:['week on top','weeks on top'],rotb:['week at the bottom','weeks at the bottom'],lucky:['extra wins','extra wins'],unlucky:['wins lost','wins lost'],pa:['points against','points against'],high:['points','points'],blow:['won by','won by'],heart:['lost by','lost by']};
function awVal(a){var v=String(a.val),u=AW_UNIT[a.key],n=parseFloat(v.replace(/[^0-9.\\-+]/g,''));
  if(a.key==='topb'||a.key==='rotb')v=v.replace(/×/,'');
  if(a.key==='blow'||a.key==='heart')v=v.replace(/^[+-]/,'');
  if(a.key==='lucky'||a.key==='unlucky')v=v.replace(/^[+-]/,'');
  var unit=u?(Math.abs(n)===1?u[0]:u[1]):'';
  return '<span class="aw-vb"><span class="aw-v num">'+esc(v)+'</span>'+(unit?'<small>'+esc(unit)+'</small>':'')+'</span>'}
function awardsView(){""",1)
AW_CSS=""".aw-row{grid-template-columns:30px minmax(0,1fr) auto!important;align-items:center!important}
.aw-m{display:grid;gap:2px;min-width:0}.aw-m b{font-size:15px;font-weight:600}
.aw-m .aw-tm{display:flex;align-items:center;gap:6px;font:500 12.5px var(--sans,inherit);color:var(--ink);white-space:normal;overflow:visible}
.aw-m .aw-tm .av{flex:0 0 auto}
.aw-m .aw-note{font:11.5px var(--mono);color:var(--muted);white-space:normal;overflow:visible;line-height:1.4}
.aw-vb{display:grid;justify-items:end;align-self:center;min-width:64px;text-align:right}
.aw-vb small{font:500 9px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint);max-width:84px;line-height:1.25;margin-top:2px}
"""

# DRAFT pass: clearer draft re-grade rows (Jayson 2026-10-09)
a_=s.index('function draftHtml(d){'); b_=s.index('/* ---------- RECORDS ---------- */')
s=s[:a_]+open('/home/claude/data/v18_draft.js').read()+'\n'+s[b_:]
AW_CSS+=""".dr-row{grid-template-columns:52px minmax(0,1fr) auto!important;align-items:center!important}
.dr-pk{display:grid;justify-items:center;font:700 14px var(--mono);color:var(--cyan);border:1px solid var(--line-2);border-radius:7px;padding:4px 0;line-height:1.15}.dr-pk small{font:500 9px var(--mono);color:var(--faint);letter-spacing:.06em;text-transform:uppercase}
.dr-team{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);margin-top:2px}
.dr-mv{font-size:11.5px;color:var(--muted);margin-top:2px}.dr-mv b{color:var(--ink);font-family:var(--mono);font-weight:600}.dr-mv .up,.dr-mv .dn{font-family:var(--mono);white-space:nowrap}
"""

# RECORDS pass: full descriptions + a unit under each record number (Jayson 2026-10-09)
for a_,b_ in [
  ("""<div class="big">'+esc(top.v)+'</div>'+""","""<div class="big">'+esc(recNum(k,top))+'</div><div class="rec-unit">'+esc(recUnit(k,top,list[0]))+'</div>'+"""),
  ("""<span class="val">'+esc(r.v)+'</span>'""","""<span class="aw-vb"><span class="val">'+esc(recNum(k,r))+'</span><small>'+esc(recUnit(k,r,x))+'</small></span>'"""),
  ("""h+='<section class="panel tight"><div class="rows">'+\n   list.slice(1""","""h+='<section class="panel tight rec-list"><div class="rows">'+\n   list.slice(1"""),
  ("function recVal(k,x){","""function recNum(k,r){return k==='wstreak'||k==='lstreak'?String(r.v).replace(/\\s*[WL]$/,''):r.v}
function recUnit(k,r,x){if(k==='wstreak')return 'wins in a row';if(k==='lstreak')return 'losses in a row';
  if(k==='blowout'||k==='close')return 'won by';if(k==='hiloss')return 'pts in a loss';if(k==='lowin')return 'pts in a win';
  if(k==='seasonhi'||k==='seasonlo')return 'season pts';return 'points'}
function recVal(k,x){"""),
  ]:
    assert s.count(a_)==1,(s.count(a_),a_[:60])
    s=s.replace(a_,b_)
AW_CSS+=""".rec-list .who .tx>span,.rec-hero .who .tx>span{white-space:normal;overflow:visible;line-height:1.4;font-family:var(--sans,"IBM Plex Sans",system-ui,sans-serif);font-size:12.5px}
.rec-hero .rec-unit{font:500 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:-2px}
.rec-hero .info{justify-self:start}
.rec-list .row{align-items:center}
"""

# TRADES pass: trade grader v2 (Jayson 2026-10-09)
a_=s.index('function tradesHtml(d){'); b_=s.index('function draftHtml(d){')
s=s[:a_]+open('v18_trades.js').read()+'\n'+s[b_:]
s=s.replace("  if(d.info){openSheet(","  if(d.trade!==undefined){openSheet(tradeSheet(+d.trade)+CLOSE);return}\n  if(d.info){openSheet(",1) if "if(d.info){openSheet(" in s else s
s=s.replace("$('#scrim').addEventListener('click',closeSheet);","$('#scrim').addEventListener('click',closeSheet);\nfunction twHit(e){var r=e.target.closest&&e.target.closest('[data-tw]');if(!r)return;var box=r.closest('.chartbox');if(box)chartTip(box,+r.dataset.tw)}\ndocument.addEventListener('click',twHit);document.addEventListener('pointermove',function(e){if(e.pointerType==='mouse')twHit(e)});",1)

# EXPLAIN pass: "How it works" buttons + sheets (Jayson 2026-10-09)
s=s.replace("/* ---------- ME / PROFILE ---------- */",open('v18_explain.js').read()+"\n/* ---------- ME / PROFILE ---------- */",1)
for a_,b_ in [
  ("<h2>Standings</h2></div></div>","<h2>Standings</h2></div>'+info('standings')+'</div>"),
  ("<h2>Power rankings</h2></div></div>","<h2>Power rankings</h2></div>'+info('power')+'</div>"),
  ('<h1 style="font-size:28px">Playoff odds</h1>','<h1 style="font-size:28px">Playoff odds</h1>\'+info(\'odds\')+\''),
  ("<h2>All-time table</h2></div></div>","<h2>All-time table</h2></div>'+info('alltime')+'</div>"),
  ("<h2>Rivalry card</h2></div></div>","<h2>Rivalry card</h2></div>'+info('h2h')+'</div>"),
  ("<h1>'+s+' awards</h1>';","<h1>'+s+' awards</h1>'+info('awards');"),
  ("<h2>Bench Shame</h2></div></div>","<h2>Bench Shame</h2></div>'+info('bench')+'</div>"),
  ('data-share-rec="1">Share</button></section>','data-share-rec="1">Share</button>\'+info(\'records\')+\'</section>'),
  ('<p class="margin">Win chance from the Banana Book</p>','<p class="margin">Win chance from the Sportsbook</p>\'+info(\'preview\')+\''),
  ("      if(!AUTH)h+='<p class=\"note\"><b>Look around all you want.</b>","      h+='<div class=\"info-row\">'+info('book')+'</div>';\n      if(!AUTH)h+='<p class=\"note\"><b>Look around all you want.</b>"),
  ("  h+=admPanel();\n  return h+foot();","  h+=explainPanel();\n  h+=admPanel();\n  return h+foot();"),
  ("  if(d.tab){go(d.tab);","  if(d.info){openSheet(explainSheet(d.info)+CLOSE);return}\n  if(d.trade!==undefined){openSheet(tradeSheet(+d.trade)+CLOSE);return}\n  if(d.tab){go(d.tab);"),
  ]:
    assert s.count(a_)==1,(s.count(a_),a_)
    s=s.replace(a_,b_)

# CSS
css=""".bk-sub{display:flex;justify-content:space-between;padding:0 4px;font:500 10px var(--mono);letter-spacing:.12em;color:var(--faint);text-transform:uppercase}
.mu.void{opacity:.55}
.mu-note{padding:0 12px 10px;font-size:12px;color:var(--muted)}
.slipbar{position:fixed;left:12px;right:12px;bottom:calc(var(--tab-h) + env(safe-area-inset-bottom,0px) + 10px);z-index:45;display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:52px;padding:0 16px;border:0;border-radius:12px;background:var(--banana);color:var(--banana-ink);font:700 15px var(--display);letter-spacing:.03em;text-transform:uppercase;box-shadow:0 8px 28px rgba(0,0,0,.45),0 0 22px rgba(246,207,76,.3);max-width:696px;margin:0 auto}
.legs{display:grid;gap:6px}
.leg{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:9px;background:var(--panel)}
.leg b{font-size:14px;display:block}.leg span{font:11.5px var(--mono);color:var(--muted)}
.st.s-won{color:var(--win)}.st.s-lost{color:var(--loss)}.st.s-push,.st.s-void{color:var(--muted)}
.lg{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:var(--faint);vertical-align:middle}.lg-won{background:var(--win)}.lg-lost{background:var(--loss)}.lg-push,.lg-void{background:var(--muted)}
.pinbox{display:grid;justify-items:center;gap:8px;text-align:center;padding-top:6px}
.pinbox h2{font:700 20px var(--display)}
.dots{display:flex;gap:14px;margin:6px 0}
.dots i{width:16px;height:16px;border-radius:50%;border:2px solid var(--banana-2)}
.dots i.on{background:var(--banana);border-color:var(--banana)}
.dots.shake{animation:shake .35s}
@keyframes shake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
.pad{display:grid;grid-template-columns:repeat(3,76px);gap:10px;justify-content:center;margin-top:4px}
.pk2{height:60px;border-radius:12px;border:1px solid var(--line-2);background:var(--panel);font:600 24px var(--display);color:var(--ink)}
.pk2.dim{font:500 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.pk2:active{background:var(--panel-3)}
.fld{display:grid;gap:4px}.fld>span{font:500 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.fld input{min-height:46px;border:1px solid var(--line-2);border-radius:9px;background:var(--ground-2);color:var(--ink);padding:0 12px;font-family:inherit;font-size:16px;width:100%}
.chk{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--muted)}
.info{border:1px solid var(--line-2);background:transparent;border-radius:999px;padding:5px 10px;min-height:30px;font:500 10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cyan);white-space:nowrap;align-self:flex-start}
.hero .info{margin-top:10px}
.info-row{display:flex;justify-content:center}
"""
css+=open('/home/claude/data/v18_trades.css').read()
css+=AW_CSS
# RENAME (Jayson 2026-10-09: no Banana Bets branding in this app)
LOGO='<img class="mark" src="/brand-96.png" alt="" width="34" height="34">'
a=s.index('<svg class="mark"'); b=s.index('</svg>',a)+6; s=s[:a]+LOGO+s[b:]
for a_,b_ in [('/* Layout: same Banana Bets shell (sticky brand bar','/* Layout: sticky brand bar'),('banana yellow lead','gold lead'),
  ('aria-label="Open the Banana Book"><span>🍌</span>','aria-label="Open the Sportsbook"><span>💵</span>'),
  ("<small>🍌 Top Banana</small><strong class=\"num\">","<small>🔥 High score</small><strong class=\"num\">"),("<small>🤢 Rotten</small><strong class=\"num\">'+f1(rot.p)","<small>🧊 Low score</small><strong class=\"num\">'+f1(rot.p)"),
  ("<th>🍌</th><th>🤢</th>","<th>🔥</th><th>🧊</th>"),
  ("🍌 Top Banana = weeks as the league\\'s top scorer. 🤢 Rotten Banana = weeks as the lowest.","🔥 On Fire = weeks as the league\\'s top scorer. 🧊 Ice Cold = weeks as the lowest."),
  ("topb:'🍌',rotb:'🤢'","topb:'🔥',rotb:'🧊'"),
  ("<small>🍌 Top Banana</small><strong>'+a.tb","<small>🔥 On Fire</small><strong>'+a.tb"),("<small>🤢 Rotten</small><strong>'+a.rb","<small>🧊 Ice Cold</small><strong>'+a.rb"),
  ('<div class="kicker">Banana Book</div><h2>The line</h2>','<div class="kicker">Sportsbook</div><h2>The line</h2>'),
  ("'Top Banana: '","'On Fire: '"),('Logged in to the Banana Book',"Logged in to the Sportsbook")]:
    assert s.count(a_)>=1,a_
    s=s.replace(a_,b_)
s=s.replace('--banana-2','--gold-2').replace('--banana-ink','--gold-ink').replace('--banana','--gold')
# topbar scrolls away with the page (Jayson 2026-10-09); a solid strip keeps the phone's status bar readable
a_='.topbar{position:sticky;top:env(safe-area-inset-top,0px);z-index:30;'
assert a_ in s
s=s.replace(a_,'.topbar{position:relative;z-index:30;padding-top:calc(10px + env(safe-area-inset-top,0px)) !important;')
s=s.replace('.topbar::after{','body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);background:var(--ground);z-index:80;pointer-events:none}\n.topbar::after{',1)
left=[l.strip()[:120] for l in s.split('\n') if re.search('anana|🍌',l)]
assert not left,left
i=s.index("</style>")
s=s[:i]+css.replace('--banana-ink','--gold-ink').replace('--banana','--gold')+s[i:]
open('app18.template.html','w').write(s)
d=json.load(open('app17.json'));d['version']='1.8'
for A in d['awards'].values():
    for x in A:
        if x['key']=='topb':x['title']='On Fire'
        if x['key']=='rotb':x['title']='Ice Cold';json.dump(d,open('app18.json','w'))
data=json.dumps(d)
page=s.replace('__DATA__',data.replace('</','<\\/'))
open('/home/claude/mahomies-hub-v18.html','w').write(page)
dist=open('/home/claude/mahomies-hub/prototype/dist/night.html').read()
head=dist[:dist.index('<body>')+6]
open('/home/claude/data/night18.html','w').write(head+page+'</body></html>')
print('ok',len(page))
