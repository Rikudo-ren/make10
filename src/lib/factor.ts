/**
 * 素因数分解モードの純粋ロジック（Firebase / React に依存しない。tests/factor.test.mjs で検証）
 *
 * 遊び方: 出された合成数に対して、素数を1つずつ入力（Enter）して「積み上げていく」。
 * 画面に出るのは入力した素数の積（例: 2×2×3=12）だけで、問題の数が割られていく表示はしない
 * （残りが見えると簡単すぎるため）。積が目標とぴったり一致したら完了。
 */

export type FactorGameMode = 'make10' | 'factor';

/** GMが選べる素数の下限・上限の候補 */
export const FACTOR_PRIME_OPTIONS = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
/** @deprecated 互換用 */
export const FACTOR_MAX_PRIME_OPTIONS = FACTOR_PRIME_OPTIONS;

export function snapFactorPrime(n: unknown, fallback = 13): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return fallback;
  let best = FACTOR_PRIME_OPTIONS[0];
  for (const p of FACTOR_PRIME_OPTIONS) if (p <= v) best = p;
  return v > FACTOR_PRIME_OPTIONS[FACTOR_PRIME_OPTIONS.length - 1]
    ? FACTOR_PRIME_OPTIONS[FACTOR_PRIME_OPTIONS.length - 1]
    : best;
}

export function snapFactorMaxPrime(n: unknown): number {
  return snapFactorPrime(n, 13);
}

export function clampFactorDigits(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(2, v));
}

export function clampFactorCount(n: unknown, fallback = 3): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(10, Math.max(2, v));
}

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
}

export function primesUpTo(max: number): number[] {
  const out: number[] = [];
  for (let n = 2; n <= max; n++) if (isPrime(n)) out.push(n);
  return out;
}

/** 下限〜上限の範囲にある素数だけを返す */
export function primesBetween(min: number, max: number): number[] {
  return primesUpTo(max).filter((p) => p >= min);
}

/** 素因数分解（小さい順）。1以下は空配列 */
export function factorize(n: number): number[] {
  const out: number[] = [];
  let rest = Math.floor(Math.abs(n));
  for (let d = 2; d * d <= rest; d += d === 2 ? 1 : 2) {
    while (rest % d === 0) {
      out.push(d);
      rest /= d;
    }
  }
  if (rest > 1) out.push(rest);
  return out;
}

export type FactorGuessError = 'not-integer' | 'too-small' | 'not-prime' | 'exceeds';

export const FACTOR_GUESS_ERROR_TEXT: Record<FactorGuessError, string> = {
  'not-integer': '整数を入力してください',
  'too-small': '2以上の素数を入力してください',
  'not-prime': '素数ではありません（まだ割れる数です）',
  exceeds: '積が目標の数を超えてしまいます',
};

/** ここまで入力した素数の積 */
export function productOf(factors: number[]): number {
  return factors.reduce((acc, f) => acc * f, 1);
}

/**
 * 素数を1つ積み上げる入力の判定。
 * 「問題を割っていく」のではなく「積が目標に一致するか」だけを見るので、
 * 残りの商は判定にも表示にも使わない。
 * - 素数でない数: 受理しない
 * - 積が目標を超える: 受理しない
 * - それ以外の素数: 積み上げる（目標の因数でない素数を入れたら、戻す操作でやり直す）
 */
export function checkFactorStep(args: {
  target: number;
  currentProduct: number;
  value: unknown;
}): { ok: true; value: number; nextProduct: number } | { ok: false; reason: FactorGuessError } {
  const v = typeof args.value === 'string' ? Number(args.value) : args.value;
  if (typeof v !== 'number' || !Number.isInteger(v)) return { ok: false, reason: 'not-integer' };
  if (v < 2) return { ok: false, reason: 'too-small' };
  if (!isPrime(v)) return { ok: false, reason: 'not-prime' };
  const nextProduct = args.currentProduct * v;
  if (nextProduct > args.target) return { ok: false, reason: 'exceeds' };
  return { ok: true, value: v, nextProduct };
}

/** 解答の表示文字列（小さい順に × でつなぐ）と照合キー */
export function factorFormula(factors: number[]): string {
  return [...factors].sort((a, b) => a - b).join('×');
}
export function factorKey(factors: number[]): string {
  return [...factors].sort((a, b) => a - b).join(',');
}

export interface FactorPuzzle {
  /** 分解する合成数 */
  value: number;
  /** 正解の素因数（小さい順、重複あり） */
  factors: number[];
}

export interface FactorGenOptions {
  /** 合成数の桁数 */
  digits: number;
  /** 素因数の下限（この値以上の素数だけを使う） */
  minPrime?: number;
  /** 素因数の上限（この値以下の素数だけを使う） */
  maxPrime: number;
  /** 素因数の個数（重複込み）の範囲 */
  countMin: number;
  countMax: number;
  rng?: () => number;
  maxAttempts?: number;
}

/**
 * 条件に合う合成数をランダム生成する。
 * 素因数をランダムに掛け合わせて、桁数が一致したものだけ採用する（リジェクト法）。
 * 原理的に作れない組み合わせ（例: 5桁・素因数2個・上限5）では null を返す。
 */
export function generateFactorPuzzle(opts: FactorGenOptions): FactorPuzzle | null {
  const digits = clampFactorDigits(opts.digits);
  const maxPrime = snapFactorMaxPrime(opts.maxPrime);
  const minPrime = Math.min(snapFactorPrime(opts.minPrime ?? 2, 2), maxPrime);
  const countMin = clampFactorCount(opts.countMin, 2);
  const countMax = Math.max(countMin, clampFactorCount(opts.countMax, countMin));
  const primes = primesBetween(minPrime, maxPrime);
  if (primes.length === 0) return null;
  const lo = 10 ** (digits - 1);
  const hi = 10 ** digits - 1;
  const rng = opts.rng ?? Math.random;
  const attempts = opts.maxAttempts ?? 60_000;

  for (let i = 0; i < attempts; i++) {
    const count = countMin + Math.floor(rng() * (countMax - countMin + 1));
    const factors: number[] = [];
    let product = 1;
    for (let k = 0; k < count; k++) {
      const p = primes[Math.min(primes.length - 1, Math.floor(rng() * primes.length))];
      factors.push(p);
      product *= p;
      if (product > hi) break;
    }
    if (factors.length === count && product >= lo && product <= hi) {
      factors.sort((a, b) => a - b);
      return { value: product, factors };
    }
  }
  return null;
}
