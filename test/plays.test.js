import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize, playerGameLog, shortName } from '../server/stats/plays.js';

const ath = (id) => ({ $ref: `http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/athletes/${id}?lang=en` });
const play = (o) => normalize({
  id: o.id, sequenceNumber: String(o.seq), type: { text: o.type }, text: o.text || '', period: { number: o.q || 4 }, clock: { displayValue: o.clock || '2:35' },
  awayScore: o.a ?? 22, homeScore: o.h ?? 34, scoringPlay: !!o.scoring, scoringType: o.scoring ? { abbreviation: 'TD' } : undefined,
  statYardage: o.yds || 0, isTurnover: !!o.to, start: { downDistanceText: o.dd || '', distance: o.dist || 10 }, end: {},
  participants: (o.parts || []).map(([id, type]) => ({ athlete: ath(id), type }))
});
const SC = { rush_yd: 0.1, rush_td: 6, rec: 1, rec_yd: 0.1, rec_td: 6, rush_40p: 2, fum_lost: -2, pass_yd: 0.04, pass_td: 4, pass_int: -1, xpm: 1, fgm_40_49: 4, fgm: 0 };
const me = { espn: '4569987', abbr: 'J.Warren', pos: 'RB', nfl: 'PIT' };
const g = { home: 'PIT', teams: ['IND', 'PIT'] };

test('one player\'s plays: points per play, running stat line, TD flag', () => {
  const plays = [
    play({ id: 1, seq: 10, type: 'Rush', yds: 50, dd: '1st & 10 at PIT 20', parts: [['4569987', 'rusher']] }),
    play({ id: 2, seq: 20, type: 'Pass Reception', yds: 12, parts: [['111', 'passer'], ['4569987', 'receiver']] }),
    play({ id: 3, seq: 30, type: 'Rush', yds: 0, dd: '3rd & 7 at IND 36', parts: [['4569987', 'rusher']] }),
    play({ id: 4, seq: 40, type: 'Rushing Touchdown', yds: 4, scoring: true, parts: [['4569987', 'rusher']] }),
    play({ id: 5, seq: 50, type: 'Rush', yds: 6, parts: [['999', 'rusher']] }), // somebody else
    play({ id: 6, seq: 60, type: 'Pass Incompletion', parts: [['111', 'passer'], ['4569987', 'receiver']] })
  ];
  const { plays: out, total } = playerGameLog(plays, me, g, SC);
  assert.equal(out.length, 5);
  assert.equal(out[0].what, '50 yd rush');
  assert.equal(out[0].pts, 7); // 5.0 yards + 2 for the 40+ run
  assert.equal(out[0].dd, '1st & 10 @ PIT 20');
  assert.equal(out[1].pts, 2.2);
  assert.equal(out[2].what, 'stopped for no gain');
  assert.equal(out[2].pts, 0);
  assert.equal(out[3].td, true);
  assert.equal(out[3].pts, 6.4);
  assert.equal(out[4].what, 'targeted, incomplete');
  assert.equal(total, 15.6);
  assert.equal(out[3].line, '3 CAR, 54 YD, 1 TD, 1/1 REC, 12 YD');
  assert.deepEqual(out[0].score, { away: 'IND', home: 'PIT', a: 22, h: 34 });
});

test('kicker gets field goals by distance and extra points off the TD text', () => {
  const k = { espn: '777', abbr: 'C.Boswell', pos: 'K', nfl: 'PIT' };
  const plays = [
    play({ id: 1, seq: 1, type: 'Field Goal Good', text: 'C.Boswell 44 yard field goal is GOOD', scoring: false, parts: [['777', 'kicker']] }),
    play({ id: 2, seq: 2, type: 'Rushing Touchdown', scoring: true, yds: 3, text: 'J.Warren 3 yd run (C.Boswell kick)', parts: [['4569987', 'rusher']] })
  ];
  const { plays: out } = playerGameLog(plays, k, g, SC);
  assert.equal(out.length, 2);
  assert.equal(out[0].what, '44 yd field goal good');
  assert.equal(out[0].pts, 4);
  assert.equal(out[1].what, 'Extra point good');
  assert.equal(out[1].pts, 1);
});

test('shortName matches ESPN play text', () => {
  assert.equal(shortName('Jaylen Warren'), 'J.Warren');
  assert.equal(shortName('Marvin Harrison Jr.'), 'M.Harrison');
});

test('finds the ESPN id from the play text when Sleeper has none', () => {
  const plays = [
    play({ id: 1, seq: 1, type: 'Rush', yds: 16, text: 'J.Smith-Njigba right end to SF 31 for 16 yards (J.Brown).', parts: [['4430878', 'rusher'], ['46', 'tackler']] }),
    play({ id: 2, seq: 2, type: 'Pass Reception', yds: 4, text: '(Shotgun) S.Darnold pass short right to J.Smith-Njigba to SEA 48 for 4 yards (J.Dugger).', parts: [['39', 'passer'], ['4430878', 'receiver'], ['50', 'tackler']] }),
    play({ id: 3, seq: 3, type: 'Pass Reception', yds: 9, text: 'S.Darnold pass short left to G.Holani to SF 25 for 9 yards.', parts: [['39', 'passer'], ['44', 'receiver']] }),
    play({ id: 4, seq: 4, type: 'Pass Incompletion', text: 'S.Darnold pass incomplete deep left to C.Kupp.', parts: [['39', 'passer'], ['45', 'receiver']] })
  ];
  const { plays: out } = playerGameLog(plays, { espn: '', abbr: 'J.Smith-Njigba', pos: 'WR', nfl: 'SEA' }, { home: 'SEA', teams: ['SEA', 'SF'] }, SC);
  assert.equal(out.length, 2);
  assert.equal(out[0].what, '16 yd rush');
  assert.equal(out[1].what, '4 yd catch');
});
