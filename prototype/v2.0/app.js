
(function(){
var D=JSON.parse(document.getElementById('data').textContent);
var $=function(s){return document.querySelector(s)};
var view=$('#view');
var PAL=['#f6cf4c','#4cecff','#ff5fd6','#5dff8f','#ffb347','#b18cff','#7ef0d4','#ff8a65','#8fb3ff','#ffd6f2','#c6ff6b','#ff9fb2','#9aa3c7','#f2a7ff'];
var ids=Object.keys(D.managers);
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function M(u){return D.managers[u]||{name:'?',team:'?'}}
function team(u){return (M(u).team||M(u).name).trim()}
function initials(u){var n=M(u).name;var p=n.replace(/[^A-Za-z0-9 ]/g,'').match(/[A-Z][a-z]*|[a-z]+|\d+/g)||[n];return ((p[0]||'')[0]+((p[1]||'')[0]||(p[0]||'')[1]||'')).toUpperCase()}
function color(u){return PAL[ids.indexOf(u)%PAL.length]}
function av(u,sz){sz=sz||32;var a=LIVE&&D.avatars&&D.avatars[u];return '<span class="av" style="width:'+sz+'px;height:'+sz+'px;font-size:'+Math.round(sz*.38)+'px;background:'+color(u)+'">'+esc(initials(u))+(a?'<img src="https://sleepercdn.com/avatars/thumbs/'+a+'" alt="" loading="lazy" onerror="this.remove()">':'')+'</span>'}
function teamF(u){return team(u)+(M(u).active?'':' (former)')}
function fmr(u){return M(u).active?'':'<span class="fmr">Former</span>'}
function who(u,sub,sz){return '<button class="who" type="button" data-mgr="'+u+'">'+av(u,sz)+'<span class="tx"><b>'+esc(team(u))+fmr(u)+'</b><span>'+esc(sub!=null?sub:M(u).name)+'</span></span></button>'}
function whoS(u,sub,sz){return '<span class="who">'+av(u,sz)+'<span class="tx"><b>'+esc(team(u))+fmr(u)+'</b><span>'+esc(sub!=null?sub:M(u).name)+'</span></span></span>'}
function gi(s,w,u){for(var i=0;i<D.games.length;i++){var g=D.games[i];if(g.s===s&&g.w===w&&(g.win===u||g.lose===u))return i}return -1}
function CUR(){return D.league.season}
function ALLS(){return Object.keys(D.seasons).sort().reverse()}
function PAST(){return ALLS().filter(function(s){return s!==CUR()&&D.seasons[s].champ})}
function DONE(){var o=[];for(var w=1;w<=D.league.last_scored;w++)o.push(w);return o}
var CHEV='<span class="chev" aria-hidden="true">›</span>';
function f2(n){return Number(n).toFixed(2)}
function f1(n){return Number(n).toFixed(1)}
function odds(o){return o>0?'+'+o:String(o)}
function spr(x){return x===0?'PK':(x>0?'+'+f1(x):f1(x))}
function money(n){return Math.round(n).toLocaleString('en-US')}
function sw(s,w){return s+' · Wk '+w}
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem('mh-'+k));localStorage.setItem('mh-'+k,JSON.stringify(v))}catch(e){return null}}

var S={tab:'home',lseg:'season',rec:'high',rf:'all',resMore:false,recMore:false,hw:D.league.last_scored,aws:D.league.season,lab:'bench',labs:D.league.season,sw:null,ss:null,h2a:null,h2b:null,me:(store('auth')||{}).user_id||store('me')||D.me,bseg:'lines',picks:[],stake:25,slipMode:'single',review:false,propLine:null,lt:null,pin:'',pin1:null,pinErr:'',pinBusy:false};
S.h2a=S.me;
/* On Railway the page sits next to our server: turn on live lineups + real avatars. */
var LIVE=false;
try{fetch('/api/health',{headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.ok&&j.app==="Mahomie's Hub"){LIVE=true;render();loadHub();loadPulse();bookLoad()}}).catch(function(){})}catch(e){}

function loadHub(){
  fetch('/api/hub',{headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null}).then(function(j){
    if(!j||!j.league||!j.seasons)return;
    D=j;ids=Object.keys(D.managers);
    S.hw=D.league.last_scored||1;S.aws=CUR();S.labs=CUR();S.h2b=null;
    render();
  }).catch(function(){});
}
setInterval(function(){if(LIVE&&document.visibilityState==='visible'&&!$('#sheet').classList.contains('open'))loadHub()},3*60*1000);
/* Home "Live" is an NFL game in progress, not "the server answered". Polled once a minute. */
var PULSE=null;
function loadPulse(){
  fetch('/api/pulse',{headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null}).then(function(j){
    if(!j)return;
    var same=PULSE&&PULSE.live===j.live&&PULSE.next===j.next&&PULSE.phase===j.phase&&PULSE.delayed===j.delayed&&PULSE.week===j.week;
    PULSE=j;
    if(!same&&S.tab==='home'&&!$('#sheet').classList.contains('open'))render();
  }).catch(function(){});
}
setInterval(function(){if(LIVE&&document.visibilityState==='visible')loadPulse()},60*1000);
function pulseForWeek(){return PULSE&&PULSE.phase!=null&&(!PULSE.week||PULSE.week===D.league.week)}
/* ---------- Book math ---------- */
function line(id){return D.lines.find(function(l){return l.id===id})}
/* ---------- HOME ---------- */
function weekGames(s,w){return D.games.map(function(g,i){return {g:g,i:i}}).filter(function(x){return x.g.s===s&&x.g.w===w})}
function home(){
  var L=D.league,hw=S.hw,me=S.me;
  var my=D.lines.filter(function(l){return l.a===me||l.b===me})[0];
  var badge='';
  if(pulseForWeek()&&PULSE.live)badge=' · <span class="live"><i></i>Live</span>';
  else if(pulseForWeek()&&PULSE.delayed)badge=' · Kickoff delayed';
  else if(pulseForWeek()&&PULSE.next)badge=' · <span class="kick">Next kickoff '+esc(PULSE.next)+'</span>';
  var phase=pulseForWeek()?esc(PULSE.phase):('Week '+L.week);
  var h='<section class="hero hero-tight"><div class="eyebrow">'+CUR()+' · Week '+L.week+badge+'</div><h1>'+phase+'</h1>';
  if(my){
    var mineA=my.a===me,opp=mineA?my.b:my.a,myPts=mineA?my.live_a:my.live_b,opPts=mineA?my.live_b:my.live_a,wp=Math.round((mineA?my.wp:1-my.wp)*100);
    h+='<button type="button" class="yourgame" data-prev="'+my.id+'"><div class="yg-k">Your game · tap for preview</div>'+
     '<div class="yg-row">'+av(me,40)+'<div class="yg-n"><b>'+esc(team(me))+'</b><span>'+esc(recOf(me))+'</span></div><b class="yg-s num">'+f2(myPts)+'</b></div>'+
     '<div class="yg-row">'+av(opp,40)+'<div class="yg-n"><b>'+esc(team(opp))+'</b><span>'+esc(recOf(opp))+'</span></div><b class="yg-s num dim">'+f2(opPts)+'</b></div>'+
     '</button>';
  } else {
    var o=(D.odds.list||[]).find(function(x){return x.uid===me});var st=(D.seasons[CUR()].standings||[]).find(function(x){return x.uid===me});
    if(st)h+='<button type="button" class="yourgame" data-go="league:odds"><div class="yg-k">Your season</div><div class="yg-row">'+av(me,40)+'<div class="yg-n"><b>'+esc(team(me))+'</b><span>'+st.w+'-'+st.l+' · seed '+st.seed+(o?' · '+pct(o.playoff)+' playoff odds':'')+'</span></div></div></button>';
  }
  h+='</section>';
  if(D.lines.length){
    h+='<section class="panel tight"><div class="ph"><div><div class="kicker">Live scores · tap a game</div><h2>This week</h2></div></div><div class="games">'+
     D.lines.map(function(l){var aw=l.live_a>=l.live_b;return '<button type="button" class="gl" data-prev="'+l.id+'">'+
       '<span class="gl-t'+(aw&&l.live_a>0?' w':'')+'">'+av(l.a,22)+'<b>'+esc(team(l.a))+'</b><i class="num">'+f1(l.live_a)+'</i></span>'+
       '<span class="gl-t'+(!aw&&l.live_b>0?' w':'')+'">'+av(l.b,22)+'<b>'+esc(team(l.b))+'</b><i class="num">'+f1(l.live_b)+'</i></span></button>'}).join('')+'</div></section>';
  }
  var wk=weekScores(CUR(),hw),top=wk[0],rot=wk[wk.length-1],potw=null;
  wk.forEach(function(x){var t=topP(CUR(),hw,x.u);if(t&&t.name&&(!potw||t.pts>potw.pts))potw={u:x.u,name:t.name,pts:t.pts}});
  if(top){
    h+='<section class="panel tight"><div class="ph"><div><div class="kicker">Week '+hw+' final</div><h2>Last week</h2></div><button class="link" data-wk="'+hw+'">Recap &amp; scores →</button></div><div class="lw">'+
     '<button type="button" class="lw-c t-y" data-game="'+gi(CUR(),hw,top.u)+'"><small>🔥 High score</small><strong class="num">'+f1(top.p)+'</strong><span>'+esc(team(top.u))+'</span></button>'+
     '<button type="button" class="lw-c t-r" data-game="'+gi(CUR(),hw,rot.u)+'"><small>🧊 Low score</small><strong class="num">'+f1(rot.p)+'</strong><span>'+esc(team(rot.u))+'</span></button>'+
     (potw?'<button type="button" class="lw-c t-b" data-game="'+gi(CUR(),hw,potw.u)+'"><small>⭐ Top player</small><strong class="num">'+f1(potw.pts)+'</strong><span>'+esc(potw.name)+'</span></button>':'')+
     '</div></section>';
  }
  h+='<section class="block"><div class="bh"><div><div class="kicker">Everything else</div><h2>Explore</h2></div></div><div class="jump">'+
   [['data-go="league:awards"','🏆','Awards','t-y'],['data-go="league:odds"','🎯','Playoff odds','t-b'],['data-go="league:season"','📈','Power rankings','t-g'],
    ['data-go="records"','📚','Record book','t-r'],['data-go="league:history"','📜','History','t-k'],['data-go="league:h2h"','⚔️','Rivals','t-g'],
    ['data-wk="'+hw+'"','📅','Weekly results','t-b'],['data-twih="1"','🕰️','This week in history','t-y'],['data-go="league:lab"','🧪','Lab','t-r']]
    .map(function(j){return '<button type="button" class="jt '+j[3]+'" '+j[0]+'><span>'+j[1]+'</span><b>'+j[2]+'</b></button>'}).join('')+'</div></section>';
  return h+foot();
}
function weekSheet(s,w){
  var last=s===CUR()?D.league.last_scored:((D.seasons[s]||{}).last||17);
  var h='<section class="hero"><div class="eyebrow">'+s+' · results</div><h1>Week '+w+'</h1></section>';
  h+='<div class="chips wrap">';for(var i=1;i<=last;i++)h+='<button type="button" class="chip'+(i===w?' on':'')+'" data-wk="'+i+'" data-wks="'+s+'">'+(i>=15?'P'+(i-14):'Wk '+i)+'</button>';h+='</div>';
  return h+'<section class="panel">'+recapHtml(s,w)+resultsHtml(s,w)+'</section>';
}
function twihSheet(){return '<section class="hero"><div class="eyebrow">Week '+D.league.week+' in past seasons</div><h1>This week in history</h1></section>'+historyCard(D.league.week)}
function matchCard(l,i){
  var fa=l.spread>=0,fav=fa?l.a:l.b,sp=Math.abs(l.spread);
  var side=function(u,pts,ml){return '<div class="mc-t">'+av(u,34)+'<span class="mc-n"><b>'+esc(team(u))+'</b><small>ML '+odds(ml)+'</small></span><span class="mc-s num">'+f2(pts)+'</span></div>'};
  return '<button type="button" class="mcard" data-prev="'+l.id+'"><div class="mc-h"><span>Game '+(i+1)+'</span><span class="live"><i></i>Live</span></div>'+
   side(l.a,l.live_a,l.ml_a)+side(l.b,l.live_b,l.ml_b)+
   '<div class="mc-f"><span>'+esc(team(fav).split(' ').slice(0,2).join(' '))+' by '+f1(sp)+'</span><span>O/U '+f1(l.total)+'</span><span class="mc-go">Preview ›</span></div></button>'}
function awardCard(a){var gx=a.game?gi(a.game.s,a.game.w,a.game.win):-1;
  return '<button type="button" class="acard a-'+a.key+'" '+(gx>=0?'data-game="'+gx+'"':'data-mgr="'+a.uid+'"')+'><span class="aw-ic">'+(AW_ICON[a.key]||'⭐')+'</span><span class="aw-t">'+esc(a.title)+'</span><span class="aw-v num">'+esc(a.val)+'</span><span class="aw-w">'+av(a.uid,20)+'<b>'+esc(team(a.uid))+'</b></span></button>'}
function oddsBar(p){var pc=Math.round(p*1000)/10;return '<div class="ob2"><div class="ob2-t"><i style="width:'+Math.max(2,pc)+'%"></i></div><b>'+(pc>=99.95?'>99.9':pc<0.05?'<0.1':pc.toFixed(1))+'%</b></div>'}
function resultsHtml(s,w,lim){var gs=weekGames(s,w).slice(0,lim||99);if(!gs.length)return '<p class="muted">No games found for this week.</p>';
  return '<div>'+gs.map(function(x){var g=x.g;return '<button type="button" class="res" data-game="'+x.i+'"><div>'+whoS(g.win,tnS(s,g.win)===team(g.win)?M(g.win).name:'as '+tnS(s,g.win),26)+'</div><span class="s">'+f2(g.wp)+'</span><div class="lose">'+whoS(g.lose,tnS(s,g.lose)===team(g.lose)?M(g.lose).name:'as '+tnS(s,g.lose),26)+'</div><span class="s" style="color:var(--faint)">'+f2(g.lp)+'</span></button>'}).join('')+'</div>'}
function enteringPct(s,w,u){var a=0,b=0;D.games.forEach(function(x){if(x.s!==s||x.w>=w||x.k!=='Regular season')return;if(x.win===u)a++;else if(x.lose===u)b++});return a+b?a/(a+b):.5}
function recapHtml(s,w){
  var gs=weekGames(s,w).map(function(x){return x.g});if(!gs.length)return '';
  var ws=weekScores(s,w),top=ws[0],low=ws[ws.length-1];
  var blow=gs.slice().sort(function(a,b){return b.m-a.m})[0],close=gs.slice().sort(function(a,b){return a.m-b.m})[0];
  var ups=gs.filter(function(g){return w>1&&enteringPct(s,w,g.lose)-enteringPct(s,w,g.win)>=.3}).sort(function(a,b){return (enteringPct(s,w,b.lose)-enteringPct(s,w,b.win))-(enteringPct(s,w,a.lose)-enteringPct(s,w,a.win))})[0];
  var broke=[];gs.forEach(function(g){gameRecs(g).forEach(function(r){if(r.n<=5)broke.push('#'+r.n+' all-time '+RN[r.k].toLowerCase()+' ('+esc(tnS(s,g.win))+' vs '+esc(tnS(s,g.lose))+')')})});
  var t='<b>'+esc(tnS(s,top.u))+'</b> led the week with '+f2(top.p)+', while <b>'+esc(tnS(s,low.u))+'</b> brought up the rear at '+f2(low.p)+'. ';
  t+='<b>'+esc(tnS(s,blow.win))+'</b> ran away from '+esc(tnS(s,blow.lose))+' by '+f1(blow.m)+'. ';
  t+='The nail-biter: '+esc(tnS(s,close.win))+' edged '+esc(tnS(s,close.lose))+' by '+f2(close.m)+'. ';
  if(ups)t+='Upset alert: <b>'+esc(tnS(s,ups.win))+'</b> knocked off '+esc(tnS(s,ups.lose))+'. ';
  if(broke.length)t+='Record book: '+broke.slice(0,2).join('; ')+'.';
  return '<div class="recap"><div class="kicker" style="color:var(--pink)">Week '+w+' recap</div><p>'+t+'</p></div>'}
