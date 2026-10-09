/* ---------- MATCHUP PREVIEW ---------- */
function sdOf(arr){if(arr.length<2)return 0;var m=arr.reduce(function(a,b){return a+b},0)/arr.length;return Math.sqrt(arr.reduce(function(a,b){return a+(b-m)*(b-m)},0)/arr.length)}
function scores26(u){var o=[];for(var w=1;w<=D.league.last_scored;w++){var p=P26(w,u);if(p!=null)o.push({w:w,p:p})}return o}
function P26(w,u){var t=D.tw['2026|'+w+'|'+u];return t?t[0]:null}
function oddsOf(u){return D.odds.list.find(function(o){return o.uid===u})}
function powOf(u){return D.power.find(function(p){return p.uid===u})}
function previewSheet(id){
  var l=line(id),a=l.a,b=l.b,pa=Math.round(l.wp*100),A=scores26(a),B=scores26(b);
  var avg=function(x){return x.reduce(function(s,y){return s+y.p},0)/Math.max(1,x.length)};
  var sA=sdOf(A.map(function(x){return x.p})),sB=sdOf(B.map(function(x){return x.p}));
  var r=D.h2h[a+'|'+b]||{w:0,l:0,games:[]},last=r.games[r.games.length-1];
  var pwA=powOf(a),pwB=powOf(b),oA=oddsOf(a),oB=oddsOf(b);
  var sb=function(u,live,rec){return '<div class="sb-row">'+who(u,rec+' · power #'+powOf(u).rank,40)+'<div class="sb-pts num" style="font-size:24px">'+f2(live)+'</div></div>'};
  var h='<section class="hero gs"><div class="eyebrow">Week '+D.league.week+' preview · live</div><div class="sb">'+sb(a,l.live_a,pwA.rec)+sb(b,l.live_b,pwB.rec)+'</div>'+
   '<div class="wp"><div class="wp-l"><span>'+esc(team(a))+'</span><b>'+pa+'%</b></div><div class="wp-bar"><i style="width:'+pa+'%"></i></div><div class="wp-l r"><b>'+(100-pa)+'%</b><span>'+esc(team(b))+'</span></div></div>'+
   '<p class="margin">Win chance from the Banana Book</p></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Banana Book</div><h2>The line</h2></div><button class="link" data-go="book">Bet this game →</button></div><div class="stat3">'+
   '<div class="stat"><small>Spread</small><strong>'+esc(team(l.spread>=0?a:b).split(' ')[0])+' '+spr(-Math.abs(l.spread))+'</strong><span>favorite</span></div>'+
   '<div class="stat"><small>Moneyline</small><strong style="font-size:16px">'+odds(l.ml_a)+' / '+odds(l.ml_b)+'</strong><span>'+esc(M(a).name)+' / '+esc(M(b).name)+'</span></div>'+
   '<div class="stat"><small>Total</small><strong>'+f1(l.total)+'</strong><span>points</span></div></div></section>';
  var formRow=function(u,X){var mx=200;return '<div class="form"><div class="form-h">'+whoS(u,'avg '+f1(avg(X))+' · swing ±'+f1(sdOf(X.map(function(x){return x.p})))+'',26)+'</div><div class="form-bars">'+X.map(function(x){return '<button type="button" class="fb" data-game="'+gi('2026',x.w,u)+'"><i style="height:'+Math.max(8,x.p/mx*100)+'%"></i><span>'+Math.round(x.p)+'</span><small>W'+x.w+'</small></button>'}).join('')+'</div></div>'};
  h+='<section class="panel"><div class="ph"><div><div class="kicker">2026 weekly scores · tap a bar</div><h2>Form</h2></div></div>'+formRow(a,A)+formRow(b,B)+'</section>';
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
  var x=D.seasons[s],last=s==='2026'?D.league.last_scored:17;if(!S.sw||S.sw>last)S.sw=s==='2026'?last:1;
  var h='<section class="hero"><div class="eyebrow">'+(s==='2026'?'In progress':'Final')+'</div><h1>'+s+' season</h1>'+(x.champ?'<p class="sub">🏆 '+esc(tnS(s,x.champ))+' won it all. 🚽 '+esc(tnS(s,x.sacko))+' took the Sacko.</p>':'<p class="sub">Through Week '+last+'.</p>')+
   '<button type="button" class="share-btn" data-share-season="'+s+'">Share season card</button></section>';
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Regular season</div><h2>Final standings</h2></div></div><div class="tw"><table><thead><tr><th>Team</th><th>W-L</th><th>PF</th><th>PA</th><th>Luck</th></tr></thead><tbody>'+
   x.standings.map(function(t,i){return '<tr class="'+(t.uid===S.me?'me ':'')+(i===5?'cut':'')+'"><td class="tm"><button class="who" type="button" data-mgr="'+t.uid+'"><span class="rk" style="width:20px;height:20px;font-size:10px">'+t.seed+'</span><span class="tx"><b style="font-size:13px">'+esc(tnS(s,t.uid))+'</b></span></button></td><td><b>'+t.w+'-'+t.l+'</b></td><td>'+f1(t.pf)+'</td><td>'+f1(t.pa)+'</td><td class="'+(t.luck>0.4?'pos':t.luck<-0.4?'negv':'')+'">'+(t.luck>0?'+':'')+f1(t.luck)+'</td></tr>'}).join('')+'</tbody></table></div></section>';
  if(x.bracket){h+='<section class="panel"><div class="ph"><div><div class="kicker">Tap a game for the box score</div><h2>Playoff bracket</h2></div></div>'+bracketHtml(s,x.bracket.winners,false)+'</section>';
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Losers advance</div><h2>Toilet Bowl</h2></div></div>'+bracketHtml(s,x.bracket.losers,true)+'</section>'}
  h+='<section class="panel"><div class="ph"><div><div class="kicker">Every week</div><h2>Week '+S.sw+'</h2></div></div><div class="chips" style="margin-bottom:10px">';
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
  showShare({eyebrow:'All-time record',title:name,big:top.v,team:team(top.u),sub:top.sub})}
function shareGame(i){var g=D.games[i];showShare({eyebrow:g.s+' · Week '+g.w+' · '+g.k,title:tnS(g.s,g.win)+' def. '+tnS(g.s,g.lose),big:f2(g.wp),team:'to '+f2(g.lp),sub:'Won by '+f2(g.m)})}
function shareSeason(s){var x=D.seasons[s];showShare({eyebrow:s+' season',title:x.champ?'Champion':'Leader',big:'🏆',team:tnS(s,x.champ||x.standings[0].uid),sub:x.sacko?'Sacko: '+tnS(s,x.sacko):'Through Week '+D.league.last_scored})}

