# ADR-023: Small image: Next.js standalone output plus a bundled CLI script

- Status: Accepted
- Proposed: 2026-10-10
- Accepted: 2026-10-10
- Supersedes: [ADR-010](0010-single-image-for-all-roles.md)
- Amends: [ADR-007](0007-jobs-worker-and-scheduling.md) (worker command), [ADR-009](0009-migrations-and-seeding-job.md) (migrate Job command)

## Context

ADR-010 shipped the full production `node_modules` and the TypeScript sources next to the standalone server so the Payload CLI could run migrations, the seed and the jobs worker. That roughly doubles or triples the image (estimated ~1 GB+ vs. a few hundred MB). The review asked whether REST endpoints and migration scripts could replace the CLI.

Checked on 2026-10-10 (Payload 3.90.2 sources and DeepWiki for `payloadcms/payload`):

- The CLI is a thin wrapper: `jobs:run --cron` = `getPayload()` + a cron calling `payload.jobs.handleSchedules()` and `payload.jobs.run()`; `getPayload({ config, cron: true })` starts the same `jobs.autoRun` crons. `migrate` = `payload.db.migrate({ migrations? })`, which accepts an explicit list of migrations.
- `@payloadcms/db-mongodb` supports `prodMigrations` (runs migrations on connect when `NODE_ENV=production`) — but on every pod start, in every replica, concurrently.
- `GET|POST /api/payload-jobs/run` (protected by `jobs.access.run`) runs queued jobs and also calls `handleSchedules` unless `disableScheduling=true`.
- Payload's docs and templates only show the standalone Dockerfile for the web server; running the CLI in that image is not covered.

Options:

| Option | Migrations | Jobs | Verdict |
|---|---|---|---|
| A. Full `node_modules` + CLI (ADR-010) | `payload migrate` | `payload jobs:run --cron` | Works, large image. |
| B. REST only | endpoint on the app | CronJob + `curl /api/payload-jobs/run` | Rejected for migrations: a `pre-upgrade` hook runs **before** the new version's pods exist, so the endpoint would belong to the old version; a `post-upgrade` hook would let new pods start on an unmigrated DB. |
| C. `prodMigrations` on startup | every pod on boot | – | Rejected: concurrent migrations from several replicas, and the brief requires a one-off Job. |
| **D. Standalone + bundled `cli.mjs`** | `node cli.mjs migrate` (Job) | `node cli.mjs worker` (Deployment) | **Chosen.** |

## Decision

- The final image contains only the Next.js standalone output and `cli.mjs`, a single file built with `esbuild` from `src/cli/index.ts` (our code bundled; npm packages external, resolved from the standalone `node_modules`).
- Subcommands: `migrate` (explicit migrations list from `src/migrations/index.ts`), `seed`, `worker` (`getPayload({ config, cron: true })` with `JOBS_AUTORUN=true`; graceful `payload.destroy()` on SIGTERM), `self-test` (imports config and tasks without a DB; run during `docker build` so missing traced packages fail the build). Packages needed only by the CLI are added to the trace with `outputFileTracingIncludes`.
- The Helm chart keeps the worker Deployment by default and offers `worker.mode=cronjob` (a CronJob calling `/api/payload-jobs/run` through the internal Service with `CRON_SECRET`) for clusters that prefer no long-running worker.
- Locally the same entry point runs with `tsx`; the Payload CLI stays a dev dependency for `migrate:create`, `generate:types`, `generate:importmap`.

## Consequences

- Much smaller image, still one artifact for web, worker and migrate.
- One small build step (`esbuild` 0.28, ~300M weekly downloads, last published 2026-08-08, already a transitive dependency via `tsx`) and a `self-test` to guard the standalone trace; a failure there is visible at build time.
- If bundling ever proves fragile (e.g. a Payload update loads files dynamically that the trace misses), fallback: a second build target `cli` from `pnpm deploy --prod` published under the same tag with a `-cli` suffix.
- Image size is measured and recorded in M6.
