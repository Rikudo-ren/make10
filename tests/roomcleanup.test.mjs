import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAnyPlayer } from '../src/lib/roomCleanup.ts';

test('hasAnyPlayer: 名前がある在室者がいれば true', () => {
  assert.equal(hasAnyPlayer({ u1: { name: 'aaa' } }), true);
  assert.equal(hasAnyPlayer({ u1: { name: 'aaa' }, u2: { name: 'bbb', left: true } }), true);
});

test('hasAnyPlayer: 退出者だけの部屋は「誰もいない」として掃除できる', () => {
  assert.equal(hasAnyPlayer({ u1: { name: 'aaa', left: true } }), false);
  assert.equal(hasAnyPlayer({ u1: { score: 30 }, u2: { name: 'bbb', left: true } }), false);
});

test('hasAnyPlayer: 空・未定義は false', () => {
  assert.equal(hasAnyPlayer(null), false);
  assert.equal(hasAnyPlayer(undefined), false);
  assert.equal(hasAnyPlayer({}), false);
  assert.equal(hasAnyPlayer({ u1: { score: 5 } }), false);
});
