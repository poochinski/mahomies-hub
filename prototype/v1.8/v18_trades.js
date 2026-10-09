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
