/**
 * メイク10 ソルバー
 * - 出題数字から四則演算で目標値に到達する全解を総当たり探索
 * - 値は有理数（約分済み分数）で厳密に保持
 *
 * 重複排除の方針:
 *  - 「表示文字列がまったく同じ」ものは当然排除
 *  - 「×1」「÷1」「+0」を含む式のうち、1や0を取り除いた式がすでにある場合は排除
 *  - ただし「÷÷ → ×」のような括弧構造の違いは別解として残す
 *    例) 7 + 6 × 2 ÷ 4 と 6 ÷ (4 ÷ 2) + 7 は両方表示
 */

export type Op = '+' | '-' | '*' | '/';

/** 約分済み有理数。d は常に正 */
export type Rat = { n: number; d: number };

export type ExprNode =
  | { type: 'num'; rat: Rat; val: number }
  | { type: 'op'; op: Op; left: ExprNode; right: ExprNode; rat: Rat; val: number };

export interface Solution {
  formula: string;
  key: string;
}

export const EPS = 1e-9;
export const ALL_OPS: Op[] = ['+', '-', '*', '/'];

export const OP_SYMBOL: Record<Op, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

// ────────── 有理数演算 ──────────

function gcd(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b) { const t = a % b; a = b; b = t; }
  return a || 1;
}

