# Roadmap

What is left after the bootstrap session. The bootstrap ([`bootstrap-prompt.md`](bootstrap-prompt.md) §4) delivered M0–M5, released as **0.1.0-alpha.1** (see [`CHANGELOG.md`](../CHANGELOG.md)). On 2026-11-24 the owner moved M6 (production readiness) and M7 (quality) out of the bootstrap into this roadmap, to be developed in separate threads ([P12](open-questions.md#proposed-changes-to-the-brief--bootstrap-prompt)).

The design for most items already exists in `architecture/` and `decisions/`; this file lists the work, the order, the acceptance checks and the traps found so far. Update it as items land: tick the box, link the commit or ADR, and move finished milestones to the changelog.

Rules from [`AGENTS.md`](../AGENTS.md) apply unchanged (pnpm only, pinned Payload 3.90.2, ADR per new library, spec and code in the same commit, Helm `lint`/`template` only, no deployments).

---

## Status at 0.1.0-alpha.1

| Area | State |
|---|---|
| M0 plan, M1 scaffold, M2 auth/data model/roles, M3 moderation, M4 website, M5 sync jobs | Done |
| Tests | 117 Vitest (unit + integration on `plc_test`), 22 Playwright E2E; all pass |
| Runs | From source: `pnpm build && pnpm start` (web) plus `pnpm worker` (jobs), or `pnpm dev` |
| Production artifacts | None yet: no Dockerfile, Helm chart, OpenTelemetry, health endpoints or security headers (M6) |
| Open decisions | Q26 (sync details, ADR-031 proposed), Q27 (license holder) in [`open-questions.md`](open-questions.md) |

**An alpha deployment that is reachable from the internet must not happen before the M6 items marked "before public deployment" are done** (security headers, ingress rate limits, health probes).

---

## M6 – Production readiness

Bootstrap scope: OpenTelemetry, health endpoints, the Dockerfile, the job worker, the migrations/seed Job, the Helm chart, and `docs/deployment.md`. Definition of done items it closes: `docker build` image serving all three roles, Helm `lint`/`template` with default and production example values, OTel visible in `grafana/otel-lgtm`, `docs/deployment.md` up to date ([bootstrap §6](bootstrap-prompt.md#6-definition-of-done-for-the-bootstrap)).

Suggested order (each step is one or more commits; earlier steps unblock later ones):

### M6.1 Health endpoints (before public deployment)

- `src/app/api/health/live/route.ts`: `200 {status:'ok'}`, no I/O. `src/app/api/health/ready/route.ts`: `getPayload()` plus a MongoDB `ping`; `503` with a short reason on failure; `Cache-Control: no-store`; `dynamic = 'force-dynamic'` ([§8 routes](architecture/frontend.md), [§18.3](architecture/operations.md#183-helm-chart-deploypayload-cms-community-portal)).
- Not behind auth, not in the sitemap, disallowed in `robots.txt` already (`/api/`).
- Tests: Playwright request test for both; a Vitest test for the ready handler with a failing ping.

### M6.2 Security headers and abuse limits (before public deployment)

- `next.config.ts` `headers()` per [§16](architecture/frontend.md#16-seo-analytics-consent-security): HSTS (only when `NEXT_PUBLIC_SERVER_URL` is https), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation off), `frame-ancestors 'self'`.
- CSP: start as `Content-Security-Policy-Report-Only` on the website routes, then enforce. Sources: `self`, `S3_PUBLIC_URL`, `www.googletagmanager.com`, `*.google-analytics.com`, `*.analytics.google.com`, `avatars.githubusercontent.com`, `lh3.googleusercontent.com`. Traps: Next.js needs nonces or `'unsafe-inline'` for its inline bootstrap scripts (read `node_modules/next/dist/docs/` on CSP for Next 16 before choosing; nonces make pages dynamic and conflict with ISR, [ADR-029](decisions/0029-website-page-caching-and-revalidation.md)); the Payload admin (`/admin`) needs `'unsafe-inline'`/`'unsafe-eval'` styles and scripts, so give it its own, looser policy. Record the choice in an ADR.
- Payload: Payload 3.90.2 has **no** `rateLimit` option (the M0 note in §16 is wrong; fix it there). `cors` is set to the server URL; set `csrf` to the same list explicitly.
- Request rate limits at the ingress for `POST /api/users`, `/api/users/login`, `/api/users/forgot-password`, `/api/users/resend-activation` and the OAuth endpoints ([§auth 7](architecture/auth.md)); documented as ingress-nginx annotations in the chart values and `docs/deployment.md`.
- Tests: E2E asserting the headers on `/` and `/admin/login`; no CSP violations in the console on the main pages and on the consent + GA flow.

### M6.3 OpenTelemetry

Design: [§17](architecture/operations.md#17-observability). Libraries already chosen in [ADR-016](decisions/0016-libraries.md) (`@opentelemetry/sdk-node` 0.223 line, auto-instrumentations 0.81 line); re-check versions and Next 16 compatibility, and update the ADR if they moved.

- `src/instrumentation.ts` → `register()` loads `src/otel/sdk.ts` only when `NEXT_RUNTIME === 'nodejs'`; `onRequestError` records the exception and logs it with the trace ID.
- `src/otel/sdk.ts`: start only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; OTLP http/protobuf exporters for traces, metrics, logs; instrumentations limited to `http`, `undici`, `mongodb`, `mongoose`, `pino`; resource attributes from `OTEL_SERVICE_NAME`, `APP_VERSION`, `DEPLOYMENT_ENVIRONMENT`, `OTEL_RESOURCE_ATTRIBUTES`.
- Worker: the CLI `worker` command loads the same SDK first.
- `src/otel/metrics.ts`: `plc.sync.items`, `plc.sync.runs`, `plc.sync.duration`, `plc.moderation.pending` (observable gauge), `plc.moderation.submissions_refused`, `plc.email.sent` — wire them where the code already logs the equivalent summary lines (`src/jobs/*`, `src/moderation/limit.ts`, `src/jobs/sendEmail.ts`).
- `src/otel/withSpan.ts`: spans per job task and per moderation action; sync item failures as span events.
- New env: `APP_VERSION`, `DEPLOYMENT_ENVIRONMENT` (add empty to `.env`, document in `.env.example`).
- `deploy/grafana/dashboard.json`: requests, 5xx rate, latency p50/p95, job runs, sync results (including `npmFailures`), moderation queue, emails.
- `docs/observability.md`: running `grafana/otel-lgtm` temporarily next to DDEV (not added to DDEV permanently without the owner's consent), importing the dashboard, finding a request by trace ID in logs.
- Acceptance: with the endpoint set, traces, metrics and logs correlated by trace ID appear in Grafana and the dashboard loads; without it, no OTel errors or warnings at startup.

### M6.4 Container image

Design: [§18.1](architecture/operations.md#181-image), [ADR-023](decisions/0023-small-image-with-bundled-cli-scripts.md).

- `next.config.ts`: `output: 'standalone'`; `outputFileTracingIncludes` for packages only the CLI needs.
- `cli.mjs` built with `esbuild` from `src/cli/index.ts`: our code bundled, npm packages external, **except `payload-oauth2`** (extensionless ESM imports; must be bundled). Add `esbuild` as a dev dependency (ADR-016 update).
- New CLI subcommand `self-test`: imports the config and every task without connecting to MongoDB; runs as a `RUN` step so a missing traced package fails the build.
- Multi-stage `Dockerfile`, starting from the Website template's (`templates/website/Dockerfile` in the `payloadcms/payload` repository at tag v3.90.2; it was not copied into this repo) (Node 24 alpine, corepack pnpm, `--frozen-lockfile`, `pnpm build`, `pnpm i18n:compile` is part of `build`), runner as uid 1000, `ARG APP_VERSION`, `CMD ["node","server.js"]`; `.dockerignore`.
- `NEXT_PUBLIC_*` at runtime: the GA ID is already served by `/site-config.json` ([ADR-028](decisions/0028-website-chrome-runtime-config-and-consent.md)); check every remaining `NEXT_PUBLIC_SERVER_URL` read in client code and the `next.config.ts` image `remotePatterns` (build-time!) — the image must work for any host with only env vars ([ADR-013](decisions/0013-next-public-env-at-runtime.md)). Expect to switch `remotePatterns` to a runtime-safe approach or a custom image loader; record it.
- **The build must not need MongoDB.** Today `pnpm build` connects to the database: `generateStaticParams` in `src/app/(frontend)/[slug]`, `news/[slug]`, `resources/[slug]`, `plugins/[slug]` and `builds/[slug]` queries Payload, and the build fails with `Failed to collect page data` when MongoDB is unreachable (verified 2026-11-24). A `docker build` has no database. Options: return `[]` during the build (pages render on first request and are cached by ISR, [ADR-029](decisions/0029-website-page-caching-and-revalidation.md)), or skip prerendering behind an env flag; record the choice in an ADR.
- Measure and record the image size (target well under 400 MB).
- Trap: `pnpm build` rewrites `tsconfig.json` when `NEXT_DIST_DIR` is not `.next` (Next adds the dist types path); never commit that change.
- Acceptance: `docker build` succeeds (if Docker is available in the container; otherwise ask the owner to build on the host), `node server.js`, `node cli.mjs migrate|seed|worker|self-test` all start with only env vars plus MongoDB/S3/SMTP access.

### M6.5 Helm chart

Design: [§18.3](architecture/operations.md#183-helm-chart-deploypayload-cms-community-portal), [ADR-007](decisions/0007-jobs-worker-and-scheduling.md), [ADR-009](decisions/0009-migrations-and-seeding-job.md).

- `deploy/helm/payload-cms-community-portal/`: `Chart.yaml`, `values.yaml`, `values.schema.json`, `values-production.example.yaml`, `README.md` (helm-docs if available), templates for web Deployment (probes on M6.1 endpoints, `JOBS_AUTORUN=false`), worker Deployment (1 replica, `Recreate`, `node cli.mjs worker`), optional CronJob alternative, migrate/seed hook Job (`pre-install,pre-upgrade`, `before-hook-creation,hook-succeeded`), Service, Ingress (TLS, rate-limit annotations from M6.2), ServiceAccount, optional HPA and PDB, ConfigMap, optional Secret (`secret.create`, local testing only), `NOTES.txt`.
- Secrets only through `existingSecret` (keys listed in §18.3); downward API for `OTEL_RESOURCE_ATTRIBUTES`.
- Acceptance: `helm lint` and `helm template` pass with default values and with `values-production.example.yaml`. No cluster exists; never deploy.

### M6.6 Deployment docs

- `docs/deployment.md`: building and pushing the image, required Secret keys, install/upgrade with Helm, how migrations and seeding run, the worker (and the CronJob fallback), probes, OTel configuration, Garage public endpoint and its `Cache-Control` ingress header ([§13](architecture/operations.md#13-storage)), ingress rate limits, rollback (`helm rollback` plus migration caveats), suggested alert rules (5xx rate, sync `failed` runs, sync not run for 24 h, pending queue growing, email failures).
- `docs/runbooks/`: sync failing (GitHub token, npm 429, source down), emails not delivered, stuck jobs (`payload-jobs` with `processing: true`), restoring a hidden plugin.

---

## M7 – Quality

Bootstrap scope: complete the Playwright suite, accessibility checks with `@axe-core/playwright`, a Lighthouse check of the main pages, and the remaining `docs/` pages. Compare against the test list in [bootstrap §5 "Tests"](bootstrap-prompt.md).

### M7.1 Missing E2E coverage

Already covered (do not duplicate): moderation transitions and emails (integration + E2E), submission limit (integration), account flows (invite, register/activate, delete), consent and GA, listings basics, detail pages, SEO files, sync triggers, sync logic against fixtures (integration).

To add:

- Every main-menu item renders its heading in **light and dark** mode.
- Listings: builds and plugins filters (topics, tags) and sorting; pagination state in the URL on all four listings.
- Hidden plugins and rejected/unpublished entries are absent from listings, detail pages and sitemaps (integration covers access; add one E2E pass).
- Submission limit **in the admin UI**: the 4th submission shows the translated error; editing a pending entry still works; after an approval the user can submit again.
- Regular user creates a Resource **and a manual Plugin** in the admin; every moderator/admin with notifications on gets exactly one email (Mailpit).
- Author edits a published Resource: the old version stays visible until approval (E2E on the website).
- Moderation dashboard: all four types listed oldest first; approve and reject from the dashboard; regular users get no access (403/redirect).
- A moderator cannot write Sources or change roles (admin UI + REST).
- "Forgot password" for a password user, end to end through Mailpit.
- Stabilize the E2E web server: on 2026-10-12 one full run lost the dev server on its first page load (cold compile); add a warm-up request in `global-setup.ts` or run E2E against `next build && next start`.

### M7.2 Accessibility

- Add `@axe-core/playwright` (ADR-016 update) and check home, the four listings, one detail page per type, sign-in, sign-up, account, and the consent banner, in light and dark mode. Target WCAG 2.2 AA; zero violations, or documented exceptions with an issue each.

### M7.3 Lighthouse

- Lighthouse (CLI or `playwright-lighthouse`; pick with an ADR) on home, `/news`, `/plugins`, one detail page; record scores in `docs/development.md`; budgets for performance ≥ 90 and accessibility/SEO/best practices ≥ 95 on a production build, not `next dev`.

### M7.4 Remaining docs

- `docs/observability.md` (if not done in M6), `docs/runbooks/`, a contributor section (commit conventions, how to add a sync adapter, how to add a translatable string) in `docs/development.md`.
- Re-check `docs/getting-started.md` from a clean clone.

---

## Carry-over items (any milestone)

- [ ] **Manual check before tagging a release**: full OAuth round trip with real GitHub and Google apps, and signing in with both providers using the same verified email leads to one user (bootstrap §6; only the linking logic is automated).
- [ ] **Q26 / ADR-031**: owner confirmation of the sync implementation details; then mark ADR-031 accepted.
- [ ] **Q27**: copyright holder in `LICENSE.md` (still the Website template's "Payload CMS, Inc."), before a public release.
- [ ] **Lingui**: bump to 6.9.1 once it clears pnpm's release-age cutoff; try Next 16.4.0 with `@lingui/swc-plugin` 6.7.1 on a branch ([ADR-014](decisions/0014-versions.md), [ADR-027](decisions/0027-lingui-wiring.md)).
- [ ] **Plugin sync**: about 6 npm download counts per full run stay stale after retries (status `partial`); idea [I17](ideas.md) (bulk downloads API) would fix it if approved.
- [ ] **Post sync**: edits to older blog posts are only picked up when they share a page with a new post (ADR-031 §2); revisit if the owner wants periodic full re-syncs.
- [ ] Payload stays on 3.90.2 until an upgrade is planned: all `@payloadcms/*` together, then `pnpm generate:types`, `generate:importmap`, full test run.

## Release checklist (for every tag)

1. `pnpm lint`, `pnpm typecheck`, `pnpm i18n:extract` (no missing strings, no catalog diff), `pnpm test`, `pnpm build`.
2. Manual OAuth check above (until it is automated or accepted as known risk).
3. `CHANGELOG.md` entry, `package.json` version, annotated tag `vX.Y.Z[-pre]`.
4. From M6 on: `helm lint` / `helm template` with both values files, image built and its size recorded.
