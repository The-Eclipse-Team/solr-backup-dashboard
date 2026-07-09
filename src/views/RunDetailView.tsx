import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { StatGrid } from '../components/StatCard';
import type { StatDef } from '../components/StatCard';
import { Chip } from '../components/Chip';
import { Dot, StatusPill } from '../components/atoms';
import { Pagination, paginate, pageCountFor, DEFAULT_PAGE_SIZE } from '../components/Pagination';
import type { PageSize } from '../components/Pagination';
import { usePolling, useNow } from '../api';
import type { CollectionReport, RunReport, ShardReport } from '../types';
import {
  shardMeta,
  computeCollectionStatus,
  collectionKey,
  formatClock,
  formatClockTime,
  formatDuration,
} from '../format';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'ERROR', label: 'Error' },
];

const SHARD_COLS = '1.6fr 1fr 1fr 1fr 2.4fr';
const ATTEMPT_COLS = '0.7fr 1fr 1fr 1fr 2.6fr';

// One shard row. When the shard was retried (more than one attempt), a badge expands an inline table
// showing each attempt's status, start time, duration and error.
function ShardRow({ sh, now }: { sh: ShardReport; now: number }) {
  const attempts = sh.attempts ?? [];
  const retried = attempts.length > 1;
  const [open, setOpen] = useState(false);
  const meta = shardMeta(sh.status);

  return (
    <>
      <div className="trow" style={{ gridTemplateColumns: SHARD_COLS }}>
        <div className="cell-stack">
          <span className="cell-title sans">{sh.shardName}</span>
          <span className="cell-sub mono">{sh.coreName}</span>
        </div>
        <div className="status-col">
          <Dot color={meta.dot} pulse={sh.status === 'RUNNING'} />
          <span className="status-label">{meta.label}</span>
          {retried && (
            <button type="button" className="retry-badge" onClick={() => setOpen((o) => !o)} title="Show every attempt">
              ⟳ {attempts.length} attempts {open ? '▲' : '▼'}
            </button>
          )}
        </div>
        <span className="mono">{formatClockTime(sh.startedAt)}</span>
        <span className="mono bright">{formatDuration(sh.startedAt, sh.finishedAt, now)}</span>
        <span className="error-cell" title={sh.error ?? ''}>
          {sh.error ?? '—'}
        </span>
      </div>

      {retried && open && (
        <div className="attempts">
          <div className="attempts-head" style={{ gridTemplateColumns: ATTEMPT_COLS }}>
            <span>Attempt</span>
            <span>Status</span>
            <span>Started</span>
            <span>Duration</span>
            <span>Error</span>
          </div>
          {attempts.map((a) => {
            const am = shardMeta(a.status);
            return (
              <div className="attempts-row" style={{ gridTemplateColumns: ATTEMPT_COLS }} key={a.attempt}>
                <span className="mono">#{a.attempt}</span>
                <div className="status-col">
                  <Dot color={am.dot} pulse={a.status === 'RUNNING'} size={6} />
                  <span className="status-label">{am.label}</span>
                </div>
                <span className="mono">{formatClockTime(a.startedAt)}</span>
                <span className="mono bright">{formatDuration(a.startedAt, a.finishedAt, now)}</span>
                <span className="error-cell" title={a.error ?? ''}>
                  {a.error ?? '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// One collapsible collection with its own, independent shard pagination.
function CollectionSection({
  col,
  shards,
  isExpanded,
  onToggle,
  filterKey,
  now,
}: {
  col: CollectionReport;
  shards: ShardReport[];
  isExpanded: boolean;
  onToggle: () => void;
  filterKey: string;
  now: number;
}) {
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  // Reset to the first page when the search/status filter changes — but not on live data ticks.
  useEffect(() => setPage(1), [filterKey]);

  const pageCount = pageCountFor(shards.length, pageSize);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const visible = paginate(shards, currentPage, pageSize);

  const overall = shardMeta(computeCollectionStatus(col.shards));
  const done = col.shards.filter((s) => s.status === 'SUCCESS').length;

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
          <span className="cell-sub mono">{col.collection}</span>
        </div>
        <span className="collection-progress">
          {done}/{col.shards.length} shards done
        </span>
        <StatusPill label={overall.label} bg={overall.bg} fg={overall.fg} />
      </div>

      {isExpanded && (
        <div>
          <div className="thead" style={{ gridTemplateColumns: SHARD_COLS, borderTop: '1px solid var(--border-soft)' }}>
            <span>Shard / core</span>
            <span>Status</span>
            <span>Started</span>
            <span>Duration</span>
            <span>Error</span>
          </div>
          {visible.map((sh) => (
            <ShardRow sh={sh} now={now} key={sh.shardName} />
          ))}
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

export function RunDetailView({ runId, onBack }: { runId: string; onBack: () => void }) {
  const { data: run, error, loading } = usePolling<RunReport>(`/api/reports/${encodeURIComponent(runId)}`, 2000);
  const now = useNow();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  // Expand every collection once the run first loads.
  useEffect(() => {
    if (run && expanded === null) {
      setExpanded(new Set(run.collections.map(collectionKey)));
    }
  }, [run, expanded]);

  if (!run) {
    return (
      <>
        <Header onBack={onBack} />
        <div className="body">
          <div className="empty-state">
            {loading ? 'Loading run…' : error ? `Failed to load run: ${error}` : 'Run not found.'}
          </div>
        </div>
      </>
    );
  }

  const isActive = run.status === 'ACTIVE';

  const stats: StatDef[] = [
    { key: 'running', label: 'Running now', value: run.counts.running, dot: shardMeta('RUNNING').dot },
    { key: 'success', label: 'Succeeded', value: run.counts.success, dot: shardMeta('SUCCESS').dot },
    { key: 'error', label: 'Errors', value: run.counts.errored, dot: shardMeta('ERROR').dot },
    { key: 'pending', label: 'Pending', value: run.counts.pending, dot: shardMeta('PENDING').dot },
  ];

  const q = search.trim().toLowerCase();
  const filterKey = `${statusFilter}|${q}`;
  const expandedSet = expanded ?? new Set<string>();
  const groups = run.collections
    .map((col) => {
      const shards = col.shards.filter((sh) => {
        const matchStatus = statusFilter === 'all' || sh.status === statusFilter;
        const matchSearch =
          !q ||
          col.alias.toLowerCase().includes(q) ||
          col.collection.toLowerCase().includes(q) ||
          sh.shardName.toLowerCase().includes(q) ||
          sh.coreName.toLowerCase().includes(q);
        return matchStatus && matchSearch;
      });
      return { col, shards };
    })
    .filter((g) => g.shards.length > 0);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <Header badge={run.environment} onBack={onBack}>
        <div className="header-meta">
          <span>{run.cluster}</span>
          <span>run {run.runId}</span>
          <span>started {formatClockTime(run.startedAt)}</span>
          <span>parallelism {run.parallelBackups}</span>
          {isActive && (
            <span className="live-row">
              <Dot color="#3b82f6" pulse size={6} />
              {formatClock(now)}
            </span>
          )}
        </div>
      </Header>

      <StatGrid stats={stats} columns={4} />

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search alias, collection, shard, core…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="chip-row">
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)} />
          ))}
        </div>
      </div>

      <div className="body">
        {groups.length === 0 ? (
          <div className="empty-state">No shards match the current filter.</div>
        ) : (
          groups.map(({ col, shards }) => {
            const key = collectionKey(col);
            return (
              <CollectionSection
                key={key}
                col={col}
                shards={shards}
                isExpanded={expandedSet.has(key)}
                onToggle={() => toggle(key)}
                filterKey={filterKey}
                now={now}
              />
            );
          })
        )}
      </div>
    </>
  );
}
