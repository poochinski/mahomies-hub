/* ---------- HOW IT WORKS (plain-English explanations, v1.8) ---------- */
var EXPLAIN={
 data:{t:'Where the data comes from',b:[
  ['Sleeper','Every score, lineup, matchup, trade and draft pick comes straight from Sleeper for all four seasons (2023–2026). The app rebuilds its stats from Sleeper every 3 minutes, so nothing is typed in by hand.'],
  ['Live NFL games','Kickoff times and game clocks come from ESPN\'s public scoreboard. The Sportsbook uses them to know when a matchup goes live and how much of each lineup is left to play.'],
  ['Former managers','Anyone who left the league stays in every record and table, tagged "Former", so history never changes.'],
  ['Your bets','Logins, Mahomie Bucks and bets are stored in the app\'s own database. Every Buck that moves is written to a ledger, so balances can always be traced.']]},
 standings:{t:'Standings',b:[
  ['W-L','Your record, including the league-median game: each week you also get a win if you scored more than half the league, and a loss if not.'],
  ['PF','Points for: everything your starters scored this season.'],
  ['All-play','Your record if you played all 11 other teams every week. Beat 9 of them in a week = 9-2 for that week. It shows how good your scores really were, no matter who you drew.'],
  ['Luck','Actual head-to-head wins minus the wins your all-play rate says you "should" have. +1.5 = 1.5 more wins than your scores earned (soft schedule). −2.0 = 2 fewer (you kept running into big weeks).'],
  ['Playoff line','The dashed line is the cut: the top 6 make the playoffs. Ties in record are broken by points for.']]},
 power:{t:'Power rankings',b:[
  ['The score (0–100)','For each of four stats, the app checks what share of the other 11 teams you\'re ahead of (all 11 = 100%, none = 0%), then blends them: points per game 35%, all-play record 25%, last 3 weeks 20%, win % 20%.'],
  ['Reading it','100 = best in the league at all four. 50 = right in the middle. 0 = last at everything.'],
  ['Why record isn\'t everything','Scoring counts for most of the score, so a 2-3 team that puts up big numbers can rank above a lucky 4-1 team.'],
  ['Arrow','How many spots you moved since last week.']]},
 odds:{t:'Playoff odds',b:[
  ['Simulations','The app plays out the rest of the regular season 5,000 times with the real remaining schedule.'],
  ['Each team\'s score','Every simulated week, each team scores its projection plus random swing. The projection is 45% last 3 weeks, 35% season average, 20% last season. The swing is how much that team\'s score usually bounces week to week.'],
  ['Wins','Head-to-head games plus the league-median game (beat half the league = a win).'],
  ['The columns','Playoffs = share of simulations you finished top 6. Bye = top 2. #1 = first seed. Last = last place. Proj W = average final win total. Ties are broken by points for.']]},
 awards:{t:'How awards are picked',b:[
  ['🏆 Champion / 🚽 Sacko','From the playoff and Toilet Bowl brackets in Sleeper.'],
  ['👑 Points King','Most regular-season points.'],
  ['🔥 On Fire / 🧊 Ice Cold','Most weeks as the league\'s top scorer / lowest scorer.'],
  ['🍀 Horseshoe / 🐍 Snakebitten','Luckiest / unluckiest team: actual wins minus the wins their scores earned (see Standings → Luck).'],
  ['🥊 Punching Bag','Most points scored against.'],
  ['💥 Monster Week · 🔨 Bully · 💔 Heartbreaker','Highest single score, biggest blowout win, and closest loss of the season.'],
  ['During the season','Awards update every week and show the current leader until the season ends.']]},
 records:{t:'Record book',b:[
  ['What counts','Every game in league history (2023 on), pulled from Sleeper. Filter to regular season or playoffs with the switch.'],
  ['Scores','A team\'s score is its starters\' total. Bench points never count.'],
  ['Best player game','The most points one player scored as a starter in a single week.'],
  ['Streaks','Most wins (or losses) in a row in regular-season head-to-head games. Streaks carry over from one season to the next.'],
  ['Playoff byes','Byes have no opponent, so a bye-week score shows as a "Playoff bye" card.']]},
 alltime:{t:'All-time table',b:[
  ['Seasons','Regular-season games from every season on Sleeper.'],
  ['W-L, Win%, PPG','Head-to-head record, win rate and points per game across all seasons.'],
  ['🏆 / Playoffs','Titles won, and how many times you made the playoffs.'],
  ['🔥 / 🧊','How many weeks you were the league\'s top scorer / lowest scorer.']]},
 h2h:{t:'Rivals',b:[
  ['Rivalry card','Every game two teams have played each other, regular season and playoffs, with the series record and points.'],
  ['Grid','Each square is the row team\'s record against the column team. Tap a square to open that rivalry.']]},
 preview:{t:'Matchup preview',b:[
  ['Projection','45% of a team\'s last 3 weeks, 35% its season average and 20% last season, pulled toward the league average (harder through Week 6).'],
  ['Win chance','The gap between the two projections compared with how much both teams swing week to week, on a bell curve. A 10-point gap between two steady teams means more than the same gap between two boom-or-bust teams.'],
  ['Line','The same numbers the Sportsbook uses. Spreads max out at 20 before kickoff.']]},
 bench:{t:'Bench Shame',b:[
  ['What it measures','For every week, the app builds the best lineup you could have started from your roster (same lineup slots as the league) and compares it with what you actually scored.'],
  ['The number','Points left on the bench across the season. Higher = more shame. Your worst week is shown too.'],
  ['Eligibility','FLEX can take an RB, WR or TE. Every player is used at most once.']]},
 trades:{t:'Trade grader',b:[
  ['How it grades','For every completed trade, it adds up the points each player scored in his new team\'s starting lineup from the trade week on. Bench points don\'t count.'],
  ['Winner','If one side got more than 15% more starter points, that side wins. Closer than that = even.'],
  ['Limits','Draft picks are listed but given no value, and a player stops counting if he\'s later dropped or traded away. It judges with hindsight, not whether the trade made sense at the time.']]},
 draft:{t:'Draft re-grade',b:[
  ['How it works','Every drafted player (no kickers or defenses) is ranked by the points he has scored on league rosters this season. That rank is compared with where he was picked.'],
  ['Steals','Players who have outscored their draft spot the most (late picks playing like early ones).'],
  ['Busts','Early picks whose points rank is furthest below where they went.']]},
 book:{t:'How the odds work',b:[
  ['Pregame lines','Posted Tuesday 6 AM from each team\'s projection (45% last 3 weeks, 35% season average, 20% last season). The spread is the projected margin, capped at 20. The total is both projections added. Both pay -110. The moneyline comes from the win chance plus a 4.5% house edge.'],
  ['Live odds','Once the first player in a matchup kicks off, the odds go live: expected final = points so far + projection × share of each lineup still to play (from NFL game clocks, weighted by position). The further ahead a team gets, the worse its price.'],
  ['Off the board','If a moneyline would be shorter than -1000 (nearly a sure thing), it comes off the board. Spreads and totals stay open.'],
  ['Odds moved','Live prices refresh every 30–60 seconds. If the price gets worse between when you see it and when you tap Place bet, the app shows you the new price first.'],
  ['Settling','Wednesday 3 AM, after Sleeper\'s stat corrections. Exact ties on a spread or total push (stake back).']]}
};
var EXPLAIN_ORDER=['data','standings','power','odds','awards','records','alltime','h2h','preview','book','bench','trades','draft'];
function info(k){return '<button type="button" class="info" data-info="'+k+'" aria-label="How '+esc(EXPLAIN[k].t)+' works">ⓘ How it works</button>'}
function explainSheet(k){var x=EXPLAIN[k];if(!x)return '';
  return '<div class="ph" style="margin:0"><div><div class="kicker">How it works</div><h2>'+esc(x.t)+'</h2></div></div><div class="rows">'+
   x.b.map(function(r){return '<div class="row" style="grid-template-columns:1fr"><div><b style="font-size:14px">'+esc(r[0])+'</b><p class="muted" style="font-size:13px;line-height:1.55;margin-top:3px">'+esc(r[1])+'</p></div></div>'}).join('')+'</div>'}
function explainPanel(){return '<section class="panel"><div class="ph"><div><div class="kicker">Plain English</div><h2>How the app works</h2></div></div><div class="rows">'+
  EXPLAIN_ORDER.map(function(k){return '<button type="button" class="row" data-info="'+k+'" style="grid-template-columns:minmax(0,1fr) 10px"><b style="font-size:14px;text-align:left">'+esc(EXPLAIN[k].t)+'</b>'+CHEV+'</button>'}).join('')+'</div></section>'}
