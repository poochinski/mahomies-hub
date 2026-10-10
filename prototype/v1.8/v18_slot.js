/* ---------- GRIDIRON GOLD v2: hidden slot machine (tap the pink dot at the bottom of the Sportsbook page) ----------
   Casino-style video slot. Every outcome comes from the server (independent random stop per reel on fixed strips);
   the reels here scroll through those same strips and land where the server stopped them.
   Slam stop, anticipation, paylines, win rollups, big-win celebrations, Two-Minute Drill bonus,
   and synthesized casino sounds with a volume control (saved per phone). */
var SL={open:false,busy:false,spinning:false,bet:10,state:null,pt:null,res:null,slam:false,auto:0,cred:0,winShown:0,cycleT:null,stopT:[],raf:null,lt:0,landed:0,items:null,roll:null};
var GG_N={RING:'Title Ring',TROPHY:'Trophy',STADIUM:'Helmet',PLAYBOOK:'Football',BALL:'Ace',CAP:'King',WILD:'MH Wild',TICKET:'Free Spins',DRAFT:'Two-Minute Drill'};
var GG_COL=['#ff4545','#3bd1ff','#ffd23b','#5dff8f','#ff5fd6','#ff9a3b','#b18cff','#3bffd8','#ffffff'];
var GG_SEQ=['RING','CAP','TROPHY','BALL','STADIUM','PLAYBOOK','WILD','CAP','BALL','TICKET','PLAYBOOK','DRAFT'];
var GG_V=26; // reel speed, symbols per second
var GG_JP=[['GRAND',250,'#ff5fd6'],['MAJOR',50,'#ff4545'],['MINOR',15,'#3bd1ff'],['MINI',5,'#5dff8f']];
function gb(n){n=Math.round(Number(n)*100)/100;return n%1?m2(n):n.toLocaleString('en-US')}
function fm(){return (SL.pt&&SL.pt.free_mult)||3}

/* ---------- sound (WebAudio, nothing to download) ---------- */
var GGA={ctx:null,out:null,rev:null,noise:null,vol:.7,on:true,hum:null};
try{var _gv=localStorage.getItem('gg_vol');if(_gv!=null&&!isNaN(+_gv))GGA.vol=Math.max(0,Math.min(1,+_gv));GGA.on=localStorage.getItem('gg_mute')!=='1'}catch(e){}
function aGain(){return GGA.on?GGA.vol*GGA.vol*1.6:0}
function aInit(){var c=GGA.ctx;if(c){if(c.state!=='running')try{c.resume()}catch(e){}return c}
  var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
  try{c=new AC()}catch(e){return null}GGA.ctx=c;
  var comp=c.createDynamicsCompressor();comp.threshold.value=-12;comp.knee.value=10;comp.ratio.value=5;comp.attack.value=.003;comp.release.value=.2;comp.connect(c.destination);
  GGA.out=c.createGain();GGA.out.gain.value=aGain();GGA.out.connect(comp);
  var n=Math.floor(c.sampleRate*1.8),ir=c.createBuffer(2,n,c.sampleRate);
  for(var ch=0;ch<2;ch++){var d=ir.getChannelData(ch);for(var i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.6)}
  var cv=c.createConvolver();cv.buffer=ir;GGA.rev=c.createGain();GGA.rev.gain.value=.28;GGA.rev.connect(cv);cv.connect(GGA.out);
  var nb=c.createBuffer(1,c.sampleRate*2,c.sampleRate),nd=nb.getChannelData(0);for(i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;GGA.noise=nb;
  try{var s=c.createBufferSource();s.buffer=c.createBuffer(1,1,22050);s.connect(c.destination);s.start(0)}catch(e){}
  if(c.state!=='running')try{c.resume()}catch(e){}
  return c}
function aSet(){try{localStorage.setItem('gg_vol',String(GGA.vol));localStorage.setItem('gg_mute',GGA.on?'0':'1')}catch(e){}
  if(GGA.out)GGA.out.gain.setTargetAtTime(aGain(),GGA.ctx.currentTime,.03);if(!GGA.on)aHum(false)}
function nf(n){return 440*Math.pow(2,(n-69)/12)}
function aO(type,f,t,dur,g,o){o=o||{};var c=GGA.ctx,os=c.createOscillator(),gn=c.createGain();os.type=type;os.frequency.setValueAtTime(f,t);
  if(o.to)os.frequency.exponentialRampToValueAtTime(o.to,t+(o.gl||dur));if(o.det)os.detune.setValueAtTime(o.det,t);
  if(o.vib){var l=c.createOscillator(),lg=c.createGain();l.frequency.value=o.vib[0];lg.gain.value=o.vib[1];l.connect(lg);lg.connect(os.frequency);l.start(t);l.stop(t+dur+.05)}
  var a=o.a||.004;gn.gain.setValueAtTime(.0001,t);gn.gain.exponentialRampToValueAtTime(g,t+a);if(o.hold)gn.gain.setValueAtTime(g,t+a+o.hold);gn.gain.exponentialRampToValueAtTime(.0001,t+dur);
  var src=os;if(o.lp){var fl=c.createBiquadFilter();fl.type='lowpass';fl.frequency.setValueAtTime(o.lp,t);if(o.lpTo)fl.frequency.exponentialRampToValueAtTime(o.lpTo,t+dur);fl.Q.value=o.q||.7;os.connect(fl);src=fl}
  src.connect(gn);gn.connect(GGA.out);if(o.rev)gn.connect(GGA.rev);os.start(t);os.stop(t+dur+.05)}
function aN(t,dur,g,o){o=o||{};var c=GGA.ctx,s=c.createBufferSource(),fl=c.createBiquadFilter(),gn=c.createGain();s.buffer=GGA.noise;s.loop=true;
  fl.type=o.type||'bandpass';fl.frequency.setValueAtTime(o.f||1000,t);if(o.to)fl.frequency.exponentialRampToValueAtTime(o.to,t+dur);fl.Q.value=o.q||1;
  var a=o.a||.003;gn.gain.setValueAtTime(.0001,t);gn.gain.exponentialRampToValueAtTime(g,t+a);if(o.hold)gn.gain.setValueAtTime(g,t+a+o.hold);gn.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(fl);fl.connect(gn);gn.connect(GGA.out);if(o.rev)gn.connect(GGA.rev);s.start(t,Math.random()*1.5);s.stop(t+dur+.05)}
function aBell(f,t,g,dur){[[1,1],[2.76,.45],[5.4,.22],[8.93,.1]].forEach(function(p,i){aO('sine',f*p[0],t,dur*(1-i*.2),g*p[1],{a:.002,rev:true})})}
function aBrass(n,t,dur,g){[0,-8,8].forEach(function(d){aO('sawtooth',nf(n),t,dur,g,{det:d,a:.03,hold:dur*.6,lp:900,lpTo:3500,rev:true})})}
function aFanfare(t,short){var seq=short?[[72,0,.2],[76,.1,.2],[79,.2,.2],[84,.3,.6]]:[[67,0,.15],[67,.17,.15],[67,.34,.15],[72,.51,.45],[76,.98,.18],[72,1.17,.18],[76,1.36,.18],[79,1.55,1.2]];
  seq.forEach(function(s){aBrass(s[0],t+s[1],s[2],.05);aBrass(s[0]-12,t+s[1],s[2],.035)});
  aO('sine',92,t,.6,.45,{to:46});aN(t,1.6,.1,{type:'highpass',f:5500,a:.01,rev:true});if(!short){aO('sine',92,t+1.55,.8,.5,{to:46});aN(t+1.55,2,.12,{type:'highpass',f:5000,a:.01,rev:true})}}
function aWhistle(t){[[0,.2],[.3,.5]].forEach(function(b){aO('sine',2950,t+b[0],b[1],.15,{a:.01,hold:b[1]-.07,vib:[34,120]});aN(t+b[0],b[1],.05,{f:2950,q:6,a:.01,hold:b[1]-.07})})}
function aCrowd(t,dur,g,groan){aN(t,dur,g,{f:groan?450:900,q:.5,a:dur*.25,hold:dur*.3,rev:true,to:groan?260:1150});aN(t,dur,g*.55,{f:groan?800:2400,q:.8,a:dur*.3,hold:dur*.25,rev:true})}
function aHorn(t){[155.6,196,233.1].forEach(function(f){aO('sawtooth',f,t,1,.05,{a:.03,hold:.65,lp:1500,to:f*.97,rev:true})})}
function aHum(on){var c=GGA.ctx;if(!c)return;
  if(on&&GGA.on&&GGA.vol>0&&!GGA.hum){try{var o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='sawtooth';o.frequency.value=58;f.type='lowpass';f.frequency.value=240;
    g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.045,c.currentTime+.15);o.connect(f);f.connect(g);g.connect(GGA.out);o.start();
    var tk=setInterval(function(){try{aN(c.currentTime,.025,.03,{type:'highpass',f:2600})}catch(e){}},72);GGA.hum={o:o,g:g,tk:tk}}catch(e){}}
  if(!on&&GGA.hum){var h=GGA.hum;GGA.hum=null;clearInterval(h.tk);try{h.g.gain.setTargetAtTime(.0001,c.currentTime,.05);h.o.stop(c.currentTime+.4)}catch(e){}}}
