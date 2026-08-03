/**
 * Collection health: when each shard of each collection last backed up successfully, derived from the
 * whole report history in REPORT_DIR rather than from a single run. The runs list answers "how did this
 * run go"; this answers "is everything still being backed up".
 *
 * Everything here is pure — no filesystem, no express — so the merge rules can be tested on plain
 * objects (server/health.test.ts). server/index.ts does the reading and caching.
 */

/** The RunReport JSON the backupper writes (report/RunReport.java), as far as health cares about it. */
export interface RunReport {
  runId: string;
  cluster: string;
  environment: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  parallelBackups: number;
  counts: Record<string, number>;
  collections: Array<{
    alias: string;
    collection: string;
    shards: Array<{
      shardName: string;
      coreName?: string | null;
      status?: string;
      finishedAt?: string | null;
      attempts?: Array<{ status?: string; finishedAt?: string | null }>;
    }>;
  }>;
}

export interface ShardHealth {
  shardName: string;
  coreName: string | null;
  /** ISO instant of the most recent successful backup, or null if there has never been one. */
  lastSuccessAt: string | null;
}

export interface CollectionHealth {
  cluster: string;
  alias: string;
  collection: string;
  shards: ShardHealth[];
}

/** One report's contribution: which shards it covered, and when each of them last succeeded in it. */
export interface HealthEntry {
  startedAt: string;
  collections: CollectionHealth[];
}

export interface HealthPayload {
  /** How old a successful backup may be before the UI calls the shard stale. */
  staleAfterHours: number;
  /** Start of the oldest report still on disk — health can see no further back than this. */
  historyFrom: string | null;
  runCount: number;
  collections: CollectionHealth[];
}

/** The later of two ISO instants, either of which may be null. Parsed rather than compared as strings: Solr's instants carry a variable number of fractional digits, and "…:31Z" sorts after "…:31.9Z". */
function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b) > Date.parse(a) ? b : a;
}

/**
 * When a shard last finished a successful backup within one run. Reports written before the backupper
 * tracked attempts carry no `attempts` array, so fall back to the shard's own status/finishedAt.
 */
function lastSuccessOf(shard: RunReport['collections'][number]['shards'][number]): string | null {
  const attempts = shard.attempts ?? [];
  if (attempts.length === 0) {
    return shard.status === 'SUCCESS' ? shard.finishedAt ?? null : null;
  }
  return attempts
    .filter((attempt) => attempt.status === 'SUCCESS')
    .reduce<string | null>((latest, attempt) => laterOf(latest, attempt.finishedAt ?? null), null);
}

/** Reduces a full report to the small slice health needs, so the rest of it never has to be kept. */
export function extractHealth(report: RunReport): HealthEntry {
  return {
    startedAt: report.startedAt,
    collections: (report.collections ?? []).map((col) => ({
      cluster: report.cluster,
      alias: col.alias,
      collection: col.collection,
      shards: (col.shards ?? []).map((shard) => ({
        shardName: shard.shardName,
        coreName: shard.coreName ?? null,
        lastSuccessAt: lastSuccessOf(shard),
      })),
    })),
  };
}

/**
 * Merges every report's contribution into one health view.
 *
 * The **newest** report that mentions a collection defines which shards it currently has — a collection
 * dropped from the whitelist, or a shard removed by re-sharding, stops being listed rather than sitting
 * there as permanently missing. The last successful backup is then taken from anywhere in the history, so
 * a shard that is mid-backup right now (or failed its latest run) still shows its last good backup.
 *
 * Collections are keyed by cluster as well as name: one shared report directory can hold several
 * backupper instances' runs, and a collection in one cluster is not the same thing as in another.
 */
export function mergeHealth(entries: HealthEntry[], staleAfterHours: number): HealthPayload {
  const topology = new Map<string, { entryStartedAt: string; collection: CollectionHealth }>();
  const lastSuccess = new Map<string, string>();
  let historyFrom: string | null = null;

  for (const entry of entries) {
    historyFrom = historyFrom && Date.parse(historyFrom) <= Date.parse(entry.startedAt) ? historyFrom : entry.startedAt;

    for (const col of entry.collections) {
      const key = `${col.cluster}::${col.collection}`;
      const known = topology.get(key);
      if (!known || Date.parse(entry.startedAt) > Date.parse(known.entryStartedAt)) {
        topology.set(key, { entryStartedAt: entry.startedAt, collection: col });
      }
      for (const shard of col.shards) {
        if (!shard.lastSuccessAt) continue;
        const shardKey = `${key}::${shard.shardName}`;
        lastSuccess.set(shardKey, laterOf(lastSuccess.get(shardKey) ?? null, shard.lastSuccessAt)!);
      }
    }
  }

  const collections = [...topology].map(([key, { collection }]) => ({
    ...collection,
    shards: collection.shards.map((shard) => ({
      ...shard,
      lastSuccessAt: lastSuccess.get(`${key}::${shard.shardName}`) ?? null,
    })),
  }));
  collections.sort((a, b) => a.alias.localeCompare(b.alias) || a.collection.localeCompare(b.collection));

  return { staleAfterHours, historyFrom, runCount: entries.length, collections };
}