export function rat(n: number, d = 1): Rat {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return { n: 0, d: 1 };
  n = Math.trunc(n); d = Math.trunc(d);
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export function ratFromNumber(v: number): Rat {
  if (Number.isInteger(v) || Math.abs(v - Math.round(v)) < 1e-9) return rat(Math.round(v), 1);
  const sign = v < 0 ? -1 : 1;
  const av = Math.abs(v);
  let bN = Math.round(av), bD = 1, bE = Math.abs(av - bN);
  for (let d = 2; d <= 10000; d++) {
    const n = Math.round(av * d);
    const e = Math.abs(av * d - n);
    if (e < bE - 1e-12 || (Math.abs(e - bE) < 1e-12 && d < bD)) {
      bE = e; bN = n; bD = d;
      if (e < 1e-12) break;
    }
  }
  return rat(sign * bN, bD);
}

export function ratVal(r: Rat): number { return r.n / r.d; }

export function ratEq(a: Rat, b: Rat): boolean {
  return a.n === b.n && a.d === b.d;
}

export function ratAdd(a: Rat, b: Rat): Rat { return rat(a.n * b.d + b.n * a.d, a.d * b.d); }
export function ratSub(a: Rat, b: Rat): Rat { return rat(a.n * b.d - b.n * a.d, a.d * b.d); }
export function ratMul(a: Rat, b: Rat): Rat { return rat(a.n * b.n, a.d * b.d); }
export function ratDiv(a: Rat, b: Rat): Rat { return rat(a.n * b.d, a.d * b.n); }

export function applyOpRat(op: Op, a: Rat, b: Rat): Rat {
  switch (op) {
    case '+': return ratAdd(a, b);
    case '-': return ratSub(a, b);
    case '*': return ratMul(a, b);
    case '/': return ratDiv(a, b);
  }
}

export function fmtRat(r: Rat): string {
  if (r.d === 1) return String(r.n);
  if (r.n === 0) return '0';
  return `${r.n}/${r.d}`;
}

export function num(val: number): ExprNode {
  const r = ratFromNumber(val);
  return { type: 'num', rat: r, val: ratVal(r) };
}

export function makeOpNode(op: Op, left: ExprNode, right: ExprNode): ExprNode {
  const r = applyOpRat(op, left.rat, right.rat);
  return { type: 'op', op, left, right, rat: r, val: ratVal(r) };
}

// ────────── 式の表示 ──────────

const PREC: Record<Op, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

export function formatExpr(n: ExprNode, parentPrec = 0, isRight = false, parentOp?: Op): string {
  if (n.type === 'num') return fmtRat(n.rat);
  const prec = PREC[n.op];
  const body =
    formatExpr(n.left, prec, false, n.op) +
    ` ${OP_SYMBOL[n.op]} ` +
    formatExpr(n.right, prec, true, n.op);
  const needParen =
    prec < parentPrec ||
    (prec === parentPrec && isRight && (parentOp === '-' || parentOp === '/'));
  return needParen ? `(${body})` : body;
}

// ────────── 正規化キー ──────────
//
// 方針: ×1, ÷1, +0 を含む式は「それを省いた式」と同一キーになるよう、
// AST を正規形に変換してからキーを生成する。
// ただし ÷÷→× のような括弧構造の違いは「別の式」として残すため、
// 正規化は「恒等演算の除去」＋「可換オペランドの順序統一」だけに限定する。

/**
 * ASTの恒等演算を再帰的に除去する。
 *  - ×1, 1×, ÷1, +0, 0+, −0
 *  - さらに、乗法チェーン中に1がある場合も除去
 *    例: 9 ÷ (1 × 3) → 9 ÷ 3, 9 × 1 ÷ 3 → 9 ÷ 3
 */
function simplifyIdentity(n: ExprNode): ExprNode {
  if (n.type === 'num') return n;
  const left = simplifyIdentity(n.left);
  const right = simplifyIdentity(n.right);
  const rv = right.rat;
  const lv = left.rat;

  // x * 1, 1 * x
  if (n.op === '*') {
    if (rv.n === 1 && rv.d === 1) return left;
    if (lv.n === 1 && lv.d === 1) return right;
  }
  // x / 1
  if (n.op === '/') {
    if (rv.n === 1 && rv.d === 1) return left;
  }
  // x + 0, 0 + x
  if (n.op === '+') {
    if (rv.n === 0) return left;
    if (lv.n === 0) return right;
  }
  // x - 0
  if (n.op === '-') {
    if (rv.n === 0) return left;
  }

  // 乗法チェーン中の ×1 を除去するため right 側も再簡約
  const result: ExprNode = { ...n, left, right };
  // 値が結果的に1になるサブツリーとの乗算/除算
  if (n.op === '*' || n.op === '/') {
    if (right.rat.n === 1 && right.rat.d === 1) return left;
    if (n.op === '*' && left.rat.n === 1 && left.rat.d === 1) return right;
  }
  return result;
}

/**
 * 加法・乗法の結合則で平坦化し、項/因子をソートして正規化キーを生成する。
 * ÷÷→× は構造が違うのでキーも異なる → 別解として残る。
 */
function normalizeKeyInner(n: ExprNode): string {
  if (n.type === 'num') return fmtRat(n.rat);

  // 加法系：+/- を平坦化して符号付き項の集合に
  if (n.op === '+' || n.op === '-') {
    const terms: string[] = [];
    const collect = (x: ExprNode, sign: 1 | -1): void => {
      if (x.type === 'op' && (x.op === '+' || x.op === '-')) {
        collect(x.left, sign);
        collect(x.right, x.op === '+' ? sign : (sign * -1) as 1 | -1);
      } else {
        terms.push((sign === 1 ? '+' : '-') + normalizeKeyInner(x));
      }
    };
    collect(n, 1);
    terms.sort();
    return `[${terms.join('')}]`;
  }

  // 乗法系：*/÷ を平坦化して分子/分母の因子の集合に（因子1を除去）
  if (n.op === '*' || n.op === '/') {
    const nums: string[] = [];
    const dens: string[] = [];
    const collect = (x: ExprNode, isNumerator: boolean): void => {
      if (x.type === 'op' && (x.op === '*' || x.op === '/')) {
        collect(x.left, isNumerator);
        collect(x.right, x.op === '*' ? isNumerator : !isNumerator);
      } else {
        const k = normalizeKeyInner(x);
        // 因子が数値 1 のリテラルなら除去（×1, ÷1 は何もしないのと同じ）
        if (x.type === 'num' && x.rat.n === 1 && x.rat.d === 1) return;
        (isNumerator ? nums : dens).push(k);
      }
    };
    collect(n, true);
    // 全因子が消えた場合は 1
    if (nums.length === 0) nums.push('1');
    nums.sort();
    dens.sort();
    if (dens.length === 0) return nums.length === 1 ? nums[0] : `{${nums.join('*')}}`;
    return `{${nums.join('*')}/${dens.join('*')}}`;
  }

  const lk = normalizeKeyInner(n.left);
  const rk = normalizeKeyInner(n.right);
  return `(${lk}${n.op}${rk})`;
}

/**
 * 式（ExprNode）の等価判定キーを返す。
 * ×1/÷1/+0 等の恒等演算や、加減算・乗除算内の項の並び順の違いは
 * 同一キーになる（＝別解として区別しない）。
 * プレイヤーの解答と解答例リストの紐付け（「あなたの解答」判定）は、
 * 表示用の formula 文字列ではなく必ずこのキーで行うこと。
 * 重複排除時に代表として残る formula 文字列は、プレイヤーが実際に
 * 入力した式の文字列表現と一致するとは限らないため。
 */
export function normalizeKey(n: ExprNode): string {
  return normalizeKeyInner(simplifyIdentity(n));
}

// ────────── ソルバー ──────────

export interface SolveOptions {
  target: number;
  ops?: Op[];
  maxSolutions?: number;
  integerOnly?: boolean;
}

/** 式が恒等演算（×1, ÷1, +0, -0）を含むかチェック */
function hasIdentityOp(n: ExprNode): boolean {
  if (n.type === 'num') return false;
  const lv = n.left.rat;
  const rv = n.right.rat;
  if ((n.op === '*' && ((rv.n === 1 && rv.d === 1) || (lv.n === 1 && lv.d === 1)))
    || (n.op === '/' && rv.n === 1 && rv.d === 1)
    || (n.op === '+' && (rv.n === 0 || lv.n === 0))
    || (n.op === '-' && rv.n === 0)) return true;
  return hasIdentityOp(n.left) || hasIdentityOp(n.right);
}

export function solve(numbers: number[], options: SolveOptions): Solution[] {
  const { target, ops = ALL_OPS, maxSolutions = 500, integerOnly = false } = options;
  const targetRat = ratFromNumber(target);
  const allResults: { formula: string; key: string; hasIdent: boolean }[] = [];
  const seenFormula = new Set<string>();
  const opSet = new Set(ops);
  let budget = 4_000_000;

  const rec = (nodes: ExprNode[]) => {
    if (allResults.length >= maxSolutions * 3 || budget <= 0) return;
    if (nodes.length === 1) {
      const n = nodes[0];
      if (ratEq(n.rat, targetRat)) {
        const formula = formatExpr(n);
        if (seenFormula.has(formula)) return;
        seenFormula.add(formula);
        const key = normalizeKey(n);
        allResults.push({ formula, key, hasIdent: hasIdentityOp(n) });
      }
      return;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const rest: ExprNode[] = [];
        for (let k = 0; k < nodes.length; k++) if (k !== i && k !== j) rest.push(nodes[k]);

        const tryNode = (node: ExprNode) => {
          budget--;
          if (integerOnly && node.rat.d !== 1) return;
          rest.push(node);
          rec(rest);
          rest.pop();
        };

        if (opSet.has('+')) tryNode(makeOpNode('+', a, b));
        if (opSet.has('*')) tryNode(makeOpNode('*', a, b));
        if (opSet.has('-')) {
          if (a.val >= b.val - EPS) tryNode(makeOpNode('-', a, b));
          if (b.val > a.val + EPS) tryNode(makeOpNode('-', b, a));
        }
        if (opSet.has('/')) {
          if (Math.abs(b.val) > EPS) tryNode(makeOpNode('/', a, b));
          if (Math.abs(a.val) > EPS) tryNode(makeOpNode('/', b, a));
        }
        if (allResults.length >= maxSolutions * 3 || budget <= 0) return;
      }
    }
  };

  rec(numbers.map(num));

  // 後処理：同じ正規化キーを持つ解のうち、恒等演算を含まないものを優先して残す
  const byKey = new Map<string, { formula: string; key: string; hasIdent: boolean }>();
  for (const r of allResults) {
    const existing = byKey.get(r.key);
    if (!existing) {
      byKey.set(r.key, r);
    } else if (existing.hasIdent && !r.hasIdent) {
      // 恒等演算なし版に置き換え
      byKey.set(r.key, r);
    }
  }
  const results: Solution[] = [];
  for (const r of byKey.values()) {
    if (results.length >= maxSolutions) break;
    results.push({ formula: r.formula, key: r.key });
  }
  return results;
}

export function hasSolution(numbers: number[], options: SolveOptions): boolean {
  return solve(numbers, { ...options, maxSolutions: 1 }).length > 0;
}

export type DifficultyLabel = 'ハード' | 'ノーマル' | 'イージー';

export function difficultyOf(solutionCount: number): DifficultyLabel {
  if (solutionCount <= 2) return 'ハード';
  if (solutionCount <= 5) return 'ノーマル';
  return 'イージー';
}

export function displayValue(v: number | Rat): string {
  if (typeof v === 'object' && v !== null && 'n' in v && 'd' in v) return fmtRat(v as Rat);
  return fmtRat(ratFromNumber(v as number));
}
