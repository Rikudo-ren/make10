import { difficultyOf, solve, solveWithMeta, type Solution } from './solver';
import type { Settings } from './types';

export interface Puzzle {
  numbers: number[];
  target: number;
  solutions: Solution[];
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

function solutionCap(numberCount: number) {
  return numberCount >= 6 ? 40 : numberCount === 5 ? 80 : 200;
}

/** 出題候補の同一性判定キー（数字の並び順は無視） */
function candidateKey(numbers: number[], target: number, s: Settings) {
  const ops = [...s.allowedOperators].sort().join('');
  return `${[...numbers].sort((a, b) => a - b).join(',')}|${target}|${ops}|${s.integerOnly ? 1 : 0}`;
}

export function puzzleKey(p: Pick<Puzzle, 'numbers' | 'target'>) {
  return `${p.numbers.join(',')}|${p.target}`;
}

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const sleep = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 「この数字の組み合わせでは解が存在しない」と確定した候補のキャッシュ。
 * 同じ設定で何度も同じ候補を引き直して無駄に探索するのを防ぐ。
 */
const deadEnds = new Set<string>();

/** 探索予算のエスカレーション（経過時間が長いほど1回を丁寧に見る） */
function budgetForElapsed(elapsedMs: number) {
  if (elapsedMs < 400) return 120_000;
  if (elapsedMs < 1_500) return 400_000;
  return 900_000;
}

const FULL_SOLVE_BUDGET = 2_000_000;

/**
 * 「この設定では原理的に作れない」ことを瞬時に判定する（明らかに不可能なときだけ true）。
 * これを入れておかないと、例えば「6個 / 1〜16 / ＋のみ / 目標126」のような設定で
 * 毎回数秒待たされることになる。
 */
function definitelyImpossible(s: Settings, target: number): boolean {
  const min = Math.min(s.rangeMin, s.rangeMax);
  const max = Math.max(s.rangeMin, s.rangeMax);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return true;
  if (min < 0) return false; // 負の数は判定を単純化できないので探索に任せる
  const n = s.numberCount;
  const ops = new Set(s.allowedOperators);
  const absTarget = Math.abs(target);

  // ＋だけ: 合計しか作れない
  if (ops.size === 1 && ops.has('+')) {
    if (target < n * min || target > n * max) return true;
  }
  // ＋と−だけ: どんなに頑張っても「全部足した値」を超えない
  if ([...ops].every((o) => o === '+' || o === '-')) {
    if (absTarget > n * max) return true;
  }
  // ×を含む: 絶対値の上限は max^n（max>=2 のとき）
  if (ops.has('*') && max >= 2 && absTarget > Math.pow(max, n)) return true;
  // ÷や×だけで小さい目標値を作るのは難しいが、ここでは「大きすぎる」場合のみ弾く
  if (!ops.has('+') && !ops.has('-') && absTarget > Math.pow(max, n)) return true;
  return false;
}

export interface GenerateProgress {
  attempts: number;
  elapsedMs: number;
  deadlineMs: number;
}

export interface GenerateOptions {
  /**
   * この時間を超えたら諦めて null を返す。
   * 省略または0以下の場合は自動で打ち切らず、見つかるか shouldCancel が
   * true になるまで探索を続ける。
   */
  deadlineMs?: number;
  /** 進捗コールバック。UI を固めないために数十msごとに呼ばれる */
  onProgress?: (p: GenerateProgress) => void;
  /** true を返すと探索を中断する（画面離脱時など） */
  shouldCancel?: () => boolean;
  /** 直前の問題（同じ問題を連続で出さない） */
  avoid?: string;
}

/**
 * 解が必ず存在する出題を生成する（6.6 出題時の事前チェック）。
 *
 * 重い設定でもブラウザを固めないように、
 *  - 1回の探索にノード予算をかける
 *  - 10ms ごとにイベントループへ制御を返す
 *  - 既定では時間で勝手に打ち切らず、呼び出し側の shouldCancel で中止できる
 * という作りになっている。呼び出し側は await して使うこと。
 */
export async function generatePuzzleAsync(
  s: Settings,
  opts: GenerateOptions = {},
): Promise<Puzzle | null> {
  // 原理的に不可能な設定は一瞬で諦める（待たせない）
  if (s.targetMode === 'fixed' && definitelyImpossible(s, s.targetValue)) return null;

  const deadlineMs = opts.deadlineMs ?? 0;
  const startedAt = now();
  const deadline = deadlineMs > 0 ? startedAt + deadlineMs : Number.POSITIVE_INFINITY;
  const seen = new Set<string>();
  let attempts = 0;
  let duplicateStreak = 0;
  let lastYield = startedAt;
  let lastReport = startedAt;

  const report = () => {
    opts.onProgress?.({ attempts, elapsedMs: now() - startedAt, deadlineMs });
  };

  while (now() < deadline) {
    if (opts.shouldCancel?.()) return null;

    const numbers = pickNumbers(s);
    const target = pickTarget(s);
    const key = candidateKey(numbers, target, s);
    attempts++;

    if (
      seen.has(key) ||
      opts.avoid === puzzleKey({ numbers, target }) ||
      definitelyImpossible(s, target)
    ) {
      duplicateStreak++;
      // 候補空間を使い切った（＝これ以上引き直しても同じものしか出ない）
      if (duplicateStreak > 400) break;
      if (now() - lastYield >= 10) {
        report();
        await sleep(0);
        lastYield = now();
      }
      continue;
    }
    seen.add(key);
    duplicateStreak = 0;

    if (!deadEnds.has(key)) {
      const elapsed = now() - startedAt;
      const quick = solveWithMeta(numbers, {
        target,
        ops: s.allowedOperators,
        maxSolutions: 1,
        integerOnly: s.integerOnly,
        budget: budgetForElapsed(elapsed),
      });

      if (quick.solutions.length === 0) {
        // 予算内で全探索しきって解なしと確定したものだけキャッシュする
        if (!quick.truncated) deadEnds.add(key);
      } else {
        // 解あり → 解答例一覧を作るために本探索
        const full = solve(numbers, {
          target,
          ops: s.allowedOperators,
          maxSolutions: solutionCap(s.numberCount),
          integerOnly: s.integerOnly,
          budget: FULL_SOLVE_BUDGET,
        });
        const solutions = full.length > 0 ? full : quick.solutions;
        const puzzle: Puzzle = {
          numbers,
          target,
          solutions,
          solutionCount: solutions.length,
          difficultyLabel: difficultyOf(solutions.length),
        };
        opts.onProgress?.({ attempts, elapsedMs: now() - startedAt, deadlineMs });
        return puzzle;
      }
    }

    if (now() - lastYield >= 10) {
      if (now() - lastReport >= 120) {
        report();
        lastReport = now();
      }
      // ここで制御を返すことで、生成中でもカウントダウンやスピナーが動く
      await sleep(0);
      lastYield = now();
    }
  }

  // 目標値ランダム設定なら「式から目標値を作る」ことで必ず解ける問題を用意できる
  const fallback = opts.shouldCancel?.() ? null : buildFromExpression(s, 400);
  report();
  return fallback;
}

/**
 * 数字からランダムに式を組み立て、その計算結果を目標値にする。
 * 目標値がランダム設定のときに「必ず解ける問題」を保証するための最終手段。
 */
function buildFromExpression(s: Settings, tries: number): Puzzle | null {
  if (s.targetMode !== 'random') return null;
  const lo = Math.min(s.randomTargetMin, s.randomTargetMax);
  const hi = Math.max(s.randomTargetMin, s.randomTargetMax);
  const ops = s.allowedOperators;

  for (let t = 0; t < tries; t++) {
    const numbers = pickNumbers(s);
    let nodes = numbers.map((n) => ratNode(n));

    while (nodes.length > 1) {
      const i = Math.floor(Math.random() * nodes.length);
      let j = Math.floor(Math.random() * (nodes.length - 1));
      if (j >= i) j++;
      const a = nodes[i];
      const b = nodes[j];
      const op = ops[Math.floor(Math.random() * ops.length)];

      let value: { n: number; d: number };
      let bad = false;
      switch (op) {
        case '+': value = { n: a.n * b.d + b.n * a.d, d: a.d * b.d }; break;
        case '-': value = { n: a.n * b.d - b.n * a.d, d: a.d * b.d }; break;
        case '*': value = { n: a.n * b.n, d: a.d * b.d }; break;
        default:
          if (b.n === 0) { bad = true; value = { n: 0, d: 1 }; }
          else value = { n: a.n * b.d, d: a.d * b.n };
          break;
      }
      if (bad) break;
      let { n, d } = value;
      if (d < 0) {
        n = -n;
        d = -d;
      }
      const g = gcd(Math.abs(n), d);
      const v = { n: n / g, d: d / g };
      if (s.integerOnly && v.d !== 1) break;
      nodes = nodes.filter((_, k) => k !== i && k !== j);
      nodes.push(v);
    }

    if (nodes.length !== 1) continue;
    const v = nodes[0];
    if (v.d !== 1) continue;
    const target = v.n;
    if (target < lo || target > hi) continue;

    const solutions = solve(numbers, {
      target,
      ops,
      maxSolutions: solutionCap(s.numberCount),
      integerOnly: s.integerOnly,
      budget: FULL_SOLVE_BUDGET,
    });
    if (solutions.length === 0) continue;
    return {
      numbers,
      target,
      solutions,
      solutionCount: solutions.length,
      difficultyLabel: difficultyOf(solutions.length),
    };
  }
  return null;
}

function gcd(a: number, b: number) {
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

function ratNode(n: number) {
  return { n, d: 1 };
}

/**
 * 同期版（後方互換・テスト用）。UI からは generatePuzzleAsync を使うこと。
 * 時間制限つきで探索し、見つからなければ null。
 */
export function generatePuzzle(s: Settings, maxAttempts = 2000): Puzzle | null {
  const solutionCapValue = solutionCap(s.numberCount);
  const attempts = Math.max(1, Math.min(maxAttempts, 300));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const numbers = pickNumbers(s);
    const target = pickTarget(s);
    const found = solve(numbers, {
      target,
      ops: s.allowedOperators,
      maxSolutions: solutionCapValue,
      integerOnly: s.integerOnly,
      budget: 400_000,
    });
    if (found.length > 0) {
      return {
        numbers,
        target,
        solutions: found,
        solutionCount: found.length,
        difficultyLabel: difficultyOf(found.length),
      };
    }
  }
  return null;
}
