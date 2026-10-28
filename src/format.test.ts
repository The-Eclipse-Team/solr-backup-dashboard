import assert from 'node:assert/strict';
import test from 'node:test';
import { collectionHealthMeta, formatAge, formatThreshold, healthNote, shardHealth, sinceLastFile } from './format';
import type { ShardAttempt } from './types';

// Run with: npm test  (node's own test runner through tsx — no framework)

const now = Date.parse('2026-08-03T12:00:00Z');
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

test('a shard is stale only once it is past the threshold', () => {
  assert.equal(shardHealth(hoursAgo(167), 168, now), 'healthy');
  assert.equal(shardHealth(hoursAgo(168), 168, now), 'healthy', 'exactly at the threshold is still healthy');
  assert.equal(shardHealth(hoursAgo(169), 168, now), 'stale');
  assert.equal(shardHealth(null, 168, now), 'missing');
});

test('a collection is healthy only when every shard is', () => {
  assert.equal(collectionHealthMeta(['healthy', 'healthy']).label, 'Healthy');
  assert.equal(collectionHealthMeta(['healthy', 'stale']).label, 'Incomplete');
  assert.equal(collectionHealthMeta(['missing']).label, 'Incomplete');
  // A collection with no shards at all has nothing wrong with it.
  assert.equal(collectionHealthMeta([]).label, 'Healthy');
});

test('age reads in the units that matter, not h:mm:ss', () => {
  assert.equal(formatAge(hoursAgo(200), now), '8d 8h ago');
  assert.equal(formatAge(hoursAgo(5), now), '5h 0m ago');
  assert.equal(formatAge(new Date(now - 90_000).toISOString(), now), '1m ago');
  assert.equal(formatAge(new Date(now - 5_000).toISOString(), now), 'just now');
  assert.equal(formatAge(null, now), '—');
  // A report written on a clock slightly ahead of ours must not read as a negative age.
  assert.equal(formatAge(new Date(now + 5_000).toISOString(), now), 'just now');
});

test('the threshold reads as days where it divides into them', () => {
  assert.equal(formatThreshold(168), '7 days');
  assert.equal(formatThreshold(24), '1 day');
  assert.equal(formatThreshold(36), '36h');
  assert.match(healthNote('stale', 168), /over 7 days ago/);
  assert.match(healthNote('missing', 168), /needs a manual backup/);
  assert.equal(healthNote('healthy', 168), '—');
});

test('sinceLastFile only measures running attempts that have reported progress', () => {
  const now = Date.parse('2026-07-06T12:00:00Z');
  const attempt = (status: ShardAttempt['status'], lastProgressAt?: string | null): ShardAttempt =>
    ({ attempt: 1, status, startedAt: null, finishedAt: null, error: null, lastProgressAt });
  assert.equal(sinceLastFile(attempt('RUNNING', '2026-07-06T11:59:30Z'), now), 30_000);
  assert.equal(sinceLastFile(attempt('SUCCESS', '2026-07-06T11:59:30Z'), now), null);
  assert.equal(sinceLastFile(attempt('RUNNING', null), now), null);
  assert.equal(sinceLastFile(attempt('RUNNING'), now), null);
  assert.equal(sinceLastFile(undefined, now), null);
});
