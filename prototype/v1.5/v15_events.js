/* ---------- render + events ---------- */
function render(){
  document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.dataset.tab===S.tab);t.setAttribute('aria-current',t.dataset.tab===S.tab?'page':'false')});
  view.innerHTML=S.tab==='home'?home():S.tab==='league'?league():S.tab==='records'?records():S.tab==='book'?book():me();
  $('#bucks').textContent=money(bank());
}
function go(tab,sub){S.tab=tab;if(tab==='league'&&sub)S.lseg=sub;closeSheetQuiet();render();window.scrollTo(0,0);try{history.replaceState(null,'','#'+tab)}catch(e){}}
function closeSheetQuiet(){$('#sheet').classList.remove('open');$('#scrim').classList.remove('open')}
var CLOSE='<button type="button" class="ghost" id="closeP">Close</button>';
function centerChip(sel){var t=document.querySelector(sel);if(t&&t.scrollIntoView)t.scrollIntoView({inline:'center',block:'nearest'})}
document.addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;var d=t.dataset;
  if(d.tab){go(d.tab);return}
  if(d.go){var p=d.go.split(':');go(p[0],p[1]);return}
  if(d.lseg){S.lseg=d.lseg;render();centerChip('[data-lseg="'+S.lseg+'"]');return}
  if(d.bseg){S.bseg=d.bseg;render();return}
  if(d.hw){S.hw=+d.hw;render();return}
  if(d.rf){S.rf=d.rf;render();return}
  if(d.aws){S.aws=d.aws;render();return}
  if(d.lab){S.lab=d.lab;render();return}
  if(d.labs){S.labs=d.labs;render();return}
  if(d.rec){S.rec=d.rec;render();centerChip('[data-rec="'+S.rec+'"]');return}
  if(d.pair){var pp=d.pair.split('|');S.h2a=pp[0];S.h2b=pp[1];render();var el=document.getElementById('rivalTop');if(el)el.scrollIntoView({block:'start'});return}
  if(d.prev){openSheet(previewSheet(d.prev)+CLOSE);return}
  if(d.season){S.ss=d.season;S.sw=null;openSheet(seasonSheet(d.season)+CLOSE);return}
  if(d.sweek){var sp=d.sweek.split('|');S.sw=+sp[1];var keep=$('#sheet').scrollTop;openSheet(seasonSheet(sp[0])+CLOSE);$('#sheet').scrollTop=keep;return}
  if(d.shareRec){shareRecord();return}
  if(d.shareGame){shareGame(+d.shareGame);return}
  if(d.shareSeason){shareSeason(d.shareSeason);return}
  if(d.pick){var a=d.pick.split('|');S.slip={line:a[0],mkt:a[1],side:a[2]};render();openSheet(slipHtml());return}
  if(d.stake){S.stake=+d.stake;openSheet(slipHtml());return}
  if(t.id==='place'){S.bets.push({line:S.slip.line,mkt:S.slip.mkt,side:S.slip.side,stake:S.stake,at:Date.now()});store('bets',S.bets);var lbl=pickLabel(S.slip);S.slip=null;closeSheet();render();toast('Bet placed: '+lbl);return}
  if(t.id==='cancelSlip'){closeSheet();return}
  if(d.cancel!==undefined&&t.classList.contains('x')){S.bets.splice(+d.cancel,1);store('bets',S.bets);render();toast('Bet cancelled, Bucks returned');return}
  if(t.id==='bucksBtn'){go('book');return}
  if(d.game!==undefined){var gx=+d.game;if(gx>=0){openSheet(gameSheet(gx)+'<button type="button" class="share-btn wide" data-share-game="'+gx+'">Share this game</button>'+CLOSE);loadLineups(gx);return}}
  if(d.mgr){openSheet(profile(d.mgr,false)+CLOSE);return}
  if(t.id==='closeP'){closeSheet();return}
});
document.addEventListener('change',function(e){
  if(e.target.id==='meSel'){S.me=e.target.value;store('me',S.me);S.h2a=S.me;S.h2b=null;render();toast('Playing as '+team(S.me))}
  if(e.target.id==='h2a'){S.h2a=e.target.value;render()}
  if(e.target.id==='h2b'){S.h2b=e.target.value;render()}
});
document.addEventListener('input',function(e){
  if(e.target.id==='stake'){S.stake=Math.round(+e.target.value||0);var o=pickOdds(S.slip);var bad=!(S.stake>=10&&S.stake<=250)?'Bets are 10 to 250 Banana Bucks.':S.stake>bank()?'Not enough Banana Bucks.':'';
    $('#towin').textContent=bad?'–':money(profit(S.stake,o));$('#slipErr').textContent=bad;$('#place').disabled=!!bad}
});
$('#scrim').addEventListener('click',closeSheet);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeSheet()});
var h=(location.hash||'').replace('#','');if(['home','league','records','book','me'].indexOf(h)>=0)S.tab=h;
render();
})();
</script>
