/**
 * チーム戦の純粋ロジック（Firebase / React に依存しない。tests/teams.test.mjs で検証する）
 *
 * - チーム分け: バランス（直前スコア順の蛇行ドラフト） / ランダム / GM手動
 * - 勝利条件: 合計点 / 平均点 / 1位獲得数 / 正解数
 *   順位は「選択中の勝利条件の値」だけで決める。同値なら引き分けとして扱うため、
 *   タイブレーク用の副次指標は並び順の表示にだけ使い、優勝判定には使わない。
 */

export type BattleMode = 'solo' | 'team';
export type TeamAssignMode = 'balanced' | 'random' | 'manual';
export type TeamWinCondition = 'totalScore' | 'firstPlaceCount' | 'correctCount' | 'averageScore';

export interface TeamDef {
  id: number;
  /** 表示名（チームA など） */
  label: string;
  /** 短い表示（A など） */
  short: string;
  color: string;
}

export const TEAM_DEFS: TeamDef[] = [
  { id: 0, label: 'チームA', short: 'A', color: '#22e0ff' },
  { id: 1, label: 'チームB', short: 'B', color: '#ff3ec8' },
  { id: 2, label: 'チームC', short: 'C', color: '#ffb020' },
  { id: 3, label: 'チームD', short: 'D', color: '#b6ff3c' },
];

export const MAX_TEAMS = TEAM_DEFS.length;

export function clampTeamCount(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 2;
  return Math.min(MAX_TEAMS, Math.max(2, v));
}

export function teamDef(teamId: unknown): TeamDef | null {
  const v = Math.floor(Number(teamId));
  if (!Number.isFinite(v) || v < 0 || v >= MAX_TEAMS) return null;
  return TEAM_DEFS[v];
}

export function isValidTeamId(teamId: unknown, teamCount: number): boolean {
  const v = Math.floor(Number(teamId));
  return Number.isFinite(v) && v >= 0 && v < clampTeamCount(teamCount);
}

export interface TeamPlayerInput {
  uid: string;
  name?: string;
  score?: number;
  teamId?: number | null;
}

/** roundIndex -> そのラウンドの確定結果（RoundData 相当の最小形） */
export type TeamHistory = Record<
  string,
  {
    roundIndex?: number;
    results?: Record<string, { rank?: number; gained?: number }> | null;
  }
>;

/** uid -> { 1位回数, 正解数 } を履歴から数える（matchStartIndex 以降のラウンドのみ） */
export function countPlayerResults(
  history: TeamHistory | undefined | null,
  matchStartIndex = 0,
): Map<string, { firstPlaceCount: number; correctCount: number }> {
  const out = new Map<string, { firstPlaceCount: number; correctCount: number }>();
  if (!history) return out;
  for (const round of Object.values(history)) {
    if (!round || typeof round !== 'object') continue;
    if (typeof round.roundIndex === 'number' && round.roundIndex < matchStartIndex) continue;
    const results = round.results ?? {};
    for (const [uid, res] of Object.entries(results)) {
      if (!res) continue;
      const cur = out.get(uid) ?? { firstPlaceCount: 0, correctCount: 0 };
      cur.correctCount += 1;
      if (res.rank === 1) cur.firstPlaceCount += 1;
      out.set(uid, cur);
    }
  }
  return out;
}

export interface TeamMemberStanding {
  uid: string;
  name: string;
  score: number;
  firstPlaceCount: number;
  correctCount: number;
}

export interface TeamStanding {
  teamId: number;
  def: TeamDef;
  members: TeamMemberStanding[];
  totalScore: number;
  /** メンバー0人のときは 0 */
  averageScore: number;
  firstPlaceCount: number;
  correctCount: number;
  /** 選択中の勝利条件で競う値 */
  primaryValue: number;
}

export function primaryValueOf(
  s: Pick<TeamStanding, 'totalScore' | 'averageScore' | 'firstPlaceCount' | 'correctCount'>,
  winCondition: TeamWinCondition,
): number {
  switch (winCondition) {
    case 'firstPlaceCount':
      return s.firstPlaceCount;
    case 'correctCount':
      return s.correctCount;
    case 'averageScore':
      return s.averageScore;
    case 'totalScore':
    default:
      return s.totalScore;
  }
}

export const WIN_CONDITION_LABEL: Record<TeamWinCondition, string> = {
  totalScore: '合計点数',
  firstPlaceCount: '1位獲得数',
  correctCount: '正解数',
  averageScore: '平均点',
};

export const WIN_CONDITION_UNIT: Record<TeamWinCondition, string> = {
  totalScore: '点',
  firstPlaceCount: '回',
  correctCount: '回',
  averageScore: '点',
};