function aPlay(k,x){var c=aInit();if(!c||!GGA.on||GGA.vol<=0)return;var t=c.currentTime+.01,i;try{switch(k){
  case 'click':aO('square',1900,t,.035,.04,{lp:5000});aO('sine',900,t,.04,.05);break;
  case 'deny':aO('square',220,t,.12,.07,{lp:900});aO('square',165,t+.13,.22,.07,{lp:900});break;
  case 'open':[72,76,79,84].forEach(function(n,i){aBell(nf(n),t+i*.07,.1,.9)});aN(t,.7,.04,{type:'highpass',f:6000,a:.08,rev:true});break;
  case 'spin':aN(t,.26,.16,{f:500,to:2600,q:1.2,a:.02});aO('sawtooth',90,t,.3,.06,{to:180,lp:700});aO('square',2200,t,.03,.04,{lp:6000});break;
  case 'stop':aO('sine',150,t,.16,.5,{to:52,gl:.12});aN(t,.07,.24,{type:'lowpass',f:1400});aO('square',700+(x||0)*60,t,.02,.04,{lp:3000});break;
  case 'scat':aBell(nf(84+[0,4,7,12,16][Math.min(4,x||0)]),t,.26,1.4);aN(t,.5,.05,{type:'highpass',f:7000,rev:true});break;
  case 'antic':aO('sawtooth',110,t,1.35,.07,{to:440,gl:1.3,lp:500,lpTo:3000,a:.1,vib:[9,6]});aO('sawtooth',111.5,t,1.35,.05,{to:446,gl:1.3,lp:500,lpTo:3000,a:.1});
    for(i=0;i<10;i++)aN(t+i*.13,.06,.05+i*.012,{type:'lowpass',f:300});break;
  case 'tick':aO('triangle',2300+Math.random()*400+(x||0)*900,t,.045,.06,{a:.001});break;
  case 'rollend':aBell(nf(96),t,.16,1.1);aBell(nf(91),t+.06,.12,1);break;
  case 'win1':[0,4,7].forEach(function(s,i){aBell(nf(84+s),t+i*.075,.18,.8)});break;
  case 'win2':[0,4,7,12,16].forEach(function(s,i){aBell(nf(79+s),t+i*.07,.18,1)});aFanfare(t+.3,true);break;
  case 'coin':var f=3200+Math.random()*1400;aO('triangle',f,t,.09,.05,{a:.001});aO('sine',f*1.5,t,.07,.025,{a:.001});break;
  case 'big':aFanfare(t);break;
  case 'lvl':aFanfare(t,true);break;
  case 'free':[60,64,67,72,76,79,84,88,91,96].forEach(function(n,i){aBell(nf(n),t+i*.06,.12,1)});aN(t,1.2,.06,{type:'highpass',f:5000,a:.4,rev:true});aFanfare(t+.65,true);break;
  case 'drill':aWhistle(t);aCrowd(t+.3,2.8,.2);aHorn(t+.9);break;
  case 'dspin':for(i=0;i<6;i++)aO('square',1200+i*90,t+i*.05,.03,.02,{lp:4000});break;
  case 'dblank':aO('sine',240,t,.07,.08,{to:170});break;
  case 'dcoin':aO('triangle',nf(88+(x||0)),t,.12,.08,{a:.001});aO('sine',nf(100+(x||0)),t,.1,.03,{a:.001});break;
  case 'djp':aBell(nf(88),t,.2,1.2);aBell(nf(95),t+.08,.15,1.2);break;
  case 'dextra':[72,79,84].forEach(function(n,i){aBell(nf(n),t+i*.06,.14,.8)});break;
  case 'drum':for(i=0;i<18;i++)aN(t+i*.045,.05,.04+i*.009,{type:'lowpass',f:700});break;
  case 'td':aWhistle(t);aCrowd(t+.15,2.5,.28);aHorn(t+.45);break;
  case 'miss':aO('sine',120,t,.35,.35,{to:60});aN(t,.25,.12,{type:'lowpass',f:500});aCrowd(t+.05,1.2,.07,true);break;
  case 'collect':aBell(nf(84+[0,2,4,5,7,9,11,12,14][(x||0)%9]),t,.12,.5);break;
}}catch(e){}}
function sndIcon(){var v=GGA.on?GGA.vol:0;return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor"/>'+
  (v<=0?'<path d="m22 9-6 6M16 9l6 6"/>':(v>.05?'<path d="M15.5 8.5a5 5 0 0 1 0 7"/>':'')+(v>.45?'<path d="M19 5a10 10 0 0 1 0 14"/>':''))+'</svg>'}

