# Architecture — Payload CMS Community Portal

Status: **M0, reviewed 2026-10-10.** [`../BRIEF.md`](../BRIEF.md) is the source of truth for *what* to build; this folder describes *how*; the reasons are in [`../decisions/`](../decisions/README.md) (referenced as `ADR-NNN`). Where the architecture deliberately extends the brief (detail pages, email registration, connecting providers), the ADR says so.

Section numbers are global across the files below, so references such as §6.3 stay stable when files are reorganized.

| File | Sections |
|---|---|
| `README.md` (this file) | §0 Technology stack, §1 System overview, §2 Template adaptation, §21 Project layout |
| [`access-control.md`](access-control.md) | §3 Roles and helpers, §5 Access-control matrix |
| [`data-model.md`](data-model.md) | §4 Collections, §20 Seeding |
| [`moderation.md`](moderation.md) | §6 State machine, §7 Submission limit, §8 Dashboard and actions |
| [`auth.md`](auth.md) | §12 Authentication (OAuth, email registration, connecting providers) |
| [`sync.md`](sync.md) | §11 Synchronization, §19 External integrations |
| [`frontend.md`](frontend.md) | §14 Website routes, §15 i18n, §16 SEO, analytics, consent, security |
| [`operations.md`](operations.md) | §9 Jobs, §10 Email, §13 Storage, §17 Observability, §18 Deployment model |

---

## 0. Technology stack

The brief names the technologies; this table pins the concrete packages and their role. Exact versions live in `package.json` / `pnpm-lock.yaml` (the source of truth); versions here are the ones verified at planning time (2026-10-09).

