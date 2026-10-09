//@@HOME
function home(){
  var L=D.league,hw=S.hw,me=S.me;
  var my=D.lines.filter(function(l){return l.a===me||l.b===me})[0];
  var h='<section class="hero hero-tight"><div class="eyebrow">'+CUR()+' · Week '+L.week+(LIVE?' · <span class="live"><i></i>Live</span>':'')+'</div><h1>Week '+L.week+'</h1>';
  if(my){
    var mineA=my.a===me,opp=mineA?my.b:my.a,myPts=mineA?my.live_a:my.live_b,opPts=mineA?my.live_b:my.live_a,wp=Math.round((mineA?my.wp:1-my.wp)*100);
    h+='<button type="button" class="yourgame" data-prev="'+my.id+'"><div class="yg-k">Your game · tap for preview</div>'+
     '<div class="yg-row">'+av(me,40)+'<div class="yg-n"><b>'+esc(team(me))+'</b><span>'+wp+'% to win</span></div><b class="yg-s num">'+f2(myPts)+'</b></div>'+
     '<div class="yg-row">'+av(opp,40)+'<div class="yg-n"><b>'+esc(team(opp))+'</b><span>'+(100-wp)+'% to win</span></div><b class="yg-s num dim">'+f2(opPts)+'</b></div>'+
     '<div class="wp-bar"><i style="width:'+wp+'%"></i></div></button>';
  } else {
    var o=(D.odds.list||[]).find(function(x){return x.uid===me});var st=(D.seasons[CUR()].standings||[]).find(function(x){return x.uid===me});
    if(st)h+='<button type="button" class="yourgame" data-go="league:odds"><div class="yg-k">Your season</div><div class="yg-row">'+av(me,40)+'<div class="yg-n"><b>'+esc(team(me))+'</b><span>'+st.w+'-'+st.l+' · seed '+st.seed+(o?' · '+pct(o.playoff)+' playoff odds':'')+'</span></div></div></button>';
  }
  h+='</section>';
  if(D.lines.length){
    h+='<section class="panel tight"><div class="ph"><div><div class="kicker">Live scores · tap a game</div><h2>This week</h2></div><button class="link" data-go="book">Bet →</button></div><div class="games">'+
     D.lines.map(function(l){var aw=l.live_a>=l.live_b;return '<button type="button" class="gl" data-prev="'+l.id+'">'+
       '<span class="gl-t'+(aw&&l.live_a>0?' w':'')+'">'+av(l.a,22)+'<b>'+esc(team(l.a))+'</b><i class="num">'+f1(l.live_a)+'</i></span>'+
       '<span class="gl-t'+(!aw&&l.live_b>0?' w':'')+'">'+av(l.b,22)+'<b>'+esc(team(l.b))+'</b><i class="num">'+f1(l.live_b)+'</i></span></button>'}).join('')+'</div></section>';
  }
  var wk=weekScores(CUR(),hw),top=wk[0],rot=wk[wk.length-1],potw=null;
  wk.forEach(function(x){var t=topP(CUR(),hw,x.u);if(t&&t.name&&(!potw||t.pts>potw.pts))potw={u:x.u,name:t.name,pts:t.pts}});
  if(top){
    h+='<section class="panel tight"><div class="ph"><div><div class="kicker">Week '+hw+' final</div><h2>Last week</h2></div><button class="link" data-wk="'+hw+'">Recap &amp; scores →</button></div><div class="lw">'+
     '<button type="button" class="lw-c t-y" data-game="'+gi(CUR(),hw,top.u)+'"><small>🍌 Top Banana</small><strong class="num">'+f1(top.p)+'</strong><span>'+esc(team(top.u))+'</span></button>'+
     '<button type="button" class="lw-c t-r" data-game="'+gi(CUR(),hw,rot.u)+'"><small>🤢 Rotten</small><strong class="num">'+f1(rot.p)+'</strong><span>'+esc(team(rot.u))+'</span></button>'+
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
//@@AWARDS
function awardsView(){
  var s=S.aws;var A=D.awards[s]||[];
  var h='<div class="seg seg4">'+ALLS().map(function(x){return '<button type="button" class="'+(x===s?'on':'')+'" data-aws="'+x+'">'+x+'</button>'}).join('')+'</div>';
  var champ=A.find(function(a){return a.key==='champ'}),sacko=A.find(function(a){return a.key==='sacko'});
  h+='<section class="hero aw-hero"><div class="eyebrow">'+(s===CUR()?'In progress · through Week '+D.league.last_scored:'Final')+'</div><h1>'+s+' awards</h1>';
  if(champ)h+='<div class="podium2"><button type="button" class="p2 gold" data-mgr="'+champ.uid+'"><span class="p2i">🏆</span>'+av(champ.uid,44)+'<b>'+esc(tnS(s,champ.uid))+'</b><small>Champion</small></button>'+(sacko?'<button type="button" class="p2 poo" data-mgr="'+sacko.uid+'"><span class="p2i">🚽</span>'+av(sacko.uid,44)+'<b>'+esc(tnS(s,sacko.uid))+'</b><small>Sacko</small></button>':'')+'</div>';
  else h+='<p class="sub">Leaders change every week until the season ends.</p>';
  h+='</section><section class="panel tight"><div class="rows">'+A.filter(function(a){return a.key!=='champ'&&a.key!=='sacko'}).map(function(a){var gx=a.game?gi(a.game.s,a.game.w,a.game.win):-1;
    return '<button type="button" class="row aw-row" '+(gx>=0?'data-game="'+gx+'"':'data-mgr="'+a.uid+'"')+'><span class="aw-ic">'+(AW_ICON[a.key]||'⭐')+'</span><span class="aw-m"><b>'+esc(a.title)+'</b><span>'+esc(tnS(s,a.uid))+' · '+esc(a.note)+'</span></span><span class="aw-v num">'+esc(a.val)+'</span></button>'}).join('')+'</div></section>';
  h+='<button type="button" class="share-btn wide" data-share-aw="'+s+'">Share '+s+' awards</button>';
  return h;
}
//@@RECORDS
function records(){
  var k=S.rec,list=recList(k),t=recType(k),name=RECS.find(function(r){return r[0]===k})[1];
  var h='<button type="button" class="picker" data-recpick="1"><span><small>Record</small><b>'+name+'</b></span><i>Change ▾</i></button>';
  if(t!=='season'&&t!=='streak')h+='<div class="seg">'+[['all','All games'],['reg','Regular'],['post','Playoffs']].map(function(x){return '<button type="button" class="'+(S.rf===x[0]?'on':'')+'" data-rf="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
  if(!list.length)return h+'<p class="muted">No games yet.</p>'+foot();
  var top=recVal(k,list[0]),g0=recGame(k,list[0]),b0=g0<0?byeKey(k,list[0]):null;
  h+='<section class="hero rec-hero"><div class="eyebrow">All-time #1</div><div class="big">'+esc(top.v)+'</div>'+
   '<button class="holder who" type="button" '+(g0>=0?'data-game="'+g0+'"':b0?'data-bye="'+b0+'"':'data-mgr="'+top.u+'"')+'>'+av(top.u,36)+'<span class="tx"><b>'+esc(team(top.u))+(list[0].s===CUR()?'<span class="new">THIS SEASON</span>':'')+'</b><span>'+esc(top.sub)+'</span></span></button>'+
   '<button type="button" class="share-btn" data-share-rec="1">Share</button></section>';
  h+='<section class="panel tight"><div class="rows">'+
   list.slice(1,S.recMore?10:5).map(function(x,j){var i=j+1,r=recVal(k,x),gx=recGame(k,x),by=gx<0?byeKey(k,x):null,tap=gx>=0||by,inner='<span class="rk">'+(i+1)+'</span>'+(tap?whoS(r.u,r.sub+(by?' · playoff bye':''),28):who(r.u,r.sub,28))+'<span class="val">'+esc(r.v)+'</span>';
     return tap?'<button type="button" class="row" '+(gx>=0?'data-game="'+gx+'"':'data-bye="'+by+'"')+' style="grid-template-columns:24px minmax(0,1fr) auto 10px">'+inner+CHEV+'</button>':'<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto">'+inner+'</div>'}).join('')+
   '</div>'+(list.length>5?'<button type="button" class="more" data-more="rec">'+(S.recMore?'Show top 5':'Show top '+list.length)+'</button>':'')+'</section>'+foot();
  return h;
}
function recPickSheet(){
  var groups=[['Team scores',['high','low','seasonhi','seasonlo']],['Games',['blowout','close','hiloss','lowin']],['Players & streaks',['player','wstreak','lstreak']]];
  return '<div class="ph" style="margin:0"><div><div class="kicker">Record book</div><h2>Pick a record</h2></div></div>'+groups.map(function(g){return '<div class="kicker" style="margin-top:4px">'+g[0]+'</div><div class="pick-grid">'+g[1].map(function(k){var r=RECS.find(function(x){return x[0]===k});return '<button type="button" class="pk'+(k===S.rec?' on':'')+'" data-rec="'+k+'">'+r[1]+'</button>'}).join('')+'</div>'}).join('');
}
