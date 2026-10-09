# Bootstrap prompt: Payload CMS Community Portal

> Copy everything below the line into a new Cursor Agent chat (Agent mode).

---

You are bootstrapping a new project from scratch: **Payload CMS Community Portal**. The product brief is in `spec/BRIEF.md`. Read it fully before doing anything else. The brief is the source of truth for *what* to build; this prompt defines *how*: the environment, the versions, the implementation choices for things the brief leaves open, and the order of work.

## 1. Environment (already provisioned; do not reinstall)

- You run **inside the DDEV web container** (`plc-web`). The project root is `/app` (a git repo on branch `master`). Do not run `ddev` commands from here; run `pnpm`, `node`, and `npx` directly. When something needs `ddev` on the host (for example `ddev restart`), ask me.
- Node.js 24 and **PNPM** are available (corepack enabled). Use `pnpm` only. Never commit `package-lock.json` or `yarn.lock`.
- **MongoDB** runs as the DDEV service `mongo` (user `db`, password `db`). The app uses database `plc`; E2E tests use a separate database `plc_test`.
- **S3 storage** is provided locally by the `ddev-garage` add-on: S3 API at `http://garage:3900` inside the containers, region `garage`, bucket `garage`, path-style addressing, and the bucket's public website endpoint at `https://garage.plc.ddev.site:3902` (from the host browser). E2E tests use a separate key prefix or bucket so they never touch development files.
- **Email** is caught locally by DDEV's **Mailpit**: SMTP at `127.0.0.1:1025` inside the web container (no auth, no TLS), web UI at `https://plc.ddev.site:8026` from the host, and the Mailpit API at `http://127.0.0.1:8025/api/v1/` inside the container, which E2E tests can use to assert sent emails.
- **Playwright** browsers are already installed in the container. Run headless by default (`DISPLAY=:0` exists for headed debugging).
- **Helm** (v4) is installed in the container, but there is **no** Kubernetes cluster. Validate the chart with `helm lint` and `helm template` only. Never try to deploy anywhere.
- **`.env` already exists** and contains real values: `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, `CRON_SECRET`, `GITHUB_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_GITHUB_LOGINS`, `ADMIN_EMAILS`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`. Never overwrite it or print its values. Add any new variables to it with empty values, and keep a documented `.env.example` in sync. If a required value is empty, tell me instead of working around it.
- The DDEV primary URL is `https://plc.ddev.site`; nginx currently serves it, and nothing is exposed on the Next.js port. The Next.js app listens on port `3000`. To make it reachable from the host, add a **new** file `.ddev/config.payload.yaml` (using `web_extra_exposed_ports`, and optionally `web_extra_daemons` to run the dev server), then ask me to run `ddev restart`. Never edit files marked `#ddev-generated` in `.ddev/`.

## 2. Tech stack and versions

- **Payload CMS v3**, latest stable (`npm view payload dist-tags.latest`; 3.90.x at the time of writing). Use the same exact version for `payload` and all `@payloadcms/*` packages. Do not use v4 canary packages.
- **Starting point**: the official **Website template** through the standard flow: `pnpm dlx create-payload-app@latest -t website --db mongodb`. The tool expects an empty target, so scaffold into a temporary directory, then move the result into `/app`, keeping the existing `.gitignore` entries, `.env`, `.ddev/`, and `spec/`.
- **UI**: Tailwind CSS + shadcn/ui; the template already ships both. Add components with `pnpm dlx shadcn@latest add ...` instead of hand-writing primitives. Keep the template's look, which matches the official Payload website, and its light/dark theme switcher.
- **Database**: `@payloadcms/db-mongodb`.
- **File storage**: `@payloadcms/storage-s3` for **all** upload collections (Media, Post Media), configured from the `S3_*` variables (`forcePathStyle` for Garage). Nothing is written to the local disk.
  - The bucket is **public**: file URLs point directly to `S3_PUBLIC_URL` (the public bucket URL or a CDN in front of it) through `generateFileURL` / `disablePayloadAccessControl`, so files are not proxied through the app.
  - Configure `next/image` `remotePatterns` from `S3_PUBLIC_URL`. In DDEV, verify that the image optimizer inside the container can actually fetch `https://garage.plc.ddev.site:3902`; if it cannot (DNS or self-signed certificate), add a dev-only workaround (for example, an internal URL used only by the server-side image loader) and document it, without changing the production behavior.
