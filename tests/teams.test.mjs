import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignTeams,
  computeTeamStandings,
  getWinningTeams,
} from '../src/lib/teams.ts';

const players = (...rows) => rows.map(([uid, score, teamId]) => ({ uid, name: uid, score, teamId }));

test('チーム分け: 人数差は最大1で、全員いずれかのチームに入る', () => {
  const list = players(['a', 0], ['b', 0], ['c', 0], ['d', 0], ['e', 0]);
  for (const mode of ['balanced', 'random']) {
    const assigned = assignTeams({ players: list, teamCount: 2, mode, rng: () => 0.42 });
    assert.equal(Object.keys(assigned).length, 5);
    const sizes = [0, 1].map((t) => Object.values(assigned).filter((v) => v === t).length);
    assert.ok(Math.abs(sizes[0] - sizes[1]) <= 1, `${mode}: ${sizes}`);
  }
});

test('チーム分け: バランスは高スコア者を蛇行で分ける', () => {
  const list = players(['p1', 40], ['p2', 30], ['p3', 20], ['p4', 10]);
  const assigned = assignTeams({ players: list, teamCount: 2, mode: 'balanced' });
  // 強い順 p1,p2,p3,p4 → A,B,B,A で両チームとも合計50になる
  assert.deepEqual(assigned, { p1: 0, p2: 1, p3: 1, p4: 0 });
});

test('チーム分け: ランダムは rng が固定なら決定的', () => {
  const list = players(['a', 0], ['b', 0], ['c', 0], ['d', 0]);
  const one = assignTeams({ players: list, teamCount: 2, mode: 'random', rng: () => 0 });
  const two = assignTeams({ players: list, teamCount: 2, mode: 'random', rng: () => 0 });
  assert.deepEqual(one, two);
});

test('チーム分け: 手動は既存の所属を保ち、未所属を人数の少ない方へ入れる', () => {
  const list = players(['a', 0, 1], ['b', 0, 1], ['c', 0], ['d', 0, 9]);
  const assigned = assignTeams({ players: list, teamCount: 2, mode: 'manual' });
  assert.equal(assigned.a, 1);
  assert.equal(assigned.b, 1);
  assert.equal(assigned.c, 0);
  // d の不正な teamId は未所属扱いで、少ない方（この時点では同数のため若い番号）へ
  assert.equal(assigned.d, 0);
});

const HISTORY = {
  0: { roundIndex: 0, results: { a: { rank: 1, gained: 3 }, c: { rank: 2, gained: 2 } } },
  1: { roundIndex: 1, results: { b: { rank: 1, gained: 3 }, c: { rank: 2, gained: 2 } } },
  2: { roundIndex: 2, results: { c: { rank: 1, gained: 3 } } },
};

test('集計: 合計点・1位数・正解数・平均点をチームごとに数える', () => {
  const list = players(['a', 10, 0], ['b', 1, 0], ['c', 20, 1], ['d', 0, 1]);
  const { standings, unassigned } = computeTeamStandings({
    players: list,
    teamCount: 2,
    winCondition: 'totalScore',
    history: HISTORY,
  });
  assert.equal(unassigned.length, 0);
  const teamA = standings.find((s) => s.teamId === 0);
  const teamB = standings.find((s) => s.teamId === 1);
  assert.equal(teamA.totalScore, 11);
  assert.equal(teamB.totalScore, 20);
  assert.equal(teamA.firstPlaceCount, 2); // a と b が各1回
  assert.equal(teamB.firstPlaceCount, 1); // c が1回
  assert.equal(teamA.correctCount, 2);
  assert.equal(teamB.correctCount, 3); // c が3回
  assert.equal(teamB.averageScore, 10);
  assert.equal(standings[0].teamId, 1); // 合計点ではBが先頭
});

test('集計: 勝利条件を変えると勝者が変わり、同値は引き分けになる', () => {
  const list = players(['a', 10, 0], ['b', 1, 0], ['c', 20, 1], ['d', 0, 1]);
  const byFirsts = computeTeamStandings({
    players: list,
    teamCount: 2,
    winCondition: 'firstPlaceCount',
    history: HISTORY,
  }).standings;
  assert.equal(getWinningTeams(byFirsts)[0].teamId, 0); // 1位数はA(2) > B(1)

  const drawn = computeTeamStandings({
    players: players(['a', 5, 0], ['b', 5, 1]),
    teamCount: 2,
    winCondition: 'totalScore',
    history: {},
  }).standings;
  assert.equal(getWinningTeams(drawn).length, 2); // 合計が同点なら引き分け
});

test('集計: matchStartIndex より前のラウンドは数えない（再戦前の履歴を混ぜない）', () => {
  const list = players(['a', 0, 0], ['c', 0, 1]);
  const { standings } = computeTeamStandings({
    players: list,
    teamCount: 2,
    winCondition: 'firstPlaceCount',
    history: HISTORY,
    matchStartIndex: 2,
  });
  assert.equal(standings.find((s) => s.teamId === 0).firstPlaceCount, 0);
  assert.equal(standings.find((s) => s.teamId === 1).firstPlaceCount, 1);
});

test('集計: 未所属のプレイヤーはどのチームにも数えない', () => {
  const { standings, unassigned } = computeTeamStandings({
    players: players(['a', 9, 0], ['z', 99]),
    teamCount: 2,
    winCondition: 'totalScore',
    history: {},
  });
  assert.deepEqual(unassigned.map((p) => p.uid), ['z']);
  assert.equal(standings.reduce((s, t) => s + t.totalScore, 0), 9);
});
