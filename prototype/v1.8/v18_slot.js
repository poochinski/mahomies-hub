/* ---------- GRIDIRON GOLD: hidden slot machine (tap the pink dot on the Sportsbook page) ---------- */
var SL={open:false,busy:false,bet:10,state:null,pt:null,grid:null,last:null,bonus:null,msg:''};
var SYM={RING:'💍',TROPHY:'🏆',STADIUM:'🏟️',PLAYBOOK:'📋',BALL:'🏈',CAP:'🧢',TICKET:'🎟️',DRAFT:'⏱️'};
var SYM_ORDER=['RING','TROPHY','STADIUM','PLAYBOOK','BALL','CAP','TICKET','DRAFT','WILD'];
function symHtml(s){return s==='WILD'?'<img src="/brand-96.png" alt="MH wild" class="sl-wild">':'<span>'+(SYM[s]||'?')+'</span>'}
function slotRoot(){var el=document.getElementById('slot');if(!el){el=document.createElement('div');el.id='slot';el.className='slot';document.body.appendChild(el)}return el}
function openSlot(){
  if(!LIVE){toast('Nice find. It only works in the live app.');return}
  if(!AUTH){toast('Log in to the Sportsbook to play');openLogin();return}
  SL.open=true;SL.msg='';var el=slotRoot();el.classList.add('open');document.body.style.overflow='hidden';
  if(!SL.grid)SL.grid=[0,1,2,3,4].map(function(r){return ['CAP','BALL','PLAYBOOK'].map(function(x,i){return SYM_ORDER[(r*2+i)%6]})});
  slotRender();
  Promise.all([api('/slots/state'),SL.pt?Promise.resolve(SL.pt):api('/slots/paytable')]).then(function(r){SL.state=r[0];SL.pt=r[1];if(SL.state.free_bet)SL.bet=SL.state.free_bet;SL.bonus=SL.state.bonus;slotRender();if(SL.bonus)drillStart(SL.bonus)}).catch(function(e){SL.msg=e.message;slotRender()})}
function closeSlot(){if(SL.busy)return;SL.open=false;var el=slotRoot();el.classList.remove('open');document.body.style.overflow='';bookLoad()}
function reelsHtml(spinning){return '<div class="sl-reels">'+SL.grid.map(function(col,r){return '<div class="sl-reel" data-reel="'+r+'"><div class="sl-strip">'+col.map(function(s,row){return '<div class="sl-cell" data-cell="'+r+'-'+row+'">'+symHtml(s)+'</div>'}).join('')+'</div></div>'}).join('')+'</div>'}
function slotRender(){
  var el=slotRoot(),st=SL.state,free=st&&st.free_left>0,last=SL.last;
  var bal=st?st.balance:(BK.me?BK.me.balance:0);
  el.innerHTML='<div class="sl-wrap"><div class="sl-top"><div><div class="sl-title">GRIDIRON <b>GOLD</b></div><div class="sl-sub">A Mahomie\'s Hub secret · play money</div></div><button type="button" class="sl-x" data-slx="1" aria-label="Close">✕</button></div>'+
   '<div class="sl-meter"><div><small>Bucks</small><b class="num" id="slBal">'+m2(bal)+'</b></div><div><small>'+(free?'Free spins':'Last win')+'</small><b class="num'+(last&&last.win>0?' hot':'')+'" id="slWin">'+(free?st.free_left+' left · ×'+((SL.pt&&SL.pt.free_mult)||3):last?m2(last.win):'—')+'</b></div></div>'+
   '<div class="sl-cab'+(free?' free':'')+'">'+reelsHtml()+'<div class="sl-msg" id="slMsg">'+esc(SL.msg||'')+'</div></div>'+
   '<div class="sl-bets">'+((SL.pt&&SL.pt.bets)||[10,25,50]).map(function(b){return '<button type="button" class="sl-bet'+(SL.bet===b?' on':'')+'" data-slbet="'+b+'"'+(free?' disabled':'')+'>'+b+'</button>'}).join('')+'</div>'+
   '<button type="button" class="sl-spin" data-slspin="1"'+(SL.busy?' disabled':'')+'>'+(free?'FREE SPIN':'SPIN')+'<small>'+(free?'bet '+SL.bet+' · wins ×'+((SL.pt&&SL.pt.free_mult)||3):SL.bet+' Bucks · 9 lines')+'</small></button>'+
   '<button type="button" class="sl-pt" data-slpt="1">Paytable &amp; rules</button></div>';
}
function slotSpin(){
  if(SL.busy||!SL.state)return;var free=SL.state.free_left>0;
  if(!free&&SL.state.balance<SL.bet){SL.msg='Not enough Bucks for that bet.';slotRender();return}
  SL.busy=true;SL.msg='';SL.last=null;
  var btn=document.querySelector('[data-slspin]');if(btn)btn.disabled=true;
  if(!free){SL.state.balance=Math.round((SL.state.balance-SL.bet)*100)/100;var b=document.getElementById('slBal');if(b)b.textContent=m2(SL.state.balance)}
  // start the reels spinning right away; the server answer lands them
  var reels=[].slice.call(document.querySelectorAll('.sl-reel'));
  reels.forEach(function(r){r.classList.add('spinning');var s=r.querySelector('.sl-strip');s.innerHTML=Array.apply(null,{length:18}).map(function(){return '<div class="sl-cell">'+symHtml(SYM_ORDER[Math.floor(Math.random()*9)])+'</div>'}).join('')});
  var t0=Date.now();
  api('/slots/spin',{body:{bet:SL.bet}}).then(function(r){
    var wait=Math.max(0,650-(Date.now()-t0));
    setTimeout(function(){landReels(r)},wait);
  }).catch(function(e){SL.busy=false;SL.msg=e.message;api('/slots/state').then(function(s){SL.state=s;slotRender()}).catch(function(){slotRender()})});
}
function landReels(r){
  SL.grid=r.grid;var reels=[].slice.call(document.querySelectorAll('.sl-reel'));
  reels.forEach(function(el,i){setTimeout(function(){el.classList.remove('spinning');el.querySelector('.sl-strip').innerHTML=r.grid[i].map(function(s,row){return '<div class="sl-cell land" data-cell="'+i+'-'+row+'">'+symHtml(s)+'</div>'}).join('')},i*260)});
  setTimeout(function(){afterSpin(r)},reels.length*260+250)}