/* ---------- symbol art (one SVG sprite, drawn here so it's crisp at any size) ---------- */
function ggSprite(){if(document.getElementById('ggSprite'))return;var d=document.createElement('div');d.id='ggSprite';d.setAttribute('aria-hidden','true');d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  var i,a,dots='',ticks='',F='font-family="Bungee,\'Chakra Petch\',Impact,sans-serif"';
  for(i=0;i<12;i++){a=i/12*Math.PI*2;dots+='<circle cx="'+(50+35.5*Math.cos(a)).toFixed(1)+'" cy="'+(50+35.5*Math.sin(a)).toFixed(1)+'" r="3.1" fill="#fff" stroke="#9fd8ff" stroke-width="1"/>'}
  for(i=0;i<12;i++){a=i/12*Math.PI*2;ticks+='<line x1="'+(50+21*Math.cos(a)).toFixed(1)+'" y1="'+(50+21*Math.sin(a)).toFixed(1)+'" x2="'+(50+25*Math.cos(a)).toFixed(1)+'" y2="'+(50+25*Math.sin(a)).toFixed(1)+'" stroke="#333" stroke-width="'+(i%3?1.4:2.8)+'"/>'}
  var lg=function(id,stops,v){return '<linearGradient id="'+id+'" x1="0" y1="0" x2="'+(v?0:1)+'" y2="1">'+stops.map(function(s){return '<stop offset="'+s[0]+'" stop-color="'+s[1]+'"/>'}).join('')+'</linearGradient>'};
  var rg=function(id,stops){return '<radialGradient id="'+id+'" cx=".38" cy=".32" r=".75">'+stops.map(function(s){return '<stop offset="'+s[0]+'" stop-color="'+s[1]+'"/>'}).join('')+'</radialGradient>'};
  var sym=function(id,body){return '<symbol id="gg-'+id+'" viewBox="0 0 100 100">'+body+'</symbol>'};
  d.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs>'+
   lg('ggGold',[[0,'#fff6c9'],[.42,'#f6cf4c'],[.55,'#d9a91c'],[1,'#8a6206']],1)+lg('ggGoldD',[[0,'#e7b92f'],[1,'#7a5300']],1)+
   rg('ggRuby',[[0,'#ffc2cc'],[.45,'#e0163f'],[1,'#5c0016']])+lg('ggRed',[[0,'#ff8a7a'],[.5,'#d42020'],[1,'#6b0909']],1)+
   rg('ggBrown',[[0,'#d08a48'],[.6,'#7a3a12'],[1,'#3d1a05']])+lg('ggBlue',[[0,'#e2f4ff'],[.5,'#3fa0ff'],[1,'#163f9e']],1)+
   lg('ggPurp',[[0,'#f6e3ff'],[.5,'#b14dff'],[1,'#4f1088']],1)+lg('ggSilver',[[0,'#ffffff'],[.5,'#c4c9d4'],[1,'#5f6675']],1)+
   '<filter id="ggSh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2.5" stdDeviation="1.8" flood-color="#000" flood-opacity=".6"/></filter></defs>'+
   sym('RING','<g filter="url(#ggSh)"><circle cx="50" cy="50" r="41" fill="url(#ggGold)" stroke="#5a3d00" stroke-width="2"/><circle cx="50" cy="50" r="31" fill="url(#ggGoldD)"/>'+dots+
     '<rect x="34" y="34" width="32" height="32" rx="4" transform="rotate(45 50 50)" fill="url(#ggRuby)" stroke="#ffe08a" stroke-width="2.5"/><path d="M50 31 V69 M31 50 H69" stroke="#fff" stroke-opacity=".25" stroke-width="1.5"/><path d="M42 41 50 33 58 41Z" fill="#fff" opacity=".6"/></g>'+
     '<path d="M80 12 l2.2 6.3 6.3 2.2-6.3 2.2-2.2 6.3-2.2-6.3-6.3-2.2 6.3-2.2z" fill="#fff"/>')+
   sym('TROPHY','<g filter="url(#ggSh)"><path d="M28 22H15c0 16 9 24 19 25M72 22h13c0 16-9 24-19 25" fill="none" stroke="url(#ggGold)" stroke-width="6" stroke-linecap="round"/>'+
     '<path d="M27 13h46v15c0 18-10 30-23 32-13-2-23-14-23-32z" fill="url(#ggGold)" stroke="#6b4a00" stroke-width="1.5"/><rect x="44" y="59" width="12" height="13" fill="url(#ggGoldD)"/>'+
     '<path d="M33 72h34l5 10H28z" fill="url(#ggGold)" stroke="#6b4a00" stroke-width="1.5"/><rect x="23" y="82" width="54" height="9" rx="2" fill="#3d1f08" stroke="#c99a2a" stroke-width="1.5"/>'+
     '<path d="M50 22l3.5 7.1 7.8 1.1-5.6 5.5 1.3 7.8-7-3.7-7 3.7 1.3-7.8-5.6-5.5 7.8-1.1z" fill="#fff8d6" opacity=".95"/><path d="M33 18c0 14 4 24 10 30" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/></g>')+
   sym('STADIUM','<g filter="url(#ggSh)"><path d="M13 60C9 32 31 11 56 12c22 1 37 18 36 40v6l-20 2-4 12c-8 6-24 8-36 6-10-2-17-8-19-18z" fill="url(#ggRed)" stroke="#3a0505" stroke-width="2"/>'+
     '<path d="M19 33C33 17 60 13 82 26" stroke="#fff" stroke-width="6" fill="none"/><path d="M19 33C33 17 60 13 82 26" stroke="#1a1a1a" stroke-width="1.5" fill="none" opacity=".35"/>'+
     '<circle cx="49" cy="53" r="6.5" fill="#2a0303"/><circle cx="49" cy="53" r="3" fill="#000"/>'+
     '<path d="M71 45h25M73 58h23M88 41v33M96 43v28M71 45c-2 10-2 21 3 29h16" stroke="url(#ggSilver)" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'+
     '<path d="M24 46c2-12 12-21 25-24" stroke="#fff" stroke-opacity=".45" stroke-width="4" fill="none" stroke-linecap="round"/></g>')+
   sym('PLAYBOOK','<g filter="url(#ggSh)" transform="rotate(-35 50 50)"><path d="M6 50C19 25 81 25 94 50 81 75 19 75 6 50z" fill="url(#ggBrown)" stroke="#2a1003" stroke-width="2"/>'+
     '<path d="M23 36c-3 8-3 20 0 28M77 36c3 8 3 20 0 28" stroke="#fff" stroke-width="4" fill="none"/><path d="M35 50h30" stroke="#fff" stroke-width="3.2"/><path d="M39 44.5v11M44.5 44.5v11M50 44.5v11M55.5 44.5v11M61 44.5v11" stroke="#fff" stroke-width="2.6"/>'+
     '<path d="M19 43c12-10 32-12 48-10" stroke="#fff" stroke-opacity=".3" stroke-width="3" fill="none" stroke-linecap="round"/></g>')+
   sym('BALL','<text x="50" y="81" text-anchor="middle" '+F+' font-size="76" fill="url(#ggBlue)" stroke="#0a1f4d" stroke-width="3.5" paint-order="stroke" filter="url(#ggSh)">A</text>')+
   sym('CAP','<text x="50" y="81" text-anchor="middle" '+F+' font-size="76" fill="url(#ggPurp)" stroke="#2a0650" stroke-width="3.5" paint-order="stroke" filter="url(#ggSh)">K</text>')+
   sym('WILD','<g filter="url(#ggSh)"><rect x="5" y="4" width="90" height="90" rx="14" fill="#140a22" stroke="url(#ggGold)" stroke-width="4"/><image href="/brand-96.png" x="15" y="6" width="70" height="70"/>'+
     '<path d="M0 68h100l-6 9.5 6 9.5H0l6-9.5z" fill="url(#ggRed)" stroke="#ffe08a" stroke-width="1.6"/><text x="50" y="84" text-anchor="middle" '+F+' font-size="16" fill="#fff" letter-spacing="2">WILD</text></g>')+
   sym('TICKET','<g filter="url(#ggSh)" transform="rotate(-8 50 50)"><path d="M6 27h88v13a6.5 6.5 0 0 0 0 20v13H6V60a6.5 6.5 0 0 0 0-20z" fill="url(#ggGold)" stroke="#6b4a00" stroke-width="2"/>'+
     '<rect x="15" y="33" width="70" height="34" rx="3" fill="none" stroke="#7a5300" stroke-width="1.5" stroke-dasharray="3 2"/><text x="50" y="49" text-anchor="middle" '+F+' font-size="15" fill="#6b1400">FREE</text><text x="50" y="63" text-anchor="middle" '+F+' font-size="12.5" fill="#6b1400">SPINS</text></g>')+
   sym('DRAFT','<g filter="url(#ggSh)"><rect x="43" y="5" width="14" height="10" rx="2" fill="url(#ggSilver)"/><path d="M71 15l7-6 5.5 5.5-6.5 7z" fill="url(#ggSilver)"/>'+
     '<circle cx="50" cy="48" r="34" fill="url(#ggSilver)" stroke="#333" stroke-width="2"/><circle cx="50" cy="48" r="27" fill="#fff" stroke="#c81e1e" stroke-width="3"/><g transform="translate(0 -2)">'+ticks+'</g>'+
     '<path d="M50 48V28" stroke="#111" stroke-width="3.2" stroke-linecap="round"/><path d="M50 48l13 8" stroke="#c81e1e" stroke-width="2.6" stroke-linecap="round"/><circle cx="50" cy="48" r="3.2" fill="#111"/>'+
     '<path d="M2 70h96l-5.5 9 5.5 9H2l5.5-9z" fill="url(#ggBlue)" stroke="#fff" stroke-width="1.6"/><text x="50" y="85" text-anchor="middle" '+F+' font-size="15" fill="#fff" letter-spacing="1.5">BONUS</text></g>')+
   '</svg>';
  document.body.appendChild(d)}
function gc(s){return '<div class="gc" data-s="'+s+'"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#gg-'+s+'"/></svg></div>'}
// Casino fonts are self-hosted in /fonts (SIL Open Font License), loaded only when the game opens.
function ggFonts(){if(document.getElementById('ggFont'))return;var st=document.createElement('style');st.id='ggFont';
  st.textContent=[['Bungee',400,'bungee-latin-400-normal'],['Orbitron',700,'orbitron-latin-700-normal'],['Orbitron',900,'orbitron-latin-900-normal']].map(function(f){return "@font-face{font-family:'"+f[0]+"';font-weight:"+f[1]+";font-style:normal;font-display:swap;src:url(/fonts/"+f[2]+".woff2) format('woff2')}"}).join('');
  document.head.appendChild(st);try{document.fonts&&document.fonts.load('400 20px Bungee');document.fonts&&document.fonts.load('900 20px Orbitron')}catch(e){}}

/* ---------- cabinet ---------- */
function slotRoot(){var el=document.getElementById('slot');if(!el){el=document.createElement('div');el.id='slot';el.className='slot';document.body.appendChild(el)}return el}
function bulbs(n){var h='';for(var i=0;i<n;i++)h+='<i></i>';return '<div class="gg-bulbs">'+h+'</div>'}
function jpHtml(bet){return GG_JP.map(function(j){return '<div class="gg-jp" style="--c:'+j[2]+'"><small>'+j[0]+'</small><b class="num" data-jpx="'+j[1]+'">'+gb(j[1]*bet)+'</b></div>'}).join('')}
function tabsHtml(side){var rows=[[],[],[]],L=(SL.pt&&SL.pt.lines)||[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1]];
  L.forEach(function(ln,i){rows[side?ln[4]:ln[0]].push(i)});
  return '<div class="gg-tabs">'+rows.map(function(r){return '<div class="rw">'+r.map(function(i){return '<i style="--c:'+GG_COL[i]+'">'+(i+1)+'</i>'}).join('')+'</div>'}).join('')+'</div>'}
