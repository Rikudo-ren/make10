import { difficultyOf, solve, type Solution } from './solver';
import type { Settings } from './types';

export interface Puzzle {
  numbers: number[];
  target: number;
  solutions: string[];
  solutionCount: number;
  difficultyLabel: string;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickNumbers(s: Settings): number[] {
  const min = Math.min(s.rangeMin, s.rangeMax);
  const max = Math.max(s.rangeMin, s.rangeMax);
  if (s.allowDuplicateNumbers || max - min + 1 < s.numberCount) {
    return Array.from({ length: s.numberCount }, () => randInt(min, max));
  }
  const pool: number[] = [];
  for (let v = min; v <= max; v++) pool.push(v);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, s.numberCount).sort((a, b) => a - b);
}

function pickTarget(s: Settings): number {
  if (s.targetMode === 'random') {
    const lo = Math.min(s.randomTargetMin, s.randomTargetMax);
    const hi = Math.max(s.randomTargetMin, s.randomTargetMax);
    return randInt(lo, hi);
  }
  return s.targetValue;
}

/**
 * 解が必ず存在する出題を生成する（6.6 出題時の事前チェック）
 * 見つからない場合は null（GM設定が無理な条件）
 */
export function generatePuzzle(s: Settings, maxAttempts?: number): Puzzle | null {
  const solutionCap = s.numberCount >= 6 ? 40 : s.numberCount === 5 ? 80 : 200;
  // 探索コストが大きい設定では試行回数を抑える（1セットあたり最悪200ms程度）
  const attempts = maxAttempts ?? (s.numberCount >= 6 ? 150 : s.numberCount === 5 ? 500 : 2000);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const numbers = pickNumbers(s);
    const target = pickTarget(s);
    const found: Solution[] = solve(numbers, {
      target,
      ops: s.allowedOperators,
      maxSolutions: solutionCap,
      integerOnly: s.integerOnly,
    });
    if (found.length > 0) {
      return {
        numbers,
        target,
        solutions: found.map((f) => f.formula), // 全件を返す
        solutionCount: found.length,
        difficultyLabel: difficultyOf(found.length),
      };
    }
  }
  return null;
}