function afterSpin(r){
  SL.last=r;SL.state.balance=r.balance;SL.state.free_left=r.free_left;SL.state.free_bet=r.free_left>0?r.bet:null;SL.state.free_won=r.free_won;
  var cells={};r.wins.forEach(function(w){w.cells.forEach(function(c){cells[c[0]+'-'+c[1]]=1})});
  if(r.tickets>=3)SL.grid.forEach(function(col,ri){col.forEach(function(s,row){if(s==='TICKET')cells[ri+'-'+row]=1})});
  var msg='';
  if(r.win>0){var big=r.win>=r.bet*20;msg=(big?'BIG WIN! ':'Win ')+m2(r.win)+' Bucks'+(r.wins.length?' · '+r.wins.length+' line'+(r.wins.length>1?'s':''):'')}
  else msg=r.free?'No win this spin':'No win · try again';
  if(r.free_awarded)msg=(r.free?'RETRIGGER! +':'')+r.free_awarded+' FREE SPINS · wins ×'+((SL.pt&&SL.pt.free_mult)||3);
  if(r.free_done)msg='Free spins done · won '+m2(r.free_won)+' Bucks';
  SL.msg=msg;SL.busy=false;slotRender();
  Object.keys(cells).forEach(function(k){var c=document.querySelector('[data-cell="'+k+'"]');if(c)c.classList.add('hit')});
  if(r.free_awarded&&!r.free)splash('🎟️','10 FREE SPINS','Every win pays ×'+((SL.pt&&SL.pt.free_mult)||3));
  if(r.bonus){SL.bonus=r.bonus;SL.busy=true;setTimeout(function(){splash('⏱️','TWO-MINUTE DRILL','Score a TOUCHDOWN to collect the board',function(){SL.busy=false;drillStart(r.bonus)})},r.free_awarded?1800:400)}
}
function splash(icon,title,sub,then){var el=slotRoot(),d=document.createElement('div');d.className='sl-splash';d.innerHTML='<div><div class="sp-i">'+icon+'</div><div class="sp-t">'+title+'</div><div class="sp-s">'+esc(sub)+'</div></div>';el.appendChild(d);
  setTimeout(function(){d.classList.add('out');setTimeout(function(){d.remove();if(then)then()},350)},1500)}
