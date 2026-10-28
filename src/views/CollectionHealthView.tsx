import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Header } from '../components/Header';
import { StatGrid } from '../components/StatCard';
import type { StatDef } from '../components/StatCard';
import { Chip } from '../components/Chip';
import { Dot, StatusPill } from '../components/atoms';
import { Pagination, paginate, pageCountFor, DEFAULT_PAGE_SIZE } from '../components/Pagination';
import type { PageSize } from '../components/Pagination';
import { usePolling, useNow } from '../api';
import type { CollectionHealth, HealthReport, HealthStatus, ShardHealth } from '../types';
import {
  collectionHealthMeta,
  formatAge,
  formatClock,
  formatDateTime,
  formatThreshold,
  healthMeta,
  healthNote,
  shardHealth,
} from '../format';
import { SortHeader } from '../components/SortHeader';
import { time, useSort } from '../sort';

const HEALTH_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'incomplete', label: 'Incomplete' },
  // Incomplete collections, narrowed to just their stale/missing shards — the list to act on.
  { value: 'unhealthy', label: 'Unhealthy shards' },
];

const SHARD_COLS = '1.4fr 1fr 1fr .9fr 1.7fr';

const SHARD_COLUMNS = [
  { key: 'shard', label: 'Shard' },
  { key: 'health', label: 'Health' },
  { key: 'lastSuccess', label: 'Last success' },
  { key: 'age', label: 'Time since' },
  { key: 'note', label: 'Note' },
];

// Worst first when ascending — the order someone triaging wants.
const HEALTH_RANK: Record<HealthStatus, number> = { missing: 0, stale: 1, healthy: 2 };

// Health is a property of the whole report history, so it barely moves — no reason to poll it as hard
// as the runs list (3s), which is watching a run happen.
const POLL_MS = 10_000;

// Same key the server merges on: one directory can hold several clusters' runs.
function healthKey(col: CollectionHealth): string {
  return `${col.cluster}::${col.collection}`;
}

interface ShardRow extends ShardHealth {
  health: HealthStatus;
}