function historyCard(w){
  var items=[];PAST().forEach(function(s){var gs=weekGames(s,w);if(!gs.length)return;
    var ws=weekScores(s,w),hi=ws[0],b=gs.slice().sort(function(a,c){return c.g.m-a.g.m})[0];
    items.push('<button type="button" class="row" data-game="'+gi(s,w,hi.u)+'" style="grid-template-columns:52px minmax(0,1fr) auto 10px"><span class="yr">'+s+'</span><div style="min-width:0"><b style="font-size:13.5px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(tnS(s,hi.u))+' dropped '+f2(hi.p)+'</b><span class="muted" style="font-size:11.5px">Biggest win: '+esc(tnS(s,b.g.win))+' by '+f1(b.g.m)+'</span></div><span></span>'+CHEV+'</button>')});
  return '<section class="panel"><div class="ph"><div><div class="kicker">Week '+w+' in past seasons</div><h2>This week in history</h2></div></div><div class="rows">'+items.join('')+'</div></section>'}
function tile(c,k,v,s,u,gix){return '<button class="tile '+c+'" type="button" '+(gix!=null&&gix>=0?'data-game="'+gix+'"':'data-mgr="'+u+'"')+'><small>'+esc(k)+'</small><strong class="num">'+esc(v)+'</strong><span>'+esc(s)+'</span></button>'}
function mv(m){return '<span class="mv '+(m>0?'up':m<0?'dn':'eq')+'">'+(m>0?'▲'+m:m<0?'▼'+(-m):'–')+'</span>'}
function foot(){return '<p class="foot"><span class="dots"><i style="background:var(--gold)"></i><i style="background:var(--pink)" data-egg="1"></i><i style="background:var(--cyan)"></i><i style="background:var(--win)"></i></span>v'+D.version+' · Sleeper data as of '+esc(D.updated_label)+'</p>'}

/* ---------- LEAGUE ---------- */
var LSEGS=[['season','📊','Standings'],['odds','🎯','Playoff odds'],['awards','🏆','Awards'],['history','📜','History'],['alltime','👑','All-time'],['h2h','⚔️','Rivals'],['lab','🧪','Lab'],['@records','📚','Records']];
function league(){
  var h='<div class="lnav">'+LSEGS.map(function(x){var go=x[0][0]==='@';return '<button type="button" class="ln-t'+(S.lseg===x[0]?' on':'')+'" '+(go?'data-go="'+x[0].slice(1)+'"':'data-lseg="'+x[0]+'"')+'><span>'+x[1]+'</span><b>'+x[2]+'</b></button>'}).join('')+'</div>';
  h+=({season:seasonView,odds:oddsView,history:historyView,alltime:alltimeView,h2h:h2hView,awards:awardsView,lab:labView}[S.lseg]||seasonView)();
  return h+foot();
}
function seasonView(){
  var st=D.seasons[CUR()].standings;
  var h='<section class="panel"><div class="ph"><div><div class="kicker">'+CUR()+' · after Week '+D.league.last_scored+'</div><h2>Standings</h2></div>'+info('standings')+'</div>'+
   '<div class="tw"><table><thead><tr><th>Team</th><th>W-L</th><th>PF</th><th>All-play</th><th>Luck</th></tr></thead><tbody>'+
   st.map(function(x,i){return '<tr class="'+(x.uid===S.me?'me ':'')+(i===5?'cut':'')+'"><td class="tm"><button class="who" type="button" data-mgr="'+x.uid+'"><span class="rk" style="width:20px;height:20px;font-size:10px">'+x.seed+'</span><span class="tx"><b style="font-size:13px">'+esc(team(x.uid))+'</b></span></button></td><td><b>'+x.w+'-'+x.l+'</b></td><td>'+f1(x.pf)+'</td><td>'+x.ap+'</td><td class="'+(x.luck>0.4?'pos':x.luck<-0.4?'negv':'')+'">'+(x.luck>0?'+':'')+f1(x.luck)+'</td></tr>'}).join('')+
   '</tbody></table></div><p class="muted" style="font-size:11.5px;margin-top:9px;line-height:1.5">W-L includes the league-median game each week. All-play is your record if you played every team every week. Luck is head-to-head wins minus all-play expected wins. Dashed line = playoff cut (top 6).</p></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Points, all-play, form, record</div><h2>Power rankings</h2></div>'+info('power')+'</div><div class="rows">'+
   D.power.map(function(p){return '<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto"><span class="rk'+(p.rank===1?' gold':'')+'">'+p.rank+'</span><div style="min-width:0">'+who(p.uid,p.rec+' · last 3: '+f1(p.last3)+' ppg',30)+'<div class="pbar"><i style="width:'+p.power+'%"></i></div></div><div style="display:grid;justify-items:end;gap:2px"><span class="val" style="font-size:16px">'+f1(p.power)+'</span>'+mv(p.move)+'</div></div>'}).join('')+
   '</div></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Browse any week</div><h2>'+CUR()+' weeks</h2></div><button class="link" data-season="'+CUR()+'">Open season ›</button></div><p class="muted" style="font-size:12.5px">Every result from this season, week by week.</p></section>';
  return h;
}
function oddsView(){
  var h='<section class="hero"><div class="eyebrow">'+money(D.odds.sims)+' simulated seasons · '+D.odds.weeks_left+' weeks left</div><h1 style="font-size:28px">Playoff odds</h1>'+info('odds')+'<p class="sub">Each simulation plays out the rest of the schedule using every team\'s scoring level and week-to-week swing, including the median game. Top 6 make it, top 2 get a bye.</p></section>';
  h+='<section class="panel"><div class="tw"><table><thead><tr><th>Team</th><th>Rec</th><th>Proj W</th><th>Playoffs</th><th>Bye</th><th>#1</th><th>Last</th></tr></thead><tbody>'+
   D.odds.list.map(function(o,i){return '<tr class="'+(o.uid===S.me?'me ':'')+(i===5?'cut':'')+'"><td class="tm"><button class="who" type="button" data-mgr="'+o.uid+'">'+av(o.uid,22)+'<span class="tx"><b style="font-size:13px">'+esc(team(o.uid))+'</b></span></button></td><td>'+o.rec+'</td><td>'+f1(o.wins)+'</td><td class="'+(o.playoff>=.5?'pos':'')+'"><b>'+pct(o.playoff)+'</b></td><td>'+pct(o.bye)+'</td><td>'+pct(o.top)+'</td><td class="'+(o.last>=.2?'negv':'')+'">'+pct(o.last)+'</td></tr>'}).join('')+
   '</tbody></table></div><p class="muted" style="font-size:11.5px;margin-top:9px;line-height:1.5">Projected wins include median-game wins (28 total games). Odds update every week once the app is live.</p></section>';
  return h;
}
function pct(p){var v=p*100;return v>=99.95?'>99.9%':v<0.05?'–':v.toFixed(v<10?1:0)+'%'}
function historyView(){
  var h='';
  PAST().forEach(function(s){
    var x=D.seasons[s];var reg=x.standings[0];var ts=x.standings.slice().sort(function(a,b){return b.pf-a.pf})[0];
    h+='<section class="season"><div class="season-h"><b>'+s+'</b><span>'+(s===D.league.first?'FIRST SEASON ON SLEEPER':'SEASON')+'</span></div><div class="podium">'+
     pod('m-1','🏆',x.champ,'Champion',s)+pod('m-2','🥈',x.runner,'Runner-up',s)+pod('m-3','🥉',x.third,'Third',s)+pod('m-s','🚽',x.sacko,'Sacko','r',s)+
     '</div><div class="season-f"><span class="pill">#1 seed <b>'+esc(x.team_names[reg.uid]||M(reg.uid).name)+'</b> '+reg.w+'-'+reg.l+'</span><span class="pill">Most points <b>'+esc(x.team_names[ts.uid]||M(ts.uid).name)+'</b> '+f1(ts.pf)+'</span>'+
     '<button type="button" class="open-season" data-season="'+s+'">Standings, bracket &amp; every week ›</button></div></section>';
  });
  return h;
}
function pod(c,ic,u,label,cls,s){if(s===undefined){s=cls;cls=''}var tn=D.seasons[s].team_names[u]||M(u).name;
  return '<div class="pod"><span class="medal '+c+'">'+ic+'</span>'+who(u,tn===team(u)?M(u).name:'as '+tn,30)+'<span class="lbl '+cls+'">'+label+'</span></div>'}
function atRow(x){return '<tr class="'+(x.uid===S.me?'me':'')+'"><td class="tm"><button class="who" type="button" data-mgr="'+x.uid+'">'+av(x.uid,22)+'<span class="tx"><b style="font-size:13px">'+esc(team(x.uid))+fmr(x.uid)+'</b><span>'+esc(M(x.uid).name)+'</span></span></button></td><td>'+(x.titles.length||'')+'</td><td>'+x.w+'-'+x.l+'</td><td>'+(x.pct*100).toFixed(1)+'</td><td>'+f1(x.avg)+'</td><td>'+x.playoffs.length+'</td><td>'+x.tb+'</td><td>'+x.rb+'</td></tr>'}
function alltimeView(){
  var head='<thead><tr><th>Team</th><th>🏆</th><th>W-L</th><th>Win%</th><th>PPG</th><th>Playoffs</th><th>🔥</th><th>🧊</th></tr></thead>';
  return '<section class="panel"><div class="ph"><div><div class="kicker">'+D.league.first+' – '+CUR()+' · regular season</div><h2>All-time table</h2></div>'+info('alltime')+'</div><div class="tw"><table>'+head+'<tbody>'+D.alltime.map(atRow).join('')+'</tbody></table></div>'+
   '<p class="muted" style="font-size:11.5px;margin-top:9px">🔥 On Fire = weeks as the league\'s top scorer. 🧊 Ice Cold = weeks as the lowest. W-L is head-to-head only.</p></section>';
}
function mgrOptions(sel){return ids.map(function(u){return '<option value="'+u+'"'+(u===sel?' selected':'')+'>'+esc(team(u))+' ('+esc(M(u).name)+')'+(M(u).active?'':' · Former')+'</option>'}).join('')}
function h2hView(){
  var act=ids.filter(function(u){return M(u).active});
  if(!S.h2b){var best=null;act.forEach(function(u){if(u===S.h2a)return;var r=D.h2h[S.h2a+'|'+u];if(r&&(!best||r.games.length>best.n))best={u:u,n:r.games.length}});S.h2b=best?best.u:act[1]}
  var r=D.h2h[S.h2a+'|'+S.h2b]||{w:0,l:0,pf:0,pa:0,games:[]};
  var n=r.games.length;var big=r.games.slice().sort(function(a,b){return (b.m-b.o)-(a.m-a.o)});
  var h='<section class="panel" id="rivalTop"><div class="ph"><div><div class="kicker">Head to head · every game</div><h2>Rivalry card</h2></div>'+info('h2h')+'</div><div class="two" style="margin-bottom:14px"><select id="h2a" aria-label="First team">'+mgrOptions(S.h2a)+'</select><select id="h2b" aria-label="Second team">'+mgrOptions(S.h2b)+'</select></div>';
  if(!n){h+='<p class="muted">These two have never played each other.</p></section>'}
  else{
  h+='<div class="vs"><div class="side">'+av(S.h2a,48)+'<b>'+esc(team(S.h2a))+'</b><strong style="color:'+(r.w>=r.l?'var(--win)':'var(--ink)')+'">'+r.w+'</strong></div><div class="mid">VS<br><span style="font-size:10px">'+n+' GAME'+(n===1?'':'S')+'</span></div><div class="side">'+av(S.h2b,48)+'<b>'+esc(team(S.h2b))+'</b><strong style="color:'+(r.l>r.w?'var(--win)':'var(--ink)')+'">'+r.l+'</strong></div></div>'+
   '<div class="stat3" style="margin-top:14px"><div class="stat"><small>Avg score</small><strong>'+f1(r.pf/n)+'</strong><span>vs '+f1(r.pa/n)+'</span></div><div class="stat"><small>Biggest win</small><strong>'+f1(Math.max(0,big[0].m-big[0].o))+'</strong><span>'+sw(big[0].s,big[0].w)+'</span></div><div class="stat"><small>Worst loss</small><strong>'+f1(Math.max(0,big[n-1].o-big[n-1].m))+'</strong><span>'+sw(big[n-1].s,big[n-1].w)+'</span></div></div>'+
   '<div style="margin-top:12px">'+r.games.slice().reverse().map(function(g){var won=g.m>g.o;return '<button type="button" class="row" style="grid-template-columns:minmax(0,1fr) auto 10px" data-game="'+gi(g.s,g.w,S.h2a)+'"><div><b style="font-size:13px">'+sw(g.s,g.w)+'</b><div class="muted" style="font-size:11.5px">'+esc(g.k)+'</div></div><div class="val" style="font-size:15px;color:'+(won?'var(--win)':'var(--loss)')+'">'+(won?'W ':'L ')+f2(g.m)+'–'+f2(g.o)+'</div>'+CHEV+'</button>'}).join('')+'</div></section>';}
  var all=act.concat(ids.filter(function(u){return !M(u).active}));
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Row team\'s record vs column team</div><h2>Head-to-head grid</h2></div></div><div class="mx-wrap"><table class="mx"><thead><tr><th></th>'+
   all.map(function(u){return '<th class="'+(M(u).active?'':'fm')+'">'+av(u,24)+(M(u).active?'':'<i>Former</i>')+'</th>'}).join('')+'</tr></thead><tbody>'+
   all.map(function(a){return '<tr><th class="'+(M(a).active?'':'fm')+'">'+av(a,24)+(M(a).active?'':'<i>Former</i>')+'</th>'+all.map(function(b){if(a===b)return '<td class="self"></td>';var x=D.h2h[a+'|'+b];if(!x)return '<td class="none">–</td>';
     var c=x.w>x.l?'up':x.w<x.l?'dn':'eq';return '<td class="'+c+'"><button type="button" data-pair="'+a+'|'+b+'">'+x.w+'-'+x.l+'</button></td>'}).join('')+'</tr>'}).join('')+
   '</tbody></table></div><p class="muted" style="font-size:11.5px;margin-top:8px">Tap any cell to load that rivalry. Includes playoff games. Former managers are at the end.</p></section>';
  return h;
}
var AW_ICON={champ:'🏆',sacko:'🚽',points:'👑',topb:'🔥',rotb:'🧊',lucky:'🍀',unlucky:'🐍',pa:'🥊',high:'💥',blow:'🔨',heart:'💔'};
var AW_UNIT={points:['points','points'],topb:['week on top','weeks on top'],rotb:['week at the bottom','weeks at the bottom'],lucky:['extra wins','extra wins'],unlucky:['wins lost','wins lost'],pa:['points against','points against'],high:['points','points'],blow:['won by','won by'],heart:['lost by','lost by']};
function awVal(a){var v=String(a.val),u=AW_UNIT[a.key],n=parseFloat(v.replace(/[^0-9.\-+]/g,''));
  if(a.key==='topb'||a.key==='rotb')v=v.replace(/×/,'');
  if(a.key==='blow'||a.key==='heart')v=v.replace(/^[+-]/,'');
  if(a.key==='lucky'||a.key==='unlucky')v=v.replace(/^[+-]/,'');
  var unit=u?(Math.abs(n)===1?u[0]:u[1]):'';
  return '<span class="aw-vb"><span class="aw-v num">'+esc(v)+'</span>'+(unit?'<small>'+esc(unit)+'</small>':'')+'</span>'}
function awardsView(){
  var s=S.aws;var A=D.awards[s]||[];
  var h='<div class="seg seg4">'+ALLS().map(function(x){return '<button type="button" class="'+(x===s?'on':'')+'" data-aws="'+x+'">'+x+'</button>'}).join('')+'</div>';
  var champ=A.find(function(a){return a.key==='champ'}),sacko=A.find(function(a){return a.key==='sacko'});
  h+='<section class="hero aw-hero"><div class="eyebrow">'+(s===CUR()?'In progress · through Week '+D.league.last_scored:'Final')+'</div><h1>'+s+' awards</h1>'+info('awards');
  if(champ)h+='<div class="podium2"><button type="button" class="p2 gold" data-mgr="'+champ.uid+'"><span class="p2i">🏆</span>'+av(champ.uid,44)+'<b>'+esc(tnS(s,champ.uid))+'</b><small>Champion</small></button>'+(sacko?'<button type="button" class="p2 poo" data-mgr="'+sacko.uid+'"><span class="p2i">🚽</span>'+av(sacko.uid,44)+'<b>'+esc(tnS(s,sacko.uid))+'</b><small>Sacko</small></button>':'')+'</div>';
  else h+='<p class="sub">Leaders change every week until the season ends.</p>';
  h+='</section><section class="panel tight"><div class="rows">'+A.filter(function(a){return a.key!=='champ'&&a.key!=='sacko'}).map(function(a){var gx=a.game?gi(a.game.s,a.game.w,a.game.win):-1;
    return '<button type="button" class="row aw-row" '+(gx>=0?'data-game="'+gx+'"':'data-mgr="'+a.uid+'"')+'><span class="aw-ic">'+(AW_ICON[a.key]||'⭐')+'</span><span class="aw-m"><b>'+esc(a.title)+'</b><span class="aw-tm">'+av(a.uid,18)+esc(tnS(s,a.uid))+'</span><span class="aw-note">'+esc(a.note)+'</span></span>'+awVal(a)+'</button>'}).join('')+'</div></section>';
  h+='<button type="button" class="share-btn wide" data-share-aw="'+s+'">Share '+s+' awards</button>';
  return h;
}
function labView(){
  var cards=[['bench','🪑 Bench Shame','Points each team left on the bench compared with its best possible lineup, every week, plus a season leaderboard.'],
    ['trades','🤝 Trade grader','Every trade, with the points each side got from the players they received after the deal.'],
    ['draft','📋 Draft re-grade','Every pick compared with where its season points rank: the biggest steals and busts.']];
  var h='<section class="hero"><div class="eyebrow">League Lab</div><h1 style="font-size:28px">Deep stats</h1><p class="sub">These read full lineups, transactions and drafts straight from Sleeper.</p></section>';
  if(!LIVE){h+=cards.map(function(c){return '<section class="panel"><h2 style="font-size:19px">'+c[1]+'</h2><p class="muted" style="font-size:13px;margin-top:6px;line-height:1.5">'+c[2]+'</p><p class="lab-off">Turns on when the app is live on Railway</p></section>'}).join('');return h}
  h+='<div class="chips wrap">'+cards.map(function(c){return '<button type="button" class="chip'+(S.lab===c[0]?' on':'')+'" data-lab="'+c[0]+'">'+c[1]+'</button>'}).join('')+'</div>';
  h+='<div class="chips wrap">'+ALLS().map(function(x){return '<button type="button" class="chip'+(x===S.labs?' on':'')+'" data-labs="'+x+'">'+x+'</button>'}).join('')+'</div>';
  h+='<section class="panel" id="labOut"><p class="muted">Loading from Sleeper…</p></section>';
  setTimeout(loadLab,0);
  return h;
}
function loadLab(){
  var el=document.getElementById('labOut');if(!el)return;var key=S.lab+'|'+S.labs;
  fetch('/api/'+S.lab+'?season='+S.labs).then(function(r){return r.json()}).then(function(d){
    if(S.lab+'|'+S.labs!==key)return;el=document.getElementById('labOut');if(!el)return;
    if(d.error){el.innerHTML='<p class="err">'+esc(d.error)+'</p>';return}
    el.innerHTML=S.lab==='bench'?benchHtml(d):S.lab==='trades'?tradesHtml(d):draftHtml(d)}).catch(function(){var e=document.getElementById('labOut');if(e)e.innerHTML='<p class="err">Couldn\'t reach the server.</p>'})
}
function benchHtml(d){
  return '<div class="ph"><div><div class="kicker">'+d.season+' · through Week '+d.through+'</div><h2>Bench Shame</h2></div>'+info('bench')+'</div><div class="rows">'+
   d.teams.map(function(t,i){return '<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto"><span class="rk'+(i===0?' gold':'')+'">'+(i+1)+'</span>'+who(t.user_id,'Worst: '+f1(t.worst.lost)+' left in Wk '+t.worst.week,30)+'<span class="val">'+f1(t.lost)+'<small>pts benched</small></span></div>'}).join('')+'</div>'}
/* ---------- TRADE GRADER v2 (list + full breakdown sheet) ---------- */
var TRD=null;
var SIDE_C=['#b38c14','#3b8fe8','#d9577a']; // validated (dark surface): gold, blue, rose — follow the side, never its rank
var VLBL={big:['Landslide','is running away with it','fleeced them'],clear:['Clear win','is winning','won'],slight:['Slight edge','has a slight edge','won by a little'],even:['Too close to call','',''],pending:['Waiting on games','','']};
function nb(t){return esc(t).replace(/ /g,'&nbsp;')}
function lastN(n){var a=String(n).split(' ');return a.length>1?a.slice(1).join(' '):n}
function sideDot(j){return '<i class="sdot" style="background:'+SIDE_C[j%3]+'"></i>'}
function pickTxt(p){return p.season+' round '+p.round+' pick'+(p.orig?' ('+esc(team(p.orig))+'\'s)':'')}
function verdictTxt(t){var v=t.verdict,L=VLBL[v.label]||VLBL.even,on=t.status==='ongoing';
  if(v.label==='pending')return 'No games played since the trade yet';
  if(v.label==='even')return 'Too close to call';
  return team(v.leader)+' '+(on?L[1]:L[2])}
function tugBar(t){var tot=t.sides.reduce(function(a,s){return a+Math.max(0,s.used)},0);
  return '<div class="tug">'+t.sides.map(function(s,j){var w=tot>0?Math.max(0,s.used)/tot*100:100/t.sides.length;return '<i style="width:'+w+'%;background:'+SIDE_C[j%3]+'"></i>'}).join('')+'</div>'}
function statusTag(t){if(t.status!=='ongoing')return '<span class="ttag">Final</span>';
  return '<span class="ttag on">Ongoing · '+t.verdict.weeks+' wk'+(t.verdict.weeks===1?'':'s')+' in</span>'}
function gotList(s){var out=s.got.map(function(p){return '<span class="pchip">'+nb(p.name)+' <small>'+esc(p.pos)+'</small></span>'});
  s.picks_got.forEach(function(p){out.push('<span class="pchip pick">'+nb(pickTxt(p))+'</span>')});
  if(s.faab_got)out.push('<span class="pchip pick">$'+s.faab_got+'&nbsp;FAAB</span>');
  return out.join('')||'<span class="muted" style="font-size:12px">Nothing</span>'}
function tradesHtml(d){
  TRD=d;
  if(!d.trades.length)return '<div class="ph"><div><div class="kicker">'+d.season+'</div><h2>Trade grader</h2></div>'+info('trades')+'</div><p class="muted" style="margin-top:6px">No trades in '+d.season+'.</p>';
  return '<div class="ph"><div><div class="kicker">'+d.season+' · '+d.trades.length+' trade'+(d.trades.length>1?'s':'')+'</div><h2>Trade grader</h2></div>'+info('trades')+'</div>'+
   '<p class="muted" style="font-size:12px;margin:-4px 0 4px">Tap a trade for the week-by-week breakdown.</p>'+
   d.trades.slice().reverse().map(function(t){var i=d.trades.indexOf(t),v=t.verdict;
    return '<button type="button" class="trd" data-trade="'+i+'"><div class="trd-h"><span>Week '+t.week+'</span>'+statusTag(t)+'</div>'+
     t.sides.map(function(s,j){return '<div class="trd-s"><div class="trd-top">'+sideDot(j)+av(s.user_id,26)+'<b class="trd-tm">'+esc(team(s.user_id))+'</b><span class="trd-n"><small>Pts started</small><b class="num">'+f1(s.used)+'</b></span></div>'+
       '<div class="trd-got"><span class="lbl">Got</span><span class="chips-in">'+gotList(s)+'</span></div></div>'}).join('')+
     tugBar(t)+'<div class="trd-v"><b>'+esc(verdictTxt(t))+'</b>'+(v.label!=='pending'?'<span>'+(v.label==='even'?f1(Math.abs(v.per_week))+' pts/week apart':'+'+f1(v.per_week)+' pts/week · '+v.weeks+' wk'+(v.weeks===1?'':'s'))+'</span>':'')+'</div>'+
     '<div class="trd-more">Full breakdown ›</div></button>'}).join('');
}
function tradeChart(t){
  var n=t.verdict.weeks;if(!n)return '';
  var series=t.sides.map(function(s){var c=0;return s.weeks.map(function(x){c+=x.used;return {w:x.w,v:Math.round(c*10)/10}})});
  var wks=t.sides[0].weeks.map(function(x){return x.w});
  var max=Math.max(10,Math.max.apply(null,series.map(function(se){return se.length?se[se.length-1].v:0})));
  var W=340,H=170,l=34,r=12,tp=12,b=24,iw=W-l-r,ih=H-tp-b;
  var X=function(i){return l+(wks.length===1?iw/2:i*iw/(wks.length-1))},Y=function(v){return tp+ih-v/max*ih};
  var step=max>200?100:max>80?40:max>40?20:10,grid='';
  for(var g=0;g<=max;g+=step)grid+='<line x1="'+l+'" x2="'+(W-r)+'" y1="'+Y(g)+'" y2="'+Y(g)+'" class="cg"/><text x="'+(l-6)+'" y="'+(Y(g)+3.5)+'" class="ct" text-anchor="end">'+g+'</text>';
  var xl=wks.map(function(w,i){return '<text x="'+X(i)+'" y="'+(H-6)+'" class="ct" text-anchor="middle">'+w+'</text>'}).join('');
  var lines=series.map(function(se,j){return '<polyline fill="none" stroke="'+SIDE_C[j%3]+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="'+se.map(function(p,i){return X(i)+','+Y(p.v)}).join(' ')+'"/>'+
    se.map(function(p,i){return '<circle cx="'+X(i)+'" cy="'+Y(p.v)+'" r="4" fill="'+SIDE_C[j%3]+'" stroke="var(--panel)" stroke-width="2"/>'}).join('')}).join('');
  var hits=wks.map(function(w,i){var x0=i===0?l:(X(i-1)+X(i))/2,x1=i===wks.length-1?W-r:(X(i)+X(i+1))/2;return '<rect x="'+x0+'" y="'+tp+'" width="'+(x1-x0)+'" height="'+ih+'" fill="transparent" data-tw="'+i+'"/>'}).join('');
  var legend='<div class="lgd">'+t.sides.map(function(s,j){var last=series[j].length?series[j][series[j].length-1].v:0;return '<span>'+sideDot(j)+esc(team(s.user_id))+' <b class="num">'+f1(last)+'</b></span>'}).join('')+'</div>';
  return '<section class="panel tight"><div class="kicker">Running total · points started from the trade</div>'+legend+
   '<div class="chartbox" data-chart="'+TRD.trades.indexOf(t)+'"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Running total of points started from the trade, by week">'+grid+xl+lines+'<line class="cx" x1="0" x2="0" y1="'+tp+'" y2="'+(tp+ih)+'" style="display:none"/>'+hits+'</svg><div class="ctip" style="display:none"></div></div>'+
   '<p class="muted" style="font-size:11px;margin-top:4px">Tap a week to see that week\'s numbers. Week numbers along the bottom.</p></section>';
}
function chartTip(box,i){var t=TRD.trades[+box.dataset.chart];var tip=box.querySelector('.ctip'),cx=box.querySelector('.cx'),svg=box.querySelector('svg');
  var wks=t.sides[0].weeks;var rect=box.querySelector('[data-tw="'+i+'"]');var xm=(+rect.getAttribute('x'))+(+rect.getAttribute('width'))/2;
  if(i===0)xm=+rect.getAttribute('x');if(i===wks.length-1)xm=(+rect.getAttribute('x'))+(+rect.getAttribute('width'));
  var W=340,l=34,r=12,iw=W-l-r,X=wks.length===1?l+iw/2:l+i*iw/(wks.length-1);cx.setAttribute('x1',X);cx.setAttribute('x2',X);cx.style.display='';
  var run=t.sides.map(function(s){var c=0;for(var k=0;k<=i&&k<s.weeks.length;k++)c+=s.weeks[k].used;return c});
  tip.innerHTML='<b>Week '+wks[i].w+'</b>'+t.sides.map(function(s,j){var x=s.weeks[i]||{used:0};return '<div>'+sideDot(j)+esc(team(s.user_id))+': '+f1(x.used)+' <span class="muted">(total '+f1(run[j])+')</span></div>'}).join('');
  tip.style.display='';var pct=X/W*100;tip.style.left=Math.min(70,Math.max(0,pct-25))+'%'}
function tradeSheet(i){
  var t=TRD.trades[i],v=t.verdict,on=t.status==='ongoing';
  var h='<div class="ph" style="margin:0"><div><div class="kicker" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Week '+t.week+' trade · '+TRD.season+' '+statusTag(t)+'</div>'+
   '<h2 style="font-size:20px">'+t.sides.map(function(s){return esc(team(s.user_id))}).join(' ⇄ ')+'</h2></div></div>';
  // verdict
  h+='<section class="panel tight tv"><div class="kicker">'+(on&&v.weeks<=2&&v.label!=='even'&&v.label!=='pending'?'Early verdict':on?'Verdict so far':'Final verdict')+'</div><h3>'+esc(verdictTxt(t))+'</h3>'+
   (v.label!=='pending'?'<p class="muted" style="font-size:12.5px;margin-top:2px">'+t.sides.map(function(s,j){return sideDot(j)+'<b class="num" style="color:var(--ink)">'+f1(s.used)+'</b>'}).join(' vs ')+' points started · '+(v.label==='even'?f1(Math.abs(v.per_week))+' pts/week apart':'+'+f1(v.per_week)+' pts/week for '+esc(team(v.leader)))+' over '+v.weeks+' week'+(v.weeks===1?'':'s')+'</p>':'')+
   tugBar(t)+'<p class="scale"><span'+(v.label==='even'?' class="on"':'')+'>&lt;3 Too close</span><span'+(v.label==='slight'?' class="on"':'')+'>3–7 Slight edge</span><span'+(v.label==='clear'?' class="on"':'')+'>7–15 Clear win</span><span'+(v.label==='big'?' class="on"':'')+'>15+ Landslide</span></p>'+
   '<p class="muted" style="font-size:11px">Scale = extra points started per week since the trade.'+(on&&t.weeks_left?' '+t.weeks_left+' regular-season week'+(t.weeks_left===1?'':'s')+' left to change it.':'')+'</p></section>';
  // the deal
  h+='<section class="panel tight"><div class="kicker">The deal</div>'+t.sides.map(function(s,j){
    return '<div class="deal"><div class="deal-h">'+sideDot(j)+av(s.user_id,26)+'<b>'+esc(team(s.user_id))+'</b><span class="muted" style="font-size:11.5px">got</span></div>'+
     s.got.map(function(p){var note=p.weeks_on?'Started '+p.starts+' of '+p.weeks_on+' wk'+(p.weeks_on===1?'':'s')+' on the roster':'Hasn\'t played a week for them yet';
       if(p.gone)note+=' · off the roster from Wk '+p.gone;
       return '<div class="dp"><div><b>'+nb(p.name)+'</b> <span class="muted" style="font-size:11.5px">'+esc(p.pos)+(p.nfl?' · '+esc(p.nfl):'')+'</span><span class="dp-sub">'+note+'</span></div><div class="dp-n"><b class="num">'+f1(p.used)+'</b><small>started</small>'+(p.bench?'<span>+'+f1(p.bench)+' bench</span>':'')+'</div></div>'}).join('')+
     s.picks_got.map(function(p){return '<div class="dp"><div><b>'+esc(pickTxt(p))+'</b><span class="dp-sub">Draft pick · not scored yet</span></div></div>'}).join('')+
     (s.faab_got?'<div class="dp"><div><b>$'+s.faab_got+' FAAB</b><span class="dp-sub">Waiver budget</span></div></div>':'')+
     (s.cut.length?'<p class="muted" style="font-size:11.5px;margin-top:4px">Also dropped to make room: '+s.cut.map(function(p){return nb(p.name)}).join(', ')+'</p>':'')+'</div>'}).join('')+'</section>';
  h+=tradeChart(t);
  // week by week
  if(v.weeks){
    h+='<section class="panel tight"><div class="kicker">Week by week</div><p class="muted" style="font-size:11.5px;margin:2px 0 6px">Trade pts = points started from the players they got (bench in gray). Team = their whole score that week.</p>';
    var wks=t.sides[0].weeks;
    for(var k=0;k<wks.length;k++){
      h+='<div class="wkb"><div class="wkb-w">Wk '+wks[k].w+(wks[k].playoff?'<small>playoffs</small>':'')+'</div><div class="wkb-s">'+t.sides.map(function(s,j){var x=s.weeks[k];if(!x)return '';
        var prev=k?s.weeks[k-1].team:s.prev_team,d=prev?x.team-prev:null;
        var pl=s.got.map(function(p){var e=x.each[p.id]||{};return e.s==='start'?nb(lastN(p.name))+' '+f1(e.pts):e.s==='bench'?'<span class="wbn">'+nb(lastN(p.name))+' '+f1(e.pts)+' (bench)</span>':e.s==='gone'?'<span class="wbn">'+nb(lastN(p.name))+' gone</span>':''}).filter(Boolean).join(' · ');
        return '<div class="wkb-r">'+sideDot(j)+'<div style="min-width:0;flex:1"><div class="wkb-l"><b>'+esc(team(s.user_id))+'</b><span class="num">'+f1(x.used)+'</span></div>'+
          '<div class="wkb-sub">'+(pl||'—')+'</div>'+
          '<div class="wkb-sub">Team '+f1(x.team)+(x.result?' <b class="wres '+x.result+'">'+x.result+'</b>'+(x.opp?' vs '+esc(team(x.opp)):''):'')+(x.median?' · median '+x.median:'')+(d!=null?' · <span class="'+(d>=0?'up':'dn')+'">'+(d>=0?'▲':'▼')+f1(Math.abs(d))+' vs last wk</span>':'')+'</div></div></div>'}).join('')+'</div></div>';
    }
    h+='</section>';
  }
  // team impact
  h+='<section class="panel tight"><div class="kicker">Did it help the team?</div><div class="imp">'+t.sides.map(function(s,j){var b=s.before,a=s.after,d=(b.ppg!=null&&a.ppg!=null)?a.ppg-b.ppg:null;
    return '<div class="imp-c"><div class="deal-h">'+sideDot(j)+'<b>'+esc(team(s.user_id))+'</b></div><div class="imp-row"><span>Points/game</span><b class="num">'+(b.ppg!=null?f1(b.ppg):'—')+' → '+(a.ppg!=null?f1(a.ppg):'—')+'</b></div>'+
      (d!=null?'<div class="imp-row"><span>Change</span><b class="'+(d>=0?'up':'dn')+'">'+(d>=0?'+':'')+f1(d)+'</b></div>':'')+
      '<div class="imp-row"><span>Record before</span><b>'+b.rec+'</b></div><div class="imp-row"><span>Record since</span><b>'+a.rec+'</b></div></div>'}).join('')+'</div>'+
   '<p class="muted" style="font-size:11px;margin-top:6px">Regular season only. Records include the league-median game. A team\'s scoring can change for lots of reasons besides the trade.</p></section>';
  // insights
  var ins=tradeInsights(t);
  if(ins.length)h+='<section class="panel tight"><div class="kicker">Insights</div><ul class="ins">'+ins.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul></section>';
  return h+'<div class="info-row">'+info('trades')+'</div>';
}
function tradeInsights(t){
  var out=[],v=t.verdict;if(!v.weeks)return ['No games have been played since this trade yet. Check back after this week.'];
  var best=null;t.sides.forEach(function(s){s.got.forEach(function(p){if(p.best&&(!best||p.best.pts>best.pts))best={p:p,s:s,pts:p.best.pts,w:p.best.w}})});
  if(best)out.push('Best game from the deal: <b>'+nb(best.p.name)+'</b> put up '+f1(best.pts)+' for '+esc(team(best.s.user_id))+' in Week '+best.w+'.');
  t.sides.forEach(function(s){if(s.bench>s.used&&s.bench>=10)out.push(esc(team(s.user_id))+' has left more on the bench ('+f1(s.bench)+') than it started ('+f1(s.used)+') from this trade.');
    s.got.forEach(function(p){if(p.gone)out.push(nb(p.name)+' is already off '+esc(team(s.user_id))+'\'s roster (gone from Week '+p.gone+' on).');
      else if(p.weeks_on>=2&&!p.starts)out.push(esc(team(s.user_id))+' hasn\'t started '+nb(p.name)+' once.')})});
  var ch=t.sides.filter(function(s){return s.before.ppg!=null&&s.after.ppg!=null}).map(function(s){return {s:s,d:s.after.ppg-s.before.ppg}}).sort(function(a,b){return b.d-a.d});
  if(ch.length&&Math.abs(ch[0].d)>=5)out.push(esc(team(ch[0].s.user_id))+' is scoring '+f1(Math.abs(ch[0].d))+' '+(ch[0].d>0?'more':'fewer')+' points a game since the trade.');
  if(t.status==='ongoing'&&v.weeks<=2&&v.label!=='even')out.push('It\'s early: one big week can flip this.');
  return out.slice(0,6);
}

function draftHtml(d){
  var row=function(p,bust){var mv=p.pick_no-p.rank;
    return '<div class="row dr-row"><span class="dr-pk"><small>Rd '+p.round+'</small>#'+p.pick_no+'</span><div style="min-width:0"><b style="font-size:14px">'+nb(p.name)+'</b> <span class="muted" style="font-size:11px">'+esc(p.pos)+'</span>'+
     '<div class="dr-team">'+av(p.user_id,16)+esc(team(p.user_id))+'</div>'+
     '<div class="dr-mv">Drafted <b>#'+p.pick_no+'</b> → finished <b>#'+p.rank+'</b> <span class="'+(mv>=0?'up':'dn')+'">'+(mv>=0?'▲'+mv:'▼'+Math.abs(mv))+(Math.abs(mv)===1?' spot':' spots')+'</span></div></div>'+
     '<span class="aw-vb"><span class="val num" style="font-size:18px">'+f1(p.points)+'</span><small>season pts</small></span></div>'};
  if(!d.steals.length)return '<div class="ph"><div><div class="kicker">'+d.season+' draft</div><h2>Draft re-grade</h2></div>'+info('draft')+'</div><p class="muted">No draft found for '+d.season+'.</p>';
  return '<div class="ph"><div><div class="kicker">'+d.season+' draft</div><h2>Biggest steals</h2></div>'+info('draft')+'</div>'+
   '<p class="muted" style="font-size:12px;margin:-4px 0 6px">Late picks who scored like early ones. "Finished" = where his points rank among every drafted player (no kickers or defenses).</p><div class="rows">'+d.steals.map(function(p){return row(p)}).join('')+'</div>'+
   '<div class="ph" style="margin-top:16px"><div><div class="kicker">'+d.season+' draft</div><h2>Biggest busts</h2></div></div><p class="muted" style="font-size:12px;margin:-4px 0 6px">Early picks whose points ranked furthest below where they went.</p><div class="rows">'+d.busts.map(function(p){return row(p,true)}).join('')+'</div>'}

/* ---------- RECORDS ---------- */
var RECS=[
 ['high','Highest score','team'],['low','Lowest score','team'],['blowout','Biggest blowout','game'],['close','Closest game','game'],
 ['hiloss','Most points in a loss','game'],['lowin','Fewest points in a win','game'],['player','Best player game','player'],
 ['seasonhi','Most points · season','season'],['seasonlo','Fewest points · season','season'],['wstreak','Longest win streak','streak'],['lstreak','Longest losing streak','streak']];
function recType(k){return RECS.find(function(r){return r[0]===k})[2]}
function recList(k){var t=recType(k);if(t==='season'||t==='streak'||S.rf==='all')return D.records[k];return D.recf[S.rf][k]}
function recNum(k,r){return k==='wstreak'||k==='lstreak'?String(r.v).replace(/\s*[WL]$/,''):r.v}
function recUnit(k,r,x){if(k==='wstreak')return 'wins in a row';if(k==='lstreak')return 'losses in a row';
  if(k==='blowout'||k==='close')return 'won by';if(k==='hiloss')return 'pts in a loss';if(k==='lowin')return 'pts in a win';
  if(k==='seasonhi'||k==='seasonlo')return 'season pts';return 'points'}
function recVal(k,x){var t=recType(k);
  if(t==='team')return {u:x.uid,v:f2(x.v),sub:sw(x.s,x.w)};
  if(t==='player')return {u:x.uid,v:f1(x.v),sub:(x.name?x.name+(x.pos?' ('+x.pos+')':''):'Top scorer')+' · '+sw(x.s,x.w)};
  if(t==='season')return {u:x.uid,v:f1(x.v),sub:x.s+' · '+x.rec};
  if(t==='streak')return {u:x.uid,v:x.n+(x.t==='W'?' W':' L'),sub:x.start+' → '+x.end+(x.live?' · active':'')};
  var g=x;var u=(k==='hiloss')?g.lose:g.win;
  var v=k==='blowout'||k==='close'?f2(g.m):k==='hiloss'?f2(g.lp):f2(g.wp);
  return {u:u,v:v,sub:(k==='hiloss'?'lost to ':'beat ')+teamF(k==='hiloss'?g.win:g.lose)+' '+f2(g.wp)+'–'+f2(g.lp)+' · '+sw(g.s,g.w)+(g.k!=='Regular season'?' · '+g.k:'')};
}
function byeKey(k,x){var t=recType(k);if((t==='team'||t==='player')&&D.tw[x.s+'|'+x.w+'|'+x.uid])return x.s+'|'+x.w+'|'+x.uid;return null}
function recGame(k,x){var t=recType(k);
  if(t==='team'||t==='player')return gi(x.s,x.w,x.uid);
  if(t==='game')return gi(x.s,x.w,x.win);return -1}
function records(){
  var k=S.rec,list=recList(k),t=recType(k),name=RECS.find(function(r){return r[0]===k})[1];
  var h='<button type="button" class="picker" data-recpick="1"><span><small>Record</small><b>'+name+'</b></span><i>Change ▾</i></button>';
  if(t!=='season'&&t!=='streak')h+='<div class="seg">'+[['all','All games'],['reg','Regular'],['post','Playoffs']].map(function(x){return '<button type="button" class="'+(S.rf===x[0]?'on':'')+'" data-rf="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
  if(!list.length)return h+'<p class="muted">No games yet.</p>'+foot();
  var top=recVal(k,list[0]),g0=recGame(k,list[0]),b0=g0<0?byeKey(k,list[0]):null;
  h+='<section class="hero rec-hero"><div class="eyebrow">All-time #1</div><div class="big">'+esc(recNum(k,top))+'</div><div class="rec-unit">'+esc(recUnit(k,top,list[0]))+'</div>'+
   '<button class="holder who" type="button" '+(g0>=0?'data-game="'+g0+'"':b0?'data-bye="'+b0+'"':'data-mgr="'+top.u+'"')+'>'+av(top.u,36)+'<span class="tx"><b>'+esc(team(top.u))+(list[0].s===CUR()?'<span class="new">THIS SEASON</span>':'')+'</b><span>'+esc(top.sub)+'</span></span></button>'+
   '<button type="button" class="share-btn" data-share-rec="1">Share</button>'+info('records')+'</section>';
  h+='<section class="panel tight rec-list"><div class="rows">'+
   list.slice(1,S.recMore?10:5).map(function(x,j){var i=j+1,r=recVal(k,x),gx=recGame(k,x),by=gx<0?byeKey(k,x):null,tap=gx>=0||by,inner='<span class="rk">'+(i+1)+'</span>'+(tap?whoS(r.u,r.sub+(by?' · playoff bye':''),28):who(r.u,r.sub,28))+'<span class="aw-vb"><span class="val">'+esc(recNum(k,r))+'</span><small>'+esc(recUnit(k,r,x))+'</small></span>';
     return tap?'<button type="button" class="row" '+(gx>=0?'data-game="'+gx+'"':'data-bye="'+by+'"')+' style="grid-template-columns:24px minmax(0,1fr) auto 10px">'+inner+CHEV+'</button>':'<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto">'+inner+'</div>'}).join('')+
   '</div>'+(list.length>5?'<button type="button" class="more" data-more="rec">'+(S.recMore?'Show top 5':'Show top '+list.length)+'</button>':'')+'</section>'+foot();
  return h;
}
function recPickSheet(){
  var groups=[['Team scores',['high','low','seasonhi','seasonlo']],['Games',['blowout','close','hiloss','lowin']],['Players & streaks',['player','wstreak','lstreak']]];
  return '<div class="ph" style="margin:0"><div><div class="kicker">Record book</div><h2>Pick a record</h2></div></div>'+groups.map(function(g){return '<div class="kicker" style="margin-top:4px">'+g[0]+'</div><div class="pick-grid">'+g[1].map(function(k){var r=RECS.find(function(x){return x[0]===k});return '<button type="button" class="pk'+(k===S.rec?' on':'')+'" data-rec="'+k+'">'+r[1]+'</button>'}).join('')+'</div>'}).join('');
}

/* ---------- SPORTSBOOK (live, v1.8): talks to /api/book ---------- */
var BK={on:null,status:null,wk:null,me:null,lb:null,feed:null,teams:null,err:null};
var AUTH=store('auth')||null;
function api(path,opt){opt=opt||{};var h={accept:'application/json'};if(opt.body)h['content-type']='application/json';if(AUTH&&AUTH.token)h.authorization='Bearer '+AUTH.token;
  return fetch('/api/book'+path,{method:opt.method||(opt.body?'POST':'GET'),headers:h,body:opt.body?JSON.stringify(opt.body):undefined,cache:'no-store'})
   .then(function(r){return r.json().catch(function(){return {}}).then(function(j){
     if(r.status===401&&AUTH&&path!=='/login'){AUTH=null;store('auth',null);BK.me=null}
     if(!r.ok)throw new Error(j.error||('Something went wrong ('+r.status+')'));return j})})}
var bookBusy=false;
var bookAt=0;
function bookLoad(){
  if(!LIVE||bookBusy)return Promise.resolve();bookBusy=true;bookAt=Date.now();
  return api('/status').then(function(s){BK.on=true;BK.status=s;BK.err=null;
    return Promise.all([api('/lines').then(function(w){BK.wk=w}),api('/leaderboard').then(function(x){BK.lb=x}),api('/feed?limit=40').then(function(x){BK.feed=x}),
      AUTH?api('/me').then(function(m){BK.me=m;if(S.me!==m.user_id){S.me=m.user_id;store('me',S.me);S.h2a=S.me}}).catch(function(){}):null])})
   .then(function(){if(BK.me)rememberBets(BK.me.bets);rememberBets(BK.feed);S.picks=S.picks.filter(function(p){var l=bl(p.line);return l&&!isLk(l)&&legOdds(p)!=null});bookBusy=false;render()})
   .catch(function(e){bookBusy=false;BK.on=false;BK.err=e.message;render()})}
// Live games refresh every 30 s on the Book tab; otherwise once a minute.
setInterval(function(){if(document.visibilityState!=='visible'||(S.tab!=='book'&&S.tab!=='me'))return;var live=BK.wk&&BK.wk.lines&&BK.wk.lines.some(function(l){return l.live&&!l.finished});
  if(live||Date.now()-bookAt>55000)bookLoad()},30000);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')bookLoad()});

function bl(id){return BK.wk&&BK.wk.lines?BK.wk.lines.find(function(l){return l.id===id}):null}
function BS(){return (BK.status&&BK.status.settings)||{min_bet:10,max_bet:250,parlay_max_legs:4,parlay_max_payout:10000,grant:1000}}
function a2d(o){return o>0?1+o/100:1+100/Math.abs(o)}
function d2a(d){return d>=2?Math.round((d-1)*100):-Math.round(100/(d-1))}
function propOf(p){var l=bl(p.line);return l&&l.props?l.props.find(function(x){return x.pid===p.pid}):null}
function legOdds(p){var l=bl(p.line);if(!l)return null;if(p.mkt==='prop'){var pr=propOf(p);return pr?(p.side==='over'?pr.over:pr.under):null}return p.mkt==='ml'?(p.side==='a'?l.ml_a:l.ml_b):p.mkt==='spread'?l.spread_price:l.total_price}
function legPoint(p){var l=bl(p.line);if(!l)return null;if(p.mkt==='prop'){var pr=propOf(p);return pr?pr.line:null}return p.mkt==='spread'?(p.side==='a'?-l.spread:l.spread):p.mkt==='total'?l.total:null}
function legLabel(p){var l=bl(p.line);if(!l)return '?';if(p.mkt==='prop'){var pr=propOf(p);return (pr?pr.name:'Player')+' '+(p.side==='over'?'over ':'under ')+(pr?f1(pr.line):'')+' pts'}
  if(p.mkt==='ml')return team(p.side==='a'?l.a:l.b)+' to win';if(p.mkt==='spread')return team(p.side==='a'?l.a:l.b)+' '+spr(legPoint(p));return (p.side==='over'?'Over ':'Under ')+f1(l.total)+' total'}
function legKind(p){return p.mkt==='prop'?'Player prop':p.mkt==='ml'?'Moneyline':p.mkt==='spread'?'Spread':'Total'}
function pkey(p){return p.line+'|'+p.mkt+'|'+p.side+'|'+(p.pid||'')}
function bank(){return BK.me?BK.me.balance:0}
function money2(n){return Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2})}
function m2(n){return Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function whenTxt(iso){return new Date(iso).toLocaleString('en-US',{weekday:'short',hour:'numeric',minute:'2-digit'})}
function lockTxt(l){if(l.status==='final')return 'Final';if(l.status==='void')return 'Off the board';if(l.finished)return 'Games over · waiting on final';
  if(l.live)return 'Live'+(l.left!=null?' · '+l.left+'% left':'');
  var ms=l.lock_at?new Date(l.lock_at)-Date.now():null;if(ms==null)return 'Pregame';if(ms<=0)return 'Going live';
  if(ms<36e5)return 'Live in '+Math.max(1,Math.round(ms/6e4))+' min';if(ms<864e5)return 'Live in '+Math.floor(ms/36e5)+'h '+Math.round(ms%36e5/6e4)+'m';return whenTxt(l.lock_at)}
function isLk(l){return l.status!=='open'||!!l.finished}
function blocked(l,mkt,side,pid){var me=AUTH&&AUTH.user_id;if(!me)return false;
  if(mkt==='prop'){var pr=l.props&&l.props.find(function(x){return x.pid===pid});return !!pr&&pr.owner===me&&side==='under'}
  if(l.a!==me&&l.b!==me)return false;var mine=l.a===me?'a':'b';if(mkt==='total')return side==='under';return side!==mine}
function picked(id,mkt,side,pid){return S.picks.some(function(p){return p.line===id&&p.mkt===mkt&&p.side===side&&(p.pid||'')===(pid||'')})}
function obk(l,mkt,side,label,sub,fav,pid){var off=mkt==='ml'&&(side==='a'?l.ml_a:l.ml_b)==null;if(off){label='Off';fav=false}
  var dis=isLk(l)||off||blocked(l,mkt,side,pid);
  return '<button type="button" class="ob'+(fav?' fav':'')+(picked(l.id,mkt,side,pid)?' sel':'')+'" data-bk="'+l.id+'|'+mkt+'|'+side+(pid?'|'+pid:'')+'"'+(dis?' disabled':'')+(blocked(l,mkt,side,pid)?' title="You can\'t bet against yourself"':'')+'>'+esc(label)+(sub!=null?'<small>'+odds(sub)+'</small>':'')+'</button>'}
function projShown(l,s){var e=s==='a'?l.exp_a:l.exp_b,n=s==='a'?l.now_a:l.now_b,f=s==='a'?l.proj_a:l.proj_b;return l.live&&e!=null?e:n!=null?n:f}
function gRow(l,s){var u=s==='a'?l.a:l.b,sp=s==='a'?-l.spread:l.spread,ml=s==='a'?l.ml_a:l.ml_b,sc=s==='a'?l.score_a:l.score_b,out=s==='a'?l.out_a:l.out_b;
  var sub=(sc!=null&&(l.live||l.status!=='open')?'<b class="gc-sc">'+f2(sc)+'</b> · ':'')+'proj '+f1(projShown(l,s))+(out&&out.length?' · '+out.length+' empty':'');
  return '<div class="gc-row"><button class="who gc-who" type="button" data-mgr="'+u+'">'+av(u,26)+'<span class="tx"><b>'+esc(team(u))+'</b><span>'+sub+'</span></span></button>'+
   obk(l,'spread',s,spr(sp),l.spread_price,sp<0)+obk(l,'total',s==='a'?'over':'under',(s==='a'?'O ':'U ')+f1(l.total),l.total_price)+obk(l,'ml',s,odds(ml),null,sp<0)+'</div>'}
function gameCard(l){var on=l.live&&!l.finished&&l.status==='open',hid='w'+BK.wk.week+'m'+l.matchup_id;
  var sc=l.score_a!=null&&(l.score_a||l.score_b)?'<span class="num">'+f2(l.score_a)+' – '+f2(l.score_b)+'</span>':(line(hid)?'<button type="button" class="prev-link" data-prev="'+hid+'">Preview ›</button>':'');
  var np=(l.props||[]).length;
  return '<div class="gcard'+(l.status==='void'?' void':'')+'"><div class="gc-h"><span class="'+(on?'live':'')+'">'+(on?'<i></i>':'')+esc(lockTxt(l))+'</span>'+sc+'</div>'+
   (on&&l.left!=null?'<div class="gc-prog"><i style="width:'+(100-l.left)+'%"></i></div>':'')+
   '<div class="gc-cols"><span></span><span>Spread</span><span>Total</span><span>Money</span></div>'+gRow(l,'a')+gRow(l,'b')+
   '<div class="gc-f">'+(l.live&&l.open?'<span>Opened '+esc(team(l.a).split(' ')[0])+' '+spr(-l.open.spread)+' · '+f1(l.open.total)+'</span>':'<span>'+(l.bets?l.bets+' bet'+(l.bets>1?'s':'')+' placed':'')+'</span>')+
   (np&&l.status==='open'?'<button type="button" class="gc-props" data-props="'+l.id+'">Player props ('+np+') ›</button>':'')+'</div>'+
   (l.note?'<p class="mu-note">'+esc(l.note)+'</p>':'')+'</div>'}
function propsView(){var W=BK.wk;if(!W||!W.lines||!W.lines.length)return '<section class="panel"><p class="muted">Props show up once the week\'s lines post.</p></section>';
  var open=W.lines.filter(function(l){return l.status==='open'&&(l.props||[]).length});
  if(!open.length)return '<section class="panel"><p class="muted">No player props on the board right now.</p></section>';
  var me=AUTH&&AUTH.user_id;if(!S.propLine||!open.some(function(l){return l.id===S.propLine}))S.propLine=(open.find(function(l){return l.a===me||l.b===me})||open[0]).id;
  var l=bl(S.propLine);
  var h='<label class="fld"><span>Matchup</span><select id="propSel">'+open.map(function(x){return '<option value="'+x.id+'"'+(x.id===S.propLine?' selected':'')+'>'+esc(team(x.a))+' vs '+esc(team(x.b))+'</option>'}).join('')+'</select></label>';
  h+='<p class="muted" style="font-size:11.5px;margin:2px 2px 0">Over/under on one player\'s fantasy points this week (your league\'s scoring). Lines come from Sleeper\'s projections and move live during his game.</p>';
  ['a','b'].forEach(function(s){var u=s==='a'?l.a:l.b,ps=l.props.filter(function(p){return p.side===s});if(!ps.length)return;
    h+='<section class="panel tight"><div class="pr-h">'+av(u,22)+'<b>'+esc(team(u))+'</b><span>'+ps.length+' props</span></div>'+
     ps.map(function(p){return '<div class="pr-row"><div style="min-width:0"><b>'+nb(p.name)+'</b> <small class="muted">'+esc(p.pos)+(p.nfl?' · '+esc(p.nfl):'')+'</small><div class="pr-sub">'+(p.live?'<span class="live"><i></i>'+f1(p.pts)+' pts so far</span>':'proj '+f1(p.proj)+(p.kick?' · '+whenTxt(p.kick):''))+'</div></div>'+
       obk(l,'prop','over','O '+f1(p.line),p.over,false,p.pid)+obk(l,'prop','under','U '+f1(p.line),p.under,false,p.pid)+'</div>'}).join('')+'</section>'});
  return h}
function bookHero(){
  if(AUTH&&BK.me){var open=BK.me.bets.filter(function(b){return b.status==='open'});
    return '<section class="hero bk-hero"><div class="eyebrow">Mahomie\'s Sportsbook · '+esc(team(BK.me.user_id))+'</div><div class="bank">💵 '+money2(BK.me.balance)+'</div><p class="sub" style="margin-top:6px">Mahomie Bucks to bet · '+open.length+' open bet'+(open.length===1?'':'s')+(open.length?' ('+money2(BK.me.in_play)+' in play)':'')+'</p></section>'}
  return '<section class="hero bk-hero"><div class="eyebrow">Mahomie\'s Sportsbook</div><h1 style="margin-top:6px">Bet with Mahomie Bucks</h1><p class="sub">Every manager gets '+money(BS().grant)+' Bucks for the season. No refills. Play money only.</p>'+
   (BK.on?'<button type="button" class="cta" data-login="1" style="margin-top:12px">Log in to bet</button>':'')+'</section>'}
function bookOff(){return '<section class="panel"><div class="ph"><div><div class="kicker">Sportsbook</div><h2>'+(LIVE?'The Book is offline':'Open the live app')+'</h2></div></div><p class="muted" style="font-size:13px;line-height:1.5">'+
  (LIVE?esc(BK.err||'The Book couldn\'t load.')+' Try again in a minute.':'Betting only works in the live app on Railway.')+'</p>'+(LIVE?'<button type="button" class="ghost" data-bkreload="1" style="margin-top:10px">Try again</button>':'')+'</section>'}
/* tickets */
var TK={};
function rememberBets(list){(list||[]).forEach(function(b){TK[b.id]=b})}
function tktNo(id){return String(id).padStart(6,'0')}
function tStatus(b){var lk=b.legs.some(function(g){return g.started||g.locked});return b.status==='open'?(lk?'live':'open'):b.status}
function stub(b,mine){var st=tStatus(b);rememberBets([b]);
  return '<button type="button" class="stub" data-tkt="'+b.id+'"><div class="stub-l"><div class="stub-k">'+(mine?'':esc(team(b.user_id))+' · ')+(b.kind==='parlay'?b.legs.length+'-leg parlay':'Straight')+' · Wk '+b.week+'</div>'+
   b.legs.map(function(g){return '<div class="stub-leg">'+(b.legs.length>1?'<i class="lg lg-'+g.result+'"></i>':'')+esc(g.label)+(g.market==='total'?' <small>('+esc(team(g.a))+' vs '+esc(team(g.b))+')</small>':'')+(g.live?' <span class="lv">LIVE</span>':'')+'</div>'}).join('')+
   '<div class="stub-m">'+odds(b.odds)+' · risk '+money2(b.stake)+' · '+(b.status==='won'?'won '+money2(b.payout-b.stake):b.status==='lost'?'lost':b.status==='push'||b.status==='void'?'stake back':'to win '+money2(b.to_win))+'</div></div>'+
   '<div class="stub-r"><span class="stamp s-'+st+'">'+st+'</span><small>#'+tktNo(b.id)+'</small></div></button>'}
function barcode(id){var s=String(id)+'MH',h='';for(var i=0;i<34;i++){var c=s.charCodeAt(i%s.length)*(i+7);h+='<i style="width:'+(1+c%3)+'px;margin-right:'+(1+(c>>2)%3)+'px"></i>'}return '<div class="bcode">'+h+'</div>'}
function ticketHtml(b){var st=tStatus(b),mgr=M(b.user_id).name;
  return '<div class="tkt"><div class="tkt-top"><img src="/brand-96.png" alt="" width="44" height="44"><div><b>MAHOMIE\'S SPORTSBOOK</b><small>Rollin\' with Mahomies · Week '+b.week+'</small></div></div>'+
   '<div class="tkt-dash"></div><div class="tkt-meta"><span>TICKET #'+tktNo(b.id)+'</span><span>'+esc(new Date(b.placed_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+'</span></div>'+
   '<div class="tkt-who">BETTOR: <b>'+esc(team(b.user_id))+'</b>'+(mgr?' ('+esc(mgr)+')':'')+'</div>'+
   '<div class="tkt-type">'+(b.kind==='parlay'?b.legs.length+'-LEG PARLAY':'STRAIGHT BET')+' · '+odds(b.odds)+'</div><div class="tkt-dash"></div>'+
   b.legs.map(function(g){return '<div class="tkt-leg"><div><b>'+esc(g.label)+'</b><small>'+esc(team(g.a))+' vs '+esc(team(g.b))+(g.live?' · LIVE':'')+'</small></div><span>'+odds(g.odds)+(g.result&&g.result!=='open'?'<em class="r-'+g.result+'">'+g.result.toUpperCase()+'</em>':'')+'</span></div>'}).join('')+
   '<div class="tkt-dash"></div><div class="tkt-tot"><div><small>RISK</small><b>'+m2(b.stake)+'</b></div><div><small>'+(b.status==='won'?'WON':'TO WIN')+'</small><b>'+m2(b.status==='won'?b.payout-b.stake:b.to_win)+'</b></div><div><small>PAYOUT</small><b>'+m2(b.status==='lost'?0:b.payout!=null?b.payout:b.stake+b.to_win)+'</b></div></div>'+
   '<div class="tkt-stamp s-'+st+'">'+st.toUpperCase()+'</div>'+barcode(b.id)+'<div class="tkt-fine">#'+tktNo(b.id)+' · MAHOMIE BUCKS · NO CASH VALUE</div></div>'}
function ticketSheet(ids,title){var bs=ids.map(function(i){return TK[i]}).filter(Boolean);if(!bs.length)return '<p class="muted">Ticket not found.</p>'+CLOSE;
  return (title?'<div class="ph" style="margin:0"><div><div class="kicker">'+(bs.length>1?bs.length+' tickets':'Your ticket')+'</div><h2>'+esc(title)+'</h2></div></div>':'')+bs.map(ticketHtml).join('')+
   bs.map(function(b){return (AUTH&&b.user_id===AUTH.user_id&&b.status==='open'&&!b.legs.some(function(g){return g.started||g.locked})?'<button type="button" class="ghost" data-bcancel="'+b.id+'" style="color:var(--loss);border-color:var(--loss)">Cancel ticket #'+tktNo(b.id)+'</button>':'')}).join('')+
   '<button type="button" class="share-btn wide" data-tshare="'+bs.map(function(b){return b.id}).join(',')+'">Share '+(bs.length>1?'tickets':'ticket')+'</button>'+CLOSE}
function ticketPng(b){var W=720,legH=96,H=640+b.legs.length*legH,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
  var mono='"IBM Plex Mono",monospace',disp='"Chakra Petch",sans-serif';
  x.fillStyle='#130f1d';x.fillRect(0,0,W,H);
  var px=40,pw=W-80;x.fillStyle='#f6f1e4';x.beginPath();x.moveTo(px,30);for(var i=0;i<=pw;i+=20)x.lineTo(px+i,30+(i/20%2?10:0));x.lineTo(px+pw,H-30);for(i=pw;i>=0;i-=20)x.lineTo(px+i,H-30-(i/20%2?10:0));x.closePath();x.fill();
  var y=80,ink='#1a1405',mut='#6b6250';var fit=function(t,w){t=String(t);if(x.measureText(t).width<=w)return t;while(t.length>1&&x.measureText(t+'…').width>w)t=t.slice(0,-1);return t+'…'};
  return new Promise(function(res){var img=new Image();img.onload=img.onerror=function(){try{x.drawImage(img,px+30,y-14,76,76)}catch(e){}
    x.fillStyle=ink;x.font='700 34px '+disp;x.fillText("MAHOMIE'S SPORTSBOOK",px+124,y+18);x.fillStyle=mut;x.font='500 19px '+mono;x.fillText("ROLLIN' WITH MAHOMIES · WEEK "+b.week,px+124,y+50);
    y+=100;var dash=function(){x.strokeStyle='#b9ae95';x.setLineDash([8,6]);x.beginPath();x.moveTo(px+24,y);x.lineTo(px+pw-24,y);x.stroke();x.setLineDash([]);y+=34};dash();
    x.fillStyle=ink;x.font='600 20px '+mono;x.fillText('TICKET #'+tktNo(b.id),px+30,y);x.textAlign='right';x.fillText(new Date(b.placed_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),px+pw-30,y);x.textAlign='left';y+=38;
    x.font='600 22px '+mono;x.fillText(fit('BETTOR: '+team(b.user_id)+(M(b.user_id).name?' ('+M(b.user_id).name+')':''),pw-60),px+30,y);y+=36;x.fillStyle=mut;x.font='500 20px '+mono;x.fillText((b.kind==='parlay'?b.legs.length+'-LEG PARLAY':'STRAIGHT BET')+' · '+odds(b.odds),px+30,y);y+=26;dash();
    b.legs.forEach(function(g){x.fillStyle=ink;x.font='700 24px '+mono;x.fillText(fit(g.label,pw-170),px+30,y);x.textAlign='right';x.fillText(odds(g.odds),px+pw-30,y);x.textAlign='left';x.fillStyle=mut;x.font='500 18px '+mono;x.fillText(fit(team(g.a)+' vs '+team(g.b),pw-60),px+30,y+30);y+=legH});
    y-=20;dash();var tot=[['RISK',m2(b.stake)],[b.status==='won'?'WON':'TO WIN',m2(b.status==='won'?b.payout-b.stake:b.to_win)],['PAYOUT',m2(b.status==='lost'?0:b.payout!=null?b.payout:b.stake+b.to_win)]];
    tot.forEach(function(t,i){var cx=px+30+i*(pw-60)/3;x.fillStyle=mut;x.font='500 18px '+mono;x.fillText(t[0],cx,y);x.fillStyle=ink;x.font='700 30px '+mono;x.fillText(t[1],cx,y+38)});y+=80;
    var st=tStatus(b).toUpperCase();x.save();x.translate(px+pw-120,y+58);x.rotate(-0.12);x.strokeStyle=st==='WON'||st==='LIVE'?'#1b8a3c':st==='LOST'?'#c0392b':'#2a5bd7';x.fillStyle=x.strokeStyle;x.lineWidth=4;x.strokeRect(-80,-34,160,52);x.font='700 30px '+mono;x.textAlign='center';x.fillText(st,0,4);x.restore();
    var bx=px+30;for(var k=0;k<60;k++){var cc=String(b.id+'MH').charCodeAt(k%String(b.id+'MH').length)*(k+7),bw=2+cc%4;x.fillStyle=ink;x.fillRect(bx,y+20,bw,70);bx+=bw+2+(cc>>2)%3;if(bx>px+pw-200)break}
    x.fillStyle=mut;x.font='500 16px '+mono;x.fillText('#'+tktNo(b.id)+' · MAHOMIE BUCKS · NO CASH VALUE',px+30,y+120);res(c.toDataURL('image/png'))};img.src='/brand-96.png'})}
function shareTickets(ids){var bs=ids.map(function(i){return TK[i]}).filter(Boolean);if(!bs.length)return;
  Promise.all(bs.map(ticketPng)).then(function(urls){openSheet('<div class="ph" style="margin:0"><div><div class="kicker">Share</div><h2>Ready for the league chat</h2></div></div>'+urls.map(function(u){return '<img class="share-img" src="'+u+'" alt="Bet ticket">'}).join('')+'<p class="muted" style="font-size:12.5px;text-align:center">Press and hold to save or share.</p>'+CLOSE)})}
function book(){
  if(S.bseg==='how')S.bseg='lines';
  var h=bookHero();
  h+='<div class="seg">'+[['lines','Games'],['props','Props'],['mine','My bets'],['leaders','Leaders']].map(function(x){return '<button type="button" class="'+(S.bseg===x[0]?'on':'')+'" data-bseg="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
  if(!BK.on)return h+(BK.on===null&&LIVE?'<p class="muted" style="padding:16px 4px">Loading the Book…</p>':bookOff())+foot();
  var W=BK.wk;
  if(S.bseg==='lines'){
    if(!W||!W.week||!W.lines.length){var nx=BK.status&&BK.status.next;
      h+='<section class="panel"><div class="ph"><div><div class="kicker">Week '+(nx?nx.week:D.league.week)+'</div><h2>Lines aren\'t up yet</h2></div></div><p class="muted" style="font-size:13px;line-height:1.5">'+(nx&&nx.posts_label?'They post <b style="color:var(--gold)">'+esc(nx.posts_label)+'</b> (Pacific).':'They post Tuesday at 6 AM Pacific.')+' Once a game starts, its odds go live.</p></section>';
    } else {
      h+='<div class="bk-sub"><span>Week '+W.week+(W.settled_at?' · settled':W.settle_at?' · settles '+whenTxt(W.settle_at):'')+'</span>'+info('book')+'</div>';
      h+=W.lines.map(gameCard).join('');
      h+='<div class="info-row">'+info('book')+'</div>';
      if(!AUTH)h+='<p class="note"><b>Look around all you want.</b> Log in with your team and PIN to place bets.</p>';
    }
  }
  if(S.bseg==='props')h+=propsView();
  if(S.bseg==='mine'){
    if(!AUTH||!BK.me)h+='<section class="panel"><p class="muted" style="font-size:13px">Log in to see your bets.</p><button type="button" class="cta" data-login="1" style="margin-top:10px">Log in</button></section>';
    else{var bets=BK.me.bets.filter(function(b){return b.status!=='cancelled'}),open=bets.filter(function(b){return b.status==='open'}),done=bets.filter(function(b){return b.status!=='open'});
      var w=done.filter(function(b){return b.status==='won'}).length,lo=done.filter(function(b){return b.status==='lost'}).length,pr=done.reduce(function(x,b){return x+(b.payout||0)-b.stake},0);
      h+='<section class="panel"><div class="stat3"><div class="stat"><small>Record</small><strong>'+w+'-'+lo+'</strong><span>W-L</span></div><div class="stat"><small>Profit</small><strong'+(pr<0?' style="color:var(--loss)"':'')+'>'+(pr>0?'+':'')+money(pr)+'</strong><span>settled bets</span></div><div class="stat"><small>In play</small><strong>'+money(BK.me.in_play)+'</strong><span>Bucks</span></div></div></section>';
      h+='<section class="panel tight"><div class="kicker">Open tickets · tap to view</div>'+(open.length?open.map(function(b){return stub(b,true)}).join(''):'<p class="muted" style="margin-top:6px">No open bets. Tap any price on Games or Props.</p>')+'</section>';
      if(done.length)h+='<section class="panel tight"><div class="kicker">Settled</div>'+done.map(function(b){return stub(b,true)}).join('')+'</section>';
    }
  }
  if(S.bseg==='leaders'){
    var lb=BK.lb||[];
    if(BK.me&&BK.me.commish)h+='<button type="button" class="cta" data-adm="bucks" style="margin:0 0 10px">💵 Commish: add or take away Bucks</button>';
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Bucks + open bets</div><h2>Leaderboard</h2></div></div><div class="rows">'+
     lb.map(function(x){return '<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto"><span class="rk'+(x.rank===1&&x.joined?' gold':'')+'">'+x.rank+'</span>'+who(x.user_id,x.joined?x.record+(x.in_play?' · '+money(x.in_play)+' in play':''):'Hasn\'t logged in yet',30)+'<span class="val">💵 '+money(x.bankroll)+'</span></div>'}).join('')+'</div></section>';
    var fd=BK.feed||[];
    h+='<section class="panel tight"><div class="kicker">Bet feed · tap a ticket</div>'+(fd.length?fd.map(function(b){return stub(b,false)}).join(''):'<p class="muted">Bets show up here as people place them.</p>')+'</section>';
  }
  if(S.picks.length)h+='<div style="height:60px"></div><button type="button" class="slipbar" data-slip="1"><span>Bet slip · '+S.picks.length+' pick'+(S.picks.length>1?'s':'')+'</span><b>Open ›</b></button>';
  return h+foot();
}

/* bet slip: Singles / Parlay → Review → Confirm → Ticket */
function parlayOk(){if(S.picks.length<2)return 'Pick at least 2 to make a parlay.';if(S.picks.length>BS().parlay_max_legs)return 'Parlays max out at '+BS().parlay_max_legs+' picks.';
  var seen={};for(var i=0;i<S.picks.length;i++){if(seen[S.picks[i].line])return 'A parlay can use only one pick per fantasy matchup. Remove a pick from '+esc(team(bl(S.picks[i].line).a))+' vs '+esc(team(bl(S.picks[i].line).b))+'.';seen[S.picks[i].line]=1}
  if(S.picks.some(function(p){return legOdds(p)==null}))return 'One of these picks is off the board.';return ''}
function slipDec(){return S.picks.reduce(function(x,p){return x*a2d(legOdds(p))},1)}
function parlayWin(st){return Math.min(st*slipDec(),BS().parlay_max_payout)-st}
function singleWin(p,st){var o=legOdds(p);return o==null?0:st*a2d(o)-st}
function slipBets(){var st=S.stake;if(S.slipMode==='parlay')return [{legs:S.picks.slice(),stake:st,odds:d2a(slipDec()),win:parlayWin(st)}];
  return S.picks.map(function(p){return {legs:[p],stake:st,odds:legOdds(p),win:singleWin(p,st)}})}
function slipProblem(){var s=BS(),st=S.stake;if(!(st>=s.min_bet&&st<=s.max_bet&&Math.round(st)===st))return 'Bets are '+s.min_bet+' to '+s.max_bet+' Mahomie Bucks each.';
  if(S.slipMode==='parlay'){var e=parlayOk();if(e)return e}
  var risk=slipBets().reduce(function(x,b){return x+b.stake},0);if(AUTH&&BK.me&&risk>bank())return 'Not enough Mahomie Bucks: this slip risks '+money2(risk)+' and you have '+money2(bank())+'.';return ''}
function legRow(p,i,edit){var l=bl(p.line),o=legOdds(p);
  return '<div class="leg"><div><b>'+esc(legLabel(p))+'</b><span>'+legKind(p)+' · '+esc(team(l.a))+' vs '+esc(team(l.b))+(l.live?' · LIVE':'')+'</span></div><div class="leg-r"><b class="num">'+(o==null?'Off':odds(o))+'</b>'+(edit?'<button type="button" class="x" data-unpick="'+i+'" aria-label="Remove">✕</button>':'')+'</div></div>'}
function slipHtml(){
  var n=S.picks.length,s=BS();if(!n)return '<p class="muted">Your slip is empty.</p>'+CLOSE;
  if(n<2)S.slipMode='single';
  if(S.review)return reviewHtml();
  var pe=n>=2?parlayOk():'x';
  var h='<div class="ph" style="margin:0"><div><div class="kicker">Bet slip</div><h2 style="font-size:20px">'+n+' pick'+(n>1?'s':'')+'</h2></div></div>';
  h+='<div class="seg"><button type="button" class="'+(S.slipMode!=='parlay'?'on':'')+'" data-smode="single">Singles ('+n+')</button><button type="button" class="'+(S.slipMode==='parlay'?'on':'')+'" data-smode="parlay"'+(n<2?' disabled':'')+'>Parlay'+(n>=2&&!pe?' '+odds(d2a(slipDec())):'')+'</button></div>';
  if(S.slipMode==='parlay'&&pe)h+='<p class="err">'+pe+'</p>';
  h+='<div class="legs">'+S.picks.map(function(p,i){return legRow(p,i,true)}).join('')+'</div>';
  if(S.slipMode==='parlay'&&!pe)h+='<div class="pl-odds"><span>Parlay odds</span><b class="num">'+odds(d2a(slipDec()))+'</b></div>';
  h+='<p class="muted" style="font-size:11.5px">'+(S.slipMode==='parlay'?'One bet: every pick has to win. Pays up to '+money(s.parlay_max_payout)+' back.':n>1?'Each pick is its own bet at the amount below.':'Tap prices in other games to add more picks, then switch to Parlay.')+'</p>';
  h+='<div class="stake"><input id="stake" type="number" inputmode="numeric" min="'+s.min_bet+'" max="'+s.max_bet+'" step="5" value="'+S.stake+'" aria-label="Bucks per bet"><span class="kicker">'+(S.slipMode==='parlay'||n===1?'Bucks':'Bucks each')+(BK.me?'<br>💵 '+money2(bank())+' left':'')+'</span></div>'+
   '<div class="quick">'+[10,25,50,100,250].map(function(v){return '<button type="button" data-stake="'+v+'">'+v+'</button>'}).join('')+'</div>'+
   '<div class="towin"><span>'+(S.slipMode!=='parlay'&&n>1?'Total risk '+money2(S.stake*n)+' · to win':'To win')+'</span><b id="towin">–</b></div><p class="err" id="slipErr"></p>';
  h+=AUTH?'<button type="button" class="cta" id="review">Review '+(S.slipMode==='parlay'||n===1?'bet':n+' bets')+'</button>':'<button type="button" class="cta" data-login="1">Log in to bet</button>';
  return h+'<button type="button" class="ghost" id="clearSlip">Clear slip</button>'+CLOSE;
}
function reviewHtml(){var bets=slipBets(),risk=0,win=0;bets.forEach(function(b){risk+=b.stake;win+=b.win});
  return '<div class="ph" style="margin:0"><div><div class="kicker">Confirm</div><h2 style="font-size:20px">Place '+(bets.length>1?bets.length+' bets':S.slipMode==='parlay'?'this parlay':'this bet')+'?</h2></div></div>'+
   bets.map(function(b){return '<div class="rv">'+(b.legs.length>1?'<div class="rv-k">'+b.legs.length+'-leg parlay · '+odds(b.odds)+'</div>':'')+b.legs.map(function(p){return legRow(p,0,false)}).join('')+'<div class="rv-m"><span>Risk <b>'+m2(b.stake)+'</b></span><span>To win <b>'+m2(b.win)+'</b></span></div></div>'}).join('')+
   '<div class="rv-tot"><div><small>Total risk</small><b>'+m2(risk)+'</b></div><div><small>Total to win</small><b>'+m2(win)+'</b></div><div><small>Balance after</small><b>'+m2(bank()-risk)+'</b></div></div>'+
   (S.picks.some(function(p){return bl(p.line).live})?'<p class="muted" style="font-size:11.5px">Live prices move. If one gets worse before this goes through, you\'ll see the new price and can decide again.</p>':'')+
   '<p class="err" id="slipErr"></p><button type="button" class="cta" id="place">Confirm &amp; place</button><button type="button" class="ghost" id="backSlip">Back to slip</button>'}
function slipCheck(){var bad=slipProblem(),n=S.picks.length;var tw=$('#towin');
  if(tw){var w=S.slipMode==='parlay'?parlayWin(S.stake):S.picks.reduce(function(x,p){return x+singleWin(p,S.stake)},0);tw.textContent=bad?'–':m2(w)}
  var er=$('#slipErr');if(er&&!S.review)er.innerHTML=bad;var rv=$('#review');if(rv)rv.disabled=!!bad}
function togglePick(id,mkt,side,pid){var l=bl(id);if(!l)return;if(isLk(l)){toast('That game is over');return}
  var k=id+'|'+mkt+'|'+side+'|'+(pid||''),i=S.picks.findIndex(function(p){return pkey(p)===k});
  if(i>=0){S.picks.splice(i,1);render();return}
  // the other side of the same market replaces it (can't have Over and Under on the same thing)
  var j=S.picks.findIndex(function(p){return p.line===id&&p.mkt===mkt&&(p.pid||'')===(pid||'')});
  if(j>=0)S.picks[j]={line:id,mkt:mkt,side:side,pid:pid};
  else{if(S.picks.length>=8){toast('Your slip is full (8 picks)');return}S.picks.push({line:id,mkt:mkt,side:side,pid:pid})}
  S.review=false;render();if(S.picks.length===1)openSheet(slipHtml()),slipCheck();else toast(S.picks.length+' picks on your slip')}
function placeBets(btn){btn.disabled=true;btn.textContent='Placing…';
  var bets=slipBets(),done=[],failed=null;
  var body=function(b){return {legs:b.legs.map(function(p){return {line_id:p.line,market:p.mkt,pick:p.side,player_id:p.pid||undefined,odds:legOdds(p),point:legPoint(p)}}),stake:b.stake}};
  var step=function(i){if(i>=bets.length)return finish();
    api('/bets',{body:body(bets[i])}).then(function(r){done.push(r.bet);if(BK.me)BK.me.balance=r.balance;step(i+1)}).catch(function(e){failed={i:i,msg:e.message};finish()})};
  var finish=function(){
    var placedKeys={};done.forEach(function(b,i){bets[i].legs.forEach(function(p){placedKeys[pkey(p)]=1})});
    S.picks=S.picks.filter(function(p){return !placedKeys[pkey(p)]});rememberBets(done);
    if(failed){bookLoad().then(function(){S.review=false;if(!S.picks.length){closeSheetQuiet();toast(failed.msg);return}openSheet(slipHtml());slipCheck();var er=$('#slipErr');if(er)er.innerHTML=(done.length?done.length+' placed. ':'')+(/Odds moved/.test(failed.msg)?'Odds moved on a pick. These are the new prices. Review again to take them.':esc(failed.msg))})}
    else{S.review=false;S.slipMode='single';openSheet(ticketSheet(done.map(function(b){return b.id}),done.length>1?'Bets placed':'Bet placed'));S.bseg='mine';bookLoad();render()}};
  step(0)}
/* login: pick team, then PIN pad */
function loginSheet(){
  if(!BK.teams)return '<p class="muted">Loading teams…</p>'+CLOSE;
  if(!S.lt)return '<div class="ph" style="margin:0"><div><div class="kicker">Sportsbook login</div><h2>Which team is yours?</h2></div></div><div class="rows">'+
    BK.teams.map(function(t){return '<button type="button" class="row" data-lteam="'+t.id+'" style="grid-template-columns:minmax(0,1fr) auto 10px">'+whoS(t.id,t.name,30)+'<span class="tr '+(t.has_pin?'r':'p')+'" style="font-size:10px">'+(t.has_pin?'PIN set':'New')+'</span>'+CHEV+'</button>'}).join('')+'</div>'+CLOSE;
  var t=BK.teams.find(function(x){return x.id===S.lt})||{};var setting=!t.has_pin;
  var title=setting?(S.pin1?'Type it again':'Pick a 4-digit PIN'):'Enter your PIN';
  return '<div class="pinbox">'+av(S.lt,52)+'<h2>'+esc(team(S.lt))+'</h2><p class="muted" style="font-size:13px">'+title+(setting&&!S.pin1?'<br><span style="font-size:11.5px">You\'ll use it to log in on any phone. Don\'t share it.</span>':'')+'</p>'+
   '<div class="dots'+(S.pinErr?' shake':'')+'">'+[0,1,2,3].map(function(i){return '<i class="'+(i<S.pin.length?'on':'')+'"></i>'}).join('')+'</div><p class="err" style="min-height:18px;text-align:center">'+esc(S.pinErr||'')+'</p>'+
   '<div class="pad">'+['1','2','3','4','5','6','7','8','9','back','0','del'].map(function(k){return k==='back'?'<button type="button" class="pk2 dim" data-pinback="1">Teams</button>':k==='del'?'<button type="button" class="pk2 dim" data-key="del" aria-label="Delete">⌫</button>':'<button type="button" class="pk2" data-key="'+k+'">'+k+'</button>'}).join('')+'</div></div>';
}
function openLogin(){S.lt=null;S.pin='';S.pin1=null;S.pinErr='';openSheet(loginSheet());
  api('/teams').then(function(t){BK.teams=t;if($('#sheet').classList.contains('open'))openSheet(loginSheet())}).catch(function(e){openSheet('<p class="err">'+esc(e.message)+'</p>'+CLOSE)})}
function pinKey(k){if(S.pinBusy)return;S.pinErr='';if(k==='del'){S.pin=S.pin.slice(0,-1);openSheet(loginSheet());return}if(S.pin.length>=4)return;S.pin+=k;openSheet(loginSheet());if(S.pin.length<4)return;
  var t=BK.teams.find(function(x){return x.id===S.lt})||{};
  if(!t.has_pin&&!S.pin1){S.pin1=S.pin;S.pin='';setTimeout(function(){openSheet(loginSheet())},150);return}
  if(!t.has_pin&&S.pin1!==S.pin){S.pin1=null;S.pin='';S.pinErr='PINs didn\'t match. Start over.';openSheet(loginSheet());return}
  S.pinBusy=true;
  api('/login',{body:{user_id:S.lt,pin:S.pin}}).then(function(r){S.pinBusy=false;AUTH={token:r.token,user_id:r.user_id};store('auth',AUTH);S.me=r.user_id;store('me',S.me);S.h2a=S.me;
    closeSheetQuiet();toast((r.created?'PIN set. ':'')+'Logged in as '+team(r.user_id));bookLoad();render();if(S.picks.length)setTimeout(function(){openSheet(slipHtml())},300)})
   .catch(function(e){S.pinBusy=false;S.pin='';S.pinErr=e.message;openSheet(loginSheet())})}
function logout(){api('/logout',{method:'POST'}).catch(function(){});AUTH=null;store('auth',null);BK.me=null;S.picks=[];render();toast('Logged out')}

/* commish tools */
function admPanel(){
  if(!(BK.me&&BK.me.commish))return '';
  return '<section class="panel"><div class="ph"><div><div class="kicker">Commish only</div><h2>Book controls</h2></div></div><div class="rows">'+
   [['bucks','💵 Add or take away Bucks','Any team, you included. Shows everyone\'s balance; every change goes in the ledger.'],['health','Book health','Is everything working? Lines, live data, settlement, errors.'],['post','Post lines now','Use if Tuesday\'s automatic post didn\'t happen.'],['line','Move or void a line','Change a number before the game locks, or take it off the board.'],
    ['settle','Settle a week','Grade bets now (normally automatic Wednesday 3 AM).'],
    ['pin','Reset a PIN','For anyone locked out or who picked the wrong team.'],['log','Book log','What the clock job and the commish did.']]
   .map(function(x){return '<button type="button" class="row" data-adm="'+x[0]+'" style="grid-template-columns:minmax(0,1fr) 10px"><div><b style="font-size:14px">'+x[1]+'</b><p class="muted" style="font-size:12px;margin-top:2px">'+x[2]+'</p></div>'+CHEV+'</button>'}).join('')+'</div></section>'}
/* commish Bucks (v1.8.3): every team with its balance, quick amounts, live preview */
var BKU={u:null,amt:'',note:''};
function bucksBody(){var lb=(BK.lb||[]).slice().sort(function(a,b){return team(a.user_id).localeCompare(team(b.user_id))}),me=AUTH&&AUTH.user_id;
  if(!BKU.u||!lb.some(function(x){return x.user_id===BKU.u}))BKU.u=me||(lb[0]&&lb[0].user_id);
  if(me)lb.sort(function(a,b){return (b.user_id===me)-(a.user_id===me)});
  var sel=lb.filter(function(x){return x.user_id===BKU.u})[0],amt=Number(BKU.amt)||0;
  return '<div class="bkx-list">'+lb.map(function(x){return '<button type="button" class="bkx-t'+(x.user_id===BKU.u?' on':'')+'" data-bkpick="'+x.user_id+'"><span><b>'+esc(team(x.user_id))+'</b>'+(x.user_id===me?' <em>(you)</em>':'')+(x.joined?'':' <small>not started</small>')+'</span><span class="num"><b>'+m2(x.cash)+'</b>'+(x.in_play?'<small>+'+m2(x.in_play)+' in play</small>':'')+'</span></button>'}).join('')+'</div>'+
   (sel?'<div class="bkx-amt"><div class="kicker" style="margin-bottom:6px">Amount for '+esc(team(sel.user_id))+'</div><div class="bkx-chips">'+[-500,-100,-50,-10,10,50,100,500].map(function(v){return '<button type="button" class="bkx-c'+(v<0?' neg':'')+(amt===v?' on':'')+'" data-bkamt="'+v+'">'+(v>0?'+':'−')+Math.abs(v)+'</button>'}).join('')+'</div>'+
    '<label class="fld"><span>Or type an amount (minus takes away)</span><input id="aAmt" type="text" inputmode="numbers-and-punctuation" placeholder="e.g. 250 or -100" value="'+esc(BKU.amt)+'" data-bkin="amt"></label>'+
    '<div class="bkx-chips" style="margin-top:8px">'+['Prize','Correction','Commish bonus','Penalty'].map(function(n){return '<button type="button" class="bkx-c'+(BKU.note===n?' on':'')+'" data-bknote="'+n+'">'+n+'</button>'}).join('')+'</div>'+
    '<label class="fld"><span>Reason</span><input id="aNote" type="text" value="'+esc(BKU.note)+'" data-bkin="note"></label>'+
    '<p class="bkx-prev" id="bkPrev">'+bucksPrev(sel)+'</p><p class="err" id="aErr"></p>'+
    '<button type="button" class="cta" data-admgo="bucks"'+(amt&&BKU.note.trim()?'':' disabled')+' id="bkGo">'+(amt>0?'Add '+m2(amt)+' Bucks':amt<0?'Take away '+m2(-amt)+' Bucks':'Save')+'</button></div>':'')}
function bucksPrev(sel){var a=Number(BKU.amt)||0;if(!sel)return '';return esc(team(sel.user_id))+': <b class="num">'+m2(sel.cash)+'</b> → <b class="num" style="color:'+(a<0?'var(--loss)':a>0?'var(--win)':'inherit')+'">'+m2(Math.round((sel.cash+a)*100)/100)+'</b>'+(sel.cash+a<0?' <span class="err">(can\'t go below 0)</span>':'')}
function bucksRefresh(){var b=$('#sheetBody');if(!b)return;var y=$('#sheet').scrollTop;openSheet(admSheet('bucks'));$('#sheet').scrollTop=y}
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-bkpick],[data-bkamt],[data-bknote]');if(!t)return;var d=t.dataset;
  if(d.bkpick){BKU.u=d.bkpick;BKU.amt='';}else if(d.bkamt){BKU.amt=String(d.bkamt)}else if(d.bknote){BKU.note=d.bknote}
  bucksRefresh();if(d.bkpick){var am=document.querySelector('.bkx-amt');if(am)try{am.scrollIntoView({block:'start',behavior:'smooth'})}catch(x){}}});
document.addEventListener('input',function(e){var t=e.target;if(!t.dataset||!t.dataset.bkin)return;BKU[t.dataset.bkin]=t.value;
  var sel=(BK.lb||[]).filter(function(x){return x.user_id===BKU.u})[0],a=Number(BKU.amt)||0,g=$('#bkGo'),p=$('#bkPrev');
  if(p)p.innerHTML=bucksPrev(sel);if(g){g.disabled=!(a&&BKU.note.trim());g.textContent=a>0?'Add '+m2(a)+' Bucks':a<0?'Take away '+m2(-a)+' Bucks':'Save'}});
function teamSelect(id){return '<select id="'+id+'">'+(BK.lb||[]).map(function(x){return '<option value="'+x.user_id+'">'+esc(team(x.user_id))+'</option>'}).join('')+'</select>'}
function fld(id,label,val,type){return '<label class="fld"><span>'+label+'</span><input id="'+id+'" type="'+(type||'text')+'"'+(type==='number'?' inputmode="decimal" step="any"':'')+' value="'+esc(val==null?'':val)+'"></label>'}
function admSheet(k,arg){var nw=(BK.status&&BK.status.next&&BK.status.next.week)||D.league.week,ow=BK.wk&&BK.wk.week;
  var hd=function(t,s){return '<div class="ph" style="margin:0"><div><div class="kicker">Commish · Book controls</div><h2>'+t+'</h2>'+(s?'<p class="muted" style="font-size:12.5px;margin-top:2px">'+s+'</p>':'')+'</div></div>'};
  if(k==='post')return hd('Post lines','Lines freeze for the whole week once posted.')+fld('aWeek','Week',nw,'number')+'<label class="chk"><input type="checkbox" id="aForce"> Replace lines already posted (only if nobody has bet yet)</label><p class="err" id="aErr"></p><button type="button" class="cta" data-admgo="post">Post lines</button>'+CLOSE;
  if(k==='settle')return hd('Settle a week','Uses Sleeper\'s current scores. Normally runs itself Wednesday 3 AM.')+fld('aWeek','Week',ow||'','number')+'<label class="chk"><input type="checkbox" id="aForce"> Settle now even if it\'s early</label><p class="err" id="aErr"></p><button type="button" class="cta" data-admgo="settle">Settle</button>'+CLOSE;
  if(k==='bucks')return hd('Add or take away Bucks','Pick a team (you\'re on the list too), pick an amount, give a reason. It shows up in the ledger.')+bucksBody()+CLOSE;
  if(k==='pin')return hd('Reset a PIN','They\'ll pick a new PIN next time they log in, and get logged out everywhere.')+'<label class="fld"><span>Team</span>'+teamSelect('aUser')+'</label><p class="err" id="aErr"></p><button type="button" class="cta" data-admgo="pin">Reset PIN</button>'+CLOSE;
  if(k==='line'){var L=(BK.wk&&BK.wk.lines)||[];
    if(!arg)return hd('Move or void a line',L.length?'Week '+ow+'. Tap a game.':'No lines posted right now.')+'<div class="rows">'+L.map(function(l){return '<button type="button" class="row" data-adm="line" data-arg="'+l.id+'" style="grid-template-columns:minmax(0,1fr) auto 10px"><div><b style="font-size:13.5px">'+esc(team(l.a))+' vs '+esc(team(l.b))+'</b><p class="muted" style="font-size:12px">'+spr(-l.spread)+' · O/U '+f1(l.total)+' · '+odds(l.ml_a)+'/'+odds(l.ml_b)+'</p></div><span class="tr r" style="font-size:10px">'+esc(isLk(l)?l.status==='open'?'locked':l.status:'open')+'</span>'+CHEV+'</button>'}).join('')+'</div>'+CLOSE;
    var l=bl(arg);if(!l)return '<p class="muted">Line not found.</p>'+CLOSE;
    return hd(esc(team(l.a))+' vs '+esc(team(l.b)),'Spread is '+esc(team(l.a))+'\'s expected winning margin (3.5 shows them as -3.5). Bets already placed keep their numbers.')+
     (isLk(l)?'<p class="note">This game is locked. You can only void it (every bet on it gets its stake back).</p>':fld('aSpread','Spread ('+esc(team(l.a))+' by)',l.spread,'number')+fld('aTotal','Total',l.total,'number')+fld('aMla','Moneyline '+esc(team(l.a)),l.ml_a,'number')+fld('aMlb','Moneyline '+esc(team(l.b)),l.ml_b,'number'))+
     fld('aNote','Reason (shows on the line)',l.note||'')+'<p class="err" id="aErr"></p>'+(isLk(l)?'':'<button type="button" class="cta" data-admgo="line" data-arg="'+l.id+'">Save line</button>')+
     (l.status==='open'?'<button type="button" class="ghost" data-admgo="void" data-arg="'+l.id+'" style="color:var(--loss);border-color:var(--loss)">Void this game</button>':'')+CLOSE}
  if(k==='log')return hd('Book log','Newest first.')+'<div id="aLog"><p class="muted">Loading…</p></div>'+CLOSE;
  if(k==='health')return hd('Book health','Checks everything the Book depends on, right now.')+'<div id="aHealth"><p class="muted">Checking…</p></div>'+CLOSE;
  return CLOSE}
function admGo(k,arg,btn){var v=function(id){var e=$('#'+id);return e?(e.type==='checkbox'?e.checked:e.value):null};var err=function(m){var e=$('#aErr');if(e)e.textContent=m};
  var p=k==='post'?api('/admin/post-lines',{body:{week:+v('aWeek'),force:v('aForce')}}):k==='settle'?api('/admin/settle',{body:{week:+v('aWeek'),force:v('aForce')}}):
   k==='bucks'?api('/admin/adjust',{body:{user_id:BKU.u,amount:Number(BKU.amt),note:BKU.note}}):k==='pin'?api('/admin/reset-pin',{body:{user_id:v('aUser')}}):
   k==='line'?api('/admin/line/'+encodeURIComponent(arg),{body:{spread:v('aSpread'),total:v('aTotal'),ml_a:v('aMla'),ml_b:v('aMlb'),note:v('aNote')}}):
   k==='void'?api('/admin/line/'+encodeURIComponent(arg),{body:{void:true,note:v('aNote')||'Voided by commish'}}):null;
  if(!p)return;btn.disabled=true;
  if(k==='bucks'){p.then(function(r){var who=team(BKU.u),a=Number(BKU.amt);BKU.amt='';toast((a>0?'Added ':'Took away ')+m2(Math.abs(a))+' · '+who+' now has '+m2(r.balance));
     api('/leaderboard').then(function(x){BK.lb=x;bucksRefresh()}).catch(bucksRefresh);bookLoad()}).catch(function(e){btn.disabled=false;err(e.message)});return}
  p.then(function(r){closeSheetQuiet();toast(k==='post'?'Week '+r.week+' lines posted':k==='settle'?'Week '+r.week+' settled ('+r.bets+' bets)':k==='bucks'?'Saved. New balance '+money2(r.balance):k==='pin'?'PIN reset':k==='void'?'Game voided, stakes returned':'Line updated');bookLoad()})
   .catch(function(e){btn.disabled=false;err(e.message)})}
function loadHealth(){api('/admin/health').then(function(r){var el=$('#aHealth');if(!el)return;
  el.innerHTML='<div class="rows">'+r.checks.map(function(c){return '<div class="row" style="grid-template-columns:22px minmax(0,1fr)"><span style="font-size:16px">'+(c.ok?'✅':'⚠️')+'</span><div><b style="font-size:13.5px">'+esc(c.name)+'</b><p class="muted" style="font-size:12px;margin-top:1px">'+esc(c.detail)+'</p></div></div>'}).join('')+'</div>'+
   (r.last_tick?'<p class="muted" style="font-size:11.5px;margin-top:8px">Clock job last ran '+esc(new Date(r.last_tick.at).toLocaleString('en-US',{weekday:'short',hour:'numeric',minute:'2-digit'}))+(r.last_tick.errors&&r.last_tick.errors.length?' with errors: '+esc(r.last_tick.errors.join('; ')):' with no errors')+'.</p>':'')+
   (r.recent_errors&&r.recent_errors.length?'<p class="err" style="font-size:11.5px">Recent problems: '+r.recent_errors.map(function(e){return esc(e.errors.join('; '))}).join(' · ')+'</p>':'')}).catch(function(e){var el=$('#aHealth');if(el)el.innerHTML='<p class="err">'+esc(e.message)+'</p>'})}
function loadLog(){api('/admin/log?limit=40').then(function(rows){var el=$('#aLog');if(!el)return;el.innerHTML=rows.length?'<div class="rows">'+rows.map(function(r){return '<div class="row" style="grid-template-columns:1fr"><div><b style="font-size:13px">'+esc(r.kind.replace(/_/g,' '))+'</b> <span class="muted" style="font-size:11.5px">'+esc(new Date(r.at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+'</span><p class="muted" style="font-size:11.5px;word-break:break-word">'+esc(JSON.stringify(r.detail))+'</p></div></div>'}).join('')+'</div>':'<p class="muted">Nothing yet.</p>'}).catch(function(e){var el=$('#aLog');if(el)el.innerHTML='<p class="err">'+esc(e.message)+'</p>'})}

/* ---------- HOW IT WORKS (plain-English explanations, v1.8) ---------- */
var EXPLAIN={
 data:{t:'Where the data comes from',b:[
  ['Sleeper','Every score, lineup, matchup, trade and draft pick comes straight from Sleeper for all four seasons (2023–2026). The app rebuilds its stats from Sleeper every 3 minutes, so nothing is typed in by hand.'],
  ['Live NFL games','Kickoff times and game clocks come from ESPN\'s public scoreboard. The Sportsbook uses them to know when a matchup goes live and how much of each lineup is left to play.'],
  ['Former managers','Anyone who left the league stays in every record and table, tagged "Former", so history never changes.'],
  ['Your bets','Logins, Mahomie Bucks and bets are stored in the app\'s own database. Every Buck that moves is written to a ledger, so balances can always be traced.']]},
 standings:{t:'Standings',b:[
  ['W-L','Your record, including the league-median game: each week you also get a win if you scored more than half the league, and a loss if not.'],
  ['PF','Points for: everything your starters scored this season.'],
  ['All-play','Your record if you played all 11 other teams every week. Beat 9 of them in a week = 9-2 for that week. It shows how good your scores really were, no matter who you drew.'],
  ['Luck','Actual head-to-head wins minus the wins your all-play rate says you "should" have. +1.5 = 1.5 more wins than your scores earned (soft schedule). −2.0 = 2 fewer (you kept running into big weeks).'],
  ['Playoff line','The dashed line is the cut: the top 6 make the playoffs. Ties in record are broken by points for.']]},
 power:{t:'Power rankings',b:[
  ['The score (0–100)','For each of four stats, the app checks what share of the other 11 teams you\'re ahead of (all 11 = 100%, none = 0%), then blends them: points per game 35%, all-play record 25%, last 3 weeks 20%, win % 20%.'],
  ['Reading it','100 = best in the league at all four. 50 = right in the middle. 0 = last at everything.'],
  ['Why record isn\'t everything','Scoring counts for most of the score, so a 2-3 team that puts up big numbers can rank above a lucky 4-1 team.'],
  ['Arrow','How many spots you moved since last week.']]},
 odds:{t:'Playoff odds',b:[
  ['Simulations','The app plays out the rest of the regular season 5,000 times with the real remaining schedule.'],
  ['Each team\'s score','Every simulated week, each team scores its projection plus random swing. The projection is 45% last 3 weeks, 35% season average, 20% last season. The swing is how much that team\'s score usually bounces week to week.'],
  ['Wins','Head-to-head games plus the league-median game (beat half the league = a win).'],
  ['The columns','Playoffs = share of simulations you finished top 6. Bye = top 2. #1 = first seed. Last = last place. Proj W = average final win total. Ties are broken by points for.']]},
 awards:{t:'How awards are picked',b:[
  ['🏆 Champion / 🚽 Sacko','From the playoff and Toilet Bowl brackets in Sleeper.'],
  ['👑 Points King','Most regular-season points.'],
  ['🔥 On Fire / 🧊 Ice Cold','Most weeks as the league\'s top scorer / lowest scorer.'],
  ['🍀 Horseshoe / 🐍 Snakebitten','Luckiest / unluckiest team: actual wins minus the wins their scores earned (see Standings → Luck).'],
  ['🥊 Punching Bag','Most points scored against.'],
  ['💥 Monster Week · 🔨 Bully · 💔 Heartbreaker','Highest single score, biggest blowout win, and closest loss of the season.'],
  ['During the season','Awards update every week and show the current leader until the season ends.']]},
 records:{t:'Record book',b:[
  ['What counts','Every game in league history (2023 on), pulled from Sleeper. Filter to regular season or playoffs with the switch.'],
  ['Scores','A team\'s score is its starters\' total. Bench points never count.'],
  ['Best player game','The most points one player scored as a starter in a single week.'],
  ['Streaks','Most wins (or losses) in a row in regular-season head-to-head games. Streaks carry over from one season to the next.'],
  ['Playoff byes','Byes have no opponent, so a bye-week score shows as a "Playoff bye" card.']]},
 alltime:{t:'All-time table',b:[
  ['Seasons','Regular-season games from every season on Sleeper.'],
  ['W-L, Win%, PPG','Head-to-head record, win rate and points per game across all seasons.'],
  ['🏆 / Playoffs','Titles won, and how many times you made the playoffs.'],
  ['🔥 / 🧊','How many weeks you were the league\'s top scorer / lowest scorer.']]},
 h2h:{t:'Rivals',b:[
  ['Rivalry card','Every game two teams have played each other, regular season and playoffs, with the series record and points.'],
  ['Grid','Each square is the row team\'s record against the column team. Tap a square to open that rivalry.']]},
 preview:{t:'Matchup preview',b:[
  ['Projection','45% of a team\'s last 3 weeks, 35% its season average and 20% last season, pulled toward the league average (harder through Week 6).'],
  ['Win chance','The gap between the two projections compared with how much both teams swing week to week, on a bell curve. A 10-point gap between two steady teams means more than the same gap between two boom-or-bust teams.'],
  ['Where it shows','The win chance and betting line only appear when you open a preview from the Sportsbook. Everywhere else the app sticks to scores, form and history.']]},
 bench:{t:'Bench Shame',b:[
  ['What it measures','For every week, the app builds the best lineup you could have started from your roster (same lineup slots as the league) and compares it with what you actually scored.'],
  ['The number','Points left on the bench across the season. Higher = more shame. Your worst week is shown too.'],
  ['Eligibility','FLEX can take an RB, WR or TE. Every player is used at most once.']]},
 trades:{t:'Trade grader',b:[
  ['Points started','The main number. Every week after the trade, the app adds up what the players a team GOT scored while in that team\'s starting lineup. Points scored on the bench are shown separately (in gray) but don\'t count, because they didn\'t help the team win.'],
  ['When a player leaves','Once a player is dropped or traded away, he stops counting for that side.'],
  ['The verdict','The gap in points started, divided by the weeks since the trade: under 3 pts/week = too close to call, 3–7 = slight edge, 7–15 = clear win, 15+ = landslide. Per week matters: 20 points over 2 weeks is a real lead, 20 points over 9 weeks is a coin flip.'],
  ['Early verdicts','In the first two weeks after a trade the verdict is marked early, because one big game can flip it.'],
  ['Did it help the team?','Each team\'s points per game and record before the trade vs since (regular season, including the median game). Lots of things change a team\'s scoring, so read it as context, not proof.'],
  ['Picks and FAAB','Draft picks and waiver budget that changed hands are listed with the deal, but aren\'t scored.'],
  ['Data','Trades, lineups and every player\'s weekly points come straight from Sleeper and update every few minutes during the season.']]},
 draft:{t:'Draft re-grade',b:[
  ['How it works','Every drafted player (no kickers or defenses) is ranked by the points he has scored on league rosters this season. That rank is compared with where he was picked.'],
  ['Steals','Players who have outscored their draft spot the most (late picks playing like early ones).'],
  ['Busts','Early picks whose points rank is furthest below where they went.']]},
 book:{t:'How the odds work',b:[
  ['Pregame lines','Posted Tuesday 6 AM. Each team\'s projection is 60% Sleeper\'s projection for the lineup as it\'s set that morning and 40% league history (last 3 weeks, season average, last season). The spread is the projected margin, capped at 20. The total is both projections added. Both pay -110. The moneyline comes from the win chance plus a 4.5% house edge.'],
  ['Live odds','Once the first player in a matchup kicks off, the odds go live and update about every minute: projected final = points already scored + Sleeper\'s projection for every starter still to play (the same projected totals Sleeper shows). The "proj" under each team is that live number. The further ahead a team gets, the worse its price.'],
  ['Player props','Over/under on one player\'s fantasy points this week, scored your league\'s way. The line is Sleeper\'s projection (live during his game: points so far + projection for the rest), always x.5 so there are no pushes, -110 both ways. You can\'t take the under on your own player.'],
  ['Singles and parlays','Your slip holds up to 8 picks. Singles = each pick is its own bet. Parlay = 2–4 picks, one per fantasy matchup, all have to win; odds multiply. Every bet gets a confirm screen, then a ticket you can share.'],
  ['Off the board','If a moneyline would be shorter than -1000 (nearly a sure thing), it comes off the board. Spreads and totals stay open.'],
  ['Odds moved','Live prices refresh every 30–60 seconds. If the price gets worse between when you see it and when you tap Place bet, the app shows you the new price first.'],
  ['Settling','Wednesday 3 AM, after Sleeper\'s stat corrections. Exact ties on a spread or total push (stake back).']]}
};
var EXPLAIN_ORDER=['data','standings','power','odds','awards','records','alltime','h2h','preview','book','bench','trades','draft'];
function info(k){return '<button type="button" class="info" data-info="'+k+'" aria-label="How '+esc(EXPLAIN[k].t)+' works">ⓘ How it works</button>'}
function explainSheet(k){var x=EXPLAIN[k];if(!x)return '';
  return '<div class="ph" style="margin:0"><div><div class="kicker">How it works</div><h2>'+esc(x.t)+'</h2></div></div><div class="rows">'+
   x.b.map(function(r){return '<div class="row" style="grid-template-columns:1fr"><div><b style="font-size:14px">'+esc(r[0])+'</b><p class="muted" style="font-size:13px;line-height:1.55;margin-top:3px">'+esc(r[1])+'</p></div></div>'}).join('')+'</div>'}
function explainPanel(){return '<section class="panel"><div class="ph"><div><div class="kicker">Plain English</div><h2>How the app works</h2></div></div><div class="rows">'+
  EXPLAIN_ORDER.map(function(k){return '<button type="button" class="row" data-info="'+k+'" style="grid-template-columns:minmax(0,1fr) 10px"><b style="font-size:14px;text-align:left">'+esc(EXPLAIN[k].t)+'</b>'+CHEV+'</button>'}).join('')+'</div></section>'}

/* ---------- GRIDIRON GOLD v2: hidden slot machine (tap the pink dot at the bottom of the Sportsbook page) ----------
   Casino-style video slot. Every outcome comes from the server (independent random stop per reel on fixed strips);
   the reels here scroll through those same strips and land where the server stopped them.
   Slam stop, anticipation, paylines, win rollups, big-win celebrations, Two-Minute Drill bonus,
   and synthesized casino sounds with a volume control (saved per phone). */
var SL={open:false,busy:false,spinning:false,bet:10,state:null,pt:null,res:null,slam:false,auto:0,cred:0,winShown:0,cycleT:null,stopT:[],raf:null,lt:0,landed:0,items:null,roll:null};
var GG_N={RING:'Title Ring',TROPHY:'Trophy',STADIUM:'Helmet',PLAYBOOK:'Football',BALL:'Ace',CAP:'King',WILD:'MH Wild',TICKET:'Free Spins',DRAFT:'Two-Minute Drill'};
var GG_COL=['#ff4545','#3bd1ff','#ffd23b','#5dff8f','#ff5fd6','#ff9a3b','#b18cff','#3bffd8','#ffffff'];
var GG_SEQ=['RING','CAP','TROPHY','BALL','STADIUM','PLAYBOOK','WILD','CAP','BALL','TICKET','PLAYBOOK','DRAFT'];
var GG_V=26; // reel speed, symbols per second
var GG_JP=[['GRAND',250,'#ff5fd6'],['MAJOR',50,'#ff4545'],['MINOR',15,'#3bd1ff'],['MINI',5,'#5dff8f']];
function gb(n){n=Math.round(Number(n)*100)/100;return n%1?m2(n):n.toLocaleString('en-US')}
function fm(){return (SL.pt&&SL.pt.free_mult)||3}

/* ---------- sound (WebAudio, nothing to download) ---------- */
var GGA={ctx:null,out:null,rev:null,noise:null,vol:.7,on:true,hum:null};
try{var _gv=localStorage.getItem('gg_vol');if(_gv!=null&&!isNaN(+_gv))GGA.vol=Math.max(0,Math.min(1,+_gv));GGA.on=localStorage.getItem('gg_mute')!=='1'}catch(e){}
function aGain(){return GGA.on?GGA.vol*GGA.vol*1.6:0}
function aInit(){var c=GGA.ctx;if(c){if(c.state!=='running')try{c.resume()}catch(e){}return c}
  var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
  try{c=new AC()}catch(e){return null}GGA.ctx=c;
  var comp=c.createDynamicsCompressor();comp.threshold.value=-12;comp.knee.value=10;comp.ratio.value=5;comp.attack.value=.003;comp.release.value=.2;comp.connect(c.destination);
  GGA.out=c.createGain();GGA.out.gain.value=aGain();GGA.out.connect(comp);
  var n=Math.floor(c.sampleRate*1.8),ir=c.createBuffer(2,n,c.sampleRate);
  for(var ch=0;ch<2;ch++){var d=ir.getChannelData(ch);for(var i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.6)}
  var cv=c.createConvolver();cv.buffer=ir;GGA.rev=c.createGain();GGA.rev.gain.value=.28;GGA.rev.connect(cv);cv.connect(GGA.out);
  var nb=c.createBuffer(1,c.sampleRate*2,c.sampleRate),nd=nb.getChannelData(0);for(i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;GGA.noise=nb;
  try{var s=c.createBufferSource();s.buffer=c.createBuffer(1,1,22050);s.connect(c.destination);s.start(0)}catch(e){}
  if(c.state!=='running')try{c.resume()}catch(e){}
  return c}
function aSet(){try{localStorage.setItem('gg_vol',String(GGA.vol));localStorage.setItem('gg_mute',GGA.on?'0':'1')}catch(e){}
  if(GGA.out)GGA.out.gain.setTargetAtTime(aGain(),GGA.ctx.currentTime,.03);if(!GGA.on)aHum(false)}
function nf(n){return 440*Math.pow(2,(n-69)/12)}
function aO(type,f,t,dur,g,o){o=o||{};var c=GGA.ctx,os=c.createOscillator(),gn=c.createGain();os.type=type;os.frequency.setValueAtTime(f,t);
  if(o.to)os.frequency.exponentialRampToValueAtTime(o.to,t+(o.gl||dur));if(o.det)os.detune.setValueAtTime(o.det,t);
  if(o.vib){var l=c.createOscillator(),lg=c.createGain();l.frequency.value=o.vib[0];lg.gain.value=o.vib[1];l.connect(lg);lg.connect(os.frequency);l.start(t);l.stop(t+dur+.05)}
  var a=o.a||.004;gn.gain.setValueAtTime(.0001,t);gn.gain.exponentialRampToValueAtTime(g,t+a);if(o.hold)gn.gain.setValueAtTime(g,t+a+o.hold);gn.gain.exponentialRampToValueAtTime(.0001,t+dur);
  var src=os;if(o.lp){var fl=c.createBiquadFilter();fl.type='lowpass';fl.frequency.setValueAtTime(o.lp,t);if(o.lpTo)fl.frequency.exponentialRampToValueAtTime(o.lpTo,t+dur);fl.Q.value=o.q||.7;os.connect(fl);src=fl}
  src.connect(gn);gn.connect(GGA.out);if(o.rev)gn.connect(GGA.rev);os.start(t);os.stop(t+dur+.05)}
function aN(t,dur,g,o){o=o||{};var c=GGA.ctx,s=c.createBufferSource(),fl=c.createBiquadFilter(),gn=c.createGain();s.buffer=GGA.noise;s.loop=true;
  fl.type=o.type||'bandpass';fl.frequency.setValueAtTime(o.f||1000,t);if(o.to)fl.frequency.exponentialRampToValueAtTime(o.to,t+dur);fl.Q.value=o.q||1;
  var a=o.a||.003;gn.gain.setValueAtTime(.0001,t);gn.gain.exponentialRampToValueAtTime(g,t+a);if(o.hold)gn.gain.setValueAtTime(g,t+a+o.hold);gn.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(fl);fl.connect(gn);gn.connect(GGA.out);if(o.rev)gn.connect(GGA.rev);s.start(t,Math.random()*1.5);s.stop(t+dur+.05)}
function aBell(f,t,g,dur){[[1,1],[2.76,.45],[5.4,.22],[8.93,.1]].forEach(function(p,i){aO('sine',f*p[0],t,dur*(1-i*.2),g*p[1],{a:.002,rev:true})})}
function aBrass(n,t,dur,g){[0,-8,8].forEach(function(d){aO('sawtooth',nf(n),t,dur,g,{det:d,a:.03,hold:dur*.6,lp:900,lpTo:3500,rev:true})})}
function aFanfare(t,short){var seq=short?[[72,0,.2],[76,.1,.2],[79,.2,.2],[84,.3,.6]]:[[67,0,.15],[67,.17,.15],[67,.34,.15],[72,.51,.45],[76,.98,.18],[72,1.17,.18],[76,1.36,.18],[79,1.55,1.2]];
  seq.forEach(function(s){aBrass(s[0],t+s[1],s[2],.05);aBrass(s[0]-12,t+s[1],s[2],.035)});
  aO('sine',92,t,.6,.45,{to:46});aN(t,1.6,.1,{type:'highpass',f:5500,a:.01,rev:true});if(!short){aO('sine',92,t+1.55,.8,.5,{to:46});aN(t+1.55,2,.12,{type:'highpass',f:5000,a:.01,rev:true})}}
function aWhistle(t){[[0,.2],[.3,.5]].forEach(function(b){aO('sine',2950,t+b[0],b[1],.15,{a:.01,hold:b[1]-.07,vib:[34,120]});aN(t+b[0],b[1],.05,{f:2950,q:6,a:.01,hold:b[1]-.07})})}
function aCrowd(t,dur,g,groan){aN(t,dur,g,{f:groan?450:900,q:.5,a:dur*.25,hold:dur*.3,rev:true,to:groan?260:1150});aN(t,dur,g*.55,{f:groan?800:2400,q:.8,a:dur*.3,hold:dur*.25,rev:true})}
function aHorn(t){[155.6,196,233.1].forEach(function(f){aO('sawtooth',f,t,1,.05,{a:.03,hold:.65,lp:1500,to:f*.97,rev:true})})}
function aHum(on){var c=GGA.ctx;if(!c)return;
  if(on&&GGA.on&&GGA.vol>0&&!GGA.hum){try{var o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='sawtooth';o.frequency.value=58;f.type='lowpass';f.frequency.value=240;
    g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.045,c.currentTime+.15);o.connect(f);f.connect(g);g.connect(GGA.out);o.start();
    var tk=setInterval(function(){try{aN(c.currentTime,.025,.03,{type:'highpass',f:2600})}catch(e){}},72);GGA.hum={o:o,g:g,tk:tk}}catch(e){}}
  if(!on&&GGA.hum){var h=GGA.hum;GGA.hum=null;clearInterval(h.tk);try{h.g.gain.setTargetAtTime(.0001,c.currentTime,.05);h.o.stop(c.currentTime+.4)}catch(e){}}}
function aPlay(k,x){var c=aInit();if(!c||!GGA.on||GGA.vol<=0)return;var t=c.currentTime+.01,i;try{switch(k){
  case 'click':aO('square',1900,t,.035,.04,{lp:5000});aO('sine',900,t,.04,.05);break;
  case 'deny':aO('square',220,t,.12,.07,{lp:900});aO('square',165,t+.13,.22,.07,{lp:900});break;
  case 'open':[72,76,79,84].forEach(function(n,i){aBell(nf(n),t+i*.07,.1,.9)});aN(t,.7,.04,{type:'highpass',f:6000,a:.08,rev:true});break;
  case 'spin':aN(t,.26,.16,{f:500,to:2600,q:1.2,a:.02});aO('sawtooth',90,t,.3,.06,{to:180,lp:700});aO('square',2200,t,.03,.04,{lp:6000});break;
  case 'stop':aO('sine',150,t,.16,.5,{to:52,gl:.12});aN(t,.07,.24,{type:'lowpass',f:1400});aO('square',700+(x||0)*60,t,.02,.04,{lp:3000});break;
  case 'scat':aBell(nf(84+[0,4,7,12,16][Math.min(4,x||0)]),t,.26,1.4);aN(t,.5,.05,{type:'highpass',f:7000,rev:true});break;
  case 'antic':aO('sawtooth',110,t,1.35,.07,{to:440,gl:1.3,lp:500,lpTo:3000,a:.1,vib:[9,6]});aO('sawtooth',111.5,t,1.35,.05,{to:446,gl:1.3,lp:500,lpTo:3000,a:.1});
    for(i=0;i<10;i++)aN(t+i*.13,.06,.05+i*.012,{type:'lowpass',f:300});break;
  case 'tick':aO('triangle',2300+Math.random()*400+(x||0)*900,t,.045,.06,{a:.001});break;
  case 'rollend':aBell(nf(96),t,.16,1.1);aBell(nf(91),t+.06,.12,1);break;
  case 'win1':[0,4,7].forEach(function(s,i){aBell(nf(84+s),t+i*.075,.18,.8)});break;
  case 'win2':[0,4,7,12,16].forEach(function(s,i){aBell(nf(79+s),t+i*.07,.18,1)});aFanfare(t+.3,true);break;
  case 'coin':var f=3200+Math.random()*1400;aO('triangle',f,t,.09,.05,{a:.001});aO('sine',f*1.5,t,.07,.025,{a:.001});break;
  case 'big':aFanfare(t);break;
  case 'lvl':aFanfare(t,true);break;
  case 'free':[60,64,67,72,76,79,84,88,91,96].forEach(function(n,i){aBell(nf(n),t+i*.06,.12,1)});aN(t,1.2,.06,{type:'highpass',f:5000,a:.4,rev:true});aFanfare(t+.65,true);break;
  case 'drill':aWhistle(t);aCrowd(t+.3,2.8,.2);aHorn(t+.9);break;
  case 'dspin':for(i=0;i<6;i++)aO('square',1200+i*90,t+i*.05,.03,.02,{lp:4000});break;
  case 'dblank':aO('sine',240,t,.07,.08,{to:170});break;
  case 'dcoin':aO('triangle',nf(88+(x||0)),t,.12,.08,{a:.001});aO('sine',nf(100+(x||0)),t,.1,.03,{a:.001});break;
  case 'djp':aBell(nf(88),t,.2,1.2);aBell(nf(95),t+.08,.15,1.2);break;
  case 'dextra':[72,79,84].forEach(function(n,i){aBell(nf(n),t+i*.06,.14,.8)});break;
  case 'drum':for(i=0;i<18;i++)aN(t+i*.045,.05,.04+i*.009,{type:'lowpass',f:700});break;
  case 'td':aWhistle(t);aCrowd(t+.15,2.5,.28);aHorn(t+.45);break;
  case 'miss':aO('sine',120,t,.35,.35,{to:60});aN(t,.25,.12,{type:'lowpass',f:500});aCrowd(t+.05,1.2,.07,true);break;
  case 'collect':aBell(nf(84+[0,2,4,5,7,9,11,12,14][(x||0)%9]),t,.12,.5);break;
}}catch(e){}}
function sndIcon(){var v=GGA.on?GGA.vol:0;return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor"/>'+
  (v<=0?'<path d="m22 9-6 6M16 9l6 6"/>':(v>.05?'<path d="M15.5 8.5a5 5 0 0 1 0 7"/>':'')+(v>.45?'<path d="M19 5a10 10 0 0 1 0 14"/>':''))+'</svg>'}

/* ---------- symbol art (one SVG sprite, drawn here so it's crisp at any size) ---------- */
function ggSprite(){if(document.getElementById('ggSprite'))return;var d=document.createElement('div');d.id='ggSprite';d.setAttribute('aria-hidden','true');d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  var i,a,dots='',ticks='',F='font-family="Bungee,\'Chakra Petch\',Impact,sans-serif"';
  for(i=0;i<12;i++){a=i/12*Math.PI*2;dots+='<circle cx="'+(50+35.5*Math.cos(a)).toFixed(1)+'" cy="'+(50+35.5*Math.sin(a)).toFixed(1)+'" r="3.1" fill="#fff" stroke="#9fd8ff" stroke-width="1"/>'}
  for(i=0;i<12;i++){a=i/12*Math.PI*2;ticks+='<line x1="'+(50+21*Math.cos(a)).toFixed(1)+'" y1="'+(50+21*Math.sin(a)).toFixed(1)+'" x2="'+(50+25*Math.cos(a)).toFixed(1)+'" y2="'+(50+25*Math.sin(a)).toFixed(1)+'" stroke="#333" stroke-width="'+(i%3?1.4:2.8)+'"/>'}
  var lg=function(id,stops,v){return '<linearGradient id="'+id+'" x1="0" y1="0" x2="'+(v?0:1)+'" y2="1">'+stops.map(function(s){return '<stop offset="'+s[0]+'" stop-color="'+s[1]+'"/>'}).join('')+'</linearGradient>'};
  var rg=function(id,stops){return '<radialGradient id="'+id+'" cx=".38" cy=".32" r=".75">'+stops.map(function(s){return '<stop offset="'+s[0]+'" stop-color="'+s[1]+'"/>'}).join('')+'</radialGradient>'};
  var sym=function(id,body){return '<symbol id="gg-'+id+'" viewBox="0 0 100 100">'+body+'</symbol>'};
  d.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs>'+
   lg('ggGold',[[0,'#fff6c9'],[.42,'#f6cf4c'],[.55,'#d9a91c'],[1,'#8a6206']],1)+lg('ggGoldD',[[0,'#e7b92f'],[1,'#7a5300']],1)+
   rg('ggRuby',[[0,'#ffc2cc'],[.45,'#e0163f'],[1,'#5c0016']])+lg('ggRed',[[0,'#ff8a7a'],[.5,'#d42020'],[1,'#6b0909']],1)+
   rg('ggBrown',[[0,'#d08a48'],[.6,'#7a3a12'],[1,'#3d1a05']])+lg('ggBlue',[[0,'#e2f4ff'],[.5,'#3fa0ff'],[1,'#163f9e']],1)+
   lg('ggPurp',[[0,'#f6e3ff'],[.5,'#b14dff'],[1,'#4f1088']],1)+lg('ggSilver',[[0,'#ffffff'],[.5,'#c4c9d4'],[1,'#5f6675']],1)+
   '<filter id="ggSh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2.5" stdDeviation="1.8" flood-color="#000" flood-opacity=".6"/></filter></defs>'+
   sym('RING','<g filter="url(#ggSh)"><circle cx="50" cy="50" r="41" fill="url(#ggGold)" stroke="#5a3d00" stroke-width="2"/><circle cx="50" cy="50" r="31" fill="url(#ggGoldD)"/>'+dots+
     '<rect x="34" y="34" width="32" height="32" rx="4" transform="rotate(45 50 50)" fill="url(#ggRuby)" stroke="#ffe08a" stroke-width="2.5"/><path d="M50 31 V69 M31 50 H69" stroke="#fff" stroke-opacity=".25" stroke-width="1.5"/><path d="M42 41 50 33 58 41Z" fill="#fff" opacity=".6"/></g>'+
     '<path d="M80 12 l2.2 6.3 6.3 2.2-6.3 2.2-2.2 6.3-2.2-6.3-6.3-2.2 6.3-2.2z" fill="#fff"/>')+
   sym('TROPHY','<g filter="url(#ggSh)"><path d="M28 22H15c0 16 9 24 19 25M72 22h13c0 16-9 24-19 25" fill="none" stroke="url(#ggGold)" stroke-width="6" stroke-linecap="round"/>'+
     '<path d="M27 13h46v15c0 18-10 30-23 32-13-2-23-14-23-32z" fill="url(#ggGold)" stroke="#6b4a00" stroke-width="1.5"/><rect x="44" y="59" width="12" height="13" fill="url(#ggGoldD)"/>'+
     '<path d="M33 72h34l5 10H28z" fill="url(#ggGold)" stroke="#6b4a00" stroke-width="1.5"/><rect x="23" y="82" width="54" height="9" rx="2" fill="#3d1f08" stroke="#c99a2a" stroke-width="1.5"/>'+
     '<path d="M50 22l3.5 7.1 7.8 1.1-5.6 5.5 1.3 7.8-7-3.7-7 3.7 1.3-7.8-5.6-5.5 7.8-1.1z" fill="#fff8d6" opacity=".95"/><path d="M33 18c0 14 4 24 10 30" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/></g>')+
   sym('STADIUM','<g filter="url(#ggSh)"><path d="M13 60C9 32 31 11 56 12c22 1 37 18 36 40v6l-20 2-4 12c-8 6-24 8-36 6-10-2-17-8-19-18z" fill="url(#ggRed)" stroke="#3a0505" stroke-width="2"/>'+
     '<path d="M19 33C33 17 60 13 82 26" stroke="#fff" stroke-width="6" fill="none"/><path d="M19 33C33 17 60 13 82 26" stroke="#1a1a1a" stroke-width="1.5" fill="none" opacity=".35"/>'+
     '<circle cx="49" cy="53" r="6.5" fill="#2a0303"/><circle cx="49" cy="53" r="3" fill="#000"/>'+
     '<path d="M71 45h25M73 58h23M88 41v33M96 43v28M71 45c-2 10-2 21 3 29h16" stroke="url(#ggSilver)" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'+
     '<path d="M24 46c2-12 12-21 25-24" stroke="#fff" stroke-opacity=".45" stroke-width="4" fill="none" stroke-linecap="round"/></g>')+
   sym('PLAYBOOK','<g filter="url(#ggSh)" transform="rotate(-35 50 50)"><path d="M6 50C19 25 81 25 94 50 81 75 19 75 6 50z" fill="url(#ggBrown)" stroke="#2a1003" stroke-width="2"/>'+
     '<path d="M23 36c-3 8-3 20 0 28M77 36c3 8 3 20 0 28" stroke="#fff" stroke-width="4" fill="none"/><path d="M35 50h30" stroke="#fff" stroke-width="3.2"/><path d="M39 44.5v11M44.5 44.5v11M50 44.5v11M55.5 44.5v11M61 44.5v11" stroke="#fff" stroke-width="2.6"/>'+
     '<path d="M19 43c12-10 32-12 48-10" stroke="#fff" stroke-opacity=".3" stroke-width="3" fill="none" stroke-linecap="round"/></g>')+
   sym('BALL','<text x="50" y="81" text-anchor="middle" '+F+' font-size="76" fill="url(#ggBlue)" stroke="#0a1f4d" stroke-width="3.5" paint-order="stroke" filter="url(#ggSh)">A</text>')+
   sym('CAP','<text x="50" y="81" text-anchor="middle" '+F+' font-size="76" fill="url(#ggPurp)" stroke="#2a0650" stroke-width="3.5" paint-order="stroke" filter="url(#ggSh)">K</text>')+
   sym('WILD','<g filter="url(#ggSh)"><rect x="5" y="4" width="90" height="90" rx="14" fill="#140a22" stroke="url(#ggGold)" stroke-width="4"/><image href="/brand-96.png" x="15" y="6" width="70" height="70"/>'+
     '<path d="M0 68h100l-6 9.5 6 9.5H0l6-9.5z" fill="url(#ggRed)" stroke="#ffe08a" stroke-width="1.6"/><text x="50" y="84" text-anchor="middle" '+F+' font-size="16" fill="#fff" letter-spacing="2">WILD</text></g>')+
   sym('TICKET','<g filter="url(#ggSh)" transform="rotate(-8 50 50)"><path d="M6 27h88v13a6.5 6.5 0 0 0 0 20v13H6V60a6.5 6.5 0 0 0 0-20z" fill="url(#ggGold)" stroke="#6b4a00" stroke-width="2"/>'+
     '<rect x="15" y="33" width="70" height="34" rx="3" fill="none" stroke="#7a5300" stroke-width="1.5" stroke-dasharray="3 2"/><text x="50" y="49" text-anchor="middle" '+F+' font-size="15" fill="#6b1400">FREE</text><text x="50" y="63" text-anchor="middle" '+F+' font-size="12.5" fill="#6b1400">SPINS</text></g>')+
   sym('DRAFT','<g filter="url(#ggSh)"><rect x="43" y="5" width="14" height="10" rx="2" fill="url(#ggSilver)"/><path d="M71 15l7-6 5.5 5.5-6.5 7z" fill="url(#ggSilver)"/>'+
     '<circle cx="50" cy="48" r="34" fill="url(#ggSilver)" stroke="#333" stroke-width="2"/><circle cx="50" cy="48" r="27" fill="#fff" stroke="#c81e1e" stroke-width="3"/><g transform="translate(0 -2)">'+ticks+'</g>'+
     '<path d="M50 48V28" stroke="#111" stroke-width="3.2" stroke-linecap="round"/><path d="M50 48l13 8" stroke="#c81e1e" stroke-width="2.6" stroke-linecap="round"/><circle cx="50" cy="48" r="3.2" fill="#111"/>'+
     '<path d="M2 70h96l-5.5 9 5.5 9H2l5.5-9z" fill="url(#ggBlue)" stroke="#fff" stroke-width="1.6"/><text x="50" y="85" text-anchor="middle" '+F+' font-size="15" fill="#fff" letter-spacing="1.5">BONUS</text></g>')+
   '</svg>';
  document.body.appendChild(d)}
function gc(s){return '<div class="gc" data-s="'+s+'"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#gg-'+s+'"/></svg></div>'}
// Casino fonts are self-hosted in /fonts (SIL Open Font License), loaded only when the game opens.
function ggFonts(){if(document.getElementById('ggFont'))return;var st=document.createElement('style');st.id='ggFont';
  st.textContent=[['Bungee',400,'bungee-latin-400-normal'],['Orbitron',700,'orbitron-latin-700-normal'],['Orbitron',900,'orbitron-latin-900-normal']].map(function(f){return "@font-face{font-family:'"+f[0]+"';font-weight:"+f[1]+";font-style:normal;font-display:swap;src:url(/fonts/"+f[2]+".woff2) format('woff2')}"}).join('');
  document.head.appendChild(st);try{document.fonts&&document.fonts.load('400 20px Bungee');document.fonts&&document.fonts.load('900 20px Orbitron')}catch(e){}}

/* ---------- cabinet ---------- */
function slotRoot(){var el=document.getElementById('slot');if(!el){el=document.createElement('div');el.id='slot';el.className='slot';document.body.appendChild(el)}return el}
function bulbs(n){var h='';for(var i=0;i<n;i++)h+='<i></i>';return '<div class="gg-bulbs">'+h+'</div>'}
function jpHtml(bet){return GG_JP.map(function(j){return '<div class="gg-jp" style="--c:'+j[2]+'"><small>'+j[0]+'</small><b class="num" data-jpx="'+j[1]+'">'+gb(j[1]*bet)+'</b></div>'}).join('')}
function tabsHtml(side){var rows=[[],[],[]],L=(SL.pt&&SL.pt.lines)||[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1]];
  L.forEach(function(ln,i){rows[side?ln[4]:ln[0]].push(i)});
  return '<div class="gg-tabs">'+rows.map(function(r){return '<div class="rw">'+r.map(function(i){return '<i style="--c:'+GG_COL[i]+'">'+(i+1)+'</i>'}).join('')+'</div>'}).join('')+'</div>'}
var GR=[];
function ggStripOf(i){return SL.pt&&SL.pt.strips&&SL.pt.strips[i]?SL.pt.strips[i]:GG_SEQ}
function ggReelsInit(){for(var i=0;i<5;i++){if(!GR[i])GR[i]={i:i,p:Math.floor(Math.random()*30),mode:'idle',v:0,base:null};var s=ggStripOf(i);if(GR[i].s!==s){GR[i].s=s;GR[i].base=null;GR[i].p=Math.floor(Math.random()*s.length)}}}
function openSlot(){
  if(!LIVE){toast('Nice find. It only works in the live app.');return}
  if(!AUTH){toast('Log in to the Sportsbook to play');openLogin();return}
  ggFonts();ggSprite();aInit();
  SL.open=true;SL.auto=0;var el=slotRoot();el.classList.add('open');document.body.style.overflow='hidden';
  ggReelsInit();slotRender();ggMsg('Loading…');
  Promise.all([api('/slots/state'),SL.pt?Promise.resolve(SL.pt):api('/slots/paytable')]).then(function(r){SL.state=r[0];SL.pt=r[1];
    SL.cred=SL.state.balance-(SL.state.bonus?SL.state.bonus.total:0);SL.winShown=0;if(SL.state.free_bet)SL.bet=SL.state.free_bet;
    ggReelsInit();slotRender();aPlay('open');
    if(SL.state.bonus){SL.busy=true;ggSplash('drill',function(){SL.busy=false;drillStart(SL.state.bonus)})}
    else if(SL.state.free_left>0)ggMsg(SL.state.free_left+' free spins left · tap FREE');
    else ggMsg(SL.cred<SL.bet?'Not enough Bucks to spin':'Play 9 lines · good luck')}).catch(function(e){ggMsg(e.message)})}
function closeSlot(){if(SL.spinning||SL.busy||SL.roll)return;SL.open=false;SL.auto=0;ggStopCycle();aHum(false);var el=slotRoot();el.classList.remove('open');document.body.style.overflow='';bookLoad()}
function slotRender(){
  var el=slotRoot(),st=SL.state,free=!!(st&&st.free_left>0);
  el.innerHTML='<div class="gg">'+
   '<div class="gg-top"><button type="button" class="gg-ib" data-slx="1" aria-label="Close">✕</button><div class="gg-ttl">Mahomie\'s Hub · after hours</div>'+
    '<button type="button" class="gg-ib" data-slsnd="1" aria-label="Sound" id="ggSndBtn">'+sndIcon()+'</button>'+
    '<div class="gg-pop" id="ggSnd" hidden><div class="gg-pop-h">Sound</div><div class="gg-vol"><button type="button" class="gg-ib sm" data-slmute="1" aria-label="Mute">'+sndIcon()+'</button>'+
     '<input type="range" min="0" max="100" step="1" id="ggVol" value="'+Math.round((GGA.on?GGA.vol:0)*100)+'" aria-label="Volume"><b class="num" id="ggVolN">'+Math.round((GGA.on?GGA.vol:0)*100)+'</b></div>'+
     '<p class="gg-pop-p">iPhone: the ring/silent switch doesn\'t mute the game. Use this.</p></div>'+
    '<div class="gg-pop" id="ggAutoPop" hidden><div class="gg-pop-h">Auto spin</div><div class="gg-autos">'+[10,25,50].map(function(n){return '<button type="button" data-slauton="'+n+'">'+n+'</button>'}).join('')+'</div>'+
     '<p class="gg-pop-p">Stops on any feature or a big win. Tap STOP anytime.</p></div></div>'+
   '<div class="gg-cab'+(free?' free':'')+'" id="ggCab">'+
    '<div class="gg-marq">'+bulbs(17)+'<div class="gg-logo"><span>GRIDIRON</span><b>GOLD</b></div><div class="gg-tag" id="ggTag"></div>'+bulbs(17)+'</div>'+
    '<div class="gg-jps" id="ggJps">'+jpHtml(SL.bet)+'</div>'+
    '<div class="gg-win">'+tabsHtml(0)+'<div class="gg-reels" id="ggReels">'+[0,1,2,3,4].map(function(i){return '<div class="gg-reel" data-reel="'+i+'"><div class="gg-strip"></div></div>'}).join('')+'<svg class="gg-lines" id="ggLines"></svg></div>'+tabsHtml(1)+'</div>'+
    '<div class="gg-led" id="ggMsg"></div>'+
    '<div class="gg-meters"><div><small>Credit</small><b class="num cr" id="ggCred"></b></div><div><small>Bet</small><b class="num bt" id="ggBet"></b></div><div><small id="ggWinL">Win</small><b class="num wn" id="ggWin"></b></div></div>'+
    '<div class="gg-deck"><button type="button" class="gg-sm gg-i" data-slpt="1" aria-label="Paytable and rules">i</button><button type="button" class="gg-sm" data-slbet="-1" id="ggMinus" aria-label="Lower bet">−</button>'+
     '<button type="button" class="gg-spin" data-slspin="1" id="ggSpin"><span id="ggSpinT">SPIN</span><small id="ggSpinS"></small></button>'+
     '<button type="button" class="gg-sm" data-slbet="1" id="ggPlus" aria-label="Raise bet">+</button><button type="button" class="gg-sm gg-auto" data-slauto="1" id="ggAuto">AUTO</button></div>'+
   '</div>'+
   '<div class="gg-foot">Play money · '+(SL.pt?SL.pt.rtp:'92.5%')+' theoretical payback, the Las Vegas Strip average · every spin is independent</div></div>';
  ggBind();ggMeters();
}
function ggBind(){var box=document.getElementById('ggReels');if(!box)return;var r0=box.querySelector('.gg-reel');var w=r0.clientWidth||60,h=Math.round(w*.98);
  box.parentNode.style.setProperty('--ch',h+'px');
  GR.forEach(function(r,i){r.el=box.querySelector('[data-reel="'+i+'"]');r.strip=r.el.firstChild;r.h=h;r.base=null;rDraw(r)})}
function rDraw(r){if(!r.strip)return;var len=r.s.length;
  if(r.base==null||r.p<r.base||r.p>=r.base+8){r.base=Math.floor(r.p)-6;var h='';for(var k=r.base-1;k<=r.base+11;k++)h+=gc(r.s[((k%len)+len)%len]);r.strip.innerHTML=h}
  r.strip.style.transform='translate3d(0,'+(-(r.p-(r.base-1))*r.h).toFixed(2)+'px,0)'}
function cellEl(reel,row){var r=GR[reel];if(!r||!r.strip)return null;return r.strip.children[Math.round(r.p)+row-(r.base-1)]}
function eob(x){var c1=1.15,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)}
function ggLoop(t){var dt=SL.lt?Math.min(.05,(t-SL.lt)/1000):.016;SL.lt=t;var any=false;
  GR.forEach(function(r){
    if(r.mode==='spin'){any=true;var e=t-r.st;if(e>=0){if(e<110)r.p+=2.6*dt;else{r.v=Math.min(GG_V,r.v+GG_V*dt/.2);r.p-=r.v*dt}}if(r.el)r.el.classList.toggle('blur',r.v>10)}
    else if(r.mode==='stop'){any=true;var k=Math.max(0,Math.min(1,(t-r.t0)/r.dur));r.p=r.from+(r.to-r.from)*eob(k);if(r.el&&k>.4)r.el.classList.remove('blur');
      if(k>=1){r.p=r.to;r.mode='idle';rDraw(r);reelLanded(r);return}}
    rDraw(r)});
  if(any)SL.raf=requestAnimationFrame(ggLoop);else{SL.raf=null;SL.lt=0}}
function ggKick(){if(!SL.raf){SL.lt=0;SL.raf=requestAnimationFrame(ggLoop)}}
function reelStop(r,idx,quick){var D=quick?2.2:3.4;r.to=idx;r.from=idx+D;r.p=r.from;r.base=null;r.t0=performance.now();r.dur=D*4.15/GG_V*1000;r.mode='stop';r.v=GG_V;if(r.el)r.el.classList.remove('antic');ggKick()}
function ggMsg(t,cls){var m=document.getElementById('ggMsg');if(!m)return;m.textContent=t||'';m.className='gg-led'+(cls?' '+cls:'')}
function ggMeters(){var st=SL.state,free=!!(st&&st.free_left>0),$e=function(id){return document.getElementById(id)};
  if(!$e('ggCred'))return;
  $e('ggCred').textContent=st?gb(SL.cred):'—';$e('ggBet').textContent=SL.bet+(free?' ×'+fm():'');
  $e('ggWinL').textContent=free?'Free spin win':'Win';$e('ggWin').textContent=free?gb(st.free_won||0):SL.winShown?gb(SL.winShown):'0';
  var cab=$e('ggCab');if(cab)cab.classList.toggle('free',free);
  $e('ggTag').textContent=free?'★ Free spins · '+st.free_left+' left · all wins ×'+fm()+' ★':'9 lines · MH wild · Two-Minute Drill';
  var sp=$e('ggSpin');sp.className='gg-spin'+(SL.spinning?' stop':free?' free':'');$e('ggSpinT').textContent=SL.spinning?'STOP':free?'FREE':'SPIN';$e('ggSpinS').textContent=free&&!SL.spinning?st.free_left+' left':'';
  var lock=SL.spinning||free||!!SL.roll,bets=(SL.pt&&SL.pt.bets)||[10,25,50],bi=bets.indexOf(SL.bet);
  $e('ggMinus').disabled=lock||bi<=0;$e('ggPlus').disabled=lock||bi>=bets.length-1;
  var au=$e('ggAuto');au.textContent=SL.auto>0?'STOP '+SL.auto:'AUTO';au.classList.toggle('on',SL.auto>0);au.disabled=free&&!SL.auto;
  [].forEach.call(document.querySelectorAll('#ggJps [data-jpx]'),function(b){b.textContent=gb(+b.dataset.jpx*SL.bet)})}
function ggMetersFast(){var c=document.getElementById('ggCred'),w=document.getElementById('ggWin');if(c)c.textContent=gb(SL.cred);if(w)w.textContent=gb(SL.state&&SL.state.free_left>0&&SL.res&&SL.res.free?(SL.freeBase||0)+SL.winShown:SL.winShown)}

/* ---------- a spin ---------- */
function slotSpin(){
  if(!SL.state||SL.busy)return;
  if(SL.roll){ggRollEnd();return}
  if(SL.spinning){ggSlam();return}
  var free=SL.state.free_left>0;
  if(!free&&SL.cred<SL.bet){ggMsg(SL.cred<10?'Out of Bucks for the season':'Not enough Bucks for that bet','bad');SL.auto=0;ggMeters();aPlay('deny');return}
  aInit();ggStopCycle();ggClearMarks();ggPops(true);
  if(SL.auto>0&&!free)SL.auto--;
  SL.spinning=true;SL.res=null;SL.slam=false;SL.landed=0;SL.freeBase=free?(SL.state.free_won||0):0;SL.winShown=0;
  if(!free)SL.cred=Math.round((SL.cred-SL.bet)*100)/100;
  ggMeters();ggMsg(free?'Free spin · wins ×'+fm():'Good luck');
  aPlay('spin');aHum(true);
  var t=performance.now();GR.forEach(function(r,i){r.mode='spin';r.st=t+i*45;r.v=0});ggKick();
  var t0=Date.now();
  api('/slots/spin',{body:{bet:SL.bet}}).then(function(r){SL.res=r;var wait=SL.slam?0:Math.max(0,560-(Date.now()-t0));setTimeout(function(){ggSchedule(r)},wait)})
   .catch(function(e){GR.forEach(function(r){r.mode='idle';r.v=0;r.p=Math.round(r.p);if(r.el)r.el.classList.remove('blur')});aHum(false);SL.spinning=false;SL.auto=0;
     api('/slots/state').then(function(s){SL.state=s;SL.cred=s.balance;ggMeters()}).catch(function(){ggMeters()});ggMeters();ggMsg(e.message,'bad');aPlay('deny')})}
function ggAntic(g){var a=[false,false,false,false,false],tk=0;
  for(var i=0;i<5;i++){if(i>=2&&tk>=2)a[i]=true;tk+=g[i].filter(function(s){return s==='TICKET'}).length}
  if(g[0].indexOf('DRAFT')>=0&&g[1].indexOf('DRAFT')>=0)a[2]=true;return a}
function ggSchedule(r){SL.stopT.forEach(clearTimeout);SL.stopT=[];if(SL.slam){ggSlamStop();return}
  var ant=ggAntic(r.grid),t=0;
  for(var i=0;i<5;i++){if(i)t+=230;if(ant[i]){(function(i,ts){SL.stopT.push(setTimeout(function(){if(GR[i].el)GR[i].el.classList.add('antic');aPlay('antic')},ts))})(i,t);t+=1300}
    (function(i,ts){SL.stopT.push(setTimeout(function(){reelStop(GR[i],r.stops[i])},ts))})(i,t)}}
function ggSlam(){if(SL.slam)return;SL.slam=true;aPlay('click');if(SL.res)ggSlamStop()}
function ggSlamStop(){SL.stopT.forEach(clearTimeout);SL.stopT=[];var r=SL.res;GR.forEach(function(g,i){if(g.mode==='spin')reelStop(g,r.stops[i],true)})}
function reelLanded(r){var res=SL.res;if(!res)return;var col=res.grid[r.i],sp=col.indexOf('TICKET')>=0||(r.i<3&&col.indexOf('DRAFT')>=0);
  aPlay('stop',r.i);if(sp){SL.scat=(SL.scat||0);aPlay('scat',r.i)}
  try{if(navigator.vibrate)navigator.vibrate(sp?18:7)}catch(e){}
  if(sp)col.forEach(function(s,row){if(s==='TICKET'||(s==='DRAFT'&&r.i<3)){var c=cellEl(r.i,row);if(c)c.classList.add('pop')}});
  SL.landed++;if(SL.landed===5){aHum(false);setTimeout(ggDone,140)}}
function ggPops(off){[].forEach.call(document.querySelectorAll('#ggReels .gc.pop'),function(c){c.classList.remove('pop')})}
function ggClearMarks(){[].forEach.call(document.querySelectorAll('#ggReels .gc.win,#ggReels .gc.dim'),function(c){c.classList.remove('win','dim')});var sv=document.getElementById('ggLines');if(sv)sv.innerHTML=''}
function ggMark(cells){var on={};cells.forEach(function(c){on[c[0]+'-'+c[1]]=1});
  for(var i=0;i<5;i++)for(var row=0;row<3;row++){var e=cellEl(i,row);if(!e)continue;e.classList.toggle('win',!!on[i+'-'+row]);e.classList.toggle('dim',!on[i+'-'+row])}}
function ggLineSvg(items){var box=document.getElementById('ggReels'),sv=document.getElementById('ggLines');if(!box||!sv||!SL.pt)return;var B=box.getBoundingClientRect(),html='';
  sv.setAttribute('viewBox','0 0 '+B.width.toFixed(1)+' '+B.height.toFixed(1));
  items.forEach(function(it){if(it.line<0)return;var ln=SL.pt.lines[it.line],pts=[];
    GR.forEach(function(r,i){var c=r.el.getBoundingClientRect(),x=c.left-B.left+c.width/2,y=c.top-B.top+r.h*(ln[i]+.5);if(!i)pts.push([0,y]);pts.push([x,y]);if(i===4)pts.push([B.width,y])});
    var d=pts.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1)}).join(' ');
    html+='<polyline points="'+d+'" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="7.5" stroke-linejoin="round" stroke-linecap="round"/><polyline points="'+d+'" fill="none" stroke="'+GG_COL[it.line]+'" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>'});
  sv.innerHTML=html}
function ggShowAll(items){var all=[];items.forEach(function(it){all=all.concat(it.cells)});ggMark(all);ggLineSvg(items)}
function ggCycle(){ggStopCycle();var it=SL.items;if(!it||!it.length)return;if(it.length===1){ggMark(it[0].cells);ggLineSvg(it);ggMsg(it[0].label,'hot');return}
  var k=0,step=function(){var x=it[k%it.length];ggMark(x.cells);ggLineSvg([x]);ggMsg(x.label,'hot');k++};step();SL.cycleT=setInterval(step,1500)}
function ggStopCycle(){clearInterval(SL.cycleT);SL.cycleT=null}
function ggDone(){var r=SL.res;SL.spinning=false;var st=SL.state;
  st.free_left=r.free_left;st.free_bet=r.free_left>0?r.bet:null;st.balance=r.balance;
  var items=r.wins.map(function(w){return {line:w.line,cells:w.cells,label:'Line '+(w.line+1)+' · '+w.n+' '+GG_N[w.sym]+' · '+gb(w.pay)}});
  if(r.tickets>=3){var tc=[];r.grid.forEach(function(col,ri){col.forEach(function(s,row){if(s==='TICKET')tc.push([ri,row])})});items.push({line:-1,cells:tc,label:r.tickets+' tickets'+(r.scatter?' pay '+gb(r.scatter):'')+' · free spins!'})}
  if(r.bonus){var dc=[];[0,1,2].forEach(function(ri){r.grid[ri].forEach(function(s,row){if(s==='DRAFT')dc.push([ri,row])})});items.push({line:-1,cells:dc,label:'Two-Minute Drill!'})}
  SL.items=items;ggMeters();
  var next=function(){st.free_won=r.free_won;ggCycle();ggMeters();ggAfter(r)};
  if(r.win>0){ggShowAll(items);ggMsg('Win '+gb(r.win),'hot');var x=r.win/r.bet;
    if(x>=10)ggBig(r.win,r.bet,next);
    else{aPlay(x>=3?'win2':'win1');ggRoll(r.win,x<1?700:x<3?1300:2200,next)}}
  else if(items.length){ggShowAll(items);next()}
  else{ggMsg(r.free?r.free_left+' free spins left':'');st.free_won=r.free_won;ggMeters();ggAfter(r)}}
function ggRoll(amt,dur,cb){var base=SL.cred,t0=performance.now(),last=0;SL.roll={amt:amt,base:base,cb:cb,done:false};var me=SL.roll;ggMeters();
  function f(t){if(SL.roll!==me||me.done)return;var k=Math.min(1,(t-t0)/dur);SL.winShown=amt*k;SL.cred=base+amt*k;ggMetersFast();
    if(t-last>62&&k<1){last=t;aPlay('tick',k)}if(k>=1)ggRollEnd();else requestAnimationFrame(f)}
  requestAnimationFrame(f)}
function ggRollEnd(){var R=SL.roll;if(!R||R.done)return;R.done=true;SL.winShown=R.amt;SL.cred=Math.round((R.base+R.amt)*100)/100;SL.roll=null;ggMetersFast();aPlay('rollend');ggMeters();if(R.cb)R.cb()}
function ggAfter(r){
  if(r.free_awarded){SL.auto=0;ggSplash(r.free?'retrigger':'free',function(){if(r.bonus)ggBonusGo(r);else ggNextFree()},r.free_awarded);return}
  if(r.bonus){SL.auto=0;ggBonusGo(r);return}
  if(r.free_done){ggSplash('freedone',function(){SL.state.free_won=0;ggMeters();ggMsg('Free spins paid '+gb(r.free_won),'hot');ggAutoNext()},r.free_won);return}
  if(r.free&&r.free_left>0){ggNextFree();return}
  ggAutoNext()}
function ggNextFree(){ggMeters();setTimeout(function(){if(SL.open&&!SL.spinning&&!SL.busy&&SL.state.free_left>0)slotSpin()},SL.res&&SL.res.win>0?1700:800)}
function ggAutoNext(){ggMeters();if(SL.auto>0)setTimeout(function(){if(SL.open&&SL.auto>0&&!SL.spinning&&!SL.busy&&!SL.roll)slotSpin()},SL.res&&SL.res.win>0?1500:600)}
function ggBonusGo(r){SL.busy=true;ggMeters();setTimeout(function(){ggSplash('drill',function(){SL.busy=false;drillStart(r.bonus)})},500)}

/* ---------- celebrations ---------- */
function ggCoins(cv,n){var ctx=cv.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth||360,H=cv.clientHeight||700,P=[],spawned=0,last=0;
  cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  function add(){P.push({x:W*(.25+Math.random()*.5),y:H+20,vx:(Math.random()-.5)*W*.9,vy:-(H*1.05+Math.random()*H*.55),r:8+Math.random()*7,a:Math.random()*6,va:5+Math.random()*9})}
  function f(t){if(!cv.isConnected)return;var dt=last?Math.min(.04,(t-last)/1000):.016;last=t;
    for(var j=0;j<4&&spawned<n&&P.length<130;j++){add();spawned++}
    ctx.clearRect(0,0,W,H);
    for(var i=P.length-1;i>=0;i--){var p=P[i];p.vy+=H*1.5*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=p.va*dt;if(p.y>H+40&&p.vy>0){P.splice(i,1);continue}
      var sx=Math.max(.1,Math.abs(Math.cos(p.a)));ctx.save();ctx.translate(p.x,p.y);ctx.scale(sx,1);
      var g=ctx.createRadialGradient(-p.r*.35,-p.r*.35,1,0,0,p.r);g.addColorStop(0,'#fff6c9');g.addColorStop(.5,'#f6cf4c');g.addColorStop(1,'#9a6c05');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,p.r,0,6.3);ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle='#7a5300';ctx.stroke();ctx.beginPath();ctx.arc(0,0,p.r*.6,0,6.3);ctx.strokeStyle='rgba(122,83,0,.55)';ctx.stroke();ctx.restore()}
    if(spawned>=n&&!P.length)return;requestAnimationFrame(f)}
  requestAnimationFrame(f);return function(){n=spawned}}
var GG_SPLASH={
  free:function(n){return {icon:'TICKET',k:'Feature',t:'FREE SPINS',n:n,s:'Every win pays ×'+fm()+'. Land 3 more tickets for 10 more.',b:'Start'}},
  retrigger:function(n){return {icon:'TICKET',k:'Retrigger',t:'+'+n+' FREE SPINS',s:'More free spins added.',b:'Keep going'}},
  drill:function(){return {icon:'DRAFT',k:'Bonus',t:'TWO-MINUTE DRILL',s:'Every drive the 9 squares spin. When the play reel lands TOUCHDOWN, you collect the whole board. '+((SL.pt&&SL.pt.drill&&SL.pt.drill.drives)||8)+' drives.',b:'Let\'s go'}},
  freedone:function(n){return {icon:'TICKET',k:'Free spins complete',t:'YOU WON',n:gb(n),s:'Bucks',b:'Collect'}}};
function ggSplash(kind,then,arg){var el=slotRoot(),d=document.createElement('div'),c=GG_SPLASH[kind](arg);d.className='gg-splash k-'+kind;
  d.innerHTML='<canvas class="gg-coins"></canvas><div class="gg-sp-in"><div class="gg-sp-i">'+gc(c.icon)+'</div><div class="gg-sp-k">'+esc(c.k)+'</div><div class="gg-sp-t">'+esc(c.t)+'</div>'+(c.n!=null?'<div class="gg-sp-n num">'+esc(String(c.n))+'</div>':'')+'<div class="gg-sp-s">'+esc(c.s)+'</div><button type="button" class="gg-sp-b">'+esc(c.b)+'</button></div>';
  el.appendChild(d);aPlay(kind==='drill'?'drill':kind==='freedone'?'win2':'free');ggCoins(d.querySelector('canvas'),kind==='freedone'?70:kind==='drill'?30:45);
  var cab=document.getElementById('ggCab');if(cab)cab.classList.add('party');
  var go=function(){if(d._g)return;d._g=1;aPlay('click');d.classList.add('out');if(cab)cab.classList.remove('party');setTimeout(function(){d.remove();if(then)then()},300)};
  d.querySelector('.gg-sp-b').addEventListener('click',function(e){e.stopPropagation();aInit();go()})}
var GG_TIER=['','BIG WIN','MEGA WIN','EPIC WIN'];
function ggBig(amt,bet,cb,opt){opt=opt||{};SL.auto=0;var el=slotRoot(),d=document.createElement('div');d.className='gg-big';
  d.innerHTML='<div class="gg-rays"></div><canvas class="gg-coins"></canvas><div class="gg-big-in"><div class="gg-big-t" id="ggBigT">'+GG_TIER[1]+'</div><div class="gg-big-n num" id="ggBigN">0</div><div class="gg-big-s" id="ggBigS">Tap to skip</div></div>';
  el.appendChild(d);var x=amt/bet,dur=x>=50?8000:x>=25?6200:4200,stopCoins=ggCoins(d.querySelector('canvas'),99999),cab=document.getElementById('ggCab');if(cab)cab.classList.add('party');
  aPlay('big');var t0=performance.now(),base=SL.cred,lvl=1,done=false,last=0,auto=null;if(!opt.noCred)SL.roll={amt:amt,base:base,done:false,big:true};
  function show(v){var n=document.getElementById('ggBigN');if(n)n.textContent=gb(v);if(!opt.noCred){SL.winShown=v;SL.cred=base+v;ggMetersFast()}
    var cur=v/bet>=50?3:v/bet>=25?2:1;if(cur>lvl){lvl=cur;var tt=document.getElementById('ggBigT');if(tt){tt.textContent=GG_TIER[cur];tt.classList.remove('punch');void tt.offsetWidth;tt.classList.add('punch')}aPlay('lvl')}}
  function f(t){if(done)return;var k=Math.min(1,(t-t0)/dur);show(amt*(1-Math.pow(1-k,1.6)));if(t-last>75){last=t;aPlay('coin')}if(k>=1)finish();else requestAnimationFrame(f)}
  function finish(){if(done)return;done=true;show(amt);if(!opt.noCred){SL.cred=Math.round((base+amt)*100)/100;SL.winShown=amt;SL.roll=null;ggMetersFast()}aPlay('rollend');
    var s=document.getElementById('ggBigS');if(s)s.textContent='Tap to continue';auto=setTimeout(close,3200)}
  function close(){if(d._c)return;d._c=1;clearTimeout(auto);stopCoins();d.classList.add('out');if(cab)cab.classList.remove('party');setTimeout(function(){d.remove();ggMeters();if(cb)cb()},300)}
  d.addEventListener('click',function(e){e.stopPropagation();if(!done)finish();else close()});requestAnimationFrame(f)}

/* ---------- Two-Minute Drill (hold-and-spin bonus) ---------- */
var DR=null,TD_MISS=['INCOMPLETE','SACKED','PUNT','FUMBLE','PICKED OFF','3 &amp; OUT'];
function drCell(c,bet){if(!c||c.t==='blank')return '<div class="dc blank"><svg viewBox="0 0 100 100"><use href="#gg-PLAYBOOK"/></svg></div>';
  if(c.t==='val')return '<div class="dc coin"><b>'+gb(c.v*bet)+'</b></div>';
  if(c.t==='jp')return '<div class="dc coin jp jp-'+c.jp.toLowerCase()+'"><small>'+c.jp+'</small><b>'+gb(c.v*bet)+'</b></div>';
  return '<div class="dc coin xd"><b>+1</b><small>DRIVE</small></div>'}
function drFake(){var r=Math.random();return r<.5?{t:'blank'}:r<.86?{t:'val',v:[0.5,1,2,3,5][Math.floor(Math.random()*5)]}:r<.95?{t:'jp',jp:['MINI','MINOR','MAJOR'][Math.floor(Math.random()*3)],v:[5,15,50][Math.floor(Math.random()*3)]}:{t:'extra'}}
function tdc(td,lbl){return td?'<div class="tdc td"><b>TOUCH<br>DOWN!</b></div>':'<div class="tdc"><b>'+lbl+'</b></div>'}
function drillStart(b){var el=slotRoot(),ov=document.getElementById('slBonus');if(!ov){ov=document.createElement('div');ov.id='slBonus';ov.className='gg-drill';el.appendChild(ov)}
  var d0=(SL.pt&&SL.pt.drill&&SL.pt.drill.drives)||8;
  DR={b:b,i:-1,collected:0,drives:d0,done:false,timers:[],iv:null};
  ov.innerHTML='<div class="gg dr">'+
   '<div class="gg-top"><span></span><div class="gg-ttl">Gridiron Gold · bonus</div><button type="button" class="gg-ib" data-slmute="1" aria-label="Mute" id="drSnd">'+sndIcon()+'</button></div>'+
   '<div class="gg-cab free">'+
    '<div class="gg-marq">'+bulbs(17)+'<div class="gg-logo sm"><span>TWO-MINUTE</span><b>DRILL</b></div><div class="gg-tag">Score a touchdown · collect the board</div>'+bulbs(17)+'</div>'+
    '<div class="gg-jps">'+jpHtml(b.bet)+'</div>'+
    '<div class="dr-sb"><div><small>Drive</small><b class="num" id="drDrive">1 / '+d0+'</b></div><div><small>Collected</small><b class="num wn" id="drCol">0</b></div></div>'+
    '<div class="dr-field" id="drField"><div class="dr-grid">'+[0,1,2,3,4,5,6,7,8].map(function(i){return '<div class="dr-slot" data-dc="'+i+'">'+drCell(null,b.bet)+'</div>'}).join('')+'</div>'+
     '<div class="dr-play"><small>Play</small><div class="dr-td" id="drTd"><div class="dr-tds" id="drTds">'+tdc(false,'READY')+tdc(false,'HUT!')+tdc(false,'')+'</div></div></div></div>'+
    '<div class="gg-led" id="drMsg">First drive coming up</div>'+
    '<div class="dr-ctl" id="drCtl"><button type="button" class="gg-txt" data-drskip="1">Skip to the result</button></div>'+
   '</div></div>';
  var g=ov.querySelector('.dr-grid'),th=Math.round(g.clientHeight/3)||80;ov.querySelector('.dr-field').style.setProperty('--th',th+'px');
  var tds=document.getElementById('drTds');tds.style.transform='translate3d(0,0,0)';
  DR.timers.push(setTimeout(drillNext,1100))}
function drT(fn,ms){if(DR)DR.timers.push(setTimeout(fn,ms))}
function drSet(id,v){var e=document.getElementById(id);if(e)e.textContent=v}
function drMsg(t,cls){var m=document.getElementById('drMsg');if(m){m.innerHTML=t;m.className='gg-led'+(cls?' '+cls:'')}}
function drillNext(){if(!DR)return;DR.i++;var b=DR.b;if(DR.i>=b.frames.length){drillEnd();return}
  var f=b.frames[DR.i],slots=[].slice.call(document.querySelectorAll('.dr-slot'));
  drSet('drDrive',f.drive+' / '+DR.drives);drMsg('Drive '+f.drive+' · snap!');
  slots.forEach(function(s){s.classList.remove('land','got');s.classList.add('spin')});aPlay('dspin');
  clearInterval(DR.iv);DR.iv=setInterval(function(){slots.forEach(function(s){if(s.classList.contains('spin'))s.innerHTML=drCell(drFake(),b.bet)})},80);
  var k=0;function land(){if(!DR)return;if(k<9){var s=slots[k],c=f.cells[k];s.classList.remove('spin');s.innerHTML=drCell(c,b.bet);s.classList.add('land');
      if(c.t==='extra'){DR.drives=Math.min(20,DR.drives+1);drSet('drDrive',f.drive+' / '+DR.drives);aPlay('dextra')}else aPlay(c.t==='jp'?'djp':c.t==='val'?'dcoin':'dblank',k);
      k++;drT(land,95);return}
    clearInterval(DR.iv);DR.drives=f.drives;drSet('drDrive',f.drive+' / '+f.drives);
    var ex=f.cells.filter(function(c){return c.t==='extra'}).length;if(ex)drMsg('+'+ex+' extra drive'+(ex>1?'s':'')+'!','hot');
    drT(function(){drPlay(f)},ex?650:300)}
  drT(land,420)}
function drPlay(f){if(!DR)return;var tds=document.getElementById('drTds'),box=document.getElementById('drTd');if(!tds)return;var th=parseFloat(getComputedStyle(document.getElementById('drField')).getPropertyValue('--th'))||80;
  var n=14,h='',miss=function(){return TD_MISS[Math.floor(Math.random()*TD_MISS.length)]};
  for(var i=0;i<n;i++)h+=i===n-2?tdc(f.td,miss()):tdc(Math.random()<.25,miss());
  tds.innerHTML=h;box.classList.remove('yes','no');aPlay('drum');drMsg('Here\'s the play…');
  var end=-(n-3)*th;
  try{tds.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d(0,'+(end-th*.18)+'px,0)',offset:.86},{transform:'translate3d(0,'+end+'px,0)'}],{duration:900,easing:'cubic-bezier(.3,.1,.3,1)'})}catch(e){}
  tds.style.transform='translate3d(0,'+end+'px,0)';
  drT(function(){if(!DR)return;var b=DR.b;box.classList.add(f.td?'yes':'no');
    if(!f.td){aPlay('miss');drMsg('No score this drive','dim');drT(drillNext,1000);return}
    aPlay('td');drMsg('TOUCHDOWN!','hot');
    var slots=[].slice.call(document.querySelectorAll('.dr-slot')),hit=[];f.cells.forEach(function(c,i){if(c.v)hit.push(i)});
    if(!hit.length){drMsg('Touchdown! (empty board)','hot');drT(drillNext,1300);return}
    var j=0;function col(){if(!DR)return;if(j<hit.length){var i=hit[j],c=f.cells[i];slots[i].classList.add('got');DR.collected=Math.round((DR.collected+c.v*b.bet)*100)/100;drSet('drCol',gb(DR.collected));aPlay('collect',j);j++;drT(col,130);return}
      drMsg('TOUCHDOWN! +'+gb(f.got*b.bet),'hot');drT(drillNext,1500)}
    drT(col,600)},960)}
function drillEnd(){if(!DR)return;var b=DR.b;DR.done=true;clearInterval(DR.iv);DR.collected=b.total;drSet('drCol',gb(b.total));
  var tds=b.frames.filter(function(x){return x.td}).length;
  drMsg(b.total>0?'Drill over · '+tds+' touchdown'+(tds===1?'':'s'):'Drill over · no touchdowns',b.total>0?'hot':'dim');
  var c=document.getElementById('drCtl');if(c)c.innerHTML='<div class="dr-sum"><div><small>Drives</small><b class="num">'+b.frames.length+'</b></div><div><small>Touchdowns</small><b class="num">'+tds+'</b></div><div><small>Total</small><b class="num wn">'+gb(b.total)+'</b></div></div><button type="button" class="gg-sp-b" data-slcollect="1">Collect '+gb(b.total)+'</button>';
  if(b.total>=b.bet*10)drT(function(){ggBig(b.total,b.bet,null,{noCred:true})},500);else if(b.total>0)aPlay('win2')}
function drillSkip(){if(!DR||DR.done)return;DR.timers.forEach(clearTimeout);DR.timers=[];clearInterval(DR.iv);var b=DR.b,f=b.frames[b.frames.length-1];
  if(f){var slots=[].slice.call(document.querySelectorAll('.dr-slot'));slots.forEach(function(s,i){s.classList.remove('spin','land','got');s.innerHTML=drCell(f.cells[i],b.bet);if(f.td&&f.cells[i].v)s.classList.add('got')});
    drSet('drDrive',f.drive+' / '+f.drives);var tds=document.getElementById('drTds'),box=document.getElementById('drTd');if(tds){tds.getAnimations&&tds.getAnimations().forEach(function(a){a.cancel()});tds.style.transform='translate3d(0,0,0)';tds.innerHTML=tdc(false,'')+tdc(f.td,'FINAL')+tdc(false,'')}
    if(box){box.classList.remove('yes','no');box.classList.add(f.td?'yes':'no')}}
  drillEnd()}
function bonusClose(){if(DR){DR.timers.forEach(clearTimeout);clearInterval(DR.iv)}var ov=document.getElementById('slBonus');if(ov)ov.remove();var b=DR&&DR.b||SL.state&&SL.state.bonus;DR=null;
  if(SL.state)SL.state.bonus=null;
  api('/slots/bonus-seen',{method:'POST'}).catch(function(){});
  var total=b?b.total:0;SL.items=null;ggStopCycle();ggClearMarks();
  api('/slots/state').then(function(st){var fw=SL.state?SL.state.free_won:0;SL.state=st;if(st.free_left>0)st.free_won=st.free_won||fw;
    var target=st.balance;SL.cred=Math.round((target-total)*100)/100;ggMeters();
    if(total>0){ggMsg('Two-Minute Drill paid '+gb(total),'hot');ggRoll(total,1500,function(){SL.cred=target;ggMeters();if(st.free_left>0)ggNextFree()})}
    else{SL.cred=target;ggMeters();if(st.free_left>0)ggNextFree()}}).catch(function(){ggMeters()})}

/* ---------- paytable & rules ---------- */
function paytableSheet(){var pt=SL.pt;if(!pt)return;var bet=SL.bet,lb=bet/9,el=slotRoot(),ov=document.createElement('div'),par=pt.par||{};ov.className='gg-pt';
  var mini=function(ln,i){var h='';for(var r=0;r<3;r++)for(var c=0;c<5;c++)h+='<i'+(ln[c]===r?' style="background:'+GG_COL[i]+'"':'')+'></i>';return '<div class="gg-pl"><div class="plg">'+h+'</div><small>'+(i+1)+'</small></div>'};
  ov.innerHTML='<div class="gg-pt-in"><div class="gg-logo sm"><span>PAY</span><b>TABLE</b></div><p class="gg-pt-sub">Prizes shown at your bet of <b>'+bet+' Bucks</b> a spin (9 lines). Wins pay left to right; the best win on each line counts.</p>'+
   '<div class="pt-grid">'+['WILD','RING','TROPHY','STADIUM','PLAYBOOK','BALL','CAP'].map(function(s){var p=pt.pays[s];return '<div class="pt-c">'+gc(s)+'<div class="pt-v"><span><em>5</em>'+gb(p[2]*lb)+'</span><span><em>4</em>'+gb(p[1]*lb)+'</span><span><em>3</em>'+gb(p[0]*lb)+'</span></div><small>'+GG_N[s]+'</small></div>'}).join('')+'</div>'+
   '<div class="pt-sp">'+gc('WILD')+'<div><b>MH Wild</b><p>Reels 2, 3 and 4. Stands in for every picture except the ticket and the stopwatch. Five wilds in a row pays the top prize: '+gb(pt.pays.WILD[2]*lb)+'.</p></div></div>'+
   '<div class="pt-sp">'+gc('TICKET')+'<div><b>Free Spins</b><p>3, 4 or 5 tickets anywhere pay '+pt.ticket_pays.map(function(x){return gb(x*bet)}).join(' / ')+' and start '+pt.free_spins+' free spins at your bet. Every free-spin win pays ×'+pt.free_mult+'. 3 more tickets add 10 more.</p></div></div>'+
   '<div class="pt-sp">'+gc('DRAFT')+'<div><b>Two-Minute Drill</b><p>A stopwatch on reels 1, 2 and 3 starts the bonus: '+pt.drill.drives+' drives on a 3×3 board. Each drive the squares spin to Bucks, jackpot coins (GRAND '+gb(250*bet)+' · MAJOR '+gb(50*bet)+' · MINOR '+gb(15*bet)+' · MINI '+gb(5*bet)+'), +1 DRIVE (up to '+pt.drill.max+') or nothing. When the play reel lands TOUCHDOWN you collect everything on the board.</p></div></div>'+
   '<div class="pt-h">The 9 paylines</div><div class="pt-lines">'+pt.lines.map(mini).join('')+'</div>'+
   '<div class="pt-h">The math (par sheet)</div><div class="pt-par">'+
    [['Payback',(par.rtp?(par.rtp*100).toFixed(1):'92.5')+'%','Theoretical, over the long run. That\'s the Las Vegas Strip average (Nevada\'s legal minimum is 75%).'],
     ['Hit frequency','1 in '+(par.hit?(1/par.hit).toFixed(1):'2.8'),'How often a spin pays something (many pay less than the bet, like a real slot).'],
     ['Free Spins','1 in '+(par.free_odds||158),'Spins, on average, between free-spin features.'],
     ['Two-Minute Drill','1 in '+(par.bonus_odds||187),'Averages about '+(par.drill_avg||31)+'× your bet.'],
     ['Every spin','Independent','A random stop on each reel from the server\'s secure random number generator. The game has no memory: it\'s never "due", and a loss doesn\'t make a win more likely.']]
    .map(function(r){return '<div class="gg-pp"><b>'+r[0]+'</b><span class="num">'+r[1]+'</span><p>'+r[2]+'</p></div>'}).join('')+'</div>'+
   '<p class="gg-pt-sub">Spins come out of your Mahomie Bucks. Going broke still means you\'re done for the season.</p>'+
   '<button type="button" class="gg-sp-b" data-slptx="1">Back to the game</button></div>';
  el.appendChild(ov);aPlay('click')}

/* ---------- controls ---------- */
function ggPop(id,show){[].forEach.call(document.querySelectorAll('#slot .gg-pop'),function(p){p.hidden=p.id===id?(show==null?!p.hidden:!show):true})}
document.addEventListener('click',function(e){
  var t=e.target;
  if(t.closest&&t.closest('[data-egg]')){if(S.tab==='book')openSlot();return}
  if(!SL.open)return;
  if(!(t.closest&&t.closest('.gg-pop,[data-slsnd],[data-slauto]')))ggPop(null,false);
  var b=t.closest&&t.closest('button');if(!b)return;var d=b.dataset;
  if(d.slx){closeSlot();return}
  if(d.slbet){var bets=(SL.pt&&SL.pt.bets)||[10,25,50],i=bets.indexOf(SL.bet)+(+d.slbet);if(i>=0&&i<bets.length&&!SL.spinning&&!(SL.state&&SL.state.free_left>0)){SL.bet=bets[i];aPlay('click');ggMeters()}return}
  if(d.slspin){slotSpin();return}
  if(d.slsnd){aInit();ggPop('ggSnd');return}
  if(d.slmute){aInit();GGA.on=!(GGA.on&&GGA.vol>0);if(GGA.on&&GGA.vol<=0)GGA.vol=.7;aSet();ggSndUi();if(GGA.on)aPlay('click');return}
  if(d.slauto){if(SL.auto>0){SL.auto=0;ggMeters();return}ggPop('ggAutoPop');return}
  if(d.slauton){ggPop(null,false);SL.auto=+d.slauton;aPlay('click');ggMeters();if(!SL.spinning&&!SL.roll)slotSpin();return}
  if(d.drskip){drillSkip();return}
  if(d.slcollect){aPlay('click');bonusClose();return}
  if(d.slpt){paytableSheet();return}
  if(d.slptx){var p=document.querySelector('.gg-pt');if(p)p.remove();aPlay('click');return}
});
function ggSndUi(){var v=Math.round((GGA.on?GGA.vol:0)*100);[].forEach.call(document.querySelectorAll('#ggSndBtn,[data-slmute]'),function(x){x.innerHTML=sndIcon()});var r=document.getElementById('ggVol'),n=document.getElementById('ggVolN');if(r)r.value=v;if(n)n.textContent=v}
document.addEventListener('input',function(e){if(e.target&&e.target.id==='ggVol'){GGA.vol=(+e.target.value)/100;GGA.on=GGA.vol>0;aSet();var n=document.getElementById('ggVolN');if(n)n.textContent=e.target.value;[].forEach.call(document.querySelectorAll('#ggSndBtn,[data-slmute]'),function(x){x.innerHTML=sndIcon()})}});
document.addEventListener('change',function(e){if(e.target&&e.target.id==='ggVol')aPlay('win1')});
document.addEventListener('keydown',function(e){if(!SL.open||e.code!=='Space'||document.getElementById('slBonus')||document.querySelector('.gg-pt,.gg-splash,.gg-big'))return;e.preventDefault();slotSpin()});
window.addEventListener('resize',function(){if(SL.open&&!SL.spinning)ggBind()});
if(location.port==='3999')window.__GG={SL:SL,big:ggBig,splash:ggSplash}; // local test hook only

/* ---------- ME / PROFILE ---------- */
function profile(u,isMe){
  var a=D.alltime.find(function(x){return x.uid===u});var m=M(u);
  var h='<section class="hero"><div style="display:flex;gap:12px;align-items:center">'+av(u,56)+'<div style="min-width:0"><div class="eyebrow">'+(isMe?'Playing as':'Manager')+(m.active?'':' · former')+'</div><h1 style="font-size:24px;letter-spacing:-.7px;margin:4px 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(team(u))+'</h1><p class="sub">'+esc(m.name)+'</p></div></div>'+
   '<div class="tiles"><div class="tile t-y"><small>Titles</small><strong>'+a.titles.length+'</strong><span>'+(a.titles.join(', ')||'Not yet')+'</span></div>'+
   '<div class="tile t-b"><small>Career W-L</small><strong class="num">'+a.w+'-'+a.l+'</strong><span>'+(a.pct*100).toFixed(1)+'% · '+f1(a.avg)+' ppg</span></div>'+
   '<button type="button" class="tile t-g" data-game="'+gi(a.best.s,a.best.w,u)+'"><small>Best week ›</small><strong class="num">'+f2(a.best.v)+'</strong><span>'+sw(a.best.s,a.best.w)+'</span></button>'+
   '<button type="button" class="tile t-r" data-game="'+gi(a.worst.s,a.worst.w,u)+'"><small>Worst week ›</small><strong class="num">'+f2(a.worst.v)+'</strong><span>'+sw(a.worst.s,a.worst.w)+'</span></button></div></section>';
  var tr=[];a.titles.forEach(function(s){tr.push('<span class="tr c">🏆 Champion '+s+'</span>')});a.runner.forEach(function(s){tr.push('<span class="tr r">🥈 Runner-up '+s+'</span>')});a.third.forEach(function(s){tr.push('<span class="tr r">🥉 Third '+s+'</span>')});a.sacko.forEach(function(s){tr.push('<span class="tr s">🚽 Sacko '+s+'</span>')});
  a.playoffs.forEach(function(s){tr.push('<span class="tr p">Playoffs '+s+'</span>')});
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Trophy case</div><h2>Hardware</h2></div></div><div class="trophies">'+(tr.join('')||'<span class="muted">Empty for now.</span>')+'</div>'+
   '<div class="stat3" style="margin-top:12px"><div class="stat"><small>🔥 On Fire</small><strong>'+a.tb+'</strong><span>weeks</span></div><div class="stat"><small>🧊 Ice Cold</small><strong>'+a.rb+'</strong><span>weeks</span></div><div class="stat"><small>Playoff W-L</small><strong>'+a.pw+'-'+a.pl+'</strong><span>bracket games</span></div></div></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Season by season</div><h2>Career line</h2></div></div><div class="rows">'+
   a.seasons.slice().reverse().map(function(x){var fin=D.seasons[x.s];var tag=fin.champ===u?'🏆 Champion':fin.runner===u?'🥈 Runner-up':fin.sacko===u?'🚽 Sacko':x.s===CUR()?'In progress':'Seed '+x.seed;
     return '<div class="row"><div><b style="font-size:14px">'+x.s+' · '+esc(x.team)+'</b><div class="muted" style="font-size:11.5px">'+tag+'</div></div><div class="val" style="font-size:14px">'+x.rec+'<small>'+f1(x.pf)+' PF</small></div></div>'}).join('')+'</div></section>';
  var opp=ids.filter(function(o){return o!==u&&D.h2h[u+'|'+o]}).map(function(o){var r=D.h2h[u+'|'+o];return {o:o,w:r.w,l:r.l,n:r.games.length}});
  opp.sort(function(a,b){return (b.w-b.l)-(a.w-a.l)||b.n-a.n});
  if(opp.length){
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Head to head</div><h2>Record vs everyone</h2></div></div><div class="rows">'+
     opp.map(function(x){return '<div class="row">'+who(x.o,x.n+(x.n===1?' game':' games'),28)+'<span class="val" style="font-size:14px;color:'+(x.w>x.l?'var(--win)':x.w<x.l?'var(--loss)':'var(--ink)')+'">'+x.w+'-'+x.l+'</span></div>'}).join('')+'</div></section>';
  }
  return h;
}
function me(){
  var act=ids.filter(function(u){return M(u).active}),h;
  if(AUTH)h='<section class="panel"><div class="ph" style="margin:0"><div><div class="kicker">Logged in to the Sportsbook</div><h2 style="font-size:18px">'+esc(team(AUTH.user_id))+'</h2></div><button type="button" class="x" data-logout="1">Log out</button></div></section>';
  else h='<section class="panel"><label for="meSel" class="kicker" style="display:block;margin-bottom:6px">Who are you?</label><select id="meSel">'+act.map(function(u){return '<option value="'+u+'"'+(u===S.me?' selected':'')+'>'+esc(team(u))+' · '+esc(M(u).name)+'</option>'}).join('')+'</select>'+
    (LIVE?'<p class="muted" style="font-size:11.5px;margin-top:6px">Just browsing. Log in with your team PIN to bet.</p><button type="button" class="cta" data-login="1" style="margin-top:10px">Log in to the Book</button>':'<p class="muted" style="font-size:11.5px;margin-top:6px">Pick your team to see your stats.</p>')+'</section>';
  h+=profile(S.me,true);
  h+=explainPanel();
  h+=admPanel();
  return h+foot();
}

/* ---------- GAME DETAIL ---------- */
var RN={high:'Highest score',low:'Lowest score',blowout:'Biggest blowout',close:'Closest game',hiloss:'Most points in a loss',lowin:'Fewest points in a win',player:'Best player game'};
function tnS(s,u){return ((D.seasons[s]&&D.seasons[s].team_names[u])||M(u).name).trim()}
function gameRecs(g){var out=[];
  ['high','low','player'].forEach(function(k){D.records[k].forEach(function(x,i){if(x.s===g.s&&x.w===g.w&&(x.uid===g.win||x.uid===g.lose))out.push({k:k,n:i+1})})});
  ['blowout','close','hiloss','lowin'].forEach(function(k){D.records[k].forEach(function(x,i){if(x.s===g.s&&x.w===g.w&&x.win===g.win&&x.lose===g.lose)out.push({k:k,n:i+1})})});
  return out.sort(function(a,b){return a.n-b.n})}
function entering(g,u){var w=0,l=0;D.games.forEach(function(x){if(x.s!==g.s||x.w>=g.w||x.k!=='Regular season')return;if(x.win===u)w++;else if(x.lose===u)l++});return w+'-'+l}
function series(g){var a=0,b=0;D.games.forEach(function(x){if(x.s>g.s||(x.s===g.s&&x.w>g.w))return;if(x.win===g.win&&x.lose===g.lose)a++;else if(x.win===g.lose&&x.lose===g.win)b++});return [a,b]}
function weekScores(s,w){var out=[];Object.keys(D.tw).forEach(function(k){var p=k.split('|');if(p[0]===s&&+p[1]===w&&D.tw[k][0]>0)out.push({u:p[2],p:D.tw[k][0]})});return out.sort(function(a,b){return b.p-a.p})}
function topP(s,w,u){var t=D.tw[s+'|'+w+'|'+u];if(!t)return null;var pid=t[1];return {name:D.names[pid]||(/^[A-Z]+$/.test(pid)?pid+' defense':null),pts:t[2]}}
function ord(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function gameSheet(i){
  var g=D.games[i];if(!g)return '<p class="muted">Game not found.</p>';
  var ws=weekScores(g.s,g.w),rank=function(u){for(var j=0;j<ws.length;j++)if(ws[j].u===u)return j+1;return '–'},avg=ws.reduce(function(a,x){return a+x.p},0)/Math.max(1,ws.length),sr=series(g),recs=gameRecs(g);
  var side=function(u,p,won){return '<div class="sb-row'+(won?' won':'')+'">'+who(u,tnS(g.s,u)===team(u)?M(u).name:'as '+tnS(g.s,u),40)+'<div class="sb-pts num">'+f2(p)+'</div></div>'};
  var h='<section class="hero gs"><div class="eyebrow">'+g.s+' · Week '+g.w+' · '+esc(g.k)+'</div><div class="sb">'+side(g.win,g.wp,true)+side(g.lose,g.lp,false)+'</div>'+
   '<p class="margin">'+esc(tnS(g.s,g.win))+' won by <b class="num">'+f2(g.m)+'</b></p>'+
   (recs.length?'<div class="badges">'+recs.map(function(r){return '<span class="badge">#'+r.n+' '+RN[r.k]+'</span>'}).join('')+'</div>':'')+'</section>';
  var pa=topP(g.s,g.w,g.win),pb=topP(g.s,g.w,g.lose);
  var pr=function(u,p){return '<div class="row"><div><b style="font-size:14px">'+esc(p&&p.name?p.name:'Top scorer')+'</b><div class="muted" style="font-size:11.5px">for '+esc(tnS(g.s,u))+'</div></div><span class="val">'+(p?f1(p.pts):'–')+'</span></div>'};
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Best player on each side</div><h2>Top performers</h2></div></div><div class="rows">'+pr(g.win,pa)+pr(g.lose,pb)+'</div></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">The matchup</div><h2>By the numbers</h2></div></div><div class="stat3">'+
   '<div class="stat"><small>Came in</small><strong>'+entering(g,g.win)+'</strong><span>'+esc(M(g.win).name)+'</span></div>'+
   '<div class="stat"><small>All-time series</small><strong>'+sr[0]+'-'+sr[1]+'</strong><span>after this game</span></div>'+
   '<div class="stat"><small>Came in</small><strong>'+entering(g,g.lose)+'</strong><span>'+esc(M(g.lose).name)+'</span></div></div>'+
   '<div class="stat3" style="margin-top:8px"><div class="stat"><small>Week rank</small><strong>'+ord(rank(g.win))+'</strong><span>of '+ws.length+'</span></div><div class="stat"><small>League avg</small><strong>'+f1(avg)+'</strong><span>that week</span></div><div class="stat"><small>Week rank</small><strong>'+ord(rank(g.lose))+'</strong><span>of '+ws.length+'</span></div></div></section>';
  var mx=ws.length?ws[0].p:1;
  h+='<section class="panel"><div class="ph"><div><div class="kicker">'+g.s+' · Week '+g.w+'</div><h2>Every score that week</h2></div></div>'+
   ws.map(function(x,j){var hl=x.u===g.win||x.u===g.lose;return '<div class="wk'+(hl?' hl':'')+'"><span class="rk'+(j===0?' gold':'')+'" style="width:22px;height:22px;font-size:10px">'+(j+1)+'</span><div style="min-width:0"><b>'+esc(tnS(g.s,x.u))+'</b><div class="bar"><i style="width:'+(x.p/mx*100).toFixed(1)+'%"></i></div></div><span class="p">'+f2(x.p)+'</span></div>'}).join('')+'</section>';
  h+=LIVE?'<section class="panel"><div class="ph"><div><div class="kicker">Box score</div><h2>Lineups</h2></div></div><div id="lineups"><p class="muted">Loading lineups from Sleeper…</p></div></section>':
    '<p class="note"><b>Full lineups coming.</b> Every starter and bench player with their points loads straight from Sleeper once the app is live on Railway.</p>';
  return h;
}

function loadLineups(i){
  if(!LIVE)return;var g=D.games[i];
  fetch('/api/game?season='+g.s+'&week='+g.w+'&users='+g.win+','+g.lose).then(function(r){return r.json()}).then(function(d){
    var el=document.getElementById('lineups');if(!el)return;
    if(!d||!d.teams||d.error){el.innerHTML='<p class="err">Couldn\'t load lineups: '+esc(d&&d.error||'unknown error')+'</p>';return}
    el.innerHTML=lineupHtml(g,d);
  }).catch(function(){var el=document.getElementById('lineups');if(el)el.innerHTML='<p class="err">Couldn\'t reach the server for lineups.</p>'});
}
function lineupHtml(g,d){
  var A=d.teams[0],B=d.teams[1],n=Math.max(A.starters.length,B.starters.length);
  var pl=function(p,side){if(!p)return '<div class="pl '+side+'"></div>';return '<div class="pl '+side+'"><b>'+esc(p.name)+'</b><span>'+esc([p.pos,p.team].filter(Boolean).join(' · '))+'</span></div>'};
  var h='<div class="ln head"><span class="pl a">'+esc(tnS(g.s,g.win))+'</span><span></span><span></span><span></span><span class="pl b">'+esc(tnS(g.s,g.lose))+'</span></div>';
  for(var j=0;j<n;j++){var a=A.starters[j],b=B.starters[j],ap=a?a.pts:0,bp=b?b.pts:0;
    h+='<div class="ln">'+pl(a,'a')+'<span class="pp'+(ap>bp?' hi':'')+'">'+(a?f1(ap):'')+'</span><span class="slot">'+esc((a||b).slot.replace('SUPER_FLEX','SF').replace('FLEX','FLX'))+'</span><span class="pp'+(bp>ap?' hi':'')+'">'+(b?f1(bp):'')+'</span>'+pl(b,'b')+'</div>'}
  h+='<div class="ln tot"><span class="pl a">Total</span><span class="pp hi">'+f2(A.points)+'</span><span class="slot"></span><span class="pp">'+f2(B.points)+'</span><span class="pl b"></span></div>';
  var bench=function(t,u){var tot=t.bench.reduce(function(x,p){return x+p.pts},0);
    return '<details class="bench"><summary>'+esc(tnS(g.s,u))+' bench · '+f1(tot)+' pts</summary>'+t.bench.map(function(p){return '<div class="bn"><div class="pl a"><b>'+esc(p.name)+'</b><span>'+esc([p.pos,p.team].filter(Boolean).join(' · '))+'</span></div><span class="pp">'+f1(p.pts)+'</span></div>'}).join('')+'</details>'};
  return h+bench(A,g.win)+bench(B,g.lose);
}

/* ---------- BYE WEEK ---------- */
function byeSheet(key){
  var p=key.split('|'),s=p[0],w=+p[1],u=p[2],t=D.tw[key],ws=weekScores(s,w),rk=0;
  ws.forEach(function(x,j){if(x.u===u)rk=j+1});
  var tp=topP(s,w,u),avg=ws.reduce(function(a,x){return a+x.p},0)/Math.max(1,ws.length),mx=ws.length?ws[0].p:1;
  var h='<section class="hero gs"><div class="eyebrow">'+s+' · Week '+w+' · Playoff bye</div><div class="sb"><div class="sb-row won">'+who(u,tnS(s,u)===team(u)?M(u).name:'as '+tnS(s,u),40)+'<div class="sb-pts num">'+f2(t[0])+'</div></div></div>'+
   '<p class="margin">Earned a first-round bye, so there was no opponent. Sleeper still scored the lineup.</p></section>';
  h+='<section class="panel"><div class="stat3"><div class="stat"><small>Week rank</small><strong>'+ord(rk)+'</strong><span>of '+ws.length+'</span></div><div class="stat"><small>League avg</small><strong>'+f1(avg)+'</strong><span>that week</span></div><div class="stat"><small>Top scorer</small><strong>'+(tp?f1(tp.pts):'–')+'</strong><span>'+esc(tp&&tp.name||'player')+'</span></div></div></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">'+s+' · Week '+w+'</div><h2>Every score that week</h2></div></div>'+
   ws.map(function(x,j){var hl=x.u===u;return '<div class="wk'+(hl?' hl':'')+'"><span class="rk'+(j===0?' gold':'')+'" style="width:22px;height:22px;font-size:10px">'+(j+1)+'</span><div style="min-width:0"><b>'+esc(tnS(s,x.u))+'</b><div class="bar"><i style="width:'+(x.p/mx*100).toFixed(1)+'%"></i></div></div><span class="p">'+f2(x.p)+'</span></div>'}).join('')+'</section>';
  h+=LIVE?'<section class="panel"><div class="ph"><div><div class="kicker">Box score</div><h2>Lineup</h2></div></div><div id="lineups"><p class="muted">Loading lineup from Sleeper…</p></div></section>':
    '<p class="note"><b>Full lineup</b> loads from Sleeper in the live app.</p>';
  return h;
}
function loadByeLineup(key){
  if(!LIVE)return;var p=key.split('|');
  fetch('/api/game?season='+p[0]+'&week='+p[1]+'&users='+p[2]).then(function(r){return r.json()}).then(function(d){
    var el=document.getElementById('lineups');if(!el)return;var T=d&&d.teams&&d.teams[0];
    if(!T||!T.starters.length){el.innerHTML='<p class="err">Couldn\'t load the lineup.</p>';return}
    var row=function(x){return '<div class="bn"><div class="pl a"><b>'+esc(x.name)+'</b><span>'+esc((x.slot?x.slot.replace('FLEX','FLX')+' · ':'')+[x.pos,x.team].filter(Boolean).join(' · '))+'</span></div><span class="pp hi">'+f1(x.pts)+'</span></div>'};
    el.innerHTML=T.starters.map(row).join('')+'<details class="bench"><summary>Bench · '+f1(T.bench.reduce(function(a,x){return a+x.pts},0))+' pts</summary>'+T.bench.map(row).join('')+'</details>';
  }).catch(function(){var el=document.getElementById('lineups');if(el)el.innerHTML='<p class="err">Couldn\'t reach the server.</p>'});
}

/* ---------- MATCHUP PREVIEW ---------- */
function sdOf(arr){if(arr.length<2)return 0;var m=arr.reduce(function(a,b){return a+b},0)/arr.length;return Math.sqrt(arr.reduce(function(a,b){return a+(b-m)*(b-m)},0)/arr.length)}
function scores26(u){var o=[];for(var w=1;w<=D.league.last_scored;w++){var p=P26(w,u);if(p!=null)o.push({w:w,p:p})}return o}
function P26(w,u){var t=D.tw[CUR()+'|'+w+'|'+u];return t?t[0]:null}
function oddsOf(u){return D.odds.list.find(function(o){return o.uid===u})}
function powOf(u){return D.power.find(function(p){return p.uid===u})}
function recOf(u){var st=(D.seasons[CUR()].standings||[]).find(function(x){return x.uid===u});return st?st.w+'-'+st.l+' · '+ord(st.seed)+' place':''}
function previewSheet(id,fromBook){
  var l=line(id),a=l.a,b=l.b,pa=Math.round(l.wp*100),A=scores26(a),B=scores26(b);
  var avg=function(x){return x.reduce(function(s,y){return s+y.p},0)/Math.max(1,x.length)};
  var sA=sdOf(A.map(function(x){return x.p})),sB=sdOf(B.map(function(x){return x.p}));
  var r=D.h2h[a+'|'+b]||{w:0,l:0,games:[]},last=r.games[r.games.length-1];
  var pwA=powOf(a),pwB=powOf(b),oA=oddsOf(a),oB=oddsOf(b);
  var sb=function(u,live,rec){return '<div class="sb-row">'+who(u,rec+' · power #'+powOf(u).rank,40)+'<div class="sb-pts num" style="font-size:24px">'+f2(live)+'</div></div>'};
  var h='<section class="hero gs"><div class="eyebrow">Week '+D.league.week+' preview · live</div><div class="sb">'+sb(a,l.live_a,pwA.rec)+sb(b,l.live_b,pwB.rec)+'</div>'+
   (fromBook?'<div class="wp"><div class="wp-l"><span>'+esc(team(a))+'</span><b>'+pa+'%</b></div><div class="wp-bar"><i style="width:'+pa+'%"></i></div><div class="wp-l r"><b>'+(100-pa)+'%</b><span>'+esc(team(b))+'</span></div></div>'+
   '<p class="margin">Win chance from the Sportsbook</p>':'')+info('preview')+'</section>';
  if(fromBook)h+='<section class="panel"><div class="ph"><div><div class="kicker">Sportsbook</div><h2>The line</h2></div><button class="link" data-go="book">Bet this game →</button></div><div class="stat3">'+
   '<div class="stat"><small>Spread</small><strong>'+esc(team(l.spread>=0?a:b).split(' ')[0])+' '+spr(-Math.abs(l.spread))+'</strong><span>favorite</span></div>'+
   '<div class="stat"><small>Moneyline</small><strong style="font-size:16px">'+odds(l.ml_a)+' / '+odds(l.ml_b)+'</strong><span>'+esc(M(a).name)+' / '+esc(M(b).name)+'</span></div>'+
   '<div class="stat"><small>Total</small><strong>'+f1(l.total)+'</strong><span>points</span></div></div></section>';
  var formRow=function(u,X){var mx=200;return '<div class="form"><div class="form-h">'+whoS(u,'avg '+f1(avg(X))+' · swing ±'+f1(sdOf(X.map(function(x){return x.p})))+'',26)+'</div><div class="form-bars">'+X.map(function(x){return '<button type="button" class="fb" data-game="'+gi(CUR(),x.w,u)+'"><i style="height:'+Math.max(8,x.p/mx*100)+'%"></i><span>'+Math.round(x.p)+'</span><small>W'+x.w+'</small></button>'}).join('')+'</div></div>'};
  h+='<section class="panel"><div class="ph"><div><div class="kicker">'+CUR()+' weekly scores · tap a bar</div><h2>Form</h2></div></div>'+formRow(a,A)+formRow(b,B)+'</section>';
  var keys=[],dAvg=avg(A)-avg(B);
  keys.push(esc(team(dAvg>=0?a:b))+' has scored '+f1(Math.abs(dAvg))+' more points per week this season.');
  if(Math.abs(sA-sB)>4)keys.push(esc(team(sA<sB?a:b))+' is the steadier team. '+esc(team(sA<sB?b:a))+' swings more week to week, which makes it the boom-or-bust side.');
  if(r.games.length)keys.push(r.w===r.l?'The all-time series is tied '+r.w+'-'+r.l+'.':esc(team(r.w>r.l?a:b))+' leads the all-time series '+Math.max(r.w,r.l)+'-'+Math.min(r.w,r.l)+'.');
  else keys.push('First time these two have ever met.');
  keys.push('Playoff odds right now: '+esc(team(a))+' '+pct(oA.playoff)+', '+esc(team(b))+' '+pct(oB.playoff)+'.');
  h+='<section class="panel"><div class="ph"><div><div class="kicker">What to watch</div><h2>Keys to the game</h2></div></div><ul class="keys">'+keys.map(function(k){return '<li>'+k+'</li>'}).join('')+'</ul></section>';
  if(last){var li=gi(last.s,last.w,a);h+='<section class="panel"><div class="ph"><div><div class="kicker">Last meeting</div><h2>'+sw(last.s,last.w)+'</h2></div></div><button type="button" class="row" data-game="'+li+'" style="grid-template-columns:minmax(0,1fr) auto 10px">'+whoS(last.m>last.o?a:b,(last.m>last.o?'beat ':'beat ')+team(last.m>last.o?b:a),28)+'<span class="val">'+f2(Math.max(last.m,last.o))+'–'+f2(Math.min(last.m,last.o))+'</span>'+CHEV+'</button></section>'}
  return h;
}

/* ---------- SEASON PAGE ---------- */
var RNDW={1:'Round 1',2:'Semifinals',3:'Finals'};
function bracketHtml(s,list,isToilet){
  var by={};list.forEach(function(m){(by[m.r]=by[m.r]||[]).push(m)});
  return Object.keys(by).map(function(r){return '<div class="br-r"><div class="kicker">'+(isToilet?'Toilet Bowl · ':'')+RNDW[r]+' · Week '+(14+ +r)+'</div>'+
    by[r].map(function(m){var aw=(m.pa||0)>(m.pb||0);var lbl=m.p===1?(isToilet?'Sacko game':'Championship'):m.p===3?(isToilet?'':'3rd place'):m.p===5?(isToilet?'':'5th place'):'';
      var gx=gi(s,m.w,m.a);
      return '<button type="button" class="br-m" data-game="'+gx+'">'+(lbl?'<span class="br-l">'+lbl+'</span>':'')+
       '<span class="br-t'+(aw?' w':'')+'"><b>'+esc(tnS(s,m.a))+'</b><i>'+(m.pa!=null?f2(m.pa):'–')+'</i></span><span class="br-t'+(!aw?' w':'')+'"><b>'+esc(tnS(s,m.b))+'</b><i>'+(m.pb!=null?f2(m.pb):'–')+'</i></span></button>'}).join('')+'</div>'}).join('')}
function seasonSheet(s){
  var x=D.seasons[s],last=s===CUR()?D.league.last_scored:(x.last||17);if(!S.sw||S.sw>last)S.sw=s===CUR()?last:1;
  var h='<section class="hero"><div class="eyebrow">'+(s===CUR()?'In progress':'Final')+'</div><h1>'+s+' season</h1>'+(x.champ?'<p class="sub">🏆 '+esc(tnS(s,x.champ))+' won it all. 🚽 '+esc(tnS(s,x.sacko))+' took the Sacko.</p>':'<p class="sub">Through Week '+last+'.</p>')+
   '<button type="button" class="share-btn" data-share-season="'+s+'">Share season card</button></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Regular season</div><h2>Final standings</h2></div></div><div class="tw"><table><thead><tr><th>Team</th><th>W-L</th><th>PF</th><th>PA</th><th>Luck</th></tr></thead><tbody>'+
   x.standings.map(function(t,i){return '<tr class="'+(t.uid===S.me?'me ':'')+(i===5?'cut':'')+'"><td class="tm"><button class="who" type="button" data-mgr="'+t.uid+'"><span class="rk" style="width:20px;height:20px;font-size:10px">'+t.seed+'</span><span class="tx"><b style="font-size:13px">'+esc(tnS(s,t.uid))+'</b></span></button></td><td><b>'+t.w+'-'+t.l+'</b></td><td>'+f1(t.pf)+'</td><td>'+f1(t.pa)+'</td><td class="'+(t.luck>0.4?'pos':t.luck<-0.4?'negv':'')+'">'+(t.luck>0?'+':'')+f1(t.luck)+'</td></tr>'}).join('')+'</tbody></table></div></section>';
  if(x.bracket){h+='<section class="panel"><div class="ph"><div><div class="kicker">Tap a game for the box score</div><h2>Playoff bracket</h2></div></div>'+bracketHtml(s,x.bracket.winners,false)+'</section>';
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Losers advance</div><h2>Toilet Bowl</h2></div></div>'+bracketHtml(s,x.bracket.losers,true)+'</section>'}
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Every week</div><h2>Week '+S.sw+'</h2></div></div><div class="chips wrap" style="margin-bottom:10px">';
  for(var w=1;w<=last;w++)h+='<button type="button" class="chip'+(w===S.sw?' on':'')+'" data-sweek="'+s+'|'+w+'">'+(w>=15?'P'+(w-14):'Wk '+w)+'</button>';
  h+='</div>'+recapHtml(s,S.sw)+resultsHtml(s,S.sw)+'</section>';
  return h;
}

/* ---------- SHARE CARDS ---------- */
function shareCard(o){
  var W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
  var g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#2a2140');g.addColorStop(.55,'#1c1729');g.addColorStop(1,'#130f1d');x.fillStyle=g;x.fillRect(0,0,W,H);
  var rg=x.createRadialGradient(W*.9,0,10,W*.9,0,700);rg.addColorStop(0,'rgba(76,236,255,.22)');rg.addColorStop(1,'rgba(76,236,255,0)');x.fillStyle=rg;x.fillRect(0,0,W,H);
  var pg=x.createRadialGradient(0,H,10,0,H,800);pg.addColorStop(0,'rgba(255,95,214,.22)');pg.addColorStop(1,'rgba(255,95,214,0)');x.fillStyle=pg;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(76,236,255,.06)';x.lineWidth=2;for(var i=0;i<W;i+=60){x.beginPath();x.moveTo(i,0);x.lineTo(i,H);x.stroke()}for(i=0;i<H;i+=60){x.beginPath();x.moveTo(0,i);x.lineTo(W,i);x.stroke()}
  var rule=x.createLinearGradient(0,0,W,0);rule.addColorStop(0,'#f6cf4c');rule.addColorStop(.55,'#ff5fd6');rule.addColorStop(1,'#4cecff');x.fillStyle=rule;x.fillRect(0,0,W,14);
  var disp='"Chakra Petch","Bahnschrift",sans-serif',mono='"IBM Plex Mono",monospace',body='"IBM Plex Sans",sans-serif';
  x.textBaseline='alphabetic';
  x.fillStyle='#efe9fb';x.font='700 54px '+disp;x.fillText("MAHOMIE'S",80,130);var bw=x.measureText("MAHOMIE'S ").width;x.fillStyle='#f6cf4c';x.fillText('HUB',80+bw,130);
  x.fillStyle='#a59cc0';x.font='500 26px '+mono;x.fillText("ROLLIN' WITH MAHOMIES",80,178);
  x.fillStyle='#4cecff';x.font='500 32px '+mono;x.fillText(o.eyebrow.toUpperCase(),80,380);
  x.fillStyle='#efe9fb';x.font='700 76px '+disp;wrap(x,o.title,80,470,W-160,84);
  x.fillStyle='#f6cf4c';x.font='700 '+(o.big.length>7?190:240)+'px '+disp;x.shadowColor='rgba(246,207,76,.35)';x.shadowBlur=40;x.fillText(o.big,72,800);x.shadowBlur=0;
  x.fillStyle='#efe9fb';x.font='600 54px '+body;wrap(x,o.team,80,920,W-160,62);
  x.fillStyle='#a59cc0';x.font='400 36px '+mono;wrap(x,o.sub,80,1010,W-160,48);
  x.fillStyle=rule;x.fillRect(80,H-150,W-160,4);
  x.fillStyle='#7d7499';x.font='500 26px '+mono;x.fillText('RECORD BOOK · '+(new Date().getFullYear()),80,H-90);
  return c.toDataURL('image/png');
}
function wrap(x,t,X,Y,maxW,lh){var words=String(t).split(' '),line='',y=Y;words.forEach(function(w){var test=line?line+' '+w:w;if(x.measureText(test).width>maxW&&line){x.fillText(line,X,y);line=w;y+=lh}else line=test});x.fillText(line,X,y)}
function showShare(o){
  var go=function(){var url=shareCard(o);openSheet('<div class="ph" style="margin:0"><div><div class="kicker">Share card</div><h2>Ready for the group chat</h2></div></div><img class="share-img" src="'+url+'" alt="'+esc(o.title+': '+o.big+' by '+o.team)+'"><p class="muted" style="font-size:12.5px;text-align:center">Press and hold the image to save or share it.</p><button type="button" class="ghost" id="closeP">Close</button>')};
  try{(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(go)}catch(e){go()}
}
function shareRecord(){var k=S.rec,list=recList(k),top=recVal(k,list[0]),name=RECS.find(function(r){return r[0]===k})[1];
  var t=recType(k);showShare({eyebrow:'All-time record · '+(t==='season'||t==='streak'?'regular season':{all:'all games',reg:'regular season',post:'playoffs'}[S.rf]),title:name,big:top.v,team:team(top.u),sub:top.sub})}
function shareGame(i){var g=D.games[i];showShare({eyebrow:g.s+' · Week '+g.w+' · '+g.k,title:tnS(g.s,g.win)+' def. '+tnS(g.s,g.lose),big:f2(g.wp),team:'to '+f2(g.lp),sub:'Won by '+f2(g.m)})}
function shareAwards(s){var A=D.awards[s]||[],f=function(k){return A.find(function(a){return a.key===k})};var c=f('champ'),p=f('points'),tb=f('topb');
  showShare({eyebrow:s+' awards',title:c?'Champion':'Points King',big:c?'🏆':p.val,team:team((c||p).uid),sub:[p?'Points King: '+team(p.uid):'',tb?'On Fire: '+team(tb.uid)+' '+tb.val:''].filter(Boolean).join(' · ')})}
function shareSeason(s){var x=D.seasons[s];showShare({eyebrow:s+' season',title:x.champ?'Champion':'Leader',big:'🏆',team:tnS(s,x.champ||x.standings[0].uid),sub:x.sacko?'Sacko: '+tnS(s,x.sacko):'Through Week '+D.league.last_scored})}

/* ---------- sheets ---------- */
function openSheet(html){$('#sheetBody').innerHTML=html;$('#sheet').classList.add('open');$('#scrim').classList.add('open');$('#sheet').scrollTop=0}
function closeSheet(){$('#sheet').classList.remove('open');$('#scrim').classList.remove('open')}
function toast(t){var el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(function(){el.classList.remove('show')},2200)}

/* ---------- render + events ---------- */
function render(){
  document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.dataset.tab===S.tab);t.setAttribute('aria-current',t.dataset.tab===S.tab?'page':'false')});
  view.innerHTML=S.tab==='home'?home():S.tab==='league'?league():S.tab==='records'?records():S.tab==='book'?book():me();
  $('#bucks').textContent=BK.me?money(BK.me.balance):'Log in';
}
function go(tab,sub){S.tab=tab;if(tab==='league'&&sub)S.lseg=sub;closeSheetQuiet();render();window.scrollTo(0,0);try{history.replaceState(null,'','#'+tab)}catch(e){}}
function closeSheetQuiet(){$('#sheet').classList.remove('open');$('#scrim').classList.remove('open')}
var CLOSE='<button type="button" class="ghost" id="closeP">Close</button>';
function centerChip(sel){var t=document.querySelector(sel);if(t&&t.scrollIntoView)t.scrollIntoView({inline:'center',block:'nearest'})}
document.addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;var d=t.dataset;
  if(d.info){openSheet(explainSheet(d.info)+CLOSE);return}
  if(d.trade!==undefined){openSheet(tradeSheet(+d.trade)+CLOSE);return}
  if(d.tab){go(d.tab);if(d.tab==='book'||d.tab==='me')bookLoad();return}
  if(d.go){var p=d.go.split(':');go(p[0],p[1]);return}
  if(d.lseg){S.lseg=d.lseg;render();centerChip('[data-lseg="'+S.lseg+'"]');return}
  if(d.bseg){S.bseg=d.bseg;render();return}
  if(d.hw){S.hw=+d.hw;S.resMore=false;render();return}
  if(d.more){if(d.more==='res')S.resMore=!S.resMore;if(d.more==='rec')S.recMore=!S.recMore;render();return}
  if(d.shareAw){shareAwards(d.shareAw);return}
  if(d.rf){S.rf=d.rf;render();return}
  if(d.aws){S.aws=d.aws;render();return}
  if(d.lab){S.lab=d.lab;render();return}
  if(d.labs){S.labs=d.labs;render();return}
  if(d.recpick){openSheet(recPickSheet()+CLOSE);return}
  if(d.wk){openSheet(weekSheet(d.wks||CUR(),+d.wk)+CLOSE);return}
  if(d.twih){openSheet(twihSheet()+CLOSE);return}
  if(d.rec){closeSheetQuiet();S.rec=d.rec;S.recMore=false;render();centerChip('[data-rec="'+S.rec+'"]');return}
  if(d.pair){var pp=d.pair.split('|');S.h2a=pp[0];S.h2b=pp[1];render();var el=document.getElementById('rivalTop');if(el)el.scrollIntoView({block:'start'});return}
  if(d.prev){openSheet(previewSheet(d.prev,S.tab==='book')+CLOSE);return}
  if(d.season){S.ss=d.season;S.sw=null;openSheet(seasonSheet(d.season)+CLOSE);return}
  if(d.sweek){var sp=d.sweek.split('|');S.sw=+sp[1];var keep=$('#sheet').scrollTop;openSheet(seasonSheet(sp[0])+CLOSE);$('#sheet').scrollTop=keep;return}
  if(d.shareRec){shareRecord();return}
  if(d.shareGame){shareGame(+d.shareGame);return}
  if(d.shareSeason){shareSeason(d.shareSeason);return}
  if(d.bk){var a=d.bk.split('|');if(!AUTH){S.picks=[{line:a[0],mkt:a[1],side:a[2],pid:a[3]}];render();openLogin();return}togglePick(a[0],a[1],a[2],a[3]);return}
  if(d.slip){S.review=false;openSheet(slipHtml());slipCheck();return}
  if(d.smode){S.slipMode=d.smode;openSheet(slipHtml());slipCheck();return}
  if(t.id==='review'){var pb=slipProblem();if(pb){var er=$('#slipErr');if(er)er.innerHTML=pb;return}S.review=true;openSheet(slipHtml());return}
  if(t.id==='backSlip'){S.review=false;openSheet(slipHtml());slipCheck();return}
  if(d.tkt){openSheet(ticketSheet([+d.tkt]));return}
  if(d.tshare){shareTickets(d.tshare.split(',').map(Number));return}
  if(d.props){S.bseg='props';S.propLine=d.props;closeSheetQuiet();render();window.scrollTo(0,0);return}
  if(d.unpick!==undefined){S.picks.splice(+d.unpick,1);S.review=false;render();if(S.picks.length){openSheet(slipHtml());slipCheck()}else closeSheetQuiet();return}
  if(d.stake){S.stake=+d.stake;openSheet(slipHtml());slipCheck();return}
  if(t.id==='place'){placeBets(t);return}
  if(t.id==='clearSlip'){S.picks=[];closeSheetQuiet();render();return}
  if(d.bcancel){t.disabled=true;api('/bets/'+d.bcancel+'/cancel',{method:'POST'}).then(function(){closeSheetQuiet();toast('Bet cancelled, Bucks returned');bookLoad()}).catch(function(e){t.disabled=false;toast(e.message)});return}
  if(d.login){openLogin();return}
  if(d.lteam){S.lt=d.lteam;S.pin='';S.pin1=null;S.pinErr='';openSheet(loginSheet());return}
  if(d.key){pinKey(d.key);return}
  if(d.pinback){S.lt=null;S.pin='';S.pin1=null;S.pinErr='';openSheet(loginSheet());return}
  if(d.logout){logout();return}
  if(d.adm){openSheet(admSheet(d.adm,d.arg));if(d.adm==='log')loadLog();if(d.adm==='health')loadHealth();return}
  if(d.admgo){admGo(d.admgo,d.arg,t);return}
  if(d.bkreload){BK.on=null;render();bookLoad();return}
  if(t.id==='bucksBtn'){go('book');bookLoad();return}
  if(d.bye){openSheet(byeSheet(d.bye)+CLOSE);loadByeLineup(d.bye);return}
  if(d.game!==undefined){var gx=+d.game;if(gx>=0){openSheet(gameSheet(gx)+'<button type="button" class="share-btn wide" data-share-game="'+gx+'">Share this game</button>'+CLOSE);loadLineups(gx);return}}
  if(d.mgr){openSheet(profile(d.mgr,false)+CLOSE);return}
  if(t.id==='closeP'){closeSheet();return}
});
document.addEventListener('change',function(e){
  if(e.target.id==='meSel'){S.me=e.target.value;store('me',S.me);S.h2a=S.me;S.h2b=null;render();toast('Playing as '+team(S.me))}
  if(e.target.id==='propSel'){S.propLine=e.target.value;render()}
  if(e.target.id==='h2a'){S.h2a=e.target.value;render()}
  if(e.target.id==='h2b'){S.h2b=e.target.value;render()}
});
document.addEventListener('input',function(e){
  if(e.target.id==='stake'){S.stake=Math.round(+e.target.value||0);slipCheck()}
});
$('#scrim').addEventListener('click',closeSheet);
function twHit(e){var r=e.target.closest&&e.target.closest('[data-tw]');if(!r)return;var box=r.closest('.chartbox');if(box)chartTip(box,+r.dataset.tw)}
document.addEventListener('click',twHit);document.addEventListener('pointermove',function(e){if(e.pointerType==='mouse')twHit(e)});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeSheet()});
var h=(location.hash||'').replace('#','');if(['home','league','records','book','me'].indexOf(h)>=0)S.tab=h;
render();
})();
