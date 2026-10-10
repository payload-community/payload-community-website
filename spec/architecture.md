# Architecture — Payload CMS Community Portal

Status: **M0, reviewed 2026-10-10 (revision 2).** Source of truth for *what* to build is `spec/BRIEF.md`; implementation choices are logged in `spec/decisions.md` (referenced below as `ADR-NNN`). Where this document deliberately extends the brief (detail pages, email registration, connecting providers), the ADR says so.

---

## 0. Technology stack

The brief names the technologies; this table pins the concrete packages and their role. Exact versions live in `package.json` / `pnpm-lock.yaml` (the source of truth); versions here are the ones verified at planning time (2026-10-09).

| Area | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 24 | DDEV and Docker image |
| Package manager | pnpm (corepack) | 10.x | only pnpm lockfile |
| Framework | Next.js (App Router, `output: 'standalone'`) | 16.3.3 | template pin (ADR-014) |
| UI runtime | React / React DOM | 19.2.6 | template pin |
| CMS | `payload`, `@payloadcms/next`, `@payloadcms/ui` | 3.90.2 | all `@payloadcms/*` on the same exact version |
| Starting point | Payload Website template | v3.90.2 | §2 |
| Database | MongoDB + `@payloadcms/db-mongodb` | 3.90.2 | DBs `plc`, `plc_test` |
| Rich text | `@payloadcms/richtext-lexical` | 3.90.2 | + plaintext converter for sync |
| Payload plugins | `plugin-seo`, `plugin-redirects`, `storage-s3`, `email-nodemailer`, `live-preview-react`, `admin-bar` | 3.90.2 | |
| File storage | Garage (S3-compatible) via `@payloadcms/storage-s3` | 3.90.2 | §13 |
| Auth | Payload local strategy + `payload-oauth2` (GitHub, Google) | 1.0.21 | §12, ADR-001 |
| Email | SMTP via `@payloadcms/email-nodemailer`; templates `@react-email/components` | 3.90.2 / 1.x | Mailpit locally |
| Jobs | Payload Jobs Queue (`jobs.tasks` + `schedule`) | 3.90.2 | worker Deployment |
| UI | Tailwind CSS 4 + shadcn/ui (template) | | light/dark theme |
| i18n | Lingui (`@lingui/core`, `react`, `cli`, `swc-plugin`) | 6.x | website only; admin uses Payload i18n |
| URL state | `nuqs` | 2.x | listings |
| External APIs | `@octokit/rest` (+ throttling, retry), `zod`, `p-limit` | 22 / 4 / – | sync |
| Analytics & consent | GA4 via `@next/third-parties`, `vanilla-cookieconsent` 3, Consent Mode v2 | | §16 |
| Observability | OpenTelemetry `@opentelemetry/sdk-node` + auto-instrumentations, OTLP/HTTP protobuf; pino logs | 0.223 / 0.81 | Grafana (Tempo, Mimir, Loki) |
| SEO | `plugin-seo`, `next-sitemap`, JSON-LD | | |
| Tests | Vitest, Playwright, `@axe-core/playwright` | | |
| Deployment | Docker (multi-stage), Kubernetes, Helm v4 chart | | §18 |

---

## 1. System overview

```
                 ┌───────────────────────── Kubernetes ──────────────────────────┐
 Browser ──TLS──▶ Ingress ──▶ web Deployment (N pods, Next.js + Payload, JOBS_AUTORUN=false)
   │                              │  Local API / REST / GraphQL / admin panel
   │                              ├──▶ MongoDB (external or in-cluster)
   │                              ├──▶ S3 (Garage) — uploads via S3 API
   │                              └──▶ OTLP endpoint (Alloy / Grafana Cloud)
   │                         worker Deployment (1 pod, Recreate) — `payload jobs:run --cron`
   │                              ├──▶ MongoDB, S3, SMTP, GitHub API, npm API, source sites
   │                         migrate/seed Job (Helm pre-install/pre-upgrade hook)
   └──────────▶ S3 public URL / CDN (images are served directly, never proxied)
```

One container image, three roles: **web** (`node server.js`), **worker** (`payload jobs:run …`), **migrate** (`payload migrate && pnpm seed`).

---

## 2. Template adaptation (Website template v3.90.2)

| Template part | Action |
|---|---|
| `pages` collection + layout builder + heros + blocks (CallToAction, Content, MediaBlock, Archive, Code, Banner) | **Keep.** Used for Home, Community, About, Privacy. |
| `FormBlock` + `@payloadcms/plugin-form-builder` + `src/blocks/Form/*` | **Remove** (nothing uses forms). ADR-015 |
| `posts`, `categories` collections, `nestedDocsPlugin` (only used by categories) | **Replace** with brief's Posts + Post Media; remove Categories and nested-docs. |
| `searchPlugin` + `/search` page | **Remove**; listings search with plain `where` queries on title/description. ADR-015 |
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

## 3. Roles and helpers

`users.roles`: `select`, `hasMany`, options `admin`, `moderator`; empty = regular user. `saveToJWT: true`.

Access helpers in `src/access/`: `isAdmin(user)`, `isModerator(user)` (moderator **or** admin), `isSignedIn(user)`, `isOwner(field = 'createdBy')` (returns a `where` constraint), `publishedOnly` (returns `{ _status: { equals: 'published' } }`), `syncFieldAccess` (admin only for create/update).

A request is a **system** request when it runs from a job, seed or migration (`req.context.system === true`, always with `overrideAccess: true`).

---

## 4. Collections

All collections have `createdAt` / `updatedAt`. Admin groups: **Content** (Posts, Resources, Plugins, Builds), **Media** (Media, Post Media), **Website** (Pages, Header, Footer, Redirects), **Synchronization** (Sources), **Administration** (Users, Jobs).

### 4.1 Shared: moderation fields (Posts, Resources, Plugins, Builds)

All four collections have `versions: { drafts: { validate: false }, maxPerDoc: 25 }` (no autosave, no scheduled publish) and this group in the sidebar:

| Field | Type | Notes |
|---|---|---|
| `moderation.status` | select `pending` \| `published` \| `rejected` \| `unpublished`, required, `index: true` | Read-only in the admin UI for everyone; set only by hooks/moderation actions. |
| `moderation.rejectionReason` | textarea | Visible when status is `rejected`. Written only by the reject action. Visible to the owner. |
| `moderation.moderatedBy` | relationship → users | Set by moderation actions. |
| `moderation.moderatedAt` | date | Set by moderation actions. |
| `moderation.submittedAt` | date, `index: true` | Set when the entry transitions **into** `pending`; used for "date of submission" and oldest-first sort. |
| `createdBy` | relationship → users, `index: true` | Set on create by a hook (`req.user`), read-only. Empty for imported entries. |
| `origin` | select | Set on create by a hook, read-only (values per collection). |

