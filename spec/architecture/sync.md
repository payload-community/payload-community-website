# Synchronization and external integrations

Part of the [architecture](README.md). Section numbers are global across the architecture files, so references such as [§6.3](moderation.md#63-transitions) stay stable.

---

## 11. Synchronization

### 11.1 Post sync (`syncPosts`)

Adapter interface (`src/sync/posts/types.ts`):

```ts
interface PostSourceAdapter {
  type: Source['type']
  fetchItems(source: Source, ctx: { fetch: typeof fetch; knownExternalIds: Set<string>; logger: Logger }): Promise<{ items: NormalizedPost[]; skipped: number }>
}
interface NormalizedPost {
  externalId: string; title: string; slug: string; url: string; date: string
  author?: string; summary?: string; tags: string[]; image?: { url: string; alt?: string }
}
```

Adapters are registered by source type in `src/sync/posts/adapters/index.ts`; `ctx.fetch` is injectable for tests. Each request has its own 30 s timeout.

`payload-rest` adapter (`src/sync/posts/adapters/payloadRest.ts`):

- Request: `GET {endpoint}?depth=1&sort=-publishedOn&limit=50&page={n}&where[_status][equals]=published` (verified 2026-10-09 against `https://payloadcms.com/api/posts`: 119 published docs, `docs[]`, `hasNextPage`, `nextPage`). Validated with `zod` (unknown keys ignored).
- Pagination: continue while `hasNextPage` and the page contained at least one externalId not yet imported; first run imports everything (≈3 pages), at most 20 pages per run. Consequence: edits to older posts are only picked up when they are on a page that also has a new post (accepted; [ADR-031](../decisions/0031-sync-implementation-details.md)).
- Items failing validation are skipped with a warning (counted in `skipped`), not failing the source.
- Item filtering (verified on live data): skip items whose `publishedOn` is in the future (a placeholder post `slug: "draft"` dated 2038 exists) and items without `category` (no public page, 404); skipped items are counted.

| Payload blog field | Collection field | Transformation |
|---|---|---|
| `id` | `posts.externalId` | as is |
| `title` | `posts.title` | trim |
| `slug` | `posts.slug` | `{slugify(source.name)}-{slug}`, set on create only |
| `category.slug` + `slug` | `posts.url` | `https://payloadcms.com/posts/{category.slug}/{slug}` — **verified**: `/posts/releases/…`, `/posts/guides/…`, `/posts/blog/…` return 200; `/posts/blog/{release slug}` returns 404. Base URL = origin of `source.siteUrl`. |
| `publishedOn` | `posts.date` | ISO date |
| `authors[].firstName` + `lastName` | `posts.author` | `"First Last"`, joined with `, `; guest posts (`authorType: 'guest'`, empty `authors`) use `guestAuthor` |
| `excerpt` (Lexical JSON; Slate array on old posts) | `posts.summary` | Lexical: `convertLexicalToPlaintext` from `@payloadcms/richtext-lexical/plaintext`; Slate: concatenated `text` nodes; whitespace-collapsed, max 500 chars (`…` when cut) |
| `category.name` | `posts.tags` | `[name]` |
| `image`, else `thumbnail`, else `meta.image` (`url`, `alt`) | `posts.image` → `post-media` | download once (see below); `alt` fallback = title. Video posts (`featuredMedia: 'videoUrl'`) have no `image`, only `thumbnail`. |
| – | `posts.source`, `origin = imported`, `_status = published`, `moderation.status = published` | |

Images: look up `post-media` by `originalUrl`; if missing, `fetch` the URL (timeout 15 s, max 10 MB, `content-type: image/*`), create `post-media` with `file: { data, mimetype, name, size }` (stored in S3 by `storage-s3`). Any failure → log + post imported without image, or keeps its previous image on update (`stats.imageFailures++`).

Upsert: find post by `url`; create when missing; update only when a mapped field changed (idempotent: no new version on unchanged data). Per-item `try/catch`; source status `success` (no failures), `partial` (some failed), `failed` (fetch error); `lastSyncedAt`, `lastSyncError`, `lastSyncStats` updated on the source.

### 11.2 Plugin sync (`syncPlugins`)

All calls use `@octokit/rest` with `GITHUB_TOKEN`, `@octokit/plugin-throttling` + `@octokit/plugin-retry` (rate limits) — validated with `zod`.

1. **Search**: `GET /search/repositories?q=topic:payload-plugin+fork:true&sort=updated&per_page=100&page=n` (`octokit.paginate`). GitHub returns at most 1,000 results per search; no date slicing in v1 (T4, decided 2026-10-10 — today the topic has far fewer repositories). If `total_count > 1000` or `incomplete_results` is true, the run imports what it got, **skips hiding** (step 5), logs a warning and records `partial` in the job summary so the cap is noticed before it matters.
2. **Filter**: keep `fork == false`, or `fork == true && stargazers_count > 2`.
3. **npm enrichment** for each kept repo (concurrency 4 via `p-limit`):
   - `GET /repos/{owner}/{repo}/contents/package.json` (root only). Missing file, invalid JSON, `private: true`, missing `name`, or `workspaces` present with no publishable root package → npm fields empty (monorepo case).
   - `GET https://registry.npmjs.org/{name}` → `dist-tags.latest`, `time[latest]` (`npmLatestVersion`, `npmLastPublishedAt`). 404 → npm fields empty.
   - `GET https://api.npmjs.org/downloads/point/last-week/{name}` → `downloads` (`npmWeeklyDownloads`).
   - npm calls run at concurrency 2 and retry HTTP 429/5xx up to 4 times (`Retry-After`, else 1, 2, 4, 8 s). The downloads API rate-limits bursts (verified 2026-10-12: without retries 202 of 301 repositories failed on a 429, with them ~6 download lookups per full run); when downloads stay unavailable the plugin keeps its stored count and the run counts `npmFailures` (status `partial`). Registry errors still fail that repository.
   - Optimization: when `pushed_at` is unchanged and `lastSyncedAt` is < 12 h old, skip the `package.json` and npm calls and keep the stored npm fields; only the GitHub counters are written and `lastSyncedAt` is not bumped (so the daily run always refreshes, while a manual rerun the same day is cheap). `lastSyncedAt` alone never creates a new version (`payload.db.updateOne`).
4. **Upsert by `fullName`** (lower-case). Existing manual plugin with the same `fullName` → update only sync-owned fields, keep `origin`, `createdBy`, user fields. Existing imported → update all mapped fields; un-hide. Imported `description` falls back to `full_name` when GitHub has none (the field is required); `homepage` is kept only when it is an absolute http(s) URL (GitHub often returns `''`).
5. **Hide**: imported plugins not in the result set (and not failed to fetch) → `hidden: true` (never deleted). Skip hiding if the search itself was incomplete (error, `incomplete_results`, or over the 1,000-result cap) to avoid mass-hiding.
6. **Manual plugins** not in the search: refresh GitHub data via `GET /repos/{owner}/{repo}` when `repositoryUrl` is on GitHub (404 → keep data, log); refresh npm data when `npmPackage` is set. Never hidden.
7. Log one summary line `{created, updated, unchanged, hidden, unhidden, skipped, failed, npmFailures, manualRefreshed, manualMissing, incomplete, searchTotal, status}`; metrics per result (M6). Status: `failed` when the search failed, `partial` when an item failed, a download count could not be refreshed or the search was incomplete, else `success`.

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
- Update when a manual plugin has a newer **draft** (pending/rejected edit): a normal update would publish the user's draft. Instead: refresh the published main document's sync-owned fields with `payload.db.updateOne` (no hooks/new version) and the draft with `payload.update({ draft: true })` (status unchanged via `context.system`). [ADR-012](../decisions/0012-sync-updates-with-pending-drafts.md).
- The same rule applies to imported posts and plugins (`src/sync/write.ts`, `updateSyncedEntry`), e.g. an imported plugin that a moderator edited as a draft or unpublished.

### 11.4 Triggers, retries and admin buttons

- Schedules and queues: [§9](operations.md#9-jobs-payload-jobs-queue). Code: `src/jobs/syncPosts.ts`, `src/jobs/syncPlugins.ts`.
- Job failure (so Payload retries, up to 2 times): `syncPosts` throws only when **every** processed source failed; `syncPlugins` throws when the GitHub search failed. Partial results are recorded and do not retry. Both steps are idempotent, so a retry repeats only the missing work.
- `POST /api/sync/:task` (`src/sync/endpoint.ts`): when a job of the same task is already queued, running or waiting for a retry, it returns `202 { alreadyQueued: true, jobId }` instead of queueing another one (the schedule uses the same rule). Body for `posts`: optional `{ sourceId }`.
- Admin "Sync now" buttons (`src/sync/components/`): Sources list (posts) and Plugins list (plugins), rendered only for admins; they call the endpoint and show a toast. Results appear on the source (`lastSync*`) and in the job log.

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
