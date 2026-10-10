# AGENTS.md — Payload CMS Community Portal

Guidance for AI agents and developers working in this repository. Read `spec/README.md` first, then `spec/BRIEF.md` (what to build), `spec/architecture/` (how it is built) and `spec/decisions/` (why) before changing anything.

## Environment

- Work happens **inside the DDEV web container** (`plc-web`), project root `/app`. Do not run `ddev` commands from inside; ask the user to run host commands such as `ddev restart`.
- Node.js 24, **pnpm only** (corepack). Never commit `package-lock.json` or `yarn.lock`.
- MongoDB: DDEV service `mongo` (`db`/`db`); app database `plc`, E2E database `plc_test`.
- S3: Garage at `http://garage:3900` (region `garage`, bucket `garage`, path-style); public URL `https://garage.plc.ddev.site:3902`. Tests use a separate key prefix.
- Email: Mailpit SMTP `127.0.0.1:1025`; API `http://127.0.0.1:8025/api/v1/`; UI `https://plc.ddev.site:8026`.
- Playwright browsers are installed; run headless (`DISPLAY=:0` exists for headed debugging).
- Helm v4 is installed but there is **no cluster**: only `helm lint` / `helm template`. Never deploy.
- `.env` holds real secrets: never overwrite it or print its values. Add new variables to `.env` with empty values and document them in `.env.example`. If a required value is empty, tell the user.
- Never edit files marked `#ddev-generated` in `.ddev/`. DDEV config is local only (`/.ddev` is gitignored); `.ddev/config.generic-app.yaml` (add-on) exposes Next.js port 3000 as `https://plc.ddev.site`.

## Engineering rules

1. **Minimize custom code**: use Payload's Local API, REST/GraphQL, hooks, access control, official plugins (`plugin-seo`, `plugin-redirects`, `storage-s3`, …) and template building blocks before writing your own.
2. **Prefer popular, maintained npm libraries** over custom implementations. Before adding one, check weekly downloads, last publish date and compatibility with our Payload, Next.js and React versions; record the choice in a new ADR in `spec/decisions/`.
3. **Specs in `spec/`, developer docs in `docs/`.** Do not edit `spec/BRIEF.md` or `spec/bootstrap-prompt.md`; propose changes in `spec/open-questions.md`. Keep `spec/architecture/` in sync with the code in the same commit. Follow the conventions in `spec/README.md` and `spec/decisions/README.md` (kebab-case names, `NNNN-title.md` ADRs, accepted ADRs are superseded, not rewritten).
4. **TypeScript strict mode.** After every schema change run `pnpm generate:types` (and `pnpm generate:importmap` when admin components change) and commit the results. Lint and typecheck must pass.
5. **Small, focused commits** with conventional messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`), at least one per milestone step. Commit only files you changed.
6. **Do not invent requirements silently.** When the brief is ambiguous, choose the least-effort reversible option, record it in `spec/decisions/`, and list it in `spec/open-questions.md`.
7. **Ideas are welcome** in `spec/ideas.md` (value, effort, risks) but are **not implemented** until approved.

## Project-specific conventions

- Versions: `payload` and all `@payloadcms/*` pinned to the same exact version (currently 3.90.2). No v4 canary packages.
- Every user-facing website string goes through Lingui macros; run `pnpm i18n:extract` after UI changes. Admin panel labels use Payload's `i18n` config.
- Website data access: Local API with `draft: false` and `overrideAccess: false` (no user) for public pages.
- Moderated collections (Posts, Resources, Plugins, Builds) share `src/moderation/` hooks; never set `moderation.*` or `_status` directly outside moderation actions, sync jobs or seeds.
- Emails are only sent from jobs (`payload.jobs.queue`), never inline in a request.
- External payloads (GitHub, npm, source sites, OAuth providers) are validated with `zod`.
- Jobs must be idempotent and log one structured summary line.
- No secrets in client bundles; client components never read `process.env`.

## Commands

Available from M1 on (scripts defined in `package.json`):

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Next.js + Payload dev server on port 3000 (jobs auto-run) |
| `pnpm build` / `pnpm start` | Production build / start |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests + Playwright E2E |
| `pnpm test:unit` | Vitest only |
| `pnpm test:e2e` | Playwright against `plc_test` |
| `pnpm generate:types` | Regenerate `src/payload-types.ts` |
| `pnpm generate:importmap` | Regenerate the admin import map |
| `pnpm migrate` / `pnpm payload migrate:create <name>` | Apply migrations (via `src/cli`) / create one |
| `pnpm seed` | Idempotent production seed (sources, pages, navigation) |
| `pnpm seed:dev` | Local sample data and users (never in production) |
| `pnpm worker` | Run the jobs worker locally (`src/cli` via `tsx`; the image runs `node cli.mjs worker`) |
| `pnpm i18n:extract` / `pnpm i18n:compile` | Lingui catalogs |
| `pnpm payload jobs:run --queue sync` | Run queued sync jobs once |
| `helm lint deploy/helm/payload-cms-community-portal` | Chart validation |

## Layout

```
spec/            README.md (index), BRIEF.md (read-only), bootstrap-prompt.md (read-only), open-questions.md, ideas.md
  architecture/  README.md (stack, overview, layout), access-control, data-model, moderation, auth, sync, frontend, operations
  decisions/     README.md (index + template), NNNN-short-title.md (one ADR per file)
docs/            README.md (index), getting-started.md, development.md, moderation.md, deployment.md, observability.md, runbooks/
src/
  access/        role and access helpers
  auth/oauth/    GitHub/Google user info + account linking (pure, unit-tested)
  collections/   Users, Sources, Posts, PostMedia, Media, Resources, Plugins, Builds, Pages
  moderation/    MAX_PENDING_SUBMISSIONS, shared hooks, moderation endpoint, admin view/components
  jobs/          Payload job tasks
  sync/          post adapters (payload-rest), plugin sync (GitHub, npm)
  email/         react-email templates and messages
  otel/          OpenTelemetry SDK, metrics, span helpers
  seed/          production and dev seeds
  cli/           entry point bundled into cli.mjs (migrate, seed, worker, self-test)
  migrations/    Payload migrations (incl. partial unique indexes)
  app/           Next.js routes: (frontend) website, (payload) admin + API, api/health
  locales/       Lingui catalogs
tests/           e2e (Playwright), unit (Vitest), fixtures
deploy/          helm/payload-cms-community-portal, grafana dashboards
.ddev/           DDEV config (local only, not committed)
```

## Milestones

M0 plan → M1 scaffold → M2 auth/data model/roles → M3 moderation → M4 frontend → M5 sync jobs → M6 production readiness → M7 quality. At the end of each milestone: lint, typecheck, tests, commit, short summary. See `spec/bootstrap-prompt.md` §4.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