Plus a custom sidebar UI field `moderationActions` (Approve / Reject / Unpublish / Re-publish buttons) visible only to moderators; it calls the moderation endpoint (§8).

### 4.2 `users` (auth)

`auth`: local strategy enabled, `verify: { generateEmailHTML, generateEmailSubject }` (email activation, §10), `useSessions: true`, `tokenExpiration: 7 days`, `maxLoginAttempts: 5`, `lockTime: 10 min`, `forgotPassword.expiration: 1 h` with custom email (§10). Strategies added by `payload-oauth2` (`github`, `google`). Payload refuses password sign-in for unverified users (`_verified: false`).

| Field | Type | Access / notes |
|---|---|---|
| `email` | email (auth built-in), unique | Set on create (registration form, admin, or OAuth); update: admin only. |
| `_verified` | built-in (auth `verify`) | `true` for OAuth users (provider-verified email) and admin-created users; self-registered users get `true` after clicking the activation link. |
| `name` | text | Self + admin can update. From provider on first sign-in; not overwritten later if edited. |
| `avatarUrl` | text | Read-only; refreshed from provider on each OAuth sign-in. |
| `githubId` | text, unique (sparse), index | Read-only; set by OAuth. |
| `githubLogin` | text | Read-only; refreshed on each GitHub sign-in. |
| `googleId` | text, unique (sparse), index | Read-only; set by OAuth. |
| `roles` | select hasMany `admin`, `moderator` | Field access create/update/read-others: admin. |
| `notifications.moderation` | checkbox, default `true` | Shown only to moderators/admins. |
| `notifications.ownEntries` | checkbox, default `true` | Approved/rejected emails. |
| `invitedAt` | date, hidden | Set when the invitation job ran. |

Collection access:

| Operation | Anonymous | Regular | Moderator | Admin |
|---|---|---|---|---|
| admin panel (`access.admin`) | – | ✔ (verified) | ✔ | ✔ |
| create (REST/GraphQL) | ✔ registration only (`name`, `email`, `password`) | ✘ | ✘ | ✔ |
| create (admin panel) | – | ✘ | ✘ | ✔ |
| read | ✘ | self | all (email field: self/admin only) | all |
| update | ✘ | self (not roles/email/provider IDs) | self | all |
| delete | ✘ | self | self | all |

