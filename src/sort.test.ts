import assert from 'node:assert/strict';
import test from 'node:test';
import { sortBy } from './sort';

const names = (items: Array<{ n: string | number | null }>) => items.map((i) => i.n);

test('strings sort naturally, both directions', () => {
  const items = [{ n: 'shard10' }, { n: 'shard2' }, { n: 'shard1' }];
  assert.deepEqual(names(sortBy(items, (i) => i.n, 'asc')), ['shard1', 'shard2', 'shard10']);
  assert.deepEqual(names(sortBy(items, (i) => i.n, 'desc')), ['shard10', 'shard2', 'shard1']);
});

test('missing values sink to the bottom whichever way', () => {
  const items = [{ n: null }, { n: 3 }, { n: 1 }];
  assert.deepEqual(names(sortBy(items, (i) => i.n, 'asc')), [1, 3, null]);
  assert.deepEqual(names(sortBy(items, (i) => i.n, 'desc')), [3, 1, null]);
});

test('the input array is left untouched', () => {
  const items = [{ n: 2 }, { n: 1 }];
  sortBy(items, (i) => i.n, 'asc');
  assert.deepEqual(names(items), [2, 1]);
});
