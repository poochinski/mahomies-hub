function draftHtml(d){
  var row=function(p,bust){var mv=p.pick_no-p.rank;
    return '<div class="row dr-row"><span class="dr-pk"><small>Rd '+p.round+'</small>#'+p.pick_no+'</span><div style="min-width:0"><b style="font-size:14px">'+nb(p.name)+'</b> <span class="muted" style="font-size:11px">'+esc(p.pos)+'</span>'+
     '<div class="dr-team">'+av(p.user_id,16)+esc(team(p.user_id))+'</div>'+
     '<div class="dr-mv">Drafted <b>#'+p.pick_no+'</b> → finished <b>#'+p.rank+'</b> <span class="'+(mv>=0?'up':'dn')+'">'+(mv>=0?'▲'+mv:'▼'+Math.abs(mv))+(Math.abs(mv)===1?' spot':' spots')+'</span></div></div>'+
     '<span class="aw-vb"><span class="val num" style="font-size:18px">'+f1(p.points)+'</span><small>season pts</small></span></div>'};
  if(!d.steals.length)return '<div class="ph"><div><div class="kicker">'+d.season+' draft</div><h2>Draft re-grade</h2></div>'+info('draft')+'</div><p class="muted">No draft found for '+d.season+'.</p>';
  return '<div class="ph"><div><div class="kicker">'+d.season+' draft</div><h2>Biggest steals</h2></div>'+info('draft')+'</div>'+
   '<p class="muted" style="font-size:12px;margin:-4px 0 6px">Late picks who scored like early ones. "Finished" = where his points rank among every drafted player (no kickers or defenses).</p><div class="rows">'+d.steals.map(function(p){return row(p)}).join('')+'</div>'+
   '<div class="ph" style="margin-top:16px"><div><div class="kicker">'+d.season+' draft</div><h2>Biggest busts</h2></div></div><p class="muted" style="font-size:12px;margin:-4px 0 6px">Early picks whose points ranked furthest below where they went.</p><div class="rows">'+d.busts.map(function(p){return row(p,true)}).join('')+'</div>'}
