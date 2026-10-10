# Decisions (ADR log)

Format: context → decision → consequences. All ADRs below were **accepted** in the M0 review on 2026-10-10 (with the changes noted in each one). Download counts are npm weekly downloads for 2026-10-01…07.

---

## ADR-001 OAuth plugin: `payload-oauth2`

**Context.** GitHub + Google on both the website and `/admin`, linking both providers to one user by verified email, alongside Payload's local (password) strategy. Candidates checked on 2026-10-09:

| Package | Version / published | Weekly DL | Peer deps | Notes |
|---|---|---|---|---|
| `payload-oauth2` | 1.0.21 / 2026-05-12 | 12.1k | `payload ^3` | Adds a Payload auth strategy + `authorize`/`callback` endpoints to the users collection; zero runtime deps besides `jose`; works with the admin panel and the local strategy; supports PKCE and Payload sessions. One instance per provider. |
| `payload-authjs` | 0.10.2 / 2026-05-29 | 7.3k | `next-auth ^5.0.0-beta.25` | Requires next-auth **v5 beta** (still `5.0.0-beta.32`); Auth.js owns the session, password sign-in would need Auth.js Credentials (no Payload forgot-password flow). |
| `payload-auth` | 3.0.0 / 2026-08-05 | 7.5k | `better-auth`, `@better-auth/passkey`, `@tanstack/react-form`… | Replaces Payload auth with Better Auth: largest surface and migration cost. |

**Decision.** `payload-oauth2`, registered twice (`github`, `google`) with `subFieldName` `githubId` / `googleId`, PKCE enabled, `useEmailAsIdentity: false`.

