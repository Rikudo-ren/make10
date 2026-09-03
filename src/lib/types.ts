import type { Op } from './solver';

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
  scoringMode: 'rank' | 'first' | 'flat';
  maxRankCount: number; // 何位まで入賞枠を設けるか（1〜5、デフォルト3）
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
  solutions?: string[];
  solutionCount?: number;
  difficultyLabel?: string | null;
  /** 'answered' | 'passed' | 'timeup' */
  outcome?: string | null;
  results?: Record<string, { adjustedElapsedMs: number; formula: string; gained: number; rank: number }>;
}

export interface AnswerData {
  formula: string;
  submittedAt: number;
  adjustedElapsedMs: number;
  passed?: boolean;
}

export interface RoomData {
  gmUid: string;
  status: 'lobby' | 'playing' | 'judging' | 'finished';
  settings: Settings;
  players?: Record<string, PlayerData>;
  currentRound?: RoundData;
  answers?: Record<string, Record<string, AnswerData>>;
  history?: Record<string, RoundData>;
}

export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  if (!Array.isArray(s.allowedOperators) || s.allowedOperators.length === 0) {
    s.allowedOperators = [...DEFAULT_SETTINGS.allowedOperators];
  }
  return s;
}