- **Email**: `@payloadcms/email-nodemailer` configured from the `SMTP_*` and `EMAIL_FROM_*` variables (Mailpit locally, any SMTP server in production). The production provider is not chosen yet: stay provider-agnostic (plain SMTP only), and list the SPF, DKIM, and DMARC DNS records that will be needed in `docs/deployment.md`. Email templates use `react-email` (`@react-email/components`) or plain HTML; keep them simple and translatable later.
- **i18n**: Lingui.js (`@lingui/core`, `@lingui/react`, `@lingui/cli`, macros through `@lingui/swc-plugin` for Next.js), with the locale `en` only. **Every** user-facing frontend string goes through Lingui macros, with no hardcoded UI text, and `pnpm i18n:extract` must produce a complete catalog. Labels in the Payload admin panel use Payload's own `i18n` config, not Lingui. Content localization is out of scope.
- **Authentication**: GitHub and Google OAuth through an existing **Payload v3 OAuth plugin**. Candidates, by weekly downloads:
  - `payload-oauth2`: simple, works with the admin panel; the default choice.
  - `payload-authjs`: Auth.js / next-auth v5.
  - `payload-auth`: Better Auth.

  Pick the one that needs the least custom code for **both providers** (GitHub and Google) on **both** the website and `/admin`, including linking both providers to one user, check that it supports our exact Payload and Next.js versions, and record the decision.
- **Scheduled tasks**: Payload **Jobs Queue** (tasks with `schedule` cron), not `node-cron` or other schedulers. See section 5 for how jobs run in Kubernetes.
- **Analytics**: Google Analytics 4 through `@next/third-parties/google`, loaded only after consent. Use a maintained cookie-consent library (for example `vanilla-cookieconsent`) together with Google Consent Mode v2. Do not build your own banner logic.
- **Observability**: OpenTelemetry through Next.js `instrumentation.ts` with `@vercel/otel` or `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node` (HTTP, `undici`/fetch, MongoDB). Export traces, metrics, and logs over **OTLP/HTTP (protobuf)** using the standard `OTEL_*` environment variables; when `OTEL_EXPORTER_OTLP_ENDPOINT` is empty, export nothing. The production backend is **Grafana**: Tempo for traces, Mimir/Prometheus for metrics, Loki for logs. Telemetry goes either through an in-cluster **Grafana Alloy** (or OTel Collector) or straight to the Grafana Cloud OTLP gateway (`OTEL_EXPORTER_OTLP_HEADERS` carries the `Authorization` header); both must work by configuration only. Set the resource attributes `service.name`, `service.version` (from the image tag/package version), `deployment.environment`, and the Kubernetes pod/namespace attributes (via the `k8s` resource detector or `OTEL_RESOURCE_ATTRIBUTES` set in the Helm chart with the downward API). Use metric names and units that follow the OTel semantic conventions so they map cleanly to Prometheus. Use Payload's built-in `pino` logger (`payload.logger`) for structured JSON logs to stdout, with trace/span IDs injected (`@opentelemetry/instrumentation-pino`), and record unhandled errors as span exceptions (Next.js `onRequestError`). Wrap each job task in its own span. No vendor SDKs (no Sentry).
- **External data**: `@octokit/rest` (GitHub) and `zod` (validating every external payload). Use `@payloadcms/richtext-lexical`'s converters to turn Lexical JSON into plain text.
- **Listing state in URLs**: prefer `nuqs` (or plain `searchParams`) over custom state handling.
- **Tests**: Playwright E2E in `tests/e2e` (the template has a setup to extend), and Vitest for pure functions such as adapters, mappers, and filtering rules.

