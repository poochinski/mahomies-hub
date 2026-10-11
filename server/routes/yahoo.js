// Yahoo history import: the /yahoo page (commish only for anything that changes things)
// plus read-only /api/yahoo/* views used to check what was saved.
import { Router } from 'express';
import { pool } from '../db.js';
import { COMMISH_USER_ID } from '../config.js';
import * as book from '../book/book.js';
import * as y from '../yahoo.js';

const router = Router();

const wrap = (fn) => async (req, res) => {
  try { res.json(await fn(req, res)); }
  catch (e) { const s = e.status || 400; if (s >= 500) console.error('[yahoo]', e); res.status(s).json({ error: e.message }); }
};
async function commish(req) {
  if (!pool) throw Object.assign(new Error('Database not connected'), { status: 503 });
  if (!book.isReady()) await book.initBook();
  const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const u = tok ? await book.userFromToken(tok) : null;
  if (!u) throw Object.assign(new Error('Log in to the Book as the commish first (Me tab), then come back.'), { status: 401 });
  if (u !== COMMISH_USER_ID) throw Object.assign(new Error('Commish only'), { status: 403 });
  return u;
}

router.use('/api/yahoo', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/api/yahoo/status', wrap(async (req) => { await commish(req); return y.status(); }));
router.get('/api/yahoo/raw-list', wrap(async (req) => { await commish(req); return y.rawList(req.query.league ? String(req.query.league) : null); }));
router.get('/api/yahoo/raw', wrap(async (req) => { await commish(req); return (await y.raw(String(req.query.path || ''), req.query.norm === '1')) || { error: 'Not saved' }; }));
router.post('/api/yahoo/creds', wrap(async (req) => { await commish(req); await y.saveCreds(req.body?.id, req.body?.secret); return { ok: true }; }));
router.post('/api/yahoo/start', wrap(async (req) => { await commish(req); return { url: await y.authUrl() }; }));
router.post('/api/yahoo/find', wrap(async (req) => { await commish(req); return { leagues: await y.findLeagues() }; }));
router.post('/api/yahoo/import', wrap(async (req) => { await commish(req); await y.startImport(String(req.body?.league_key || '')); return y.importStatus(); }));

router.get('/yahoo/callback', async (req, res) => {
  try {
    if (req.query.error) throw new Error(String(req.query.error_description || req.query.error));
    await y.finishAuth(String(req.query.code || ''), String(req.query.state || ''));
    res.redirect('/yahoo?connected=1');
  } catch (e) {
    res.redirect('/yahoo?err=' + encodeURIComponent(e.message));
  }
});

router.get('/yahoo', (_req, res) => { res.set('Cache-Control', 'no-store').type('html').send(PAGE); });

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yahoo history · Mahomie's Hub</title>
<style>
:root{--bg:#130f1d;--card:#1d1729;--line:#2e2640;--ink:#f3eefc;--dim:#a99fbd;--gold:#f5c542;--green:#46d68c;--red:#ff6b6b;--purple:#7c4dff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;padding:16px;max-width:560px;margin:auto}
h1{font-size:22px;margin:8px 0 4px}p{margin:6px 0}.dim{color:var(--dim);font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin:12px 0}
.k{font:600 11px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
.ok{color:var(--green);font-weight:700}.bad{color:var(--red)}
button{background:var(--purple);color:#fff;border:0;border-radius:10px;padding:11px 14px;font:600 15px system-ui;width:100%;margin-top:8px}
button.sm{width:auto;padding:7px 12px;font-size:13px;margin:0}button:disabled{opacity:.5}
input{width:100%;background:#0e0b16;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:10px;font:14px ui-monospace,monospace;margin-top:6px}
code{background:#0e0b16;border:1px solid var(--line);border-radius:6px;padding:2px 6px;font-size:12px;word-break:break-all}
ol{padding-left:20px;margin:6px 0}li{margin:4px 0}
.row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.row:first-child{border-top:0}.row .g{flex:1}
.bar{height:8px;background:#0e0b16;border-radius:5px;overflow:hidden;margin-top:8px}.bar i{display:block;height:100%;background:var(--gold)}
a{color:var(--gold)}
</style></head><body>
<a href="/" class="dim">‹ Back to the Hub</a>
<h1>Bring in the Yahoo years</h1>
<p class="dim">One-time import of the seasons played on Yahoo. Read-only: nothing on Yahoo changes.</p>
<div id="msg"></div><div id="app"><div class="card">Loading…</div></div>
<script>
var A=null;try{A=JSON.parse(localStorage.getItem('mh-auth'))}catch(e){}
var ST=null,BUSY=false,q=new URLSearchParams(location.search);
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function call(p,b){return fetch('/api/yahoo/'+p,{method:b?'POST':'GET',headers:Object.assign({'content-type':'application/json'},A&&A.token?{authorization:'Bearer '+A.token}:{}),body:b?JSON.stringify(b):undefined}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||r.status);return j})})}
function say(t,bad){document.getElementById('msg').innerHTML=t?'<div class="card '+(bad?'bad':'ok')+'">'+esc(t)+'</div>':''}
if(q.get('err'))say(q.get('err'),true);else if(q.get('connected'))say('Yahoo connected ✓');
function load(){call('status').then(function(s){ST=s;draw();if(s.import&&s.import.running)setTimeout(load,3000)}).catch(function(e){say(e.message,true)})}
function draw(){var s=ST,h='';
 if(!A||!A.token)h+='<div class="card bad">Log in to the Book as the commish first (Me tab → Log in), then come back to this page.</div>';
 h+='<div class="card"><div class="k">Step 1 · Yahoo app keys</div>';
 if(s.has_keys)h+='<p class="ok">Keys saved ✓</p><p class="dim">Need to change them? Paste new ones below.</p>';
 else h+='<ol><li>Open <a href="https://developer.yahoo.com/apps/create/" target="_blank">developer.yahoo.com/apps/create</a> and sign in with your Yahoo account.</li><li>Application Name: <b>Mahomies Hub</b> (anything works).</li><li>Homepage URL: <code>https://mahomies-hub-production.up.railway.app</code></li><li>Redirect URI: <code>'+esc(s.redirect_uri)+'</code></li><li>OAuth Client Type: <b>Confidential Client</b>.</li><li>API Permissions: tick <b>Fantasy Sports → Read</b>. Then Create App.</li><li>Copy the <b>Client ID</b> and <b>Client Secret</b> it shows into the boxes below.</li></ol>';
 h+='<input id="cid" placeholder="Client ID" autocomplete="off"><input id="csec" placeholder="Client Secret" autocomplete="off"><button onclick="saveKeys()">Save keys</button></div>';
 h+='<div class="card"><div class="k">Step 2 · Connect Yahoo</div>';
 h+=s.connected?'<p class="ok">Connected ✓</p><button class="sm" onclick="connect()">Reconnect</button>':'<p class="dim">Takes you to Yahoo to approve read-only access, then brings you back here.</p><button onclick="connect()" '+(s.has_keys?'':'disabled')+'>Connect Yahoo</button>';
 h+='</div><div class="card"><div class="k">Step 3 · Pick the seasons</div>';
 if(!s.leagues.length)h+='<p class="dim">Finds every Yahoo football league on your account.</p>';
 s.leagues.forEach(function(l){var d=s.imported[l.league_key];h+='<div class="row"><div class="g"><b>'+esc(l.season)+'</b> · '+esc(l.name)+'<div class="dim">'+(l.teams||'?')+' teams'+(d?' · <span class="ok">imported ✓</span>'+(d.errors?' ('+d.errors+' gaps)':''):'')+'</div></div><button class="sm" onclick="imp(\\''+l.league_key+'\\')" '+(s.import.running?'disabled':'')+'>'+(d?'Redo':'Import')+'</button></div>'});
 h+='<button onclick="find()" '+(s.connected?'':'disabled')+'>'+(s.leagues.length?'Look again':'Find my Yahoo leagues')+'</button></div>';
 var im=s.import;if(im&&(im.running||im.finished_at)){var pc=im.total?Math.round(100*im.done/im.total):0;
  h+='<div class="card"><div class="k">'+(im.running?'Importing…':'Last import')+'</div><p>'+esc(im.step)+' · '+im.done+' / '+im.total+'</p><div class="bar"><i style="width:'+pc+'%"></i></div>'+(im.errors.length?'<p class="dim">'+im.errors.length+(im.errors.length>1?' pieces':' piece')+' Yahoo didn\\'t send (fine if it\\'s a few).</p>':'')+(im.running?'<p class="dim">You can leave this page; it keeps going.</p>':'')+'</div>'}
 document.getElementById('app').innerHTML=h}
function go(p,b,ok){if(BUSY)return;BUSY=true;say('');call(p,b).then(function(j){BUSY=false;if(ok)ok(j);load()}).catch(function(e){BUSY=false;say(e.message,true)})}
function saveKeys(){go('creds',{id:document.getElementById('cid').value,secret:document.getElementById('csec').value},function(){say('Keys saved ✓')})}
function connect(){go('start',{},function(j){location.href=j.url})}
function find(){go('find',{},function(j){say(j.leagues.length?'Found '+j.leagues.length+' Yahoo leagues':'No Yahoo football leagues found on this account',!j.leagues.length)})}
function imp(k){go('import',{league_key:k})}
load();
</script></body></html>`;

export default router;

