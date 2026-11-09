import assert from 'node:assert/strict';
import { test } from 'node:test';
import { teamTotals, usageRow, usageNotes } from '../server/stats/usage.js';

// Seattle's Week 9 backfield (Jayson, 2026-11-09): Charbonnet 38 snaps / 16 carries, Price 24 snaps / 4 targets.
const players = { 1: { n: 'Zach Charbonnet', p: 'RB', t: 'SEA' }, 2: { n: 'Jadarian Price', p: 'RB', t: 'SEA' }, 3: { n: 'Jaxon Smith-Njigba', p: 'WR', t: 'SEA' }, 9: { n: 'Other', p: 'WR', t: 'ARI' } };
const wst = {
  1: { off_snp: 38, tm_off_snp: 67, rush_att: 16, rush_yd: 77, rec_tgt: 2, rec: 1, rec_yd: 9, rush_rz_att: 3 },
  2: { off_snp: 24, tm_off_snp: 67, rush_att: 9, rush_yd: 24, rec_tgt: 4, rec: 4, rec_yd: 54, rec_air_yd: 6 },
  3: { off_snp: 60, tm_off_snp: 67, rec_tgt: 22, rec: 12, rec_yd: 140, rec_air_yd: 190, rec_rz_tgt: 2 },
  9: { off_snp: 50, tm_off_snp: 55, rec_tgt: 9 },
  SEA: { pts_allow: 17 }
};

test('team totals add up targets, carries and air yards, and know the leaders', () => {
  const T = teamTotals(wst, players);
  assert.equal(T.SEA.tgt, 28);
  assert.equal(T.SEA.att, 25);
  assert.equal(T.SEA.air, 196);
  assert.equal(T.SEA.snaps, 67);
  assert.deepEqual(T.SEA.lead.tgt.pids, ['3']);
  assert.deepEqual(T.SEA.lead.rb_att.pids, ['1']);
  assert.equal(T.ARI.tgt, 9);
});

test('a usage row has the shares and the notes read like a scouting line', () => {
  const T = teamTotals(wst, players).SEA;
  const r = usageRow('1', wst[1], T, { w: 9, opp: 'ARI', team: 'SEA' });
  assert.equal(r.snap_pct, 57);
  assert.equal(r.att_share, 64);
  assert.equal(r.tgt_share, 7);
  assert.equal(r.lead_rb_att, true);
  const notes = usageNotes('RB', r, []);
  assert.equal(notes[0], "Played 38 of SEA's 67 offensive snaps (57%).");
  assert.ok(notes.includes("Carried 16 times (64% of SEA's runs), the most among the backs."));
  assert.ok(notes.includes('3 red-zone chances (3 carries).'));

  const wr = usageRow('3', wst[3], T, { w: 9, team: 'SEA' });
  const wn = usageNotes('WR', wr, []);
  assert.ok(wn.includes("Drew 22 targets (79% of SEA's), the most on the team."));
  assert.ok(wn.includes("190 air yards (97% of the team's)."));
});

test('notes compare a week with the weeks before it', () => {
  const T = teamTotals(wst, players).SEA;
  const r = usageRow('2', wst[2], T, { w: 9, team: 'SEA' });
  const prev = [{ snaps: 10, snap_pct: 15, tgt: 1, att: 3 }, { snaps: 14, snap_pct: 21, tgt: 2, att: 5 }];
  const n = usageNotes('RB', r, prev);
  assert.equal(n[0], "Played 24 of SEA's 67 offensive snaps (36%), up from his 18% average before this week.");
  assert.ok(n.includes('Season high in snaps, targets and carries.'));
  assert.deepEqual(usageNotes('RB', usageRow('2', {}, T, { team: 'SEA' }), prev), ["Didn't play an offensive snap."]);
});