var GR=[];
function ggStripOf(i){return SL.pt&&SL.pt.strips&&SL.pt.strips[i]?SL.pt.strips[i]:GG_SEQ}
function ggReelsInit(){for(var i=0;i<5;i++){if(!GR[i])GR[i]={i:i,p:Math.floor(Math.random()*30),mode:'idle',v:0,base:null};var s=ggStripOf(i);if(GR[i].s!==s){GR[i].s=s;GR[i].base=null;GR[i].p=Math.floor(Math.random()*s.length)}}}
function openSlot(){
  if(!LIVE){toast('Nice find. It only works in the live app.');return}
  if(!AUTH){toast('Log in to the Sportsbook to play');openLogin();return}
  ggFonts();ggSprite();aInit();
  SL.open=true;SL.auto=0;var el=slotRoot();el.classList.add('open');document.body.style.overflow='hidden';
  ggReelsInit();slotRender();ggMsg('Loading…');
  Promise.all([api('/slots/state'),SL.pt?Promise.resolve(SL.pt):api('/slots/paytable')]).then(function(r){SL.state=r[0];SL.pt=r[1];
    SL.cred=SL.state.balance-(SL.state.bonus?SL.state.bonus.total:0);SL.winShown=0;if(SL.state.free_bet)SL.bet=SL.state.free_bet;
    ggReelsInit();slotRender();aPlay('open');
    if(SL.state.bonus){SL.busy=true;ggSplash('drill',function(){SL.busy=false;drillStart(SL.state.bonus)})}
    else if(SL.state.free_left>0)ggMsg(SL.state.free_left+' free spins left · tap FREE');
    else ggMsg(SL.cred<SL.bet?'Not enough Bucks to spin':'Play 9 lines · good luck')}).catch(function(e){ggMsg(e.message)})}
function closeSlot(){if(SL.spinning||SL.busy||SL.roll)return;SL.open=false;SL.auto=0;ggStopCycle();aHum(false);var el=slotRoot();el.classList.remove('open');document.body.style.overflow='';bookLoad()}
function slotRender(){
  var el=slotRoot(),st=SL.state,free=!!(st&&st.free_left>0);
  el.innerHTML='<div class="gg">'+
   '<div class="gg-top"><button type="button" class="gg-ib" data-slx="1" aria-label="Close">✕</button><div class="gg-ttl">Mahomie\'s Hub · after hours</div>'+
    '<button type="button" class="gg-ib" data-slsnd="1" aria-label="Sound" id="ggSndBtn">'+sndIcon()+'</button>'+
    '<div class="gg-pop" id="ggSnd" hidden><div class="gg-pop-h">Sound</div><div class="gg-vol"><button type="button" class="gg-ib sm" data-slmute="1" aria-label="Mute">'+sndIcon()+'</button>'+
     '<input type="range" min="0" max="100" step="1" id="ggVol" value="'+Math.round((GGA.on?GGA.vol:0)*100)+'" aria-label="Volume"><b class="num" id="ggVolN">'+Math.round((GGA.on?GGA.vol:0)*100)+'</b></div>'+
     '<p class="gg-pop-p">iPhone: the ring/silent switch doesn\'t mute the game. Use this.</p></div>'+
    '<div class="gg-pop" id="ggAutoPop" hidden><div class="gg-pop-h">Auto spin</div><div class="gg-autos">'+[10,25,50].map(function(n){return '<button type="button" data-slauton="'+n+'">'+n+'</button>'}).join('')+'</div>'+
     '<p class="gg-pop-p">Stops on any feature or a big win. Tap STOP anytime.</p></div></div>'+
   '<div class="gg-cab'+(free?' free':'')+'" id="ggCab">'+
    '<div class="gg-marq">'+bulbs(17)+'<div class="gg-logo"><span>GRIDIRON</span><b>GOLD</b></div><div class="gg-tag" id="ggTag"></div>'+bulbs(17)+'</div>'+
    '<div class="gg-jps" id="ggJps">'+jpHtml(SL.bet)+'</div>'+
    '<div class="gg-win">'+tabsHtml(0)+'<div class="gg-reels" id="ggReels">'+[0,1,2,3,4].map(function(i){return '<div class="gg-reel" data-reel="'+i+'"><div class="gg-strip"></div></div>'}).join('')+'<svg class="gg-lines" id="ggLines"></svg></div>'+tabsHtml(1)+'</div>'+
    '<div class="gg-led" id="ggMsg"></div>'+
    '<div class="gg-meters"><div><small>Credit</small><b class="num cr" id="ggCred"></b></div><div><small>Bet</small><b class="num bt" id="ggBet"></b></div><div><small id="ggWinL">Win</small><b class="num wn" id="ggWin"></b></div></div>'+
    '<div class="gg-deck"><button type="button" class="gg-sm gg-i" data-slpt="1" aria-label="Paytable and rules">i</button><button type="button" class="gg-sm" data-slbet="-1" id="ggMinus" aria-label="Lower bet">−</button>'+
     '<button type="button" class="gg-spin" data-slspin="1" id="ggSpin"><span id="ggSpinT">SPIN</span><small id="ggSpinS"></small></button>'+
     '<button type="button" class="gg-sm" data-slbet="1" id="ggPlus" aria-label="Raise bet">+</button><button type="button" class="gg-sm gg-auto" data-slauto="1" id="ggAuto">AUTO</button></div>'+
   '</div>'+
   '<div class="gg-foot">Play money · '+(SL.pt?SL.pt.rtp:'92.5%')+' theoretical payback, the Las Vegas Strip average · every spin is independent</div></div>';
  ggBind();ggMeters();
}
function ggBind(){var box=document.getElementById('ggReels');if(!box)return;var r0=box.querySelector('.gg-reel');var w=r0.clientWidth||60,h=Math.round(w*.98);
  box.parentNode.style.setProperty('--ch',h+'px');
  GR.forEach(function(r,i){r.el=box.querySelector('[data-reel="'+i+'"]');r.strip=r.el.firstChild;r.h=h;r.base=null;rDraw(r)})}
function rDraw(r){if(!r.strip)return;var len=r.s.length;
  if(r.base==null||r.p<r.base||r.p>=r.base+8){r.base=Math.floor(r.p)-6;var h='';for(var k=r.base-1;k<=r.base+11;k++)h+=gc(r.s[((k%len)+len)%len]);r.strip.innerHTML=h}
  r.strip.style.transform='translate3d(0,'+(-(r.p-(r.base-1))*r.h).toFixed(2)+'px,0)'}
function cellEl(reel,row){var r=GR[reel];if(!r||!r.strip)return null;return r.strip.children[Math.round(r.p)+row-(r.base-1)]}
function eob(x){var c1=1.15,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)}
function ggLoop(t){var dt=SL.lt?Math.min(.05,(t-SL.lt)/1000):.016;SL.lt=t;var any=false;
  GR.forEach(function(r){
    if(r.mode==='spin'){any=true;var e=t-r.st;if(e>=0){if(e<110)r.p+=2.6*dt;else{r.v=Math.min(GG_V,r.v+GG_V*dt/.2);r.p-=r.v*dt}}if(r.el)r.el.classList.toggle('blur',r.v>10)}
    else if(r.mode==='stop'){any=true;var k=Math.max(0,Math.min(1,(t-r.t0)/r.dur));r.p=r.from+(r.to-r.from)*eob(k);if(r.el&&k>.4)r.el.classList.remove('blur');
      if(k>=1){r.p=r.to;r.mode='idle';rDraw(r);reelLanded(r);return}}
    rDraw(r)});
  if(any)SL.raf=requestAnimationFrame(ggLoop);else{SL.raf=null;SL.lt=0}}
function ggKick(){if(!SL.raf){SL.lt=0;SL.raf=requestAnimationFrame(ggLoop)}}
function reelStop(r,idx,quick){var D=quick?2.2:3.4;r.to=idx;r.from=idx+D;r.p=r.from;r.base=null;r.t0=performance.now();r.dur=D*4.15/GG_V*1000;r.mode='stop';r.v=GG_V;if(r.el)r.el.classList.remove('antic');ggKick()}
function ggMsg(t,cls){var m=document.getElementById('ggMsg');if(!m)return;m.textContent=t||'';m.className='gg-led'+(cls?' '+cls:'')}
function ggMeters(){var st=SL.state,free=!!(st&&st.free_left>0),$e=function(id){return document.getElementById(id)};
  if(!$e('ggCred'))return;
  $e('ggCred').textContent=st?gb(SL.cred):'—';$e('ggBet').textContent=SL.bet+(free?' ×'+fm():'');
  $e('ggWinL').textContent=free?'Free spin win':'Win';$e('ggWin').textContent=free?gb(st.free_won||0):SL.winShown?gb(SL.winShown):'0';
  var cab=$e('ggCab');if(cab)cab.classList.toggle('free',free);
  $e('ggTag').textContent=free?'★ Free spins · '+st.free_left+' left · all wins ×'+fm()+' ★':'9 lines · MH wild · Two-Minute Drill';
  var sp=$e('ggSpin');sp.className='gg-spin'+(SL.spinning?' stop':free?' free':'');$e('ggSpinT').textContent=SL.spinning?'STOP':free?'FREE':'SPIN';$e('ggSpinS').textContent=free&&!SL.spinning?st.free_left+' left':'';
  var lock=SL.spinning||free||!!SL.roll,bets=(SL.pt&&SL.pt.bets)||[10,25,50],bi=bets.indexOf(SL.bet);
  $e('ggMinus').disabled=lock||bi<=0;$e('ggPlus').disabled=lock||bi>=bets.length-1;
  var au=$e('ggAuto');au.textContent=SL.auto>0?'STOP '+SL.auto:'AUTO';au.classList.toggle('on',SL.auto>0);au.disabled=free&&!SL.auto;
  [].forEach.call(document.querySelectorAll('#ggJps [data-jpx]'),function(b){b.textContent=gb(+b.dataset.jpx*SL.bet)})}
