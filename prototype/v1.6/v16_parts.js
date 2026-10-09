//@@HOME
function home(){
  var L=D.league,pw=D.power,hw=S.hw;
  var wk=weekScores(CUR(),hw),top=wk[0],rot=wk[wk.length-1];
  var potw=null;wk.forEach(function(x){var t=topP(CUR(),hw,x.u);if(t&&t.name&&(!potw||t.pts>potw.pts))potw={u:x.u,name:t.name,pts:t.pts}});
  var unbeaten=pw.filter(function(p){return /-0$/.test(p.rec)})[0];
  var h='<section class="hero hero-tight"><div class="eyebrow">'+CUR()+' season · Week '+L.week+'</div><h1>Week '+L.week+'</h1><p class="sub">'+(LIVE?'Live from Sleeper · updated '+esc(D.updated_label)+'.':'Snapshot · data as of '+esc(D.updated_label)+'.')+'</p>'+
   '<div class="tiles tiles-swipe">'+
   (top?tile('t-y','Top Banana · Wk '+hw,f2(top.p),team(top.u),top.u,gi(CUR(),hw,top.u)):'')+
   (rot?tile('t-r','Rotten Banana · Wk '+hw,f2(rot.p),team(rot.u),rot.u,gi(CUR(),hw,rot.u)):'')+
   (potw?tile('t-b','Player of the week',f1(potw.pts),potw.name+' · '+team(potw.u),potw.u,gi(CUR(),hw,potw.u)):'')+
   (unbeaten?tile('t-g','Still unbeaten',unbeaten.rec,team(unbeaten.uid),unbeaten.uid):'')+
   '</div><div class="swipe-hint">swipe ›</div></section>';
  if(D.lines.length){
    h+='<section class="block"><div class="bh"><div><div class="kicker">Live now · tap a game</div><h2>Week '+L.week+' matchups</h2></div><button class="link" data-go="book">Bet these →</button></div>'+
     '<div class="carousel">'+D.lines.map(function(l,i){return matchCard(l,i)}).join('')+'</div></section>';
  }
  h+='<section class="block"><div class="bh"><div><div class="kicker">Jump to</div><h2>Explore the league</h2></div></div><div class="jump">'+
   [['league:awards','🏆','Awards','t-y'],['league:odds','🎯','Playoff odds','t-b'],['records','📚','Record book','t-r'],['league:history','📜','History','t-k'],['league:h2h','⚔️','Rivals','t-g'],['league:lab','🧪','Lab','t-b']]
    .map(function(j){return '<button type="button" class="jt '+j[3]+'" data-go="'+j[0]+'"><span>'+j[1]+'</span><b>'+j[2]+'</b></button>'}).join('')+'</div></section>';
  var A=(D.awards[CUR()]||[]).filter(function(a){return a.key!=='champ'&&a.key!=='sacko'});
  if(A.length){
    h+='<section class="block"><div class="bh"><div><div class="kicker">'+CUR()+' so far</div><h2>Awards race</h2></div><button class="link" data-go="league:awards">All awards →</button></div>'+
     '<div class="carousel narrow">'+A.map(awardCard).join('')+'</div></section>';
  }
  var gs=weekGames(CUR(),hw);
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Final scores</div><h2>Results</h2></div></div>'+
   '<div class="chips" style="margin-bottom:10px">'+DONE().map(function(w){return '<button type="button" class="chip'+(w===hw?' on':'')+'" data-hw="'+w+'">Week '+w+'</button>'}).join('')+'</div>'+
   recapHtml(CUR(),hw)+resultsHtml(CUR(),hw,S.resMore?99:3)+
   (gs.length>3?'<button type="button" class="more" data-more="res">'+(S.resMore?'Show fewer':'Show all '+gs.length+' games')+'</button>':'')+'</section>';
  var od=D.odds.list;
  if(od.length){
    h+='<section class="panel"><div class="ph"><div><div class="kicker">'+money(D.odds.sims)+' simulated seasons</div><h2>Playoff race</h2></div><button class="link" data-go="league:odds">All odds →</button></div><div class="rows">'+
     od.slice(0,7).map(function(o,i){return '<div class="row'+(i===6?' cutrow':'')+'" style="grid-template-columns:minmax(0,1fr) 92px">'+who(o.uid,o.rec+' · proj '+f1(o.wins)+' W',28)+oddsBar(o.playoff)+'</div>'}).join('')+
     '</div><p class="muted" style="font-size:11.5px;margin-top:8px">Top 6 make the playoffs. Dashed line = first team out.</p></section>';
  }
  if(pw.length){
    h+='<section class="block"><div class="bh"><div><div class="kicker">After Week '+L.last_scored+'</div><h2>Power rankings</h2></div><button class="link" data-go="league:season">Full table →</button></div>'+
     '<div class="carousel narrow">'+pw.map(function(p){return '<button type="button" class="pcard" data-mgr="'+p.uid+'"><span class="rk'+(p.rank===1?' gold':'')+'">'+p.rank+'</span>'+av(p.uid,44)+'<b>'+esc(team(p.uid))+'</b><span class="pc-r">'+p.rec+' · '+f1(p.avg)+' ppg</span><span class="pc-p">'+f1(p.power)+'</span>'+mv(p.move)+'</button>'}).join('')+'</div></section>';
  }
  h+=historyCard(L.week);
  return h+foot();
}
function matchCard(l,i){
  var fa=l.spread>=0,fav=fa?l.a:l.b,sp=Math.abs(l.spread);
  var side=function(u,pts,ml){return '<div class="mc-t">'+av(u,34)+'<span class="mc-n"><b>'+esc(team(u))+'</b><small>ML '+odds(ml)+'</small></span><span class="mc-s num">'+f2(pts)+'</span></div>'};
  return '<button type="button" class="mcard" data-prev="'+l.id+'"><div class="mc-h"><span>Game '+(i+1)+'</span><span class="live"><i></i>Live</span></div>'+
   side(l.a,l.live_a,l.ml_a)+side(l.b,l.live_b,l.ml_b)+
   '<div class="mc-f"><span>'+esc(team(fav).split(' ').slice(0,2).join(' '))+' by '+f1(sp)+'</span><span>O/U '+f1(l.total)+'</span><span class="mc-go">Preview ›</span></div></button>'}
