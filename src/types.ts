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