function ggMetersFast(){var c=document.getElementById('ggCred'),w=document.getElementById('ggWin');if(c)c.textContent=gb(SL.cred);if(w)w.textContent=gb(SL.state&&SL.state.free_left>0&&SL.res&&SL.res.free?(SL.freeBase||0)+SL.winShown:SL.winShown)}

/* ---------- a spin ---------- */
function slotSpin(){
  if(!SL.state||SL.busy)return;
  if(SL.roll){ggRollEnd();return}
  if(SL.spinning){ggSlam();return}
  var free=SL.state.free_left>0;
  if(!free&&SL.cred<SL.bet){ggMsg(SL.cred<10?'Out of Bucks for the season':'Not enough Bucks for that bet','bad');SL.auto=0;ggMeters();aPlay('deny');return}
  aInit();ggStopCycle();ggClearMarks();ggPops(true);
  if(SL.auto>0&&!free)SL.auto--;
  SL.spinning=true;SL.res=null;SL.slam=false;SL.landed=0;SL.freeBase=free?(SL.state.free_won||0):0;SL.winShown=0;
  if(!free)SL.cred=Math.round((SL.cred-SL.bet)*100)/100;
  ggMeters();ggMsg(free?'Free spin · wins ×'+fm():'Good luck');
  aPlay('spin');aHum(true);
  var t=performance.now();GR.forEach(function(r,i){r.mode='spin';r.st=t+i*45;r.v=0});ggKick();
  var t0=Date.now();
  api('/slots/spin',{body:{bet:SL.bet}}).then(function(r){SL.res=r;var wait=SL.slam?0:Math.max(0,560-(Date.now()-t0));setTimeout(function(){ggSchedule(r)},wait)})
   .catch(function(e){GR.forEach(function(r){r.mode='idle';r.v=0;r.p=Math.round(r.p);if(r.el)r.el.classList.remove('blur')});aHum(false);SL.spinning=false;SL.auto=0;
     api('/slots/state').then(function(s){SL.state=s;SL.cred=s.balance;ggMeters()}).catch(function(){ggMeters()});ggMeters();ggMsg(e.message,'bad');aPlay('deny')})}
function ggAntic(g){var a=[false,false,false,false,false],tk=0;
  for(var i=0;i<5;i++){if(i>=2&&tk>=2)a[i]=true;tk+=g[i].filter(function(s){return s==='TICKET'}).length}
  if(g[0].indexOf('DRAFT')>=0&&g[1].indexOf('DRAFT')>=0)a[2]=true;return a}
function ggSchedule(r){SL.stopT.forEach(clearTimeout);SL.stopT=[];if(SL.slam){ggSlamStop();return}
  var ant=ggAntic(r.grid),t=0;
  for(var i=0;i<5;i++){if(i)t+=230;if(ant[i]){(function(i,ts){SL.stopT.push(setTimeout(function(){if(GR[i].el)GR[i].el.classList.add('antic');aPlay('antic')},ts))})(i,t);t+=1300}
    (function(i,ts){SL.stopT.push(setTimeout(function(){reelStop(GR[i],r.stops[i])},ts))})(i,t)}}
function ggSlam(){if(SL.slam)return;SL.slam=true;aPlay('click');if(SL.res)ggSlamStop()}
function ggSlamStop(){SL.stopT.forEach(clearTimeout);SL.stopT=[];var r=SL.res;GR.forEach(function(g,i){if(g.mode==='spin')reelStop(g,r.stops[i],true)})}
function reelLanded(r){var res=SL.res;if(!res)return;var col=res.grid[r.i],sp=col.indexOf('TICKET')>=0||(r.i<3&&col.indexOf('DRAFT')>=0);
  aPlay('stop',r.i);if(sp){SL.scat=(SL.scat||0);aPlay('scat',r.i)}
  try{if(navigator.vibrate)navigator.vibrate(sp?18:7)}catch(e){}
  if(sp)col.forEach(function(s,row){if(s==='TICKET'||(s==='DRAFT'&&r.i<3)){var c=cellEl(r.i,row);if(c)c.classList.add('pop')}});
  SL.landed++;if(SL.landed===5){aHum(false);setTimeout(ggDone,140)}}
function ggPops(off){[].forEach.call(document.querySelectorAll('#ggReels .gc.pop'),function(c){c.classList.remove('pop')})}
function ggClearMarks(){[].forEach.call(document.querySelectorAll('#ggReels .gc.win,#ggReels .gc.dim'),function(c){c.classList.remove('win','dim')});var sv=document.getElementById('ggLines');if(sv)sv.innerHTML=''}
function ggMark(cells){var on={};cells.forEach(function(c){on[c[0]+'-'+c[1]]=1});
  for(var i=0;i<5;i++)for(var row=0;row<3;row++){var e=cellEl(i,row);if(!e)continue;e.classList.toggle('win',!!on[i+'-'+row]);e.classList.toggle('dim',!on[i+'-'+row])}}
function ggLineSvg(items){var box=document.getElementById('ggReels'),sv=document.getElementById('ggLines');if(!box||!sv||!SL.pt)return;var B=box.getBoundingClientRect(),html='';
  sv.setAttribute('viewBox','0 0 '+B.width.toFixed(1)+' '+B.height.toFixed(1));
  items.forEach(function(it){if(it.line<0)return;var ln=SL.pt.lines[it.line],pts=[];
    GR.forEach(function(r,i){var c=r.el.getBoundingClientRect(),x=c.left-B.left+c.width/2,y=c.top-B.top+r.h*(ln[i]+.5);if(!i)pts.push([0,y]);pts.push([x,y]);if(i===4)pts.push([B.width,y])});
    var d=pts.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1)}).join(' ');
    html+='<polyline points="'+d+'" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="7.5" stroke-linejoin="round" stroke-linecap="round"/><polyline points="'+d+'" fill="none" stroke="'+GG_COL[it.line]+'" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>'});
  sv.innerHTML=html}
function ggShowAll(items){var all=[];items.forEach(function(it){all=all.concat(it.cells)});ggMark(all);ggLineSvg(items)}
function ggCycle(){ggStopCycle();var it=SL.items;if(!it||!it.length)return;if(it.length===1){ggMark(it[0].cells);ggLineSvg(it);ggMsg(it[0].label,'hot');return}
  var k=0,step=function(){var x=it[k%it.length];ggMark(x.cells);ggLineSvg([x]);ggMsg(x.label,'hot');k++};step();SL.cycleT=setInterval(step,1500)}
function ggStopCycle(){clearInterval(SL.cycleT);SL.cycleT=null}
function ggDone(){var r=SL.res;SL.spinning=false;var st=SL.state;
  st.free_left=r.free_left;st.free_bet=r.free_left>0?r.bet:null;st.balance=r.balance;
  var items=r.wins.map(function(w){return {line:w.line,cells:w.cells,label:'Line '+(w.line+1)+' · '+w.n+' '+GG_N[w.sym]+' · '+gb(w.pay)}});
  if(r.tickets>=3){var tc=[];r.grid.forEach(function(col,ri){col.forEach(function(s,row){if(s==='TICKET')tc.push([ri,row])})});items.push({line:-1,cells:tc,label:r.tickets+' tickets'+(r.scatter?' pay '+gb(r.scatter):'')+' · free spins!'})}
  if(r.bonus){var dc=[];[0,1,2].forEach(function(ri){r.grid[ri].forEach(function(s,row){if(s==='DRAFT')dc.push([ri,row])})});items.push({line:-1,cells:dc,label:'Two-Minute Drill!'})}
  SL.items=items;ggMeters();
  var next=function(){st.free_won=r.free_won;ggCycle();ggMeters();ggAfter(r)};
  if(r.win>0){ggShowAll(items);ggMsg('Win '+gb(r.win),'hot');var x=r.win/r.bet;
    if(x>=10)ggBig(r.win,r.bet,next);
    else{aPlay(x>=3?'win2':'win1');ggRoll(r.win,x<1?700:x<3?1300:2200,next)}}
  else if(items.length){ggShowAll(items);next()}
  else{ggMsg(r.free?r.free_left+' free spins left':'');st.free_won=r.free_won;ggMeters();ggAfter(r)}}