| Area | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 24 | DDEV and Docker image |
| Package manager | pnpm (corepack) | 10.x | only pnpm lockfile |
| Framework | Next.js (App Router, `output: 'standalone'`) | 16.3.3 | template pin ([ADR-014](../decisions/0014-versions.md)) |
| UI runtime | React / React DOM | 19.2.6 | template pin |
| CMS | `payload`, `@payloadcms/next`, `@payloadcms/ui` | 3.90.2 | all `@payloadcms/*` on the same exact version |
| Starting point | Payload Website template | v3.90.2 | [§2](#2-template-adaptation-website-template-v3902) |
| Database | MongoDB + `@payloadcms/db-mongodb` | 3.90.2 | DBs `plc`, `plc_test` |
| Rich text | `@payloadcms/richtext-lexical` | 3.90.2 | + plaintext converter for sync |
| Payload plugins | `plugin-seo`, `plugin-redirects`, `storage-s3`, `email-nodemailer`, `live-preview-react`, `admin-bar` | 3.90.2 | |
| File storage | Garage (S3-compatible) via `@payloadcms/storage-s3` | 3.90.2 | [§13](operations.md#13-storage) |
| Auth | Payload local strategy + `payload-oauth2` (GitHub, Google) | 1.0.21 | [§12](auth.md#12-authentication-flow), [ADR-001](../decisions/0001-oauth-plugin-payload-oauth2.md) |
| Email | SMTP via `@payloadcms/email-nodemailer`; templates `react-email` + `@react-email/render` ([ADR-025](../decisions/0025-react-email-package.md)) | 3.90.2 / 6.11.1 / 2.1.0 | Mailpit locally |
| Jobs | Payload Jobs Queue (`jobs.tasks` + `schedule`) | 3.90.2 | worker Deployment |
| UI | Tailwind CSS 4 + shadcn/ui (template) | | light/dark theme |
| i18n | Lingui (`@lingui/core`, `react`, `cli`, `swc-plugin`) | 6.x | website only; admin uses Payload i18n |
| URL state | `nuqs` | 2.x | listings |
| External APIs | `@octokit/rest` (+ throttling, retry), `zod`, `p-limit` | 22 / 4 / – | sync |
| Analytics & consent | GA4 via `@next/third-parties`, `vanilla-cookieconsent` 3, Consent Mode v2 | | [§16](frontend.md#16-seo-analytics-consent-security) |
| Observability | OpenTelemetry `@opentelemetry/sdk-node` + auto-instrumentations, OTLP/HTTP protobuf; pino logs | 0.223 / 0.81 | Grafana (Tempo, Mimir, Loki) |
| SEO | `plugin-seo`, `next-sitemap`, JSON-LD | | |
| Tests | Vitest, Playwright, `@axe-core/playwright` | | |
| Deployment | Docker (multi-stage), Kubernetes, Helm v4 chart | | [§18](operations.md#18-deployment-model) |

---

## 1. System overview

```
                 ┌───────────────────────── Kubernetes ──────────────────────────┐
 Browser ──TLS──▶ Ingress ──▶ web Deployment (N pods, Next.js + Payload, JOBS_AUTORUN=false)
   │                              │  Local API / REST / GraphQL / admin panel
   │                              ├──▶ MongoDB (external or in-cluster)
   │                              ├──▶ S3 (Garage) — uploads via S3 API
   │                              └──▶ OTLP endpoint (Alloy / Grafana Cloud)
   │                         worker Deployment (1 pod, Recreate) — `node cli.mjs worker`
   │                              ├──▶ MongoDB, S3, SMTP, GitHub API, npm API, source sites
   │                         migrate/seed Job (Helm pre-install/pre-upgrade hook)
   └──TLS──▶ Garage public web endpoint (own host, e.g. files.example.org → Garage web :3902;
             S3_PUBLIC_URL) — files are served by Garage directly, never proxied through the app
```

One small container image (Next.js standalone output + one bundled `cli.mjs`), three roles: **web** (`node server.js`), **worker** (`node cli.mjs worker`), **migrate** (`node cli.mjs migrate && node cli.mjs seed`). See [ADR-023](../decisions/0023-small-image-with-bundled-cli-scripts.md).

---

## 2. Template adaptation (Website template v3.90.2)

| Template part | Action |
|---|---|
| `pages` collection + layout builder + heros + blocks (CallToAction, Content, MediaBlock, Archive, Code, Banner) | **Keep.** Used for Home, Community, About, Privacy. |
| `FormBlock` + `@payloadcms/plugin-form-builder` + `src/blocks/Form/*` | **Remove** (nothing uses forms). [ADR-015](../decisions/0015-template-features-removed.md) |
| `posts`, `categories` collections, `nestedDocsPlugin` (only used by categories) | **Replace** with brief's Posts + Post Media; remove Categories and nested-docs. |
| `searchPlugin` + `/search` page | **Remove**; listings search with plain `where` queries on title/description. [ADR-015](../decisions/0015-template-features-removed.md) |
| `redirectsPlugin` | Keep (`pages`, `posts`). Admin-only. |
| `seoPlugin` | Keep (`pages`, `posts`); title suffix "Payload CMS Community Portal". |
| `header` / `footer` globals | Keep; seeded menu; footer gets "not affiliated" note (Lingui string rendered by the component, not stored content) and "Cookie settings" link. |
| `/posts/[slug]` rendering (PostHero, RichText, RelatedPosts) | Reuse at `/news/[slug]` for community posts. |
| `/next/seed` endpoint + admin "Seed" button (`BeforeDashboard/SeedButton`) | Remove; replaced by `pnpm seed` / `pnpm seed:dev` scripts. |
| `BeforeLogin` | Replace with OAuth buttons component. |
| `BeforeDashboard` | Replace with the pending-moderation widget. |
| Live preview + `/next/preview` | Keep for pages and community posts. |
| `AdminBar` (`@payloadcms/admin-bar`) | Keep. |
| Template `Dockerfile` | Base for our multi-stage Dockerfile (Node 24, pnpm, non-root). |
| `tests/e2e`, `tests/helpers/{login,seedUser}.ts`, Vitest config | Extend. |
| `DATABASE_URL` env name | Renamed to our existing `DATABASE_URI`. |

---

## 21. Project layout (target)

```
src/
  access/            roles & access helpers
  auth/oauth/        github.ts, google.ts, resolveOAuthAccount.ts (pure, unit-tested)
  collections/       Users, Sources, Posts, PostMedia, Media, Resources, Plugins, Builds, Pages
  moderation/        config.ts (MAX_PENDING_SUBMISSIONS), hooks, endpoint, admin components
  jobs/              tasks (syncPosts, syncPlugins, notifyModerators, notifyAuthor, sendInvitation, sendEmail)
  sync/posts/        types.ts, adapters/payloadRest.ts, mapper.ts
  sync/plugins/      github.ts, npm.ts, mapper.ts, filter.ts
  email/             templates/*.tsx, messages.ts, render.ts
  otel/              sdk.ts, metrics.ts, withSpan.ts
  seed/              index.ts (prod), dev.ts, data/
  cli/               index.ts → bundled to cli.mjs (migrate, seed, worker, self-test) — ADR-023
  migrations/        Payload migrations, index.ts (explicit list used by `cli.mjs migrate`)
  app/(frontend)/    website routes
  app/(payload)/     admin + API (template)
  app/api/health/    live, ready
  locales/en/        Lingui catalog
tests/e2e/, tests/unit/, tests/fixtures/
deploy/helm/payload-cms-community-portal/, deploy/grafana/
docs/, spec/
```
