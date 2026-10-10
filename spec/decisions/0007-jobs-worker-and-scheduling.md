# ADR-007: Jobs and scheduling in Kubernetes

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

- Payload Jobs Queue with task `schedule` crons; queues `sync` and `default`.
- `jobs.autoRun` is enabled by `JOBS_AUTORUN` (default `true` for DDEV); web pods set `false`.
- Single worker Deployment (`replicas: 1`, `strategy: Recreate`) running `payload jobs:run --cron "* * * * *" --handle-schedules --all-queues` — flags verified in `payload/dist/bin/index.js` 3.90.2. The worker also sends emails.
- Manual triggers: `POST /api/sync/{posts|plugins}` (admin session or `Bearer CRON_SECRET`) that only **queues** a job; the worker runs it.
- Rejected: Kubernetes CronJobs per task — duplicate scheduling logic outside Payload, cold start per run.
