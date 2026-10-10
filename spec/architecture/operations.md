# Jobs, email, storage, observability and deployment

Part of the [architecture](README.md). Section numbers are global across the architecture files, so references such as [§6.3](moderation.md#63-transitions) stay stable.

---

## 9. Jobs (Payload Jobs Queue)

Queues: `default` (emails/notifications), `sync` (synchronizations).

| Task slug | Queue | Schedule | Retries | Input | What it does |
|---|---|---|---|---|---|
| `syncPosts` | sync | `0 */6 * * *` | 2 | `{ sourceId? }` | [§11.1](sync.md#111-post-sync-syncposts) |
| `syncPlugins` | sync | `0 3 * * *` | 2 | `{}` | [§11.2](sync.md#112-plugin-sync-syncplugins) |
| `notifyModerators` | default | – | 3 | `{ collection, id, transition }` | Resolve recipients, queue one `sendEmail` per recipient. |
| `notifyAuthor` | default | – | 3 | `{ collection, id, outcome: 'approved' \| 'rejected' }` | Check author preference, queue `sendEmail`. |
| `sendInvitation` | default | – | 3 | `{ userId }` | `payload.forgotPassword({ disableEmail: true })` → token, extend expiry to 7 days, queue `sendEmail` (invitation template). |
| `sendEmail` | default | – | 5 (exponential backoff) | `{ to, template, data }` | Render template, `payload.sendEmail`. |

- Every task handler is wrapped in `withSpan('job <slug>')` and logs a single structured summary line.
- Jobs are queued from `afterChange` hooks with `payload.jobs.queue` (never inline email sending); a failed queue call is logged and never fails the save.
- `jobs.autoRun`: `process.env.JOBS_AUTORUN !== 'false'` ⇒ `[{ cron: '* * * * *', allQueues: true, limit: 20 }]` else `[]`. `jobs.shouldAutoRun` mirrors the flag. Scheduling (`schedule` on tasks) is handled by the same cron (`handleSchedules`).
- **Kubernetes**: web pods `JOBS_AUTORUN=false`; worker pod (1 replica, `Recreate`) runs `node cli.mjs worker` from the same image ([ADR-023](../decisions/0023-small-image-with-bundled-cli-scripts.md)): it calls `getPayload({ config, cron: true })` with `JOBS_AUTORUN=true`, so Payload's own autoRun cron handles schedules and runs all queues every minute — the same behaviour as `payload jobs:run --cron "* * * * *" --handle-schedules --all-queues`, without shipping the Payload CLI. Payload's schedule handling records the next scheduled job in the DB, so even an accidental second worker would not double-queue a schedule slot. SIGTERM → `payload.destroy()` (stops crons, closes the DB) before exit.
- **Fallback without a worker** (documented, not the default): a Kubernetes CronJob running `curl -X GET http://<web-service>/api/payload-jobs/run?allQueues=true&limit=20` with `Authorization: Bearer $CRON_SECRET` every minute (`concurrencyPolicy: Forbid`). The built-in endpoint also calls `handleSchedules` (verified in `payload/dist/queues/endpoints/run.js`). Downsides: long syncs run inside an HTTP request on a web pod (use the internal Service, not the Ingress, to avoid proxy timeouts) and are interrupted by web rollouts (Payload retries them).
- **Manual triggers**: root endpoint `POST /api/sync/:task` (`task ∈ posts | plugins`): admin user **or** `Authorization: Bearer $CRON_SECRET`; queues the task on the `sync` queue (worker or autoRun picks it up within a minute). Admin buttons on the Sources list and Plugins list (`beforeListTable`, admins only). `jobs.access.{run,queue,cancel}` = admin or `CRON_SECRET`.

---

## 10. Email

- Adapter: `@payloadcms/email-nodemailer` with SMTP transport from `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`/`SMTP_PASS` (auth only when user set), `defaultFromAddress = EMAIL_FROM_ADDRESS`, `defaultFromName = EMAIL_FROM_NAME`. Mailpit locally.
- Templates in `src/email/templates/*.tsx` with `@react-email/components`, rendered to HTML **and** plain text (`render(…, { plainText: true })`). Shared `Layout` (portal name, footer, preferences link). Strings in one `src/email/messages.ts` (keys + English text, ready for translation later).

| Template | Trigger | Recipients | Content |
|---|---|---|---|
| `submissionToModerators` | T1, T3, T4 by regular user | users with role moderator/admin, `notifications.moderation = true`, email set, ≠ author | type, title, author, submission date, link to admin edit view, link to `/admin/moderation` |
| `entryApproved` | T5 by someone other than the author | author with `notifications.ownEntries = true` | title, link to the entry's portal page (`/news/{slug}`, `/resources/{slug}`, `/plugins/{slug}`, `/builds/{slug}`) |
| `verifyEmail` | self-registration (Payload `auth.verify`, custom `generateEmailHTML/Subject`) | the new user | "Activate your account" link `/admin/users/verify/{token}` (Payload's built-in verify view, then sign in) |
| `entryRejected` | T6 by someone other than the author | author with `notifications.ownEntries = true` | title, reason, link to edit in admin |
| `invitation` | admin creates a user without OAuth (afterChange, `operation === 'create'`, no provider IDs) | the new user | "An account was created for you…", set-password link `/admin/reset/{token}` (valid 7 days) |
| `forgotPassword` | Payload `forgotPassword` (custom `generateEmailHTML/Subject`) | requester | reset link `/admin/reset/{token}` (valid 1 h) |

The `verifyEmail` and `forgotPassword` emails are sent by Payload inside the request (built-in auth flows, not our jobs); they are small, and a failure is returned to the user, who can retry.

De-duplication: notifications are queued only on a status **transition** (into `pending`, `published` via moderation, `rejected`). Retrying a `sendEmail` job never re-renders another recipient.

---

## 13. Storage

- `@payloadcms/storage-s3` for `media` (prefix `media/`) and `post-media` (prefix `post-media/`): `bucket = S3_BUCKET`, `config = { endpoint: S3_ENDPOINT, region: S3_REGION, forcePathStyle: S3_FORCE_PATH_STYLE === 'true', credentials }`, `disablePayloadAccessControl: true`, `generateFileURL: ({ filename, prefix }) => \`${S3_PUBLIC_URL}/${prefix}/${filename}\``. No local disk writes (`upload.disableLocalStorage` implied by the plugin).
- **Public delivery = Garage's own web endpoint** (decided 2026-10-10, [ADR-006](../decisions/0006-storage-s3-garage-public-endpoint.md)): the bucket has website access enabled (`garage bucket website --allow`), and Garage's web endpoint (port 3902, `root_domain` = the files host) is exposed on its own public host, e.g. `https://files.example.org`. `S3_PUBLIC_URL` points to that host; no CDN and no separate "S3 public URL" service. Locally: `https://garage.plc.ddev.site:3902` (the `ddev-garage` add-on already makes the bucket public).
  - In Kubernetes, Garage is operated separately from this chart (it is shared infrastructure); its web endpoint gets its own Ingress/TLS there. The portal chart only receives `S3_ENDPOINT` (S3 API, can be cluster-internal) and `S3_PUBLIC_URL` (public web host).
  - Caching: Payload gives each upload a unique file name within a collection (it appends a suffix on collisions), so a long `Cache-Control` (`public, max-age=604800`) is safe. `@payloadcms/storage-s3` 3.90.2 has no option to set object metadata on upload (verified in M1), so the header is added by the Ingress in front of Garage's web endpoint (Garage only returns `Cache-Control` stored on the object). Next.js image optimization caches its variants independently. Not `immutable`: a deleted file's name can be reused later. A CDN can be put in front later by changing only `S3_PUBLIC_URL`.
- E2E: `S3_KEY_PREFIX=e2e` prepended to prefixes (or a separate bucket) so tests never touch dev files. Implemented in `src/plugins/storage.ts`.
- `next.config.ts`: `images.remotePatterns` built from `S3_PUBLIC_URL` (protocol/host/port/path). DDEV check (done in M0): `garage.plc.ddev.site` resolves inside the web container to the DDEV router and the mkcert CA is trusted via `NODE_EXTRA_CA_CERTS`, so the image optimizer should fetch it directly; M1 verifies with a real image and adds a documented dev-only fallback only if needed.

---

## 17. Observability

- `src/instrumentation.ts` (Next.js) → `register()` imports `./instrumentation.node` when `NEXT_RUNTIME === 'nodejs'`; `onRequestError` records the exception on the active span and logs it with `payload.logger`.
- `src/otel/sdk.ts` (shared by web and worker): `@opentelemetry/sdk-node` `NodeSDK` started **only if** `OTEL_EXPORTER_OTLP_ENDPOINT` is set; exporters `@opentelemetry/exporter-{trace,metrics,logs}-otlp-proto`; standard `OTEL_*` variables (`OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`, `OTEL_EXPORTER_OTLP_HEADERS` for Grafana Cloud). Instrumentations from `@opentelemetry/auto-instrumentations-node` limited to `http`, `undici`, `mongodb`, `mongoose`, `pino`, `dns`(off), `fs`(off). Resource: `service.name` (`OTEL_SERVICE_NAME`), `service.version` (`APP_VERSION` build arg / `package.json`), `deployment.environment.name`, `k8s.*` from `OTEL_RESOURCE_ATTRIBUTES` set by Helm via the downward API, plus `@opentelemetry/resource-detector-container`.
- Worker: same SDK loaded with `NODE_OPTIONS=--import ./dist/otel/register.js` (compiled to JS in the image).
- Logs: Payload's pino logger (`logger` config: JSON to stdout, level `LOG_LEVEL`), `instrumentation-pino` injects `trace_id`/`span_id` and forwards records to the OTel logs exporter.
- Spans: per job task (`job.syncPosts` …, attributes `job.id`, `job.queue`, counts), per sync item failure as span events; Local API calls traced through MongoDB/Mongoose instrumentation + a span around each moderation action.
- Metrics (OTel naming; Prometheus names in brackets):
  - `plc.sync.items` counter, attrs `plc.sync.job`, `plc.sync.result` (`created|updated|unchanged|hidden|unhidden|skipped|failed`) [`plc_sync_items_total`]
  - `plc.sync.runs` counter, attrs job, `outcome` (`success|partial|failed`) [`plc_sync_runs_total`]
  - `plc.sync.duration` histogram, unit `s` [`plc_sync_duration_seconds`]
  - `plc.moderation.pending` observable gauge, attr `plc.collection` [`plc_moderation_pending`]
  - `plc.moderation.submissions_refused` counter [`plc_moderation_submissions_refused_total`]
  - `plc.email.sent` counter, attrs `plc.email.template`, `outcome` (`success|failure`) [`plc_email_sent_total`]
  - HTTP server/client duration from instrumentations (`http.server.request.duration`, `http.client.request.duration`).
- `deploy/grafana/dashboard.json`: requests, errors (5xx rate), latency p50/p95, job runs, sync results, moderation queue, emails. Alert suggestions in `docs/deployment.md`.

---

## 18. Deployment model

### 18.1 Image
Multi-stage `Dockerfile` (Node 24 alpine, `corepack` pnpm, `pnpm install --frozen-lockfile`, `next build` with `output: 'standalone'`):
- `runner` stage, user `node` (uid 1000), `NODE_ENV=production`, based on `node:24-alpine`; contains **only** the Next.js standalone output plus one bundled script ([ADR-023](../decisions/0023-small-image-with-bundled-cli-scripts.md)):
  - `/app` = standalone server (`server.js`, traced `node_modules`, `.next/static`, `public`).
  - `/app/cli.mjs` = `src/cli/index.ts` bundled with `esbuild` at build time (our code — Payload config, collections, jobs, seed, migrations — is bundled; npm packages stay external and resolve from the standalone `node_modules`). Subcommands:
    - `node cli.mjs migrate` → `getPayload({ config })` → `payload.db.migrate({ migrations })` (explicit list from `src/migrations/index.ts`, so no migration-directory scan at runtime).
    - `node cli.mjs seed` → idempotent production seed.
    - `node cli.mjs worker` → long-running jobs worker (§9).
    - `node cli.mjs self-test` → imports the config and every task without connecting to the DB; run as a `RUN` step in the Dockerfile so a package missing from the standalone trace fails the **build**, not the deployment. Packages only the CLI needs are added with `outputFileTracingIncludes` in `next.config.ts`.
  - No TypeScript sources, no Payload CLI, no full `node_modules`, no pnpm in the final stage. Target: well under 400 MB uncompressed (vs. roughly 1 GB+ with full production `node_modules`); measured and recorded in M6.
- Locally the same entry point runs through `tsx` (`pnpm seed`, `pnpm seed:dev`, `pnpm worker`); the Payload CLI (`pnpm payload migrate:create`, `generate:types`) stays a dev tool.
- `ARG APP_VERSION` → `ENV APP_VERSION` (OTel `service.version`).
- Default `CMD ["node", "server.js"]`; the worker and the migrate Job override the command.

### 18.2 Runtime configuration (env)
Existing: `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, `CRON_SECRET`, `GITHUB_TOKEN`, `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `ADMIN_GITHUB_LOGINS`, `ADMIN_EMAILS`, `S3_*`, `SMTP_*`, `EMAIL_FROM_*`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `OTEL_*`.
Planned new (added to `.env` empty + `.env.example` when introduced): `JOBS_AUTORUN` (default `true`), `LOG_LEVEL` (default `info`), `S3_KEY_PREFIX` (empty; `e2e` in tests), `APP_VERSION` (image build arg), `DEPLOYMENT_ENVIRONMENT` (mapped into `OTEL_RESOURCE_ATTRIBUTES`).

`NEXT_PUBLIC_*` are inlined at build time: the image is built per environment, or (preferred) GA ID and server URL are read at runtime on the server and passed to client components as props ([ADR-013](../decisions/0013-next-public-env-at-runtime.md)).

### 18.3 Helm chart `deploy/helm/payload-cms-community-portal`

```
Chart.yaml
values.yaml
values.schema.json
values-production.example.yaml
README.md                     # values table (helm-docs if available)
templates/
  _helpers.tpl
  NOTES.txt
  configmap.yaml              # non-secret env (server URL, S3 endpoint/bucket/region/public URL, SMTP host/port, OTEL endpoint/protocol, JOBS_AUTORUN, LOG_LEVEL)
  secret.yaml                 # only if secret.create=true (local testing)
  serviceaccount.yaml
  deployment-web.yaml         # replicas, probes (/api/health/live, /api/health/ready), JOBS_AUTORUN=false
  deployment-worker.yaml      # replicas: 1, strategy Recreate, command: node cli.mjs worker (worker.enabled=true)
  cronjob-jobs.yaml           # optional alternative to the worker (worker.mode=cronjob): curl /api/payload-jobs/run every minute
  job-migrate.yaml            # helm.sh/hook: pre-install,pre-upgrade; hook-delete-policy: before-hook-creation,hook-succeeded; node cli.mjs migrate && node cli.mjs seed
  service.yaml
  ingress.yaml                # hosts, TLS, annotations
  hpa.yaml                    # optional (autoscaling.enabled)
  pdb.yaml                    # optional (podDisruptionBudget.enabled)
```

Secrets: `existingSecret` name (keys: `DATABASE_URI`, `PAYLOAD_SECRET`, `CRON_SECRET`, `GITHUB_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `SMTP_USER`, `SMTP_PASS`, `OTEL_EXPORTER_OTLP_HEADERS`), loaded with `envFrom.secretRef`. Downward API env `K8S_POD_NAME`, `K8S_NAMESPACE_NAME`, `K8S_NODE_NAME` → `OTEL_RESOURCE_ATTRIBUTES=k8s.pod.name=$(K8S_POD_NAME),k8s.namespace.name=$(K8S_NAMESPACE_NAME),k8s.node.name=$(K8S_NODE_NAME),deployment.environment.name=…,service.version=<image tag>`.

Validation: `helm lint` and `helm template` with defaults and `values-production.example.yaml` (no cluster).
