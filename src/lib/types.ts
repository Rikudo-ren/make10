import type { Op, Solution } from './solver';
import type { BattleMode, TeamAssignMode, TeamWinCondition } from './teams';
import { clampTeamCount } from './teams';

export type { BattleMode, TeamAssignMode, TeamWinCondition };

export interface Settings {
  /** 個人戦 'solo' / チーム戦 'team' */
  battleMode: BattleMode;
  /** チーム数（2〜4、チーム戦のみ） */
  teamCount: number;
  /** チーム分けの方法（チーム戦のみ） */
  teamAssignMode: TeamAssignMode;
  /** チーム戦の勝利条件（チーム戦のみ） */
  teamWinCondition: TeamWinCondition;
  numberCount: number; // 3〜6
  rangeMin: number;
  rangeMax: number;
  targetMode: 'fixed' | 'random';
  targetValue: number;
  randomTargetMin: number;
  randomTargetMax: number;
  allowedOperators: Op[];
  allowDuplicateNumbers: boolean;
  unlimitedTime: boolean;
  timeLimitSec: number; // unlimitedTime=false のときのみ有効 (1〜300)
  roundCount: number;
  scoringMode: 'rank' | 'first' | 'flat' | 'custom';
  maxRankCount: number; // 何位まで得点するか（1〜50）
  customRankPoints: number[]; // 1位から順に配点
  hideLiveAnswers: boolean; // 結果発表まで他人の解答状況と順位を隠す
  penaltyMode: 'none' | 'lock';
  penaltyLockSec: number;
  showDifficulty: boolean;
  requireAllReady: boolean;
  integerOnly: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  battleMode: 'solo',
  teamCount: 2,
  teamAssignMode: 'balanced',
  teamWinCondition: 'totalScore',
  numberCount: 4,
  rangeMin: 1,
  rangeMax: 9,
  targetMode: 'fixed',
  targetValue: 10,
  randomTargetMin: 5,
  randomTargetMax: 20,
  allowedOperators: ['+', '-', '*', '/'],
  allowDuplicateNumbers: false,
  unlimitedTime: true,
  timeLimitSec: 60,
  roundCount: 10,
  scoringMode: 'rank',
  maxRankCount: 3,
  customRankPoints: [3, 2, 1],
  hideLiveAnswers: false,
  penaltyMode: 'none',
  penaltyLockSec: 5,
  showDifficulty: false,
  requireAllReady: false,
  integerOnly: false,
};

export interface PlayerData {
  name: string;
  score?: number;
  isReady?: boolean;
  rttMs?: number;
  /** チーム戦での所属チーム（0始まり）。個人戦・未割当は null / undefined */
  teamId?: number | null;
}

export interface RoundData {
  roundIndex: number;
  numbers: number[];
  target: number;
  startedAt: number;
  endedAt?: number | null;
  winnerUid?: string | null;
  solutions?: Solution[];
  solutionCount?: number;
  difficultyLabel?: string | null;
  /** 'answered' | 'passed' | 'timeup' */
  outcome?: string | null;
  results?: Record<
    string,
    { adjustedElapsedMs: number; formula: string; key: string; gained: number; rank: number }
  >;
}

export interface AnswerData {
  formula: string;
  /** 解答例との照合に使う等価判定キー（表示文字列が一致しなくても同じ式なら一致する） */
  key: string;
  submittedAt: number;
  adjustedElapsedMs: number;
  passed?: boolean;
}

/** ゲーム内チャットの1件（ルーム内にのみ保持し、直近 CHAT_KEEP 件だけ残す） */
export interface ChatMessage {
  uid: string;
  name: string;
  text: string;
  /** サーバー時刻オフセット補正済みのタイムスタンプ(ms) */
  at: number;
}

export interface RoomData {
  gmUid: string;
  status: 'lobby' | 'playing' | 'judging' | 'finished';
  settings: Settings;
  players?: Record<string, PlayerData>;
  currentRound?: RoundData;
  answers?: Record<string, Record<string, AnswerData>>;
  history?: Record<string, RoundData>;
  chat?: Record<string, ChatMessage>;
  /** GMが問題を生成している間だけ入る時刻(ms)。全員に「準備中」を出すために使う */
  preparingAt?: number | null;
}

const BATTLE_MODES: BattleMode[] = ['solo', 'team'];
const TEAM_ASSIGN_MODES: TeamAssignMode[] = ['balanced', 'random', 'manual'];
const TEAM_WIN_CONDITIONS: TeamWinCondition[] = [
  'totalScore',
  'firstPlaceCount',
  'correctCount',
  'averageScore',
];

export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  // 旧バージョンのルーム（チーム戦フィールドなし）でも個人戦として動くよう既定値で補う
  if (!BATTLE_MODES.includes(s.battleMode)) s.battleMode = 'solo';
  s.teamCount = clampTeamCount(s.teamCount);
  if (!TEAM_ASSIGN_MODES.includes(s.teamAssignMode)) s.teamAssignMode = 'balanced';
  if (!TEAM_WIN_CONDITIONS.includes(s.teamWinCondition)) s.teamWinCondition = 'totalScore';
  s.maxRankCount = Number.isFinite(s.maxRankCount) ? Math.min(50, Math.max(1, Math.floor(s.maxRankCount))) : 3;
  if (!Array.isArray(s.customRankPoints)) s.customRankPoints = [...DEFAULT_SETTINGS.customRankPoints];
  if (!Array.isArray(s.allowedOperators) || s.allowedOperators.length === 0) {
    s.allowedOperators = [...DEFAULT_SETTINGS.allowedOperators];
  }
  return s;
}
