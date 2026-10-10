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