## 3. Engineering rules (also write them into `AGENTS.md` so future agents follow them)

1. Minimize custom code: use Payload's Local API, REST/GraphQL, hooks, access control, official plugins (`plugin-seo`, `plugin-search`, `plugin-redirects`, `plugin-nested-docs`, `storage-s3`, ...) and template building blocks before writing your own.
2. Prefer popular, maintained npm libraries over custom implementations. Before adding one, check weekly downloads, the last publish date, and compatibility with our Payload, Next.js, and React versions, and write the choice down in `spec/decisions.md`.
3. Technical specifications live in `spec/`, and developer documentation in `docs/`. Do not edit `spec/BRIEF.md` or `spec/bootstrap-prompt.md`; propose changes to them in `spec/open-questions.md`.
4. Use TypeScript strict mode. Run `pnpm generate:types` (and `pnpm generate:importmap` when admin components change) after every schema change, and commit the results. Lint and typecheck must pass.
5. Make small, focused commits with conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`): at least one per milestone step.
6. Do not invent requirements silently. When the brief is ambiguous, choose the least-effort reversible option, record it in `spec/decisions.md`, and list it in `spec/open-questions.md`.
7. **Ideas are welcome.** The brief has no "out of scope" list on purpose. Write any feature ideas you have (with value, effort, and risks) into `spec/ideas.md`, but **do not implement them** until I approve.

## 4. Order of work (milestones)

Finish each milestone before starting the next. At the end of each one: run lint, typecheck, and tests, commit, and give me a short summary.

**M0 – Plan (no code yet).** Write:
- `spec/architecture.md`: collections with all fields (based on the brief's proposed fields), an access-control matrix per role and per operation, the moderation state machine (who can move an entry from which status to which, and what happens to edits of published entries), globals, routes, jobs, the authentication flow, email notifications, storage, observability, the deployment model with the Helm chart structure, the external integrations with exact endpoints, and the mapping from each external field to a collection field.
- `spec/decisions.md`: an ADR-style log (the OAuth plugin choice, the moderation implementation, storage, how jobs and migrations run in Kubernetes, the OpenTelemetry setup, template adaptations, libraries).
- `spec/open-questions.md` and `spec/ideas.md`.
- `AGENTS.md`: the rules from section 3, the commands, and the project layout.

Then **stop and wait for my review** before starting M1.

**M1 – Scaffold.** Set up the Website template with MongoDB and S3 storage (Garage). Check that `pnpm dev` serves the frontend and `/admin`, and that an uploaded image is stored in Garage and displayed. Add `.ddev/config.payload.yaml`. Add `docs/getting-started.md` (setup inside DDEV, environment variables, seeding, running jobs and tests, creating the GitHub OAuth App and the Google OAuth client with their exact callback URLs).

**M2 – Auth, data model, and roles.** GitHub and Google OAuth sign-in, email/password sign-in for admin-created accounts with the "set your password" email (website and admin), roles and access control, all collections, admin grouping, and an idempotent seed script (`pnpm seed`) with the Payload blog source, the frontpage, Community, About and privacy pages, and the navigation. Sample data for local development goes into a separate `pnpm seed:dev`, never into production.

**M3 – Moderation.** The pre-moderation workflow, the 3-pending-entries limit, email notifications to moderators and authors through the Jobs Queue (checked in Mailpit), and the moderation dashboard in the admin panel. Add `docs/moderation.md` for moderators.

**M4 – Frontend.** Pages, navigation, listings with search/filters/sorting/pagination, community post pages, Lingui wiring, SEO, the cookie banner with Google Analytics, and the "not affiliated" footer note.

**M5 – Synchronization jobs.** Post sync (the `payload-rest` adapter + image download to S3) and plugin sync (GitHub + npm enrichment, imported and manual plugins), each with a manual trigger for admins.

**M6 – Production readiness.** OpenTelemetry, health endpoints, the Dockerfile, the job worker, the migrations/seed Job, the Helm chart, and `docs/deployment.md`.

**M7 – Quality.** Complete the Playwright suite, accessibility checks (`@axe-core/playwright`), a Lighthouse check of the main pages, and the remaining `docs/` pages.

## 5. Implementation guidance for the brief

### Template adaptation
- **Replace** the template's `posts` and `categories` collections with the brief's Posts (imported + community) and Post Media collections. Reuse the template's post page rendering for community posts at `/news/[slug]`.
- Keep the template's `pages` collection and layout builder for **Home**, **Community**, **About**, and **Privacy policy**; create them with the seed script.
- Keep the `header` / `footer` globals, and seed the main menu exactly as listed in the brief.
- Remove template features nothing uses (for example the form builder) and record this in `decisions.md`.

### Authentication and users
- Sign-in methods: OAuth with **GitHub** and **Google**, and **email/password** (Payload's built-in local strategy), on both the website (a "Sign in" page offering both providers and an email/password form) and `/admin` (both OAuth buttons on the standard login screen).
- **No public sign-up with a password.** User `create` access is admin-only, except for the OAuth sign-in flow. Make sure the REST/GraphQL `create` and the admin "create first user" screen cannot be abused once an admin exists.
- **Admin-created password accounts**: when an admin creates a user without OAuth, do not make the admin set or send a password. Trigger Payload's built-in `forgotPassword` flow (from an `afterChange` hook or the job queue) so the user gets an email with a link to set their password, and customize that email's text for this "invitation" case. The regular "forgot password" flow stays available for all password users. Restyle the reset-password page only as far as the template needs.
- Users created through OAuth have no usable password. Check how the chosen plugin handles the local strategy's password requirement (usually a random unusable password), and make sure "forgot password" for such a user does not let anyone take over the account without access to its verified email.
- On OAuth sign-in, find the user by provider ID (`githubId` / `googleId`). If none matches, find them by email (including admin-created password accounts), **only if the provider reports the email as verified** (GitHub: the primary verified email from `/user/emails`; Google: `email_verified`). Link the provider to that user; otherwise create a new user. Never link accounts by unverified emails.
- Users with a GitHub login listed in `ADMIN_GITHUB_LOGINS`, or a verified email listed in `ADMIN_EMAILS`, get the `admin` role on every sign-in.
- Request minimal OAuth scopes: GitHub `read:user user:email`; Google `openid email profile`.
- Each provider is enabled only when its client ID and secret are set; hide the disabled provider's button.
- Users can delete their own account from the website (GDPR). Their community content is then either deleted or anonymized; propose which in `open-questions.md` and default to anonymizing.
- **E2E tests** sign in with **seeded email/password users** (one regular user, one moderator, one admin) created by the test setup in `plc_test`. No special test-only auth strategy is needed. OAuth flows are covered by Vitest tests of the linking logic, with the provider responses mocked.

### Where users create content
Signed-in users create and edit their Posts, Resources, Plugins, and Builds **in the Payload admin panel**, which keeps custom code to a minimum. Regular users see only the collections and documents they may access; Users and Sources are hidden from them. Add "Submit" links on the website that lead to the matching admin "create" view. After submitting, the user sees that the entry is waiting for moderation, and can see its status (and rejection reason) in their list of entries.

### Access control (implement exactly as the brief describes)
- Anonymous visitors read only entries with `status: published` (and Plugins that are not `hidden`).
- Signed-in users create Posts, Resources, Plugins, and Builds. Entries from regular users start as `pending`; entries from moderators, admins, and sync jobs start as `published`. `createdBy` and `origin` are set by hooks and are read-only.
- Owners can read all their own entries (any status, including the rejection reason), and update and delete them, except the `status` field and imported entries.
- Moderators can read, update, approve, reject, unpublish, and delete Posts, Resources, Plugins, and Builds of any user, and can edit the Community page.
- Admins can do everything, including Users, roles (field-level access), and Sources.
- Fields filled by synchronization (on imported posts, and the GitHub/npm fields on all plugins) are read-only in the admin panel for everyone except admins.

### Moderation workflow
- Implement it with Payload built-ins as much as possible.
  - **Versions with drafts** (`versions: { drafts: true }`) on Posts, Resources, Plugins, and Builds: the published version stays live while a newer draft waits for review, which covers the brief's rule "the previously approved version stays visible until the changes are approved".
  - Regular users can only save drafts. Publishing is allowed only for moderators and admins: enforce it in access control and hooks, not only by hiding the button.
  - A `moderation` field group on top of drafts: `status` (`pending`, `published`, `rejected`, `unpublished`), `rejectionReason`, `moderatedBy`, `moderatedAt`.
  - Confirm in M0 that drafts + this field group cover every transition in the brief; if a simpler model does, propose it.
- State transitions:
  - Create or edit by a regular user → `pending`.
  - Approve → `published` (publishes the latest draft).
  - Reject → `rejected`, with a reason; an existing published version stays live.
  - Unpublish → `unpublished` (hidden).
  - Re-publish by a moderator → `published`.
  - When an author edits a `rejected` or `unpublished` entry, it goes back to `pending`.
- Public queries must only return published versions; double-check the Local API calls on the website (`draft: false`, `overrideAccess: false` where a user context exists).

### Submission limit (max 3 pending per regular user)
- Enforce it in **one shared `beforeChange` hook** used by Posts, Resources, Plugins, and Builds, on every transition **into** `pending` by a regular user: create, an edit of a published entry, or an edit of a `rejected` / `unpublished` entry.
- Count the user's entries with `moderation.status: pending` across all four collections (indexed `createdBy` + status queries); refuse when the count is already 3.
- Saving changes to an entry that is **already pending** does not count again.
- Throw a Payload `APIError` (HTTP 403 or 429) with a clear, translatable message ("You have 3 submissions waiting for review…"), shown in the admin panel and returned by the REST API.
- Make the limit a single constant/config value (`MAX_PENDING_SUBMISSIONS = 3`) so it is easy to change. Moderators and admins are exempt.
- A rare race between two simultaneous saves may let a 4th entry through; that is acceptable. Note it in `decisions.md` instead of adding locking.
- Show the user how many pending slots they have left on the admin "create" views (a small banner component), if it is cheap.

### Notifications
All emails are sent by Payload jobs queued from `afterChange` hooks, never inline in the request.

- **To moderators** (`notifyModerators`): on create, and on an edit of a published entry by a regular user. Recipients are all users with the `moderator` or `admin` role who have moderation notifications enabled and an email address. The email contains the entry type, title, author, submission date, and direct links to the admin edit view and to the moderation dashboard.
- **To authors** (`notifyAuthor`): on approve, with a link to the entry on the website (or the portal post page for community posts); on reject, with the rejection reason and a link to edit the entry in the admin panel. Send only if the author has these notifications enabled and an email address. Never notify a moderator about their own action on their own entry.

Shared rules:

- Job retries handle SMTP failures. A failed email never fails the save.
- Avoid duplicates by notifying once per status **transition** (into `pending`, `published`, or `rejected`), not on every save.
- Keep the email templates in one place, with a shared layout, plain-text alternatives, and the portal name; write the texts so they can be translated later.

### Moderation dashboard
- A custom admin view (for example `/admin/moderation`) linked from the admin navigation and visible only to moderators and admins, plus a small widget on the admin dashboard with the number of pending entries.
- Tabs: Pending (oldest first), Rejected, Unpublished. Each tab is one combined list across Posts, Resources, Plugins, and Builds: type, title, author, date, and a link to the diff/edit view.
- Actions: approve, reject (with a reason), and re-publish, all through the Local API or a protected endpoint that reuses the same access rules.
- Build it with Payload admin UI components (`@payloadcms/ui`) so it looks native. Keep it server-rendered with as little client code as possible.

### Listings
- All listing pages are server-rendered, use Payload `where` / `sort` / `page` queries, and keep the state in URL search params.
- The search box queries title and description. Filters and sort options follow the brief per page; when a filter needs a list of values (tags, topics), load the distinct values with the Local API, not a hardcoded list.
- Imported and community posts are listed together with the same card design, as the brief describes; there is no "external" label on community posts.
- External cards link to the external URL in a new tab with `rel="noopener noreferrer"`. Community posts link to `/news/[slug]` instead.

### Post synchronization (`syncPosts`, cron `0 */6 * * *`)
- Only the `payload-rest` adapter is implemented now, but put it behind a small common interface (`fetchItems(source) => NormalizedPost[]`) so an RSS adapter can be added later without touching the job. Do not add RSS code or dependencies now.
- `payload-rest` adapter: query `{endpoint}?depth=1&sort=-publishedOn&limit=50&where[_status][equals]=published` and paginate until it reaches already-imported items. The Payload blog response has been checked; it contains `id`, `title`, `slug`, `publishedOn`, `authors[].firstName/lastName`, `image.url`, `image.alt`, `category`, and `excerpt` (Lexical JSON, convert to plain text for `summary`). **Verify the public post URL pattern** (probably `https://payloadcms.com/posts/blog/{slug}`; check whether `category` changes it) before hardcoding it.
- Images: download each image once into **Post Media** in S3 (de-duplicate by original URL), then link it to the post. A failed image download must not fail the post import.
- Upsert by `url` and update the Source's `lastSyncedAt`, status, and error. A single bad item must not abort the run.

