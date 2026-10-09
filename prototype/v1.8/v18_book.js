/* ---------- BANANA BOOK (live, v1.8): talks to /api/book ---------- */
var BK={on:null,status:null,wk:null,me:null,lb:null,feed:null,teams:null,err:null};
var AUTH=store('auth')||null;
function api(path,opt){opt=opt||{};var h={accept:'application/json'};if(opt.body)h['content-type']='application/json';if(AUTH&&AUTH.token)h.authorization='Bearer '+AUTH.token;
  return fetch('/api/book'+path,{method:opt.method||(opt.body?'POST':'GET'),headers:h,body:opt.body?JSON.stringify(opt.body):undefined,cache:'no-store'})
   .then(function(r){return r.json().catch(function(){return {}}).then(function(j){
     if(r.status===401&&AUTH&&path!=='/login'){AUTH=null;store('auth',null);BK.me=null}
     if(!r.ok)throw new Error(j.error||('Something went wrong ('+r.status+')'));return j})})}
var bookBusy=false;
function bookLoad(){
  if(!LIVE||bookBusy)return;bookBusy=true;
  api('/status').then(function(s){BK.on=true;BK.status=s;BK.err=null;
    return Promise.all([api('/lines').then(function(w){BK.wk=w}),api('/leaderboard').then(function(x){BK.lb=x}),api('/feed?limit=40').then(function(x){BK.feed=x}),
      AUTH?api('/me').then(function(m){BK.me=m;if(S.me!==m.user_id){S.me=m.user_id;store('me',S.me);S.h2a=S.me}}).catch(function(){}):null])})
   .then(function(){S.picks=S.picks.filter(function(p){var l=bl(p.line);return l&&!l.locked&&l.status==='open'});bookBusy=false;render()})
   .catch(function(e){bookBusy=false;BK.on=false;BK.err=e.message;render()})}
setInterval(function(){if(document.visibilityState==='visible'&&(S.tab==='book'||S.tab==='me'))bookLoad()},60000);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')bookLoad()});

function bl(id){return BK.wk&&BK.wk.lines?BK.wk.lines.find(function(l){return l.id===id}):null}
function BS(){return (BK.status&&BK.status.settings)||{min_bet:10,max_bet:250,parlay_max_legs:4,parlay_max_payout:10000,grant:1000}}
function a2d(o){return o>0?1+o/100:1+100/Math.abs(o)}
function legOdds(p){var l=bl(p.line);return p.mkt==='ml'?(p.side==='a'?l.ml_a:l.ml_b):p.mkt==='spread'?l.spread_price:l.total_price}
function legPoint(p){var l=bl(p.line);return p.mkt==='spread'?(p.side==='a'?-l.spread:l.spread):p.mkt==='total'?l.total:null}
function legLabel(p){var l=bl(p.line);if(p.mkt==='ml')return team(p.side==='a'?l.a:l.b)+' to win';if(p.mkt==='spread')return team(p.side==='a'?l.a:l.b)+' '+spr(legPoint(p));return (p.side==='over'?'Over ':'Under ')+f1(l.total)}
function slipDec(){return S.picks.reduce(function(x,p){return x*a2d(legOdds(p))},1)}
function slipOdds(){var d=slipDec();return S.picks.length===1?legOdds(S.picks[0]):(d>=2?Math.round((d-1)*100):-Math.round(100/(d-1)))}
function slipWin(st){var w=st*slipDec();if(S.picks.length>1)w=Math.min(w,BS().parlay_max_payout);return w-st}
function bank(){return BK.me?BK.me.balance:0}
function money2(n){return Number(n).toLocaleString('en-US',{maximumFractionDigits:2})}
function whenTxt(iso){return new Date(iso).toLocaleString('en-US',{weekday:'short',hour:'numeric',minute:'2-digit'})}
function lockTxt(l){if(l.status==='final')return 'Final';if(l.status==='void')return 'Off the board';
  var ms=l.lock_at?new Date(l.lock_at)-Date.now():null;if(l.locked||(ms!=null&&ms<=0))return 'Locked · in progress';if(ms==null)return 'Lock time pending';
  if(ms<36e5)return 'Locks in '+Math.max(1,Math.round(ms/6e4))+' min';if(ms<864e5)return 'Locks in '+Math.floor(ms/36e5)+'h '+Math.round(ms%36e5/6e4)+'m';return 'Locks '+whenTxt(l.lock_at)}
