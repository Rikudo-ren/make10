import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRankPoints } from '../src/lib/scoring.ts';

test('順位別の配点と得点対象外', () => {
  assert.equal(getRankPoints(1, 3, 'rank'), 3);
  assert.equal(getRankPoints(3, 3, 'rank'), 1);
  assert.equal(getRankPoints(4, 3, 'rank'), 0);
  assert.equal(getRankPoints(1, 1, 'first'), 1);
  assert.equal(getRankPoints(2, 1, 'first'), 0);
  assert.equal(getRankPoints(4, 10, 'flat'), 1);
  assert.equal(getRankPoints(1, 4, 'custom', [10, 5, 2, 0]), 10);
  assert.equal(getRankPoints(4, 4, 'custom', [10, 5, 2, 0]), 0);
  assert.equal(getRankPoints(5, 4, 'custom', [10, 5, 2, 0, 99]), 0);
  assert.equal(getRankPoints(3, 4, 'custom', [10, 5]), 0);
});