function ggRoll(amt,dur,cb){var base=SL.cred,t0=performance.now(),last=0;SL.roll={amt:amt,base:base,cb:cb,done:false};var me=SL.roll;ggMeters();
  function f(t){if(SL.roll!==me||me.done)return;var k=Math.min(1,(t-t0)/dur);SL.winShown=amt*k;SL.cred=base+amt*k;ggMetersFast();
    if(t-last>62&&k<1){last=t;aPlay('tick',k)}if(k>=1)ggRollEnd();else requestAnimationFrame(f)}
  requestAnimationFrame(f)}
function ggRollEnd(){var R=SL.roll;if(!R||R.done)return;R.done=true;SL.winShown=R.amt;SL.cred=Math.round((R.base+R.amt)*100)/100;SL.roll=null;ggMetersFast();aPlay('rollend');ggMeters();if(R.cb)R.cb()}
function ggAfter(r){
  if(r.free_awarded){SL.auto=0;ggSplash(r.free?'retrigger':'free',function(){if(r.bonus)ggBonusGo(r);else ggNextFree()},r.free_awarded);return}
  if(r.bonus){SL.auto=0;ggBonusGo(r);return}
  if(r.free_done){ggSplash('freedone',function(){SL.state.free_won=0;ggMeters();ggMsg('Free spins paid '+gb(r.free_won),'hot');ggAutoNext()},r.free_won);return}
  if(r.free&&r.free_left>0){ggNextFree();return}
  ggAutoNext()}
function ggNextFree(){ggMeters();setTimeout(function(){if(SL.open&&!SL.spinning&&!SL.busy&&SL.state.free_left>0)slotSpin()},SL.res&&SL.res.win>0?1700:800)}
function ggAutoNext(){ggMeters();if(SL.auto>0)setTimeout(function(){if(SL.open&&SL.auto>0&&!SL.spinning&&!SL.busy&&!SL.roll)slotSpin()},SL.res&&SL.res.win>0?1500:600)}
function ggBonusGo(r){SL.busy=true;ggMeters();setTimeout(function(){ggSplash('drill',function(){SL.busy=false;drillStart(r.bonus)})},500)}

/* ---------- celebrations ---------- */
function ggCoins(cv,n){var ctx=cv.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth||360,H=cv.clientHeight||700,P=[],spawned=0,last=0;
  cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  function add(){P.push({x:W*(.25+Math.random()*.5),y:H+20,vx:(Math.random()-.5)*W*.9,vy:-(H*1.05+Math.random()*H*.55),r:8+Math.random()*7,a:Math.random()*6,va:5+Math.random()*9})}
  function f(t){if(!cv.isConnected)return;var dt=last?Math.min(.04,(t-last)/1000):.016;last=t;
    for(var j=0;j<4&&spawned<n&&P.length<130;j++){add();spawned++}
    ctx.clearRect(0,0,W,H);
    for(var i=P.length-1;i>=0;i--){var p=P[i];p.vy+=H*1.5*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=p.va*dt;if(p.y>H+40&&p.vy>0){P.splice(i,1);continue}
      var sx=Math.max(.1,Math.abs(Math.cos(p.a)));ctx.save();ctx.translate(p.x,p.y);ctx.scale(sx,1);
      var g=ctx.createRadialGradient(-p.r*.35,-p.r*.35,1,0,0,p.r);g.addColorStop(0,'#fff6c9');g.addColorStop(.5,'#f6cf4c');g.addColorStop(1,'#9a6c05');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,p.r,0,6.3);ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle='#7a5300';ctx.stroke();ctx.beginPath();ctx.arc(0,0,p.r*.6,0,6.3);ctx.strokeStyle='rgba(122,83,0,.55)';ctx.stroke();ctx.restore()}
    if(spawned>=n&&!P.length)return;requestAnimationFrame(f)}
  requestAnimationFrame(f);return function(){n=spawned}}
var GG_SPLASH={
  free:function(n){return {icon:'TICKET',k:'Feature',t:'FREE SPINS',n:n,s:'Every win pays ×'+fm()+'. Land 3 more tickets for 10 more.',b:'Start'}},
  retrigger:function(n){return {icon:'TICKET',k:'Retrigger',t:'+'+n+' FREE SPINS',s:'More free spins added.',b:'Keep going'}},
  drill:function(){return {icon:'DRAFT',k:'Bonus',t:'TWO-MINUTE DRILL',s:'Every drive the 9 squares spin. When the play reel lands TOUCHDOWN, you collect the whole board. '+((SL.pt&&SL.pt.drill&&SL.pt.drill.drives)||8)+' drives.',b:'Let\'s go'}},
  freedone:function(n){return {icon:'TICKET',k:'Free spins complete',t:'YOU WON',n:gb(n),s:'Bucks',b:'Collect'}}};
function ggSplash(kind,then,arg){var el=slotRoot(),d=document.createElement('div'),c=GG_SPLASH[kind](arg);d.className='gg-splash k-'+kind;
  d.innerHTML='<canvas class="gg-coins"></canvas><div class="gg-sp-in"><div class="gg-sp-i">'+gc(c.icon)+'</div><div class="gg-sp-k">'+esc(c.k)+'</div><div class="gg-sp-t">'+esc(c.t)+'</div>'+(c.n!=null?'<div class="gg-sp-n num">'+esc(String(c.n))+'</div>':'')+'<div class="gg-sp-s">'+esc(c.s)+'</div><button type="button" class="gg-sp-b">'+esc(c.b)+'</button></div>';
  el.appendChild(d);aPlay(kind==='drill'?'drill':kind==='freedone'?'win2':'free');ggCoins(d.querySelector('canvas'),kind==='freedone'?70:kind==='drill'?30:45);
  var cab=document.getElementById('ggCab');if(cab)cab.classList.add('party');
  var go=function(){if(d._g)return;d._g=1;aPlay('click');d.classList.add('out');if(cab)cab.classList.remove('party');setTimeout(function(){d.remove();if(then)then()},300)};
  d.querySelector('.gg-sp-b').addEventListener('click',function(e){e.stopPropagation();aInit();go()})}
var GG_TIER=['','BIG WIN','MEGA WIN','EPIC WIN'];
function ggBig(amt,bet,cb,opt){opt=opt||{};SL.auto=0;var el=slotRoot(),d=document.createElement('div');d.className='gg-big';
  d.innerHTML='<div class="gg-rays"></div><canvas class="gg-coins"></canvas><div class="gg-big-in"><div class="gg-big-t" id="ggBigT">'+GG_TIER[1]+'</div><div class="gg-big-n num" id="ggBigN">0</div><div class="gg-big-s" id="ggBigS">Tap to skip</div></div>';
  el.appendChild(d);var x=amt/bet,dur=x>=50?8000:x>=25?6200:4200,stopCoins=ggCoins(d.querySelector('canvas'),99999),cab=document.getElementById('ggCab');if(cab)cab.classList.add('party');
  aPlay('big');var t0=performance.now(),base=SL.cred,lvl=1,done=false,last=0,auto=null;if(!opt.noCred)SL.roll={amt:amt,base:base,done:false,big:true};
  function show(v){var n=document.getElementById('ggBigN');if(n)n.textContent=gb(v);if(!opt.noCred){SL.winShown=v;SL.cred=base+v;ggMetersFast()}
    var cur=v/bet>=50?3:v/bet>=25?2:1;if(cur>lvl){lvl=cur;var tt=document.getElementById('ggBigT');if(tt){tt.textContent=GG_TIER[cur];tt.classList.remove('punch');void tt.offsetWidth;tt.classList.add('punch')}aPlay('lvl')}}
  function f(t){if(done)return;var k=Math.min(1,(t-t0)/dur);show(amt*(1-Math.pow(1-k,1.6)));if(t-last>75){last=t;aPlay('coin')}if(k>=1)finish();else requestAnimationFrame(f)}
  function finish(){if(done)return;done=true;show(amt);if(!opt.noCred){SL.cred=Math.round((base+amt)*100)/100;SL.winShown=amt;SL.roll=null;ggMetersFast()}aPlay('rollend');
    var s=document.getElementById('ggBigS');if(s)s.textContent='Tap to continue';auto=setTimeout(close,3200)}
  function close(){if(d._c)return;d._c=1;clearTimeout(auto);stopCoins();d.classList.add('out');if(cab)cab.classList.remove('party');setTimeout(function(){d.remove();ggMeters();if(cb)cb()},300)}
  d.addEventListener('click',function(e){e.stopPropagation();if(!done)finish();else close()});requestAnimationFrame(f)}

/* ---------- Two-Minute Drill (hold-and-spin bonus) ---------- */
var DR=null,TD_MISS=['INCOMPLETE','SACKED','PUNT','FUMBLE','PICKED OFF','3 &amp; OUT'];
function drCell(c,bet){if(!c||c.t==='blank')return '<div class="dc blank"><svg viewBox="0 0 100 100"><use href="#gg-PLAYBOOK"/></svg></div>';
  if(c.t==='val')return '<div class="dc coin"><b>'+gb(c.v*bet)+'</b></div>';
  if(c.t==='jp')return '<div class="dc coin jp jp-'+c.jp.toLowerCase()+'"><small>'+c.jp+'</small><b>'+gb(c.v*bet)+'</b></div>';
  return '<div class="dc coin xd"><b>+1</b><small>DRIVE</small></div>'}