- **Self-registration** (ADR-020): the website `/sign-up` form (server action → Local API `create` with `overrideAccess: false`, no user — the same rules as an anonymous REST `POST /api/users`). A `beforeOperation` guard on `create` for anonymous requests keeps only `name`, `email`, `password` from the body (roles, provider IDs, `_verified` are dropped; field access also blocks them). Payload sends the activation email (`auth.verify`); the user cannot sign in until verified. Rate-limited.
- **OAuth creates users** through the Local API with `req.context.oauthSignIn = true` (set in the plugin's `getUserInfo`) and `_verified: true`, `disableVerificationEmail: true`.
- **Admin-created users** are created with `_verified: true`, a random password, and an invitation email (§10, ADR-002).
- **No first-user registration screen**: the `beforeOperation` guard also rejects `/api/users/first-register` (it would bypass verification); first admins come from `ADMIN_GITHUB_LOGINS` / `ADMIN_EMAILS` (OAuth, or a verified password account whose email is listed) or `pnpm seed:dev` locally (ADR-004).
- **Password requirement**: a `beforeValidate` hook on create sets a random 32-byte password when none is given (OAuth and admin-created users). Admin create view hides the password fields for new users (to be verified in M2; fallback in `open-questions.md` T1).
- **Deletion** (self or admin): `beforeDelete` anonymizes **all** the user's content (ADR-011): `createdBy` → `null` on Posts/Resources/Plugins/Builds/Post Media, in every status; entries are shown as "Former member". Pending entries stay in the moderation queue; no author notifications are sent for anonymized entries. Old versions keep the ID of the deleted user (no personal data beyond the ID).

### 4.3 `sources`

| Field | Type | Notes |
|---|---|---|
| `name` | text, required | Shown on post cards. |
| `type` | select `payload-rest`, required | One adapter per value. |
| `endpoint` | text (URL), required | e.g. `https://payloadcms.com/api/posts` |
| `siteUrl` | text (URL), required | e.g. `https://payloadcms.com/posts/blog` |
| `enabled` | checkbox, default `true` | |
| `lastSyncedAt` | date | read-only (admin UI) |
| `lastSyncStatus` | select `success` \| `partial` \| `failed` | read-only |
| `lastSyncError` | textarea | read-only |
| `lastSyncStats` | json | read-only; `{created, updated, skipped, failed, images}` |

Access: read anyone (no secrets; needed for source names on cards), create/update/delete admin. Hidden from non-admins in the admin nav. Admin list view has a "Run post sync now" button (§9).

### 4.4 `posts`

`origin`: `imported` | `community`. Versions/drafts + moderation (§4.1). SEO plugin fields (`meta`) for community posts.

| Field | Type | Origin | Notes |
|---|---|---|---|
| `title` | text, required | both | |
| `slug` | `slugField()` (unique, index) | both | Imported: `{source slug}-{external slug}`; community: from title, editable. |
| `origin` | select | both | Hook: `imported` when `req.context.system`, otherwise `community`. |
| `date` | date, index | both | Imported: source `publishedOn`. Community: set to publish time on first approval (template `populatePublishedAt` adapted). |
| `source` | relationship → sources | imported | Sync-owned. |
| `author` | text | imported | Sync-owned; "Firstname Lastname, …". |
| `createdBy` | relationship → users | community | Hook. |
| `populatedAuthor` | group (`id`, `name`, `avatarUrl`), virtual via `afterRead` | community | Template pattern: lets anonymous readers see the author name without reading `users`. |
| `summary` | textarea | both | Imported: plain text from Lexical `excerpt`. |
| `content` | richText (Lexical) | community | Required for community posts (`admin.condition`). |
| `image` | upload → post-media | both | |
| `url` | text (URL), unique (sparse), index | imported | De-dup key. Empty for community posts. |
| `externalId` | text, index | imported | Source document ID. |
| `tags` | text `hasMany`, index | both | Imported: source `category.name` (e.g. "Releases", "Guides", "Blog"). |
| `meta` | SEO group | community | |

Sync-owned fields (`source`, `author`, `url`, `externalId`, and every field of an imported post) are read-only for non-admins: imported posts have `update` access admin only (moderators may still unpublish/delete via moderation actions).

### 4.5 `post-media` (upload)

| Field | Type | Notes |
|---|---|---|
| file | upload (`storage-s3`, prefix `post-media/`) | image/* only; `imageSizes` thumbnail/card/og |
| `alt` | text, required | |
| `originalUrl` | text, unique (sparse), index | Set by post sync for de-duplication. |
| `createdBy` | relationship → users | Hook. |

Access: read anyone; create signed-in; update/delete owner, moderator, admin. Not versioned/moderated (images are only visible through a published post).

### 4.6 `media` (upload, template)

Template collection kept for pages (alt, caption). S3 prefix `media/`. Read anyone; create/update/delete moderator+admin (moderators edit the Community page).

### 4.7 `resources`

| Field | Type | Notes |
|---|---|---|
| `title` | text, required, index | |
| `slug` | `slugField()` from title, unique | Detail page `/resources/{slug}`. |
| `url` | text (URL), required, unique | |
| `description` | textarea, required | |
| `type` | select `website` `blog` `docs` `video` `course` `tool` `community` `other`, required, index | |
| `tags` | text `hasMany`, index | |
| `origin` | select `community` | Only value now; kept for symmetry and future imports. |
| moderation group + `createdBy` | §4.1 | |

### 4.8 `plugins`

`origin`: `imported` | `manual`. Validation: manual plugins need `name`, `description`, and `repositoryUrl` **or** `npmPackage`.

| Field | Type | Writable by | Notes |
|---|---|---|---|
| `origin` | select | hook | `imported` when created by sync, else `manual`. |
| `createdBy` | rel → users | hook | Manual only; kept when sync merges. |
| `name` | text, required | user (manual) / sync (imported) | |
| `slug` | `slugField()`, unique | hook | Detail page `/plugins/{slug}`. From `fullName` (`owner-repo`) when known, else from `name`; never changed after creation (stable URLs). |
| `fullName` | text, unique (sparse), index | sync; derived from `repositoryUrl` on save when it is a GitHub URL | `owner/repo`, lower-cased for matching. |
| `description` | textarea | user (manual) / sync (imported) | |
| `repositoryUrl` | text (URL) | user (manual) / sync (imported) | |
| `homepage` | text (URL) | user (manual) / sync (imported) | |
| `ownerAvatarUrl` | text | sync | |
| `topics` | text `hasMany`, index | sync | Filter values. |
| `stars` | number, index | sync | Sort. |
| `forks` | number | sync | |
| `isFork` | checkbox | sync | |
| `license` | text | sync | SPDX id. |
| `archived` | checkbox | sync | |
| `githubCreatedAt` | date | sync | |
| `lastPushedAt` | date, index | sync | "Last update" sort. |
| `npmPackage` | text | user (manual) / sync (imported, from `package.json`) | |
| `npmLatestVersion` | text | sync | |
| `npmWeeklyDownloads` | number | sync | |
| `npmLastPublishedAt` | date | sync | |
| `hidden` | checkbox, index | sync (admin can override) | Imported repos no longer found by the search. |
| `lastSyncedAt` | date | sync | |
| moderation group | §4.1 | | |

"Writable by sync" = field access `create`/`update` admin only (`syncFieldAccess`), so they show read-only in the admin panel for everyone else; sync writes with `overrideAccess: true`. Imported plugins: collection `update` access admin only (moderators can still moderate/delete).

### 4.9 `builds`

| Field | Type | Notes |
|---|---|---|
| `name` | text, required | |
| `slug` | `slugField()` unique | Detail page `/builds/{slug}`. |
| `description` | textarea, required | |
| `repositoryUrl` | text (URL), required | |
| `homepage` | text (URL) | |
| `npmPackage` | text | |
| `basePayloadVersion` | text, index, validated as semver (`3.90.2`) | Filter values. |
| `includedChanges` | array: `title` (text, req), `url` (URL, req), `notes` (textarea) | |
| `tags` | text `hasMany`, index | |
| `origin` | select `community` | |
| moderation group + `createdBy` | §4.1 | |

### 4.10 `pages` (template)

Kept as is minus the Form block, plus two new layout blocks: **SectionsOverview** (array of title/description/link) and **CollectionList** (select `posts` \| `plugins` \| `builds`, `limit`, `sort` preset; server component reusing the listing cards). Seeded pages: `home`, `community`, `about`, `privacy`.

Access: read published or authenticated-editor; create/delete admin; update admin, or moderator when `slug == 'community'` (row-level `where`).

### 4.11 Jobs collection (`payload-jobs`)

Built-in; `jobsCollectionOverrides` sets admin group "Administration", hidden for non-admins; access admin only.

---

## 5. Access-control matrix (content collections)

Legend: ✔ allowed, ✘ denied, **own** = `createdBy == user.id`, **pub** = `_status == published` (plus `hidden != true` for plugins).

| Collection / operation | Anonymous | Regular user | Moderator | Admin | System (jobs/seed) |
|---|---|---|---|---|---|
| Posts/Resources/Plugins/Builds — read | pub | pub ∪ own (all versions/statuses) | all | all | all |
| — readVersions | ✘ | own | all | all | all |
| — create | ✘ | ✔ (forced draft → `pending`) | ✔ (published) | ✔ (published) | ✔ |
| — update | ✘ | own, not imported (forced draft → `pending`) | all except imported content fields | all | ✔ |
| — publish (`_status: published`) | ✘ | ✘ (rewritten to draft) | ✔ | ✔ | ✔ |
| — change `moderation.*` | ✘ | ✘ | via actions | via actions | ✔ |
| — delete | ✘ | own | all | all | ✔ |
| Sync-owned fields | – | read-only | read-only | ✔ | ✔ |
| Post Media | read | read, create, own update/delete | all | all | ✔ |
| Media | read | read | all | all | ✔ |
| Pages | pub | pub | pub; update `community` | all | ✔ |
| Header/Footer globals | read | read | read | update | ✔ |
| Redirects | read (plugin default) | ✘ write | ✘ write | all | ✔ |
| Sources | read | read | read | all | ✔ |
| Users | create = registration only | self | read (no emails), self update | all | ✔ |
| Jobs / manual sync trigger | ✘ | ✘ | ✘ | ✔ | `CRON_SECRET` |

Admin-panel visibility (`admin.hidden`): Users, Sources, Jobs, Redirects, Header, Footer, Pages hidden for regular users; Users/Sources/Jobs/Redirects/Header/Footer hidden for moderators. Regular users see Posts, Resources, Plugins, Builds, Post Media, and their account.

Website server code: public pages use the Local API with `draft: false`, `overrideAccess: false` and **no user** (anonymous access rules) — the website never shows drafts outside live preview.

---

## 6. Moderation state machine

### 6.1 Building blocks
- **Payload drafts** carry the "old version stays live" requirement: the main document is only written when a save is *not* a draft save; a draft save only creates a new version (`latest: true`). Public reads (`draft: false`) return the main (published) document.
- **`moderation.status` lives on each version**. The latest version's status is the workflow state; the main document's status is the public state. Invariant: main document `_status == published` ⇔ main document `moderation.status == published`.
- Queues and counts use `draft: true` queries (latest version) — `find`/`count` with `draft: true`.

### 6.2 Enforcement hooks (shared factory `moderatedCollection()`)
1. **`beforeOperation` (create/update)** — if the user is a regular user and the request is not a system request: force `args.draft = true` and `args.data._status = 'draft'`. This makes publishing impossible for regular users through admin, REST and GraphQL (Payload only publishes when `draft` is false or `_status == 'published'`).
2. **`beforeChange`** — compute the next `moderation.status` (table below), set `origin`, `createdBy`, `submittedAt`, apply the **submission limit** (§7); reject `moderation.*` changes not coming from a moderation action.
3. **`afterChange`** — detect transitions (`previousDoc.moderation.status` → `doc.moderation.status`) and queue notification jobs (§10); revalidate Next.js cache tags when the main document changed.

### 6.3 Transitions

| # | Actor | Action | From (latest) | To | Payload write | Notification |
|---|---|---|---|---|---|---|
| T1 | Regular | create | – | `pending` | draft (main doc created as draft) | moderators |
| T2 | Regular | edit | `pending` | `pending` | draft version | – |
| T3 | Regular | edit | `published` | `pending` | draft version; published main doc stays live | moderators |
| T4 | Regular | edit | `rejected` / `unpublished` | `pending` | draft version | moderators |
| T5 | Mod/Admin | approve / re-publish | `pending` / `rejected` / `unpublished` | `published` | `update({ draft: false, _status: 'published' })` publishes the latest draft | author "approved" (if not own) |
| T6 | Mod/Admin | reject (reason optional) | `pending` | `rejected` | `update({ draft: true })` → published main doc (if any) stays live | author "rejected" (if not own) |
| T7 | Mod/Admin | unpublish | `published` (or latest draft over a published doc) | `unpublished` | `update({ draft: false, _status: 'draft' })` → main doc hidden | – |
| T8 | Mod/Admin | create / edit + Publish | any | `published` | normal publish | – |
| T9 | Mod/Admin | edit + Save draft | any | unchanged (new: `pending`) | draft | – |
| T10 | Owner / Mod / Admin | delete | any | – | delete document and versions | – |
| T11 | System (sync) | create / update | – / any | create: `published`; update: unchanged | §11.3 | – |

Notes:
- Moderators change status only through **moderation actions** (T5–T7), available on the dashboard and in the edit-view sidebar. The status select itself is read-only in the UI.
- Approving publishes the **latest** draft (what the moderator reviewed via the versions diff view).
- A rejected edit of a published entry keeps the published version live; the author sees `rejected` + reason in their list (admin lists show latest versions).
- T7 on an entry with a newer pending draft: the draft becomes the hidden main document with status `unpublished` (pending changes are dropped from the queue). Documented for moderators.
- **Simpler model considered**: status field only, no drafts. Rejected because it cannot keep the old version live while an edit waits (ADR-003).

---

## 7. Submission limit

- `MAX_PENDING_SUBMISSIONS = 3` in `src/moderation/config.ts`.
- In the shared `beforeChange` hook, when a **regular** user's save moves an entry **into** `pending` from anything else (T1, T3, T4): sum `payload.count({ collection, draft: true, where: { createdBy: { equals: user.id }, 'moderation.status': { equals: 'pending' } } })` over the four collections (indexed fields). If the sum ≥ 3 → `throw new APIError(msg, 429, { limit, pending }, true)` (public message, shown in admin toast and returned by REST).
- T2 (already pending) is not counted. Moderators/admins exempt.
- A race between two concurrent saves may admit a 4th entry — accepted (ADR-008).
- Metric `plc.moderation.submissions_refused` incremented.
- `PendingSlotsBanner` admin component (`beforeDocumentControls` / list `beforeList` for the four collections) shows "You can submit N more entries" for regular users.
- Message text (Payload admin i18n key `plc:pendingLimitReached`): "You have 3 submissions waiting for review. You can submit more once a moderator approves or rejects one of them, or after you delete one."

---

## 8. Moderation dashboard and actions

- **Endpoint**: `POST /api/moderation/:collection/:id/:action` (root Payload endpoint), `action ∈ approve | reject | unpublish | republish`, body `{ reason? }`. Access: moderator/admin (`req.user`), CSRF via Payload's cookie + `Origin` check (`csrf` config). Performs the Local API call from §6.3 with `req` (user context) and `context.moderationAction = action`.
- **Admin view** `/admin/moderation` (`admin.components.views.moderation`, server component, `@payloadcms/ui` `Gutter`, `Button`, `Pill`, tables). Tabs (`?tab=pending|rejected|unpublished`, search params): one merged list of the four collections via `payload.find({ draft: true, where: status })` per collection, merged and sorted by `moderation.submittedAt` (pending oldest first) — paged 50 per tab. Columns: type, title, author, submitted, link to edit view and versions (diff) view; actions approve / reject (small client form with reason) / re-publish.
- Nav link via `admin.components.afterNavLinks`, rendered only for moderators/admins; the view itself checks the role server-side and returns 404/redirect for others.
- **Dashboard widget** (`beforeDashboard`): pending count per type + link to the dashboard (moderators/admins only).

---

## 9. Jobs (Payload Jobs Queue)

Queues: `default` (emails/notifications), `sync` (synchronizations).

| Task slug | Queue | Schedule | Retries | Input | What it does |
|---|---|---|---|---|---|
| `syncPosts` | sync | `0 */6 * * *` | 2 | `{ sourceId? }` | §11.1 |
| `syncPlugins` | sync | `0 3 * * *` | 2 | `{}` | §11.2 |
| `notifyModerators` | default | – | 3 | `{ collection, id, transition }` | Resolve recipients, queue one `sendEmail` per recipient. |
| `notifyAuthor` | default | – | 3 | `{ collection, id, outcome: 'approved' \| 'rejected' }` | Check author preference, queue `sendEmail`. |
| `sendInvitation` | default | – | 3 | `{ userId }` | `payload.forgotPassword({ disableEmail: true })` → token, extend expiry to 7 days, queue `sendEmail` (invitation template). |
| `sendEmail` | default | – | 5 (exponential backoff) | `{ to, template, data }` | Render template, `payload.sendEmail`. |

- Every task handler is wrapped in `withSpan('job <slug>')` and logs a single structured summary line.
- Jobs are queued from `afterChange` hooks with `payload.jobs.queue` (never inline email sending); a failed queue call is logged and never fails the save.
- `jobs.autoRun`: `process.env.JOBS_AUTORUN !== 'false'` ⇒ `[{ cron: '* * * * *', allQueues: true, limit: 20 }]` else `[]`. `jobs.shouldAutoRun` mirrors the flag. Scheduling (`schedule` on tasks) is handled by the same cron (`handleSchedules`).
- **Kubernetes**: web pods `JOBS_AUTORUN=false`; worker pod (1 replica, `Recreate`) runs `payload jobs:run --cron "* * * * *" --handle-schedules --all-queues --limit 20` (verified in `payload/dist/bin/index.js` 3.90.2: `--cron` is a global flag, `--handle-schedules` and `--all-queues` are supported by `jobs:run`). Payload's schedule handling records the next scheduled job in the DB, so even an accidental second worker would not double-queue a schedule slot.
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

## 11. Synchronization

### 11.1 Post sync (`syncPosts`)

Adapter interface (`src/sync/posts/types.ts`):

```ts
interface PostSourceAdapter {
  type: Source['type']
  fetchItems(source: Source, ctx: { knownExternalIds: Set<string>; logger: Logger; signal: AbortSignal }): Promise<NormalizedPost[]>
}
interface NormalizedPost {
  externalId: string; title: string; slug: string; url: string; date: string
  author?: string; summary?: string; tags: string[]; image?: { url: string; alt?: string }
}
```

`payload-rest` adapter (`src/sync/posts/adapters/payloadRest.ts`):

- Request: `GET {endpoint}?depth=1&sort=-publishedOn&limit=50&page={n}&where[_status][equals]=published` (verified 2026-10-09 against `https://payloadcms.com/api/posts`: 119 published docs, `docs[]`, `hasNextPage`, `nextPage`). Validated with `zod` (unknown keys ignored).
- Pagination: continue while `hasNextPage` and the page contained at least one externalId not yet imported; first run imports everything (≈3 pages).
- Item filtering (verified on live data): skip items whose `publishedOn` is in the future (a placeholder post `slug: "draft"` dated 2038 exists) and items without `category` (no public page, 404); skipped items are counted.

| Payload blog field | Collection field | Transformation |
|---|---|---|
| `id` | `posts.externalId` | as is |
| `title` | `posts.title` | trim |
| `slug` | `posts.slug` | `{source slug}-{slug}` |
| `category.slug` + `slug` | `posts.url` | `https://payloadcms.com/posts/{category.slug}/{slug}` — **verified**: `/posts/releases/…`, `/posts/guides/…`, `/posts/blog/…` return 200; `/posts/blog/{release slug}` returns 404. Base URL = origin of `source.siteUrl`. |
| `publishedOn` | `posts.date` | ISO date |
| `authors[].firstName` + `lastName` | `posts.author` | `"First Last"`, joined with `, ` |
| `excerpt` (Lexical JSON) | `posts.summary` | `convertLexicalToPlaintext` from `@payloadcms/richtext-lexical/plaintext`, whitespace-collapsed, max 500 chars |
| `category.name` | `posts.tags` | `[name]` |
| `image.url`, `image.alt` | `posts.image` → `post-media` | download once (see below); `alt` fallback = title |
| – | `posts.source`, `origin = imported`, `_status = published`, `moderation.status = published` | |

Images: look up `post-media` by `originalUrl`; if missing, `fetch` the URL (timeout 15 s, max 10 MB, `content-type: image/*`), create `post-media` with `file: { data, mimetype, name, size }` (stored in S3 by `storage-s3`). Any failure → log + post imported without image (`stats.imageFailures++`).

Upsert: find post by `url`; create when missing; update only when a mapped field changed (idempotent: no new version on unchanged data). Per-item `try/catch`; source status `success` (no failures), `partial` (some failed), `failed` (fetch error); `lastSyncedAt`, `lastSyncError`, `lastSyncStats` updated on the source.

### 11.2 Plugin sync (`syncPlugins`)

All calls use `@octokit/rest` with `GITHUB_TOKEN`, `@octokit/plugin-throttling` + `@octokit/plugin-retry` (rate limits) — validated with `zod`.

1. **Search**: `GET /search/repositories?q=topic:payload-plugin+fork:true&sort=updated&per_page=100&page=n` (`octokit.paginate`). If `total_count > 1000` (search cap), split the query by creation date ranges (`created:<YYYY-MM-DD` / `created:>=…`) until each slice is under 1,000. (Today ≈ a few hundred results; slicing is implemented but rarely used.)
2. **Filter**: keep `fork == false`, or `fork == true && stargazers_count > 2`.
3. **npm enrichment** for each kept repo (concurrency 4 via `p-limit`):
   - `GET /repos/{owner}/{repo}/contents/package.json` (root only). Missing file, invalid JSON, `private: true`, missing `name`, or `workspaces` present with no publishable root package → npm fields empty (monorepo case).
   - `GET https://registry.npmjs.org/{name}` → `dist-tags.latest`, `time[latest]` (`npmLatestVersion`, `npmLastPublishedAt`). 404 → npm fields empty.
   - `GET https://api.npmjs.org/downloads/point/last-week/{name}` → `downloads` (`npmWeeklyDownloads`).
   - Optimization: skip npm calls when `pushed_at` and the package name are unchanged and the last npm refresh is < 24 h old.
4. **Upsert by `fullName`** (lower-case). Existing manual plugin with the same `fullName` → update only sync-owned fields, keep `origin`, `createdBy`, user fields. Existing imported → update all mapped fields; un-hide.
5. **Hide**: imported plugins not in the result set (and not failed to fetch) → `hidden: true` (never deleted). Skip hiding if the search itself was incomplete (error / cap) to avoid mass-hiding.
6. **Manual plugins** not in the search: refresh GitHub data via `GET /repos/{owner}/{repo}` when `repositoryUrl` is on GitHub (404 → keep data, log); refresh npm data when `npmPackage` is set. Never hidden.
7. Log one summary line `{created, updated, hidden, unhidden, skipped, failed}`; metrics per result.

| GitHub / npm field | Plugin field |
|---|---|
| `name` | `name` (imported only) |
| `full_name` | `fullName` (lower-cased) |
| `description` | `description` (imported only) |
| `html_url` | `repositoryUrl` (imported only) |
| `homepage` | `homepage` (imported only) |
| `owner.avatar_url` | `ownerAvatarUrl` |
| `topics` | `topics` |
| `stargazers_count` | `stars` |
| `forks_count` | `forks` |
| `fork` | `isFork` |
| `license.spdx_id` | `license` (`NOASSERTION` → empty) |
| `archived` | `archived` |
| `created_at` | `githubCreatedAt` |
| `pushed_at` | `lastPushedAt` |
| `package.json` `name` | `npmPackage` (imported only; manual keeps user value) |
| registry `dist-tags.latest` | `npmLatestVersion` |
| registry `time[latest]` | `npmLastPublishedAt` |
| downloads API `downloads` | `npmWeeklyDownloads` |

### 11.3 Sync writes and drafts

- Create: `payload.create({ draft: false, _status: 'published', context: { system: true } })`.
- Update when the latest version **is** the published one: `payload.update({ draft: false })` with only the changed sync-owned fields.
- Update when a manual plugin has a newer **draft** (pending/rejected edit): a normal update would publish the user's draft. Instead: refresh the published main document's sync-owned fields with `payload.db.updateOne` (no hooks/new version) and the draft with `payload.update({ draft: true })` (status unchanged via `context.system`). ADR-012.

---

## 12. Authentication flow

Plugin: `payload-oauth2` 1.0.21, two instances (ADR-001).

| | GitHub | Google |
|---|---|---|
| `strategyName` | `github` | `google` |
| `subFieldName` | `githubId` | `googleId` |
| authorize | `GET /api/users/oauth/github` | `GET /api/users/oauth/google` |
| callback (register at provider) | `{NEXT_PUBLIC_SERVER_URL}/api/users/oauth/github/callback` | `{NEXT_PUBLIC_SERVER_URL}/api/users/oauth/google/callback` |
| provider authorize URL | `https://github.com/login/oauth/authorize` | `https://accounts.google.com/o/oauth2/v2/auth` |
| token endpoint | `https://github.com/login/oauth/access_token` | `https://oauth2.googleapis.com/token` |
| scopes | `read:user user:email` | `openid email profile` |
| user info | `GET https://api.github.com/user`, `GET https://api.github.com/user/emails` | `GET https://openidconnect.googleapis.com/v1/userinfo` |
| verified email | primary entry with `verified: true` from `/user/emails` | `email` when `email_verified === true` |
| PKCE | enabled (S256) | enabled (S256) |
| enabled when | `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` set | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set |

Local dev: `NEXT_PUBLIC_SERVER_URL=https://plc.ddev.site:3000` (or the exposed HTTPS port chosen in M1) → callbacks e.g. `https://plc.ddev.site:3000/api/users/oauth/github/callback`.

Sign-in methods (website and admin): GitHub, Google, email + password. Sign-up methods: GitHub, Google, and the website registration form (email + password with activation link). One account can have any combination of GitHub, Google and a password.

### 12.1 OAuth sign-in / sign-up
1. Sign-in buttons (website `/sign-in`, `/sign-up`, and admin `beforeLogin`) link to the authorize endpoint with `?state=<return path>` (`/admin` or a website path; validated against an allow-list of relative paths in `successRedirect`). Buttons render only for enabled providers.
2. Callback → plugin exchanges code (+ PKCE verifier) → our `getUserInfo(accessToken, req)` (`src/auth/oauth/{github,google}.ts`) fetches the profile, validates with `zod`, then calls the pure function `resolveOAuthAccount()`:
   - **connect intent** present (§12.3) → link the provider to the signed-in user.
   - find user by provider ID → **existing** (return `{ [subField], avatarUrl, githubLogin? }` only — never overwrite email/name).
   - else, if no verified provider email → refuse sign-in ("Verify an email address with {provider} first"; `/sign-in?error=email_unverified`) (ADR-005).
   - else find user by email (case-insensitive) → **link**: set the provider ID on that user and return as existing. If that account is a self-registered, **not yet verified** password account, the provider has now proven ownership of the email: set `_verified: true`, clear the verification token, and **replace the password with a random one** — otherwise someone who pre-registered the victim's email would keep a working password (account pre-hijacking). The user can set a password later via "forgot password".
   - else → **new user** `{ email, name, avatarUrl, [subField], githubLogin?, _verified: true }`; sets `req.context.oauthSignIn = true`.
3. The plugin finds the user by provider ID, creates or updates it, runs `beforeLogin`/`afterLogin` hooks, creates a Payload session, sets the `payload-token` cookie and redirects (`successRedirect`). Failures → `/sign-in?error=oauth`.
4. `beforeLogin` hook (all strategies including local password): if `githubLogin ∈ ADMIN_GITHUB_LOGINS` or `email ∈ ADMIN_EMAILS` (account verified) and the user lacks `admin` → add it (`overrideAccess`). Roles are never removed automatically.

### 12.2 Email registration and password sign-in
1. `/sign-up` (website): name, email, password (+ confirmation), privacy-policy acknowledgement, OAuth buttons. Server action → `payload.create({ collection: 'users', overrideAccess: false, data: { name, email, password } })` as an anonymous request (same rules as REST `POST /api/users`).
2. Payload sends the **activation email** (`auth.verify`, custom template); the page shows "Check your inbox". If the email already exists, the response is the same generic message (no account enumeration); an email to an existing account is not sent in v1 (Q17).
3. The link opens Payload's built-in verify view `/admin/users/verify/{token}` → `POST /api/users/verify/{token}` → `_verified: true` → the view redirects to the login screen. (Least code, same choice as Q13; a website `/verify-email` page is a later option.)
4. Password sign-in: website `/sign-in` form → `POST /api/users/login` (built-in); unverified users get "Please activate your account" with a **resend** button. Payload 3.90.2 has no built-in resend operation, so `POST /api/users/resend-activation` (`{ email }`, rate-limited, always the same generic response) regenerates `_verificationToken` and sends the activation email again. Admin uses the standard login form, with a "Create an account" link to `/sign-up`.
5. "Forgot password" → built-in endpoint, reset at `/admin/reset/{token}`. Payload's `resetPassword` does **not** set `_verified` (checked in 3.90.2), so an `afterOperation` hook on `resetPassword` marks the user verified — the reset link proves mailbox access. This also covers the invitation flow and replaces any password set by someone who pre-registered the email.
6. Abuse protection: Payload rate limiting on `POST /api/users`, `/login`, `/forgot-password`; minimum password length 10 (custom `validate` on the password via `beforeValidate`), max length per Payload default. CAPTCHA is not in scope for v1 (Q19).

### 12.3 Connect another provider while signed in (approved idea I1)
- `/account` → "Connected accounts": GitHub / Google rows with **Connect** or **Disconnect**; "Set a password" / "Change password" links.
- **Connect**: a POST (server action, CSRF-protected by Next.js) sets an HttpOnly, signed (`PAYLOAD_SECRET`), 10-minute `plc_connect` cookie containing the user ID and provider, then redirects to the provider's authorize endpoint with `state=/account`. In `getUserInfo`, if `req.user` (session cookie) matches the intent cookie: if the provider ID belongs to **another** user → refuse (`/account?error=provider_in_use`); else set the provider ID (and `githubLogin`) on the current user regardless of the provider email. The cookie is cleared after use. PKCE ensures the code was obtained by this browser.
- **Disconnect**: removes the provider ID. Always allowed, because every account has a verified email and can recover through "forgot password"; the UI warns when it is the last OAuth provider and no password was set.
- Matching by verified email still links automatically on normal sign-in (§12.1), so users with the same email on GitHub and Google end up with one account without doing anything.

### 12.4 Security notes
- OAuth users get a random unusable password; "forgot password" sends the link only to the account email, which is verified (provider or activation), so no takeover without mailbox access.
- Account pre-hijacking via an unverified registration is neutralized as described in §12.1.
- Login CSRF is mitigated by PKCE (the plugin does not verify `state`); connecting a provider additionally requires the signed intent cookie set by a POST.
- Rate limiting on `/api/users` (create), `/api/users/login`, `/forgot-password`, OAuth endpoints.

---

## 13. Storage

- `@payloadcms/storage-s3` for `media` (prefix `media/`) and `post-media` (prefix `post-media/`): `bucket = S3_BUCKET`, `config = { endpoint: S3_ENDPOINT, region: S3_REGION, forcePathStyle: S3_FORCE_PATH_STYLE === 'true', credentials }`, `disablePayloadAccessControl: true`, `generateFileURL: ({ filename, prefix }) => \`${S3_PUBLIC_URL}/${prefix}/${filename}\``. No local disk writes (`upload.disableLocalStorage` implied by the plugin).
- E2E: `S3_PREFIX_ROOT=e2e` prepended to prefixes (or a separate bucket) so tests never touch dev files.
- `next.config.ts`: `images.remotePatterns` built from `S3_PUBLIC_URL` (protocol/host/port/path). DDEV check (done in M0): `garage.plc.ddev.site` resolves inside the web container to the DDEV router and the mkcert CA is trusted via `NODE_EXTRA_CA_CERTS`, so the image optimizer should fetch it directly; M1 verifies with a real image and adds a documented dev-only fallback only if needed.

---

## 14. Website routes

| Route | Source | Notes |
|---|---|---|
| `/` | page `home` (hero, SectionsOverview, CollectionList ×3) | Hero CTA "Join with GitHub, Google or email and contribute" (→ `/sign-up`; brief: "sign in (GitHub or Google)", extended by ADR-020). |
| `/news` | Posts listing | search `q` (title, summary), `source`, `tag`, `page`; sort newest first. Cards: imported → external URL (new tab, `rel="noopener noreferrer"`, source name); community → `/news/{slug}` (author, no external label). |
| `/news/[slug]` | community post | template post rendering; imported slugs 404. |
| `/resources` | Resources | `q` (title, description), `type`, `tag`, `sort` (`updated`), `page`. Cards → `/resources/{slug}`. |
| `/resources/[slug]` | Resource detail | Title, type, tags, full description, submitter ("Former member" when anonymized), dates, **prominent "Visit {host}" button** to the external URL (new tab, `rel="noopener noreferrer"`). |
| `/plugins` | Plugins (not hidden) | `q` (name, description), `topic`, `sort` (`stars` default, `updated`), `page`. Card: name, description, created, last update, topics, stars, npm version, weekly downloads. Cards → `/plugins/{slug}`. |
| `/plugins/[slug]` | Plugin detail | Name, owner avatar, description, topics, stars, forks, license, archived/fork badges, GitHub created / last pushed dates, npm package with `pnpm add {package}` copy box, latest version, weekly downloads, last publish date, homepage; **prominent "View repository" button** (and "View on npm"). Hidden plugins 404. |
| `/builds` | Builds | `q`, `tag`, `version` (base Payload version), `sort` (`updated`), `page`. Cards → `/builds/{slug}`. |
| `/builds/[slug]` | Build detail | Name, description, base Payload version, tags, npm install box, list of included changes (title → link, notes), homepage/docs; **prominent "View repository" button**. |
| `/community`, `/about`, `/privacy` | pages | `[slug]` route from template. |
| `/sign-in` | auth | GitHub/Google buttons (enabled only), email/password form, "Forgot password?" → `/admin/forgot`, link to `/sign-up`, resend activation. |
| `/sign-up` | auth | GitHub/Google buttons, registration form (name, email, password, confirmation), "check your inbox" state (§12.2). |
| `/account` | auth | Profile summary, **connected accounts** (connect/disconnect GitHub and Google, §12.3), set/change password link, links to admin (my entries, notification settings at `/admin/account`), sign out, **delete account** (confirmation; explains that content is anonymized). |
| `/submit/{posts,resources,plugins,builds}` | redirect | → `/admin/collections/{slug}/create` (sign-in first if anonymous). |
| `/sitemap.xml`, `/robots.txt`, `/pages-sitemap.xml`, `/news-sitemap.xml`, `/resources-sitemap.xml`, `/plugins-sitemap.xml`, `/builds-sitemap.xml` | next-sitemap + route handlers | |
| `/api/health/live`, `/api/health/ready` | Next route handlers | live: no I/O; ready: `getPayload()` + MongoDB `ping`. |
| `/admin/**` | Payload | + `/admin/moderation`. |

Detail pages (resources, plugins, builds) are server components using `payload.find({ where: { slug }, draft: false, overrideAccess: false, limit: 1 })` with `generateStaticParams` + on-demand revalidation by cache tag (`afterChange` hooks), `generateMetadata` (title, description, canonical, OG image = default or owner avatar), and JSON-LD (`SoftwareSourceCode` for plugins and builds, `CreativeWork`/`WebPage` for resources). Moderators/owners preview drafts through the template's live preview route.

Listing implementation: server components reading `searchParams` through `nuqs` server cache (`createSearchParamsCache`), filters as `<form method="get">`/links (works without JS), `payload.find({ where, sort, page, limit: 24, draft: false, overrideAccess: false })`. Distinct values for filters via `payload.findDistinct` (`tags`, `topics`, `basePayloadVersion`, `type`). Search = `or: [{ title: { like: q } }, { summary|description: { like: q } }]`.

Navigation (seeded `header.navItems`): Home `/`, News `/news`, Resources `/resources`, Plugins `/plugins`, Builds `/builds`, Community `/community`, About `/about`. Header right: theme switcher, Sign in / account menu.

Footer: seeded links (Privacy policy, GitHub repository), "Cookie settings" (opens the consent preferences; only when GA is configured), and the Lingui note "Payload CMS Community Portal is a community project. It is not affiliated with or endorsed by Payload."

---

## 15. i18n

- Website: Lingui 6 (`@lingui/core`, `@lingui/react`, `@lingui/cli`, `@lingui/swc-plugin` via `experimental.swcPlugins`), locale `en`, catalogs `src/locales/{locale}/messages.po`, compiled at build. RSC: `setI18n`/`initLingui` per request (Lingui's Next.js App Router pattern); client components through `I18nProvider`. Scripts `i18n:extract` (`lingui extract --clean`), `i18n:compile`. CI check: extract produces no missing translations for `en`.
- Admin panel: Payload `i18n` config with `supportedLanguages: { en }` and custom `translations.en.plc.*` keys for our admin components and error messages.
- Emails: `src/email/messages.ts` (not Lingui yet; ready to be moved).

---

## 16. SEO, analytics, consent, security

- SEO plugin titles `"{title} | Payload CMS Community Portal"`, OG image from `meta.image` / post image / default OG image; canonical URLs via `generateMetadata` (`alternates.canonical`); JSON-LD: `WebSite` (+ `SearchAction` for `/news?q=`) on home, `BlogPosting` on community posts, `ItemList` on listings.
- GA4: `@next/third-parties/google` `<GoogleAnalytics>` rendered only after consent; `vanilla-cookieconsent` v3 with one optional category `analytics`; Consent Mode v2 default `denied` (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`) set in an inline script before GA, updated on consent change. Nothing renders when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is empty.
- Security headers in `next.config.ts` `headers()`: CSP (self, `S3_PUBLIC_URL`, `www.googletagmanager.com`, `*.google-analytics.com`, `*.analytics.google.com`, avatars `avatars.githubusercontent.com`, `lh3.googleusercontent.com`), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'self'`. Payload `rateLimit`/`csrf`/`cors` set from `NEXT_PUBLIC_SERVER_URL`.

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
- `runner` stage, user `node` (uid 1000), `NODE_ENV=production`.
- `/app` = standalone server (`server.js`, `.next/static`, `public`).
- `/app/cli` = what the worker and migrate Job need: production `node_modules` (pruned), `src/` (Payload config, collections, jobs, seed, migrations), `package.json`, `tsconfig.json`; commands run via `pnpm --dir /app/cli payload …`. (Bigger image, one artifact — ADR-010.)
- `ARG APP_VERSION` → `ENV APP_VERSION` (OTel `service.version`).
- Default `CMD ["node", "server.js"]`.

### 18.2 Runtime configuration (env)
Existing: `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, `CRON_SECRET`, `GITHUB_TOKEN`, `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `ADMIN_GITHUB_LOGINS`, `ADMIN_EMAILS`, `S3_*`, `SMTP_*`, `EMAIL_FROM_*`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `OTEL_*`.
Planned new (added to `.env` empty + `.env.example` when introduced): `JOBS_AUTORUN` (default `true`), `LOG_LEVEL` (default `info`), `S3_KEY_PREFIX` (empty; `e2e` in tests), `APP_VERSION` (image build arg), `DEPLOYMENT_ENVIRONMENT` (mapped into `OTEL_RESOURCE_ATTRIBUTES`).

`NEXT_PUBLIC_*` are inlined at build time: the image is built per environment, or (preferred) GA ID and server URL are read at runtime on the server and passed to client components as props (ADR-013).

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
  deployment-worker.yaml      # replicas: 1, strategy Recreate, command: payload jobs:run --cron …
  job-migrate.yaml            # helm.sh/hook: pre-install,pre-upgrade; hook-delete-policy: before-hook-creation,hook-succeeded; payload migrate && pnpm seed
  service.yaml
  ingress.yaml                # hosts, TLS, annotations
  hpa.yaml                    # optional (autoscaling.enabled)
  pdb.yaml                    # optional (podDisruptionBudget.enabled)
```

Secrets: `existingSecret` name (keys: `DATABASE_URI`, `PAYLOAD_SECRET`, `CRON_SECRET`, `GITHUB_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `SMTP_USER`, `SMTP_PASS`, `OTEL_EXPORTER_OTLP_HEADERS`), loaded with `envFrom.secretRef`. Downward API env `K8S_POD_NAME`, `K8S_NAMESPACE_NAME`, `K8S_NODE_NAME` → `OTEL_RESOURCE_ATTRIBUTES=k8s.pod.name=$(K8S_POD_NAME),k8s.namespace.name=$(K8S_NAMESPACE_NAME),k8s.node.name=$(K8S_NODE_NAME),deployment.environment.name=…,service.version=<image tag>`.

Validation: `helm lint` and `helm template` with defaults and `values-production.example.yaml` (no cluster).

---

## 19. External integrations (exact endpoints)

| Integration | Endpoint | Auth | Used by |
|---|---|---|---|
| Payload blog | `GET https://payloadcms.com/api/posts?depth=1&sort=-publishedOn&limit=50&page=N&where[_status][equals]=published` | none | syncPosts |
| Blog images | `image.url` (currently `*.public.blob.vercel-storage.com`) | none | syncPosts |
| GitHub search | `GET https://api.github.com/search/repositories?q=topic:payload-plugin+fork:true&per_page=100&page=N` | `GITHUB_TOKEN` | syncPlugins |
| GitHub repo | `GET https://api.github.com/repos/{owner}/{repo}` | `GITHUB_TOKEN` | syncPlugins (manual) |
| GitHub contents | `GET https://api.github.com/repos/{owner}/{repo}/contents/package.json` | `GITHUB_TOKEN` | syncPlugins |
| npm registry | `GET https://registry.npmjs.org/{name}` (abbreviated metadata not used: needs `time`) | none | syncPlugins |
| npm downloads | `GET https://api.npmjs.org/downloads/point/last-week/{name}` | none | syncPlugins |
| GitHub OAuth | `https://github.com/login/oauth/authorize`, `…/access_token`, `GET https://api.github.com/user`, `GET https://api.github.com/user/emails` | client ID/secret | auth |
| Google OAuth | `https://accounts.google.com/o/oauth2/v2/auth`, `https://oauth2.googleapis.com/token`, `GET https://openidconnect.googleapis.com/v1/userinfo` | client ID/secret | auth |
| SMTP | `SMTP_HOST:SMTP_PORT` | optional user/pass | email |
| S3 | `S3_ENDPOINT` (S3 API), `S3_PUBLIC_URL` (reads) | access key | storage |
| OTLP | `OTEL_EXPORTER_OTLP_ENDPOINT` (`/v1/traces`, `/v1/metrics`, `/v1/logs`) | `OTEL_EXPORTER_OTLP_HEADERS` | observability |
| GA4 | `https://www.googletagmanager.com/gtag/js?id=…` | – | browser, after consent |

---

## 20. Seeding

- `pnpm seed` (production, idempotent, run by the migrate Job): creates if missing — source "Payload blog"; pages `home`, `community`, `about`, `privacy` (published); `header` nav items and `footer` links **only when the global is empty**. Never updates an existing document. Uses `context: { system: true }`.
- `pnpm seed:dev` (local only, refuses to run when `NODE_ENV=production`): runs `seed`, then creates sample users (admin, moderator, regular — password accounts with known dev passwords), sample posts/resources/plugins/builds in each moderation status, and sample images.
- E2E setup (`tests/e2e/global-setup.ts`): drops and seeds `plc_test` (`seed` + fixtures + the three test users), with S3 prefix `e2e/` and external HTTP mocked (fixtures in `tests/fixtures/`).

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
  app/(frontend)/    website routes
  app/(payload)/     admin + API (template)
  app/api/health/    live, ready
  locales/en/        Lingui catalog
tests/e2e/, tests/unit/, tests/fixtures/
deploy/helm/payload-cms-community-portal/, deploy/grafana/
docs/, spec/
```