function CollectionSection({
  col,
  shards,
  isExpanded,
  onToggle,
  filterKey,
  staleAfterHours,
  now,
}: {
  col: CollectionHealth;
  shards: ShardRow[];
  isExpanded: boolean;
  onToggle: () => void;
  filterKey: string;
  staleAfterHours: number;
  now: number;
}) {
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const { sort, toggle, apply } = useSort();

  // Reset to the first page when the search/filter changes — but not on the ticking clock.
  useEffect(() => setPage(1), [filterKey]);

  // Sorted before paginating, so the order spans every page rather than each page on its own.
  const sorted = apply(shards, {
    shard: (sh) => sh.shardName,
    health: (sh) => HEALTH_RANK[sh.health],
    lastSuccess: (sh) => time(sh.lastSuccessAt),
    age: (sh) => (sh.lastSuccessAt ? now - time(sh.lastSuccessAt)! : null),
    note: (sh) => healthNote(sh.health, staleAfterHours),
  });
  const pageCount = pageCountFor(shards.length, pageSize);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const visible = paginate(sorted, currentPage, pageSize);

  // The header summarises the whole collection, not the filtered subset — searching for one shard must
  // not make a collection with a missing one look healthy.
  const all = col.shards.map((sh) => shardHealth(sh.lastSuccessAt, staleAfterHours, now));
  const overall = collectionHealthMeta(all);
  const healthyCount = all.filter((health) => health === 'healthy').length;

  return (
    <div className="collection">
      <div className="collection-header" onClick={onToggle}>
        <span className="chevron" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
        <div className="cell-stack" style={{ flex: 1 }}>
          <span className="cell-title sans" style={{ fontSize: 13.5 }}>
            {col.alias}
          </span>
          <span className="cell-sub mono">
            {col.collection} · {col.cluster}
          </span>
        </div>
        <span className="collection-progress">
          {healthyCount}/{col.shards.length} shards healthy
        </span>
        <StatusPill label={overall.label} bg={overall.bg} fg={overall.fg} />
      </div>

      {isExpanded && (
        <div>
          <div className="thead" style={{ gridTemplateColumns: SHARD_COLS, borderTop: '1px solid var(--border-soft)' }}>
            {SHARD_COLUMNS.map((c) => (
              <SortHeader key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={toggle} />
            ))}
          </div>
          {visible.map((sh) => {
            const meta = healthMeta(sh.health);
            const note = healthNote(sh.health, staleAfterHours);
            return (
              <div className="trow" style={{ gridTemplateColumns: SHARD_COLS }} key={sh.shardName}>
                <div className="cell-stack">
                  <span className="cell-title sans">{sh.shardName}</span>
                  {sh.coreName && (
                    <span className="cell-sub mono" title={sh.coreName}>
                      {sh.coreName}
                    </span>
                  )}
                </div>
                <div className="status-col">
                  <Dot color={meta.dot} />
                  <StatusPill label={meta.label} bg={meta.bg} fg={meta.fg} />
                </div>
                <span className="mono">{sh.lastSuccessAt ? formatDateTime(sh.lastSuccessAt) : 'Never'}</span>
                <span className="mono bright">{formatAge(sh.lastSuccessAt, now)}</span>
                <span className="error-cell" title={note}>
                  {note}
                </span>
              </div>
            );
          })}
          <Pagination
            total={shards.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            label="shards"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Which collections still have a recent backup, across the whole report history — the question the runs
 * list cannot answer, because a collection that silently stopped being backed up appears in no run at all.
 */
export function CollectionHealthView({ tabs }: { tabs?: ReactNode }) {
  const { data, error, loading } = usePolling<HealthReport>('/api/health', POLL_MS);
  const now = useNow();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  const collections = useMemo(() => data?.collections ?? [], [data]);
  const staleAfterHours = data?.staleAfterHours ?? 24 * 7;

  // Expand every collection once the first payload lands, as the run detail view does.
  useEffect(() => {
    if (data && expanded === null) setExpanded(new Set(collections.map(healthKey)));
  }, [data, collections, expanded]);

  const stats: StatDef[] = useMemo(() => {
    const perCollection = collections.map((col) =>
      col.shards.map((sh) => shardHealth(sh.lastSuccessAt, staleAfterHours, now)),
    );
    const shards = perCollection.flat();
    const healthy = perCollection.filter((c) => c.every((health) => health === 'healthy')).length;
    return [
      { key: 'healthy', label: 'Healthy collections', value: healthy, dot: healthMeta('healthy').dot },
      {
        key: 'incomplete',
        label: 'Incomplete collections',
        value: collections.length - healthy,
        dot: healthMeta('missing').dot,
      },
      { key: 'stale', label: 'Stale shards', value: shards.filter((h) => h === 'stale').length, dot: healthMeta('stale').dot },
      {
        key: 'missing',
        label: 'Missing shards',
        value: shards.filter((h) => h === 'missing').length,
        dot: healthMeta('missing').dot,
      },
    ];
  }, [collections, staleAfterHours, now]);

  const q = search.trim().toLowerCase();
  const filterKey = `${filter}|${q}`;
  const expandedSet = expanded ?? new Set<string>();

  const groups = collections
    .map((col) => {
      const shards: ShardRow[] = col.shards
        .map((sh) => ({ ...sh, health: shardHealth(sh.lastSuccessAt, staleAfterHours, now) }))
        .filter((sh) => filter !== 'unhealthy' || sh.health !== 'healthy')
        .filter(
          (sh) =>
            !q ||
            col.alias.toLowerCase().includes(q) ||
            col.collection.toLowerCase().includes(q) ||
            col.cluster.toLowerCase().includes(q) ||
            sh.shardName.toLowerCase().includes(q) ||
            (sh.coreName ?? '').toLowerCase().includes(q),
        );
      const allHealthy = col.shards.every((sh) => shardHealth(sh.lastSuccessAt, staleAfterHours, now) === 'healthy');
      return { col, shards, allHealthy };
    })
    .filter((g) => g.shards.length > 0)
    // 'unhealthy' needs no collection test: a collection left with any shard after the filter above is incomplete.
    .filter((g) => filter === 'all' || filter === 'unhealthy' || (filter === 'healthy') === g.allHealthy);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <Header>
        <span className="mono">{formatClock(now)}</span>
      </Header>

      {tabs}

      <StatGrid stats={stats} columns={4} />

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search collection, alias, shard, core…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="chip-row">
          {HEALTH_FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} active={filter === f.value} onClick={() => setFilter(f.value)} />
          ))}
        </div>
      </div>

      <div className="body">
        {groups.length === 0 ? (
          <div className="empty-state">
            {loading
              ? 'Loading…'
              : error
                ? `Failed to load collection health: ${error}`
                : collections.length === 0
                  ? 'No collections found in the report history.'
                  : 'No collections match the current filter.'}
          </div>
        ) : (
          groups.map(({ col, shards }) => {
            const key = healthKey(col);
            return (
              <CollectionSection
                key={key}
                col={col}
                shards={shards}
                isExpanded={expandedSet.has(key)}
                onToggle={() => toggle(key)}
                filterKey={filterKey}
                staleAfterHours={staleAfterHours}
                now={now}
              />
            );
          })
        )}

        {/* Health can only see the reports still on the volume — say so, so "Missing" is not misread. */}
        {data && data.runCount > 0 && (
          <div className="history-note">
            History: {data.runCount} {data.runCount === 1 ? 'run' : 'runs'} since {formatDateTime(data.historyFrom)}. A
            shard is stale once its last successful backup is over {formatThreshold(staleAfterHours)} old.
          </div>
        )}
      </div>
    </>
  );
}
