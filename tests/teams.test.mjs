import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignTeams,
  computeIndividualStandings,
  computeTeamStandings,
  filterMatchParticipants,
  getWinningTeams,
  pickJoinTeamId,
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

test('チーム分け: 3〜6チームでも全チームに人が入り、人数差は最大1', () => {
  const list = Array.from({ length: 13 }, (_, i) => ({
    uid: `p${i}`,
    name: `p${i}`,
    score: 13 - i,
    teamId: null,
  }));
  for (const teamCount of [3, 4, 5, 6]) {
    for (const mode of ['balanced', 'random']) {
      const assigned = assignTeams({ players: list, teamCount, mode, rng: () => 0.37 });
      assert.equal(Object.keys(assigned).length, list.length, `${teamCount}/${mode}`);
      const sizes = Array.from({ length: teamCount }, (_, t) =>
        Object.values(assigned).filter((v) => v === t).length,
      );
      assert.ok(sizes.every((n) => n >= 1), `${teamCount}/${mode}: ${sizes}`);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${teamCount}/${mode}: ${sizes}`);
    }
  }
});

test('チーム分け: 3チームのバランスは蛇行（A B C C B A A…）になる', () => {
  const list = players(['p1', 70], ['p2', 60], ['p3', 50], ['p4', 40], ['p5', 30], ['p6', 20], ['p7', 10]);
  const assigned = assignTeams({ players: list, teamCount: 3, mode: 'balanced' });
  assert.deepEqual(assigned, { p1: 0, p2: 1, p3: 2, p4: 2, p5: 1, p6: 0, p7: 0 });
});

test('チーム分け: 手動でチームE（5チーム目）も保持できる', () => {
  const assigned = assignTeams({
    players: players(['a', 0, 4], ['b', 0, 3], ['c', 0]),
    teamCount: 5,
    mode: 'manual',
  });
  assert.equal(assigned.a, 4);
  assert.equal(assigned.b, 3);
  assert.ok(assigned.c >= 0 && assigned.c < 5);
});

test('集計: 3チーム以上でも順位と勝者を判定できる', () => {
  const list = players(['a', 10, 0], ['b', 30, 1], ['c', 20, 2]);
  const { standings } = computeTeamStandings({
    players: list,
    teamCount: 3,
    winCondition: 'totalScore',
    history: {},
  });
  assert.deepEqual(standings.map((s) => s.teamId), [1, 2, 0]);
  assert.equal(getWinningTeams(standings)[0].teamId, 1);
});

test('個人成績: チーム所属を保ったまま得点順に並び、1位数・正解数も付く', () => {
  const rows = computeIndividualStandings({
    players: players(['a', 10, 0], ['b', 30, 1], ['c', 20, 1]),
    history: HISTORY,
  });
  assert.deepEqual(rows.map((r) => r.uid), ['b', 'c', 'a']);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
  assert.equal(rows[0].teamId, 1);
  assert.equal(rows[0].firstPlaceCount, 1); // b は round 1 で1位
  assert.equal(rows[1].correctCount, 3); // c は3ラウンド正解
  assert.equal(rows[2].score, 10);
});

test('途中参加: 保存済みの所属を最優先で復元し、本人の選択が次に来る', () => {
  const list = players(['a', 0, 0], ['b', 0, 0], ['c', 0, 1]);
  // 再参加（teamId=1 が保存済み）なら、本人が 0 を選んでも保存済みを優先
  assert.equal(pickJoinTeamId({ players: list, teamCount: 3, existingTeamId: 1, requestedTeamId: 0 }), 1);
  // 新規参加で本人が選んだチーム
  assert.equal(pickJoinTeamId({ players: list, teamCount: 3, requestedTeamId: 2 }), 2);
  // どちらも無ければ人数が一番少ないチーム（C は0人）
  assert.equal(pickJoinTeamId({ players: list, teamCount: 3 }), 2);
  // 不正な希望は無視して最少人数へ
  assert.equal(pickJoinTeamId({ players: list, teamCount: 2, requestedTeamId: 9 }), 1);
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


test('退出者: 結果が残っていれば成績に残り、結果がない場合は名簿から外れる', () => {
  const roster = [
    { uid: 'a', name: 'a', score: 30, teamId: 0 },
    { uid: 'b', name: 'b', score: 10, teamId: 0, left: true }, // 抜けたが結果あり
    { uid: 'c', name: 'c', score: 0, teamId: 1, left: true }, // 抜けた＋結果なし
    { uid: 'd', name: 'd', score: 20, teamId: 1 },
  ];
  const history = {
    1: { roundIndex: 1, results: { a: { rank: 1, gained: 20 }, b: { rank: 2, gained: 10 } } },
  };
  const kept = filterMatchParticipants(roster, history, 0);
  assert.deepEqual(kept.map((pl) => pl.uid), ['a', 'b', 'd']);
  // 試合開始より前のラウンド結果だけでは残らない
  const old = filterMatchParticipants(roster, { 0: { roundIndex: 0, results: { b: {} } } }, 1);
  assert.deepEqual(old.map((pl) => pl.uid), ['a', 'd']);
});

test('退出者: チーム合計・平均と個人順位にそのまま含まれる', () => {
  const roster = [
    { uid: 'a', name: 'a', score: 30, teamId: 0 },
    { uid: 'b', name: 'b', score: 25, teamId: 0, left: true },
    { uid: 'd', name: 'd', score: 40, teamId: 1 },
  ];
  const history = {
    1: { roundIndex: 1, winnerUid: 'b', results: { b: { rank: 1, gained: 25 }, a: { rank: 2, gained: 10 } } },
  };
  const participants = filterMatchParticipants(roster, history, 0);
  const { standings } = computeTeamStandings({
    players: participants,
    teamCount: 2,
    winCondition: 'totalScore',
    history,
  });
  const t0 = standings.find((t) => t.teamId === 0);
  assert.equal(t0.totalScore, 55); // 在室者(a)だけの30ではない
  assert.equal(t0.averageScore, 27.5);
  assert.equal(t0.members.find((m) => m.uid === 'b').left, true);

  const rows = computeIndividualStandings({ players: participants, history });
  assert.deepEqual(rows.map((r) => [r.uid, r.rank]), [['d', 1], ['a', 2], ['b', 3]]);
  assert.equal(rows.find((r) => r.uid === 'b').left, true);
  assert.equal(rows.find((r) => r.uid === 'a').left, false);
});