function drFake(){var r=Math.random();return r<.5?{t:'blank'}:r<.86?{t:'val',v:[0.5,1,2,3,5][Math.floor(Math.random()*5)]}:r<.95?{t:'jp',jp:['MINI','MINOR','MAJOR'][Math.floor(Math.random()*3)],v:[5,15,50][Math.floor(Math.random()*3)]}:{t:'extra'}}
function tdc(td,lbl){return td?'<div class="tdc td"><b>TOUCH<br>DOWN!</b></div>':'<div class="tdc"><b>'+lbl+'</b></div>'}
function drillStart(b){var el=slotRoot(),ov=document.getElementById('slBonus');if(!ov){ov=document.createElement('div');ov.id='slBonus';ov.className='gg-drill';el.appendChild(ov)}
  var d0=(SL.pt&&SL.pt.drill&&SL.pt.drill.drives)||8;
  DR={b:b,i:-1,collected:0,drives:d0,done:false,timers:[],iv:null};
  ov.innerHTML='<div class="gg dr">'+
   '<div class="gg-top"><span></span><div class="gg-ttl">Gridiron Gold · bonus</div><button type="button" class="gg-ib" data-slmute="1" aria-label="Mute" id="drSnd">'+sndIcon()+'</button></div>'+
   '<div class="gg-cab free">'+
    '<div class="gg-marq">'+bulbs(17)+'<div class="gg-logo sm"><span>TWO-MINUTE</span><b>DRILL</b></div><div class="gg-tag">Score a touchdown · collect the board</div>'+bulbs(17)+'</div>'+
    '<div class="gg-jps">'+jpHtml(b.bet)+'</div>'+
    '<div class="dr-sb"><div><small>Drive</small><b class="num" id="drDrive">1 / '+d0+'</b></div><div><small>Collected</small><b class="num wn" id="drCol">0</b></div></div>'+
    '<div class="dr-field" id="drField"><div class="dr-grid">'+[0,1,2,3,4,5,6,7,8].map(function(i){return '<div class="dr-slot" data-dc="'+i+'">'+drCell(null,b.bet)+'</div>'}).join('')+'</div>'+
     '<div class="dr-play"><small>Play</small><div class="dr-td" id="drTd"><div class="dr-tds" id="drTds">'+tdc(false,'READY')+tdc(false,'HUT!')+tdc(false,'')+'</div></div></div></div>'+
    '<div class="gg-led" id="drMsg">First drive coming up</div>'+
    '<div class="dr-ctl" id="drCtl"><button type="button" class="gg-txt" data-drskip="1">Skip to the result</button></div>'+
   '</div></div>';
  var g=ov.querySelector('.dr-grid'),th=Math.round(g.clientHeight/3)||80;ov.querySelector('.dr-field').style.setProperty('--th',th+'px');
  var tds=document.getElementById('drTds');tds.style.transform='translate3d(0,0,0)';
  DR.timers.push(setTimeout(drillNext,1100))}
function drT(fn,ms){if(DR)DR.timers.push(setTimeout(fn,ms))}
function drSet(id,v){var e=document.getElementById(id);if(e)e.textContent=v}
function drMsg(t,cls){var m=document.getElementById('drMsg');if(m){m.innerHTML=t;m.className='gg-led'+(cls?' '+cls:'')}}
function drillNext(){if(!DR)return;DR.i++;var b=DR.b;if(DR.i>=b.frames.length){drillEnd();return}
  var f=b.frames[DR.i],slots=[].slice.call(document.querySelectorAll('.dr-slot'));
  drSet('drDrive',f.drive+' / '+DR.drives);drMsg('Drive '+f.drive+' · snap!');
  slots.forEach(function(s){s.classList.remove('land','got');s.classList.add('spin')});aPlay('dspin');
  clearInterval(DR.iv);DR.iv=setInterval(function(){slots.forEach(function(s){if(s.classList.contains('spin'))s.innerHTML=drCell(drFake(),b.bet)})},80);
  var k=0;function land(){if(!DR)return;if(k<9){var s=slots[k],c=f.cells[k];s.classList.remove('spin');s.innerHTML=drCell(c,b.bet);s.classList.add('land');
      if(c.t==='extra'){DR.drives=Math.min(20,DR.drives+1);drSet('drDrive',f.drive+' / '+DR.drives);aPlay('dextra')}else aPlay(c.t==='jp'?'djp':c.t==='val'?'dcoin':'dblank',k);
      k++;drT(land,95);return}
    clearInterval(DR.iv);DR.drives=f.drives;drSet('drDrive',f.drive+' / '+f.drives);
    var ex=f.cells.filter(function(c){return c.t==='extra'}).length;if(ex)drMsg('+'+ex+' extra drive'+(ex>1?'s':'')+'!','hot');
    drT(function(){drPlay(f)},ex?650:300)}
  drT(land,420)}
