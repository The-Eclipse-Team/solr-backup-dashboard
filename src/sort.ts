import { useState } from 'react';

export type SortDir = 'asc' | 'desc';
export type SortValue = string | number | null | undefined;
export interface SortState {
  key: string;
  dir: SortDir;
}

/**
 * A copy of `items` ordered by `value`. Strings compare naturally (shard2 before shard10). Missing values
 * sink to the bottom in both directions — a never-finished run belongs below the finished ones either way.
 */
export function sortBy<T>(items: T[], value: (item: T) => SortValue, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign;
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * sign;
  });
}

/** ISO instant as epoch millis, for sorting; null stays null so it sinks. */
export function time(iso: string | null | undefined): number | null {
  return iso ? new Date(iso).getTime() : null;
}

/** Elapsed millis, still ticking for a running item — the value formatDuration renders. */
export function durationMs(startedAt: string | null, finishedAt: string | null, now: number): number | null {
  return startedAt ? (time(finishedAt) ?? now) - new Date(startedAt).getTime() : null;
}

/**
 * Click-to-sort state for one table. Unsorted (the server's order) until a header is clicked; clicking the
 * active column flips its direction.
 */
export function useSort() {
  const [sort, setSort] = useState<SortState | null>(null);
  const toggle = (key: string) =>
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  /** Apply the current sort, given one accessor per column key. */
  const apply = <T,>(items: T[], columns: Record<string, (item: T) => SortValue>): T[] =>
    sort && columns[sort.key] ? sortBy(items, columns[sort.key], sort.dir) : items;

  return { sort, toggle, apply };
}
