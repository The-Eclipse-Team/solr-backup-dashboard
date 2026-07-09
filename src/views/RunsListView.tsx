import { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { StatGrid } from '../components/StatCard';
import type { StatDef } from '../components/StatCard';
import { Chip } from '../components/Chip';
import { Dot, StatusPill } from '../components/atoms';
import { Pagination, paginate, pageCountFor, DEFAULT_PAGE_SIZE } from '../components/Pagination';
import type { PageSize } from '../components/Pagination';
import { usePolling, useNow } from '../api';
import type { RunSummary } from '../types';
import { runMeta, formatClock, formatDateTime, formatDuration } from '../format';

const RUN_FILTERS = [
  { value: 'all', label: 'All runs' },
  { value: 'active', label: 'Active' },
  { value: 'finished', label: 'Finished' },
];

const LIST_COLS = '1.4fr 1.1fr 1fr 1fr 1fr .9fr 1.6fr';

export function RunsListView({ onOpen }: { onOpen: (runId: string) => void }) {
  const { data, error, loading } = usePolling<RunSummary[]>('/api/reports', 3000);
  const now = useNow();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const runs = useMemo(() => data ?? [], [data]);
  const clusters = useMemo(() => Array.from(new Set(runs.map((r) => r.cluster))).sort(), [runs]);

  const stats: StatDef[] = useMemo(() => {
    const count = (status: string) => runs.filter((r) => r.status === status).length;
    return [
      { key: 'active', label: 'Active runs', value: count('ACTIVE'), dot: runMeta('ACTIVE').dot },
      { key: 'success', label: 'Succeeded', value: count('SUCCESS'), dot: runMeta('SUCCESS').dot },
      { key: 'error', label: 'Errors', value: count('ERROR'), dot: runMeta('ERROR').dot },
      { key: 'total', label: 'Total runs', value: runs.length, dot: '#8b909c' },
    ];
  }, [runs]);

  const q = search.trim().toLowerCase();
  const filtered = runs.filter((r) => {
    if (clusterFilter !== 'all' && r.cluster !== clusterFilter) return false;
    if (statusFilter === 'active' && r.status !== 'ACTIVE') return false;
    if (statusFilter === 'finished' && r.status === 'ACTIVE') return false;
    if (q && !(r.runId.toLowerCase().includes(q) || r.cluster.toLowerCase().includes(q))) return false;
    return true;
  });

  // Jump back to the first page when the filters/search change the result set.
  useEffect(() => setPage(1), [q, statusFilter, clusterFilter]);

  const pageCount = pageCountFor(filtered.length, pageSize);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const visible = paginate(filtered, currentPage, pageSize);

  const envBadge = runs.length && runs.every((r) => r.environment === runs[0].environment) ? runs[0].environment : undefined;

  return (
    <>
      <Header badge={envBadge}>
        <span className="mono">{formatClock(now)}</span>
      </Header>

      <StatGrid stats={stats} columns={4} />

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search run id, cluster…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="chip-row">
          {RUN_FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)} />
          ))}
        </div>
        <div className="divider-v" />
        <div className="chip-row">
          <Chip label="All clusters" cluster active={clusterFilter === 'all'} onClick={() => setClusterFilter('all')} />
          {clusters.map((c) => (
            <Chip key={c} label={c} cluster active={clusterFilter === c} onClick={() => setClusterFilter(c)} />
          ))}
        </div>
      </div>

      <div className="body">
        <div className="thead" style={{ gridTemplateColumns: LIST_COLS }}>
          <span>Run</span>
          <span>Cluster</span>
          <span>Status</span>
          <span>Started</span>
          <span>Finished</span>
          <span>Duration</span>
          <span>Progress</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            {loading ? 'Loading…' : error ? `Failed to load runs: ${error}` : 'No runs match the current filter.'}
          </div>
        ) : (
          <>
            {visible.map((run) => {
              const meta = runMeta(run.status);
              const pct = run.shardTotal ? Math.round((run.shardDone / run.shardTotal) * 100) : 0;
              return (
                <div
                  className="trow clickable"
                  style={{ gridTemplateColumns: LIST_COLS }}
                  key={run.runId}
                  onClick={() => onOpen(run.runId)}
                >
                  <div className="cell-stack">
                    <span className="cell-title">{run.runId}</span>
                    <span className="cell-sub">{run.collectionCount} collections</span>
                  </div>
                  <span className="mono bright">{run.cluster}</span>
                  <div className="status-col">
                    <Dot color={meta.dot} pulse={run.status === 'ACTIVE'} />
                    <StatusPill label={meta.label} bg={meta.bg} fg={meta.fg} />
                  </div>
                  <span className="mono">{formatDateTime(run.startedAt)}</span>
                  <span className="mono">{formatDateTime(run.finishedAt)}</span>
                  <span className="mono bright">{formatDuration(run.startedAt, run.finishedAt, now)}</span>
                  <div className="progress-wrap">
                    <div className="progress-track">
                      <div className="progress-bar" style={{ width: `${pct}%`, background: meta.dot }} />
                    </div>
                    <span className="mono" style={{ whiteSpace: 'nowrap' }}>
                      {run.shardDone}/{run.shardTotal}
                    </span>
                  </div>
                </div>
              );
            })}
            <Pagination
              total={filtered.length}
              page={currentPage}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
              label="runs"
            />
          </>
        )}
      </div>
    </>
  );
}