function drPlay(f){if(!DR)return;var tds=document.getElementById('drTds'),box=document.getElementById('drTd');if(!tds)return;var th=parseFloat(getComputedStyle(document.getElementById('drField')).getPropertyValue('--th'))||80;
  var n=14,h='',miss=function(){return TD_MISS[Math.floor(Math.random()*TD_MISS.length)]};
  for(var i=0;i<n;i++)h+=i===n-2?tdc(f.td,miss()):tdc(Math.random()<.25,miss());
  tds.innerHTML=h;box.classList.remove('yes','no');aPlay('drum');drMsg('Here\'s the play…');
  var end=-(n-3)*th;
  try{tds.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d(0,'+(end-th*.18)+'px,0)',offset:.86},{transform:'translate3d(0,'+end+'px,0)'}],{duration:900,easing:'cubic-bezier(.3,.1,.3,1)'})}catch(e){}
  tds.style.transform='translate3d(0,'+end+'px,0)';
  drT(function(){if(!DR)return;var b=DR.b;box.classList.add(f.td?'yes':'no');
    if(!f.td){aPlay('miss');drMsg('No score this drive','dim');drT(drillNext,1000);return}
    aPlay('td');drMsg('TOUCHDOWN!','hot');
    var slots=[].slice.call(document.querySelectorAll('.dr-slot')),hit=[];f.cells.forEach(function(c,i){if(c.v)hit.push(i)});
    if(!hit.length){drMsg('Touchdown! (empty board)','hot');drT(drillNext,1300);return}
    var j=0;function col(){if(!DR)return;if(j<hit.length){var i=hit[j],c=f.cells[i];slots[i].classList.add('got');DR.collected=Math.round((DR.collected+c.v*b.bet)*100)/100;drSet('drCol',gb(DR.collected));aPlay('collect',j);j++;drT(col,130);return}
      drMsg('TOUCHDOWN! +'+gb(f.got*b.bet),'hot');drT(drillNext,1500)}
    drT(col,600)},960)}
function drillEnd(){if(!DR)return;var b=DR.b;DR.done=true;clearInterval(DR.iv);DR.collected=b.total;drSet('drCol',gb(b.total));
  var tds=b.frames.filter(function(x){return x.td}).length;
  drMsg(b.total>0?'Drill over · '+tds+' touchdown'+(tds===1?'':'s'):'Drill over · no touchdowns',b.total>0?'hot':'dim');
  var c=document.getElementById('drCtl');if(c)c.innerHTML='<div class="dr-sum"><div><small>Drives</small><b class="num">'+b.frames.length+'</b></div><div><small>Touchdowns</small><b class="num">'+tds+'</b></div><div><small>Total</small><b class="num wn">'+gb(b.total)+'</b></div></div><button type="button" class="gg-sp-b" data-slcollect="1">Collect '+gb(b.total)+'</button>';
  if(b.total>=b.bet*10)drT(function(){ggBig(b.total,b.bet,null,{noCred:true})},500);else if(b.total>0)aPlay('win2')}
function drillSkip(){if(!DR||DR.done)return;DR.timers.forEach(clearTimeout);DR.timers=[];clearInterval(DR.iv);var b=DR.b,f=b.frames[b.frames.length-1];
  if(f){var slots=[].slice.call(document.querySelectorAll('.dr-slot'));slots.forEach(function(s,i){s.classList.remove('spin','land','got');s.innerHTML=drCell(f.cells[i],b.bet);if(f.td&&f.cells[i].v)s.classList.add('got')});
    drSet('drDrive',f.drive+' / '+f.drives);var tds=document.getElementById('drTds'),box=document.getElementById('drTd');if(tds){tds.getAnimations&&tds.getAnimations().forEach(function(a){a.cancel()});tds.style.transform='translate3d(0,0,0)';tds.innerHTML=tdc(false,'')+tdc(f.td,'FINAL')+tdc(false,'')}
    if(box){box.classList.remove('yes','no');box.classList.add(f.td?'yes':'no')}}
  drillEnd()}
function bonusClose(){if(DR){DR.timers.forEach(clearTimeout);clearInterval(DR.iv)}var ov=document.getElementById('slBonus');if(ov)ov.remove();var b=DR&&DR.b||SL.state&&SL.state.bonus;DR=null;
  if(SL.state)SL.state.bonus=null;
  api('/slots/bonus-seen',{method:'POST'}).catch(function(){});
  var total=b?b.total:0;SL.items=null;ggStopCycle();ggClearMarks();
  api('/slots/state').then(function(st){var fw=SL.state?SL.state.free_won:0;SL.state=st;if(st.free_left>0)st.free_won=st.free_won||fw;
    var target=st.balance;SL.cred=Math.round((target-total)*100)/100;ggMeters();
    if(total>0){ggMsg('Two-Minute Drill paid '+gb(total),'hot');ggRoll(total,1500,function(){SL.cred=target;ggMeters();if(st.free_left>0)ggNextFree()})}
    else{SL.cred=target;ggMeters();if(st.free_left>0)ggNextFree()}}).catch(function(){ggMeters()})}

/* ---------- paytable & rules ---------- */
function paytableSheet(){var pt=SL.pt;if(!pt)return;var bet=SL.bet,lb=bet/9,el=slotRoot(),ov=document.createElement('div'),par=pt.par||{};ov.className='gg-pt';
  var mini=function(ln,i){var h='';for(var r=0;r<3;r++)for(var c=0;c<5;c++)h+='<i'+(ln[c]===r?' style="background:'+GG_COL[i]+'"':'')+'></i>';return '<div class="gg-pl"><div class="plg">'+h+'</div><small>'+(i+1)+'</small></div>'};
  ov.innerHTML='<div class="gg-pt-in"><div class="gg-logo sm"><span>PAY</span><b>TABLE</b></div><p class="gg-pt-sub">Prizes shown at your bet of <b>'+bet+' Bucks</b> a spin (9 lines). Wins pay left to right; the best win on each line counts.</p>'+
   '<div class="pt-grid">'+['WILD','RING','TROPHY','STADIUM','PLAYBOOK','BALL','CAP'].map(function(s){var p=pt.pays[s];return '<div class="pt-c">'+gc(s)+'<div class="pt-v"><span><em>5</em>'+gb(p[2]*lb)+'</span><span><em>4</em>'+gb(p[1]*lb)+'</span><span><em>3</em>'+gb(p[0]*lb)+'</span></div><small>'+GG_N[s]+'</small></div>'}).join('')+'</div>'+
   '<div class="pt-sp">'+gc('WILD')+'<div><b>MH Wild</b><p>Reels 2, 3 and 4. Stands in for every picture except the ticket and the stopwatch. Five wilds in a row pays the top prize: '+gb(pt.pays.WILD[2]*lb)+'.</p></div></div>'+
   '<div class="pt-sp">'+gc('TICKET')+'<div><b>Free Spins</b><p>3, 4 or 5 tickets anywhere pay '+pt.ticket_pays.map(function(x){return gb(x*bet)}).join(' / ')+' and start '+pt.free_spins+' free spins at your bet. Every free-spin win pays ×'+pt.free_mult+'. 3 more tickets add 10 more.</p></div></div>'+
   '<div class="pt-sp">'+gc('DRAFT')+'<div><b>Two-Minute Drill</b><p>A stopwatch on reels 1, 2 and 3 starts the bonus: '+pt.drill.drives+' drives on a 3×3 board. Each drive the squares spin to Bucks, jackpot coins (GRAND '+gb(250*bet)+' · MAJOR '+gb(50*bet)+' · MINOR '+gb(15*bet)+' · MINI '+gb(5*bet)+'), +1 DRIVE (up to '+pt.drill.max+') or nothing. When the play reel lands TOUCHDOWN you collect everything on the board.</p></div></div>'+
   '<div class="pt-h">The 9 paylines</div><div class="pt-lines">'+pt.lines.map(mini).join('')+'</div>'+
   '<div class="pt-h">The math (par sheet)</div><div class="pt-par">'+
    [['Payback',(par.rtp?(par.rtp*100).toFixed(1):'92.5')+'%','Theoretical, over the long run. That\'s the Las Vegas Strip average (Nevada\'s legal minimum is 75%).'],
     ['Hit frequency','1 in '+(par.hit?(1/par.hit).toFixed(1):'2.8'),'How often a spin pays something (many pay less than the bet, like a real slot).'],
     ['Free Spins','1 in '+(par.free_odds||158),'Spins, on average, between free-spin features.'],
     ['Two-Minute Drill','1 in '+(par.bonus_odds||187),'Averages about '+(par.drill_avg||31)+'× your bet.'],
     ['Every spin','Independent','A random stop on each reel from the server\'s secure random number generator. The game has no memory: it\'s never "due", and a loss doesn\'t make a win more likely.']]
    .map(function(r){return '<div class="gg-pp"><b>'+r[0]+'</b><span class="num">'+r[1]+'</span><p>'+r[2]+'</p></div>'}).join('')+'</div>'+
   '<p class="gg-pt-sub">Spins come out of your Mahomie Bucks. Going broke still means you\'re done for the season.</p>'+
   '<button type="button" class="gg-sp-b" data-slptx="1">Back to the game</button></div>';
  el.appendChild(ov);aPlay('click')}

/* ---------- controls ---------- */
function ggPop(id,show){[].forEach.call(document.querySelectorAll('#slot .gg-pop'),function(p){p.hidden=p.id===id?(show==null?!p.hidden:!show):true})}
document.addEventListener('click',function(e){
  var t=e.target;
  if(t.closest&&t.closest('[data-egg]')){if(S.tab==='book')openSlot();return}
  if(!SL.open)return;
  if(!(t.closest&&t.closest('.gg-pop,[data-slsnd],[data-slauto]')))ggPop(null,false);
  var b=t.closest&&t.closest('button');if(!b)return;var d=b.dataset;
  if(d.slx){closeSlot();return}
  if(d.slbet){var bets=(SL.pt&&SL.pt.bets)||[10,25,50],i=bets.indexOf(SL.bet)+(+d.slbet);if(i>=0&&i<bets.length&&!SL.spinning&&!(SL.state&&SL.state.free_left>0)){SL.bet=bets[i];aPlay('click');ggMeters()}return}
  if(d.slspin){slotSpin();return}
  if(d.slsnd){aInit();ggPop('ggSnd');return}
  if(d.slmute){aInit();GGA.on=!(GGA.on&&GGA.vol>0);if(GGA.on&&GGA.vol<=0)GGA.vol=.7;aSet();ggSndUi();if(GGA.on)aPlay('click');return}
  if(d.slauto){if(SL.auto>0){SL.auto=0;ggMeters();return}ggPop('ggAutoPop');return}
  if(d.slauton){ggPop(null,false);SL.auto=+d.slauton;aPlay('click');ggMeters();if(!SL.spinning&&!SL.roll)slotSpin();return}
  if(d.drskip){drillSkip();return}
  if(d.slcollect){aPlay('click');bonusClose();return}
  if(d.slpt){paytableSheet();return}
  if(d.slptx){var p=document.querySelector('.gg-pt');if(p)p.remove();aPlay('click');return}
});
function ggSndUi(){var v=Math.round((GGA.on?GGA.vol:0)*100);[].forEach.call(document.querySelectorAll('#ggSndBtn,[data-slmute]'),function(x){x.innerHTML=sndIcon()});var r=document.getElementById('ggVol'),n=document.getElementById('ggVolN');if(r)r.value=v;if(n)n.textContent=v}
document.addEventListener('input',function(e){if(e.target&&e.target.id==='ggVol'){GGA.vol=(+e.target.value)/100;GGA.on=GGA.vol>0;aSet();var n=document.getElementById('ggVolN');if(n)n.textContent=e.target.value;[].forEach.call(document.querySelectorAll('#ggSndBtn,[data-slmute]'),function(x){x.innerHTML=sndIcon()})}});
document.addEventListener('change',function(e){if(e.target&&e.target.id==='ggVol')aPlay('win1')});
document.addEventListener('keydown',function(e){if(!SL.open||e.code!=='Space'||document.getElementById('slBonus')||document.querySelector('.gg-pt,.gg-splash,.gg-big'))return;e.preventDefault();slotSpin()});
window.addEventListener('resize',function(){if(SL.open&&!SL.spinning)ggBind()});
if(location.port==='3999')window.__GG={SL:SL,big:ggBig,splash:ggSplash}; // local test hook only