/* Two-Minute Drill bonus (hold-and-spin style): 3×3 board + TOUCHDOWN side reel */
var DR=null;
function drCell(c,bet){if(!c||c.t==='blank')return '<div class="dr-c blank"><span>🏈</span></div>';
  if(c.t==='val')return '<div class="dr-c val"><b>'+m2(c.v*bet)+'</b></div>';
  if(c.t==='jp')return '<div class="dr-c jp jp-'+c.jp.toLowerCase()+'"><b>'+c.jp+'</b><small>'+m2(c.v*bet)+'</small></div>';
  return '<div class="dr-c extra"><b>EXTRA</b><small>DRIVE</small></div>'}
function drFake(){var r=Math.random();return r<.5?{t:'blank'}:r<.85?{t:'val',v:[0.5,1,2,3,5][Math.floor(Math.random()*5)]}:r<.95?{t:'jp',jp:['MINI','MINOR','MAJOR'][Math.floor(Math.random()*3)],v:5}:{t:'extra'}}
function drillStart(b){var el=slotRoot(),ov=document.getElementById('slBonus');if(!ov){ov=document.createElement('div');ov.id='slBonus';ov.className='sl-bonus';el.appendChild(ov)}
  DR={b:b,i:-1,collected:0,cells:Array.apply(null,{length:9}).map(function(){return {t:'blank'}}),td:null,drives:b.frames.length?b.frames[0].drives:8,done:false,timer:null};
  drillRender();DR.timer=setTimeout(drillNext,900)}
function drillRender(msg){var b=DR.b,ov=document.getElementById('slBonus');if(!ov)return;var f=DR.i>=0?b.frames[DR.i]:null;
  ov.innerHTML='<div class="bn-h"><div class="sl-title">TWO-MINUTE <b>DRILL</b></div><div class="sl-sub">Land a TOUCHDOWN to collect everything on the board · bet '+b.bet+'</div></div>'+
   '<div class="dr-jps">'+b.jackpots.map(function(j){return '<div class="jp-'+j.name.toLowerCase()+'"><small>'+j.name+'</small><b>'+m2(j.x*b.bet)+'</b></div>'}).join('')+'</div>'+
   '<div class="dr-meter"><div><small>Drive</small><b>'+(f?f.drive:0)+' of '+(f?f.drives:DR.drives)+'</b></div><div><small>Collected</small><b class="hot" id="drCol">'+m2(DR.collected)+'</b></div></div>'+
   '<div class="dr-field"><div class="dr-grid">'+DR.cells.map(function(c,i){return '<div class="dr-slot" data-dc="'+i+'">'+drCell(c,b.bet)+'</div>'}).join('')+'</div>'+
   '<div class="dr-side"><div class="dr-td'+(DR.td===true?' yes':DR.td===false?' no':'')+'" id="drTd">'+(DR.td===true?'<span>🏈</span><b>TOUCH<br>DOWN!</b>':DR.td===false?'<b>INCOM&shy;PLETE</b>':'<b>?</b>')+'</div></div></div>'+
   '<div class="sl-msg" id="drMsg">'+(msg||'')+'</div>'+
   (DR.done?'<div class="bn-comb"><small>Drives</small><b>'+b.frames.length+'</b><small>Touchdowns</small><b>'+b.frames.filter(function(x){return x.td}).length+'</b><small>Total</small><b class="hot">'+m2(b.total)+'</b></div><button type="button" class="sl-spin" data-slcollect="1">Collect '+m2(b.total)+'</button>':
     '<button type="button" class="sl-pt" data-drskip="1" style="display:block;margin:6px auto 0">Skip to the end</button>')}
function drillNext(){if(!DR)return;DR.i++;var b=DR.b;if(DR.i>=b.frames.length){DR.done=true;drillRender('Drill over · '+m2(b.total)+' Bucks');return}
  var f=b.frames[DR.i];DR.td=null;
  // spin the 9 squares, then land them one by one
  DR.cells=DR.cells.map(drFake);drillRender();[].forEach.call(document.querySelectorAll('.dr-slot'),function(s){s.classList.add('spin')});
  var k=0,land=function(){if(!DR)return;if(k<9){DR.cells[k]=f.cells[k];var s=document.querySelector('[data-dc="'+k+'"]');if(s){s.classList.remove('spin');s.innerHTML=drCell(f.cells[k],b.bet);s.classList.add('land')}k++;DR.timer=setTimeout(land,70);return}
    var extra=f.cells.filter(function(c){return c.t==='extra'}).length;
    var td=document.getElementById('drTd');if(td){td.className='dr-td spin';td.innerHTML='<b>…</b>'}
    DR.timer=setTimeout(function(){DR.td=f.td;if(f.td){DR.collected=Math.round((DR.collected+f.got*b.bet)*100)/100}
      drillRender(f.td?'TOUCHDOWN! +'+m2(f.got*b.bet):extra?'+'+extra+' EXTRA DRIVE'+(extra>1?'S':''):'Incomplete');
      if(f.td)[].forEach.call(document.querySelectorAll('.dr-slot'),function(s){if(!s.querySelector('.blank'))s.classList.add('hit')});
      DR.timer=setTimeout(drillNext,f.td?1700:1000)},550)};
  DR.timer=setTimeout(land,350)}
