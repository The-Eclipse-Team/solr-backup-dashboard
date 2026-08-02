import type { CollectionReport, RunStatus, ShardAttempt, ShardReport, ShardStatus } from './types';

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
