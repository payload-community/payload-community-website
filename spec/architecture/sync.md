# Synchronization and external integrations

Part of the [architecture](README.md). Section numbers are global across the architecture files, so references such as [§6.3](moderation.md#63-transitions) stay stable.

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
- Update when a manual plugin has a newer **draft** (pending/rejected edit): a normal update would publish the user's draft. Instead: refresh the published main document's sync-owned fields with `payload.db.updateOne` (no hooks/new version) and the draft with `payload.update({ draft: true })` (status unchanged via `context.system`). [ADR-012](../decisions/0012-sync-updates-with-pending-drafts.md).

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
