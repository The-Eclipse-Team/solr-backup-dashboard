import type { CollectionReport, HealthStatus, RunStatus, ShardAttempt, ShardReport, ShardStatus } from './types';

export interface StatusMeta {
  label: string;
  bg: string;
  fg: string;
  dot: string;
}

// Shard-level palette (keyed by lowercased ShardStatus), ported from the design's STATUS_META.
const SHARD_META: Record<string, StatusMeta> = {
  pending: { label: 'Pending', bg: 'rgba(255,255,255,.06)', fg: '#9aa0ab', dot: '#6b7280' },
  running: { label: 'Running', bg: 'rgba(59,130,246,.14)', fg: '#7dabf8', dot: '#3b82f6' },
  success: { label: 'Success', bg: 'rgba(34,197,94,.14)', fg: '#6ee7a0', dot: '#22c55e' },
  error: { label: 'Error', bg: 'rgba(239,68,68,.14)', fg: '#fb9d9d', dot: '#ef4444' },
};

// Run-level palette (keyed by lowercased RunStatus). A run is Active, then Success or Error — a timed-out
// shard makes the whole run Error, so there is no separate "partial" run state.
const RUN_META: Record<string, StatusMeta> = {
  active: { label: 'Active', bg: 'rgba(59,130,246,.14)', fg: '#7dabf8', dot: '#3b82f6' },
  success: { label: 'Success', bg: 'rgba(34,197,94,.14)', fg: '#6ee7a0', dot: '#22c55e' },
  error: { label: 'Error', bg: 'rgba(239,68,68,.14)', fg: '#fb9d9d', dot: '#ef4444' },
};

export function shardMeta(status: ShardStatus): StatusMeta {
  return SHARD_META[status.toLowerCase()] ?? SHARD_META.pending;
}

export function runMeta(status: RunStatus): StatusMeta {
  return RUN_META[status.toLowerCase()] ?? RUN_META.active;
}

// Collection-health palette. Stale gets its own amber: a backup that exists but has aged out is a
// different problem from one that was never taken, and flattening both to red hides which is which.
const HEALTH_META: Record<HealthStatus, StatusMeta> = {
  healthy: { label: 'Healthy', bg: 'rgba(34,197,94,.14)', fg: '#6ee7a0', dot: '#22c55e' },
  stale: { label: 'Stale', bg: 'rgba(245,158,11,.14)', fg: '#fbbf58', dot: '#f59e0b' },
  missing: { label: 'Missing', bg: 'rgba(239,68,68,.14)', fg: '#fb9d9d', dot: '#ef4444' },
};

const INCOMPLETE_META: StatusMeta = { label: 'Incomplete', bg: 'rgba(239,68,68,.14)', fg: '#fb9d9d', dot: '#ef4444' };

export function healthMeta(health: HealthStatus): StatusMeta {
  return HEALTH_META[health];
}

/** A collection is Healthy only when every one of its shards is; anything else is Incomplete. */
export function collectionHealthMeta(shards: HealthStatus[]): StatusMeta {
  return shards.every((health) => health === 'healthy') ? HEALTH_META.healthy : INCOMPLETE_META;
}

/**
 * How a shard's last successful backup reads right now. `staleAfterHours` comes from the server (the
 * dashboard's STALE_AFTER_HOURS), so the threshold has one definition and the UI can re-evaluate it on
 * every tick without another request.
 */
export function shardHealth(lastSuccessAt: string | null, staleAfterHours: number, now: number): HealthStatus {
  if (!lastSuccessAt) return 'missing';
  return now - new Date(lastSuccessAt).getTime() > staleAfterHours * 3600_000 ? 'stale' : 'healthy';
}

/** The threshold as prose for the stale note — "7 days" reads better than "168h" where it divides. */
export function formatThreshold(staleAfterHours: number): string {
  if (staleAfterHours % 24 === 0) {
    const days = staleAfterHours / 24;
    return days === 1 ? '1 day' : `${days} days`;
  }
  return `${staleAfterHours}h`;
}

export function healthNote(health: HealthStatus, staleAfterHours: number): string {
  if (health === 'missing') return 'No successful backup in this history — needs a manual backup';
  if (health === 'stale') return `Last backup over ${formatThreshold(staleAfterHours)} ago`;
  return '—';
}

/**
 * Coarse "how long ago", for ages measured in days. Deliberately not formatDuration: that renders
 * h:mm:ss, which degrades to 192:14:03 once a backup is a week old.
 */
export function formatAge(iso: string | null, now: number): string {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ago`;
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/** Roll a collection's shards up to a single status for the collection header chip. */
export function computeCollectionStatus(shards: ShardReport[]): ShardStatus {
  if (shards.some((s) => s.status === 'ERROR')) return 'ERROR';
  if (shards.some((s) => s.status === 'RUNNING')) return 'RUNNING';
  if (shards.some((s) => s.status === 'PENDING')) return 'PENDING';
  return 'SUCCESS';
}

export function collectionKey(col: CollectionReport): string {
  return `${col.alias} ${col.collection}`;
}

/**
 * An attempt's file-copy progress, or null when the core has not reported a file list yet (a backup
 * still waiting for its index commit, or a report written before the backupper tracked progress).
 */
export function fileProgress(attempt: ShardAttempt | undefined): { label: string; pct: number } | null {
  if (!attempt || attempt.fileCount == null || attempt.finishedFileCount == null) return null;
  const total = attempt.fileCount;
  const done = attempt.finishedFileCount;
  return { label: `${done}/${total}`, pct: total > 0 ? Math.min(100, (done / total) * 100) : 0 };
}

/**
 * Time since the attempt's file count last moved, ticking live — a running copy whose value keeps climbing
 * is stalled. Only meaningful while the attempt runs, so finished attempts (and older reports) show "—".
 */
export function sinceLastFile(attempt: ShardAttempt | undefined, now: number): number | null {
  if (attempt?.status !== 'RUNNING' || !attempt.lastProgressAt) return null;
  return Math.max(0, now - new Date(attempt.lastProgressAt).getTime());
}

/**
 * An attempt's leader as a host label plus a link to the core's replication status — the very URL the
 * backupper polls (`{origin}/solr/{core}/replication?command=details`), fetched through /api/replication so
 * the server can attach SOLR_AUTHORIZATION. Null when the attempt never resolved a leader, or when leaderUrl
 * is unparseable — a bad report must not blank the view.
 */
export function coreDetails(attempt: ShardAttempt): { host: string; url: string } | null {
  if (!attempt.leaderUrl || !attempt.coreName) return null;
  try {
    const { hostname } = new URL(attempt.leaderUrl);
    const query = new URLSearchParams({ leader: attempt.leaderUrl, core: attempt.coreName });
    return { host: hostname, url: `/api/replication?${query}` };
  } catch {
    return null;
  }
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatClock(now: number): string {
  return new Date(now).toLocaleTimeString('en-US', { hour12: false });
}

export function formatClockTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const isToday = d.toDateString() === new Date().toDateString();
  const time = formatClockTime(iso);
  return isToday ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export function formatDuration(startedAt: string | null, finishedAt: string | null, now: number): string {
  if (!startedAt) return '—';
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  const s = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