function isLk(l){return l.status!=='open'||l.locked||(l.lock_at&&new Date(l.lock_at)<=Date.now())}
function blocked(l,mkt,side){var me=AUTH&&AUTH.user_id;if(!me||(l.a!==me&&l.b!==me))return false;var mine=l.a===me?'a':'b';if(mkt==='total')return side==='under';return side!==mine}
function picked(id,mkt,side){return S.picks.some(function(p){return p.line===id&&p.mkt===mkt&&p.side===side})}
function obk(l,mkt,side,label,sub,fav){var lk=isLk(l),dis=lk||blocked(l,mkt,side);
  return '<button type="button" class="ob'+(fav?' fav':'')+(picked(l.id,mkt,side)?' sel':'')+'" data-bk="'+l.id+'|'+mkt+'|'+side+'"'+(dis?' disabled':'')+(blocked(l,mkt,side)?' title="You can\'t bet against yourself"':'')+'>'+esc(label)+(sub!=null?'<small>'+odds(sub)+'</small>':'')+'</button>'}
function sideRowB(l,s){var u=s==='a'?l.a:l.b,sp=s==='a'?-l.spread:l.spread,ml=s==='a'?l.ml_a:l.ml_b,sc=s==='a'?l.score_a:l.score_b;
  return '<div class="mu-t">'+who(u,(sc!=null&&isLk(l)?f2(sc)+' pts · ':'')+'proj '+f1(s==='a'?l.proj_a:l.proj_b),30)+obk(l,'spread',s,spr(sp),l.spread_price,sp<0)+obk(l,'ml',s,odds(ml),null,sp<0)+'</div>'}
function bookHero(){
  if(AUTH&&BK.me){var open=BK.me.bets.filter(function(b){return b.status==='open'});
    return '<section class="hero bk-hero"><div class="eyebrow">The Banana Book · '+esc(team(BK.me.user_id))+'</div><div class="bank">🍌 '+money2(BK.me.balance)+'</div><p class="sub" style="margin-top:6px">Banana Bucks to bet · '+open.length+' open bet'+(open.length===1?'':'s')+(open.length?' ('+money2(BK.me.in_play)+' in play)':'')+'</p></section>'}
  return '<section class="hero bk-hero"><div class="eyebrow">The Banana Book</div><h1 style="margin-top:6px">Bet with Banana Bucks</h1><p class="sub">Every manager gets '+money(BS().grant)+' Bucks for the season. No refills.</p>'+
   (BK.on?'<button type="button" class="cta" data-login="1" style="margin-top:12px">Log in to bet</button>':'')+'</section>'}
function bookOff(){return '<section class="panel"><div class="ph"><div><div class="kicker">Banana Book</div><h2>'+(LIVE?'The Book is offline':'Open the live app')+'</h2></div></div><p class="muted" style="font-size:13px;line-height:1.5">'+
  (LIVE?esc(BK.err||'The Book couldn\'t load.')+' Try again in a minute.':'Betting only works in the live app on Railway.')+'</p>'+(LIVE?'<button type="button" class="ghost" data-bkreload="1" style="margin-top:10px">Try again</button>':'')+'</section>'}
function betCard(b,mine){var lk=b.legs.some(function(g){return g.locked});
  var st=b.status==='open'?(lk?'<span class="st pending">Live</span>':'<span class="st pending">Open</span>'):'<span class="st s-'+b.status+'">'+b.status+'</span>';
  return '<div class="bet"><div>'+(mine?'':'<b style="font-size:12.5px;color:var(--banana)">'+esc(team(b.user_id))+'</b>')+
   b.legs.map(function(g){return '<b style="display:block">'+(b.legs.length>1?'<i class="lg lg-'+g.result+'"></i>':'')+esc(g.label)+'</b>'}).join('')+
   '<span style="display:block">'+(b.kind==='parlay'?b.legs.length+'-pick parlay · ':'')+odds(b.odds)+' · '+money2(b.stake)+(b.status==='won'?' → won '+money2(b.payout-b.stake):b.status==='lost'?' · lost':b.status==='push'||b.status==='void'?' · stake back':' to win '+money2(b.to_win))+' · Wk '+b.week+'</span></div>'+
   '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">'+st+(mine&&b.status==='open'&&!lk?'<button class="x" type="button" data-bcancel="'+b.id+'">Cancel</button>':'')+'</div></div>'}