### Plugin synchronization (`syncPlugins`, cron `0 3 * * *`)
- Use GitHub Search (`topic:payload-plugin fork:true`; without `fork:true`, forks are excluded) through `@octokit/rest` with `GITHUB_TOKEN`, and paginate all results. Keep in mind the 1,000-result search cap and the rate limits.
- Filtering: import all non-fork repos; import forks only when `stargazers_count > 2`.
- npm enrichment: read the `name` (and `private`) fields of the repo's `package.json` through the GitHub contents API, then fetch `https://registry.npmjs.org/{name}` (latest version, last publish date) and `https://api.npmjs.org/downloads/point/last-week/{name}`. If the package is missing or private, leave the npm fields empty. Handle monorepos gracefully: do not crash, and leave the npm fields empty when no single package can be identified.
- **Manual plugins** (added by users): refresh their GitHub data when the repository URL points to GitHub, and their npm data when they have an npm package. Never hide them for lacking the topic. When the search finds a repo that already exists as a manual plugin (matched by `fullName`), update that entry, keeping its `origin` and `createdBy`, instead of creating a duplicate.
- Imported repos that are no longer returned by the search get `hidden: true` (never deleted). Repos that come back are un-hidden.
- Upsert by `fullName`; log created, updated, hidden, skipped, and failed counts.

