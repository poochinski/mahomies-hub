/* ---------- GRIDIRON GOLD: hidden slot machine (tap the pink dot on the Sportsbook page) ---------- */
var SL={open:false,busy:false,bet:10,state:null,pt:null,grid:null,last:null,bonus:null,msg:''};
var SYM={RING:'💍',TROPHY:'🏆',STADIUM:'🏟️',PLAYBOOK:'📋',BALL:'🏈',CAP:'🧢',TICKET:'🎟️',DRAFT:'📜'};
var SYM_ORDER=['RING','TROPHY','STADIUM','PLAYBOOK','BALL','CAP','TICKET','DRAFT','WILD'];
function symHtml(s){return s==='WILD'?'<img src="/brand-96.png" alt="MH wild" class="sl-wild">':'<span>'+(SYM[s]||'?')+'</span>'}
function slotRoot(){var el=document.getElementById('slot');if(!el){el=document.createElement('div');el.id='slot';el.className='slot';document.body.appendChild(el)}return el}
function openSlot(){
  if(!LIVE){toast('Nice find. It only works in the live app.');return}
  if(!AUTH){toast('Log in to the Sportsbook to play');openLogin();return}
  SL.open=true;SL.msg='';var el=slotRoot();el.classList.add('open');document.body.style.overflow='hidden';
  if(!SL.grid)SL.grid=[0,1,2,3,4].map(function(r){return ['CAP','BALL','PLAYBOOK'].map(function(x,i){return SYM_ORDER[(r*2+i)%6]})});
  slotRender();
  Promise.all([api('/slots/state'),SL.pt?Promise.resolve(SL.pt):api('/slots/paytable')]).then(function(r){SL.state=r[0];SL.pt=r[1];if(SL.state.free_bet)SL.bet=SL.state.free_bet;SL.bonus=SL.state.bonus;slotRender();if(SL.bonus)bonusRender()}).catch(function(e){SL.msg=e.message;slotRender()})}
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
  if(r.bonus){SL.bonus=r.bonus;setTimeout(function(){splash('📜','DRAFT DAY','Pick 3 prospects from the board',function(){bonusRender()})},r.free_awarded?1800:400)}
}
function splash(icon,title,sub,then){var el=slotRoot(),d=document.createElement('div');d.className='sl-splash';d.innerHTML='<div><div class="sp-i">'+icon+'</div><div class="sp-t">'+title+'</div><div class="sp-s">'+esc(sub)+'</div></div>';el.appendChild(d);
  setTimeout(function(){d.classList.add('out');setTimeout(function(){d.remove();if(then)then()},350)},1500)}
/* Draft Day bonus */
function bonusRender(){var b=SL.bonus;if(!b)return;var el=slotRoot(),ov=document.getElementById('slBonus');if(!ov){ov=document.createElement('div');ov.id='slBonus';ov.className='sl-bonus';el.appendChild(ov)}
  var picked={};(b.picks||[]).forEach(function(p){picked[p.index]=p.value});var done=!!b.done;
  ov.innerHTML='<div class="bn-h"><div class="sl-title">DRAFT <b>DAY</b></div><div class="sl-sub">'+(done?'Draft complete':'Pick '+b.need+' more prospect'+(b.need===1?'':'s'))+' · bet '+b.bet+'</div></div>'+
   '<div class="bn-board">'+Array.apply(null,{length:b.size||12}).map(function(_,i){var v=picked[i],rev=done&&b.board?b.board[i]:null;
     return '<button type="button" class="bn-card'+(v!=null?' got':rev!=null?' miss':'')+'" data-slpick="'+i+'"'+(v!=null||done||SL.busy?' disabled':'')+'>'+(v!=null?'<b>'+m2(v*b.bet)+'</b><small>×'+v+'</small>':rev!=null?'<b>'+m2(rev*b.bet)+'</b>':'<span>🏈</span><small>Pick '+(i+1)+'</small>')+'</button>'}).join('')+'</div>'+
   '<div class="bn-foot">'+(done?'<div class="bn-comb"><small>Picks</small><b>'+m2(b.sum*b.bet)+'</b><small>Combine</small><b class="hot" id="bnMult">×'+b.combine+'</b><small>Total</small><b class="hot">'+m2(b.total)+'</b></div><button type="button" class="sl-spin" data-slcollect="1">Collect '+m2(b.total)+'</button>':
     '<p class="sl-sub">Every prospect is worth 1× to 25× your bet. After 3 picks, the Combine adds a ×1, ×2 or ×3 multiplier.</p>')+'</div>'}
function bonusPick(i){if(SL.busy||!SL.bonus)return;SL.busy=true;
  api('/slots/pick',{body:{index:i}}).then(function(r){SL.busy=false;var b=SL.bonus;b.picks=r.picks;b.need=r.need;
    if(r.done){b.done=true;b.board=r.board;b.sum=r.sum;b.combine=r.combine;b.total=r.total;SL.state.balance=r.balance;
      bonusRender();var m=document.getElementById('bnMult');if(m){var k=0,seq=['×1','×2','×3'],iv=setInterval(function(){m.textContent=seq[k++%3]},90);setTimeout(function(){clearInterval(iv);m.textContent='×'+r.combine},1400)}}
    else bonusRender()}).catch(function(e){SL.busy=false;toast(e.message)})}
function bonusClose(){var ov=document.getElementById('slBonus');if(ov)ov.remove();var b=SL.bonus;SL.bonus=null;SL.last={win:b&&b.total||0};SL.msg=b&&b.total?'Draft Day paid '+m2(b.total)+' Bucks':'';slotRender()}
function paytableSheet(){var pt=SL.pt;if(!pt)return;var lb=SL.bet/9,el=slotRoot(),ov=document.createElement('div');ov.className='sl-ptab';
  ov.innerHTML='<div class="bn-h"><div class="sl-title">PAY<b>TABLE</b></div><div class="sl-sub">At '+SL.bet+' Bucks a spin (9 lines). Payback about 95% over time.</div></div>'+
   '<div class="pt-rows">'+['WILD','RING','TROPHY','STADIUM','PLAYBOOK','BALL','CAP'].map(function(s){var p=pt.pays[s];return '<div class="pt-r"><div class="pt-s">'+symHtml(s)+'</div><div class="pt-v"><span>3× '+m2(p[0]*lb)+'</span><span>4× '+m2(p[1]*lb)+'</span><span>5× '+m2(p[2]*lb)+'</span></div></div>'}).join('')+'</div>'+
   '<div class="pt-txt"><p><b>MH logo is wild</b> (reels 2–4): it stands in for any picture except 🎟️ and 📜.</p>'+
   '<p><b>🎟️ Free Spins:</b> 3, 4 or 5 tickets anywhere pay '+pt.ticket_pays.map(function(x){return m2(x*SL.bet)}).join(' / ')+' and start '+pt.free_spins+' free spins. Every free-spin win pays ×'+pt.free_mult+'. More tickets during free spins add 10 more.</p>'+
   '<p><b>📜 Draft Day bonus:</b> a draft card on reels 1, 2 and 3 opens the draft board. Pick 3 of 12 prospects (each worth 1× to 25× your bet), then the Combine multiplies your total by ×1, ×2 or ×3.</p>'+
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
  if(d.slpick!==undefined){bonusPick(+d.slpick);return}
  if(d.slcollect){bonusClose();return}
  if(d.slpt){paytableSheet();return}
  if(d.slptx){var p=document.querySelector('.sl-ptab');if(p)p.remove();return}
});
