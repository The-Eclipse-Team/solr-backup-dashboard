import assert from 'node:assert/strict';
import test from 'node:test';
import { extractHealth, mergeHealth } from './health';
import type { RunReport } from './health';

// Run with: npm test  (node's own test runner through tsx — no framework)

function report(startedAt: string, shards: RunReport['collections'][number]['shards']): RunReport {
  return {
    runId: `run-${startedAt}`,
    cluster: 'custom',
    environment: 'custom',
    status: 'SUCCESS',
    startedAt,
    finishedAt: startedAt,
    parallelBackups: 2,
    counts: {},
    collections: [{ alias: 'test_alias', collection: 'test', shards }],
  };
}

const succeeded = (shardName: string, finishedAt: string) => ({
  shardName,
  coreName: `test_${shardName}_replica_n1`,
  status: 'SUCCESS',
  finishedAt,
  attempts: [{ status: 'SUCCESS', finishedAt }],
});

test('a shard keeps its last successful backup from an older run', () => {
  const merged = mergeHealth(
    [
      extractHealth(report('2026-08-01T10:00:00Z', [succeeded('shard1', '2026-08-01T10:05:00Z')])),
      // Latest run failed this shard outright — the older success is still the last good backup.
      extractHealth(
        report('2026-08-03T10:00:00Z', [
          { shardName: 'shard1', status: 'ERROR', finishedAt: null, attempts: [{ status: 'ERROR', finishedAt: '2026-08-03T10:02:00Z' }] },
        ]),
      ),
    ],
    168,
  );

  assert.equal(merged.collections.length, 1);
  assert.deepEqual(
    merged.collections[0].shards.map((s) => [s.shardName, s.lastSuccessAt]),
    [['shard1', '2026-08-01T10:05:00Z']],
  );
  assert.equal(merged.historyFrom, '2026-08-01T10:00:00Z');
  assert.equal(merged.runCount, 2);
  assert.equal(merged.staleAfterHours, 168);
});

test('the newest run defines which shards exist', () => {
  const merged = mergeHealth(
    [
      // shard3 was dropped by a re-shard; it must not linger as a permanently missing shard.
      extractHealth(
        report('2026-08-01T10:00:00Z', [succeeded('shard1', '2026-08-01T10:05:00Z'), succeeded('shard3', '2026-08-01T10:06:00Z')]),
      ),
      extractHealth(report('2026-08-03T10:00:00Z', [succeeded('shard1', '2026-08-03T10:05:00Z'), succeeded('shard2', '2026-08-03T10:06:00Z')])),
    ],
    168,
  );

  assert.deepEqual(
    merged.collections[0].shards.map((s) => [s.shardName, s.lastSuccessAt]),
    [
      ['shard1', '2026-08-03T10:05:00Z'],
      ['shard2', '2026-08-03T10:06:00Z'],
    ],
  );
});

test('a shard that never succeeded has no last success, and a running one keeps its older one', () => {
  const merged = mergeHealth(
    [
      extractHealth(report('2026-08-01T10:00:00Z', [succeeded('shard1', '2026-08-01T10:05:00Z')])),
      extractHealth(
        report('2026-08-03T10:00:00Z', [
          { shardName: 'shard1', status: 'RUNNING', finishedAt: null, attempts: [{ status: 'RUNNING', finishedAt: null }] },
          { shardName: 'shard2', status: 'ERROR', finishedAt: null, attempts: [{ status: 'ERROR', finishedAt: '2026-08-03T10:01:00Z' }] },
        ]),
      ),
    ],
    168,
  );

  assert.deepEqual(
    merged.collections[0].shards.map((s) => [s.shardName, s.lastSuccessAt]),
    [
      ['shard1', '2026-08-01T10:05:00Z'],
      ['shard2', null],
    ],
  );
});

test('legacy reports without attempts fall back to the shard status', () => {
  const merged = mergeHealth(
    [
      extractHealth(report('2026-08-01T10:00:00Z', [{ shardName: 'shard1', status: 'SUCCESS', finishedAt: '2026-08-01T10:05:00Z' }])),
      extractHealth(report('2026-08-02T10:00:00Z', [{ shardName: 'shard1', status: 'ERROR', finishedAt: '2026-08-02T10:05:00Z' }])),
    ],
    168,
  );

  assert.equal(merged.collections[0].shards[0].lastSuccessAt, '2026-08-01T10:05:00Z');
});

test('sub-second precision is compared as time, not as text', () => {
  // Solr's instants carry a variable number of fractional digits: "…31Z" sorts after "…31.9Z" as a
  // string, but is a fifth of a second earlier.
  const merged = mergeHealth(
    [
      extractHealth(report('2026-08-01T10:00:00Z', [succeeded('shard1', '2026-08-01T10:05:31.900Z')])),
      extractHealth(report('2026-08-01T10:01:00Z', [succeeded('shard1', '2026-08-01T10:05:31Z')])),
    ],
    168,
  );

  assert.equal(merged.collections[0].shards[0].lastSuccessAt, '2026-08-01T10:05:31.900Z');
});