function awardCard(a){var gx=a.game?gi(a.game.s,a.game.w,a.game.win):-1;
  return '<button type="button" class="acard a-'+a.key+'" '+(gx>=0?'data-game="'+gx+'"':'data-mgr="'+a.uid+'"')+'><span class="aw-ic">'+(AW_ICON[a.key]||'⭐')+'</span><span class="aw-t">'+esc(a.title)+'</span><span class="aw-v num">'+esc(a.val)+'</span><span class="aw-w">'+av(a.uid,20)+'<b>'+esc(team(a.uid))+'</b></span></button>'}
//@@LEAGUE
var LSEGS=[['season','📊','Standings'],['odds','🎯','Playoff odds'],['awards','🏆','Awards'],['history','📜','History'],['alltime','👑','All-time'],['h2h','⚔️','Rivals'],['lab','🧪','Lab'],['@records','📚','Records']];
function league(){
  var h='<div class="lnav">'+LSEGS.map(function(x){var go=x[0][0]==='@';return '<button type="button" class="ln-t'+(S.lseg===x[0]?' on':'')+'" '+(go?'data-go="'+x[0].slice(1)+'"':'data-lseg="'+x[0]+'"')+'><span>'+x[1]+'</span><b>'+x[2]+'</b></button>'}).join('')+'</div>';
  h+=({season:seasonView,odds:oddsView,history:historyView,alltime:alltimeView,h2h:h2hView,awards:awardsView,lab:labView}[S.lseg]||seasonView)();
  return h+foot();
}
//@@AWARDS
function awardsView(){
  var s=S.aws;var A=D.awards[s]||[];
  var h='<div class="seasons">'+ALLS().map(function(x){var c=D.seasons[x]&&D.seasons[x].champ;return '<button type="button" class="ss'+(x===s?' on':'')+'" data-aws="'+x+'"><b>'+x+'</b><span>'+(x===CUR()?'so far':c?'🏆 '+esc(tnS(x,c)):'')+'</span></button>'}).join('')+'</div>';
  var champ=A.find(function(a){return a.key==='champ'}),sacko=A.find(function(a){return a.key==='sacko'});
  h+='<section class="hero aw-hero"><div class="eyebrow">'+(s===CUR()?'Season in progress · through Week '+D.league.last_scored:'Final · '+s)+'</div><h1>'+s+' awards</h1>';
  if(champ)h+='<div class="podium2"><button type="button" class="p2 gold" data-mgr="'+champ.uid+'"><span>🏆</span>'+av(champ.uid,52)+'<b>'+esc(tnS(s,champ.uid))+'</b><small>Champion</small></button>'+(sacko?'<button type="button" class="p2 poo" data-mgr="'+sacko.uid+'"><span>🚽</span>'+av(sacko.uid,52)+'<b>'+esc(tnS(s,sacko.uid))+'</b><small>Sacko</small></button>':'')+'</div>';
  else h+='<p class="sub">Handed out automatically from the league\'s scores. These change every week until the season ends.</p>';
  h+='</section>';
  h+='<div class="awards">'+A.filter(function(a){return a.key!=='champ'&&a.key!=='sacko'}).map(function(a){var gx=a.game?gi(a.game.s,a.game.w,a.game.win):-1;
    return '<button type="button" class="award a-'+a.key+'" '+(gx>=0?'data-game="'+gx+'"':'data-mgr="'+a.uid+'"')+'><span class="aw-ic">'+(AW_ICON[a.key]||'⭐')+'</span><span class="aw-t">'+esc(a.title)+'</span><span class="aw-v num">'+esc(a.val)+'</span><span class="aw-w">'+av(a.uid,22)+'<b>'+esc(tnS(s,a.uid))+'</b></span><span class="aw-n">'+esc(a.note)+'</span></button>'}).join('')+'</div>';
  h+='<button type="button" class="share-btn wide" data-share-aw="'+s+'">Share '+s+' awards</button>';
  h+='<details class="bench" style="margin-top:4px"><summary>Coming with live sync · 5 more awards</summary><div class="rows">'+
   [['🧙 Waiver Wizard','Most points from players picked up during the season'],['🤝 Trade of the Year','Biggest points edge from a single trade'],['💎 Draft Steal','Latest pick with the most points'],['💸 Draft Bust','Earliest pick with the fewest points'],['🪑 Bench Shame Champ','Most points left on the bench']].map(function(x){return '<div class="row" style="grid-template-columns:1fr"><div><b style="font-size:14px">'+x[0]+'</b><p class="muted" style="font-size:12px;margin-top:2px">'+x[1]+'</p></div></div>'}).join('')+'</div></details>';
  return h;
}
