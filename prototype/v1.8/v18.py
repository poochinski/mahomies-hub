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
"""
i=s.index("</style>")
s=s[:i]+css+s[i:]
open('app18.template.html','w').write(s)
d=json.load(open('app17.json'));d['version']='1.8';json.dump(d,open('app18.json','w'))
data=json.dumps(d)
page=s.replace('__DATA__',data.replace('</','<\\/'))
open('/home/claude/mahomies-hub-v18.html','w').write(page)
dist=open('/home/claude/mahomies-hub/prototype/dist/night.html').read()
head=dist[:dist.index('<body>')+6]
open('/home/claude/data/night18.html','w').write(head+page+'</body></html>')
print('ok',len(page))