### Shared job rules
- Jobs are idempotent: re-running them without upstream changes changes nothing.
- Admins can trigger each job manually (an admin UI button or a `CRON_SECRET`-protected endpoint).
- Logs are concise, structured, and written to stdout; the sync status is visible in the admin panel.

### Kubernetes deployment
- **Stateless app**:
  - All files go to S3, and there is no local cache that matters.
  - Configuration comes only from environment variables.
  - Use Next.js `output: 'standalone'` with a multi-stage Dockerfile (start from the template's `Dockerfile`); run as a non-root user.
  - The image also contains what the migration/seed Job and the job worker need (the Payload CLI and the seed script), so one image serves all three roles.
- **Health endpoints**: `/api/health/live` (process is up) and `/api/health/ready` (database reachable), used by the probes.
- **Migrations and seeding run as a one-off Job**:
  - A Helm hook Job (`pre-install,pre-upgrade`, `hook-delete-policy: before-hook-creation,hook-succeeded`) runs `payload migrate` and then the production seed (`pnpm seed`).
  - The seed is idempotent: it creates the missing base content (Payload blog source, pages, navigation) and never overwrites edits made in the admin panel.
  - Web and worker pods do not run migrations on startup.
  - Use Payload migrations (`payload migrate:create`) for schema/data changes that need them, even with MongoDB.
- **Scheduled jobs must run once, not once per pod.** Recommended setup (confirm it in M0 against the Payload docs for our version):
  - Web pods do not auto-run jobs (`autoRun` is disabled by an environment flag, for example `JOBS_AUTORUN=false`).
  - A single-replica **worker** Deployment (`strategy: Recreate`) runs the same image with `payload jobs:run --cron ... --handle-schedules` (or the equivalent for our version). It also processes the email notification queue.
  - Locally in DDEV, `autoRun` stays enabled so jobs run with `pnpm dev`.
- **Helm chart** in `deploy/helm/payload-cms-community-portal`:
  - Templates for the web Deployment (configurable replicas, optional HPA), the worker Deployment, the migration/seed hook Job, Service, Ingress (with TLS), ServiceAccount, optional PodDisruptionBudget, and a ConfigMap for non-secret settings.
  - Secrets come from an **existing Secret** referenced in values (`existingSecret`); the chart never contains secret values. Optionally support creating a Secret from values for local testing only.
  - Configurable values: image repository/tag/pullPolicy, resources, probes, node selectors, tolerations, affinity, extra env vars, OTEL settings, S3/SMTP/MongoDB settings (non-secret parts), Ingress hosts and annotations.
  - Sensible defaults, `values.schema.json` for validation, `NOTES.txt`, and a `README.md` with a values table (generate it with `helm-docs` if available).
  - Must pass `helm lint` and `helm template` with the default values and with an example `values-production.example.yaml`.
- Document in `docs/deployment.md`: building and pushing the image, the required Secret keys, installing and upgrading with Helm, how migrations/seeding run, the worker, probes, OTEL configuration, and rollback.

### Non-functional
- **SEO**: the template's SEO plugin plus `next-sitemap` (already in the template); Open Graph images; canonical URLs; JSON-LD where it fits.
- **Analytics and consent**: Google Analytics 4 loads only after the visitor accepts analytics cookies (Consent Mode v2 defaults set to `denied`). The banner lets visitors accept, reject, and change their choice later (a link in the footer). If `NEXT_PUBLIC_GA_MEASUREMENT_ID` is empty, neither the banner nor GA loads.
- **Accessibility**: WCAG 2.2 AA; check the main pages with `@axe-core/playwright` in E2E tests.
- **Security**: HTTP security headers (allowing Google Analytics and the public S3 URL in the CSP), Payload rate limiting, no secrets in client bundles.
- **Observability**: every request, Local API call, outgoing HTTP call (GitHub, npm, source sites, S3, SMTP), and job run is traced; errors are recorded on spans and logged with the trace ID. Add a few useful custom metrics (for example items imported per sync, sync failures, pending moderation count, submissions refused by the limit, emails sent/failed). Document how to debug locally with the all-in-one **`grafana/otel-lgtm`** image (Grafana + Tempo + Loki + Prometheus + OTel Collector in one container), run temporarily; do not add it to DDEV permanently without asking me. Put a starter Grafana dashboard JSON (requests, errors, latency, job runs, sync results, moderation queue) in `deploy/grafana/`, and a few suggested alert rules in `docs/deployment.md`.

### Tests (Playwright against the seeded `plc_test` database; external HTTP mocked)
At least:
- Every main-menu item opens a page that renders its heading, in both light and dark mode.
- News, Resources, Plugins, and Builds list the seeded items; search, filters, sorting, and pagination work and are reflected in the URL.
- News shows imported and community posts in one list; community posts open their portal page and have no external label.
- Hidden plugins and pending, rejected, and unpublished entries do not appear publicly.
- **Pre-moderation**:
  - A regular user (seeded password account) creates a Resource and a manual Plugin. They are `pending` and not visible on the website, and every moderator/admin with notifications enabled receives exactly one email (checked through the Mailpit API).
  - A moderator approves the Resource and it appears, and the author receives one "approved" email with a link to it. The moderator rejects the Plugin with a reason; the author sees the reason in the admin panel and receives one "rejected" email containing it.
  - An author with author notifications turned off receives no email.
  - **Submission limit**:
    - A regular user with 3 pending entries (any mix of types) cannot submit a 4th; they get the clear error in the admin panel, and the REST API returns it too.
    - Editing one of the 3 pending entries still works.
    - After a moderator approves one, the user can submit again.
    - A moderator is never limited.
  - The author edits the published Resource: the old version stays visible, a new notification is sent, and after approval the new version is shown.
  - A regular user cannot publish their own entry (also through the REST API, not only in the UI), edit another user's entry, change the status, or edit synced fields.
  - A moderator unpublishes an entry and it disappears; the owner cannot re-publish it.
  - A moderator's own new entry is published immediately and sends no notification.
- **Moderation dashboard**: it lists pending entries of all four types, oldest first; approve and reject work from it; it is not accessible to regular users.
- A moderator cannot access Sources write operations or user roles.
- **Password accounts**:
  - There is no public sign-up, and the REST `create` on users is rejected for anonymous visitors and non-admins.
  - An admin creates a user, and the user receives a "set your password" email (Mailpit), sets a password through the link, and signs in on the website and in `/admin`.
  - "Forgot password" works for a password user.
- Post sync and plugin sync run against **fixtures** (no live internet), download images once to S3, apply the fork/star rule, hide imported plugins that lost the topic, merge a found repo into an existing manual plugin, and de-duplicate when re-run.
- With a GA ID configured, no Google Analytics request happens before consent, and it loads after the visitor accepts.
- Main pages have no axe violations.
- Account linking (Vitest is fine): a new provider ID creates a user, a verified matching email links the provider to the existing user, an unverified email never links, and the admin lists grant the role.

## 6. Definition of done for the bootstrap

- `pnpm install && pnpm seed && pnpm dev` gives a working site and admin panel inside DDEV, reachable from the host browser, with uploads stored in Garage.
- Signing in with GitHub and with Google works with the OAuth credentials in `.env`, and signing in with both providers using the same verified email leads to one user.
- An admin can create a password account; the user sets their password from the emailed link and signs in. There is no public password sign-up.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm i18n:extract` pass (with no missing strings).
- Both jobs are registered, scheduled, and can be triggered manually; running them against the live sources imports real data.
- Content from regular users is pre-moderated with the 3-pending-entries limit. Moderators get emails about submissions and authors get emails about approvals and rejections (visible in Mailpit), and the moderation dashboard works.
- `docker build` produces an image that starts with only environment variables and S3/MongoDB/SMTP access, and the same image can run the web server, the job worker, and the migration/seed Job.
- The Helm chart passes `helm lint` and `helm template` with the default and the example production values.
- With `OTEL_EXPORTER_OTLP_ENDPOINT` pointing to a temporary `grafana/otel-lgtm` container, traces, metrics, and logs (correlated by trace ID) are visible in Grafana and the starter dashboard loads; without it, the app runs with no OTEL errors.
- `spec/architecture.md`, `spec/decisions.md`, `spec/open-questions.md`, `spec/ideas.md`, `AGENTS.md`, `docs/getting-started.md`, `docs/moderation.md`, and `docs/deployment.md` are up to date.

Start with **M0** now.