/** 平均点の表示用（小数1桁まで、整数なら整数表示） */
export function formatPrimaryValue(value: number, winCondition: TeamWinCondition): string {
  if (winCondition === 'averageScore') {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return String(Math.round(value));
}

/**
 * チーム順位を計算する。
 * 並び順は primary 降順 → 合計点 → 1位数 → 正解数 → チームID の順（表示の安定用）。
 * 優勝かどうかは getWinningTeams() で「primaryValue が最大のチーム」をすべて返すので、
 * 先頭が同値なら引き分けになる。
 */
export function computeTeamStandings(args: {
  players: TeamPlayerInput[];
  teamCount: number;
  winCondition: TeamWinCondition;
  history?: TeamHistory | null;
  matchStartIndex?: number;
}): { standings: TeamStanding[]; unassigned: TeamPlayerInput[] } {
  const teamCount = clampTeamCount(args.teamCount);
  const counts = countPlayerResults(args.history, args.matchStartIndex ?? 0);

  const byTeam = new Map<number, TeamMemberStanding[]>();
  for (let i = 0; i < teamCount; i++) byTeam.set(i, []);
  const unassigned: TeamPlayerInput[] = [];

  for (const p of args.players) {
    if (!p || typeof p.uid !== 'string') continue;
    const c = counts.get(p.uid) ?? { firstPlaceCount: 0, correctCount: 0 };
    const member: TeamMemberStanding = {
      uid: p.uid,
      name: p.name ?? 'プレイヤー',
      score: p.score ?? 0,
      firstPlaceCount: c.firstPlaceCount,
      correctCount: c.correctCount,
    };
    if (isValidTeamId(p.teamId, teamCount)) {
      byTeam.get(Math.floor(Number(p.teamId)))!.push(member);
    } else {
      unassigned.push(p);
    }
  }

  const standings: TeamStanding[] = [];
  for (let teamId = 0; teamId < teamCount; teamId++) {
    const members = (byTeam.get(teamId) ?? []).sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid));
    const totalScore = members.reduce((sum, m) => sum + m.score, 0);
    const base = {
      teamId,
      def: TEAM_DEFS[teamId],
      members,
      totalScore,
      averageScore: members.length > 0 ? totalScore / members.length : 0,
      firstPlaceCount: members.reduce((sum, m) => sum + m.firstPlaceCount, 0),
      correctCount: members.reduce((sum, m) => sum + m.correctCount, 0),
    };
    standings.push({ ...base, primaryValue: primaryValueOf(base, args.winCondition) });
  }

  standings.sort(
    (a, b) =>
      b.primaryValue - a.primaryValue ||
      b.totalScore - a.totalScore ||
      b.firstPlaceCount - a.firstPlaceCount ||
      b.correctCount - a.correctCount ||
      a.teamId - b.teamId,
  );
  return { standings, unassigned };
}

/** 優勝チーム一覧。primaryValue が同値で並んだ場合は複数返る（= 引き分け） */
export function getWinningTeams(standings: TeamStanding[]): TeamStanding[] {
  const entered = standings.filter((s) => s.members.length > 0);
  if (entered.length === 0) return [];
  const best = Math.max(...entered.map((s) => s.primaryValue));
  return entered.filter((s) => s.primaryValue === best);
}

/** Fisher-Yates シャッフル（テスト用に rng を差し替え可能） */
export function shuffled<T>(list: T[], rng: () => number = Math.random): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * チーム分けを行う。uid -> teamId を返す。
 * - balanced: スコア（直前のマッチ結果など）が高い順に並べ、蛇行（0,1,2,2,1,0…）で振り分ける。
 *   全員0点の初回は参加順のドラフトになる。
 * - random: シャッフルしてから順番に振り分ける（人数差は最大1）。
 * - manual: 既に決まっている所属はそのまま残し、未所属だけを人数の少ないチームへ入れる。
 */
export function assignTeams(args: {
  players: TeamPlayerInput[];
  teamCount: number;
  mode: TeamAssignMode;
  rng?: () => number;
}): Record<string, number> {
  const teamCount = clampTeamCount(args.teamCount);
  const players = args.players.filter((p) => p && typeof p.uid === 'string');
  const out: Record<string, number> = {};
  const sizes = new Array<number>(teamCount).fill(0);
  const put = (uid: string, teamId: number) => {
    out[uid] = teamId;
    sizes[teamId] += 1;
  };
  const smallestTeam = () => {
    let best = 0;
    for (let i = 1; i < teamCount; i++) if (sizes[i] < sizes[best]) best = i;
    return best;
  };

  if (args.mode === 'manual') {
    for (const p of players) {
      if (isValidTeamId(p.teamId, teamCount)) put(p.uid, Math.floor(Number(p.teamId)));
    }
    for (const p of players) {
      if (!(p.uid in out)) put(p.uid, smallestTeam());
    }
    return out;
  }

  const ordered =
    args.mode === 'random'
      ? shuffled(players, args.rng)
      : // balanced: スコア降順（同点は参加順を維持）で蛇行ドラフト
        [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (args.mode === 'random') {
    ordered.forEach((p, i) => put(p.uid, i % teamCount));
    return out;
  }

  // balanced（蛇行）: 0,1,...,n-1,n-1,...,1,0,0,1,...
  ordered.forEach((p, i) => {
    const cycle = Math.floor(i / teamCount);
    const pos = i % teamCount;
    const teamId = cycle % 2 === 0 ? pos : teamCount - 1 - pos;
    put(p.uid, teamId);
  });
  return out;
}