function drillSkip(){if(!DR)return;clearTimeout(DR.timer);var b=DR.b,f=b.frames[b.frames.length-1];DR.i=b.frames.length-1;DR.cells=f?f.cells:DR.cells;DR.td=f?f.td:null;DR.collected=b.total;DR.done=true;drillRender('Drill over · '+m2(b.total)+' Bucks')}
function bonusClose(){if(DR)clearTimeout(DR.timer);var ov=document.getElementById('slBonus');if(ov)ov.remove();var b=SL.bonus;SL.bonus=null;DR=null;
  api('/slots/bonus-seen',{method:'POST'}).catch(function(){});
  api('/slots/state').then(function(st){SL.state=st;SL.last={win:b&&b.total||0};SL.msg=b?'Two-Minute Drill paid '+m2(b.total)+' Bucks':'';slotRender()}).catch(function(){slotRender()})}
function paytableSheet(){var pt=SL.pt;if(!pt)return;var lb=SL.bet/9,el=slotRoot(),ov=document.createElement('div');ov.className='sl-ptab';
  ov.innerHTML='<div class="bn-h"><div class="sl-title">PAY<b>TABLE</b></div><div class="sl-sub">At '+SL.bet+' Bucks a spin (9 lines). Payback about 95% over time.</div></div>'+
   '<div class="pt-rows">'+['WILD','RING','TROPHY','STADIUM','PLAYBOOK','BALL','CAP'].map(function(s){var p=pt.pays[s];return '<div class="pt-r"><div class="pt-s">'+symHtml(s)+'</div><div class="pt-v"><span>3× '+m2(p[0]*lb)+'</span><span>4× '+m2(p[1]*lb)+'</span><span>5× '+m2(p[2]*lb)+'</span></div></div>'}).join('')+'</div>'+
   '<div class="pt-txt"><p><b>MH logo is wild</b> (reels 2–4): it stands in for any picture except 🎟️ and 📜.</p>'+
   '<p><b>🎟️ Free Spins:</b> 3, 4 or 5 tickets anywhere pay '+pt.ticket_pays.map(function(x){return m2(x*SL.bet)}).join(' / ')+' and start '+pt.free_spins+' free spins. Every free-spin win pays ×'+pt.free_mult+'. More tickets during free spins add 10 more.</p>'+
   '<p><b>⏱️ Two-Minute Drill:</b> a stopwatch on reels 1, 2 and 3 starts the drill: '+pt.drill.drives+' drives on a 3×3 board. Every drive, all 9 squares spin and land on Bucks, jackpot coins ('+pt.drill.jackpots.map(function(j){return j.name+' '+m2(j.x*SL.bet)}).join(' · ')+'), EXTRA DRIVE (+1, up to '+pt.drill.max+') or nothing. When the side reel lands <b>TOUCHDOWN!</b> you collect everything on the board.</p>'+
   '<p>Wins pay left to right on the 9 lines; only the best win on each line counts. Spins come out of your Mahomie Bucks: going broke still means you\'re done for the season.</p></div>'+
   '<button type="button" class="sl-pt" data-slptx="1">Back to the game</button>';
  el.appendChild(ov)}
document.addEventListener('click',function(e){
  var t=e.target;
  if(t.closest&&t.closest('[data-egg]')){if(S.tab==='book')openSlot();return}
  if(!SL.open)return;var b=t.closest&&t.closest('button');if(!b)return;var d=b.dataset;
  if(d.slx){closeSlot();return}
  if(d.slbet){SL.bet=+d.slbet;slotRender();return}
  if(d.slspin){slotSpin();return}
  if(d.drskip){drillSkip();return}
  if(d.slcollect){bonusClose();return}
  if(d.slpt){paytableSheet();return}
  if(d.slptx){var p=document.querySelector('.sl-ptab');if(p)p.remove();return}
});
