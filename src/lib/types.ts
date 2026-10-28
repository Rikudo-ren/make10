import type { Op, Solution } from './solver';

export interface Settings {
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

export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  s.maxRankCount = Number.isFinite(s.maxRankCount) ? Math.min(50, Math.max(1, Math.floor(s.maxRankCount))) : 3;
  if (!Array.isArray(s.customRankPoints)) s.customRankPoints = [...DEFAULT_SETTINGS.customRankPoints];
  if (!Array.isArray(s.allowedOperators) || s.allowedOperators.length === 0) {
    s.allowedOperators = [...DEFAULT_SETTINGS.allowedOperators];
  }
  return s;
}
