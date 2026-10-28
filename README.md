# solr-backup-dashboard

Standalone live dashboard for [`solr-backupper`](../solr-backupper). It is a small React + Mantine
SPA served by a thin Node/Express backend. The backend reads the **report directory** that the
backup CLI writes to (a shared volume) and exposes it over a read-only API; the SPA polls that API
and renders two views from the imported Claude Design:

- **Runs list** — every backup run found in the report directory, across clusters, with status,
  progress and timing.
- **Run detail** — one run's collections (aliases) → shards, updating live while the run is active.

The two processes never talk to each other directly — they only share the report path. Because each
report carries a `cluster` field, several backupper instances can write into one shared directory
and this dashboard renders them all, filterable by cluster.

## How it fits together

```
 solr-backupper (CLI)                     solr-backup-dashboard (this project)
   writes backup-report-{runId}.json ──►  [ shared report dir ]  ──► Node reads it ──► /api/reports
   (rewritten every report-update-interval)                          serves React SPA ──► browser polls
```

Set the backupper's `solr.backup.report-output-directory` and this app's `REPORT_DIR` to the same
mounted volume.

## Develop

```bash
npm install
npm run dev        # Vite on :5173 + Node backend on :8080 (serving ./fixtures), proxying /api
```

Point the backend at real reports instead of the bundled fixtures:

```bash
REPORT_DIR=/mnt/backups/backups/solr9/reports npm run dev
```

## Build & run (production)

```bash
npm run build      # SPA -> dist/
REPORT_DIR=/path/to/reports PORT=8080 npm start   # serves /api + dist on one origin
```

## Container

```bash
docker build -t solr-backup-dashboard .
docker run -p 8080:8080 -v /path/to/reports:/reports:ro solr-backup-dashboard
# or: docker compose up   (see docker-compose.yml for the shared-volume wiring)
```

## Configuration

| Env var      | Default      | Meaning                                             |
| ------------ | ------------ | --------------------------------------------------- |
| `REPORT_DIR` | `./fixtures` | Directory of `backup-report-*.json` files to serve. |
| `PORT`       | `8080`       | Port the backend listens on.                        |
| `SOLR_AUTHORIZATION` | unset | `Authorization` header value (`Bearer <token>` or `Basic <base64>`) sent with the replication-status requests behind each attempt's host link. |

## API

- `GET /api/reports` — summaries of every run in `REPORT_DIR`, newest first.
- `GET /api/reports/:runId` — the full `RunReport` JSON for one run.
- `GET /api/replication?leader=<leaderUrl>&core=<core>` — the core's `replication?command=details`,
  fetched server-side with `SOLR_AUTHORIZATION`. Only forwards to leaders named in a report.