function book(){
  var h=bookHero();
  h+='<div class="seg">'+[['lines','Lines'],['mine','My bets'],['leaders','Leaders'],['how','Rules']].map(function(x){return '<button type="button" class="'+(S.bseg===x[0]?'on':'')+'" data-bseg="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
  if(S.bseg!=='how'&&!BK.on)return h+(BK.on===null&&LIVE?'<p class="muted" style="padding:16px 4px">Loading the Book…</p>':bookOff())+foot();
  if(S.bseg==='lines'){
    var W=BK.wk;
    if(!W||!W.week||!W.lines.length){var nx=BK.status&&BK.status.next;
      h+='<section class="panel"><div class="ph"><div><div class="kicker">Week '+(nx?nx.week:D.league.week)+'</div><h2>Lines aren\'t up yet</h2></div></div><p class="muted" style="font-size:13px;line-height:1.5">'+(nx&&nx.posts_label?'They post <b style="color:var(--banana)">'+esc(nx.posts_label)+'</b> (Pacific) and stay frozen all week.':'They post Tuesday at 6 AM Pacific.')+' Each game locks when the first starter in either lineup kicks off.</p></section>';
    } else {
      var settled=!!W.settled_at;
      h+='<div class="bk-sub"><span>Week '+W.week+(settled?' · settled':W.settle_at?' · settles '+whenTxt(W.settle_at):'')+'</span><span>Spread · Money</span></div>';
      h+=W.lines.map(function(l,i){var sc=l.score_a!=null&&(l.score_a||l.score_b)?'<span class="num">'+f2(l.score_a)+' – '+f2(l.score_b)+'</span>':'';
        return '<div class="mu'+(l.status==='void'?' void':'')+'"><div class="mu-h"><span class="'+(isLk(l)&&l.status==='open'?'live':'')+'">'+(isLk(l)&&l.status==='open'?'<i></i>':'')+esc(lockTxt(l))+'</span>'+(sc||'<button type="button" class="prev-link" data-bkprev="'+l.id+'">Preview ›</button>')+'</div>'+
         sideRowB(l,'a')+sideRowB(l,'b')+
         '<div class="mu-tot"><span>Total '+f1(l.total)+'</span>'+obk(l,'total','over','O '+f1(l.total),l.total_price)+obk(l,'total','under','U '+f1(l.total),l.total_price)+'</div>'+
         (l.note?'<p class="mu-note">'+esc(l.note)+'</p>':'')+'</div>'}).join('');
      if(!AUTH)h+='<p class="note"><b>Look around all you want.</b> Log in with your team and PIN to place bets.</p>';
    }
  }
  if(S.bseg==='mine'){
    if(!AUTH||!BK.me)h+='<section class="panel"><p class="muted" style="font-size:13px">Log in to see your bets.</p><button type="button" class="cta" data-login="1" style="margin-top:10px">Log in</button></section>';
    else{var bets=BK.me.bets.filter(function(b){return b.status!=='cancelled'}),open=bets.filter(function(b){return b.status==='open'}),done=bets.filter(function(b){return b.status!=='open'});
      var w=done.filter(function(b){return b.status==='won'}).length,lo=done.filter(function(b){return b.status==='lost'}).length,pr=done.reduce(function(x,b){return x+(b.payout||0)-b.stake},0);
      h+='<section class="panel"><div class="stat3"><div class="stat"><small>Record</small><strong>'+w+'-'+lo+'</strong><span>W-L</span></div><div class="stat"><small>Profit</small><strong'+(pr<0?' style="color:var(--loss)"':'')+'>'+(pr>0?'+':'')+money(pr)+'</strong><span>settled bets</span></div><div class="stat"><small>In play</small><strong>'+money(BK.me.in_play)+'</strong><span>Bucks</span></div></div></section>';
      h+='<section class="panel"><div class="ph"><div><div class="kicker">Open</div><h2>Open bets</h2></div></div>'+(open.length?'<div>'+open.map(function(b){return betCard(b,true)}).join('')+'</div>':'<p class="muted">No open bets. Tap any price on the Lines tab.</p>')+'</section>';
      if(done.length)h+='<section class="panel"><div class="ph"><div><div class="kicker">Season</div><h2>Settled</h2></div></div><div>'+done.map(function(b){return betCard(b,true)}).join('')+'</div></section>';
    }
  }
  if(S.bseg==='leaders'){
    var lb=BK.lb||[];
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Bucks + open bets</div><h2>Leaderboard</h2></div></div><div class="rows">'+
     lb.map(function(x){return '<div class="row" style="grid-template-columns:24px minmax(0,1fr) auto"><span class="rk'+(x.rank===1&&x.joined?' gold':'')+'">'+x.rank+'</span>'+who(x.user_id,x.joined?x.record+(x.in_play?' · '+money(x.in_play)+' in play':''):'Hasn\'t logged in yet',30)+'<span class="val">🍌 '+money(x.bankroll)+'</span></div>'}).join('')+'</div></section>';
    var fd=BK.feed||[];
    h+='<section class="panel"><div class="ph"><div><div class="kicker">Who\'s on what</div><h2>Bet feed</h2></div></div>'+(fd.length?'<div>'+fd.map(function(b){return betCard(b,false)}).join('')+'</div>':'<p class="muted">Bets show up here as people place them.</p>')+'</section>';
  }
  if(S.bseg==='how')h+=bookRules();
  if(S.picks.length)h+='<button type="button" class="slipbar" data-slip="1"><span>Bet slip · '+(S.picks.length===1?'1 pick':S.picks.length+'-pick parlay')+'</span><b>'+odds(slipOdds())+' ›</b></button>';
  return h+foot();
}
function bookRules(){var s=BS(),bt=D.backtest;
  return '<section class="panel"><div class="ph"><div><div class="kicker">House rules</div><h2>Banana Bucks only</h2></div></div><div class="rows">'+
   [['Bankroll',money(s.grant)+' Bucks once per season. No weekly refills: go broke and you\'re done until next year. The bankroll leader wins Banana Book Champion.'],
    ['Bets',s.min_bet+' to '+s.max_bet+' Bucks each. Spread and total pay -110. Moneyline odds come from each team\'s win chance plus a 4.5% house edge.'],
    ['Parlays','2 to '+s.parlay_max_legs+' picks from different games. Every pick must win. A pushed pick drops out. Pays up to '+money(s.parlay_max_payout)+' back.'],
    ['Locks','Lines post Tuesday 6 AM and stay frozen. Each game locks when the first starter in either lineup kicks off. You can cancel a bet until its game locks.'],
    ['Your own game','Bet on yourself to win, to cover, or the over. Never against yourself, and never the under.'],
    ['Settling','Wednesday 3 AM, after Sleeper\'s stat corrections. Exact ties on a spread or total push (stake back).'],
    ['Login','Pick your team and a 4-digit PIN the first time. 5 wrong PINs locks it for 15 minutes. The commish can reset a PIN.']]
   .map(function(x){return '<div class="row" style="grid-template-columns:1fr"><div><b style="font-size:14px">'+x[0]+'</b><p class="muted" style="font-size:12.5px;line-height:1.5;margin-top:2px">'+x[1]+'</p></div></div>'}).join('')+'</div></section>'+
   '<section class="panel"><div class="ph"><div><div class="kicker">How the lines are made</div><h2>Built from your league\'s scores</h2></div></div><p class="muted" style="font-size:12.5px;line-height:1.55">Each team\'s projection = 45% its last 3 weeks, 35% its season average, 20% last season, pulled toward the league average (harder through Week 6). The gap between two projections, compared with how much both teams swing week to week, gives the win chance. Spreads max out at 20.</p>'+
   (bt&&bt.games?'<div class="stat3" style="margin-top:12px"><div class="stat"><small>Tested on</small><strong>'+bt.games+'</strong><span>past games</span></div><div class="stat"><small>Favorites won</small><strong>'+(bt.fav_pct*100).toFixed(1)+'%</strong><span>of games</span></div><div class="stat"><small>Avg miss</small><strong>'+f1(bt.mae)+'</strong><span>points</span></div></div>':'')+'</section>';
}

/* bet slip */
function slipHtml(){
  var n=S.picks.length,s=BS(),st=S.stake;if(!n)return '<p class="muted">Your slip is empty.</p>'+CLOSE;
  var bad=!(st>=s.min_bet&&st<=s.max_bet&&Math.round(st)===st)?'Bets are '+s.min_bet+' to '+s.max_bet+' Banana Bucks.':AUTH&&BK.me&&st>bank()?'Not enough Banana Bucks (you have '+money2(bank())+').':'';
  var h='<div class="ph" style="margin:0"><div><div class="kicker">Bet slip · '+(n===1?'straight bet':n+'-pick parlay')+'</div><h2 style="font-size:20px">'+(n===1?esc(legLabel(S.picks[0])):'Parlay '+odds(slipOdds()))+'</h2></div></div>';
  h+='<div class="legs">'+S.picks.map(function(p,i){var l=bl(p.line);return '<div class="leg"><div><b>'+esc(legLabel(p))+'</b><span>'+esc(team(l.a))+' vs '+esc(team(l.b))+' · '+odds(legOdds(p))+' · '+esc(lockTxt(l))+'</span></div><button type="button" class="x" data-unpick="'+i+'" aria-label="Remove">✕</button></div>'}).join('')+'</div>';
  if(n===1)h+='<p class="muted" style="font-size:12px">Want a parlay? Close this and tap prices in other games.</p>';
  h+='<div class="stake"><input id="stake" type="number" inputmode="numeric" min="'+s.min_bet+'" max="'+s.max_bet+'" step="5" value="'+st+'" aria-label="Stake in Banana Bucks"><span class="kicker">'+(BK.me?'🍌 '+money2(bank())+' left':'')+'</span></div>'+
   '<div class="quick">'+[10,25,50,100,250].map(function(v){return '<button type="button" data-stake="'+v+'">'+v+'</button>'}).join('')+'</div>'+
   '<div class="towin"><span>To win</span><b id="towin">'+(bad?'–':money2(Math.round(slipWin(st)*100)/100))+'</b></div><p class="err" id="slipErr">'+bad+'</p>';
  h+=AUTH?'<button type="button" class="cta" id="place"'+(bad?' disabled':'')+'>Place bet</button>':'<button type="button" class="cta" data-login="1">Log in to place it</button>';
  return h+'<button type="button" class="ghost" id="clearSlip">Clear slip</button>'+CLOSE;
}
function slipCheck(){var s=BS(),st=S.stake;var bad=!(st>=s.min_bet&&st<=s.max_bet)?'Bets are '+s.min_bet+' to '+s.max_bet+' Banana Bucks.':AUTH&&BK.me&&st>bank()?'Not enough Banana Bucks (you have '+money2(bank())+').':'';
  var tw=$('#towin');if(tw)tw.textContent=bad?'–':money2(Math.round(slipWin(st)*100)/100);var er=$('#slipErr');if(er)er.textContent=bad;var pl=$('#place');if(pl)pl.disabled=!!bad}
function togglePick(id,mkt,side){var l=bl(id);if(!l)return;if(isLk(l)){toast('That game is locked');return}
  var i=S.picks.findIndex(function(p){return p.line===id&&p.mkt===mkt&&p.side===side});
  if(i>=0){S.picks.splice(i,1);render();return}
  var j=S.picks.findIndex(function(p){return p.line===id});
  if(j>=0)S.picks[j]={line:id,mkt:mkt,side:side};
  else{if(S.picks.length>=BS().parlay_max_legs){toast('Parlays max out at '+BS().parlay_max_legs+' picks');return}S.picks.push({line:id,mkt:mkt,side:side})}
  render();if(S.picks.length===1)openSheet(slipHtml());else toast(S.picks.length+'-pick parlay · '+odds(slipOdds()))}
function placeBet(btn){btn.disabled=true;btn.textContent='Placing…';
  api('/bets',{body:{legs:S.picks.map(function(p){return {line_id:p.line,market:p.mkt,pick:p.side}}),stake:S.stake}})
   .then(function(r){var n=S.picks.length;S.picks=[];closeSheetQuiet();if(BK.me)BK.me.balance=r.balance;toast(n>1?'Parlay placed 🍌':'Bet placed 🍌');S.bseg='mine';bookLoad();render()})
   .catch(function(e){btn.disabled=false;btn.textContent='Place bet';var er=$('#slipErr');if(er)er.textContent=e.message;bookLoad()})}

/* login: pick team, then PIN pad */
function loginSheet(){
  if(!BK.teams)return '<p class="muted">Loading teams…</p>'+CLOSE;
  if(!S.lt)return '<div class="ph" style="margin:0"><div><div class="kicker">Banana Book login</div><h2>Which team is yours?</h2></div></div><div class="rows">'+
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
   [['post','Post lines now','Use if Tuesday\'s automatic post didn\'t happen.'],['line','Move or void a line','Change a number before the game locks, or take it off the board.'],
    ['settle','Settle a week','Grade bets now (normally automatic Wednesday 3 AM).'],['bucks','Add or remove Bucks','Every change goes in the ledger with your reason.'],
    ['pin','Reset a PIN','For anyone locked out or who picked the wrong team.'],['log','Book log','What the clock job and the commish did.']]
   .map(function(x){return '<button type="button" class="row" data-adm="'+x[0]+'" style="grid-template-columns:minmax(0,1fr) 10px"><div><b style="font-size:14px">'+x[1]+'</b><p class="muted" style="font-size:12px;margin-top:2px">'+x[2]+'</p></div>'+CHEV+'</button>'}).join('')+'</div></section>'}
function teamSelect(id){return '<select id="'+id+'">'+(BK.lb||[]).map(function(x){return '<option value="'+x.user_id+'">'+esc(team(x.user_id))+'</option>'}).join('')+'</select>'}
function fld(id,label,val,type){return '<label class="fld"><span>'+label+'</span><input id="'+id+'" type="'+(type||'text')+'"'+(type==='number'?' inputmode="decimal" step="any"':'')+' value="'+esc(val==null?'':val)+'"></label>'}
function admSheet(k,arg){var nw=(BK.status&&BK.status.next&&BK.status.next.week)||D.league.week,ow=BK.wk&&BK.wk.week;
  var hd=function(t,s){return '<div class="ph" style="margin:0"><div><div class="kicker">Commish · Book controls</div><h2>'+t+'</h2>'+(s?'<p class="muted" style="font-size:12.5px;margin-top:2px">'+s+'</p>':'')+'</div></div>'};
  if(k==='post')return hd('Post lines','Lines freeze for the whole week once posted.')+fld('aWeek','Week',nw,'number')+'<label class="chk"><input type="checkbox" id="aForce"> Replace lines already posted (only if nobody has bet yet)</label><p class="err" id="aErr"></p><button type="button" class="cta" data-admgo="post">Post lines</button>'+CLOSE;
  if(k==='settle')return hd('Settle a week','Uses Sleeper\'s current scores. Normally runs itself Wednesday 3 AM.')+fld('aWeek','Week',ow||'','number')+'<label class="chk"><input type="checkbox" id="aForce"> Settle now even if it\'s early</label><p class="err" id="aErr"></p><button type="button" class="cta" data-admgo="settle">Settle</button>'+CLOSE;
  if(k==='bucks')return hd('Add or remove Bucks','Use a minus sign to take Bucks away.')+'<label class="fld"><span>Team</span>'+teamSelect('aUser')+'</label>'+fld('aAmt','Amount','','number')+fld('aNote','Reason','')+'<p class="err" id="aErr"></p><button type="button" class="cta" data-admgo="bucks">Save</button>'+CLOSE;
  if(k==='pin')return hd('Reset a PIN','They\'ll pick a new PIN next time they log in, and get logged out everywhere.')+'<label class="fld"><span>Team</span>'+teamSelect('aUser')+'</label><p class="err" id="aErr"></p><button type="button" class="cta" data-admgo="pin">Reset PIN</button>'+CLOSE;
  if(k==='line'){var L=(BK.wk&&BK.wk.lines)||[];
    if(!arg)return hd('Move or void a line',L.length?'Week '+ow+'. Tap a game.':'No lines posted right now.')+'<div class="rows">'+L.map(function(l){return '<button type="button" class="row" data-adm="line" data-arg="'+l.id+'" style="grid-template-columns:minmax(0,1fr) auto 10px"><div><b style="font-size:13.5px">'+esc(team(l.a))+' vs '+esc(team(l.b))+'</b><p class="muted" style="font-size:12px">'+spr(-l.spread)+' · O/U '+f1(l.total)+' · '+odds(l.ml_a)+'/'+odds(l.ml_b)+'</p></div><span class="tr r" style="font-size:10px">'+esc(isLk(l)?l.status==='open'?'locked':l.status:'open')+'</span>'+CHEV+'</button>'}).join('')+'</div>'+CLOSE;
    var l=bl(arg);if(!l)return '<p class="muted">Line not found.</p>'+CLOSE;
    return hd(esc(team(l.a))+' vs '+esc(team(l.b)),'Spread is '+esc(team(l.a))+'\'s expected winning margin (3.5 shows them as -3.5). Bets already placed keep their numbers.')+
     (isLk(l)?'<p class="note">This game is locked. You can only void it (every bet on it gets its stake back).</p>':fld('aSpread','Spread ('+esc(team(l.a))+' by)',l.spread,'number')+fld('aTotal','Total',l.total,'number')+fld('aMla','Moneyline '+esc(team(l.a)),l.ml_a,'number')+fld('aMlb','Moneyline '+esc(team(l.b)),l.ml_b,'number'))+
     fld('aNote','Reason (shows on the line)',l.note||'')+'<p class="err" id="aErr"></p>'+(isLk(l)?'':'<button type="button" class="cta" data-admgo="line" data-arg="'+l.id+'">Save line</button>')+
     (l.status==='open'?'<button type="button" class="ghost" data-admgo="void" data-arg="'+l.id+'" style="color:var(--loss);border-color:var(--loss)">Void this game</button>':'')+CLOSE}
  if(k==='log')return hd('Book log','Newest first.')+'<div id="aLog"><p class="muted">Loading…</p></div>'+CLOSE;
  return CLOSE}
function admGo(k,arg,btn){var v=function(id){var e=$('#'+id);return e?(e.type==='checkbox'?e.checked:e.value):null};var err=function(m){var e=$('#aErr');if(e)e.textContent=m};
  var p=k==='post'?api('/admin/post-lines',{body:{week:+v('aWeek'),force:v('aForce')}}):k==='settle'?api('/admin/settle',{body:{week:+v('aWeek'),force:v('aForce')}}):
   k==='bucks'?api('/admin/adjust',{body:{user_id:v('aUser'),amount:+v('aAmt'),note:v('aNote')}}):k==='pin'?api('/admin/reset-pin',{body:{user_id:v('aUser')}}):
   k==='line'?api('/admin/line/'+encodeURIComponent(arg),{body:{spread:v('aSpread'),total:v('aTotal'),ml_a:v('aMla'),ml_b:v('aMlb'),note:v('aNote')}}):
   k==='void'?api('/admin/line/'+encodeURIComponent(arg),{body:{void:true,note:v('aNote')||'Voided by commish'}}):null;
  if(!p)return;btn.disabled=true;
  p.then(function(r){closeSheetQuiet();toast(k==='post'?'Week '+r.week+' lines posted':k==='settle'?'Week '+r.week+' settled ('+r.bets+' bets)':k==='bucks'?'Saved. New balance '+money2(r.balance):k==='pin'?'PIN reset':k==='void'?'Game voided, stakes returned':'Line updated');bookLoad()})
   .catch(function(e){btn.disabled=false;err(e.message)})}
function loadLog(){api('/admin/log?limit=40').then(function(rows){var el=$('#aLog');if(!el)return;el.innerHTML=rows.length?'<div class="rows">'+rows.map(function(r){return '<div class="row" style="grid-template-columns:1fr"><div><b style="font-size:13px">'+esc(r.kind.replace(/_/g,' '))+'</b> <span class="muted" style="font-size:11.5px">'+esc(new Date(r.at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+'</span><p class="muted" style="font-size:11.5px;word-break:break-word">'+esc(JSON.stringify(r.detail))+'</p></div></div>'}).join('')+'</div>':'<p class="muted">Nothing yet.</p>'}).catch(function(e){var el=$('#aLog');if(el)el.innerHTML='<p class="err">'+esc(e.message)+'</p>'})}
