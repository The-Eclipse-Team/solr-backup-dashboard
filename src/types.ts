// Mirrors the RunReport JSON written by solr-backupper (report/RunReport.java).

export type ShardStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR';
export type RunStatus = 'ACTIVE' | 'SUCCESS' | 'ERROR';

export interface Counts {
  pending: number;
  running: number;
  success: number;
  errored: number;
  total: number;
}

export interface ShardAttempt {
  attempt: number;
  status: ShardStatus;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  // The leader this attempt ran against. The shard-level pair only names the most recent one, so a
  // failover between attempts is visible here alone. Null when the attempt failed before resolving a
  // leader, and absent on reports written before the backupper tracked the leader per attempt.
  coreName?: string | null;
  leaderUrl?: string | null;
  // File-copy progress Solr reports while the backup runs. Null until the core resolves its file list,
  // and absent entirely on reports written before the backupper tracked progress.
  fileCount?: number | null;
  finishedFileCount?: number | null;
}

export interface ShardReport {
  shardName: string;
  coreName: string;
  leaderUrl: string;
  status: ShardStatus;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  // One entry per backup attempt (initial try + retries). May be absent on legacy reports.
  attempts?: ShardAttempt[];
}

export interface CollectionReport {
  alias: string;
  collection: string;
  shards: ShardReport[];
}

export interface RunReport {
  runId: string;
  cluster: string;
  environment: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  parallelBackups: number;
  counts: Counts;
  collections: CollectionReport[];
}

/**
 * Shapes returned by GET /api/health (server/health.ts) — derived from every report in the directory
 * rather than one run. The server reports when each shard last succeeded and how old that may get; the
 * healthy/stale/missing call is made here so the label always agrees with the ticking age beside it.
 */
export type HealthStatus = 'healthy' | 'stale' | 'missing';

export interface ShardHealth {
  shardName: string;
  coreName: string | null;
  lastSuccessAt: string | null;
}

export interface CollectionHealth {
  cluster: string;
  alias: string;
  collection: string;
  shards: ShardHealth[];
}

export interface HealthReport {
  staleAfterHours: number;
  /** Start of the oldest report still on disk — health can see no further back than this. */
  historyFrom: string | null;
  runCount: number;
  collections: CollectionHealth[];
}

/** Shape returned by GET /api/reports (server-side summary of each RunReport). */
export interface RunSummary {
  runId: string;
  cluster: string;
  environment: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  parallelBackups: number;
  counts: Counts;
  collectionCount: number;
  shardDone: number;
  shardTotal: number;
}
