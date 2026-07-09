import express from 'express';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Thin backend for the standalone dashboard. It reads the shared report directory that the
 * solr-backupper writes to (REPORT_DIR) and exposes it over a tiny read-only API, plus serves the
 * built SPA. The two processes never talk directly — they only share the report volume.
 */

const REPORT_DIR = process.env.REPORT_DIR || path.resolve(process.cwd(), 'fixtures');
const PORT = Number(process.env.PORT || 8080);
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

// Report filenames are backup-report-{runId}.json; runIds are safe filename tokens.
const RUN_ID_RE = /^[A-Za-z0-9._-]+$/;
const REPORT_PREFIX = 'backup-report-';
const REPORT_SUFFIX = '.json';

type Counts = {
  pending: number;
  running: number;
  success: number;
  timedOut: number;
  errored: number;
  total: number;
};

type RunReport = {
  runId: string;
  cluster: string;
  environment: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  parallelBackups: number;
  counts: Counts;
  collections: Array<{ alias: string; collection: string; shards: unknown[] }>;
};

// Guards against files that aren't new-format RunReports — stray files, a report caught mid-rewrite,
// or legacy pre-RunReport summaries (which lack runId/counts/collections) left in the same directory.
function isRunReport(value: unknown): value is RunReport {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.runId === 'string' &&
    Array.isArray(r.collections) &&
    typeof r.counts === 'object' &&
    r.counts !== null
  );
}

async function readAllReports(): Promise<RunReport[]> {
  let files: string[];
  try {
    files = await readdir(REPORT_DIR);
  } catch {
    return [];
  }

  const reports: RunReport[] = [];
  for (const file of files) {
    if (!file.startsWith(REPORT_PREFIX) || !file.endsWith(REPORT_SUFFIX)) continue;
    try {
      const parsed: unknown = JSON.parse(await readFile(path.join(REPORT_DIR, file), 'utf8'));
      if (isRunReport(parsed)) reports.push(parsed);
    } catch {
      // A report being rewritten (or a stray file) — skip it this poll; the next one will pick it up.
    }
  }
  return reports;
}

function toSummary(report: RunReport) {
  const counts = report.counts ?? ({} as Counts);
  return {
    runId: report.runId,
    cluster: report.cluster,
    environment: report.environment,
    status: report.status,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    parallelBackups: report.parallelBackups,
    counts,
    collectionCount: (report.collections ?? []).length,
    shardDone: counts.success ?? 0,
    shardTotal: counts.total ?? 0,
  };
}

const app = express();

app.get('/api/reports', async (_req, res) => {
  const reports = await readAllReports();
  reports.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  res.json(reports.map(toSummary));
});

app.get('/api/reports/:runId', async (req, res) => {
  const { runId } = req.params;
  if (!RUN_ID_RE.test(runId)) {
    res.status(400).json({ error: 'invalid runId' });
    return;
  }
  try {
    const raw = await readFile(path.join(REPORT_DIR, `${REPORT_PREFIX}${runId}${REPORT_SUFFIX}`), 'utf8');
    if (!isRunReport(JSON.parse(raw))) {
      res.status(404).json({ error: 'run not found' });
      return;
    }
    res.type('application/json').send(raw);
  } catch {
    res.status(404).json({ error: 'run not found' });
  }
});

// Serve the built SPA and fall back to index.html for client-side navigation.
app.use(express.static(DIST_DIR));
app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`solr-backup-dashboard listening on :${PORT} (REPORT_DIR=${REPORT_DIR})`);
});