**Consequences / custom code we still need** (small, unit-tested):
- `getUserInfo` per provider + a pure `resolveOAuthAccount()` that links by **verified** email only (the plugin's `useEmailAsIdentity` links by any email, so it stays off).
- `getUserInfo` returns only safe fields for existing users because the plugin updates the user with whatever it returns on every login.
- The plugin forwards but never verifies `state` → login CSRF is mitigated by PKCE (the code can only be redeemed with the verifier cookie set in the initiating browser). `state` is used only for the post-login return path, validated against relative paths.
- Admin `beforeLogin` component with the two buttons; website `/sign-in` page.
- Reversible: the plugin only adds a strategy, two endpoints and the sub fields.

## ADR-002 Users: admin-created accounts get an invitation via `forgotPassword`

*Revised 2026-10-10:* public email registration was added (ADR-020); this ADR now covers admin-created accounts only.

- OAuth creates users via the Local API flagged with `req.context.oauthSignIn`; anonymous visitors can only register (ADR-020).
- A `beforeOperation` guard on `create` restricts anonymous requests to `name`/`email`/`password` and rejects `/api/users/first-register` (ADR-004).
- Admin-created users: random password set server-side; `afterChange` (create, no provider IDs) queues `sendInvitation`, which calls `payload.forgotPassword({ disableEmail: true })` for the token, extends the token expiry to 7 days via the DB adapter, and sends our "set your password" email linking to Payload's built-in `/admin/reset/{token}` view.
- Regular forgot-password: built-in endpoint + customized `generateEmailHTML/Subject`; expiry 1 h.
- Reset/forgot pages: Payload admin views are reused (no custom website reset page) — least code; the website links to `/admin/forgot`.

## ADR-003 Moderation = Payload drafts + `moderation` group

- `versions.drafts` keeps the published main document live while a newer draft waits; `moderation.status` on each version is the workflow state (see architecture §6).
- Regular users are forced into draft saves in a `beforeOperation` hook (sets `args.draft = true`, `data._status = 'draft'`) — verified in `payload/dist/collections/operations/utilities/update.js` (3.90.2) that the main document is only written when not saving a draft.
- Moderation actions (approve/reject/unpublish/re-publish) go through one endpoint that performs Local API updates with the moderator's `req`.
- Rejected alternative: a status field without drafts — cannot keep the approved version visible during review.
- Rejected alternative: a separate "submissions" collection holding pending changes — more custom code, loses Payload's version diff view.

## ADR-004 First admin and first-register screen

Payload's "create first user" screen creates an already-verified user when the users collection is empty, bypassing email activation. We block `first-register` (ADR-002). First admins: OAuth sign-in with a GitHub login in `ADMIN_GITHUB_LOGINS`, or a verified account (OAuth or activated password account) whose email is in `ADMIN_EMAILS`; locally also `pnpm seed:dev`. Admin roles are added on every sign-in and never removed automatically.

## ADR-005 OAuth sign-up requires a verified email

The users collection keeps the local strategy, so `email` is required and unique. If a provider reports no verified email (GitHub: no verified primary email; Google: `email_verified: false`), sign-in is refused with an explanation instead of creating an account with an unverified or placeholder email. Avoids takeovers via unverified emails and keeps the schema simple. Accepted (Q1).

## ADR-006 Storage: `@payloadcms/storage-s3`, public bucket URLs

All uploads (`media`, `post-media`) go to S3 with `disablePayloadAccessControl: true` and `generateFileURL` → `S3_PUBLIC_URL/{prefix}/{filename}`; no proxying through the app, no local disk. `forcePathStyle` for Garage. `next/image` `remotePatterns` from `S3_PUBLIC_URL`. In DDEV the public hostname resolves to the router and the mkcert CA is trusted (`NODE_EXTRA_CA_CERTS`), so no dev-only workaround is expected (verify in M1).

## ADR-007 Jobs and scheduling in Kubernetes

- Payload Jobs Queue with task `schedule` crons; queues `sync` and `default`.
- `jobs.autoRun` is enabled by `JOBS_AUTORUN` (default `true` for DDEV); web pods set `false`.
- Single worker Deployment (`replicas: 1`, `strategy: Recreate`) running `payload jobs:run --cron "* * * * *" --handle-schedules --all-queues` — flags verified in `payload/dist/bin/index.js` 3.90.2. The worker also sends emails.
- Manual triggers: `POST /api/sync/{posts|plugins}` (admin session or `Bearer CRON_SECRET`) that only **queues** a job; the worker runs it.
- Rejected: Kubernetes CronJobs per task — duplicate scheduling logic outside Payload, cold start per run.

## ADR-008 Submission limit: hook-based, no locking

One shared `beforeChange` hook counts the user's latest-version `pending` entries across four collections (`count` with `draft: true`). Concurrent saves may let a 4th entry through; accepted instead of distributed locks or transactions across collections. `MAX_PENDING_SUBMISSIONS = 3` constant.

## ADR-009 Migrations and seeding

Helm `pre-install,pre-upgrade` hook Job runs `payload migrate` then `pnpm seed` (idempotent: create-if-missing only). Web/worker never migrate on start. MongoDB still uses Payload migrations (`payload migrate:create`) for data/index changes. During a rolling upgrade the old pods run against the migrated DB, so migrations must stay backward compatible (expand/contract) — documented in `docs/deployment.md`.

## ADR-010 One image for web, worker and migrate

Next.js `output: 'standalone'` for the web server, plus a `/app/cli` directory with production `node_modules` and `src/` for the Payload CLI (worker, migrations, seed). Larger image than standalone-only but a single artifact/tag for all three roles. Revisit if size becomes a problem (e.g. bundle the CLI entrypoints with `esbuild`).

## ADR-011 Account deletion anonymizes all content

*Revised 2026-10-10 (Q3):* on user deletion, `createdBy` is cleared on **all** their Posts/Resources/Plugins/Builds/Post Media, in every moderation status; content is shown as "Former member". Pending entries stay in the moderation queue and can still be approved or rejected; author notifications are skipped for entries without an author. Old versions keep only the deleted user's ID.

## ADR-012 Sync updates on documents with a pending draft

A normal Local API update of a document whose latest version is a draft publishes that draft. For plugins with a pending/rejected user edit, the sync updates the published main document's sync-owned fields via `payload.db.updateOne` and the draft via `payload.update({ draft: true })`. Only place where the DB adapter is used directly.

## ADR-013 `NEXT_PUBLIC_*` at runtime

`NEXT_PUBLIC_*` values are inlined at build time, which conflicts with "one image, configuration only through env". The server reads `NEXT_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_GA_MEASUREMENT_ID` from `process.env` at request time (dynamic rendering for the layout part that needs them) and passes them to client components as props; no client code reads `process.env.NEXT_PUBLIC_*` directly. Variable names are kept for compatibility with `.env`.

## ADR-014 Versions

Exact `3.90.2` for `payload` and all `@payloadcms/*`. Keep the template's pins for `next` (16.3.3) and `react`/`react-dom` (19.2.6) — the versions Payload tested the template with — rather than `next@latest` (16.4.0). pnpm only.

## ADR-015 Template features removed

`@payloadcms/plugin-form-builder` + Form block, `@payloadcms/plugin-search` + `/search` page (listings use `where` queries), `plugin-nested-docs` + Categories (replaced by tags), the `/next/seed` endpoint and the dashboard seed button (replaced by `pnpm seed`).

## ADR-016 Libraries

| Need | Library | Version | Weekly DL | Why |
|---|---|---|---|---|
| Email | `@payloadcms/email-nodemailer` | 3.90.2 | official | plain SMTP, provider-agnostic |
| Email templates | `@react-email/components` (+ `@react-email/render`) | 1.0.12 | 7.4M | HTML + plain text, React |
| i18n | `@lingui/core`, `@lingui/react`, `@lingui/cli`, `@lingui/swc-plugin` | 6.9.0 / swc 6.7.1 | 1.6M / 0.4M | required by brief; swc plugin for Next (risk: SWC ABI compatibility with Next 16.3 — verify in M4, fallback in open questions) |
| URL state | `nuqs` | 2.10.2 | 5.2M | typed search params, server cache |
| Consent | `vanilla-cookieconsent` | 3.1.0 (2025-02) | 0.5M | most used maintained consent UI; no React wrapper needed |
| GA | `@next/third-parties` | match Next | 2.8M | official |
| OTel | `@opentelemetry/sdk-node` 0.223, `auto-instrumentations-node` 0.81, `instrumentation-pino`, `exporter-*-otlp-proto`, `resource-detector-container` | | 20M / 9.6M | full control over traces/metrics/logs; `@vercel/otel` (2.9M) lacks log export and MongoDB/pino instrumentation |
| GitHub | `@octokit/rest` 22 + `@octokit/plugin-throttling` + `@octokit/plugin-retry` | | 20M | rate-limit handling |
| Validation | `zod` | 4.x | 324M | external payloads |
| Concurrency | `p-limit` | | 274M | bounded parallel requests |
| A11y tests | `@axe-core/playwright` | 4.13 | 13.6M | |
| Sitemap | `next-sitemap` (template) | 4.2.3 (2023) | 0.5M | already in template; unmaintained since 2023 — replace with Next `sitemap.ts` if it breaks |
| Lexical → text | `@payloadcms/richtext-lexical/plaintext` `convertLexicalToPlaintext` | 3.90.2 | official | |

## ADR-017 Public reads go through access control

Website queries use the Local API with `overrideAccess: false`, `draft: false`, and no user, so the same access rules protect REST, GraphQL and the website. Author names for community posts come from an `afterRead`-populated `populatedAuthor` field (template pattern), not from public read access on `users`.

## ADR-018 Post sync specifics (verified against live data 2026-10-09)

- Public URL is `{siteOrigin}/posts/{category.slug}/{slug}` (category changes the path; `blog`, `releases`, `guides` exist).
- Items without a category (4 of 119, no public page) and future-dated items (a placeholder `draft` post dated 2038) are skipped.
- Tags come from `category.name`.

## ADR-019 Detail pages for Resources, Plugins and Builds (extends the brief)

*Context.* The brief says cards link directly to external sites and there are no detail pages except community posts. Reviewed 2026-10-10: detail pages are wanted (Q12).

*Decision.* `/resources/{slug}`, `/plugins/{slug}`, `/builds/{slug}` show all public fields and a prominent external link (repository / website, new tab, `rel="noopener noreferrer"`); listing cards link to these pages. Imported posts keep linking to the original article. `slug` fields are added to Resources and Plugins (Builds already had one); plugin slugs are derived from `fullName` once and never change.

*Consequences.* Better SEO (indexable pages, JSON-LD) and room for richer data; three more page templates and sitemaps; E2E tests cover them. Proposed brief change P6.

## ADR-020 Email registration with activation link (extends the brief)

*Context.* The brief allows sign-up only through OAuth; reviewed 2026-10-10: email/password registration with an activation link is wanted on the website.

*Decision.* Payload's built-in `auth.verify`: anonymous `create` (registration form) → activation email → built-in verify view `/admin/users/verify/{token}`; unverified users cannot sign in. Custom code limited to: the guard that whitelists registration fields, a "resend activation" endpoint (not built into Payload 3.90.2), an `afterOperation` hook on `resetPassword` that marks the user verified (Payload does not), and the pre-hijacking protection in OAuth linking (an unverified password account claimed by OAuth gets a new random password).

*Consequences.* Bots can register (mitigated by rate limits and verification; CAPTCHA deferred, Q19). Email enumeration on sign-up is avoided with generic responses (Q17). Proposed brief change P7.

## ADR-021 Connect providers while signed in (approved idea I1)

*Decision.* "Connected accounts" on `/account`: connect GitHub/Google to the current account regardless of the provider email (signed 10-minute intent cookie set by a POST + session + PKCE), refuse when the provider identity already belongs to another user, and allow disconnecting (recovery is always possible through the verified email). Automatic linking by matching verified email on sign-in stays (Q2).

*Consequences.* Small extension of `resolveOAuthAccount()` plus a server action and the account UI; covered by unit tests of the linking logic.

## ADR-022 Privacy policy content

The seed creates a generated privacy policy page (data collected from GitHub/Google and the registration form, emails, Google Analytics after consent, account deletion and anonymization, contact placeholder). Accepted as is for now (Q15); legal review is the operator's responsibility before launch.
