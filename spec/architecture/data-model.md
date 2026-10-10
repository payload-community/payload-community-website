# Data model and seeding

Part of the [architecture](README.md). Section numbers are global across the architecture files, so references such as [§6.3](moderation.md#63-transitions) stay stable.

---

## 4. Collections

All collections have `createdAt` / `updatedAt`. Admin groups: **Content** (Posts, Resources, Plugins, Builds), **Media** (Media, Post Media), **Website** (Pages, Header, Footer, Redirects), **Synchronization** (Sources), **Administration** (Users, Jobs).

**Unique-when-set fields** (`users.githubId`, `users.googleId`, `posts.url`, `post-media.originalUrl`, `plugins.fullName`) — [ADR-024](../decisions/0024-unique-optional-fields-partial-indexes.md):
- The field config has `index: true` but **not** `unique: true`. Payload's `unique` on an optional field creates a *sparse* unique index (checked in `@payloadcms/db-mongodb` 3.90.2 `buildSchema`), and MongoDB sparse indexes still index explicit `null`, so two documents with a cleared value would collide.
- A Payload migration (`src/migrations/*_unique_optional_fields.ts`) creates partial unique indexes: `createIndex({ <field>: 1 }, { name: 'uniq_<field>', unique: true, partialFilterExpression: { <field>: { $type: 'string' } } })`. Missing and `null` values are excluded.
- A shared field hook `emptyToNull` (in `beforeValidate`) turns `''` and whitespace into `null`, so an empty string never reaches the index.
- Duplicates are rejected by MongoDB with E11000, which the adapter's `handleError` already maps to Payload's "Value must be unique" error on the right field — so the admin UI and REST show a normal validation error. Versions collections never get these indexes (drafts can hold any value).
- `users.email` stays a normal required `unique: true` field.

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

Plus a custom sidebar UI field `moderationActions` (Approve / Reject / Unpublish / Re-publish buttons) visible only to moderators; it calls the moderation endpoint ([§8](moderation.md#8-moderation-dashboard-and-actions)).

### 4.2 `users` (auth)

`auth`: local strategy enabled, `verify: { generateEmailHTML, generateEmailSubject }` (email activation, [§10](operations.md#10-email)), `useSessions: true`, `tokenExpiration: 7 days`, `maxLoginAttempts: 5`, `lockTime: 10 min`, `forgotPassword.expiration: 1 h` with custom email ([§10](operations.md#10-email)). Strategies added by `payload-oauth2` (`github`, `google`). Payload refuses password sign-in for unverified users (`_verified: false`).

| Field | Type | Access / notes |
|---|---|---|
| `email` | email (auth built-in), unique | Set on create (registration form, admin, or OAuth); update: admin only. |
| `_verified` | built-in (auth `verify`) | `true` for OAuth users (provider-verified email) and admin-created users; self-registered users get `true` after clicking the activation link. |
| `name` | text | Self + admin can update. From provider on first sign-in; not overwritten later if edited. |
| `avatarUrl` | text | Read-only; refreshed from provider on each OAuth sign-in. |
| `githubId` | text, index, unique when set ([ADR-024](../decisions/0024-unique-optional-fields-partial-indexes.md)) | Read-only; set by OAuth. |
| `githubLogin` | text | Read-only; refreshed on each GitHub sign-in. |
| `googleId` | text, index, unique when set ([ADR-024](../decisions/0024-unique-optional-fields-partial-indexes.md)) | Read-only; set by OAuth. |
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

- **Self-registration** ([ADR-020](../decisions/0020-email-registration-with-activation.md)): the website `/sign-up` form (server action → Local API `create` with `overrideAccess: false`, no user — the same rules as an anonymous REST `POST /api/users`). A `beforeOperation` guard on `create` for anonymous requests keeps only `name`, `email`, `password` from the body (roles, provider IDs, `_verified` are dropped; field access also blocks them). Payload sends the activation email (`auth.verify`); the user cannot sign in until verified. Rate-limited.
- **OAuth creates users** through the Local API with `req.context.oauthSignIn = true` (set in the plugin's `getUserInfo`) and `_verified: true`, `disableVerificationEmail: true`.
- **Admin-created users** are created with `_verified: true`, a random password, and an invitation email ([§10](operations.md#10-email), [ADR-002](../decisions/0002-admin-created-accounts-invitation.md)).
- **No first-user registration screen**: the `beforeOperation` guard also rejects `/api/users/first-register` (it would bypass verification); first admins come from `ADMIN_GITHUB_LOGINS` / `ADMIN_EMAILS` (OAuth, or a verified password account whose email is listed) or `pnpm seed:dev` locally ([ADR-004](../decisions/0004-first-admin-and-first-register.md)).
- **Password requirement**: the `beforeOperation` hook on create sets a random 32-byte password for admin-created users and for trusted creates (`overrideAccess` with `_verified: true`, e.g. OAuth and seeds) that pass none. The admin create view requires password inputs, so a UI field pre-fills and hides them (T1). Minimum length 10 for passwords chosen by users.
- **Populating**: relationships to users return only `name`, `avatarUrl` and `githubLogin` (`defaultPopulate`).
- **Deletion** (self or admin): `beforeDelete` anonymizes **all** the user's content ([ADR-011](../decisions/0011-account-deletion-anonymizes-content.md)): `createdBy` → `null` on Posts/Resources/Plugins/Builds/Post Media, in every status; entries are shown as "Former member". Pending entries stay in the moderation queue; no author notifications are sent for anonymized entries. The latest version of each entry is cleared too (so the moderation queue shows no author); older versions keep the ID of the deleted user (no personal data beyond the ID).

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

Access: read anyone (no secrets; needed for source names on cards), create/update/delete admin. Hidden from non-admins in the admin nav. Admin list view has a "Run post sync now" button ([§9](operations.md#9-jobs-payload-jobs-queue)).

### 4.4 `posts`

`origin`: `imported` | `community`. Versions/drafts + moderation ([§4.1](#41-shared-moderation-fields-posts-resources-plugins-builds)). SEO plugin fields (`meta`) for community posts.

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
| `url` | text (URL), index, unique when set ([ADR-024](../decisions/0024-unique-optional-fields-partial-indexes.md)) | imported | De-dup key. Empty for community posts. |
| `externalId` | text, index | imported | Source document ID. |
| `tags` | text `hasMany`, index | both | Imported: source `category.name` (e.g. "Releases", "Guides", "Blog"). |
| `meta` | SEO group | community | |

Sync-owned fields (`source`, `author`, `url`, `externalId`, and every field of an imported post) are read-only for non-admins: imported posts have `update` access admin only (moderators may still unpublish/delete via moderation actions).

### 4.5 `post-media` (upload)

| Field | Type | Notes |
|---|---|---|
| file | upload (`storage-s3`, prefix `post-media/`) | image/* only; `imageSizes` thumbnail/card/og |
| `alt` | text, required | |
| `originalUrl` | text, index, unique when set ([ADR-024](../decisions/0024-unique-optional-fields-partial-indexes.md)) | Set by post sync for de-duplication. |
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
| moderation group + `createdBy` | [§4.1](#41-shared-moderation-fields-posts-resources-plugins-builds) | |

### 4.8 `plugins`

`origin`: `imported` | `manual`. Validation: manual plugins need `name`, `description`, and `repositoryUrl` **or** `npmPackage`.

| Field | Type | Writable by | Notes |
|---|---|---|---|
| `origin` | select | hook | `imported` when created by sync, else `manual`. |
| `createdBy` | rel → users | hook | Manual only; kept when sync merges. |
| `name` | text, required | user (manual) / sync (imported) | |
| `slug` | `slugField()`, unique | hook | Detail page `/plugins/{slug}`. From `fullName` (`owner-repo`) when known, else from `name`; never changed after creation (stable URLs). |
| `fullName` | text, index, unique when set ([ADR-024](../decisions/0024-unique-optional-fields-partial-indexes.md)) | sync; derived from `repositoryUrl` on save when it is a GitHub URL | `owner/repo`, lower-cased for matching. |
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
| moderation group | [§4.1](#41-shared-moderation-fields-posts-resources-plugins-builds) | | |

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
| moderation group + `createdBy` | [§4.1](#41-shared-moderation-fields-posts-resources-plugins-builds) | |

### 4.10 `pages` (template)

Kept as is minus the Form block, plus two new layout blocks: **SectionsOverview** (array of title/description/link) and **CollectionList** (select `posts` \| `plugins` \| `builds`, `limit`, `sort` preset; server component reusing the listing cards). Seeded pages: `home`, `community`, `about`, `privacy`.

Access: read published or authenticated-editor; create/delete admin; update admin, or moderator when `slug == 'community'` (row-level `where`).

### 4.11 Jobs collection (`payload-jobs`)

Built-in; `jobsCollectionOverrides` sets admin group "Administration", hidden for non-admins; access admin only.

---

## 20. Seeding

- `pnpm seed` (production, idempotent, run by the migrate Job): creates if missing — source "Payload blog"; pages `home`, `community`, `about`, `privacy` (published); `header` nav items and `footer` links **only when the global is empty**. Never updates an existing document. Uses `context: { system: true }`.
- `pnpm seed:dev` (local only, refuses to run when `NODE_ENV=production`): runs `seed`, then creates sample users (`admin@example.com`, `moderator@example.com`, `user@example.com`, password `plc-dev-password`), sample posts/resources/plugins/builds in each moderation status (published, pending, rejected), an imported post and plugin, and a generated sample image in Post Media. Idempotent (looks entries up by email, title, URL or full name).
- Test setup (`tests/helpers/testDatabase.ts`, used by `tests/e2e/global-setup.ts` and the Vitest integration tests): empties every collection of `plc_test` except `payload-migrations` (indexes stay), runs migrations and `seed`, and creates the three test users; S3 prefix `e2e/`. Sync fixtures and mocked external HTTP (`tests/fixtures/`) come with M5.
