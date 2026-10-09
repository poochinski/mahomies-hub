/* ---------- HOME ---------- */
function weekGames(s,w){return D.games.map(function(g,i){return {g:g,i:i}}).filter(function(x){return x.g.s===s&&x.g.w===w})}
function home(){
  var L=D.league,pw=D.power,hw=S.hw;
  var wk=weekScores('2026',hw),top=wk[0],rot=wk[wk.length-1];
  var potw=null;wk.forEach(function(x){var t=topP('2026',hw,x.u);if(t&&t.name&&(!potw||t.pts>potw.pts))potw={u:x.u,name:t.name,pts:t.pts}});
  var unbeaten=pw.filter(function(p){return /-0$/.test(p.rec)})[0];
  var h='<section class="hero"><div class="eyebrow">2026 season · Week '+L.week+'</div><h1>Week '+L.week+'</h1><p class="sub">Thursday night is underway. Data as of '+esc(D.updated_label)+'.</p>'+
   '<div class="tiles">'+
   tile('t-y','Top Banana · Wk '+hw,f2(top.p),team(top.u),top.u,gi('2026',hw,top.u))+
   tile('t-r','Rotten Banana · Wk '+hw,f2(rot.p),team(rot.u),rot.u,gi('2026',hw,rot.u))+
   (potw?tile('t-b','Player of the week',f1(potw.pts),potw.name+' · '+team(potw.u),potw.u,gi('2026',hw,potw.u)):'')+
   (unbeaten?tile('t-g','Still unbeaten',unbeaten.rec,team(unbeaten.uid),unbeaten.uid):'')+
   '</div></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Live now · tap for a preview</div><h2>Week '+L.week+' matchups</h2></div><button class="link" data-go="book">Bet these →</button></div><div class="rows">'+
   D.lines.map(function(l){var fa=l.spread>=0;return '<button type="button" class="row" data-prev="'+l.id+'" style="grid-template-columns:minmax(0,1fr) auto 10px">'+
     '<div style="display:grid;gap:7px;min-width:0">'+whoS(l.a,(fa?'Fav '+spr(-l.spread):'Dog '+spr(-l.spread))+' · ML '+odds(l.ml_a),28)+whoS(l.b,(!fa?'Fav '+spr(l.spread):'Dog '+spr(l.spread))+' · ML '+odds(l.ml_b),28)+'</div>'+
     '<div class="val" style="font-size:15px">'+f2(l.live_a)+'<br>'+f2(l.live_b)+'<small>live</small></div>'+CHEV+'</button>'}).join('')+
   '</div></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Final scores</div><h2>Results</h2></div></div>'+
   '<div class="chips" style="margin-bottom:10px">'+[1,2,3,4].map(function(w){return '<button type="button" class="chip'+(w===hw?' on':'')+'" data-hw="'+w+'">Week '+w+'</button>'}).join('')+'</div>'+
   recapHtml('2026',hw)+resultsHtml('2026',hw)+'</section>';
  var od=D.odds.list;
  h+='<section class="panel"><div class="ph"><div><div class="kicker">'+money(D.odds.sims)+' simulated seasons</div><h2>Playoff race</h2></div><button class="link" data-go="league:odds">All odds →</button></div><div class="rows">'+
   od.slice(0,8).map(function(o,i){return '<div class="row'+(i===6?' cutrow':'')+'" style="grid-template-columns:minmax(0,1fr) 92px">'+who(o.uid,o.rec+' · proj '+f1(o.wins)+' W',28)+oddsBar(o.playoff)+'</div>'}).join('')+
   '</div><p class="muted" style="font-size:11.5px;margin-top:8px">Top 6 make the playoffs. Line drawn at the cut.</p></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">After Week '+L.last_scored+'</div><h2>Power rankings</h2></div><button class="link" data-go="league:season">Full table →</button></div><div class="rows">'+
   pw.slice(0,5).map(function(p){return '<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto auto"><span class="rk'+(p.rank===1?' gold':'')+'">'+p.rank+'</span>'+who(p.uid,p.rec+' · '+f1(p.avg)+' ppg',30)+mv(p.move)+'<span class="val" style="font-size:16px">'+f1(p.power)+'</span></div>'}).join('')+
   '</div></section>';
  h+=historyCard(L.week);
  return h+foot();
}
function oddsBar(p){var pc=Math.round(p*1000)/10;return '<div class="ob2"><div class="ob2-t"><i style="width:'+Math.max(2,pc)+'%"></i></div><b>'+(pc>=99.95?'>99.9':pc<0.05?'<0.1':pc.toFixed(1))+'%</b></div>'}
function resultsHtml(s,w){var gs=weekGames(s,w);if(!gs.length)return '<p class="muted">No games found for this week.</p>';
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
  var items=[];['2025','2024','2023'].forEach(function(s){var gs=weekGames(s,w);if(!gs.length)return;
    var ws=weekScores(s,w),hi=ws[0],b=gs.slice().sort(function(a,c){return c.g.m-a.g.m})[0];
    items.push('<button type="button" class="row" data-game="'+gi(s,w,hi.u)+'" style="grid-template-columns:52px minmax(0,1fr) auto 10px"><span class="yr">'+s+'</span><div style="min-width:0"><b style="font-size:13.5px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(tnS(s,hi.u))+' dropped '+f2(hi.p)+'</b><span class="muted" style="font-size:11.5px">Biggest win: '+esc(tnS(s,b.g.win))+' by '+f1(b.g.m)+'</span></div><span></span>'+CHEV+'</button>')});
  return '<section class="panel"><div class="ph"><div><div class="kicker">Week '+w+' in past seasons</div><h2>This week in history</h2></div></div><div class="rows">'+items.join('')+'</div></section>'}
function tile(c,k,v,s,u,gix){return '<button class="tile '+c+'" type="button" '+(gix!=null&&gix>=0?'data-game="'+gix+'"':'data-mgr="'+u+'"')+'><small>'+esc(k)+'</small><strong class="num">'+esc(v)+'</strong><span>'+esc(s)+'</span></button>'}
function mv(m){return '<span class="mv '+(m>0?'up':m<0?'dn':'eq')+'">'+(m>0?'▲'+m:m<0?'▼'+(-m):'–')+'</span>'}
function foot(){return '<p class="foot"><span class="dots"><i style="background:var(--banana)"></i><i style="background:var(--pink)"></i><i style="background:var(--cyan)"></i><i style="background:var(--win)"></i></span>v'+D.version+' test build · Sleeper data as of '+esc(D.updated_label)+'</p>'}

/* ---------- LEAGUE ---------- */
var LSEGS=[['season','2026'],['odds','Playoff odds'],['history','History'],['alltime','All-time'],['h2h','Rivals'],['awards','Awards'],['lab','Lab']];
function league(){
  var h='<div class="chips" role="tablist">'+LSEGS.map(function(x){return '<button type="button" class="chip'+(S.lseg===x[0]?' on':'')+'" data-lseg="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
  h+=({season:seasonView,odds:oddsView,history:historyView,alltime:alltimeView,h2h:h2hView,awards:awardsView,lab:labView}[S.lseg]||seasonView)();
  return h+foot();
}
function seasonView(){
  var st=D.seasons['2026'].standings;
  var h='<section class="panel"><div class="ph"><div><div class="kicker">2026 · after Week '+D.league.last_scored+'</div><h2>Standings</h2></div></div>'+
   '<div class="tw"><table><thead><tr><th>Team</th><th>W-L</th><th>PF</th><th>All-play</th><th>Luck</th></tr></thead><tbody>'+
   st.map(function(x,i){return '<tr class="'+(x.uid===S.me?'me ':'')+(i===5?'cut':'')+'"><td class="tm"><button class="who" type="button" data-mgr="'+x.uid+'"><span class="rk" style="width:20px;height:20px;font-size:10px">'+x.seed+'</span><span class="tx"><b style="font-size:13px">'+esc(team(x.uid))+'</b></span></button></td><td><b>'+x.w+'-'+x.l+'</b></td><td>'+f1(x.pf)+'</td><td>'+x.ap+'</td><td class="'+(x.luck>0.4?'pos':x.luck<-0.4?'negv':'')+'">'+(x.luck>0?'+':'')+f1(x.luck)+'</td></tr>'}).join('')+
   '</tbody></table></div><p class="muted" style="font-size:11.5px;margin-top:9px;line-height:1.5">W-L includes the league-median game each week. All-play is your record if you played every team every week. Luck is head-to-head wins minus all-play expected wins. Dashed line = playoff cut (top 6).</p></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Points, all-play, form, record</div><h2>Power rankings</h2></div></div><div class="rows">'+
   D.power.map(function(p){return '<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto"><span class="rk'+(p.rank===1?' gold':'')+'">'+p.rank+'</span><div style="min-width:0">'+who(p.uid,p.rec+' · last 3: '+f1(p.last3)+' ppg',30)+'<div class="pbar"><i style="width:'+p.power+'%"></i></div></div><div style="display:grid;justify-items:end;gap:2px"><span class="val" style="font-size:16px">'+f1(p.power)+'</span>'+mv(p.move)+'</div></div>'}).join('')+
   '</div></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Browse any week</div><h2>2026 weeks</h2></div><button class="link" data-season="2026">Open season ›</button></div><p class="muted" style="font-size:12.5px">Every result from this season, week by week.</p></section>';
  return h;
}
function oddsView(){
  var h='<section class="hero"><div class="eyebrow">'+money(D.odds.sims)+' simulated seasons · '+D.odds.weeks_left+' weeks left</div><h1 style="font-size:28px">Playoff odds</h1><p class="sub">Each simulation plays out the rest of the schedule using every team\'s scoring level and week-to-week swing, including the median game. Top 6 make it, top 2 get a bye.</p></section>';
  h+='<section class="panel"><div class="tw"><table><thead><tr><th>Team</th><th>Rec</th><th>Proj W</th><th>Playoffs</th><th>Bye</th><th>#1</th><th>Last</th></tr></thead><tbody>'+
   D.odds.list.map(function(o,i){return '<tr class="'+(o.uid===S.me?'me ':'')+(i===5?'cut':'')+'"><td class="tm"><button class="who" type="button" data-mgr="'+o.uid+'">'+av(o.uid,22)+'<span class="tx"><b style="font-size:13px">'+esc(team(o.uid))+'</b></span></button></td><td>'+o.rec+'</td><td>'+f1(o.wins)+'</td><td class="'+(o.playoff>=.5?'pos':'')+'"><b>'+pct(o.playoff)+'</b></td><td>'+pct(o.bye)+'</td><td>'+pct(o.top)+'</td><td class="'+(o.last>=.2?'negv':'')+'">'+pct(o.last)+'</td></tr>'}).join('')+
   '</tbody></table></div><p class="muted" style="font-size:11.5px;margin-top:9px;line-height:1.5">Projected wins include median-game wins (28 total games). Odds update every week once the app is live.</p></section>';
  return h;
}
function pct(p){var v=p*100;return v>=99.95?'>99.9%':v<0.05?'–':v.toFixed(v<10?1:0)+'%'}
function historyView(){
  var h='';
  ['2025','2024','2023'].forEach(function(s){
    var x=D.seasons[s];var reg=x.standings[0];var ts=x.standings.slice().sort(function(a,b){return b.pf-a.pf})[0];
    h+='<section class="season"><div class="season-h"><b>'+s+'</b><span>'+(s==='2023'?'FIRST SEASON ON SLEEPER':'SEASON')+'</span></div><div class="podium">'+
     pod('m-1','🏆',x.champ,'Champion',s)+pod('m-2','🥈',x.runner,'Runner-up',s)+pod('m-3','🥉',x.third,'Third',s)+pod('m-s','🚽',x.sacko,'Sacko','r',s)+
     '</div><div class="season-f"><span class="pill">#1 seed <b>'+esc(x.team_names[reg.uid]||M(reg.uid).name)+'</b> '+reg.w+'-'+reg.l+'</span><span class="pill">Most points <b>'+esc(x.team_names[ts.uid]||M(ts.uid).name)+'</b> '+f1(ts.pf)+'</span>'+
     '<button type="button" class="open-season" data-season="'+s+'">Standings, bracket &amp; every week ›</button></div></section>';
  });
  return h;
}
function pod(c,ic,u,label,cls,s){if(s===undefined){s=cls;cls=''}var tn=D.seasons[s].team_names[u]||M(u).name;
  return '<div class="pod"><span class="medal '+c+'">'+ic+'</span>'+who(u,tn===team(u)?M(u).name:'as '+tn,30)+'<span class="lbl '+cls+'">'+label+'</span></div>'}
function atRow(x){return '<tr class="'+(x.uid===S.me?'me':'')+'"><td class="tm"><button class="who" type="button" data-mgr="'+x.uid+'">'+av(x.uid,22)+'<span class="tx"><b style="font-size:13px">'+esc(team(x.uid))+'</b><span>'+esc(M(x.uid).name)+'</span></span></button></td><td>'+(x.titles.length||'')+'</td><td>'+x.w+'-'+x.l+'</td><td>'+(x.pct*100).toFixed(1)+'</td><td>'+f1(x.avg)+'</td><td>'+x.playoffs.length+'</td><td>'+x.tb+'</td><td>'+x.rb+'</td></tr>'}
function alltimeView(){
  var head='<thead><tr><th>Team</th><th>🏆</th><th>W-L</th><th>Win%</th><th>PPG</th><th>Playoffs</th><th>🍌</th><th>🤢</th></tr></thead>';
  var act=D.alltime.filter(function(x){return M(x.uid).active}),old=D.alltime.filter(function(x){return !M(x.uid).active});
  return '<section class="panel"><div class="ph"><div><div class="kicker">2023 – 2026 · regular season</div><h2>All-time table</h2></div></div><div class="tw"><table>'+head+'<tbody>'+act.map(atRow).join('')+'</tbody></table></div>'+
   '<details class="bench" style="margin-top:12px"><summary>Former managers ('+old.length+')</summary><div class="tw" style="margin-inline:-10px;padding-inline:10px"><table>'+head+'<tbody>'+old.map(atRow).join('')+'</tbody></table></div></details>'+
   '<p class="muted" style="font-size:11.5px;margin-top:9px">🍌 Top Banana = weeks as the league\'s top scorer. 🤢 Rotten Banana = weeks as the lowest. W-L is head-to-head only.</p></section>';
}
function mgrOptions(sel){var a=ids.filter(function(u){return M(u).active}),f=ids.filter(function(u){return !M(u).active});
  var o=function(u){return '<option value="'+u+'"'+(u===sel?' selected':'')+'>'+esc(team(u))+' ('+esc(M(u).name)+')</option>'};
  return '<optgroup label="Current">'+a.map(o).join('')+'</optgroup><optgroup label="Former">'+f.map(o).join('')+'</optgroup>'}
function h2hView(){
  var act=ids.filter(function(u){return M(u).active});
  if(!S.h2b){var best=null;act.forEach(function(u){if(u===S.h2a)return;var r=D.h2h[S.h2a+'|'+u];if(r&&(!best||r.games.length>best.n))best={u:u,n:r.games.length}});S.h2b=best?best.u:act[1]}
  var r=D.h2h[S.h2a+'|'+S.h2b]||{w:0,l:0,pf:0,pa:0,games:[]};
  var n=r.games.length;var big=r.games.slice().sort(function(a,b){return (b.m-b.o)-(a.m-a.o)});
  var h='<section class="panel" id="rivalTop"><div class="ph"><div><div class="kicker">Head to head · every game</div><h2>Rivalry card</h2></div></div><div class="two" style="margin-bottom:14px"><select id="h2a" aria-label="First team">'+mgrOptions(S.h2a)+'</select><select id="h2b" aria-label="Second team">'+mgrOptions(S.h2b)+'</select></div>';
  if(!n){h+='<p class="muted">These two have never played each other.</p></section>'}
  else{
  h+='<div class="vs"><div class="side">'+av(S.h2a,48)+'<b>'+esc(team(S.h2a))+'</b><strong style="color:'+(r.w>=r.l?'var(--win)':'var(--ink)')+'">'+r.w+'</strong></div><div class="mid">VS<br><span style="font-size:10px">'+n+' GAME'+(n===1?'':'S')+'</span></div><div class="side">'+av(S.h2b,48)+'<b>'+esc(team(S.h2b))+'</b><strong style="color:'+(r.l>r.w?'var(--win)':'var(--ink)')+'">'+r.l+'</strong></div></div>'+
   '<div class="stat3" style="margin-top:14px"><div class="stat"><small>Avg score</small><strong>'+f1(r.pf/n)+'</strong><span>vs '+f1(r.pa/n)+'</span></div><div class="stat"><small>Biggest win</small><strong>'+f1(Math.max(0,big[0].m-big[0].o))+'</strong><span>'+sw(big[0].s,big[0].w)+'</span></div><div class="stat"><small>Worst loss</small><strong>'+f1(Math.max(0,big[n-1].o-big[n-1].m))+'</strong><span>'+sw(big[n-1].s,big[n-1].w)+'</span></div></div>'+
   '<div style="margin-top:12px">'+r.games.slice().reverse().map(function(g){var won=g.m>g.o;return '<button type="button" class="row" style="grid-template-columns:minmax(0,1fr) auto 10px" data-game="'+gi(g.s,g.w,S.h2a)+'"><div><b style="font-size:13px">'+sw(g.s,g.w)+'</b><div class="muted" style="font-size:11.5px">'+esc(g.k)+'</div></div><div class="val" style="font-size:15px;color:'+(won?'var(--win)':'var(--loss)')+'">'+(won?'W ':'L ')+f2(g.m)+'–'+f2(g.o)+'</div>'+CHEV+'</button>'}).join('')+'</div></section>';}
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Row team\'s record vs column team</div><h2>Head-to-head grid</h2></div></div><div class="mx-wrap"><table class="mx"><thead><tr><th></th>'+
   act.map(function(u){return '<th>'+av(u,24)+'</th>'}).join('')+'</tr></thead><tbody>'+
   act.map(function(a){return '<tr><th>'+av(a,24)+'</th>'+act.map(function(b){if(a===b)return '<td class="self"></td>';var x=D.h2h[a+'|'+b];if(!x)return '<td class="none">–</td>';
     var c=x.w>x.l?'up':x.w<x.l?'dn':'eq';return '<td class="'+c+'"><button type="button" data-pair="'+a+'|'+b+'">'+x.w+'-'+x.l+'</button></td>'}).join('')+'</tr>'}).join('')+
   '</tbody></table></div><p class="muted" style="font-size:11.5px;margin-top:8px">Tap any cell to load that rivalry. Includes playoff games.</p></section>';
  return h;
}
var AW_ICON={champ:'🏆',sacko:'🚽',points:'👑',topb:'🍌',rotb:'🤢',lucky:'🍀',unlucky:'🐍',pa:'🥊',high:'💥',blow:'🔨',heart:'💔'};
function awardsView(){
  var s=S.aws;var A=D.awards[s];
  var h='<div class="chips">'+['2026','2025','2024','2023'].map(function(x){return '<button type="button" class="chip'+(x===s?' on':'')+'" data-aws="'+x+'">'+x+(x==='2026'?' so far':'')+'</button>'}).join('')+'</div>';
  h+='<section class="hero"><div class="eyebrow">'+(s==='2026'?'Season in progress · through Week '+D.league.last_scored:'Final')+'</div><h1 style="font-size:30px">'+s+' awards</h1><p class="sub">Handed out automatically from the league\'s scores. Tap any award for the game or the manager.</p></section>';
  h+='<div class="awards">'+A.map(function(a){var gx=a.game?gi(a.game.s,a.game.w,a.game.win):-1;
    return '<button type="button" class="award a-'+a.key+'" '+(gx>=0?'data-game="'+gx+'"':'data-mgr="'+a.uid+'"')+'><span class="aw-ic">'+(AW_ICON[a.key]||'⭐')+'</span><span class="aw-t">'+esc(a.title)+'</span><span class="aw-v num">'+esc(a.val)+'</span><span class="aw-w">'+av(a.uid,22)+'<b>'+esc(tnS(s,a.uid))+'</b></span><span class="aw-n">'+esc(a.note)+'</span></button>'}).join('')+'</div>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Need full Sleeper history</div><h2>Coming with live sync</h2></div></div><div class="rows">'+
   [['🧙 Waiver Wizard','Most points from players picked up during the season'],['🤝 Trade of the Year','Biggest points edge from a single trade'],['💎 Draft Steal','Latest pick with the most points'],['💸 Draft Bust','Earliest pick with the fewest points'],['🪑 Bench Shame Champ','Most points left on the bench']].map(function(x){return '<div class="row" style="grid-template-columns:1fr"><div><b style="font-size:14px">'+x[0]+'</b><p class="muted" style="font-size:12px;margin-top:2px">'+x[1]+'</p></div></div>'}).join('')+'</div></section>';
  return h;
}
function labView(){
  var cards=[['bench','🪑 Bench Shame','Points each team left on the bench compared with its best possible lineup, every week, plus a season leaderboard.'],
    ['trades','🤝 Trade grader','Every trade, with the points each side got from the players they received after the deal.'],
    ['draft','📋 Draft re-grade','Every pick compared with where its season points rank: the biggest steals and busts.']];
  var h='<section class="hero"><div class="eyebrow">League Lab</div><h1 style="font-size:28px">Deep stats</h1><p class="sub">These read full lineups, transactions and drafts straight from Sleeper.</p></section>';
  if(!LIVE){h+=cards.map(function(c){return '<section class="panel"><h2 style="font-size:19px">'+c[1]+'</h2><p class="muted" style="font-size:13px;margin-top:6px;line-height:1.5">'+c[2]+'</p><p class="lab-off">Turns on when the app is live on Railway</p></section>'}).join('');return h}
  h+='<div class="chips">'+cards.map(function(c){return '<button type="button" class="chip'+(S.lab===c[0]?' on':'')+'" data-lab="'+c[0]+'">'+c[1]+'</button>'}).join('')+'</div>';
  h+='<div class="chips">'+['2026','2025','2024','2023'].map(function(x){return '<button type="button" class="chip'+(x===S.labs?' on':'')+'" data-labs="'+x+'">'+x+'</button>'}).join('')+'</div>';
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
  return '<div class="ph"><div><div class="kicker">'+d.season+' · through Week '+d.through+'</div><h2>Bench Shame</h2></div></div><div class="rows">'+
   d.teams.map(function(t,i){return '<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto"><span class="rk'+(i===0?' gold':'')+'">'+(i+1)+'</span>'+who(t.user_id,'Worst: '+f1(t.worst.lost)+' left in Wk '+t.worst.week,30)+'<span class="val">'+f1(t.lost)+'<small>pts benched</small></span></div>'}).join('')+'</div>'}
function tradesHtml(d){
  if(!d.trades.length)return '<h2>Trade grader</h2><p class="muted" style="margin-top:6px">No trades in '+d.season+'.</p>';
  return '<div class="ph"><div><div class="kicker">'+d.season+' · points scored for the new team</div><h2>Trade grader</h2></div></div>'+
   d.trades.map(function(t){return '<div class="trade"><div class="kicker">Week '+t.week+'</div>'+t.sides.map(function(sd){return '<div class="tside'+(sd.user_id===t.winner?' won':'')+'">'+whoS(sd.user_id,null,26)+'<span class="val" style="font-size:16px">'+f1(sd.points)+'</span><div class="tgot">'+sd.players.map(function(p){return esc(p.name)+' ('+f1(p.points)+')'}).join(', ')+(sd.picks?' · '+sd.picks+' pick'+(sd.picks>1?'s':''):'')+'</div></div>'}).join('')+
    '<p class="verdict">'+(t.winner?esc(team(t.winner))+' won this trade':'Too close to call')+'</p></div>'}).join('')}
function draftHtml(d){
  var row=function(p){return '<div class="row" style="grid-template-columns:44px minmax(0,1fr) auto"><span class="yr">'+p.round+'.'+String(p.slot).padStart(2,'0')+'</span><div style="min-width:0"><b style="font-size:13.5px">'+esc(p.name)+'</b><div class="muted" style="font-size:11.5px">'+esc(p.pos)+' · '+esc(team(p.user_id))+' · pick '+p.pick_no+', ranked '+p.rank+'</div></div><span class="val" style="font-size:16px">'+f1(p.points)+'</span></div>'};
  return '<div class="ph"><div><div class="kicker">'+d.season+' draft · points while rostered</div><h2>Biggest steals</h2></div></div><div class="rows">'+d.steals.map(row).join('')+'</div>'+
   '<div class="ph" style="margin-top:14px"><div><h2>Biggest busts</h2></div></div><div class="rows">'+d.busts.map(row).join('')+'</div>'}

/* ---------- RECORDS ---------- */
var RECS=[
 ['high','Highest score','team'],['low','Lowest score','team'],['blowout','Biggest blowout','game'],['close','Closest game','game'],
 ['hiloss','Most points in a loss','game'],['lowin','Fewest points in a win','game'],['player','Best player game','player'],
 ['seasonhi','Most points · season','season'],['seasonlo','Fewest points · season','season'],['wstreak','Longest win streak','streak'],['lstreak','Longest losing streak','streak']];
function recType(k){return RECS.find(function(r){return r[0]===k})[2]}
function recList(k){var t=recType(k);if(t==='season'||t==='streak'||S.rf==='all')return D.records[k];return D.recf[S.rf][k]}
function recVal(k,x){var t=recType(k);
  if(t==='team')return {u:x.uid,v:f2(x.v),sub:sw(x.s,x.w)};
  if(t==='player')return {u:x.uid,v:f1(x.v),sub:(x.name?x.name+(x.pos?' ('+x.pos+')':''):'Top scorer')+' · '+sw(x.s,x.w)};
  if(t==='season')return {u:x.uid,v:f1(x.v),sub:x.s+' · '+x.rec};
  if(t==='streak')return {u:x.uid,v:x.n+(x.t==='W'?' W':' L'),sub:x.start+' → '+x.end+(x.live?' · active':'')};
  var g=x;var u=(k==='hiloss')?g.lose:g.win;
  var v=k==='blowout'||k==='close'?f2(g.m):k==='hiloss'?f2(g.lp):f2(g.wp);
  return {u:u,v:v,sub:(k==='hiloss'?'lost to ':'beat ')+team(k==='hiloss'?g.win:g.lose)+' '+f2(g.wp)+'–'+f2(g.lp)+' · '+sw(g.s,g.w)+(g.k!=='Regular season'?' · '+g.k:'')};
}
function recGame(k,x){var t=recType(k);
  if(t==='team'||t==='player')return gi(x.s,x.w,x.uid);
  if(t==='game')return gi(x.s,x.w,x.win);return -1}
function records(){
  var k=S.rec,list=recList(k),t=recType(k),name=RECS.find(function(r){return r[0]===k})[1];
  var h='<div class="chips" role="tablist">'+RECS.map(function(r){return '<button type="button" class="chip'+(r[0]===k?' on':'')+'" data-rec="'+r[0]+'">'+r[1]+'</button>'}).join('')+'</div>';
  if(t!=='season'&&t!=='streak')h+='<div class="seg">'+[['all','All games'],['reg','Regular season'],['post','Playoffs']].map(function(x){return '<button type="button" class="'+(S.rf===x[0]?'on':'')+'" data-rf="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
  if(!list.length)return h+'<p class="muted">No games yet.</p>'+foot();
  var top=recVal(k,list[0]),g0=recGame(k,list[0]);
  h+='<section class="hero rec-hero"><div class="eyebrow">Record book · '+(t==='season'||t==='streak'?'regular season':{all:'all games',reg:'regular season',post:'playoffs'}[S.rf])+'</div><h1 style="font-size:24px">'+name+'</h1><div class="big">'+esc(top.v)+'</div>'+
   '<button class="holder who" type="button" '+(g0>=0?'data-game="'+g0+'"':'data-mgr="'+top.u+'"')+'>'+av(top.u,36)+'<span class="tx"><b>'+esc(team(top.u))+(list[0].s==='2026'?'<span class="new">THIS SEASON</span>':'')+'</b><span>'+esc(top.sub)+'</span></span></button>'+
   '<button type="button" class="share-btn" data-share-rec="1">Share this record</button></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Top '+list.length+'</div><h2>'+name+'</h2></div></div><div class="rows">'+
   list.map(function(x,i){var r=recVal(k,x),gx=recGame(k,x),inner='<span class="rk'+(i===0?' gold':'')+'">'+(i+1)+'</span>'+(gx>=0?whoS(r.u,r.sub,30):who(r.u,r.sub,30))+'<span class="val">'+esc(r.v)+(x.s==='2026'?'<small style="color:var(--pink)">2026</small>':'')+'</span>';
     return gx>=0?'<button type="button" class="row" data-game="'+gx+'" style="grid-template-columns:24px minmax(0,1fr) auto 10px">'+inner+CHEV+'</button>':'<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto">'+inner+'</div>'}).join('')+
   '</div></section>'+foot();
  return h;
}

/* ---------- BOOK ---------- */
function book(){
  var h='<section class="hero bk-hero"><div class="eyebrow">The Banana Book · Week '+D.league.week+'</div><div class="bank">🍌 '+money(bank())+'</div><p class="sub" style="margin-top:6px">Banana Bucks available · '+S.bets.length+' open bet'+(S.bets.length===1?'':'s')+' ('+money(pending())+' at risk)</p></section>';
  h+='<div class="seg">'+[['lines','Lines'],['mine','My bets'],['leaders','Leaders'],['how','How it works']].map(function(x){return '<button type="button" class="'+(S.bseg===x[0]?'on':'')+'" data-bseg="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
  if(S.bseg==='lines'){
    h+='<p class="note"><b>Test mode.</b> Bets are practice money saved only on this phone. In the real app, lines lock at Thursday kickoff and settle Wednesday morning.</p>';
    h+='<div class="colh"><span style="text-align:left">Team</span><span>Spread</span><span>Money</span></div>';
    h+=D.lines.map(function(l,i){
      return '<div class="mu"><div class="mu-h"><button type="button" class="prev-link" data-prev="'+l.id+'">Matchup '+(i+1)+' · Preview ›</button><span class="live"><i></i>'+f2(l.live_a)+' – '+f2(l.live_b)+'</span></div>'+
       sideRow(l,'a')+sideRow(l,'b')+
       '<div class="mu-tot"><span>Total points '+f1(l.total)+'</span>'+ob(l.id,'tot','o','O '+f1(l.total),-110)+ob(l.id,'tot','u','U '+f1(l.total),-110)+'</div></div>'}).join('');
  }
  if(S.bseg==='mine'){
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Week '+D.league.week+'</div><h2>Open bets</h2></div></div>'+
     (S.bets.length?'<div>'+S.bets.map(function(b,i){var o=pickOdds(b);return '<div class="bet"><div><b>'+esc(pickLabel(b))+'</b><span style="display:block">'+odds(o)+' · '+money(b.stake)+' to win '+money(profit(b.stake,o))+'</span></div><div style="display:flex;gap:6px;align-items:center"><span class="st pending">Pending</span><button class="x" type="button" data-cancel="'+i+'">Cancel</button></div></div>'}).join('')+'</div>':
      '<p class="muted">No bets yet. Tap any price on the Lines tab to build a slip.</p>')+'</section>';
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Season</div><h2>Settled bets</h2></div></div><div class="stat3"><div class="stat"><small>Record</small><strong>0-0</strong><span>W-L</span></div><div class="stat"><small>Profit</small><strong>0</strong><span>Bucks</span></div><div class="stat"><small>Allowance</small><strong>+100</strong><span>every Tuesday</span></div></div><p class="muted" style="font-size:12.5px;margin-top:10px">Week '+D.league.week+' bets settle Wednesday morning after Sleeper\'s stat corrections.</p></section>';
  }
  if(S.bseg==='leaders'){
    var lb=ids.filter(function(u){return M(u).active}).map(function(u){return {u:u,b:u===S.me?bank()+pending():1000,open:u===S.me?S.bets.length:0}}).sort(function(a,b){return b.b-a.b||(a.u===S.me?-1:1)});
    h+='<p class="note"><b>Test mode.</b> Only your bets live on this phone, so everyone else shows the starting 1,000. Once the Book is live, this fills in for the whole league.</p>';
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Bankroll + open stakes</div><h2>Leaderboard</h2></div></div><div class="rows">'+
     lb.map(function(x,i){return '<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto"><span class="rk'+(i===0?' gold':'')+'">'+(i+1)+'</span>'+who(x.u,x.open?x.open+' open bet'+(x.open>1?'s':''):'No bets yet',30)+'<span class="val">🍌 '+money(x.b)+'</span></div>'}).join('')+'</div></section>';
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Who\'s on what</div><h2>Bet feed</h2></div></div>'+
     (S.bets.length?'<div class="rows">'+S.bets.slice().reverse().map(function(b){return '<div class="row" style="grid-template-columns:minmax(0,1fr) auto">'+whoS(S.me,'took '+pickLabel(b)+' ('+odds(pickOdds(b))+')',28)+'<span class="val" style="font-size:15px">'+money(b.stake)+'</span></div>'}).join('')+'</div>':'<p class="muted">Bets show up here as people place them.</p>')+'</section>';
  }
  if(S.bseg==='how'){
    var bt=D.backtest;
    h+='<section class="panel"><div class="ph"><div><div class="kicker">How sharp is the Book?</div><h2>Tested on '+bt.games+' past games</h2></div></div><div class="stat3"><div class="stat"><small>Favorites won</small><strong>'+(bt.fav_pct*100).toFixed(1)+'%</strong><span>of games</span></div><div class="stat"><small>Avg miss</small><strong>'+f1(bt.mae)+'</strong><span>points of margin</span></div><div class="stat"><small>Span</small><strong style="font-size:13px;line-height:1.3">'+esc(bt.span)+'</strong><span>replayed</span></div></div><p class="muted" style="font-size:12px;margin-top:10px;line-height:1.5">Same formula, run on each week using only the scores known before kickoff. Fantasy is noisy: even Vegas favorites in the NFL win about two-thirds of the time.</p></section>';
    h+='<section class="panel"><div class="ph"><div><div class="kicker">How the lines are made</div><h2>Built from your league\'s scores</h2></div></div><div class="rows">'+
     [['Projection','45% last 3 weeks, 35% this season, 20% last season, pulled toward the league average (harder in the first 6 weeks). Sleeper player projections get added in the real app.'],
      ['Spread cap','Spreads max out at 20 points so every game is worth betting, even early in the season.'],
      ['Swing','How much each team\'s score bounces week to week, from this season and last.'],
      ['Win chance','The projection gap compared with both teams\' swing on a bell curve.'],
      ['Moneyline','Win chance with a 4.5% house edge, rounded to the nearest 5.'],
      ['Spread & total','Projection gap and projected combined points, priced at -110.']].map(function(x){return '<div class="row" style="grid-template-columns:1fr"><div><b style="font-size:14px">'+x[0]+'</b><p class="muted" style="font-size:12.5px;line-height:1.5;margin-top:2px">'+x[1]+'</p></div></div>'}).join('')+
     '</div></section><section class="panel"><div class="ph"><div><div class="kicker">House rules</div><h2>Banana Bucks only</h2></div></div><p class="muted" style="font-size:13px;line-height:1.6">1,000 to start, plus 100 every Tuesday. 10 to 250 per bet. You can bet on your own game, but only on yourself to win. Ties on a spread or total push. The commish can override or void a line before lock.</p></section>';
  }
  return h+foot();
}
function sideRow(l,s){var u=s==='a'?l.a:l.b,sp=s==='a'?-l.spread:l.spread,ml=s==='a'?l.ml_a:l.ml_b,fav=sp<0;
  return '<div class="mu-t">'+who(u,'proj '+f1(s==='a'?l.pa:l.pb),30)+ob(l.id,'sp',s,spr(sp),-110,fav)+ob(l.id,'ml',s,odds(ml),null,fav)+'</div>'}
function ownBlocked(l,mkt,side){var me=S.me;if(l.a!==me&&l.b!==me)return false;if(mkt==='tot')return false;var mine=(l.a===me?'a':'b');return side!==mine}
function ob(id,mkt,side,label,sub,fav){var l=line(id),sel=S.slip&&S.slip.line===id&&S.slip.mkt===mkt&&S.slip.side===side;var dis=ownBlocked(l,mkt,side);
  return '<button type="button" class="ob'+(fav?' fav':'')+(sel?' sel':'')+'" data-pick="'+id+'|'+mkt+'|'+side+'"'+(dis?' disabled title="You can only bet on yourself in your own game"':'')+'>'+esc(label)+(sub!=null?'<small>'+odds(sub)+'</small>':'')+'</button>'}

