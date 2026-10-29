import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkFactorDivideStep,
  checkFactorStep,
  clampFactorDigits,
  factorize,
  generateFactorPuzzle,
  isPrime,
  primesBetween,
  productOf,
} from '../src/lib/factor.ts';

test('素数判定と素因数分解', () => {
  assert.equal(isPrime(2), true);
  assert.equal(isPrime(13), true);
  assert.equal(isPrime(1), false);
  assert.equal(isPrime(15), false);
  assert.deepEqual(factorize(360), [2, 2, 2, 3, 3, 5]);
  assert.deepEqual(factorize(97), [97]);
  assert.deepEqual(primesBetween(5, 13), [5, 7, 11, 13]);
});

test('積み上げ判定: 素数だけが積まれ、目標を超えても受理する', () => {
  // 24 に対して 2 を積む → 積は2
  assert.deepEqual(checkFactorStep({ target: 24, currentProduct: 1, value: 2 }), {
    ok: true,
    value: 2,
    nextProduct: 2,
  });
  // 目標の因数でない素数も「積み上げ」としては受理する（残り商で判定しない）
  assert.equal(checkFactorStep({ target: 24, currentProduct: 1, value: 5 }).ok, true);
  // 合成数は受理しない
  assert.equal(checkFactorStep({ target: 24, currentProduct: 2, value: 4 }).reason, 'not-prime');
  // 積が目標を超える入力も受理する（超えたことはUI側で赤表示にする）
  const overStep = checkFactorStep({ target: 24, currentProduct: 12, value: 3 });
  assert.equal(overStep.ok, true);
  assert.equal(overStep.nextProduct, 36);
  // ぴったり一致で完了できる
  const last = checkFactorStep({ target: 24, currentProduct: 12, value: 2 });
  assert.equal(last.ok, true);
  assert.equal(last.nextProduct, 24);
  assert.equal(productOf([2, 2, 2, 3]), 24);
});

test('割り算式の判定: 含まれる素因数だけが割れ、違う素数は弾く', () => {
  // 360 を 2 で割る → 残り180
  assert.deepEqual(checkFactorDivideStep({ remaining: 360, value: 2 }), {
    ok: true,
    value: 2,
    nextRemaining: 180,
  });
  // 残り12を 5 では割り切れない → 含まれる素因数ではない
  assert.equal(checkFactorDivideStep({ remaining: 12, value: 5 }).reason, 'not-a-factor');
  // 14 のような合成数は「素数を入力してください」側（not-prime）が優先
  assert.equal(checkFactorDivideStep({ remaining: 360, value: 14 }).reason, 'not-prime');
  // 1 や 0 は素数として扱わない
  assert.equal(checkFactorDivideStep({ remaining: 360, value: 1 }).reason, 'too-small');
  // 残りが1になる手が完了手になる
  const last = checkFactorDivideStep({ remaining: 7, value: 7 });
  assert.equal(last.ok, true);
  assert.equal(last.nextRemaining, 1);
});

test('生成: 桁数・下限〜上限・素因数の個数を満たす合成数だけを出す', () => {
  for (let seed = 0; seed < 30; seed++) {
    let i = seed;
    const rng = () => {
      i = (i * 1103515245 + 12345) % 2147483648;
      return i / 2147483648;
    };
    const p = generateFactorPuzzle({
      digits: 3,
      minPrime: 5,
      maxPrime: 13,
      countMin: 3,
      countMax: 4,
      rng,
    });
    assert.ok(p, `seed=${seed}`);
    assert.ok(p.value >= 100 && p.value <= 999, `value=${p.value}`);
    assert.ok(p.factors.length >= 3 && p.factors.length <= 4);
    assert.ok(p.factors.every((f) => f >= 5 && f <= 13 && isPrime(f)));
    assert.equal(productOf(p.factors), p.value);
    assert.deepEqual(factorize(p.value), p.factors);
  }
});

test('桁数は2〜8に丸める（8桁モードあり）', () => {
  assert.equal(clampFactorDigits(1), 2);
  assert.equal(clampFactorDigits(8), 8);
  assert.equal(clampFactorDigits(99), 8);
});

test('生成: 8桁の合成数も作れる', () => {
  let i = 7;
  const rng = () => {
    i = (i * 1103515245 + 12345) % 2147483648;
    return i / 2147483648;
  };
  const p = generateFactorPuzzle({
    digits: 8,
    minPrime: 2,
    maxPrime: 47,
    countMin: 6,
    countMax: 10,
    rng,
    maxAttempts: 200_000,
  });
  assert.ok(p, '8桁の問題が生成できること');
  assert.ok(p.value >= 10_000_000 && p.value <= 99_999_999, `value=${p.value}`);
  assert.equal(productOf(p.factors), p.value);
  assert.deepEqual(factorize(p.value), p.factors);
});

test('生成: 作れない組み合わせは null（例: 5桁・素因数2個・上限5）', () => {
  const p = generateFactorPuzzle({
    digits: 5,
    minPrime: 2,
    maxPrime: 5,
    countMin: 2,
    countMax: 2,
    rng: () => 0.5,
    maxAttempts: 200,
  });
  assert.equal(p, null);
});
